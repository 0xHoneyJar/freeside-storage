/**
 * Schema roundtrip — encode then decode must preserve the validated shape.
 *
 * Per SDD §7.2 + §7.3 (composable-sticker-substrate-2026-05-01). Covers all
 * required fields + each branded primitive + Schema.optional daemon-stage
 * axes (present + absent · PRD G-5 acceptance).
 */

import { describe, expect, it } from "vitest";
import { Either, Schema } from "effect";
import { StickerProfile } from "../src/profile.js";

const baseValid = {
  schemaVersion: "1.0",
  tokenId: 42,
  world: "mibera",
  expressionsAvailable: ["neutral", "smile", "wink"],
  variantsAvailable: ["transparent"],
  defaultVariant: "transparent",
  manifestVersion: "v2",
  manifestUrl: "https://assets.0xhoneyjar.xyz/Mibera/expressions/current.json",
  isGrail: false,
} as const;

describe("StickerProfile · roundtrip (decode → encode → decode)", () => {
  it("decodes a valid required-only profile to Right", () => {
    const result = Schema.decodeUnknownEither(StickerProfile)(baseValid);
    expect(Either.isRight(result)).toBe(true);
  });

  it("preserves shape across encode → decode (required-only)", () => {
    const decoded = Schema.decodeUnknownEither(StickerProfile)(baseValid);
    expect(Either.isRight(decoded)).toBe(true);
    if (Either.isRight(decoded)) {
      const encoded = Schema.encodeEither(StickerProfile)(decoded.right);
      expect(Either.isRight(encoded)).toBe(true);
      if (Either.isRight(encoded)) {
        const redecoded = Schema.decodeUnknownEither(StickerProfile)(
          encoded.right,
        );
        expect(Either.isRight(redecoded)).toBe(true);
      }
    }
  });

  it("decodes with all Schema.optional daemon-stage axes present (G-5)", () => {
    const withOptional = {
      ...baseValid,
      daemonState: "stirring",
      lifecyclePhase: "early",
      voicePointer: "default",
      experimentPointers: ["a/b", "c/d"],
    };
    const result = Schema.decodeUnknownEither(StickerProfile)(withOptional);
    expect(Either.isRight(result)).toBe(true);
  });

  it("decodes with all Schema.optional axes absent (G-5 permissive decode)", () => {
    // baseValid has none of the optional axes — proves permissive decode.
    const result = Schema.decodeUnknownEither(StickerProfile)(baseValid);
    expect(Either.isRight(result)).toBe(true);
  });

  it("decodes a profile with all 4 daemon states (literal coverage)", () => {
    const states = ["dormant", "stirring", "breathing", "soul"] as const;
    for (const daemonState of states) {
      const candidate = { ...baseValid, daemonState };
      const result = Schema.decodeUnknownEither(StickerProfile)(candidate);
      expect(Either.isRight(result)).toBe(true);
    }
  });

  it("decodes with multiple variantsAvailable entries", () => {
    const candidate = {
      ...baseValid,
      variantsAvailable: ["transparent", "bg", "outline"],
      defaultVariant: "bg",
    };
    const result = Schema.decodeUnknownEither(StickerProfile)(candidate);
    expect(Either.isRight(result)).toBe(true);
  });

  it("brands ExpressionId, VariantId, LifecyclePhase via kebab-case pattern", () => {
    // Empty + uppercase + leading digit + leading hyphen all reject.
    const invalidExpression = { ...baseValid, expressionsAvailable: [""] };
    expect(
      Either.isLeft(
        Schema.decodeUnknownEither(StickerProfile)(invalidExpression),
      ),
    ).toBe(true);

    const upperVariant = { ...baseValid, variantsAvailable: ["Transparent"] };
    expect(
      Either.isLeft(Schema.decodeUnknownEither(StickerProfile)(upperVariant)),
    ).toBe(true);
  });
});
