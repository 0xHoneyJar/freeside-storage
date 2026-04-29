/**
 * The common storage interface consumed by every adapter and every construct.
 *
 * Per SDD §3.1 + §6.3, this surface is what enables `the-orchard`'s
 * `tending-storage` and `construct-freeside`'s `mirroring-storage` to share
 * adapter implementations without a construct-to-construct dependency.
 *
 * Per-adapter narrow extensions (e.g., `S3Adapter.presignedURL`) are escape
 * hatches and are NOT part of the common contract. Constructs that depend on
 * extensions cite them explicitly.
 */
import type {
  ListOptions,
  ListResult,
  ParityReport,
  StorageKey,
  StorageObject,
  SyncOptions,
  SyncResult,
  VerifyParityOptions,
} from './types.js';

export interface StorageAdapter {
  /**
   * Upload bytes to a key. Idempotent: putting the same bytes at the same key
   * is a no-op (etag preserved by S3 semantics; HEAD-then-PUT skipped by the
   * adapter when bytes match).
   */
  put(obj: StorageObject): Promise<void>;

  /**
   * Download bytes from a key. Throws if the key does not exist.
   */
  get(key: StorageKey): Promise<StorageObject>;

  /**
   * List keys under a tenant prefix. Pagination is required for large prefixes
   * (each adapter's underlying API has a page ceiling — S3 ListObjectsV2 caps
   * at 1000). Callers iterate via `nextContinuationToken`.
   */
  list(tenant: string, opts?: ListOptions): Promise<ListResult>;

  /**
   * Sync keys from another adapter into this one. Idempotent across re-runs:
   * keys with matching etags are skipped. Resumable: failure mid-run leaves a
   * partial-success state with `failedKeys` enumerated; the caller may rerun
   * with the same options.
   *
   * Returns a discriminated SyncResult; callers MUST exhaustive-switch.
   */
  sync(source: StorageAdapter, opts?: SyncOptions): Promise<SyncResult>;

  /**
   * Verify parity between this adapter and another by sampling N keys per
   * tenant. The result is structured (drifted keys + missing keys), not
   * boolean — callers feed the structure into runbook output for the
   * operator-gate (per SDD §10.3 + KRANZ Act 3).
   */
  verifyParity(
    source: StorageAdapter,
    opts: VerifyParityOptions,
  ): Promise<ParityReport>;
}
