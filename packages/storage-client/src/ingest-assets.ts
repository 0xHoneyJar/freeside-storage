/**
 * Generic sovereign-asset ingest (the IMAGE half of the sovereignty slice).
 *
 * Sibling of `ingest.ts`. Where `ingestCollectionMetadata` publishes per-token
 * *metadata documents*, `ingestAssets` copies per-token *binary assets* (images)
 * from a CDN source into the sovereign S3 bucket — the bytes that the metadata
 * `image` field points at. Copying an asset here is what makes
 * `https://assets.0xhoneyjar.xyz/{targetKey}` resolve for the metadata slice.
 *
 * This is the reusable abstraction the Candies image migration needs, but it is
 * NOT candies-specific: only `sourceUrl` + `targetKey` vary per collection. The
 * same call serves Tarot, GIF, Fractures, or any future collection unchanged.
 *
 * Plane: Construct (pure orchestration over two injected ports — the
 * StorageAdapter and a `fetchBytes` function). It depends ONLY on
 * `@0xhoneyjar/freeside-protocol` (the StorageAdapter interface). The byte
 * source is dependency-injected, never a hardcoded global `fetch`, so the
 * module is hermetic and NEVER touches live CloudFront / AWS — tests pass a
 * fake `fetchBytes` and a fake adapter.
 *
 * Seam contract (Candies image migration — the first consumer):
 *
 *   LIVE source:  https://d163aeqznbc6js.cloudfront.net/images/Mibera/Drugs/{filename}
 *                 where filename = listings.imageUrl (a bare filename) and
 *                 tokenId === listings.id.
 *   Sovereign:    S3 bucket thj-assets, key Mibera/Drugs/{filename}
 *                 served at https://assets.0xhoneyjar.xyz/Mibera/Drugs/{filename}
 *                 — exactly the URL the metadata slice's `image` field points at.
 *
 * Cloudinary (res.cloudinary.com/honeyjar) is a scraped archive and is NEVER a
 * source: non-deterministic transforms + deletion/rate-limit risk. The host
 * allowlist (default `["d163aeqznbc6js.cloudfront.net"]`) rejects it and
 * anything else not explicitly permitted.
 *
 * Idempotency: each fetched asset is byte-compared against any object already at
 * the target key. Byte-identical content reports `skipped` and issues NO put —
 * the same idempotency pattern as `ingestCollectionMetadata`, so re-runs are
 * free and a partially-completed migration resumes cleanly.
 */

import type { StorageAdapter, StorageKey } from "@0xhoneyjar/freeside-protocol";

/**
 * Bytes + content-type fetched from a source URL. The injected `fetchBytes`
 * returns this shape so the module never reaches for a global `fetch`. The
 * `contentType` is what the source served (used for the image/* allowlist and
 * carried onto the sovereign object so CloudFront serves the right MIME type).
 */
export interface FetchedAsset {
  /** Raw asset bytes from the source. */
  readonly bytes: Buffer;
  /** Source-reported MIME type (e.g. `"image/png"`). Validated against the image allowlist. */
  readonly contentType: string;
}

/**
 * Injected byte source. Production passes an implementation backed by `fetch`
 * (or the platform HTTP port); tests pass a fake returning known bytes. The
 * abstraction NEVER constructs its own fetcher — that keeps it hermetic and
 * off the live network.
 */
export type FetchBytes = (sourceUrl: string) => Promise<FetchedAsset>;

/**
 * One asset to copy. `tokenId` is a string so callers can pass arbitrarily
 * large ids (ERC-1155 `uint256`) without precision loss; for Candies,
 * `tokenId === listings.id`. `contentType` is an OPTIONAL expectation — when
 * supplied it must match what the source served (and both must be image/*);
 * when omitted the source's own content-type is trusted (still image/* checked).
 */
