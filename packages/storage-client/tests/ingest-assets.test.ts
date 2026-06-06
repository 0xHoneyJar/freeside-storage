/**
 * Hermetic tests for the generic asset-ingest abstraction (the IMAGE half).
 *
 * Everything runs against an in-memory StorageAdapter + a fake `fetchBytes` —
 * NO live CloudFront, NO live AWS, NO network. The fake fetcher returns known
 * bytes for known URLs so the copier is exercised end-to-end deterministically.
 * Candies is the first consumer, but the same call shape works for any
 * collection (only sourceUrl/targetKey vary).
 */

import { describe, expect, it, vi } from "vitest";
import type {
  ListResult,
  ParityReport,
  StorageAdapter,
  StorageKey,
  StorageObject,
  SyncResult,
} from "@0xhoneyjar/freeside-protocol";
import {
  ingestAssets,
  DEFAULT_ALLOWED_HOSTS,
  type AssetIngestItem,
  type FetchBytes,
  type FetchedAsset,
} from "../src/ingest-assets.js";

/**
 * Minimal in-memory StorageAdapter. Records every PUT under its flat S3 key and
 * serves GETs back so idempotency can be exercised. sync/list/verifyParity are
 * unused by ingestAssets and throw if called (keeps the surface honest).
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
    throw new Error("list not used by ingestAssets");
  }
  async sync(): Promise<SyncResult> {
    throw new Error("sync not used by ingestAssets");
  }
  async verifyParity(): Promise<ParityReport> {
    throw new Error("verifyParity not used by ingestAssets");
  }
}

const CF_HOST = "d163aeqznbc6js.cloudfront.net";

/** Deterministic PNG-ish bytes keyed by filename (NOT real image bytes — the */
/** abstraction never decodes them; it copies them verbatim). */
function bytesFor(filename: string): Buffer {
  return Buffer.from(`PNGBYTES:${filename}`, "utf8");
}

/**
 * Build a fake fetchBytes over an in-memory CDN table. Keys are full source
 * URLs. Returns the recorded bytes + content-type; throws (like a 404) for an
 * unknown URL. NO real network is ever touched.
 */
function fakeFetcher(
  table: Record<string, FetchedAsset>,
): { fetchBytes: FetchBytes; calls: string[] } {
  const calls: string[] = [];
  const fetchBytes: FetchBytes = async (sourceUrl) => {
    calls.push(sourceUrl);
    const hit = table[sourceUrl];
    if (!hit) {
      throw new Error(`fake CDN 404: ${sourceUrl}`);
    }
    return hit;
  };
  return { fetchBytes, calls };
}

function candiesSourceUrl(filename: string): string {
  return `https://${CF_HOST}/images/Mibera/Drugs/${filename}`;
}

function candiesItem(tokenId: string, filename: string): AssetIngestItem {
  return {
    tokenId,
    sourceUrl: candiesSourceUrl(filename),
    targetKey: `Mibera/Drugs/${filename}`,
  };
}

