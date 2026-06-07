/**
 * Hermetic tests for the generic metadata-ingest abstraction.
 *
 * Everything runs against an in-memory StorageAdapter — NO live AWS, NO network.
 * The abstraction is exercised as a generic (Candies as the first consumer, but
 * the same call shape works for any collection).
 */

import { describe, expect, it } from "vitest";
import type {
  ListResult,
  ParityReport,
  StorageAdapter,
  StorageKey,
  StorageObject,
  SyncResult,
} from "@0xhoneyjar/freeside-protocol";
import type { MetadataDocument } from "@0xhoneyjar/freeside-protocol";
import {
  ingestCollectionMetadata,
  metadataS3Key,
  type IngestItem,
} from "../src/ingest.js";

/**
 * Minimal in-memory StorageAdapter. Records every PUT under its flat S3 key and
 * serves GETs back so idempotency can be exercised. The sync/list/verifyParity
 * verbs are unused by ingest and throw if called (keeps the surface honest).
 */
class InMemoryAdapter implements StorageAdapter {
  readonly store = new Map<string, StorageObject>();
  putCalls = 0;

  private flat(key: StorageKey): string {
    return key.path ? `${key.tenant}/${key.path}` : key.tenant;
  }

  async put(obj: StorageObject): Promise<void> {
    this.putCalls += 1;
    this.store.set(this.flat(obj.key), {
      ...obj,
      // Snapshot the bytes so later mutation of the caller's buffer can't leak.
      bytes: Buffer.from(obj.bytes),
    });
  }

  async get(key: StorageKey): Promise<StorageObject> {
    const found = this.store.get(this.flat(key));
    if (!found) {
      const err = new Error("NoSuchKey") as Error & { name: string };
      err.name = "NoSuchKey";
      throw err;
    }
    return found;
  }

  async list(): Promise<ListResult> {
    throw new Error("list not used by ingest");
  }
  async sync(): Promise<SyncResult> {
    throw new Error("sync not used by ingest");
  }
  async verifyParity(): Promise<ParityReport> {
    throw new Error("verifyParity not used by ingest");
  }
}

/**
 * Build a Candies metadata document from a honeyroad `listings` row, exactly per
 * the shared seam contract. This lives in the TEST (it's collection-specific
 * mapping); the abstraction under test stays generic.
 */
interface CandiesListing {
  id: number;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  shipsFrom: string;
  shipsTo: string;
  price: number;
}

function candiesDoc(row: CandiesListing): MetadataDocument {
  return {
    name: row.title,
    description: row.description,
    // Sovereign host — normalized off the legacy d163 CloudFront the old
    // /api/metadata/drug/[id] route used.
    image: `https://assets.0xhoneyjar.xyz/Mibera/Drugs/${row.imageUrl}`,
    attributes: [
      { trait_type: "Category", value: row.category },
      { trait_type: "Ships From", value: row.shipsFrom },
      { trait_type: "Ships To", value: row.shipsTo },
      { trait_type: "Price", value: row.price },
    ],
  };
}

const ROW_1: CandiesListing = {
  id: 1,
  title: "Sour Diesel Gummies",
  description: "Tangy fuel for the sprawl.",
  imageUrl: "sour-diesel.png",
  category: "Edibles",
  shipsFrom: "Berachain",
  shipsTo: "Worldwide",
  price: 42,
};

const ROW_2: CandiesListing = {
  id: 7,
  title: "Blue Dream Lollipops",
  description: "Daydream on a stick.",
  imageUrl: "blue-dream.png",
  category: "Confections",
  shipsFrom: "Mibera",
  shipsTo: "EU",
  price: 13,
};

const VERSION = "v1-2026-06-06";