export interface AssetIngestItem {
  /** ERC-721 tokenId or ERC-1155 id. Stringified to avoid uint256 precision loss. */
  readonly tokenId: string;
  /** Fully-qualified source URL (host validated against the allowlist). */
  readonly sourceUrl: string;
  /**
   * Tenant-relative sovereign target key (e.g. `"Mibera/Drugs/bubblegum-buds.png"`).
   * The bucket is the adapter's concern — NOT part of this key. Path-traversal
   * (`..`, leading `/`, backslashes, control bytes) is rejected.
   */
  readonly targetKey: string;
  /**
   * Optional expected content-type. If present, the source's content-type MUST
   * match (case-insensitive, ignoring parameters like `; charset=`). Either way
   * the effective content-type MUST be an allowed image type.
   */
  readonly contentType?: string;
}

/**
 * Request shape for a batch asset ingest. Fully parameterized — no collection
 * lives in the code path. `world` is descriptive (echoed into the result for
 * the operator's audit trail); the actual S3 prefix is encoded by each item's
 * `targetKey`, so a single batch could even span sub-collections.
 */
export interface AssetIngestRequest {
  /**
   * Sovereign-routing world slug (descriptive; e.g. `"mibera"`). Echoed into the
   * result. Validated as a path-safe segment but does NOT prefix `targetKey`
   * (callers encode the full target prefix in `targetKey`, e.g. `Mibera/Drugs/…`).
   */
  readonly world: string;
  /** Per-token assets to copy. */
  readonly items: readonly AssetIngestItem[];
  /**
   * Allowed source hosts (hostname only, no scheme/port). Defaults to the
   * Candies LIVE CloudFront host. Cloudinary and anything else not listed is
   * REJECTED. Pass a different list to migrate another collection's source.
   */
  readonly allowedHosts?: readonly string[];
}

/**
 * Per-item outcome. Discriminated by `status` so callers exhaustive-switch.
 *
 *   - `copied`  — fetched, validated, and PUT to the adapter.
 *   - `skipped` — an object with byte-identical content already existed at the
 *     target key (idempotent re-run); no PUT issued.
 *   - `error`   — host rejected, content-type rejected, fetch threw, target-key
 *     invalid, or the adapter PUT threw. `reason` carries the diagnostic; the
 *     batch continues (per-item isolation).
 */
export type AssetIngestItemResult =
  | { readonly tokenId: string; readonly targetKey: string; readonly status: "copied" }
  | { readonly tokenId: string; readonly targetKey: string; readonly status: "skipped" }
  | {
      readonly tokenId: string;
      readonly targetKey: string;
      readonly status: "error";
      readonly reason: string;
    };

/**
 * Aggregate result. `results` preserves input order 1:1 with `items`.
 */
export interface AssetIngestResult {
  readonly world: string;
  readonly copied: number;
  readonly skipped: number;
  readonly errored: number;
  readonly results: readonly AssetIngestItemResult[];
}

/**
 * Default source-host allowlist — the Candies LIVE CloudFront distribution, the
 * ONLY sanctioned image source for the candies slice. Cloudinary is deliberately
 * absent. Override via `request.allowedHosts` for other collections.
 */
export const DEFAULT_ALLOWED_HOSTS: readonly string[] = [
  "d163aeqznbc6js.cloudfront.net",
];

/** Allowed image MIME types (the `image/*` subset we sovereignly serve). */
const ALLOWED_IMAGE_TYPES: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

/** Validation guard for the `world` segment (audit-trail field). */
const SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;

/**
 * Validate a tenant-relative target key against path-traversal. The key may
 * contain `/` separators (it encodes a prefix like `Mibera/Drugs/x.png`) but
 * MUST NOT escape the tenant root, be absolute, contain `..` segments, NUL /
 * control bytes, or backslashes.
 */
