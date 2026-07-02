import { describe, it, expect } from "vitest";
import {
  EXTERNAL_COLLECTIONS,
  loadMintList,
  parseArgs,
  printPlan,
} from "./snapshot-external-collection.js";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("EXTERNAL_COLLECTIONS", () => {
  it("declares pythenians sovereign URL aligned with inventory-api registry", () => {
    expect(EXTERNAL_COLLECTIONS.pythenians.world).toBe("pythenians");
    expect(EXTERNAL_COLLECTIONS.pythenians.collection).toBe("pythians");
    expect(EXTERNAL_COLLECTIONS.pythenians.exampleUrl).toContain(
      "metadata.0xhoneyjar.xyz/pythenians/pythians/",
    );
  });

  it("declares purupuru genesis sovereign URL", () => {
    expect(EXTERNAL_COLLECTIONS.purupuru.collection).toBe("genesis");
    expect(EXTERNAL_COLLECTIONS.purupuru.exampleUrl).toBe(
      "https://metadata.0xhoneyjar.xyz/purupuru/genesis/{tokenId}",
    );
  });
});

describe("parseArgs", () => {
  it("parses pythenians-me dry-run defaults", () => {
    const args = parseArgs(["pythenians-me", "--dry-run"]);
    expect(args.subcommand).toBe("pythenians-me");
    expect(args.dryRun).toBe(true);
    expect(args.version).toBe("v1-2026-07-01");
  });

  it("parses purupuru-pg with custom version", () => {
    const args = parseArgs([
      "purupuru-pg",
      "--version",
      "v1-2026-07-02",
      "--limit",
      "5",
    ]);
    expect(args.subcommand).toBe("purupuru-pg");
    expect(args.version).toBe("v1-2026-07-02");
    expect(args.limit).toBe(5);
  });
});

describe("loadMintList", () => {
  it("skips blanks and comments", () => {
    const dir = mkdtempSync(join(tmpdir(), "stor1-"));
    const file = join(dir, "mints.txt");
    writeFileSync(
      file,
      "# header\nMintOne111\n\n# another\nMintTwo222\n",
      "utf8",
    );
    expect(loadMintList(file)).toEqual(["MintOne111", "MintTwo222"]);
  });
});

describe("printPlan", () => {
  it("does not throw for purupuru dry-run", () => {
    expect(() =>
      printPlan({
        subcommand: "purupuru-pg",
        version: "v1-test",
        dryRun: true,
      }),
    ).not.toThrow();
  });
});
