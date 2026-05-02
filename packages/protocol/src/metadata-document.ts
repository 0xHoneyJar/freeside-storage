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
 *   - `image` (required, non-empty URL) — primary asset
 *   - `external_url` (optional) — deep-link into the experience layer
 *     (e.g. dimensions `/inspect/{collection}/{N}`)
 *   - `attributes[]` (optional) — trait_type/value pairs for marketplace UI
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
  image: Schema.String.pipe(Schema.minLength(1)),
  external_url: Schema.optional(Schema.String),
  attributes: Schema.optional(Schema.Array(Attribute)),
});

export type MetadataDocument = Schema.Schema.Type<typeof MetadataDocument>;
