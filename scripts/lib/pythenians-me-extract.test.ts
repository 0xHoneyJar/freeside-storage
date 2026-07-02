import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import {
  appendCheckpoint,
  extractPytheniansFromMe,
  loadCheckpointMints,
  meTokenToDocument,
} from "./pythenians-me-extract.js";

describe("meTokenToDocument", () => {
  it("requires image field", () => {
    expect(meTokenToDocument("Mint111", { name: "Pythenians #1" })).toBeNull();
    expect(
      meTokenToDocument("Mint111", {
        image: "https://ipfs.pythenians.xyz/nft/a.png",
      })?.image,
    ).toBe("https://ipfs.pythenians.xyz/nft/a.png");
  });
});

describe("checkpoint jsonl", () => {
  it("loads done mints and appends resume rows", () => {
    const dir = mkdtempSync(join(tmpdir(), "stor1-checkpoint-"));
    const path = join(dir, "checkpoint.jsonl");
    appendCheckpoint(path, "MintDone111");
    expect(loadCheckpointMints(path)).toEqual(new Set(["MintDone111"]));
    expect(readFileSync(path, "utf8")).toContain("MintDone111");
  });
});

describe("extractPytheniansFromMe", () => {
  it("fetches mints with injected fetch and records checkpoint", async () => {
    const dir = mkdtempSync(join(tmpdir(), "stor1-me-"));
    const checkpointPath = join(dir, "checkpoint.jsonl");
    const mints = ["MintA111", "MintB222"];

    const fetchImpl = async (input: RequestInfo | URL) => {
      const mint = String(input).split("/").pop()!;
      return new Response(
        JSON.stringify({
          name: `Pythenians ${mint.slice(-3)}`,
          image: `https://ipfs.pythenians.xyz/nft/${mint}.png`,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const first = await extractPytheniansFromMe({
      mints,
      concurrency: 2,
      checkpointPath,
      fetchImpl,
    });
    expect(first.items).toHaveLength(2);
    expect(first.failed).toEqual([]);

    const second = await extractPytheniansFromMe({
      mints,
      concurrency: 2,
      checkpointPath,
      fetchImpl: async () => {
        throw new Error("should not refetch completed mints");
      },
    });
    expect(second.skipped).toBe(2);
    expect(second.items).toHaveLength(0);
  });
});
