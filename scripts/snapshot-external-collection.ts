#!/usr/bin/env tsx
/**
 * snapshot-external-collection — STOR-1 external metadata snapshot
 *
 * One-time external collection metadata snapshot → sovereign S3 layout.
 * Full design: grimoires/loa/specs/external-collection-metadata-onboarding.md
 *
 * Subcommands:
 *   purupuru-pg    — Railway PG puru_token_genesis → MetadataDocument[]
 *   pythenians-me  — Magic Eden v2 per-mint snapshot → MetadataDocument[]
 *
 * Usage:
 *   pnpm tsx scripts/snapshot-external-collection.ts --help
 *   pnpm tsx scripts/snapshot-external-collection.ts purupuru-pg --dry-run
 *   pnpm tsx scripts/snapshot-external-collection.ts pythenians-me --mints ./mints.txt --dry-run
 *   pnpm tsx scripts/snapshot-external-collection.ts purupuru-pg --version v1-2026-07-01
 *
 * Env:
 *   PURUPURU_DATABASE_URL — purupuru-pg extract
 *   AWS_REGION / FREESIDE_ASSETS_BUCKET — S3 ingest (default us-west-2 / thj-assets)
 *
 * Exit codes:
 *   0 — success (or dry-run printed plan)
 *   1 — arg / validation error
 *   2 — extract/ingest failure
 */

import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

import { extractPurupuruGenesis } from "./lib/purupuru-pg-extract.js";
import { extractPytheniansFromMe } from "./lib/pythenians-me-extract.js";

/** Staging collections for member-pfp STOR-1. */
export const EXTERNAL_COLLECTIONS = {
  pythenians: {
    world: "pythenians",
    collection: "pythians",
    tokenKey: "mint" as const,
    exampleUrl:
      "https://metadata.0xhoneyjar.xyz/pythenians/pythians/{tokenId}",
    s3KeyTemplate:
      "pythenians/pythians/metadata/v/{version}/{tokenId}.json",
  },
  purupuru: {
    world: "purupuru",
    collection: "genesis",
    tokenKey: "tokenId" as const,
    exampleUrl:
      "https://metadata.0xhoneyjar.xyz/purupuru/genesis/{tokenId}",
    s3KeyTemplate:
      "purupuru/genesis/metadata/v/{version}/{tokenId}.json",
  },
} as const;

export type Subcommand = "purupuru-pg" | "pythenians-me";

export interface SnapshotArgs {
  subcommand: Subcommand;
  version: string;
  dryRun: boolean;
  mintsFile?: string;
  checkpointPath?: string;
  limit?: number;
}

export function parseArgs(argv: string[]): SnapshotArgs {
  const positional = argv.filter((a) => !a.startsWith("-"));
  const sub = positional[0] as Subcommand | undefined;
  if (!sub || !["purupuru-pg", "pythenians-me"].includes(sub)) {
    throw new Error(
      "Usage: snapshot-external-collection.ts <purupuru-pg|pythenians-me> [--version v1-YYYY-MM-DD] [--dry-run] [--mints FILE] [--checkpoint FILE] [--limit N]",
    );
  }

  const getFlag = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  return {
    subcommand: sub,
    version: getFlag("--version") ?? "v1-2026-07-01",
    dryRun: argv.includes("--dry-run"),
    mintsFile: getFlag("--mints"),
    checkpointPath: getFlag("--checkpoint"),
    limit: getFlag("--limit") ? Number(getFlag("--limit")) : undefined,
  };
}

