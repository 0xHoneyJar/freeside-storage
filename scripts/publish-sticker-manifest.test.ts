import { describe, expect, it } from "vitest";
import {
  buildManifest,
  parseArgs,
  s3UploadCommand,
  type Args,
} from "./publish-sticker-manifest.js";

const baseArgv = [
  "--collection",
  "Shadow",
  "--version",
  "v1",
  "--token-count",
  "3219",
  "--expression-count",
  "7",
];

describe("parseArgs", () => {
  it("parses minimal valid Shadow args", () => {
    const args = parseArgs(baseArgv);
    expect(args.collection).toBe("Shadow");
    expect(args.version).toBe("v1");
    expect(args.tokenCount).toBe(3219);
    expect(args.expressionCount).toBe(7);
    expect(args.variants).toEqual(["transparent"]); // default
    expect(args.defaultVariant).toBe("transparent"); // defaults to first variant
    expect(args.skippedTokenIds).toEqual([]);
    expect(args.output).toBe("./out/Mibera-Shadow-current.json"); // default
  });

  it("parses MST collection", () => {
    const args = parseArgs([
      "--collection",
      "MST",
      "--version",
      "v1",
      "--token-count",
      "3219",
      "--expression-count",
      "7",
    ]);
    expect(args.collection).toBe("MST");
    expect(args.output).toBe("./out/Mibera-MST-current.json");
  });

  it("parses comma-separated variants and skipped ids", () => {
    const args = parseArgs([
      ...baseArgv,
      "--variants",
      "transparent,opaque,light",
      "--default-variant",
      "opaque",
      "--skipped-token-ids",
      "0,42,100",
    ]);
    expect(args.variants).toEqual(["transparent", "opaque", "light"]);
    expect(args.defaultVariant).toBe("opaque");
    expect(args.skippedTokenIds).toEqual([0, 42, 100]);
  });

  it.each([
    [["--collection", "Tarot", "--version", "v1", "--token-count", "1", "--expression-count", "1"], "collection"],
    [["--collection", "Shadow", "--version", "1.0", "--token-count", "1", "--expression-count", "1"], "version"],
    [["--collection", "Shadow", "--version", "v1", "--token-count", "0", "--expression-count", "1"], "token-count"],
    [["--collection", "Shadow", "--version", "v1", "--token-count", "1", "--expression-count", "0"], "expression-count"],
    [["--collection", "Shadow", "--version", "v1", "--token-count", "1.5", "--expression-count", "1"], "token-count"],
  ])("rejects bad arg vector", (argv, _label) => {
    expect(() => parseArgs(argv)).toThrowError();
  });

  it("rejects defaultVariant not in variants", () => {
    expect(() =>
      parseArgs([
        ...baseArgv,
        "--variants",
        "transparent,opaque",
        "--default-variant",
        "neon",
      ]),
    ).toThrowError(/default-variant.*not in.*variants/);
  });

  it("rejects negative skipped token ids", () => {
    expect(() =>
      parseArgs([...baseArgv, "--skipped-token-ids", "0,-1,2"]),
    ).toThrowError(/non-negative/);
  });
});

describe("buildManifest", () => {
  const args: Args = {
    collection: "Shadow",
    version: "v1",
    tokenCount: 3219,
    expressionCount: 7,
    variants: ["transparent"],
    defaultVariant: "transparent",
    skippedTokenIds: [42, 0, 100],
    output: "./out/x.json",
  };

  it("produces all required GlobalManifest fields", () => {
    const m = buildManifest(args);
    expect(m.version).toBe("v1");
    expect(m.tokenCount).toBe(3219);
    expect(m.expressionCount).toBe(7);
    expect(m.variants).toEqual(["transparent"]);
    expect(m.defaultVariant).toBe("transparent");
    expect(m.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("sorts skippedTokenIds ascending", () => {
    const m = buildManifest(args);
    expect(m.skippedTokenIds).toEqual([0, 42, 100]);
  });

  it("does not mutate the input args.skippedTokenIds", () => {
    const before = [...args.skippedTokenIds];
    buildManifest(args);
    expect(args.skippedTokenIds).toEqual(before);
  });
});

describe("s3UploadCommand", () => {
  it("composes the canonical S3 path under Mibera/{SubCollection}/", () => {
    const args: Args = {
      collection: "Shadow",
      version: "v1",
      tokenCount: 3219,
      expressionCount: 7,
      variants: ["transparent"],
      defaultVariant: "transparent",
      skippedTokenIds: [],
      output: "./out/x.json",
    };
    const cmd = s3UploadCommand(args, "/tmp/local.json");
    expect(cmd).toContain("/tmp/local.json");
    expect(cmd).toContain(
      "s3://thj-assets/Mibera/Shadow/expressions/current.json",
    );
    expect(cmd).toContain("--profile admin");
    expect(cmd).toContain("--content-type application/json");
  });

  it("uses MST in the path for MST collection", () => {
    const args: Args = {
      collection: "MST",
      version: "v1",
      tokenCount: 3219,
      expressionCount: 7,
      variants: ["transparent"],
      defaultVariant: "transparent",
      skippedTokenIds: [],
      output: "./out/x.json",
    };
    const cmd = s3UploadCommand(args, "/tmp/local.json");
    expect(cmd).toContain(
      "s3://thj-assets/Mibera/MST/expressions/current.json",
    );
  });
});
