/**
 * @0xhoneyjar/freeside-protocol — sealed schemas for freeside-storage.
 *
 * Per ADR-001, this package exports:
 *   - The `StorageAdapter` common interface (§3.1)
 *   - Storage primitives (StorageKey, StorageObject, SyncResult, ParityReport, ...)
 *   - URL Contract — Tier 1 schema-bridge (§0.3 contracts-as-bridges instance-N)
 *
 * The URL Contract JSON Schema lives at `packages/protocol/url-contract.schema.json`
 * (sibling to this `src/` tree). Consumers may import the TS interface for
 * compile-time validation OR fetch the JSON Schema by `$id` and ajv-validate.
 */

export type {
  ListOptions,
  ListResult,
  ParityDrift,
  ParityMissing,
  ParityReport,
  StorageKey,
  StorageObject,
  SyncOptions,
  SyncResult,
  VerifyParityOptions,
} from './types.js';

export type { StorageAdapter } from './StorageAdapter.js';

export {
  URL_CONTRACT_VERSION,
  URL_CONTRACT_V1,
  METADATA_HOST,
  isCanonicalPath,
  type AssetsHost,
  type CanonicalRoute,
  type CategoryByWorld,
  type LegacyRoute,
  type MetadataHost,
  type MiberaSubCollection,
  type MigrationPhase,
  type MigrationPhaseId,
  type RouteBacking,
  type URLContract,
  type WorldContract,
  type WorldSlug,
} from './url-contract.js';

export {
  Attribute,
  MetadataDocument,
  MetadataImage,
  MetadataImageStruct,
  ImageCapability,
} from './metadata-document.js';

export {
  parseImage,
  decodeAndParseImage,
  type ParsedImage,
} from './parse-image.js';
