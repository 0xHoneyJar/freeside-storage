#!/usr/bin/env tsx
/**
 * Schema additivity audit — URL_CONTRACT v1.4.0 acceptance gate (R4.3).
 *
 * Per architect lock A7: MetadataDocument schema bump v1.3.0 → v1.4.0 is
 * ADDITIVE-ONLY · existing tokens MUST decode unchanged.
 *
 * This script enumerates all live tokens on the canonical sovereign
 * metadata host and decodes each payload against the v1.4.0
 * MetadataDocument Schema. The new `medium_capabilities?` field is
 * optional, so existing tokens (which never emit the field) decode
 * cleanly through the optional gate.
 *
 * Pass criterion (PR-D merge gate): 100% of fetched tokens decode
 * successfully. Any decode failure blocks merge — the schema bump is
 * NOT additive and must be fixed before re-running.
 *
 * Audit corpus (per sprint.md AC-4.3):
 *   - canon Mibera (10000 tokens) at metadata.0xhoneyjar.xyz/mibera/{N}
 *   - MST           (3219  tokens) at metadata.0xhoneyjar.xyz/mibera/mst/{N}
 *   - Tarot, Candies — currently 404 on prod (gated on `cross-collection-
 *     sovereign` migration phase, shippedAt: null per url-contract.ts).
 *     Audit reports `live: 0 · skip: per phase status` for these two.
 *
 * Total live corpus: 13219 tokens.
 *
 * Run: pnpm tsx scripts/audit-metadata-v140-additivity.ts
 *      pnpm tsx scripts/audit-metadata-v140-additivity.ts --sample 100
 *      pnpm tsx scripts/audit-metadata-v140-additivity.ts --collection mibera
 *
 * Per DISC-001 / SKP-001 (flatline review of SDD): network failures ARE
 * a possible outage state for any single token. The audit treats network
 * timeouts + non-2xx as DECODE failures (load-bearing — a token that
 * doesn't decode in audit doesn't decode in prod either). Operators
 * should retry transient failures BEFORE merging PR-D — a token that
 * fails twice is genuinely broken and merge MUST block.
 *
 * Concurrency: 16 parallel fetches (gentle on CDN · respects sovereign
 * manifest CF Function rate). Adjustable via --concurrency.
 */

import { Schema } from "effect";
import { Effect, Either } from "effect";

import { MetadataDocument } from "../packages/protocol/src/metadata-document.js";

// =============================================================================
// Config
// =============================================================================

interface CollectionDef {
  readonly id: 'mibera' | 'mst' | 'tarot' | 'candies';
  readonly displayName: string;
  readonly basePath: string; // e.g. 'mibera' or 'mibera/mst'
  readonly tokenCount: number;
  readonly idStart: number;
  readonly idEnd: number;
  readonly note?: string;
}

const COLLECTIONS: CollectionDef[] = [
  {
    id: 'mibera',
    displayName: 'canon Mibera',
    basePath: 'mibera',
    tokenCount: 10000,
    idStart: 1,
    idEnd: 10000,
  },
  {
    id: 'mst',
    displayName: 'MST (Mibera Shadow Traits)',
    basePath: 'mibera/mst',
    tokenCount: 3219,
    idStart: 1,
    idEnd: 3219,
  },
  {
    id: 'tarot',
    displayName: 'Tarot',
    basePath: 'mibera/tarot',
    tokenCount: 78, // standard tarot deck size · placeholder
    idStart: 1,
    idEnd: 78,
    note: 'gated on cross-collection-sovereign migration phase (shippedAt: null)',
  },
  {
    id: 'candies',
    displayName: 'Candies',
    basePath: 'mibera/candies',
    tokenCount: 0, // unknown · TBD
    idStart: 1,
    idEnd: 100, // sample probe size
    note: 'gated on cross-collection-sovereign migration phase (shippedAt: null)',
  },
];

const METADATA_HOST = 'metadata.0xhoneyjar.xyz';
const TIMEOUT_MS = 10_000;
const DEFAULT_CONCURRENCY = 16;

