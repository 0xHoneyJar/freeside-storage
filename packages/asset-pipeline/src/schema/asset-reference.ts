/**
 * AssetReference — what a consumer asks for.
 *
 * Per SDD §3.1 (asset-pipeline-substrate cycle B). The canonical URL is the
 * load-bearing identity field; refId / contentType / etag are optional
 * convenience fields for telemetry and conditional fetch.
 *
 * Doctrine: ~/vault/wiki/concepts/asset-pipeline-as-mutable-cdn-substrate.md
 *           §1 (consumer reads canonical, never composes transform DSL).
 */

import { Schema } from "effect";

export const AssetReference = Schema.Struct({
  /** Canonical URL — the contract-stable identity (per metadata-as-integration-contract). */
  canonicalUrl: Schema.String.pipe(Schema.minLength(1)),
  /** Optional opaque ID for telemetry correlation (e.g. `mibera:1234`). */
  refId: Schema.optional(Schema.String),
  /** Optional MIME hint — service may use to skip a HEAD round-trip. */
  contentType: Schema.optional(Schema.String),
  /** Optional ETag for conditional GET (304 short-circuits cache populate). */
  etag: Schema.optional(Schema.String),
}).pipe(Schema.annotations({ identifier: "AssetReference" }));

export type AssetReference = Schema.Schema.Type<typeof AssetReference>;
