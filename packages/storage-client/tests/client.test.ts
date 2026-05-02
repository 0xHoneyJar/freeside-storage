import { describe, expect, it } from "vitest";
import {
  miberaImageURL,
  miberaMetadataURL,
  mstMetadataURL,
} from "../src/client.js";

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
