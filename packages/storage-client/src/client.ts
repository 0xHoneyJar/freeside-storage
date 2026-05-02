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

import { Effect } from "effect";
import { URL_CONTRACT_V1 } from "@freeside-storage/protocol";

import { MissingHashError, NotFoundError } from "./errors.js";
import { lookupMiberaURL } from "./codex/mibera-urls.js";

export { grailImageURL } from "./codex/grails.js";

const ASSETS_HOST = `https://${URL_CONTRACT_V1.host}`;

/**
 * Sovereign metadata host. Resolves on-chain `tokenURI(N)` for Mibera-canon.
 * Provisioned by Cutover C of the migrate-mibera-sovereignty cycle.
 */
const METADATA_HOST = "https://metadata.0xhoneyjar.xyz";

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

