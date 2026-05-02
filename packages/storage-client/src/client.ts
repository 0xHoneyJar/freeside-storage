/**
 * URL builders for the freeside-storage URL contract.
 *
 * Design rule: URL_CONTRACT_V1 is the source of truth. Sync builders are pure
 * functions that construct URLs deterministically from validated inputs;
 * async builders return `Effect<string, AssetError>` and integrate codex
 * authority + remote metadata reads.
 *
 * Substrate-truth resolution: builders return URLs where bytes live TODAY,
 * including legacyRoute shapes (e.g. `/reveal_phase{N}/images/{hash}.png`)
 * since URL_CONTRACT_V1 marks the canonical `Mibera/final/{tokenId}.png`
 * as gated by the optional mibera-2 polish cycle.
 */

import { Effect, Schema } from "effect";
import {
  MetadataDocument,
  URL_CONTRACT_V1,
} from "@freeside-storage/protocol";

import {
  MalformedURLError,
  MissingHashError,
  NotFoundError,
} from "./errors.js";
import { lookupMiberaURL } from "./codex/mibera-urls.js";

export { grailImageURL } from "./codex/grails.js";

const ASSETS_HOST = `https://${URL_CONTRACT_V1.host}`;

/**
 * Sovereign metadata host. Resolves on-chain `tokenURI(N)` (ERC-721) and
 * `uri(id)` (ERC-1155) for every Mibera-world collection that has flipped
 * to the manifest pattern. Lives behind a CloudFront Function with a KV
 * pointer; the bytes themselves live at `s3://thj-assets/mibera/{collection}/...`.
 */
const METADATA_HOST = "https://metadata.0xhoneyjar.xyz";

/**
 * Sovereign-routing world slugs. Locked to `mibera` as of v1.1.0 — the only
 * world with active sovereign-manifest cutovers. Future worlds extend this
 * union as their first cutover ships.
 *
 * Note: distinct from the assets-host `WorldSlug` (`Mibera`/`Purupuru`/`sprawl`,
 * capitalized) since the sovereignty path convention uses lowercase.
 */
export type SovereignWorldSlug = "mibera";

/**
 * Sovereign-routing collection slugs within a world. Omit from a request to
 * resolve the canon namesake (single-segment `/{world}/{tokenId}`); supply to
 * resolve a sibling collection (two-segment `/{world}/{collection}/{tokenId}`).
 *
 * v1.1.0 known collections (Mibera-world):
 *   - `mst` (Mibera Shadows, ERC-721; shipped Cutover B of MST cycle)
 *   - `tarot` (ERC-721; cycle Sprint 6)
 *   - `gif` (ERC-721; cycle Sprint 7)
 *   - `candies` (ERC-1155; cycle Sprint 8)
 *   - `fractures` (multi-contract array; future cycle)
 */
export type SovereignCollectionSlug =
  | "mst"
  | "tarot"
  | "gif"
  | "candies"
  | "fractures";

/**
 * Request shape for sovereign manifest URL resolution. ERC-721 callers pass
 * `tokenId`; ERC-1155 callers pass the same field (CF Function routes both via
 * the same `/{world}/[{collection}/]{N}` shape — chain-side function name
 * differs, but the off-chain integration contract is identical).
 */
export interface SovereignManifestRequest {
  /** Sovereign-routing world slug (lowercase per A1 amendment) */
  world: SovereignWorldSlug;
  /** Optional collection within the world. Omit for canon namesake. */
  collection?: SovereignCollectionSlug;
  /** ERC-721 tokenId or ERC-1155 id */
  tokenId: number;
}

/**
 * Resolve the sovereign manifest URL for any Mibera-world collection.
 *
 * Mirrors the CF Function routing exactly: collection omitted ⇒ single-segment
 * path (canon namesake); collection present ⇒ two-segment path (sibling).
 * Pure / sync — no fetch, no validation. Use with `fetchSovereignMetadata`
 * for typed-decode + Schema validation at the boundary.
 *
 * @example
 *   lookupSovereignManifest({ world: "mibera", tokenId: 5000 })
 *   // → "https://metadata.0xhoneyjar.xyz/mibera/5000"
 *
 *   lookupSovereignManifest({ world: "mibera", collection: "mst", tokenId: 1 })
 *   // → "https://metadata.0xhoneyjar.xyz/mibera/mst/1"
 */
export function lookupSovereignManifest(
  req: SovereignManifestRequest,
): string {
  if (req.collection) {
    return `${METADATA_HOST}/${req.world}/${req.collection}/${req.tokenId}`;
  }
  return `${METADATA_HOST}/${req.world}/${req.tokenId}`;
}

