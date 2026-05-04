/**
 * AssetError — sealed taxonomy of failure modes.
 *
 * Per SDD §3.4 (asset-pipeline-substrate cycle B · resolves O1). Effect
 * tagged-error union — each variant is `Data.TaggedError` for narrow
 * `Effect.catchTag` consumer ergonomics. ADR-11 LOCKED.
 *
 * Variants (7):
 *   - NetworkError         — fetch/HEAD failed (timeout, DNS, 5xx, etc)
 *   - TransformError       — sharp/Lambda transform failed (corrupt input, OOM)
 *   - BudgetExceeded       — bytes > maxBytes after best-effort negotiation
 *   - UnsupportedFormat    — acceptFormats has no overlap with server capabilities
 *   - PathDenied           — canonical path not in allowlist (NFR-3 SSRF)
 *   - MetadataParseError   — Schema.decodeUnknown(MetadataImage) failed
 *   - CacheError           — map cache get/put/evict failed
 */

import { Data } from "effect";

export class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly url: string;
  readonly status?: number;
  readonly cause: unknown;
}> {}

export class TransformError extends Data.TaggedError("TransformError")<{
  readonly url: string;
  readonly fromFormat: string;
  readonly toFormat: string;
  readonly cause: unknown;
}> {}

/**
 * BudgetExceeded carries `triedFormats` so callers can degrade gracefully.
 * Example: bot retries with `acceptFormats: ['png']` if webp not produced
 * under budget.
 */
export class BudgetExceeded extends Data.TaggedError("BudgetExceeded")<{
  readonly url: string;
  readonly actualBytes: number;
  readonly budgetBytes: number;
  readonly triedFormats: ReadonlyArray<string>;
}> {}

export class UnsupportedFormat extends Data.TaggedError("UnsupportedFormat")<{
  readonly format: string;
  readonly supportedFormats: ReadonlyArray<string>;
}> {}

export class PathDenied extends Data.TaggedError("PathDenied")<{
  readonly path: string;
  readonly reason: "not-in-allowlist" | "invalid-shape";
}> {}

export class MetadataParseError extends Data.TaggedError("MetadataParseError")<{
  readonly url: string;
  readonly cause: unknown;
}> {}

export class CacheError extends Data.TaggedError("CacheError")<{
  readonly cacheKey: string;
  readonly operation: "get" | "put" | "evict";
  readonly cause: unknown;
}> {}

/**
 * Aggregated AssetError union — what AssetService.fetchOptimal can fail with.
 */
export type AssetError =
  | NetworkError
  | TransformError
  | BudgetExceeded
  | UnsupportedFormat
  | PathDenied
  | MetadataParseError
  | CacheError;
