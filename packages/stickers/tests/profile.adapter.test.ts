/**
 * Adapter shim — covers known-good token, grail token, skipped-band token,
 * malformed global manifest. Per T-8 (bd-2iaz) acceptance + SDD §10.3 A-1.
 *
 * Doctrine: [[migration-tail-as-bug-source]] — these tests pin the seam
 * through which migration-tail bugs become visible. Synthesizer purity +
 * skipped-token drift signal preservation are the load-bearing guarantees.
 */

import { describe, expect, it } from "vitest";
import { Either, Schema } from "effect";
import { StickerProfile } from "../src/profile.js";
import {
  COLLECTION_MANIFEST_URLS,
  synthesizeStickerProfile,
  V06X_EXPRESSIONS,
  type GlobalManifest,
} from "../src/adapter.js";

const baseManifest: GlobalManifest = {
  version: "v2",
  generatedAt: "2026-03-08T21:53:13Z",
  tokenCount: 9958,
  expressionCount: 15,
  skippedTokenIds: [],
  variants: ["transparent", "bg"],
  defaultVariant: "transparent",
};

describe("synthesizeStickerProfile · adapter shim", () => {
  it("known-good token gets V0.6.x expressions baseline", () => {
    const result = synthesizeStickerProfile(baseManifest, {
      tokenId: 42,
      world: "mibera",
      isGrail: false,
    });
    expect(result.expressionsAvailable).toEqual(V06X_EXPRESSIONS);
    expect(result.tokenId).toBe(42);
    expect(result.world).toBe("mibera");
    expect(result.isGrail).toBe(false);
    expect(result.manifestUrl).toBe(COLLECTION_MANIFEST_URLS.mibera);
  });

  it("grail token preserves isGrail: true (frozen field per D-3)", () => {
    const result = synthesizeStickerProfile(baseManifest, {
      tokenId: 1,
      world: "mibera",
      isGrail: true,
    });
    expect(result.isGrail).toBe(true);
    // Synthesizer doesn't filter expressions on isGrail — that's lookupSticker's job.
    expect(result.expressionsAvailable).toEqual(V06X_EXPRESSIONS);
  });

  it("skipped-band token gets empty expressionsAvailable (drift signal preserved)", () => {
    const skippedManifest: GlobalManifest = {
      ...baseManifest,
      skippedTokenIds: [1700, 1800, 1900],
    };
    const result = synthesizeStickerProfile(skippedManifest, {
      tokenId: 1800,
      world: "mibera",
      isGrail: false,
    });
    expect(result.expressionsAvailable).toEqual([]);
    // Schema.minItems(1) MUST reject this synthesized profile — that's F-2.
    const decoded = Schema.decodeUnknownEither(StickerProfile)(result);
    expect(Either.isLeft(decoded)).toBe(true);
  });

  it("malformed global manifest (missing version) falls back to 'unknown'", () => {
    const malformed: GlobalManifest = {};
    const result = synthesizeStickerProfile(malformed, {
      tokenId: 42,
      world: "mibera",
      isGrail: false,
    });
    expect(result.manifestVersion).toBe("unknown");
    expect(result.variantsAvailable).toEqual(["transparent"]);
    expect(result.defaultVariant).toBe("transparent");
  });

  it("synthesizer is pure (same input → same output, no shared state)", () => {
    const args = { tokenId: 42, world: "mibera" as const, isGrail: false };
    const r1 = synthesizeStickerProfile(baseManifest, args);
    const r2 = synthesizeStickerProfile(baseManifest, args);
    expect(r1).toEqual(r2);
  });

  it("respects manifest variants when present", () => {
    const result = synthesizeStickerProfile(baseManifest, {
      tokenId: 42,
      world: "mibera",
      isGrail: false,
    });
    expect(result.variantsAvailable).toEqual(["transparent", "bg"]);
  });

  it("synthesized profile decodes Right under StickerProfile Schema", () => {
    const result = synthesizeStickerProfile(baseManifest, {
      tokenId: 42,
      world: "mibera",
      isGrail: false,
    });
    const decoded = Schema.decodeUnknownEither(StickerProfile)(result);
    expect(Either.isRight(decoded)).toBe(true);
  });
});
