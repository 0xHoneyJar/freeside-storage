/**
 * T0-4 service tests — AssetService Tag + Test/Live layer wiring.
 *
 * Per SDD §4 + sprint plan acceptance: Unit tests with fixture-based
 * AssetServiceTest pass for fetchOptimal + prefetch (partial-failure case);
 * AssetServiceLive boots without crash against mocked Lambda.
 */

import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import {
  AssetService,
  AssetServiceLive,
  makeAssetServiceTest,
} from "../../src/service/index.js";
import type {
  AssetReference,
  AssetVariant,
  ConsumerConstraint,
} from "../../src/schema/index.js";

const constraint = {
  maxBytes: 8 * 1024 * 1024,
  acceptFormats: ["webp", "png"] as const,
  consumerLabel: "test:fixture:v1",
} satisfies ConsumerConstraint;

const buildVariant = (
  byteLength: number,
  format: "webp" | "png" = "webp",
): AssetVariant => ({
  bytes: new Uint8Array(byteLength).fill(0xab),
  format,
  byteLength,
  source: "cdn-mirror",
  fetchedAt: 1714780800000,
  cacheKey: "test::fixture",
});

describe("AssetServiceTest — fixture-based", () => {
  it("fetchOptimal returns the fixture variant", async () => {
    const fixtures = new Map<string, AssetVariant>([
      ["https://x/a.png", buildVariant(1024)],
    ]);
    const layer = makeAssetServiceTest(fixtures);
    const ref: AssetReference = { canonicalUrl: "https://x/a.png" };
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* AssetService;
        return yield* svc.fetchOptimal(ref, constraint);
      }).pipe(Effect.provide(layer)),
    );
    expect(result.byteLength).toBe(1024);
    expect(result.format).toBe("webp");
  });

  it("fetchOptimal fails with NetworkError on fixture miss", async () => {
    const fixtures = new Map<string, AssetVariant>();
    const layer = makeAssetServiceTest(fixtures);
    const ref: AssetReference = { canonicalUrl: "https://x/missing.png" };
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const svc = yield* AssetService;
        return yield* svc.fetchOptimal(ref, constraint);
      }).pipe(Effect.provide(layer)),
    );
    expect(exit._tag).toBe("Failure");
  });

  it("prefetch returns partial-failure shape (3/4 ok)", async () => {
    const fixtures = new Map<string, AssetVariant>([
      ["https://x/a.png", buildVariant(1024)],
      ["https://x/b.png", buildVariant(2048)],
      ["https://x/c.png", buildVariant(512)],
    ]);
    const layer = makeAssetServiceTest(fixtures);
    const refs: ReadonlyArray<AssetReference> = [
      { canonicalUrl: "https://x/a.png" },
      { canonicalUrl: "https://x/b.png" },
      { canonicalUrl: "https://x/c.png" },
      { canonicalUrl: "https://x/missing.png" },
    ];
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* AssetService;
        return yield* svc.prefetch(refs, constraint);
      }).pipe(Effect.provide(layer)),
    );
    expect(result.stats.total).toBe(4);
    expect(result.stats.succeeded).toBe(3);
    expect(result.stats.failed).toBe(1);
    expect(result.stats.bytesTotal).toBe(1024 + 2048 + 512);
    const okResults = result.results.filter((r) => r.outcome === "ok");
    expect(okResults).toHaveLength(3);
  });

  it("prefetch never fails — empty fixture map = 100% failed shape", async () => {
    const layer = makeAssetServiceTest(new Map());
    const refs: ReadonlyArray<AssetReference> = [
      { canonicalUrl: "https://x/a.png" },
      { canonicalUrl: "https://x/b.png" },
    ];
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* AssetService;
        return yield* svc.prefetch(refs, constraint);
      }).pipe(Effect.provide(layer)),
    );
    expect(result.stats.total).toBe(2);
    expect(result.stats.failed).toBe(2);
    expect(result.stats.succeeded).toBe(0);
  });
});

describe("AssetServiceLive — boot smoke", () => {
  it("provides the AssetService Tag without throwing", async () => {
    // Boot smoke: layer evaluates and Tag resolves.
    // Network paths are NOT exercised here — fetchOptimal in production is
    // covered by integration tests once a mocked Lambda lands (P0-6).
    const program = Effect.gen(function* () {
      const svc = yield* AssetService;
      // assert it has the contract methods
      expect(typeof svc.fetchOptimal).toBe("function");
      expect(typeof svc.prefetch).toBe("function");
      return "live-booted";
    });
    const out = await Effect.runPromise(
      program.pipe(Effect.provide(AssetServiceLive)),
    );
    expect(out).toBe("live-booted");
  });
});
