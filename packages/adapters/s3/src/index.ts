/**
 * @freeside-storage/adapters-s3 — S3 implementation of StorageAdapter.
 *
 * Per ADR-001 this is the only adapter that ships in lean instance-1.
 */

export { S3Adapter, type S3AdapterConfig } from './S3Adapter.js';
export {
  assumeRoleAdapter,
  type AssumeRoleAdapterOptions,
} from './crossAccount.js';