function targetKeyError(targetKey: string): string | null {
  if (targetKey.length === 0) return "empty targetKey";
  if (targetKey.length > 1024) return "targetKey too long (>1024)";
  if (targetKey.startsWith("/")) return "targetKey must be tenant-relative (no leading slash)";
  if (targetKey.includes("\\")) return "targetKey must not contain backslashes";
  // Reject C0/C1 control bytes (incl. NUL) so they can't slip into the S3 key.
  for (let i = 0; i < targetKey.length; i++) {
    const code = targetKey.charCodeAt(i);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
      return "targetKey must not contain control bytes";
    }
  }
  // Reject `..` as a whole path segment (catches ../, /.., and a bare ..).
  for (const seg of targetKey.split("/")) {
    if (seg === "..") return "targetKey must not contain a '..' path segment";
    if (seg === ".") return "targetKey must not contain a '.' path segment";
  }
  return null;
}

/**
 * Parse a tenant-relative `targetKey` into a StorageKey. The first segment is
 * the tenant (top-level S3 prefix, e.g. `Mibera`); the remainder is the path.
 * A single-segment key (no `/`) is rejected — every sovereign asset lives under
 * a tenant prefix.
 */
function toStorageKey(targetKey: string): StorageKey | { readonly error: string } {
  const slash = targetKey.indexOf("/");
  if (slash <= 0 || slash === targetKey.length - 1) {
    return { error: "targetKey must be '{tenant}/{path}' with a non-empty path" };
  }
  return {
    tenant: targetKey.slice(0, slash),
    path: targetKey.slice(slash + 1),
  };
}

/**
 * Extract the lowercase hostname from a source URL. Returns `null` for an
 * unparseable URL so the caller reports a clean `error` rather than throwing.
 */
