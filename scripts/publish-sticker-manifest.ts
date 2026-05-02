/**
 * publish-sticker-manifest — emit a `current.json` GlobalManifest for any
 * Mibera-family sub-collection's sticker substrate, matching the shape that
 * `@freeside-storage/stickers/adapter.synthesizeStickerProfile` reads.
 *
 * M-3 of the mibera-family-sticker-substrate-2026-05-02 cycle. Pairs with:
 *   - M-4 URL contract update (this PR / freeside-storage#6)
 *   - M-1 S3 bucket policy (operator-driven, admin AWS profile)
 *   - M-2 generation pipeline (operator-driven, source decision pending)
 *   - M-5 verification probes (post-bytes)
 *
 * Output path convention (operator's 2026-05-02 correction — sub-collections
 * nested under Mibera, NOT top-level worlds):
 *
 *   s3://thj-assets/Mibera/{SubCollection}/expressions/current.json
 *
 * This script ONLY emits the JSON to a local file — it does not upload.
 * The operator runs the `aws s3 cp` command (printed at the end) with the
 * admin profile after reviewing the output.
 *
 * Schema source of truth: GlobalManifest type in
 * `packages/stickers/src/adapter.ts`. The adapter is transitional — when
 * sub-collections publish per-token manifests (PRD O-4 future scope), this
 * script's output shape evolves.
 *
 * Usage:
 *
 *   pnpm tsx scripts/publish-sticker-manifest.ts \
 *     --collection Shadow \
 *     --version v1 \
 *     --token-count 3219 \
 *     --expression-count 7 \
 *     --variants transparent \
 *     --default-variant transparent \
 *     --skipped-token-ids 0 \
 *     --output ./out/Mibera-Shadow-current.json
 *
 *   # then (operator):
 *   aws s3 cp ./out/Mibera-Shadow-current.json \
 *     s3://thj-assets/Mibera/Shadow/expressions/current.json \
 *     --profile admin --content-type application/json
 *
 * Exit codes:
 *   0 — manifest written + upload command printed
 *   1 — validation failure (bad args)
 *   2 — i/o failure
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const SUPPORTED_COLLECTIONS = ["Shadow", "MST"] as const;
type SubCollection = (typeof SUPPORTED_COLLECTIONS)[number];

interface GlobalManifest {
  version: string;
  generatedAt: string;
  tokenCount: number;
  expressionCount: number;
  skippedTokenIds: number[];
  variants: string[];
  defaultVariant: string;
}

interface Args {
  collection: SubCollection;
  version: string;
  tokenCount: number;
  expressionCount: number;
  variants: string[];
  defaultVariant: string;
  skippedTokenIds: number[];
  output: string;
}

function parseArgs(argv: string[]): Args {
  const args: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg && arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        // boolean-ish flags not supported in v1; every key needs a value
        throw new Error(`Missing value for --${key}`);
      }
      args[key] = value;
      i++;
    }
  }

  const collection = args["collection"];
  if (!collection || !SUPPORTED_COLLECTIONS.includes(collection as SubCollection)) {
    throw new Error(
      `--collection must be one of ${SUPPORTED_COLLECTIONS.join(", ")}; got ${collection}`,
    );
  }

  const version = args["version"];
  if (!version || !/^v\d+$/.test(version)) {
    throw new Error(`--version must match /^v\\d+$/; got ${version}`);
  }

  const tokenCount = Number(args["token-count"]);
  if (!Number.isFinite(tokenCount) || tokenCount <= 0 || !Number.isInteger(tokenCount)) {
    throw new Error(`--token-count must be a positive integer; got ${args["token-count"]}`);
  }

  const expressionCount = Number(args["expression-count"]);
  if (!Number.isFinite(expressionCount) || expressionCount <= 0 || !Number.isInteger(expressionCount)) {
    throw new Error(`--expression-count must be a positive integer; got ${args["expression-count"]}`);
  }

  const variants = (args["variants"] ?? "transparent")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (variants.length === 0) {
    throw new Error("--variants must list ≥1 variant (comma-separated)");
  }

  const defaultVariant = args["default-variant"] ?? variants[0]!;
  if (!variants.includes(defaultVariant)) {
    throw new Error(
      `--default-variant ${defaultVariant} not in --variants ${variants.join(",")}`,
    );
  }

  const skippedRaw = args["skipped-token-ids"] ?? "";
  const skippedTokenIds = skippedRaw
    ? skippedRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const n = Number(s);
          if (!Number.isInteger(n) || n < 0) {
            throw new Error(`--skipped-token-ids must be non-negative integers; bad: ${s}`);
          }
          return n;
        })
    : [];

  const output = args["output"] ?? `./out/Mibera-${collection}-current.json`;

  return {
    collection: collection as SubCollection,
    version,
    tokenCount,
    expressionCount,
    variants,
    defaultVariant,
    skippedTokenIds,
    output,
  };
}

function buildManifest(args: Args): GlobalManifest {
  return {
    version: args.version,
    generatedAt: new Date().toISOString(),
    tokenCount: args.tokenCount,
    expressionCount: args.expressionCount,
    skippedTokenIds: [...args.skippedTokenIds].sort((a, b) => a - b),
    variants: args.variants,
    defaultVariant: args.defaultVariant,
  };
}

function s3UploadCommand(args: Args, localPath: string): string {
  const s3Key = `Mibera/${args.collection}/expressions/current.json`;
  return [
    "aws s3 cp",
    `  ${localPath}`,
    `  s3://thj-assets/${s3Key}`,
    "  --profile admin",
    "  --content-type application/json",
    `  --cache-control "public, max-age=60"`,
  ].join(" \\\n");
}

function main() {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[publish-sticker-manifest] arg error: ${message}`);
    console.error("");
    console.error("Usage example:");
    console.error("  pnpm tsx scripts/publish-sticker-manifest.ts \\");
    console.error("    --collection Shadow --version v1 --token-count 3219 \\");
    console.error("    --expression-count 7 --variants transparent \\");
    console.error("    --default-variant transparent --skipped-token-ids 0");
    process.exit(1);
  }

  console.log("============================================================");
  console.log(`Building manifest for Mibera/${args.collection}`);
  console.log("============================================================");
  console.log(`  version:         ${args.version}`);
  console.log(`  tokenCount:      ${args.tokenCount}`);
  console.log(`  expressionCount: ${args.expressionCount}`);
  console.log(`  variants:        ${args.variants.join(", ")}`);
  console.log(`  defaultVariant:  ${args.defaultVariant}`);
  console.log(`  skippedTokenIds: ${args.skippedTokenIds.length} entries`);
  console.log("");

  const manifest = buildManifest(args);

  try {
    mkdirSync(dirname(args.output), { recursive: true });
    writeFileSync(args.output, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[publish-sticker-manifest] write failed: ${message}`);
    process.exit(2);
  }

  console.log(`Wrote ${args.output}`);
  console.log("");
  console.log("Manifest preview:");
  console.log(JSON.stringify(manifest, null, 2));
  console.log("");
  console.log("============================================================");
  console.log("Next step (operator): upload via admin AWS profile");
  console.log("============================================================");
  console.log(s3UploadCommand(args, args.output));
  console.log("");
  console.log("Verify (post-upload):");
  console.log(
    `  curl -sS https://assets.0xhoneyjar.xyz/Mibera/${args.collection}/expressions/current.json | jq .`,
  );
  process.exit(0);
}

// Only execute when invoked directly (allows unit tests to import without side effects).
const isDirectInvocation =
  import.meta.url.startsWith("file:") &&
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "");

if (isDirectInvocation) {
  main();
}

export { buildManifest, parseArgs, s3UploadCommand };
export type { Args, GlobalManifest, SubCollection };
