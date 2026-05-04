/**
 * Service layer re-exports — AssetService Tag + Live + Test layers.
 *
 * Per SDD §4 (asset-pipeline-substrate cycle B).
 */

export {
  AssetService,
  type PrefetchResult,
  type PrefetchOptions,
} from "./AssetService.js";

export { AssetServiceLive } from "./live.js";

export { makeAssetServiceTest } from "./test.js";
