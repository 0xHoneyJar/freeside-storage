/**
 * Schema layer re-exports — sealed Effect Schema types for the
 * asset-pipeline substrate.
 *
 * Per SDD §3 (asset-pipeline-substrate cycle B):
 *   - AssetReference       — what a consumer asks for                  (§3.1)
 *   - ConsumerConstraint   — environment ceiling + format preference   (§3.2)
 *   - AssetVariant         — what the service returns                  (§3.3)
 *   - AssetError taxonomy  — sealed 7-variant Data.TaggedError union   (§3.4 / O1)
 */

export {
  AssetReference,
  type AssetReference as AssetReferenceType,
} from "./asset-reference.js";

export {
  ImageFormat,
  type ImageFormat as ImageFormatType,
  ConsumerLabel,
  type ConsumerLabel as ConsumerLabelType,
  ConsumerConstraint,
  type ConsumerConstraint as ConsumerConstraintType,
} from "./consumer-constraint.js";

export {
  AssetSource,
  type AssetSource as AssetSourceType,
  AssetVariant,
  type AssetVariant as AssetVariantType,
} from "./asset-variant.js";

export {
  NetworkError,
  TransformError,
  BudgetExceeded,
  UnsupportedFormat,
  PathDenied,
  MetadataParseError,
  CacheError,
  type AssetError,
} from "./asset-error.js";
