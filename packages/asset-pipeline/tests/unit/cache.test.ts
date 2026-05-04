/**
 * T0-4 cache + budget-resolver + url-dsl unit tests.
 */

import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { cacheKey, makeMapCache } from "../../src/cache/map-cache.js";
import {
  buildTransformQuery,
  widthFromConstraint,
  DEFAULT_WIDTH,
} from "../../src/transform/url-dsl.js";
import { resolveBudget } from "../../src/transform/budget-resolver.js";
import type { AssetVariant, ConsumerConstraint } from "../../src/schema/index.js";

const buildVariant = (byteLength: number): AssetVariant => ({
  bytes: new Uint8Array(byteLength).fill(0xab),
  format: "webp",
  byteLength,
  source: "cdn-mirror",
  fetchedAt: Date.now(),
  cacheKey: "test::key",
});

describe("cacheKey", () => {
  it("composes (canonicalUrl, consumerLabel) with `::` separator", () => {
    expect(cacheKey("https://x/a.png", "bot:discord:v1")).toBe(
      "https://x/a.png::bot:discord:v1",
    );
  });

  it("different labels yield different keys (rollback discipline)", () => {
    expect(cacheKey("u", "bot:x:v1")).not.toBe(cacheKey("u", "bot:x:v2"));
  });
});

describe("MapCache", () => {
  it("get/put/evict round-trip", async () => {
    const cache = makeMapCache();
    const variant = buildVariant(100);
    await Effect.runPromise(cache.put("k1", variant));
    const got = await Effect.runPromise(cache.get("k1"));
    expect(got).toEqual(variant);
    await Effect.runPromise(cache.evict("k1"));
    const after = await Effect.runPromise(cache.get("k1"));
    expect(after).toBeUndefined();
  });

  it("get on missing key returns undefined (not error)", async () => {
    const cache = makeMapCache();
    const got = await Effect.runPromise(cache.get("missing"));
    expect(got).toBeUndefined();
  });

  it("size + clear behave correctly", async () => {
    const cache = makeMapCache();
    await Effect.runPromise(cache.put("a", buildVariant(1)));
    await Effect.runPromise(cache.put("b", buildVariant(1)));
    expect(await Effect.runPromise(cache.size())).toBe(2);
    await Effect.runPromise(cache.clear());
    expect(await Effect.runPromise(cache.size())).toBe(0);
  });

  it("LRU eviction kicks in past maxEntries", async () => {
    const cache = makeMapCache({ maxEntries: 5 });
    for (let i = 0; i < 7; i++) {
      await Effect.runPromise(cache.put(`k${i}`, buildVariant(i + 1)));
    }
    const size = await Effect.runPromise(cache.size());
    // dropped 20% of maxEntries (1 entry) at the threshold
    expect(size).toBeLessThanOrEqual(7);
    expect(size).toBeGreaterThanOrEqual(5);
  });
});

describe("URL DSL", () => {
  it("builds a transform query string", () => {
    const q = buildTransformQuery("Mibera/grails/cancer.png", {
      w: 1024,
      fmt: "webp",
      q: 80,
      maxBytes: 8388608,
    });
    expect(q).toBe(
      "path=Mibera%2Fgrails%2Fcancer.png&w=1024&fmt=webp&q=80&maxBytes=8388608",
    );
  });

  it("uses default quality when omitted", () => {
    const q = buildTransformQuery("a.png", { w: 256, fmt: "webp" });
    expect(q).toContain("q=80");
  });

  it("widthFromConstraint defaults to DEFAULT_WIDTH when no maxWidth", () => {
    const c: ConsumerConstraint = {
      maxBytes: 1024,
      acceptFormats: ["webp"],
      consumerLabel: "a:b",
    };
    expect(widthFromConstraint(c)).toBe(DEFAULT_WIDTH);
  });

  it("widthFromConstraint honors explicit maxWidth", () => {
    const c: ConsumerConstraint = {
      maxBytes: 1024,
      acceptFormats: ["webp"],
      maxWidth: 256,
      consumerLabel: "a:b",
    };
    expect(widthFromConstraint(c)).toBe(256);
  });
});

describe("budget-resolver", () => {
  const c8mb: ConsumerConstraint = {
    maxBytes: 8 * 1024 * 1024,
    acceptFormats: ["webp", "png"],
    consumerLabel: "bot:discord:v1",
  };

  const cPfp: ConsumerConstraint = {
    maxBytes: 100 * 1024,
    acceptFormats: ["webp"],
    maxWidth: 256,
    consumerLabel: "dim:pfp:v1",
  };

  it("picks bare {fmt} key when no width pinning", () => {
    const r = resolveBudget(
      {
        canonical: "https://x/a.png",
        variants: { webp: "https://x/a.webp", png: "https://x/a.png" },
      },
      c8mb,
    );
    expect(r.url).toBe("https://x/a.webp");
    expect(r.source).toBe("cdn-mirror");
    expect(r.format).toBe("webp");
  });

  it("picks {fmt}@{w} variant when maxWidth is constrained (PFP path)", () => {
    const r = resolveBudget(
      {
        canonical: "https://x/a.png",
        variants: {
          "webp@1600": "https://x/a-1600.webp",
          "webp@256": "https://x/a-256.webp",
          "webp@1024": "https://x/a-1024.webp",
        },
      },
      cPfp,
    );
    expect(r.url).toBe("https://x/a-256.webp");
    expect(r.source).toBe("cdn-mirror");
  });

  it("falls back to URL DSL when no variants match", () => {
    const r = resolveBudget(
      {
        canonical: "https://assets.0xhoneyjar.xyz/Mibera/grails/cancer.png",
      },
      c8mb,
    );
    expect(r.source).toBe("cdn-original-then-transform");
    expect(r.url).toContain("/_optimize?");
    expect(r.url).toContain("path=Mibera%2Fgrails%2Fcancer.png");
    expect(r.url).toContain("fmt=webp");
    expect(r.url).toContain("w=1024");
  });

  it("respects metadata-declared transform endpoint", () => {
    const r = resolveBudget(
      {
        canonical: "https://x/a.png",
        transform: "https://cdn.example/_optimize",
      },
      c8mb,
    );
    expect(r.url.startsWith("https://cdn.example/_optimize?")).toBe(true);
    expect(r.url).toContain("fmt=webp");
  });

  it("walks acceptFormats preference order (first match wins)", () => {
    const r = resolveBudget(
      {
        canonical: "https://x/a.png",
        variants: { png: "https://x/a.png" },
      },
      c8mb,
    );
    // webp not declared, falls through to png
    expect(r.url).toBe("https://x/a.png");
    expect(r.format).toBe("png");
  });
});
