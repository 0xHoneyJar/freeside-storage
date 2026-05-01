import { describe, expect, it } from "vitest";
import { Either } from "effect";
import { decodeSha40, decodeTokenId } from "../src/schema.js";

describe("TokenId", () => {
  it("accepts positive integers", () => {
    const result = decodeTokenId(5000);
    expect(Either.isRight(result)).toBe(true);
  });

  it("rejects zero", () => {
    expect(Either.isLeft(decodeTokenId(0))).toBe(true);
  });

  it("rejects negative integers", () => {
    expect(Either.isLeft(decodeTokenId(-1))).toBe(true);
  });

  it("rejects non-integers", () => {
    expect(Either.isLeft(decodeTokenId(1.5))).toBe(true);
  });
});

describe("Sha40", () => {
  it("accepts valid 40-char lowercase hex", () => {
    const valid = "8a7e39404ebf86073fab1d068d7037930298d121";
    expect(Either.isRight(decodeSha40(valid))).toBe(true);
  });

  it("rejects uppercase hex", () => {
    const upper = "8A7E39404EBF86073FAB1D068D7037930298D121";
    expect(Either.isLeft(decodeSha40(upper))).toBe(true);
  });

  it("rejects wrong length", () => {
    expect(Either.isLeft(decodeSha40("abc123"))).toBe(true);
  });

  it("rejects non-hex characters", () => {
    expect(
      Either.isLeft(decodeSha40("zzzz39404ebf86073fab1d068d7037930298d121")),
    ).toBe(true);
  });
});