describe("ingestAssets — generic asset copier (Candies image slice)", () => {
  it("default allowlist is exactly the candies LIVE CloudFront host", () => {
    expect(DEFAULT_ALLOWED_HOSTS).toEqual(["d163aeqznbc6js.cloudfront.net"]);
  });

  it("copies each asset to the exact sovereign target key", async () => {
    const adapter = new InMemoryAdapter();
    const { fetchBytes } = fakeFetcher({
      [candiesSourceUrl("bubblegum-buds.png")]: {
        bytes: bytesFor("bubblegum-buds.png"),
        contentType: "image/png",
      },
      [candiesSourceUrl("sour-diesel.png")]: {
        bytes: bytesFor("sour-diesel.png"),
        contentType: "image/png",
      },
    });

    const result = await ingestAssets({
      fetchBytes,
      adapter,
      world: "mibera",
      items: [
        candiesItem("1", "bubblegum-buds.png"),
        candiesItem("7", "sour-diesel.png"),
      ],
    });

    expect(result.copied).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errored).toBe(0);

    // Exact seam-contract target keys: thj-assets/Mibera/Drugs/{filename}
    expect(adapter.store.has("Mibera/Drugs/bubblegum-buds.png")).toBe(true);
    expect(adapter.store.has("Mibera/Drugs/sour-diesel.png")).toBe(true);

    const stored = adapter.store.get("Mibera/Drugs/bubblegum-buds.png");
    expect(stored?.contentType).toBe("image/png");
    expect(stored?.bytes.equals(bytesFor("bubblegum-buds.png"))).toBe(true);
    // tenant/path split: tenant = "Mibera", path = "Drugs/{filename}"
    expect(stored?.key.tenant).toBe("Mibera");
    expect(stored?.key.path).toBe("Drugs/bubblegum-buds.png");

    expect(result.results.every((r) => r.status === "copied")).toBe(true);
  });

  it("REJECTS an off-allowlist host (Cloudinary) and issues NO put/fetch", async () => {
    const adapter = new InMemoryAdapter();
    const { fetchBytes, calls } = fakeFetcher({});

    const cloudinaryUrl =
      "https://res.cloudinary.com/honeyjar/image/upload/v1/bubblegum-buds.png";

    const result = await ingestAssets({
      fetchBytes,
      adapter,
      world: "mibera",
      items: [
        {
          tokenId: "1",
          sourceUrl: cloudinaryUrl,
          targetKey: "Mibera/Drugs/bubblegum-buds.png",
        },
      ],
    });

    expect(result.copied).toBe(0);
    expect(result.errored).toBe(1);
    expect(result.results[0]?.status).toBe("error");
    if (result.results[0]?.status === "error") {
      expect(result.results[0].reason).toContain("not on allowlist");
      expect(result.results[0].reason).toContain("res.cloudinary.com");
    }
    // Host rejected BEFORE the fetch — fake CDN never called, nothing written.
    expect(calls).toEqual([]);
    expect(adapter.putCalls).toBe(0);
    expect(adapter.store.size).toBe(0);
  });

  it("REJECTS a non-image content-type (text/html) without writing it", async () => {
    const adapter = new InMemoryAdapter();
    const { fetchBytes } = fakeFetcher({
      [candiesSourceUrl("notanimage.png")]: {
        bytes: Buffer.from("<html>403 forbidden</html>", "utf8"),
        contentType: "text/html",
      },
    });

    const result = await ingestAssets({
      fetchBytes,
      adapter,
      world: "mibera",
      items: [candiesItem("1", "notanimage.png")],
    });

    expect(result.copied).toBe(0);
    expect(result.errored).toBe(1);
    expect(result.results[0]?.status).toBe("error");
    if (result.results[0]?.status === "error") {
      expect(result.results[0].reason).toContain("not an allowed image type");
    }
    expect(adapter.putCalls).toBe(0);
    expect(adapter.store.size).toBe(0);
  });

  it("accepts png/jpeg/webp/gif (and ignores content-type parameters)", async () => {
    const adapter = new InMemoryAdapter();
    const { fetchBytes } = fakeFetcher({
      [candiesSourceUrl("a.png")]: { bytes: bytesFor("a"), contentType: "image/png" },
      [candiesSourceUrl("b.jpg")]: {
        bytes: bytesFor("b"),
        contentType: "image/jpeg; charset=binary",
      },
      [candiesSourceUrl("c.webp")]: { bytes: bytesFor("c"), contentType: "IMAGE/WEBP" },
      [candiesSourceUrl("d.gif")]: { bytes: bytesFor("d"), contentType: "image/gif" },
    });

    const result = await ingestAssets({
      fetchBytes,
      adapter,
      world: "mibera",
      items: [
        candiesItem("1", "a.png"),
        candiesItem("2", "b.jpg"),
        candiesItem("3", "c.webp"),
        candiesItem("4", "d.gif"),
      ],
    });

    expect(result.copied).toBe(4);
    expect(result.errored).toBe(0);
    // Content-type normalized (lowercased, params dropped) on the stored object.
    expect(adapter.store.get("Mibera/Drugs/b.jpg")?.contentType).toBe("image/jpeg");
    expect(adapter.store.get("Mibera/Drugs/c.webp")?.contentType).toBe("image/webp");
  });

  it("is idempotent — re-running skips byte-identical assets (no second PUT/fetch-write)", async () => {
    const adapter = new InMemoryAdapter();
    const { fetchBytes } = fakeFetcher({
      [candiesSourceUrl("bubblegum-buds.png")]: {
        bytes: bytesFor("bubblegum-buds.png"),
        contentType: "image/png",
      },
    });
    const req = {
      fetchBytes,
      adapter,
      world: "mibera",
      items: [candiesItem("1", "bubblegum-buds.png")],
    };

    const first = await ingestAssets(req);
    expect(first.copied).toBe(1);
    expect(adapter.putCalls).toBe(1);

    const second = await ingestAssets(req);
    expect(second.copied).toBe(0);
    expect(second.skipped).toBe(1);
    expect(second.results[0]?.status).toBe("skipped");
    // No second PUT — the byte-compare short-circuits before the adapter writes.
    expect(adapter.putCalls).toBe(1);
  });

  it("re-copies when the source bytes change for the same target key", async () => {
    const adapter = new InMemoryAdapter();
    const url = candiesSourceUrl("bubblegum-buds.png");

    const v1 = fakeFetcher({
      [url]: { bytes: Buffer.from("v1-bytes"), contentType: "image/png" },
    });
    await ingestAssets({
      fetchBytes: v1.fetchBytes,
      adapter,
      world: "mibera",
      items: [candiesItem("1", "bubblegum-buds.png")],
    });
    expect(adapter.putCalls).toBe(1);

    const v2 = fakeFetcher({
      [url]: { bytes: Buffer.from("v2-bytes-different"), contentType: "image/png" },
    });
    const changed = await ingestAssets({
      fetchBytes: v2.fetchBytes,
      adapter,
      world: "mibera",
      items: [candiesItem("1", "bubblegum-buds.png")],
    });
    expect(changed.copied).toBe(1);
    expect(adapter.putCalls).toBe(2);
    expect(
      adapter.store.get("Mibera/Drugs/bubblegum-buds.png")?.bytes.toString("utf8"),
    ).toBe("v2-bytes-different");
  });

  it("rejects a content-type mismatch when the item declares an expected type", async () => {
    const adapter = new InMemoryAdapter();
    const { fetchBytes } = fakeFetcher({
      [candiesSourceUrl("x.png")]: { bytes: bytesFor("x"), contentType: "image/gif" },
    });

    const result = await ingestAssets({
      fetchBytes,
      adapter,
      world: "mibera",
      items: [
        {
          tokenId: "1",
          sourceUrl: candiesSourceUrl("x.png"),
          targetKey: "Mibera/Drugs/x.png",
          contentType: "image/png", // declared png, source served gif
        },
      ],
    });

    expect(result.errored).toBe(1);
    if (result.results[0]?.status === "error") {
      expect(result.results[0].reason).toContain("content-type mismatch");
    }
    expect(adapter.putCalls).toBe(0);
  });

  it("rejects a targetKey containing path-traversal metacharacters", async () => {
    const adapter = new InMemoryAdapter();
    const { fetchBytes, calls } = fakeFetcher({});

    const result = await ingestAssets({
      fetchBytes,
      adapter,
      world: "mibera",
      items: [
        {
          tokenId: "1",
          sourceUrl: candiesSourceUrl("x.png"),
          targetKey: "Mibera/../../etc/passwd",
        },
      ],
    });

    expect(result.errored).toBe(1);
    if (result.results[0]?.status === "error") {
      expect(result.results[0].reason).toContain("invalid targetKey");
    }
    // Rejected before any fetch.
    expect(calls).toEqual([]);
    expect(adapter.store.size).toBe(0);
  });

  it("rejects an absolute / single-segment targetKey", async () => {
    const adapter = new InMemoryAdapter();
    const { fetchBytes } = fakeFetcher({
      [candiesSourceUrl("x.png")]: { bytes: bytesFor("x"), contentType: "image/png" },
    });

    const absolute = await ingestAssets({
      fetchBytes,
      adapter,
      world: "mibera",
      items: [
        { tokenId: "1", sourceUrl: candiesSourceUrl("x.png"), targetKey: "/Mibera/Drugs/x.png" },
      ],
    });
    expect(absolute.errored).toBe(1);

    const noPath = await ingestAssets({
      fetchBytes,
      adapter,
      world: "mibera",
      items: [{ tokenId: "1", sourceUrl: candiesSourceUrl("x.png"), targetKey: "x.png" }],
    });
    expect(noPath.errored).toBe(1);
    expect(adapter.store.size).toBe(0);
  });

  it("isolates per-item failures — a bad item does not abort the batch", async () => {
    const adapter = new InMemoryAdapter();
    const { fetchBytes } = fakeFetcher({
      [candiesSourceUrl("good1.png")]: { bytes: bytesFor("good1"), contentType: "image/png" },
      [candiesSourceUrl("good2.png")]: { bytes: bytesFor("good2"), contentType: "image/png" },
      // "missing.png" is intentionally absent → fake CDN throws (404).
    });

    const result = await ingestAssets({
      fetchBytes,
      adapter,
      world: "mibera",
      items: [
        candiesItem("1", "good1.png"),
        candiesItem("2", "missing.png"), // fetch throws
        candiesItem("3", "good2.png"),
      ],
    });

    expect(result.copied).toBe(2);
    expect(result.errored).toBe(1);
    expect(result.results.map((r) => r.status)).toEqual(["copied", "error", "copied"]);
    if (result.results[1]?.status === "error") {
      expect(result.results[1].reason).toContain("fetch-failed");
    }
    expect(adapter.store.has("Mibera/Drugs/good1.png")).toBe(true);
    expect(adapter.store.has("Mibera/Drugs/good2.png")).toBe(true);
    expect(adapter.store.has("Mibera/Drugs/missing.png")).toBe(false);
  });

  it("rejects an unparseable sourceUrl cleanly", async () => {
    const adapter = new InMemoryAdapter();
    const { fetchBytes, calls } = fakeFetcher({});
    const result = await ingestAssets({
      fetchBytes,
      adapter,
      world: "mibera",
      items: [{ tokenId: "1", sourceUrl: "not a url", targetKey: "Mibera/Drugs/x.png" }],
    });
    expect(result.errored).toBe(1);
    if (result.results[0]?.status === "error") {
      expect(result.results[0].reason).toContain("unparseable sourceUrl");
    }
    expect(calls).toEqual([]);
  });

  it("rejects an invalid world slug at the boundary", async () => {
    const adapter = new InMemoryAdapter();
    const { fetchBytes } = fakeFetcher({});
    await expect(
      ingestAssets({
        fetchBytes,
        adapter,
        world: "mibera/evil",
        items: [],
      }),
    ).rejects.toThrow(/invalid world/);
  });

  it("never reaches for a global fetch — only the injected fetchBytes is used", async () => {
    const adapter = new InMemoryAdapter();
    const { fetchBytes, calls } = fakeFetcher({
      [candiesSourceUrl("only.png")]: { bytes: bytesFor("only"), contentType: "image/png" },
    });
    // Spy on the global to PROVE the module never touches it.
    const globalSpy = vi.spyOn(globalThis, "fetch");

    await ingestAssets({
      fetchBytes,
      adapter,
      world: "mibera",
      items: [candiesItem("1", "only.png")],
    });

    expect(globalSpy).not.toHaveBeenCalled();
    expect(calls).toEqual([candiesSourceUrl("only.png")]);
    globalSpy.mockRestore();
  });

  it("is reusable for ANY collection — only sourceUrl/targetKey + allowlist vary", async () => {
    const adapter = new InMemoryAdapter();
    // A wholly different collection + a DIFFERENT (per-request) allowed host.
    const otherHost = "cdn.example-tarot.net";
    const tarotUrl = `https://${otherHost}/tarot/0.webp`;
    const { fetchBytes } = fakeFetcher({
      [tarotUrl]: { bytes: bytesFor("tarot-0"), contentType: "image/webp" },
    });

    const result = await ingestAssets({
      fetchBytes,
      adapter,
      world: "mibera",
      allowedHosts: [otherHost],
      items: [{ tokenId: "0", sourceUrl: tarotUrl, targetKey: "Mibera/Tarot/0.webp" }],
    });

    expect(result.copied).toBe(1);
    expect(adapter.store.has("Mibera/Tarot/0.webp")).toBe(true);

    // ...and the default candies host is NOT allowed when an explicit list is given.
    const denied = await ingestAssets({
      fetchBytes,
      adapter,
      world: "mibera",
      allowedHosts: [otherHost],
      items: [candiesItem("1", "bubblegum-buds.png")],
    });
    expect(denied.errored).toBe(1);
  });
});
