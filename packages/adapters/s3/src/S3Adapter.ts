/**
 * S3 implementation of `@freeside-storage/protocol`'s StorageAdapter, plus
 * S3-specific extensions (`presignedURL`, `setACL`, `invalidateCDN`).
 *
 * Per SDD §3.1 + §6.5. Per ADR-001 this is the only adapter that ships in
 * lean instance-1.
 */
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import {
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectAclCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  ListOptions,
  ListResult,
  ParityDrift,
  ParityMissing,
  ParityReport,
  StorageAdapter,
  StorageKey,
  StorageObject,
  SyncOptions,
  SyncResult,
  VerifyParityOptions,
} from '@freeside-storage/protocol';

export interface S3AdapterConfig {
  /** Bucket name (e.g. "thj-assets") */
  bucket: string;
  /** AWS region (e.g. "us-west-2") */
  region: string;
  /** Optional credentials override; default uses AWS SDK credential chain */
  credentials?: S3ClientConfig['credentials'];
  /** Optional CloudFront client override (for `invalidateCDN`) */
  cloudFrontClient?: CloudFrontClient;
}

/**
 * Build a `StorageKey` from a flat S3 key (`"Mibera/generated/0.webp"`) by
 * splitting on the first `/`. The first segment is the tenant; the rest is
 * the path. Keys without a `/` are treated as tenant-only.
 */
function fromS3Key(s3Key: string): StorageKey {
  const slash = s3Key.indexOf('/');
  if (slash === -1) {
    return { tenant: s3Key, path: '' };
  }
  return {
    tenant: s3Key.slice(0, slash),
    path: s3Key.slice(slash + 1),
  };
}

/**
 * Build a flat S3 key from a `StorageKey`. Inverse of `fromS3Key`.
 */
function toS3Key(key: StorageKey): string {
  return key.path ? `${key.tenant}/${key.path}` : key.tenant;
}

