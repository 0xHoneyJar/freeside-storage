/**
 * Generic sovereign-metadata ingest.
 *
 * This is the reusable abstraction that MST's bespoke `dualWrite` should have
 * been. `ingestCollectionMetadata` publishes a batch of per-token metadata
 * documents for ANY Mibera-world collection to the sovereign manifest S3 layout
 * — parameterized by `{world, collection, version}`, with ZERO collection
 * specific hardcoding. The Candies vertical slice is the first consumer; the
 * same call serves Tarot, GIF, Fractures, or any future collection unchanged.
 *
 * Plane: Construct (pure orchestration over the StorageAdapter port). It depends
 * only on `@0xhoneyjar/freeside-protocol` (the StorageAdapter interface +
 * MetadataDocument schema) — never on a concrete adapter. The caller injects the
 * adapter (S3Adapter in production; a fake/in-memory adapter in tests), so the
 * module is hermetic and never touches live AWS.
 *
 * Storage layout (seam contract, shared across the three composing pieces):
 *
 *   S3 key:  {world}/{collection}/metadata/v/{version}/{tokenId}.json
 *   bucket:  thj-assets  (the adapter's bucket — NOT part of the key)
 *   URL:     https://metadata.0xhoneyjar.xyz/{world}/{collection}/{tokenId}
 *
 * The on-chain `uri(id)` / `tokenURI(N)` resolves to the URL; a CloudFront
 * Function reads a KV version pointer and redirects to the versioned S3 key.
 * This module writes the versioned payload; flipping the pointer is a separate
 * operator act (out of scope here).
 *
 * Mapping to the StorageAdapter port:
 *   StorageKey.tenant = world             (top-level S3 prefix)
 *   StorageKey.path   = {collection}/metadata/v/{version}/{tokenId}.json
 *   toS3Key(key)      = {world}/{collection}/metadata/v/{version}/{tokenId}.json
 *
 * Idempotency: each document is validated against `MetadataDocument`, then
 * canonicalized to deterministic JSON bytes. When the adapter already holds an
 * object at the key whose bytes are byte-identical, the item is reported
 * `skipped` and no PUT is issued. The adapter's own `put` is additionally
 * idempotent at the S3 layer (PutObject of identical bytes is a no-op write).
 */

import { Schema } from "effect";
import {
  MetadataDocument,
  type StorageAdapter,
  type StorageKey,
} from "@0xhoneyjar/freeside-protocol";

/**
 * One token's metadata to publish. `tokenId` is a string so callers can pass
 * arbitrarily large ids (ERC-1155 `uint256`) without precision loss; for
 * Candies, `tokenId === listings.id`. The `document` is validated against the
 * protocol `MetadataDocument` schema before any write.
 */
export interface IngestItem {
  /** ERC-721 tokenId or ERC-1155 id. Stringified to avoid uint256 precision loss. */
  readonly tokenId: string;
  /** The metadata payload. Validated against `MetadataDocument` before write. */
  readonly document: MetadataDocument;
}

/**
 * Request shape for a batch ingest. Fully parameterized — no collection lives
 * in the code path.
 */
export interface IngestRequest {
  /**
   * Sovereign-routing world slug (lowercase per the URL contract A1 amendment,
   * e.g. `"mibera"`). Maps to the StorageKey tenant / top-level S3 prefix.
   */
  readonly world: string;
  /**
   * Collection slug within the world (e.g. `"candies"`, `"mst"`, `"tarot"`).
   * Maps to the first path segment. This is the ONLY thing that varies between
   * collections — supplied by the caller, never branched on internally.
   */
  readonly collection: string;
  /**
   * Version label for the published payload (e.g. `"v1-2026-06-06"`). Becomes
   * the `v/{version}/` path segment so historical versions are immutable and a
   * pointer flip can roll forward / back without overwriting prior bytes.
   */
  readonly version: string;
  /** Per-token documents to publish. */
  readonly items: readonly IngestItem[];
}

/**
 * Per-item outcome. Discriminated by `status` so callers exhaustive-switch.
 *
 *   - `written` — validated, canonicalized, and PUT to the adapter.
 *   - `skipped` — an object with byte-identical content already existed at the
 *     key (idempotent re-run); no PUT issued.
 *   - `error`   — schema validation failed OR the adapter PUT threw. `reason`
 *     carries the diagnostic; the batch continues (per-item isolation).
 */
export type IngestItemResult =
  | { readonly tokenId: string; readonly key: string; readonly status: "written" }
  | { readonly tokenId: string; readonly key: string; readonly status: "skipped" }
  | {
      readonly tokenId: string;
      readonly key: string;
      readonly status: "error";
      readonly reason: string;
    };

/**
 * Aggregate result. `results` preserves input order 1:1 with `items`.
 */
export interface IngestResult {
  readonly world: string;
  readonly collection: string;
  readonly version: string;
  readonly written: number;
  readonly skipped: number;
  readonly errored: number;
  readonly results: readonly IngestItemResult[];
}

/** Validation error a tokenId field must avoid (would corrupt the S3 path). */
const TOKEN_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

/** Validation error a path segment (world/collection/version) must avoid. */
const SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;

/**
 * Build the tenant-relative path for a token's manifest payload.
 *
 *   {collection}/metadata/v/{version}/{tokenId}.json
 */
function manifestPath(
  collection: string,
  version: string,
  tokenId: string,
): string {
  return `${collection}/metadata/v/${version}/${tokenId}.json`;
}

/**
 * Build the full StorageKey for a token's manifest payload. Exported so callers
 * and tests can assert the exact key shape without re-deriving the convention.
 */
