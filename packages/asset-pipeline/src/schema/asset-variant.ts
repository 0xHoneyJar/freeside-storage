/**
 * AssetVariant — what the service returns.
 *
 * Per SDD §3.3 (asset-pipeline-substrate cycle B). The variant carries
 * bytes-on-the-wire (per environment-aware-composition doctrine) plus
 * format/size + provenance (`source` discriminator) + cache key for
 * downstream tracing.
 *
 * Doctrine: ~/vault/wiki/concepts/environment-aware-composition.md
 *           (cycle A V0.7-A.3 ship — bytes via webhook attach, NOT URL).
 */

import { Schema } from "effect";
import { ImageFormat } from "./consumer-constraint.js";

/**
 * Provenance tag — where did these bytes come from?
 *
 * - `cache-hit`                       — in-memory map cache hit
 * - `cdn-mirror`                      — CloudFront → pre-baked variant in S3
 * - `cdn-original-then-transform`     — CloudFront → Lambda /_optimize → S3 put + return
 * - `live-fetch`                      — direct fetch (no cache, no CDN — dev/test only)
 */
export const AssetSource = Schema.Literal(
  "cache-hit",
  "cdn-mirror",
  "cdn-original-then-transform",
  "live-fetch",
);
export type AssetSource = Schema.Schema.Type<typeof AssetSource>;

/**
 * Materialized asset variant. Bytes-on-the-wire + provenance + cache key.
 *
 * `cacheKey` is the `(canonicalUrl, consumerLabel)` digest — enables
 * downstream code to invalidate or trace a specific cache entry without
 * recomputing the digest formula.
 */
export const AssetVariant = Schema.Struct({
  /** Variant bytes ready to upload/attach/render. */
  bytes: Schema.Uint8ArrayFromSelf,
  /** Realized format — may differ from caller's `acceptFormats[0]` per negotiation. */
  format: ImageFormat,
  /** Bytes count (redundant with bytes.byteLength but cached for log lines). */
  byteLength: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  /** Optional realized width — service-determined. */
  width: Schema.optional(Schema.Number),
  /** Provenance tag — see AssetSource. */
  source: AssetSource,
  /** Date.now() at materialization. */
  fetchedAt: Schema.Number,
  /** `(canonicalUrl, consumerLabel)` digest. */
  cacheKey: Schema.String,
}).pipe(Schema.annotations({ identifier: "AssetVariant" }));

export type AssetVariant = Schema.Schema.Type<typeof AssetVariant>;
