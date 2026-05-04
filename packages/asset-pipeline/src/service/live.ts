/**
 * AssetServiceLive — production layer for the asset-pipeline.
 *
 * Per SDD §4.2 (asset-pipeline-substrate cycle B). Composes:
 *   1. MapCache (per-(ref, label) keying)
 *   2. parseImage (URL_CONTRACT v1.3.0 normalization)
 *   3. resolveBudget (variant URL OR transform DSL)
 *   4. fetch bytes via globalThis.fetch (works in node 20+ and browser)
 *   5. budget post-check (BudgetExceeded if bytes > maxBytes)
 *   6. cache + telemetry (telemetry stub — full sink wiring lands in T0-7)
 *
 * Skeleton-quality at P0: real telemetry sink + Lambda invocation land
 * with P0-5/P0-6 (terraform). The shape here is the contract — consumers
 * (P1 grail-cache, P2 composeWithImage, P3 PFP) wire against this Tag
 * without caring about the internal pipeline.
 */

import { Effect, Layer } from "effect";
import { AssetService, type PrefetchResult } from "./AssetService.js";
import { MapCacheTag, MapCacheLive, cacheKey } from "../cache/map-cache.js";
import { resolveBudget } from "../transform/budget-resolver.js";
import { parseImage } from "../parse/index.js";
import {
  AssetVariant,
  BudgetExceeded,
  NetworkError,
  type AssetError,
  type AssetReference,
  type AssetSource,
  type ConsumerConstraint,
  type ImageFormat,
} from "../schema/index.js";

/**
 * Fetch bytes via globalThis.fetch. Wrapped in Effect.tryPromise so
 * network/timeout failures surface as NetworkError.
 */
const fetchBytes = (
  url: string,
): Effect.Effect<{ bytes: Uint8Array; status: number }, NetworkError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const buf = await response.arrayBuffer();
      return { bytes: new Uint8Array(buf), status: response.status };
    },
    catch: (cause) =>
      new NetworkError({
        url,
        status: undefined,
        cause,
      }),
  });

/**
 * fetchOptimal pipeline — single ref + constraint → AssetVariant.
 * Pure-Effect composition; no shared mutation outside MapCache.
 */
const buildFetchOptimal = (cache: {
  readonly get: ReturnType<typeof MapCacheLive extends Layer.Layer<infer T> ? never : never>;
}) => null; // placeholder for type-illustration; actual impl is inline below

export const AssetServiceLive = Layer.effect(
  AssetService,
  Effect.gen(function* () {
    const cache = yield* MapCacheTag;

    const fetchOptimal = (
      ref: AssetReference,
      constraint: ConsumerConstraint,
    ): Effect.Effect<AssetVariant, AssetError> =>
      Effect.gen(function* () {
        const key = cacheKey(ref.canonicalUrl, constraint.consumerLabel);

        // 1. cache lookup
        const cached = yield* cache.get(key);
        if (cached) {
          return cached;
        }

        // 2. parseImage(canonical) — normalize union → struct
        // (P0 skeleton: canonical-only path; metadata-document fetch lands
        // when a consumer calls fetchOptimal with a struct-shape image.)
        const parsed = parseImage(ref.canonicalUrl);

        // 3. resolveBudget → variant URL
        const resolved = resolveBudget(parsed, constraint);

        // 4. fetch bytes
        const { bytes } = yield* fetchBytes(resolved.url);

        // 5. budget post-check
        if (bytes.byteLength > constraint.maxBytes) {
          return yield* Effect.fail(
            new BudgetExceeded({
              url: resolved.url,
              actualBytes: bytes.byteLength,
              budgetBytes: constraint.maxBytes,
              triedFormats: [resolved.format],
            }),
          );
        }

        // 6. construct + cache + return
        const variant: AssetVariant = {
          bytes,
          format: resolved.format as ImageFormat,
          byteLength: bytes.byteLength,
          source: resolved.source as AssetSource,
          fetchedAt: Date.now(),
          cacheKey: key,
        };

        yield* cache.put(key, variant);
        return variant;
      });

    const prefetch = (
      refs: ReadonlyArray<AssetReference>,
      constraint: ConsumerConstraint,
      opts?: { concurrency?: number; timeoutMs?: number },
    ): Effect.Effect<PrefetchResult, never> =>
      Effect.gen(function* () {
        const concurrency = opts?.concurrency ?? 4;
        const timeoutMs = opts?.timeoutMs ?? 10_000;

        // bounded-concurrency map; each ref is wrapped to never throw
        const perRef = (ref: AssetReference) =>
          fetchOptimal(ref, constraint).pipe(
            Effect.timeout(timeoutMs),
            Effect.either,
            Effect.map((either) =>
              either._tag === "Right"
                ? {
                    ref,
                    outcome: "ok" as const,
                    variant: either.right,
                  }
                : {
                    ref,
                    outcome: "failed" as const,
                    error: either.left as AssetError,
                  },
            ),
          );

        const results = yield* Effect.all(refs.map(perRef), {
          concurrency,
        });

        // aggregate stats
        let succeeded = 0;
        let failed = 0;
        let cacheHits = 0;
        let bytesTotal = 0;
        for (const r of results) {
          if (r.outcome === "ok") {
            succeeded++;
            if (r.variant?.source === "cache-hit") cacheHits++;
            if (r.variant) bytesTotal += r.variant.byteLength;
          } else {
            failed++;
          }
        }

        return {
          results,
          stats: {
            total: refs.length,
            succeeded,
            failed,
            cacheHits,
            bytesTotal,
          },
        };
      });

    return AssetService.of({ fetchOptimal, prefetch });
  }),
).pipe(Layer.provide(MapCacheLive));

// Suppress unused-helper warning (placeholder kept for future extraction)
void buildFetchOptimal;
