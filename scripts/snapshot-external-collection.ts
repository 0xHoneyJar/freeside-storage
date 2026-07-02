#!/usr/bin/env tsx
/**
 * snapshot-external-collection — STOR-1 stub
 *
 * One-time external collection metadata snapshot → sovereign S3 layout.
 * Full design: grimoires/loa/specs/external-collection-metadata-onboarding.md
 *
 * Subcommands (implementation pending ingest port):
 *   purupuru-pg    — Railway PG puru_token_genesis → MetadataDocument[]
 *   pythenians-me  — Magic Eden v2 per-mint snapshot → MetadataDocument[]
 *
 * Usage (dry-run scaffold):
 *   pnpm tsx scripts/snapshot-external-collection.ts --help
 *   pnpm tsx scripts/snapshot-external-collection.ts purupuru-pg --dry-run
 *   pnpm tsx scripts/snapshot-external-collection.ts pythenians-me --mints ./mints.txt --dry-run
 *
 * Exit codes:
 *   0 — success (or dry-run printed plan)
 *   1 — arg / validation error
 *   2 — not implemented (ingest module missing)
 */

import { readFileSync } from "node:fs";

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
  limit?: number;
}

export function parseArgs(argv: string[]): SnapshotArgs {
  const positional = argv.filter((a) => !a.startsWith("-"));
  const sub = positional[0] as Subcommand | undefined;
  if (!sub || !["purupuru-pg", "pythenians-me"].includes(sub)) {
    throw new Error(
      "Usage: snapshot-external-collection.ts <purupuru-pg|pythenians-me> [--version v1-YYYY-MM-DD] [--dry-run] [--mints FILE] [--limit N]",
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
  }

  if (args.dryRun) {
    console.log("  mode: dry-run (no ingest)");
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
  --version LABEL   S3 version folder (default: v1-2026-07-01)
  --dry-run         Print plan only
  --mints FILE      Mint list for pythenians-me (one base58 per line)
  --limit N         Cap rows for smoke tests
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
    console.error("[snapshot-external-collection] pythenians-me requires --mints FILE (or --dry-run)");
    process.exit(1);
  }

  printPlan(args);

  // ingestCollectionMetadata lives on upstream freeside-storage; port before production.
  console.error(
    "\n[snapshot-external-collection] NOT IMPLEMENTED: port packages/storage-client/src/ingest.ts from freeside-storage, then wire extract → ingest here.",
  );
  process.exit(args.dryRun ? 0 : 2);
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