function hostOf(sourceUrl: string): string | null {
  try {
    return new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Normalize a content-type for comparison: lowercase, drop parameters
 * (`image/png; charset=binary` → `image/png`), trim. Returns `""` for an
 * empty/undefined input.
 */
function normalizeContentType(ct: string | undefined): string {
  if (!ct) return "";
  const semi = ct.indexOf(";");
  return (semi === -1 ? ct : ct.slice(0, semi)).trim().toLowerCase();
}

/**
 * Whether the adapter already holds byte-identical content at `key`. Uses the
 * common `get()` verb; a missing key (any throw) is treated as "not present" so
 * the asset is copied. Byte comparison — not etag — because etag semantics vary
 * across adapters (multipart S3 etags are not plain MD5). Mirrors
 * `ingest.ts::isAlreadyPublished`.
 */
async function isAlreadyMirrored(
  adapter: StorageAdapter,
  key: StorageKey,
  bytes: Buffer,
): Promise<boolean> {
  try {
    const existing = await adapter.get(key);
    return existing.bytes.equals(bytes);
  } catch {
    return false;
  }
}

/**
 * Copy a batch of per-token binary assets from an allowlisted CDN source into
 * the sovereign adapter.
 *
 * Generic + idempotent. For every item:
 *   1. validate the target key (no path traversal);
 *   2. validate the source host is on the allowlist (rejects Cloudinary + any
 *      non-listed host);
 *   3. fetch bytes via the injected `fetchBytes` (NEVER a global fetch);
 *   4. validate the (effective) content-type is an allowed image type, and — if
 *      the item declared a `contentType` — that the source matches it;
 *   5. if the adapter already holds byte-identical content at the key → skip;
 *   6. else PUT via the injected adapter.
 *
 * Per-item failures (rejected host, bad content-type, fetch throw, adapter
 * throw) are isolated: they surface as an `error` result and the rest of the
 * batch proceeds. Nothing here is collection-specific; `sourceUrl`/`targetKey`
 * are the only knobs.
 *
 * @example
 *   await ingestAssets({
 *     fetchBytes,          // injected: fetch(url) → { bytes, contentType }
 *     adapter: s3Adapter,  // injected: StorageAdapter (S3Adapter in prod)
 *     world: "mibera",
 *     items: candiesListings.map((row) => ({
 *       tokenId: String(row.id),
 *       sourceUrl: `https://d163aeqznbc6js.cloudfront.net/images/Mibera/Drugs/${row.imageUrl}`,
 *       targetKey: `Mibera/Drugs/${row.imageUrl}`,
 *     })),
 *   });
 *   // → copies bytes to thj-assets/Mibera/Drugs/{filename}, idempotently.
 */
export async function ingestAssets(args: {
  readonly fetchBytes: FetchBytes;
  readonly adapter: StorageAdapter;
  readonly world: string;
  readonly items: readonly AssetIngestItem[];
  readonly allowedHosts?: readonly string[];
}): Promise<AssetIngestResult> {
  const { fetchBytes, adapter, world, items } = args;

  if (!SEGMENT_PATTERN.test(world)) {
    throw new Error(`ingestAssets: invalid world slug "${world}"`);
  }

  const allowedHosts = (args.allowedHosts ?? DEFAULT_ALLOWED_HOSTS).map((h) =>
    h.toLowerCase(),
  );
  const allowedHostSet = new Set(allowedHosts);

  const results: AssetIngestItemResult[] = [];
  let copied = 0;
  let skipped = 0;
  let errored = 0;

  const fail = (item: AssetIngestItem, reason: string): void => {
    errored += 1;
    results.push({
      tokenId: item.tokenId,
      targetKey: item.targetKey,
      status: "error",
      reason,
    });
  };

  for (const item of items) {
    // 1. Target-key path-traversal guard (before any fetch).
    const keyErr = targetKeyError(item.targetKey);
    if (keyErr) {
      fail(item, `invalid targetKey: ${keyErr}`);
      continue;
    }
    const storageKey = toStorageKey(item.targetKey);
    if ("error" in storageKey) {
      fail(item, `invalid targetKey: ${storageKey.error}`);
      continue;
    }

    // 2. Source-host allowlist (rejects Cloudinary + anything not listed).
    const host = hostOf(item.sourceUrl);
    if (host === null) {
      fail(item, `unparseable sourceUrl "${item.sourceUrl}"`);
      continue;
    }
    if (!allowedHostSet.has(host)) {
      fail(
        item,
        `source host "${host}" not on allowlist [${allowedHosts.join(", ")}]`,
      );
      continue;
    }

    // 3. Fetch via the injected port (hermetic; never global fetch).
    let fetched: FetchedAsset;
    try {
      fetched = await fetchBytes(item.sourceUrl);
    } catch (err) {
      fail(
        item,
        `fetch-failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    if (!fetched || !Buffer.isBuffer(fetched.bytes)) {
      fail(item, "fetch-failed: fetchBytes did not return a Buffer");
      continue;
    }

    // 4. Content-type validation (must be an allowed image type; if the item
    //    declared a contentType, the source must match it).
    const sourceCt = normalizeContentType(fetched.contentType);
    if (!ALLOWED_IMAGE_TYPES.has(sourceCt)) {
      fail(
        item,
        `content-type "${fetched.contentType ?? "(none)"}" is not an allowed image type`,
      );
      continue;
    }
    if (item.contentType !== undefined) {
      const expected = normalizeContentType(item.contentType);
      if (expected !== sourceCt) {
        fail(
          item,
          `content-type mismatch: expected "${expected}", source served "${sourceCt}"`,
        );
        continue;
      }
    }

    // 5 + 6. Idempotent copy: skip byte-identical, else PUT.
    try {
      if (await isAlreadyMirrored(adapter, storageKey, fetched.bytes)) {
        skipped += 1;
        results.push({
          tokenId: item.tokenId,
          targetKey: item.targetKey,
          status: "skipped",
        });
        continue;
      }

      await adapter.put({
        key: storageKey,
        contentType: sourceCt,
        bytes: fetched.bytes,
        etag: "",
        lastModified: new Date(),
      });
      copied += 1;
      results.push({
        tokenId: item.tokenId,
        targetKey: item.targetKey,
        status: "copied",
      });
    } catch (err) {
      fail(
        item,
        `put-failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { world, copied, skipped, errored, results };
}