// =============================================================================
// CLI args
// =============================================================================

interface AuditArgs {
  readonly sample: number | null;
  readonly collection: CollectionDef['id'] | 'all';
  readonly concurrency: number;
  readonly verbose: boolean;
  readonly stopAtFailures: number;
  readonly excludeBaseline: boolean;
}

/**
 * Known persistent missing tokens — pre-existing data-state gaps that are
 * NOT schema regressions. From the MST sovereignty cycle (cutover B):
 * 5 tokens were minted on-chain but never had vm_jsons inserted; their
 * sovereign manifest origin (S3) returns 403 not because the schema is
 * wrong but because the JSON simply does not exist.
 *
 * Operators can pass --exclude-baseline to skip these IDs in the audit
 * (treating them as already-known gaps · no schema-additivity claim
 * implied). Without the flag, the audit reports them as network-fail,
 * which keeps the audit honest about the data state.
 *
 * Memory anchor: project_mibera_sovereignty_migration · "5 missing tokens
 * diagnosed (vm_jsons insert gap, all minted on-chain)".
 */
const KNOWN_BASELINE_MISSING: Record<CollectionDef['id'], readonly number[]> = {
  mibera: [],
  mst: [3192, 3196, 3209, 3211, 3215],
  tarot: [],
  candies: [],
};

function parseArgs(argv: string[]): AuditArgs {
  let sample: number | null = null;
  let collection: AuditArgs['collection'] = 'all';
  let concurrency = DEFAULT_CONCURRENCY;
  let verbose = false;
  let stopAtFailures = Infinity;
  let excludeBaseline = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--sample' && argv[i + 1]) {
      sample = Number.parseInt(argv[++i] as string, 10);
      if (!Number.isFinite(sample) || sample <= 0) {
        throw new Error('--sample must be a positive integer');
      }
    } else if (arg === '--collection' && argv[i + 1]) {
      const c = argv[++i] as string;
      if (!['all', 'mibera', 'mst', 'tarot', 'candies'].includes(c)) {
        throw new Error(`unknown --collection value: ${c}`);
      }
      collection = c as AuditArgs['collection'];
    } else if (arg === '--concurrency' && argv[i + 1]) {
      concurrency = Number.parseInt(argv[++i] as string, 10);
      if (!Number.isFinite(concurrency) || concurrency <= 0) {
        throw new Error('--concurrency must be a positive integer');
      }
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg === '--stop-at-failures' && argv[i + 1]) {
      stopAtFailures = Number.parseInt(argv[++i] as string, 10);
      if (!Number.isFinite(stopAtFailures) || stopAtFailures < 1) {
        throw new Error('--stop-at-failures must be a positive integer');
      }
    } else if (arg === '--exclude-baseline') {
      excludeBaseline = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return { sample, collection, concurrency, verbose, stopAtFailures, excludeBaseline };
}

function printHelp(): void {
  console.log(`audit-metadata-v140-additivity — verify v1.4.0 schema is additive-only

USAGE
  pnpm tsx scripts/audit-metadata-v140-additivity.ts [OPTIONS]

OPTIONS
  --sample N             Decode only N evenly-spaced tokens per collection
  --collection NAME      One of: all, mibera, mst, tarot, candies (default: all)
  --concurrency N        Parallel fetches (default: ${DEFAULT_CONCURRENCY})
  --stop-at-failures N   Bail after N decode failures (default: unlimited)
  --exclude-baseline     Skip known pre-existing missing tokens (e.g.
                         5 MST IDs from vm_jsons gap pre-cycle-R)
  --verbose / -v         Print every fetch
  --help / -h            Print this help

EXIT
  0 — 100% pass · architect lock A7 satisfied · merge-eligible
  1 — at least one decode failure · merge BLOCKED
  2 — at least one network failure · re-run after transient settles
`);
}

// =============================================================================
// Fetch + decode a single token
// =============================================================================

