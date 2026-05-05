/**
 * MetadataDocument v1.4.0 additivity tests — cycle R sprint 4 acceptance.
 *
 * Per architect lock A7 + sprint plan AC-4.1: the optional
 * `medium_capabilities?` field is additive-only. Existing payloads
 * (which never emit the field) MUST decode unchanged.
 *
 * Tests:
 *   1. Pre-v1.4.0 payload (no medium_capabilities) decodes cleanly
 *   2. v1.4.0 payload with medium_capabilities decodes cleanly
 *   3. Empty medium_capabilities object decodes cleanly
 *   4. Per-medium override decodes cleanly with arbitrary inner shape
 *   5. URL_CONTRACT_VERSION is "1.4.0"
 *   6. New migration phase id 'cmp-boundary-architecture-v140' is in the union
 *
 * Per cmp-boundary architecture decision: the inner shape of
 * medium_capabilities is opaque at this layer (Record<string, unknown>) —
 * `freeside-storage` does NOT depend on `@0xhoneyjar/medium-registry`.
 * Consumers that want typed access decode the inner value at their own
 * boundary (persona-engine wardrobe-resolver in cycle-3).
 */

import { describe, expect, it } from "vitest";
import { Either, Schema } from "effect";
import {
  MediumCapabilitiesPerMedium,
  MetadataDocument,
  URL_CONTRACT_VERSION,
  URL_CONTRACT_V1,
} from "@0xhoneyjar/freeside-protocol";

describe("MetadataDocument v1.4.0 additivity (cycle R sprint 4)", () => {
  it("pre-v1.4.0 payload (no medium_capabilities) decodes unchanged", () => {
    // Sample shape from canon Mibera #1 (production fixture)
    const raw = {
      name: "Mibera #1",
      description:
        "Freetekno · Greek ancestor · Cancer sun, Leo moon · swag rank B",
      image:
        "https://assets.0xhoneyjar.xyz/reveal_phase8/images/8a7e39404ebf86073fab1d068d7037930298d121.png",
      external_url: "https://0xhoneyjar.xyz/mibera/1",
      attributes: [
        { trait_type: "Archetype", value: "Freetekno" },
        { trait_type: "Ancestor", value: "Greek" },
      ],
    };
    const decoded = Schema.decodeUnknownEither(MetadataDocument)(raw);
    expect(Either.isRight(decoded)).toBe(true);
    if (Either.isRight(decoded)) {
      expect(decoded.right.name).toBe("Mibera #1");
      expect(decoded.right.medium_capabilities).toBeUndefined();
    }
  });

  it("MST shape (no medium_capabilities) decodes unchanged", () => {
    // Sample shape from MST #1 (production fixture)
    const raw = {
      name: "MST #1",
      description:
        "Mibera Shadow Traits is an infinite collection of NFTs you can build yourself and mint.",
      image: "https://assets.0xhoneyjar.xyz/Mibera/generated/1.webp",
      attributes: [
        { trait_type: "background", value: "jungle lab" },
        { trait_type: "body", value: "pale" },
      ],
    };
    const decoded = Schema.decodeUnknownEither(MetadataDocument)(raw);
    expect(Either.isRight(decoded)).toBe(true);
  });

  it("v1.4.0 payload with medium_capabilities decodes cleanly", () => {
    const raw = {
      name: "Mongolian #507",
      description: "First instance of mibera-as-NPC.",
      image: "https://assets.0xhoneyjar.xyz/Mibera/grails/mongolian.png",
      medium_capabilities: {
        discord: {
          customEmoji: true,
          sticker: true,
          embed: true,
        },
        cli: {
          ansi: true,
          embed: false,
        },
      },
    };
    const decoded = Schema.decodeUnknownEither(MetadataDocument)(raw);
    expect(Either.isRight(decoded)).toBe(true);
    if (Either.isRight(decoded)) {
      expect(decoded.right.medium_capabilities).toBeDefined();
      const caps = decoded.right.medium_capabilities!;
      expect(caps.discord).toEqual({
        customEmoji: true,
        sticker: true,
        embed: true,
      });
      expect(caps.cli?.ansi).toBe(true);
    }
  });

  it("empty medium_capabilities object decodes cleanly", () => {
    const raw = {
      name: "Edge case",
      description: "Empty caps map.",
      image: "https://assets.0xhoneyjar.xyz/Mibera/generated/1.webp",
      medium_capabilities: {},
    };
    const decoded = Schema.decodeUnknownEither(MetadataDocument)(raw);
    expect(Either.isRight(decoded)).toBe(true);
  });

  it("medium_capabilities accepts arbitrary inner override shape (opaque)", () => {
    // The inner Record<string, unknown> deliberately lets consumers shape
    // their own override surface — e.g., a hypothetical 'web' medium with
    // a payload-shape that medium-registry hasn't sealed yet.
    const raw = {
      name: "Forward-compat",
      description: "Future medium.",
      image: "https://assets.0xhoneyjar.xyz/Mibera/generated/1.webp",
      medium_capabilities: {
        web: {
          markdownDialect: "github-flavored",
          allowsCodeFence: true,
          maxRichEmbedCount: 5,
        },
      },
    };
    const decoded = Schema.decodeUnknownEither(MetadataDocument)(raw);
    expect(Either.isRight(decoded)).toBe(true);
  });

  it("MediumCapabilitiesPerMedium standalone Schema decodes correctly", () => {
    const raw = {
      discord: { customEmoji: false },
      telegram: { stickerSet: ["mongolian-set-1"] },
    };
    const decoded = Schema.decodeUnknownEither(MediumCapabilitiesPerMedium)(raw);
    expect(Either.isRight(decoded)).toBe(true);
  });

  it("rejects medium_capabilities with non-record inner value", () => {
    const raw = {
      name: "Bad shape",
      description: "Inner value should be a record, not a primitive.",
      image: "https://assets.0xhoneyjar.xyz/Mibera/generated/1.webp",
      medium_capabilities: {
        discord: "string-not-record", // wrong shape
      },
    };
    const decoded = Schema.decodeUnknownEither(MetadataDocument)(raw);
    expect(Either.isLeft(decoded)).toBe(true);
  });
});

describe("URL_CONTRACT v1.4.0 bump (cycle R sprint 4)", () => {
  it("URL_CONTRACT_VERSION is '1.4.0'", () => {
    expect(URL_CONTRACT_VERSION).toBe("1.4.0");
  });

  it("URL_CONTRACT_V1.version matches", () => {
    expect(URL_CONTRACT_V1.version).toBe("1.4.0");
  });

  it("'cmp-boundary-architecture-v140' migration phase exists", () => {
    const phase = URL_CONTRACT_V1.migrationPhases.find(
      (p) => p.id === "cmp-boundary-architecture-v140",
    );
    expect(phase).toBeDefined();
    expect(phase?.shippedAt).toBeNull(); // not yet flipped on chain
    expect(phase?.cycleName).toContain("cmp-boundary-architecture-2026-05-04");
  });

  it("v1.3.0 migration phases preserved (no regression)", () => {
    const ids = URL_CONTRACT_V1.migrationPhases.map((p) => p.id);
    expect(ids).toContain("asset-pipeline-substrate-v1");
    expect(ids).toContain("mibera-family-sticker-substrate");
    expect(ids).toContain("cross-collection-sovereign");
    expect(ids).toContain("mst-sovereign-cutover");
    expect(ids).toContain("mibera-sovereign-cutover");
  });
});