export function loadMintList(path: string): string[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

export function printPlan(args: SnapshotArgs): void {
  const cfg =
    args.subcommand === "pythenians-me"
      ? EXTERNAL_COLLECTIONS.pythenians
      : EXTERNAL_COLLECTIONS.purupuru;

  console.log(`[snapshot-external-collection] subcommand=${args.subcommand}`);
  console.log(`  world=${cfg.world} collection=${cfg.collection}`);
  console.log(`  version=${args.version}`);
  console.log(`  public URL pattern: ${cfg.exampleUrl}`);
  console.log(`  S3 key pattern: s3://thj-assets/${cfg.s3KeyTemplate}`);

  if (args.subcommand === "purupuru-pg") {
    console.log("  source: PURUPURU_DATABASE_URL → puru_token_genesis.image_url");
    console.log("  SQL: see grimoires/loa/specs/external-collection-metadata-onboarding.md");
  } else {
    console.log("  source: GET api-mainnet.magiceden.dev/v2/tokens/{mint}");
    if (args.mintsFile) {
      const mints = loadMintList(args.mintsFile);
      console.log(`  mints file: ${args.mintsFile} (${mints.length} mints)`);
    } else {
      console.log("  mints: required — sonar export or --mints FILE");
    }
    console.log(
      `  checkpoint: ${args.checkpointPath ?? "out/pythenians/checkpoint.jsonl"}`,
    );
  }

  if (args.dryRun) {
    console.log("  mode: dry-run (no ingest)");
  }
}

function createS3Adapter() {
  // Lazy import keeps unit tests hermetic (no built adapter dist required at import time).
  return import("@freeside-storage/adapters-s3").then(({ S3Adapter }) =>
    new S3Adapter({
      bucket: process.env.FREESIDE_ASSETS_BUCKET ?? "thj-assets",
      region: process.env.AWS_REGION ?? "us-west-2",
    }),
  );
}

async function ingestToS3(
  cfg: (typeof EXTERNAL_COLLECTIONS)[keyof typeof EXTERNAL_COLLECTIONS],
  version: string,
  items: Awaited<ReturnType<typeof extractPurupuruGenesis>>,
) {
  const [{ ingestCollectionMetadata }, adapter] = await Promise.all([
    import("@freeside-storage/client"),
    createS3Adapter(),
  ]);
  return ingestCollectionMetadata(adapter, {
    world: cfg.world,
    collection: cfg.collection,
    version,
    items,
  });
}

export async function runSnapshot(args: SnapshotArgs): Promise<void> {
  printPlan(args);

  const cfg =
    args.subcommand === "pythenians-me"
      ? EXTERNAL_COLLECTIONS.pythenians
      : EXTERNAL_COLLECTIONS.purupuru;

  let items;
  if (args.subcommand === "purupuru-pg") {
    items = await extractPurupuruGenesis({ limit: args.limit });
  } else {
    if (!args.mintsFile) {
      if (args.dryRun) {
        console.log("[snapshot-external-collection] dry-run complete (plan only)");
        return;
      }
      throw new Error("pythenians-me requires --mints FILE");
    }
    const mints = loadMintList(args.mintsFile);
    const scopedMints = args.limit != null ? mints.slice(0, args.limit) : mints;
    const checkpointPath =
      args.checkpointPath ?? "out/pythenians/checkpoint.jsonl";
    mkdirSync(dirname(checkpointPath), { recursive: true });
    const extracted = await extractPytheniansFromMe({
      mints: scopedMints,
      concurrency: 6,
      checkpointPath,
    });
    items = extracted.items;
    console.log(
      `[snapshot-external-collection] pythenians extracted=${extracted.completed} skipped=${extracted.skipped} failed=${extracted.failed.length}`,
    );
    if (extracted.failed.length > 0) {
      console.error(
        `[snapshot-external-collection] first failures: ${extracted.failed.slice(0, 5).join(", ")}`,
      );
    }
  }

  console.log(`[snapshot-external-collection] documents ready=${items.length}`);
  if (items.length === 0) {
    throw new Error("no documents extracted");
  }

  if (args.dryRun) {
    console.log("[snapshot-external-collection] dry-run complete (no S3 ingest)");
    return;
  }

  const result = await ingestToS3(cfg, args.version, items);

  console.log(
    `[snapshot-external-collection] ingest written=${result.written} skipped=${result.skipped} errored=${result.errored}`,
  );
  if (result.errored > 0) {
    throw new Error(`ingest completed with ${result.errored} errors`);
  }
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(`snapshot-external-collection — STOR-1 external metadata snapshot

See grimoires/loa/specs/external-collection-metadata-onboarding.md

Subcommands:
  purupuru-pg     Import from Railway PG (puru_token_genesis)
  pythenians-me   One-time Magic Eden v2 per-mint snapshot

Flags:
  --version LABEL     S3 version folder (default: v1-2026-07-01)
  --dry-run           Extract + validate only (no S3 ingest)
  --mints FILE        Mint list for pythenians-me (one base58 per line)
  --checkpoint FILE   Resume checkpoint jsonl (default out/pythenians/checkpoint.jsonl)
  --limit N           Cap rows for smoke tests

Operator follow-up (out of scope here):
  KV flip for ${EXTERNAL_COLLECTIONS.pythenians.world}/${EXTERNAL_COLLECTIONS.pythenians.collection}
  and ${EXTERNAL_COLLECTIONS.purupuru.world}/${EXTERNAL_COLLECTIONS.purupuru.collection}
  via loa-freeside flipping-kv-pointer skill after errored === 0.
`);
    process.exit(0);
  }

  let args: SnapshotArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(String(e));
    process.exit(1);
  }

  if (args.subcommand === "pythenians-me" && !args.dryRun && !args.mintsFile) {
    console.error("[snapshot-external-collection] pythenians-me requires --mints FILE (or --dry-run with plan only)");
    process.exit(1);
  }

  try {
    await runSnapshot(args);
  } catch (err) {
    console.error("[snapshot-external-collection]", err);
    process.exit(2);
  }
}

// Only execute when invoked directly (allows unit tests to import without side effects).
const isDirectInvocation =
  import.meta.url.startsWith("file:") &&
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "");

if (isDirectInvocation) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
