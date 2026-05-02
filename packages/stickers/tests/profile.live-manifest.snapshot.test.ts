/**
 * Live-manifest snapshot — decode the checked-in fixture (T-6) through the
 * adapter shim (T-8) and assert the synthesized profile decodes Right.
 *
 * Per SDD §7.4 + §10.3 A-1 (composable-sticker-substrate-2026-05-01).
 * **Failure mode**: when this test goes red, EITHER the substrate drifted
 * from canonical OR the Schema needs an additive minor bump. Either path
 * triggers explicit human review (per fixtures/README.md refresh cadence).
 */

import { describe, expect, it } from "vitest";
import { Either, Schema } from "effect";
import { StickerProfile } from "../src/profile.js";
import {
  synthesizeStickerProfile,
  type GlobalManifest,
} from "../src/adapter.js";
import miberaCurrent from "./fixtures/mibera-current-2026-05-01.json" with { type: "json" };

describe("StickerProfile · live-manifest snapshot", () => {
  it("synthesizes + decodes Right against the 2026-05-01 mibera fixture", () => {
    const synthesized = synthesizeStickerProfile(
      miberaCurrent as GlobalManifest,
      { tokenId: 42, world: "mibera", isGrail: false },
    );
    const result = Schema.decodeUnknownEither(StickerProfile)(synthesized);
    expect(Either.isRight(result)).toBe(true);
  });

  it("synthesizes a grail-flagged profile that decodes Right (frozen field per D-3)", () => {
    const synthesized = synthesizeStickerProfile(
      miberaCurrent as GlobalManifest,
      { tokenId: 1, world: "mibera", isGrail: true },
    );
    const result = Schema.decodeUnknownEither(StickerProfile)(synthesized);
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right.isGrail).toBe(true);
    }
  });

  it("propagates manifestVersion from globalManifest.version", () => {
    const synthesized = synthesizeStickerProfile(
      miberaCurrent as GlobalManifest,
      { tokenId: 100, world: "mibera", isGrail: false },
    );
    expect(synthesized.manifestVersion).toBe("v2");
  });
});