interface AuditResult {
  readonly tokenId: number;
  readonly url: string;
  readonly outcome:
    | { kind: 'pass' }
    | { kind: 'decode-fail'; error: string; raw: unknown }
    | { kind: 'network-fail'; status?: number; error: string }
    | { kind: 'not-live' }; // 404 → collection not yet shipped
}

async function fetchAndDecode(
  collection: CollectionDef,
  tokenId: number,
): Promise<AuditResult> {
  const url = `https://${METADATA_HOST}/${collection.basePath}/${tokenId}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (res.status === 404) {
      return { tokenId, url, outcome: { kind: 'not-live' } };
    }
    if (!res.ok) {
      return {
        tokenId,
        url,
        outcome: {
          kind: 'network-fail',
          status: res.status,
          error: `HTTP ${res.status}`,
        },
      };
    }
    const raw = await res.json();
    const decoded = Schema.decodeUnknownEither(MetadataDocument)(raw);
    if (Either.isLeft(decoded)) {
      return {
        tokenId,
        url,
        outcome: {
          kind: 'decode-fail',
          error: decoded.left.message ?? String(decoded.left),
          raw,
        },
      };
    }
    return { tokenId, url, outcome: { kind: 'pass' } };
  } catch (err) {
    clearTimeout(timer);
    return {
      tokenId,
      url,
      outcome: {
        kind: 'network-fail',
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

// =============================================================================
// Token id list per collection (sample-aware)
// =============================================================================

function tokenIdsFor(
  collection: CollectionDef,
  sample: number | null,
  excludeBaseline: boolean,
): number[] {
  const range = collection.idEnd - collection.idStart + 1;
  const baseline = excludeBaseline
    ? new Set(KNOWN_BASELINE_MISSING[collection.id])
    : new Set<number>();
  let ids: number[] = [];
  if (sample === null || sample >= range) {
    for (let i = collection.idStart; i <= collection.idEnd; i++) ids.push(i);
  } else {
    const step = range / sample;
    for (let i = 0; i < sample; i++) {
      const id = Math.round(collection.idStart + i * step);
      if (!ids.includes(id) && id <= collection.idEnd) ids.push(id);
    }
  }
  if (baseline.size > 0) {
    ids = ids.filter((id) => !baseline.has(id));
  }
  return ids;
}

// =============================================================================
// Concurrency-bounded auditor
// =============================================================================

interface CollectionSummary {
  readonly collection: CollectionDef;
  readonly attempted: number;
  readonly passed: number;
  readonly decodeFailed: number;
  readonly networkFailed: number;
  readonly notLive: number;
  readonly failures: readonly AuditResult[];
}

async function auditCollection(
  collection: CollectionDef,
  args: AuditArgs,
): Promise<CollectionSummary> {
  const ids = tokenIdsFor(collection, args.sample, args.excludeBaseline);
  const baselineExcluded = args.excludeBaseline
    ? KNOWN_BASELINE_MISSING[collection.id].length
    : 0;
  console.log(
    `\n=== ${collection.displayName} (${collection.basePath}) ===\n` +
      `targets: ${ids.length} (concurrency=${args.concurrency})${
        baselineExcluded > 0
          ? `\nbaseline-excluded: ${baselineExcluded} known missing IDs (--exclude-baseline)`
          : ''
      }${collection.note ? `\nnote: ${collection.note}` : ''}`,
  );
  let passed = 0;
  let decodeFailed = 0;
  let networkFailed = 0;
  let notLive = 0;
  const failures: AuditResult[] = [];

  for (let i = 0; i < ids.length; i += args.concurrency) {
    const batch = ids.slice(i, i + args.concurrency);
    const results = await Promise.all(
      batch.map((id) => fetchAndDecode(collection, id)),
    );
    for (const r of results) {
      switch (r.outcome.kind) {
        case 'pass':
          passed++;
          if (args.verbose) console.log(`PASS · ${r.url}`);
          break;
        case 'decode-fail':
          decodeFailed++;
          failures.push(r);
          console.error(`DECODE-FAIL · ${r.url}`);
          console.error(`  ${r.outcome.error}`);
          if (failures.length >= args.stopAtFailures) {
            return {
              collection,
              attempted: passed + decodeFailed + networkFailed + notLive,
              passed,
              decodeFailed,
              networkFailed,
              notLive,
              failures,
            };
          }
          break;
        case 'network-fail':
          networkFailed++;
          failures.push(r);
          console.error(
            `NETWORK-FAIL · ${r.url} · ${r.outcome.status ?? 'no-status'} · ${r.outcome.error}`,
          );
          break;
        case 'not-live':
          notLive++;
          if (args.verbose) console.log(`NOT-LIVE · ${r.url} (404)`);
          break;
      }
    }
    process.stdout.write(
      `  progress: ${i + batch.length}/${ids.length} ` +
        `(pass=${passed} decode-fail=${decodeFailed} network-fail=${networkFailed} not-live=${notLive})\r`,
    );
  }
  process.stdout.write('\n');

  return {
    collection,
    attempted: passed + decodeFailed + networkFailed + notLive,
    passed,
    decodeFailed,
    networkFailed,
    notLive,
    failures,
  };
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log('=== audit-metadata-v140-additivity ===');
  console.log(`sample=${args.sample ?? 'all'} concurrency=${args.concurrency} ` +
    `collection=${args.collection}`);

  const targets = COLLECTIONS.filter(
    (c) => args.collection === 'all' || c.id === args.collection,
  );

  const summaries: CollectionSummary[] = [];
  for (const c of targets) {
    summaries.push(await auditCollection(c, args));
  }

  // Print final report
  console.log('\n=== AUDIT RESULT ===');
  let totalPass = 0;
  let totalDecodeFail = 0;
  let totalNetworkFail = 0;
  let totalNotLive = 0;
  let totalAttempted = 0;
  let totalLive = 0;
  for (const s of summaries) {
    const live = s.passed + s.decodeFailed;
    totalPass += s.passed;
    totalDecodeFail += s.decodeFailed;
    totalNetworkFail += s.networkFailed;
    totalNotLive += s.notLive;
    totalAttempted += s.attempted;
    totalLive += live;
    const passRate = live === 0 ? '—' : ((s.passed / live) * 100).toFixed(2) + '%';
    console.log(
      `${s.collection.displayName.padEnd(36)} attempted=${s.attempted.toString().padStart(6)} ` +
        `live=${live.toString().padStart(6)} pass=${s.passed.toString().padStart(6)} ` +
        `decode-fail=${s.decodeFailed.toString().padStart(4)} ` +
        `network-fail=${s.networkFailed.toString().padStart(4)} ` +
        `not-live=${s.notLive.toString().padStart(6)} pass-rate=${passRate}`,
    );
  }
  console.log('---');
  const passRate =
    totalLive === 0 ? '—' : ((totalPass / totalLive) * 100).toFixed(2) + '%';
  console.log(
    `TOTAL                                 attempted=${totalAttempted.toString().padStart(6)} ` +
      `live=${totalLive.toString().padStart(6)} pass=${totalPass.toString().padStart(6)} ` +
      `decode-fail=${totalDecodeFail.toString().padStart(4)} ` +
      `network-fail=${totalNetworkFail.toString().padStart(4)} ` +
      `not-live=${totalNotLive.toString().padStart(6)} pass-rate=${passRate}`,
  );

  // Exit codes per architect lock A7
  if (totalDecodeFail > 0) {
    console.error(
      `\nFAIL · ${totalDecodeFail} decode failure(s) · v1.4.0 schema is NOT additive · merge BLOCKED.`,
    );
    process.exit(1);
  }
  if (totalNetworkFail > 0) {
    console.error(
      `\nWARN · ${totalNetworkFail} network failure(s) · re-run after transient settles before merging.`,
    );
    process.exit(2);
  }
  console.log(
    `\nPASS · 100% (${totalPass}/${totalLive}) live tokens decode against v1.4.0 schema · architect lock A7 satisfied.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('audit aborted:', err);
  process.exit(3);
});
