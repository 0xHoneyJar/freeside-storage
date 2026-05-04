/**
 * AssetServiceTest — in-memory deterministic Test layer for the
 * asset-pipeline.
 *
 * Per SDD §4.3 (asset-pipeline-substrate cycle B). Used by all consumer
 * repos (freeside-characters · mibera-dimensions) instead of mocking HTTP.
 *
 * Caller provides `Map<canonicalUrl, AssetVariant>` fixtures. fetchOptimal
 * resolves from the map (treats hit as `cache-hit` source); prefetch maps
 * deterministically with the same fixture lookup.
 */

import { Effect, Layer } from "effect";
import { AssetService, type PrefetchResult } from "./AssetService.js";
import {
  type AssetError,
  type AssetReference,
  type AssetVariant,
  type ConsumerConstraint,
  NetworkError,
} from "../schema/index.js";

/**
 * Build an AssetServiceTest layer from a fixture map.
 *
 * @example
 *   const fixtures = new Map<string, AssetVariant>();
 *   fixtures.set("https://x/a.png", { bytes, format: "webp", ... });
 *   const layer = makeAssetServiceTest(fixtures);
 *   const program = Effect.gen(function* () {
 *     const svc = yield* AssetService;
 *     return yield* svc.fetchOptimal({ canonicalUrl: "https://x/a.png" }, c);
 *   });
 *   await Effect.runPromise(program.pipe(Effect.provide(layer)));
 */
export const makeAssetServiceTest = (
  fixtures: ReadonlyMap<string, AssetVariant>,
): Layer.Layer<AssetService> =>
  Layer.succeed(
    AssetService,
    AssetService.of({
      fetchOptimal: (
        ref: AssetReference,
        _constraint: ConsumerConstraint,
      ): Effect.Effect<AssetVariant, AssetError> => {
        const fixture = fixtures.get(ref.canonicalUrl);
        if (fixture) {
          return Effect.succeed(fixture);
        }
        return Effect.fail(
          new NetworkError({
            url: ref.canonicalUrl,
            status: 404,
            cause: "fixture miss",
          }),
        );
      },

      prefetch: (
        refs: ReadonlyArray<AssetReference>,
        _constraint: ConsumerConstraint,
      ): Effect.Effect<PrefetchResult, never> => {
        const results = refs.map((ref) => {
          const fixture = fixtures.get(ref.canonicalUrl);
          return fixture
            ? {
                ref,
                outcome: "ok" as const,
                variant: fixture,
              }
            : {
                ref,
                outcome: "failed" as const,
                error: new NetworkError({
                  url: ref.canonicalUrl,
                  status: 404,
                  cause: "fixture miss",
                }) as AssetError,
              };
        });

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

        return Effect.succeed({
          results,
          stats: {
            total: refs.length,
            succeeded,
            failed,
            cacheHits,
            bytesTotal,
          },
        });
      },
    }),
  );