export function metadataStorageKey(
  world: string,
  collection: string,
  version: string,
  tokenId: string,
): StorageKey {
  return {
    tenant: world,
    path: manifestPath(collection, version, tokenId),
  };
}

/**
 * Build the flat S3 key (`{world}/{collection}/metadata/v/{version}/{tokenId}.json`).
 * Mirrors the adapter's internal `toS3Key`; exported for assertion + logging.
 */
export function metadataS3Key(
  world: string,
  collection: string,
  version: string,
  tokenId: string,
): string {
  return `${world}/${manifestPath(collection, version, tokenId)}`;
}

const decodeMetadata = Schema.decodeUnknownEither(MetadataDocument);

/**
 * Canonicalize a validated MetadataDocument to deterministic JSON bytes.
 *
 * Deterministic output (stable key order) is what makes idempotency
 * byte-comparable across re-runs and across the producer that originally
 * published the version. We encode the schema-decoded value (not the raw input)
 * so unknown/extra fields are dropped and the on-disk shape is exactly the
 * protocol contract.
 */
function canonicalBytes(doc: MetadataDocument): Buffer {
  const encoded = Schema.encodeSync(MetadataDocument)(doc);
  return Buffer.from(`${JSON.stringify(encoded, stableReplacer(encoded))}\n`, "utf8");
}

/**
 * JSON.stringify replacer that emits object keys in sorted order at every depth,
 * giving a canonical byte form independent of insertion order.
 */
function stableReplacer(_root: unknown): (key: string, value: unknown) => unknown {
  return function (this: unknown, _key: string, value: unknown): unknown {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(value as Record<string, unknown>).sort()) {
        sorted[k] = (value as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return value;
  };
}

/**
 * Whether the adapter already holds byte-identical content at `key`. Uses the
 * common `get()` verb; a missing key (any throw) is treated as "not present"
 * so the item is written. Byte comparison — not etag — because etag semantics
 * vary across adapters (multipart S3 etags are not plain MD5).
 */
async function isAlreadyPublished(
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
 * Publish a batch of per-token metadata documents for one collection version.
 *
 * Generic + idempotent. For every item:
 *   1. validate `document` against the protocol `MetadataDocument` schema;
 *   2. canonicalize to deterministic JSON bytes;
 *   3. if the adapter already holds byte-identical content at the key → skip;
 *   4. else PUT via the injected adapter.
 *
 * Per-item failures (bad schema, adapter throw) are isolated: they surface as an
 * `error` result and the rest of the batch proceeds. Nothing in this function is
 * collection-specific; `world`/`collection`/`version` are the only knobs.
 *
 * @example
 *   await ingestCollectionMetadata(s3Adapter, {
 *     world: "mibera",
 *     collection: "candies",
 *     version: "v1-2026-06-06",
 *     items: [{ tokenId: "1", document: candiesDocForListing(row1) }],
 *   });
 *   // → writes mibera/candies/metadata/v/v1-2026-06-06/1.json
 */
export async function ingestCollectionMetadata(
  adapter: StorageAdapter,
  req: IngestRequest,
): Promise<IngestResult> {
  if (!SEGMENT_PATTERN.test(req.world)) {
    throw new Error(`ingestCollectionMetadata: invalid world slug "${req.world}"`);
  }
  if (!SEGMENT_PATTERN.test(req.collection)) {
    throw new Error(
      `ingestCollectionMetadata: invalid collection slug "${req.collection}"`,
    );
  }
  if (!SEGMENT_PATTERN.test(req.version)) {
    throw new Error(`ingestCollectionMetadata: invalid version "${req.version}"`);
  }

  const results: IngestItemResult[] = [];
  let written = 0;
  let skipped = 0;
  let errored = 0;

  for (const item of req.items) {
    const key = metadataS3Key(req.world, req.collection, req.version, item.tokenId);

    // Guard the tokenId before it lands in a filesystem/S3 path.
    if (!TOKEN_ID_PATTERN.test(item.tokenId)) {
      errored += 1;
      results.push({
        tokenId: item.tokenId,
        key,
        status: "error",
        reason: `invalid tokenId "${item.tokenId}" (must match ${TOKEN_ID_PATTERN})`,
      });
      continue;
    }

    // Validate against the protocol schema. Malformed documents are rejected.
    const decoded = decodeMetadata(item.document);
    if (decoded._tag === "Left") {
      errored += 1;
      results.push({
        tokenId: item.tokenId,
        key,
        status: "error",
        reason: `schema-validation-failed: ${decoded.left.message}`,
      });
      continue;
    }

    const storageKey = metadataStorageKey(
      req.world,
      req.collection,
      req.version,
      item.tokenId,
    );

    let bytes: Buffer;
    try {
      bytes = canonicalBytes(decoded.right);
    } catch (err) {
      errored += 1;
      results.push({
        tokenId: item.tokenId,
        key,
        status: "error",
        reason: `canonicalization-failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    try {
      if (await isAlreadyPublished(adapter, storageKey, bytes)) {
        skipped += 1;
        results.push({ tokenId: item.tokenId, key, status: "skipped" });
        continue;
      }

      await adapter.put({
        key: storageKey,
        contentType: "application/json",
        bytes,
        etag: "",
        lastModified: new Date(),
      });
      written += 1;
      results.push({ tokenId: item.tokenId, key, status: "written" });
    } catch (err) {
      errored += 1;
      results.push({
        tokenId: item.tokenId,
        key,
        status: "error",
        reason: `put-failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return {
    world: req.world,
    collection: req.collection,
    version: req.version,
    written,
    skipped,
    errored,
    results,
  };
}
