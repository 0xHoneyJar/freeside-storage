import { describe, expect, it } from "vitest";
import {
  isCanonicalPath,
  URL_CONTRACT_V1,
  URL_CONTRACT_VERSION,
  type MiberaSubCollection,
} from "@0xhoneyjar/freeside-protocol";

describe("URL_CONTRACT_VERSION (v1.3.0 additive — asset-pipeline-substrate)", () => {
  it("is at v1.3.0", () => {
    expect(URL_CONTRACT_VERSION).toBe("1.3.0");
  });

  it("is reflected on URL_CONTRACT_V1.version", () => {
    expect(URL_CONTRACT_V1.version).toBe("1.3.0");
  });

  it("registers asset-pipeline-substrate-v1 migration phase", () => {
    const phase = URL_CONTRACT_V1.migrationPhases.find(
      (p) => p.id === "asset-pipeline-substrate-v1",
    );
    expect(phase).toBeDefined();
    expect(phase?.cycleName).toBe("asset-pipeline-substrate-2026-05-03");
    expect(phase?.shippedAt).toBeNull();
  });
});

describe("URL_CONTRACT_V1 — Mibera-family sub-collection routes (v1.2.0)", () => {
  const mibera = URL_CONTRACT_V1.worlds.find((w) => w.slug === "Mibera");

  it("includes Shadow + MST as Mibera categories", () => {
    expect(mibera?.categories).toContain("Shadow");
    expect(mibera?.categories).toContain("MST");
  });

  it.each([
    ["Shadow", "expressions/current.json"],
    ["Shadow", "expressions/{version}/{tokenId}/{variant}/{expr}.webp"],
    ["MST", "expressions/current.json"],
    ["MST", "expressions/{version}/{tokenId}/{variant}/{expr}.webp"],
  ])("registers route %s · %s", (category, pattern) => {
    const route = mibera?.routes.find(
      (r) => r.category === category && r.pattern === pattern,
    );
    expect(route).toBeDefined();
    expect(route?.migrationPhase).toBe("mibera-family-sticker-substrate");
    expect(route?.currentBacking).toBe("s3-thj-assets");
  });
});

describe("isCanonicalPath — Mibera-family sub-collections", () => {
  it.each([
    "Mibera/Shadow/expressions/current.json",
    "/Mibera/Shadow/expressions/v1/100/transparent/neutral.webp",
    "Mibera/MST/expressions/current.json",
    "/Mibera/MST/expressions/v1/2789/transparent/angry.webp",
    // backwards-compat: existing routes still pass
    "Mibera/generated/42.webp",
    "Mibera/expressions/v2/100/transparent/neutral.webp",
    "Purupuru/cards/abc.webp",
  ])("recognizes canonical path: %s", (path) => {
    expect(isCanonicalPath(URL_CONTRACT_V1, path)).toBe(true);
  });

  it.each([
    "Mibera/UnknownCategory/foo.webp",
    "UnknownWorld/Shadow/foo.webp",
    "Mibera",
    "",
  ])("rejects non-canonical path: %s", (path) => {
    expect(isCanonicalPath(URL_CONTRACT_V1, path)).toBe(false);
  });
});

describe("MigrationPhase — mibera-family-sticker-substrate (v1.2.0)", () => {
  const phase = URL_CONTRACT_V1.migrationPhases.find(
    (p) => p.id === "mibera-family-sticker-substrate",
  );

  it("is registered in migrationPhases", () => {
    expect(phase).toBeDefined();
  });

  it("references the cycle name", () => {
    expect(phase?.cycleName).toBe(
      "mibera-family-sticker-substrate-2026-05-02",
    );
  });

  it("lists 4 affected sticker routes (Shadow + MST × manifest + per-token)", () => {
    expect(phase?.affectedRoutes).toHaveLength(4);
    expect(phase?.affectedRoutes).toEqual(
      expect.arrayContaining([
        "Mibera/Shadow/expressions/current.json",
        "Mibera/Shadow/expressions/{version}/{tokenId}/{variant}/{expr}.webp",
        "Mibera/MST/expressions/current.json",
        "Mibera/MST/expressions/{version}/{tokenId}/{variant}/{expr}.webp",
      ]),
    );
  });

  it("has not shipped yet (substrate-side handoff pending)", () => {
    expect(phase?.shippedAt).toBeNull();
  });
});

describe("MiberaSubCollection type — forward-compat", () => {
  it("accepts current sub-collections", () => {
    const shadow: MiberaSubCollection = "Shadow";
    const mst: MiberaSubCollection = "MST";
    expect(shadow).toBe("Shadow");
    expect(mst).toBe("MST");
  });
});
