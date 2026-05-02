/**
 * @freeside-storage/client — type-safe URL builders + codex consumers for the
 * freeside-storage URL contract.
 *
 * `URL_CONTRACT_V1` (from @freeside-storage/protocol) is the source of truth.
 * Effect Schema validates inputs and outputs at the boundary; typed errors
 * (Data.TaggedError) make failure modes first-class. Builders return URLs
 * resolving to where bytes live TODAY (substrate-truth) — both canonical
 * routes and legacyRoutes are consumed.
 */

export {
  type AssetError,
  MalformedURLError,
  MissingHashError,
  NotFoundError,
  NotGrailError,
  VersionDriftError,
} from "./errors.js";

export {
  Sha40,
  TokenId,
  type ValidatedTokenId,
} from "./schema.js";

export {
  miberaImageURL,
  miberaImageURLByToken,
  miberaMetadataURL,
  mstImageURL,
  mstMetadataURL,
  grailImageURL,
  lookupSovereignManifest,
  type SovereignWorldSlug,
  type SovereignCollectionSlug,
  type SovereignManifestRequest,
} from "./client.js";

export {
  lookupGrail,
  resetGrailCache,
  type GrailEntry,
} from "./codex/grails.js";

export {
  lookupMiberaURL,
  resetMiberaURLCache,
} from "./codex/mibera-urls.js";
