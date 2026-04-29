/**
 * Common storage primitives consumed by every adapter and every consumer
 * (the-orchard's tending-storage, construct-freeside's mirroring-storage).
 *
 * Per SDD §3.1.
 */

/**
 * A storage key is a tenant + path within that tenant. Tenants map to top-level
 * S3 prefixes (e.g. "Mibera", "Purupuru", "sprawl"). Paths are tenant-relative.
 *
 * Example: { tenant: "Mibera", path: "generated/0.webp" } resolves to the S3
 * object `s3://thj-assets/Mibera/generated/0.webp` under the legacy and new
 * distributions both per SDD §0.4 image plane.
 */
export interface StorageKey {
  /** Tenant prefix (top-level S3 key segment) */
  tenant: string;
  /** Path within the tenant (no leading slash) */
  path: string;
}

/**
 * Bytes + metadata at rest. Returned by `get`; passed to `put`.
 */
export interface StorageObject {
  key: StorageKey;
  contentType: string;
  bytes: Buffer;
  etag: string;
  lastModified: Date;
}

/**
 * Result of a sync operation. Discriminated by `variant` so callers must
 * exhaustive-switch on partial outcomes (per SDD §3.2 error model).
 */
export type SyncResult =
  | {
      variant: 'success';
      keysSynced: number;
      keysSkipped: number;
      durationMs: number;
    }
  | {
      variant: 'partial';
      keysSynced: number;
      keysSkipped: number;
      keysFailed: number;
      failedKeys: StorageKey[];
      durationMs: number;
      reason: string;
    };

/**
 * Result of a parity check. Discriminated by `variant`. `drift` and `missing`
 * are arrays of structured findings — never a boolean — so callers can produce
 * actionable runbook output.
 */
export type ParityReport =
  | {
      variant: 'identical';
      sampledKeys: number;
      identical: number;
    }
  | {
      variant: 'drift';
      sampledKeys: number;
      identical: number;
      drifted: ParityDrift[];
    }
  | {
      variant: 'missing';
      sampledKeys: number;
      identical: number;
      missing: ParityMissing[];
    };

export interface ParityDrift {
  key: StorageKey;
  sourceEtag: string;
  targetEtag: string;
}

export interface ParityMissing {
  key: StorageKey;
  missingFrom: 'source' | 'target';
}

/**
 * Pagination + filter options for `list`.
 */
export interface ListOptions {
  /** Only include keys modified at-or-after this timestamp (incremental) */
  since?: Date;
  /** Page size; adapter may impose its own ceiling */
  limit?: number;
  /** Continuation token from a prior page */
  continuationToken?: string;
}

export interface ListResult {
  keys: StorageKey[];
  /** If present, pass to a follow-up `list` call to fetch the next page */
  nextContinuationToken?: string;
}

/**
 * Options for `sync`.
 */
export interface SyncOptions {
  /** Restrict to specific tenant prefixes (default: every tenant the source exposes) */
  tenants?: string[];
  /** Only sync keys modified at-or-after this timestamp (incremental) */
  since?: Date;
  /** Stop after this many keys synced (test/dry-run aid) */
  limit?: number;
  /** If true, do not write — just compute the plan */
  dryRun?: boolean;
}

/**
 * Options for `verifyParity`. `samplePerTenant` is the smoke-canary knob;
 * cycle-1 default is 10 per SDD §10.3.
 */
export interface VerifyParityOptions {
  samplePerTenant: number;
  /** Restrict to specific tenant prefixes */
  tenants?: string[];
}