/**
 * Fetch + decode a sovereign manifest as a typed `MetadataDocument`.
 *
 * Composes `lookupSovereignManifest` + `fetch` + `Schema.decodeUnknown`.
 * Returns the decoded document on success; on failure produces a typed
 * error so callers can `Effect.catchTag` each case:
 *   - `NotFoundError` — fetch errored or response was non-2xx
 *   - `MalformedURLError` — JSON parse failed OR Schema decode rejected
 *     the payload (missing required field, wrong type, empty image, …)
 *
 * Async by necessity (real fetch). For pure URL construction without the
 * network round-trip use `lookupSovereignManifest`.
 */
export const fetchSovereignMetadata = (
  req: SovereignManifestRequest,
): Effect.Effect<MetadataDocument, NotFoundError | MalformedURLError> => {
  const url = lookupSovereignManifest(req);
  const collection = req.collection ?? req.world;

  return Effect.tryPromise({
    try: () => fetch(url),
    catch: () => new NotFoundError({ collection, tokenId: req.tokenId }),
  }).pipe(
    Effect.flatMap(
      (res): Effect.Effect<unknown, NotFoundError | MalformedURLError> =>
        res.ok
          ? Effect.tryPromise({
              try: () => res.json() as Promise<unknown>,
              catch: () =>
                new MalformedURLError({
                  raw: url,
                  reason: "json-parse-failed",
                }),
            })
          : Effect.fail(
              new NotFoundError({ collection, tokenId: req.tokenId }),
            ),
    ),
    Effect.flatMap((json) =>
      Schema.decodeUnknown(MetadataDocument)(json).pipe(
        Effect.mapError(
          (cause) =>
            new MalformedURLError({
              raw: url,
              reason: `schema-decode-failed: ${String(cause)}`,
            }),
        ),
      ),
    ),
  );
};

/**
 * Honeyroad app host. Serves MST metadata + dynamic fracture-image lookups.
 * Eventually migrates to Freeside ECS.
 */
const HONEYROAD_HOST = "https://honeyroad.xyz";

/**
 * Mibera-canon image URL by content hash.
 *
 * Substrate-truth resolution: returns the legacyRoute shape
 * (`/reveal_phase{N}/images/{hash}.png`) since that's where bytes live today
 * per URL_CONTRACT_V1 legacyRoutes. Defaults to phase 8 (canonical/latest
 * reveal rendering per Gumi 2026-04-29).
 *
 * Pure / sync — no fetch. Caller resolves tokenId → hash via codex
 * (see `~/Documents/GitHub/construct-mibera-codex/_codex/data/mibera-image-urls.json`).
 */
export function miberaImageURL(
  hash: string,
  opts: { phase?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 } = {},
): string {
  const phase = opts.phase ?? 8;
  return `${ASSETS_HOST}/reveal_phase${phase}/images/${hash}.png`;
}

/**
 * Mibera-canon image URL by tokenId — async, codex authority.
 *
 * Reads `mibera-image-urls.json` from construct-mibera-codex; the codex
 * publishes the FULL URL per tokenId (handles canon hashes + grail slugs
 * + heterogeneous extensions like `.PNG`/`.png` + slugs with spaces). This
 * is the recommended lookup path for tokenId-based resolution.
 */
export const miberaImageURLByToken = (
  tokenId: number,
): Effect.Effect<string, NotFoundError> => lookupMiberaURL(tokenId);

/**
 * Mibera-canon metadata URL. All 10000 tokens resolve via the sovereign
 * manifest pattern (CF Function + KV pointer) provisioned in Cutover C.
 */
export function miberaMetadataURL(tokenId: number): string {
  return `${METADATA_HOST}/mibera/${tokenId}`;
}

/**
 * Mibera Shadows (MST) metadata URL. All MST tokens resolve via the sovereign
 * manifest pattern (CF Function + KV pointer) under the world-scoped path
 * `/{world}/{collection}/{N}` provisioned in Cutover B of the
 * migrate-mst-sovereignty cycle (2026-05-01).
 */
export function mstMetadataURL(tokenId: number): string {
  return `${METADATA_HOST}/mibera/mst/${tokenId}`;
}

/**
 * Mibera Shadows (MST) image URL. Async because the metadata's `image` field
 * is the canonical answer (handles timestamp-suffix variants for re-generated
 * tokens — see issue loa-freeside#197 for the substrate-truth diagnosis).
 */
export const mstImageURL = (
  tokenId: number,
): Effect.Effect<string, NotFoundError | MissingHashError> =>
  Effect.tryPromise({
    try: () => fetch(mstMetadataURL(tokenId)),
    catch: () => new NotFoundError({ collection: "mst", tokenId }),
  }).pipe(
    Effect.flatMap((res) =>
      res.ok
        ? Effect.tryPromise({
            try: () => res.json() as Promise<{ image?: string }>,
            catch: () => new NotFoundError({ collection: "mst", tokenId }),
          })
        : Effect.fail(new NotFoundError({ collection: "mst", tokenId })),
    ),
    Effect.flatMap((json) =>
      json.image
        ? Effect.succeed(json.image)
        : Effect.fail(
            new MissingHashError({
              tokenId,
              source: "mstMetadata.image",
            }),
          ),
    ),
  );

