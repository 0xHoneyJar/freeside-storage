/**
 * MetadataDocument — sealed Effect Schema for the sovereign manifest payload.
 *
 * Every Mibera-world NFT collection on the manifest pattern (canon Mibera,
 * MST, Tarot, GIF, Candies, Fractures, …) serves a JSON document of this
 * shape from `metadata.0xhoneyjar.xyz/{world}/[{collection}/]{N}`. The Schema
 * is the off-chain integration contract — consumers (dimensions, honeyroad,
 * external indexers, future agents) decode against it at the boundary so
 * malformed payloads surface with a typed error rather than three layers
 * deep in a render tree.
 *
 * Per ERC-721 metadata standard + OpenSea convention:
 *   - `name` (required) — display name
 *   - `description` (required) — flavor text
 *   - `image` (required) — primary asset (flat URL OR struct per v1.3.0)
 *   - `external_url` (optional) — deep-link into the experience layer
 *     (e.g. dimensions `/inspect/{collection}/{N}`)
 *   - `attributes[]` (optional) — trait_type/value pairs for marketplace UI
 *   - `animation_url` (optional, v1.3.0+) — secondary asset (FR-8 v2 forward-compat)
 *
 * v1.3.0 (asset-pipeline-substrate-2026-05-03) extends `image` to a union
 * of flat-string OR struct shape (`MetadataImage`). Flat-string consumers
 * keep working unchanged; new consumers READ pre-built variants and
 * transform DSL from the struct shape via `parseImage` (./parse-image.ts).
 */

import { Schema } from "effect";

/**
 * A single trait_type/value pair. Marketplaces (OpenSea, Magic Eden, etc.)
 * render attributes as a filterable trait grid; values are typically string,
 * but numeric values (e.g. rarity score, level) are widely supported.
 */
export const Attribute = Schema.Struct({
  trait_type: Schema.String,
  value: Schema.Union(Schema.String, Schema.Number),
});

export type Attribute = Schema.Schema.Type<typeof Attribute>;

/**
 * Image capabilities the variant set advertises. Consumers MAY use this to
 * skip a HEAD round-trip when picking variants. v1.3.0 ships the locked
 * stills set; future additive bumps may extend (e.g. 'crop', 'rotate').
 */
export const ImageCapability = Schema.Literal(
  "webp",
  "png",
  "avif",
  "resize",
  "crop",
);
export type ImageCapability = Schema.Schema.Type<typeof ImageCapability>;

/**
 * Struct shape for the `image` field — declared variants + transform DSL hint.
 *
 * - `canonical` — load-bearing identity (per metadata-as-integration-contract).
 * - `variants` — pre-built {label → URL} map. Consumer reads these directly.
 * - `transform` — optional URL-DSL endpoint hint (e.g. `_optimize?path=...`).
 *   Consumer composes `?w=&fmt=&q=` against this only if it falls back from
 *   the variant set.
 * - `capabilities` — capability hints; advisory.
 */
export const MetadataImageStruct = Schema.Struct({
  canonical: Schema.String.pipe(Schema.minLength(1)),
  variants: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
  transform: Schema.optional(Schema.String),
  capabilities: Schema.optional(Schema.Array(ImageCapability)),
});

export type MetadataImageStruct = Schema.Schema.Type<typeof MetadataImageStruct>;

/**
 * `image` field union — flat URL (legacy / v1.2-and-earlier consumers)
 * OR struct shape (v1.3+ consumers). The Union is decoded at the boundary;
 * `parseImage` (./parse-image.ts) normalizes both shapes to struct.
 */
export const MetadataImage = Schema.Union(
  Schema.String.pipe(Schema.minLength(1)),
  MetadataImageStruct,
);

export type MetadataImage = Schema.Schema.Type<typeof MetadataImage>;

/**
 * Sovereign manifest document. Decoded shape consumers can rely on.
 *
 * Note: schema is intentionally permissive on `image` URL host — the manifest
 * pattern decouples metadata host from image host (image bytes may live on
 * `assets.0xhoneyjar.xyz`, IPFS, Irys, or elsewhere). Validation that the
 * image URL points where you expect is a consumer-side concern.
 */
export const MetadataDocument = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  image: MetadataImage,
  external_url: Schema.optional(Schema.String),
  attributes: Schema.optional(Schema.Array(Attribute)),
  /** v1.3.0+ optional sibling (FR-8 v2 forward-compat — animated/video pointer). */
  animation_url: Schema.optional(Schema.String),
});

export type MetadataDocument = Schema.Schema.Type<typeof MetadataDocument>;
