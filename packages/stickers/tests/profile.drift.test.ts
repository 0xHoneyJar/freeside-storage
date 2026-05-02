/**
 * Drift simulation — synthetic mutations of a valid profile MUST surface as
 * Either.Left at decode time. This is the F-2 drift signal that Phase-1
 * dimensions wiring will surface as a console.warn.
 *
 * Per SDD §7.3 (composable-sticker-substrate-2026-05-01) + PRD FR-5.
 * **Mutation count target: ≥5** — the actual count below is 7 to give
 * margin against future Schema additions.
 *
 * Doctrine: [[migration-tail-as-bug-source]] — these tests are the listening
 * primitive in canonical form. When the substrate evolves, drift surfaces
 * here in CI before users see broken stickers.
 */

import { describe, expect, it } from "vitest";
import { Either, Schema } from "effect";
import { StickerProfile } from "../src/profile.js";

const baseValid = {
  schemaVersion: "1.0",
  tokenId: 42,
  world: "mibera",
  expressionsAvailable: ["neutral", "smile"],
  variantsAvailable: ["transparent"],
  defaultVariant: "transparent",
  manifestVersion: "v2",
  manifestUrl: "https://assets.0xhoneyjar.xyz/Mibera/expressions/current.json",
  isGrail: false,
} as const;

describe("StickerProfile · drift simulation (≥5 mutations · FR-5)", () => {
  it("baseline valid profile decodes Right (control)", () => {
    const result = Schema.decodeUnknownEither(StickerProfile)(baseValid);
    expect(Either.isRight(result)).toBe(true);
  });

  it("M-1 · empty expressionsAvailable rejects (minItems(1))", () => {
    const drifted = { ...baseValid, expressionsAvailable: [] };
    const result = Schema.decodeUnknownEither(StickerProfile)(drifted);
    expect(Either.isLeft(result)).toBe(true);
  });

  it("M-2 · malformed manifestUrl rejects (regex anchored to assets.0xhoneyjar.xyz)", () => {
    const drifted = {
      ...baseValid,
      manifestUrl: "https://malicious.example.com/expressions/current.json",
    };
    const result = Schema.decodeUnknownEither(StickerProfile)(drifted);
    expect(Either.isLeft(result)).toBe(true);
  });

  it("M-3 · unknown world literal rejects (StickerWorld closed enum)", () => {
    const drifted = { ...baseValid, world: "oblivion" };
    const result = Schema.decodeUnknownEither(StickerProfile)(drifted);
    expect(Either.isLeft(result)).toBe(true);
  });

  it("M-4 · unknown daemonState literal rejects (DaemonState closed enum)", () => {
    const drifted = { ...baseValid, daemonState: "evolved" };
    const result = Schema.decodeUnknownEither(StickerProfile)(drifted);
    expect(Either.isLeft(result)).toBe(true);
  });

  it("M-5 · schemaVersion: '2.0' rejects (Literal('1.0') only — additive bump path required)", () => {
    const drifted = { ...baseValid, schemaVersion: "2.0" };
    const result = Schema.decodeUnknownEither(StickerProfile)(drifted);
    expect(Either.isLeft(result)).toBe(true);
  });

  it("M-6 · missing required field (isGrail) rejects", () => {
    const { isGrail: _omitted, ...withoutIsGrail } = baseValid;
    const result = Schema.decodeUnknownEither(StickerProfile)(withoutIsGrail);
    expect(Either.isLeft(result)).toBe(true);
  });

  it("M-7 · variantsAvailable empty rejects (minItems(1))", () => {
    const drifted = { ...baseValid, variantsAvailable: [] };
    const result = Schema.decodeUnknownEither(StickerProfile)(drifted);
    expect(Either.isLeft(result)).toBe(true);
  });

  // Inverse — confirms decode is permissive on Schema.optional axes
  it("optional daemon-axis missing → Right (G-5 permissive decode)", () => {
    // baseValid has none of the optional axes — already covered by
    // roundtrip; reasserted here so the drift suite is internally complete.
    const result = Schema.decodeUnknownEither(StickerProfile)(baseValid);
    expect(Either.isRight(result)).toBe(true);
  });
});