/**
 * Read a Node.js readable stream into a `Buffer`. Used for `get` since the
 * AWS SDK v3 returns a stream, not bytes.
 */
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export class S3Adapter implements StorageAdapter {
  readonly bucket: string;
  readonly region: string;
  private readonly s3: S3Client;
  private readonly cloudFront: CloudFrontClient;

  constructor(config: S3AdapterConfig) {
    this.bucket = config.bucket;
    this.region = config.region;
    this.s3 = new S3Client({
      region: config.region,
      credentials: config.credentials,
    });
    this.cloudFront =
      config.cloudFrontClient ??
      new CloudFrontClient({
        // CloudFront is a global service but the SDK still needs a region.
        region: config.region,
        credentials: config.credentials,
      });
  }

  // ---------------------------------------------------------------------------
  // Common StorageAdapter surface
  // ---------------------------------------------------------------------------

  async put(obj: StorageObject): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: toS3Key(obj.key),
        Body: obj.bytes,
        ContentType: obj.contentType,
      }),
    );
  }

  async get(key: StorageKey): Promise<StorageObject> {
    const s3Key = toS3Key(key);
    const result = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
      }),
    );

    if (!result.Body) {
      throw new Error(`S3 GetObject returned no body for ${this.bucket}/${s3Key}`);
    }

    const bytes = await streamToBuffer(result.Body as NodeJS.ReadableStream);

    return {
      key,
      contentType: result.ContentType ?? 'application/octet-stream',
      bytes,
      etag: result.ETag?.replace(/^"|"$/g, '') ?? '',
      lastModified: result.LastModified ?? new Date(),
    };
  }

  async list(tenant: string, opts: ListOptions = {}): Promise<ListResult> {
    const result = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `${tenant}/`,
        MaxKeys: opts.limit,
        ContinuationToken: opts.continuationToken,
      }),
    );

    const since = opts.since;
    const keys: StorageKey[] = (result.Contents ?? [])
      .filter((entry) => {
        if (!entry.Key) return false;
        if (!since) return true;
        return entry.LastModified ? entry.LastModified >= since : true;
      })
      .map((entry) => fromS3Key(entry.Key as string));

    const next: ListResult = { keys };
    if (result.NextContinuationToken) {
      next.nextContinuationToken = result.NextContinuationToken;
    }
    return next;
  }

  async sync(source: StorageAdapter, opts: SyncOptions = {}): Promise<SyncResult> {
    const start = Date.now();

    // Determine tenants to sync. If the source advertises tenants, we'd ask;
    // the common surface doesn't expose tenant enumeration, so callers must
    // pass `tenants` explicitly OR the adapter falls back to a documented
    // default (cycle-1 default: ['Mibera', 'Purupuru', 'sprawl']).
    const tenants = opts.tenants ?? ['Mibera', 'Purupuru', 'sprawl'];

    let synced = 0;
    let skipped = 0;
    const failed: StorageKey[] = [];
    let firstFailure: string | undefined;

    for (const tenant of tenants) {
      let token: string | undefined;
      do {
        const sourceList: ListResult = await source.list(tenant, {
          since: opts.since,
          continuationToken: token,
          limit: opts.limit,
        });

        for (const key of sourceList.keys) {
          if (opts.limit !== undefined && synced + skipped >= opts.limit) {
            return {
              variant: 'success',
              keysSynced: synced,
              keysSkipped: skipped,
              durationMs: Date.now() - start,
            };
          }

          try {
            const head = await this.tryHead(key);
            const sourceObj = await source.get(key);

            // Same-bucket short-circuit. If the source IS this adapter (same
            // bucket + same region), there's nothing to copy.
            if (head?.etag && head.etag === sourceObj.etag) {
              skipped += 1;
              continue;
            }

            if (opts.dryRun) {
              skipped += 1;
              continue;
            }

            await this.put(sourceObj);
            synced += 1;
          } catch (err) {
            failed.push(key);
            firstFailure ??= err instanceof Error ? err.message : String(err);
          }
        }

        token = sourceList.nextContinuationToken;
      } while (token);
    }

    if (failed.length > 0) {
      return {
        variant: 'partial',
        keysSynced: synced,
        keysSkipped: skipped,
        keysFailed: failed.length,
        failedKeys: failed,
        durationMs: Date.now() - start,
        reason: firstFailure ?? 'unknown',
      };
    }

    return {
      variant: 'success',
      keysSynced: synced,
      keysSkipped: skipped,
      durationMs: Date.now() - start,
    };
  }

  async verifyParity(
    source: StorageAdapter,
    opts: VerifyParityOptions,
  ): Promise<ParityReport> {
    const tenants = opts.tenants ?? ['Mibera', 'Purupuru', 'sprawl'];

    let sampled = 0;
    let identical = 0;
    const drifted: ParityDrift[] = [];
    const missing: ParityMissing[] = [];

    for (const tenant of tenants) {
      // Take the first N keys from the source as the sample. Random sampling
      // would be more rigorous; deferred to a future cycle (acceptable per
      // SDD §10.3 — first N covers the head of the prefix where most reads
      // concentrate).
      const sourceList = await source.list(tenant, { limit: opts.samplePerTenant });

      for (const key of sourceList.keys) {
        sampled += 1;

        const sourceHead = await this.headOnAdapter(source, key);
        const targetHead = await this.tryHead(key);

        if (!sourceHead) {
          missing.push({ key, missingFrom: 'source' });
          continue;
        }
        if (!targetHead) {
          missing.push({ key, missingFrom: 'target' });
          continue;
        }
        if (sourceHead.etag !== targetHead.etag) {
          drifted.push({
            key,
            sourceEtag: sourceHead.etag,
            targetEtag: targetHead.etag,
          });
          continue;
        }
        identical += 1;
      }
    }

    if (missing.length > 0) {
      return { variant: 'missing', sampledKeys: sampled, identical, missing };
    }
    if (drifted.length > 0) {
      return { variant: 'drift', sampledKeys: sampled, identical, drifted };
    }
    return { variant: 'identical', sampledKeys: sampled, identical };
  }

  // ---------------------------------------------------------------------------
  // S3-specific extensions (NOT part of StorageAdapter)
  // ---------------------------------------------------------------------------

  async presignedURL(key: StorageKey, expiresSeconds: number): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: toS3Key(key),
      }),
      { expiresIn: expiresSeconds },
    );
  }

  async setACL(key: StorageKey, acl: 'private' | 'public-read'): Promise<void> {
    await this.s3.send(
      new PutObjectAclCommand({
        Bucket: this.bucket,
        Key: toS3Key(key),
        ACL: acl,
      }),
    );
  }

  async invalidateCDN(distributionId: string, paths: string[]): Promise<void> {
    await this.cloudFront.send(
      new CreateInvalidationCommand({
        DistributionId: distributionId,
        InvalidationBatch: {
          CallerReference: `freeside-storage-${Date.now()}`,
          Paths: {
            Quantity: paths.length,
            Items: paths,
          },
        },
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * HEAD against this adapter's bucket. Returns null if the object does not
   * exist (404 / NotFound). Other errors propagate.
   */
  private async tryHead(
    key: StorageKey,
  ): Promise<{ etag: string; lastModified: Date } | null> {
    try {
      const result = await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: toS3Key(key),
        }),
      );
      return {
        etag: result.ETag?.replace(/^"|"$/g, '') ?? '',
        lastModified: result.LastModified ?? new Date(),
      };
    } catch (err: unknown) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (status === 404) return null;
      const name = (err as { name?: string }).name;
      if (name === 'NotFound' || name === 'NoSuchKey') return null;
      throw err;
    }
  }

  /**
   * HEAD against an arbitrary `StorageAdapter`. The common surface does not
   * expose HEAD as a separate verb — `get()` is the closest, but it pulls
   * bytes. For parity sampling we only need etag, so we cheat: if the adapter
   * is also an `S3Adapter` instance, route to its private `tryHead`. Otherwise
   * fall back to `get` and discard the bytes.
   */
  private async headOnAdapter(
    adapter: StorageAdapter,
    key: StorageKey,
  ): Promise<{ etag: string; lastModified: Date } | null> {
    if (adapter instanceof S3Adapter) {
      return adapter.tryHead(key);
    }
    try {
      const obj = await adapter.get(key);
      return { etag: obj.etag, lastModified: obj.lastModified };
    } catch {
      return null;
    }
  }

  /**
   * Same-bucket copy helper. Useful when a future cycle adds an in-bucket
   * rekey workflow (per SDD §0.2 Mibera-rekey). Not used by `sync`; exposed
   * for ergonomics.
   */
  async copyWithin(source: StorageKey, destination: StorageKey): Promise<void> {
    await this.s3.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: toS3Key(destination),
        CopySource: `${this.bucket}/${toS3Key(source)}`,
      }),
    );
  }
}
