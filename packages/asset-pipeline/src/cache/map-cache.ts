/**
 * MapCache — bounded in-memory cache for AssetVariants.
 *
 * Per SDD §2.1 (cache/map-cache.ts). Per-(canonicalUrl, consumerLabel)
 * keying — different labels are different cache namespaces (ADR-13
 * rollback flag · `:v<N>` suffix flips namespace cleanly).
 *
 * Bounded LRU-ish: when entries exceed `maxEntries`, the oldest 20% are
 * evicted. Soft TTL (24h default per SDD §2.1) — entries past TTL are
 * treated as miss and re-fetched. Cache contents are immutable per-input
 * (per ADR-5) — TTL is a memory-pressure ceiling, not a freshness contract.
 */

import { Context, Effect, Layer } from "effect";
import {
  AssetVariant,
  CacheError,
} from "../schema/index.js";

/**
 * Cache key constructor — `(canonicalUrl, consumerLabel)` digest.
 *
 * Plain string concat with `::` separator. Both inputs are already
 * validated (canonicalUrl is non-empty by Schema; consumerLabel is regex-
 * validated). The separator is unlikely to collide because consumerLabel
 * forbids `:` outside the documented `<repo>:<surface>[:v<N>]` shape.
 */
export const cacheKey = (
  canonicalUrl: string,
  consumerLabel: string,
): string => `${canonicalUrl}::${consumerLabel}`;

interface CacheEntry {
  readonly variant: AssetVariant;
  readonly insertedAt: number;
  /** Reading bumps to MRU position (LRU-ish). */
  lastReadAt: number;
}

export interface MapCacheOptions {
  /** Soft eviction ceiling. Default 1024. */
  readonly maxEntries?: number;
  /** Soft TTL in ms. Default 24h. */
  readonly ttlMs?: number;
}

const DEFAULT_MAX = 1024;
const DEFAULT_TTL = 24 * 60 * 60 * 1000;

/**
 * In-memory cache instance shape. Effect-flavored API — `get`/`put`/`evict`
 * return `Effect<_, CacheError>` so failures propagate through the
 * AssetService pipeline cleanly.
 */
export interface MapCache {
  readonly get: (
    key: string,
  ) => Effect.Effect<AssetVariant | undefined, CacheError>;
  readonly put: (
    key: string,
    variant: AssetVariant,
  ) => Effect.Effect<void, CacheError>;
  readonly evict: (key: string) => Effect.Effect<void, CacheError>;
  readonly size: () => Effect.Effect<number, never>;
  readonly clear: () => Effect.Effect<void, never>;
}

export class MapCacheTag extends Context.Tag("@0xhoneyjar/asset-pipeline/MapCache")<
  MapCacheTag,
  MapCache
>() {}

export const makeMapCache = (
  options?: MapCacheOptions,
): MapCache => {
  const maxEntries = options?.maxEntries ?? DEFAULT_MAX;
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL;
  const store = new Map<string, CacheEntry>();

  const evictLruIfNeeded = (): void => {
    if (store.size <= maxEntries) return;
    // drop oldest 20% by lastReadAt
    const entries = Array.from(store.entries());
    entries.sort((a, b) => a[1].lastReadAt - b[1].lastReadAt);
    const dropCount = Math.ceil(maxEntries * 0.2);
    for (let i = 0; i < dropCount && i < entries.length; i++) {
      const entry = entries[i];
      if (entry) store.delete(entry[0]);
    }
  };

  return {
    get: (key) =>
      Effect.try({
        try: () => {
          const entry = store.get(key);
          if (!entry) return undefined;
          // soft TTL check
          if (Date.now() - entry.insertedAt > ttlMs) {
            store.delete(key);
            return undefined;
          }
          entry.lastReadAt = Date.now();
          return entry.variant;
        },
        catch: (cause) =>
          new CacheError({ cacheKey: key, operation: "get", cause }),
      }),

    put: (key, variant) =>
      Effect.try({
        try: () => {
          const now = Date.now();
          store.set(key, {
            variant,
            insertedAt: now,
            lastReadAt: now,
          });
          evictLruIfNeeded();
        },
        catch: (cause) =>
          new CacheError({ cacheKey: key, operation: "put", cause }),
      }),

    evict: (key) =>
      Effect.try({
        try: () => {
          store.delete(key);
        },
        catch: (cause) =>
          new CacheError({ cacheKey: key, operation: "evict", cause }),
      }),

    size: () => Effect.sync(() => store.size),

    clear: () =>
      Effect.sync(() => {
        store.clear();
      }),
  };
};

/**
 * Default Live layer — fresh empty MapCache per AssetServiceLive invocation.
 * Consumers may build their own with custom maxEntries/ttlMs via
 * `Layer.succeed(MapCacheTag, makeMapCache({ ... }))`.
 */
export const MapCacheLive = Layer.succeed(MapCacheTag, makeMapCache());
