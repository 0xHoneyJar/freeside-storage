import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  fetchSovereignMetadata,
  lookupHoneyroadAsset,
  lookupSovereignManifest,
  miberaImageURL,
  miberaMetadataURL,
  mstMetadataURL,
} from "../src/client.js";
import { MalformedURLError } from "../src/errors.js";

const NETWORK = process.env.FREESIDE_NETWORK_TESTS === "1";

describe("miberaImageURL (sync hash builder)", () => {
  it("defaults to phase 8", () => {
    const hash = "8a7e39404ebf86073fab1d068d7037930298d121";
    expect(miberaImageURL(hash)).toBe(
      `https://assets.0xhoneyjar.xyz/reveal_phase8/images/${hash}.png`,
    );
  });

  it("respects explicit phase", () => {
    const hash = "8a7e39404ebf86073fab1d068d7037930298d121";
    expect(miberaImageURL(hash, { phase: 1 })).toBe(
      `https://assets.0xhoneyjar.xyz/reveal_phase1/images/${hash}.png`,
    );
  });
});

describe("miberaMetadataURL", () => {
  it("returns sovereign manifest URL for token 5000", () => {
    expect(miberaMetadataURL(5000)).toBe(
      "https://metadata.0xhoneyjar.xyz/mibera/5000",
    );
  });

  it("works for token 1 and token 10000", () => {
    expect(miberaMetadataURL(1)).toBe(
      "https://metadata.0xhoneyjar.xyz/mibera/1",
    );
    expect(miberaMetadataURL(10000)).toBe(
      "https://metadata.0xhoneyjar.xyz/mibera/10000",
    );
  });
});

describe("mstMetadataURL", () => {
  it("returns sovereign manifest URL under world-scoped MST path", () => {
    expect(mstMetadataURL(2789)).toBe(
      "https://metadata.0xhoneyjar.xyz/mibera/mst/2789",
    );
    expect(mstMetadataURL(2903)).toBe(
      "https://metadata.0xhoneyjar.xyz/mibera/mst/2903",
    );
  });

  it("works for boundary tokens", () => {
    expect(mstMetadataURL(1)).toBe(
      "https://metadata.0xhoneyjar.xyz/mibera/mst/1",
    );
  });
});

describe("lookupSovereignManifest", () => {
  it("returns single-segment URL for canon namesake (collection omitted)", () => {
    expect(lookupSovereignManifest({ world: "mibera", tokenId: 42 })).toBe(
      "https://metadata.0xhoneyjar.xyz/mibera/42",
    );
  });

  it("returns two-segment URL for sibling collection", () => {
    expect(
      lookupSovereignManifest({
        world: "mibera",
        collection: "tarot",
        tokenId: 42,
      }),
    ).toBe("https://metadata.0xhoneyjar.xyz/mibera/tarot/42");
  });

  it("works for every v1.1.0 known collection", () => {
    const cases = [
      { collection: "mst" as const, expected: "mibera/mst/7" },
      { collection: "tarot" as const, expected: "mibera/tarot/7" },
      { collection: "gif" as const, expected: "mibera/gif/7" },
      { collection: "candies" as const, expected: "mibera/candies/7" },
      { collection: "fractures" as const, expected: "mibera/fractures/7" },
    ];
    for (const { collection, expected } of cases) {
      expect(
        lookupSovereignManifest({ world: "mibera", collection, tokenId: 7 }),
      ).toBe(`https://metadata.0xhoneyjar.xyz/${expected}`);
    }
  });
});

describe("lookupHoneyroadAsset", () => {
  it("translates d163 URL to assets-host equivalent (path preserved)", () => {
    expect(
      lookupHoneyroadAsset(
        "https://d163aeqznbc6js.cloudfront.net/Mibera/generated/42.webp",
      ),
    ).toBe("https://assets.0xhoneyjar.xyz/Mibera/generated/42.webp");
  });

  it("preserves query string and hash fragments", () => {
    expect(
      lookupHoneyroadAsset(
        "https://d163aeqznbc6js.cloudfront.net/Mibera/quiz_archetypes/1.webp?v=2#x",
      ),
    ).toBe(
      "https://assets.0xhoneyjar.xyz/Mibera/quiz_archetypes/1.webp?v=2#x",
    );
  });

  it.each([
    "https://assets.0xhoneyjar.xyz/Mibera/generated/42.webp", // already flipped
    "https://honeyroad.xyz/api/vm/42", // honeyroad route
    "https://gateway.irys.xyz/abc123", // irys gateway
    "https://example.com/foo", // unrelated host
    "not-a-url", // malformed
    "", // empty string
  ])("throws MalformedURLError on non-d163 input: %s", (input) => {
    expect(() => lookupHoneyroadAsset(input)).toThrowError(MalformedURLError);
  });
});

describe("back-compat parity (canon + MST wrappers ≡ lookupSovereignManifest)", () => {
  it("miberaMetadataURL(N) === lookupSovereignManifest({world:'mibera', tokenId:N})", () => {
    for (const tokenId of [1, 42, 5000, 10000]) {
      expect(miberaMetadataURL(tokenId)).toBe(
        lookupSovereignManifest({ world: "mibera", tokenId }),
      );
    }
  });

  it("mstMetadataURL(N) === lookupSovereignManifest({world:'mibera', collection:'mst', tokenId:N})", () => {
    for (const tokenId of [1, 1689, 2789, 3219]) {
      expect(mstMetadataURL(tokenId)).toBe(
        lookupSovereignManifest({
          world: "mibera",
          collection: "mst",
          tokenId,
        }),
      );
    }
  });
});

describe.skipIf(!NETWORK)(
  "fetchSovereignMetadata (live network — opt-in via FREESIDE_NETWORK_TESTS=1)",
  () => {
    it("decodes a live canon Mibera manifest (tokenId 5000)", async () => {
      const doc = await Effect.runPromise(
        fetchSovereignMetadata({ world: "mibera", tokenId: 5000 }),
      );
      expect(doc.name).toBeTypeOf("string");
      expect(doc.description).toBeTypeOf("string");
      expect(doc.image.length).toBeGreaterThan(0);
    });

    it("decodes a live MST manifest (tokenId 1) with assets-host image", async () => {
      const doc = await Effect.runPromise(
        fetchSovereignMetadata({
          world: "mibera",
          collection: "mst",
          tokenId: 1,
        }),
      );
      expect(doc.name).toBeTypeOf("string");
      expect(doc.image).toMatch(/^https:\/\/assets\.0xhoneyjar\.xyz\//);
    });
  },
);
