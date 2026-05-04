/**
 * AssetService — sealed Effect.Service contract for the asset-pipeline.
 *
 * Per SDD §4.1 (asset-pipeline-substrate cycle B). Two methods:
 *   - fetchOptimal — single ref + constraint → AssetVariant (bytes)
 *   - prefetch    — N refs + constraint → PrefetchResult (partial-failure shape)
 *
 * Cache key: (canonicalUrl, consumerLabel) per ADR-13 rollback discipline.
 */

import { Context, Effect } from "effect";
import type { AssetReference } from "../schema/asset-reference.js";
import type { ConsumerConstraint } from "../schema/consumer-constraint.js";
import type { AssetVariant } from "../schema/asset-variant.js";
import type { AssetError } from "../schema/asset-error.js";

/**
 * Prefetch result — never fails (boot-time grail prefetch logs partial
 * failures + continues). Stats aggregate per the SDD §4.1 shape.
 */
export interface PrefetchResult {
  readonly results: ReadonlyArray<{
    readonly ref: AssetReference;
    readonly outcome: "ok" | "failed";
    readonly variant?: AssetVariant;
    readonly error?: AssetError;
  }>;
  readonly stats: {
    readonly total: number;
    readonly succeeded: number;
    readonly failed: number;
    readonly cacheHits: number;
    readonly bytesTotal: number;
  };
}

export interface PrefetchOptions {
  /** Bounded concurrency. Default 4. */
  readonly concurrency?: number;
  /** Per-ref timeout in ms. Default 10s. */
  readonly timeoutMs?: number;
}

/**
 * AssetService Tag — Context.Tag identity. Effect.gen consumers do
 * `const svc = yield* AssetService`.
 */
export class AssetService extends Context.Tag(
  "@0xhoneyjar/asset-pipeline/AssetService",
)<
  AssetService,
  {
    /** Single-ref fetch — fails on AssetError (caller catchTag for graceful degrade). */
    readonly fetchOptimal: (
      ref: AssetReference,
      constraint: ConsumerConstraint,
    ) => Effect.Effect<AssetVariant, AssetError>;

    /**
     * Bulk prefetch — never fails. Per-ref outcomes in `results[]` array;
     * aggregate stats in `stats`. Boot-time grail prefetch shape.
     */
    readonly prefetch: (
      refs: ReadonlyArray<AssetReference>,
      constraint: ConsumerConstraint,
      opts?: PrefetchOptions,
    ) => Effect.Effect<PrefetchResult, never>;
  }
>() {}