describe("ingestCollectionMetadata — generic abstraction (Candies slice)", () => {
  it("writes each document to the correct S3 key shape", async () => {
    const adapter = new InMemoryAdapter();
    const items: IngestItem[] = [
      { tokenId: String(ROW_1.id), document: candiesDoc(ROW_1) },
      { tokenId: String(ROW_2.id), document: candiesDoc(ROW_2) },
    ];

    const result = await ingestCollectionMetadata(adapter, {
      world: "mibera",
      collection: "candies",
      version: VERSION,
      items,
    });

    expect(result.written).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errored).toBe(0);

    // Exact seam-contract key: thj-assets/mibera/candies/metadata/v/{ver}/{id}.json
    expect(adapter.store.has(`mibera/candies/metadata/v/${VERSION}/1.json`)).toBe(
      true,
    );
    expect(adapter.store.has(`mibera/candies/metadata/v/${VERSION}/7.json`)).toBe(
      true,
    );

    // Result keys match the helper.
    expect(result.results[0]?.key).toBe(
      metadataS3Key("mibera", "candies", VERSION, "1"),
    );
    expect(result.results.every((r) => r.status === "written")).toBe(true);
  });

  it("persists application/json with the seam-contract MetadataDocument shape", async () => {
    const adapter = new InMemoryAdapter();
    await ingestCollectionMetadata(adapter, {
      world: "mibera",
      collection: "candies",
      version: VERSION,
      items: [{ tokenId: String(ROW_1.id), document: candiesDoc(ROW_1) }],
    });

    const stored = adapter.store.get(
      `mibera/candies/metadata/v/${VERSION}/1.json`,
    );
    expect(stored?.contentType).toBe("application/json");

    const parsed = JSON.parse(stored!.bytes.toString("utf8")) as MetadataDocument;
    expect(parsed.name).toBe(ROW_1.title);
    expect(parsed.description).toBe(ROW_1.description);
    expect(parsed.image).toBe(
      "https://assets.0xhoneyjar.xyz/Mibera/Drugs/sour-diesel.png",
    );
    // image is normalized OFF the legacy d163 CloudFront host.
    expect(String(parsed.image)).not.toContain("cloudfront.net");
    expect(parsed.attributes).toEqual([
      { trait_type: "Category", value: "Edibles" },
      { trait_type: "Ships From", value: "Berachain" },
      { trait_type: "Ships To", value: "Worldwide" },
      { trait_type: "Price", value: 42 },
    ]);
  });

  it("is idempotent — re-running skips byte-identical documents (no second PUT)", async () => {
    const adapter = new InMemoryAdapter();
    const req = {
      world: "mibera",
      collection: "candies",
      version: VERSION,
      items: [{ tokenId: String(ROW_1.id), document: candiesDoc(ROW_1) }],
    } as const;

    const first = await ingestCollectionMetadata(adapter, req);
    expect(first.written).toBe(1);
    expect(adapter.putCalls).toBe(1);

    const second = await ingestCollectionMetadata(adapter, req);
    expect(second.written).toBe(0);
    expect(second.skipped).toBe(1);
    expect(second.results[0]?.status).toBe("skipped");
    // No second PUT issued — idempotency short-circuits before the adapter.
    expect(adapter.putCalls).toBe(1);
  });

  it("re-writes when the document content changes for the same token", async () => {
    const adapter = new InMemoryAdapter();
    const base = {
      world: "mibera",
      collection: "candies",
      version: VERSION,
    };

    await ingestCollectionMetadata(adapter, {
      ...base,
      items: [{ tokenId: "1", document: candiesDoc(ROW_1) }],
    });
    expect(adapter.putCalls).toBe(1);

    const changed = await ingestCollectionMetadata(adapter, {
      ...base,
      items: [
        {
          tokenId: "1",
          document: candiesDoc({ ...ROW_1, price: 99 }),
        },
      ],
    });
    expect(changed.written).toBe(1);
    expect(adapter.putCalls).toBe(2);
  });

  it("rejects a malformed document (missing required field) without writing it", async () => {
    const adapter = new InMemoryAdapter();
    // `image` missing — violates MetadataDocument (required field).
    const malformed = {
      name: "broken",
      description: "no image",
    } as unknown as MetadataDocument;

    const result = await ingestCollectionMetadata(adapter, {
      world: "mibera",
      collection: "candies",
      version: VERSION,
      items: [{ tokenId: "1", document: malformed }],
    });

    expect(result.written).toBe(0);
    expect(result.errored).toBe(1);
    expect(result.results[0]?.status).toBe("error");
    if (result.results[0]?.status === "error") {
      expect(result.results[0].reason).toContain("schema-validation-failed");
    }
    // Nothing was written to the adapter.
    expect(adapter.store.size).toBe(0);
    expect(adapter.putCalls).toBe(0);
  });

  it("rejects an empty image string (Schema.minLength) without writing it", async () => {
    const adapter = new InMemoryAdapter();
    const result = await ingestCollectionMetadata(adapter, {
      world: "mibera",
      collection: "candies",
      version: VERSION,
      items: [
        {
          tokenId: "1",
          document: { name: "x", description: "y", image: "" } as MetadataDocument,
        },
      ],
    });
    expect(result.errored).toBe(1);
    expect(result.results[0]?.status).toBe("error");
    expect(adapter.store.size).toBe(0);
  });

  it("isolates per-item failures — a bad item does not abort the batch", async () => {
    const adapter = new InMemoryAdapter();
    const result = await ingestCollectionMetadata(adapter, {
      world: "mibera",
      collection: "candies",
      version: VERSION,
      items: [
        { tokenId: "1", document: candiesDoc(ROW_1) },
        {
          tokenId: "2",
          document: { name: "bad", description: "no image" } as unknown as MetadataDocument,
        },
        { tokenId: "7", document: candiesDoc(ROW_2) },
      ],
    });

    expect(result.written).toBe(2);
    expect(result.errored).toBe(1);
    expect(result.results.map((r) => r.status)).toEqual([
      "written",
      "error",
      "written",
    ]);
    expect(adapter.store.has(`mibera/candies/metadata/v/${VERSION}/1.json`)).toBe(
      true,
    );
    expect(adapter.store.has(`mibera/candies/metadata/v/${VERSION}/7.json`)).toBe(
      true,
    );
    expect(adapter.store.has(`mibera/candies/metadata/v/${VERSION}/2.json`)).toBe(
      false,
    );
  });

  it("rejects a tokenId containing path-traversal metacharacters", async () => {
    const adapter = new InMemoryAdapter();
    const result = await ingestCollectionMetadata(adapter, {
      world: "mibera",
      collection: "candies",
      version: VERSION,
      items: [
        { tokenId: "../../etc/passwd", document: candiesDoc(ROW_1) },
      ],
    });
    expect(result.errored).toBe(1);
    expect(result.results[0]?.status).toBe("error");
    if (result.results[0]?.status === "error") {
      expect(result.results[0].reason).toContain("invalid tokenId");
    }
    expect(adapter.store.size).toBe(0);
  });

  it("is reusable for ANY collection — no candies hardcoding", async () => {
    const adapter = new InMemoryAdapter();
    // A wholly different collection ('tarot') and world reuse the same call.
    const tarotDoc: MetadataDocument = {
      name: "The Bera",
      description: "Major arcana.",
      image: "https://assets.0xhoneyjar.xyz/Mibera/Tarot/0.webp",
      attributes: [{ trait_type: "Arcana", value: "Major" }],
    };

    const result = await ingestCollectionMetadata(adapter, {
      world: "mibera",
      collection: "tarot",
      version: "v2-2026-06-06",
      items: [{ tokenId: "0", document: tarotDoc }],
    });

    expect(result.written).toBe(1);
    expect(
      adapter.store.has("mibera/tarot/metadata/v/v2-2026-06-06/0.json"),
    ).toBe(true);
  });

  it("rejects invalid world/collection/version slugs at the boundary", async () => {
    const adapter = new InMemoryAdapter();
    await expect(
      ingestCollectionMetadata(adapter, {
        world: "mibera/evil",
        collection: "candies",
        version: VERSION,
        items: [],
      }),
    ).rejects.toThrow(/invalid world/);

    await expect(
      ingestCollectionMetadata(adapter, {
        world: "mibera",
        collection: "../escape",
        version: VERSION,
        items: [],
      }),
    ).rejects.toThrow(/invalid collection/);
  });
});
