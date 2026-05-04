/**
 * parseImage — normalize MetadataImage union to struct shape.
 *
 * Per SDD §10.3 (asset-pipeline-substrate cycle B · Risk 5 mitigation).
 *
 * URL_CONTRACT v1.3.0 extends `MetadataDocument.image` from a flat URL
 * string to a union of flat-string | struct. Existing consumers that read
 * `meta.image` as `<img src={meta.image} />` MUST keep working unchanged.
 * Internal code uses `parseImage` to normalize → struct, gaining variants/
 * transform/capabilities when the new shape is present.
 *
 * Plain function (not Schema instance) per SDD §8.1 / Risk 6 — keeps
 * Effect peerDep range broad (consumers don't have to import Schema).
 */

import { Effect, Schema, type ParseResult } from "effect";
import {
  MetadataImage,
  MetadataImageStruct,
} from "./metadata-document.js";

/**
 * Struct-shape view of `MetadataImage`. Always has `canonical`; `variants`
 * / `transform` / `capabilities` are optional (absent for legacy flat-URL).
 */
export type ParsedImage = Schema.Schema.Type<typeof MetadataImageStruct>;

/**
 * Normalize MetadataImage union → struct shape.
 *
 * Flat-string consumers keep working — internal code uses parseImage
 * everywhere. Risk 5 mitigation: external code using `metadata.image` as
 * a flat string (`<img src={meta.image} />`) keeps working unchanged.
 *
 * Pure synchronous function — no Effect, no decode. If the input was already
 * decoded via `Schema.decodeUnknown(MetadataImage)`, it's safe to call.
 *
 * @example
 *   parseImage("https://x/a.png")
 *   // → { canonical: "https://x/a.png" }
 *
 *   parseImage({ canonical: "a.png", variants: { webp: "a.webp" } })
 *   // → { canonical: "a.png", variants: { webp: "a.webp" } }
 */
export const parseImage = (image: MetadataImage): ParsedImage => {
  if (typeof image === "string") {
    return { canonical: image };
  }
  return image;
};

/**
 * Effect-flavored variant — decode unknown JSON safely + parse.
 *
 * Use at the network boundary when the payload shape isn't yet trusted.
 * Returns `Effect<ParsedImage, ParseError>` so callers compose with the
 * rest of their Effect pipeline.
 */
export const decodeAndParseImage = (
  raw: unknown,
): Effect.Effect<ParsedImage, ParseResult.ParseError, never> =>
  Schema.decodeUnknown(MetadataImage)(raw).pipe(Effect.map(parseImage));
