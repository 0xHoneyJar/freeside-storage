import { describe, expect, it } from "vitest";

/**
 * T0-1 scaffold canary — proves dual-env vitest config (node + jsdom) wires
 * up correctly and the package surface compiles. Real schema/service tests
 * land in T0-2 (asset-pipeline-substrate cycle B sprint-1).
 */
describe("@0xhoneyjar/asset-pipeline scaffold", () => {
  it("loads the public surface without throwing", async () => {
    const mod = await import("../../src/index.js");
    expect(mod).toBeDefined();
  });
});
