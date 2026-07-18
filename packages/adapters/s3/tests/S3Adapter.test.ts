/**
 * Behavioral tests for the REAL `S3Adapter` (Icebreaker-found gap).
 *
 * Before this file, NO test exercised `S3Adapter`'s own behavior — callers
 * (ingest.ts etc.) test against an in-memory fake adapter, never the S3
 * implementation. These tests mock ONLY the AWS SDK boundary
 * (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`) and assert that the
 * adapter builds the right commands, decodes responses, and follows its own
 * guard / parity / sync logic. The S3Adapter under test is never substituted.
 *
 * Hermetic — NO live AWS, NO network. Run scoped to this package:
 *   pnpm vitest run --root packages/adapters/s3
 */

import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ListResult,
  ParityReport,
  StorageAdapter,
  StorageKey,
  StorageObject,
  SyncResult,
} from "@0xhoneyjar/freeside-protocol";

// Hoisted so the `vi.mock` factories (which run before imports) can capture
// the same mock fns the tests configure.
const { sendMock, getSignedUrlMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  getSignedUrlMock: vi.fn(),
}));

// Replace ONLY the S3Client transport; keep the REAL command classes so that
// `command instanceof PutObjectCommand` and `command.input` work as the SDK
// intends. Every `s3.send(...)` the adapter issues lands on `sendMock`.
vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  return {
    ...actual,
    S3Client: class {
      send = sendMock;
    },
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: getSignedUrlMock,
}));

import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { S3Adapter } from "../src/S3Adapter.js";

const BUCKET = "thj-assets";

function makeAdapter(): S3Adapter {
  // No cloudFrontClient override: constructing the real CloudFrontClient is
  // network-free (credentials resolve lazily on send, which we never call).
  return new S3Adapter({ bucket: BUCKET, region: "us-west-2" });
}

/** First command sent to the mocked S3 transport. */
function firstCommand(): { input: Record<string, unknown> } & object {
  return sendMock.mock.calls[0]?.[0];
}

/**
 * Minimal in-memory source adapter for `sync`/`verifyParity`. It is NOT an
 * `S3Adapter`, so the adapter's `headOnAdapter` falls back to `get()` — which
 * is exactly the cross-adapter path we want to exercise.
 */
class FakeSource implements StorageAdapter {
  constructor(private readonly objects: Map<string, StorageObject>) {}

  private flat(k: StorageKey): string {
    return k.path ? `${k.tenant}/${k.path}` : k.tenant;
  }

  async put(): Promise<void> {
    throw new Error("FakeSource.put not used");
  }

  async get(key: StorageKey): Promise<StorageObject> {
    const found = this.objects.get(this.flat(key));
    if (!found) {
      const err = new Error("NoSuchKey") as Error & { name: string };
      err.name = "NoSuchKey";
      throw err;
    }
    return found;
  }

  async list(tenant: string): Promise<ListResult> {
    const keys = [...this.objects.values()]
      .map((o) => o.key)
      .filter((k) => k.tenant === tenant);
    return { keys };
  }

  async sync(): Promise<SyncResult> {
    throw new Error("FakeSource.sync not used");
  }

  async verifyParity(): Promise<ParityReport> {
    throw new Error("FakeSource.verifyParity not used");
  }
}

function notFound(): Error {
  const err = new Error("NotFound") as Error & {
    name: string;
    $metadata?: { httpStatusCode?: number };
  };
  err.name = "NotFound";
  err.$metadata = { httpStatusCode: 404 };
  return err;
}

beforeEach(() => {
  sendMock.mockReset();
  getSignedUrlMock.mockReset();
});

describe("S3Adapter.put", () => {
  it("sends a PutObjectCommand with the configured bucket + flattened key + body + contentType", async () => {
    sendMock.mockResolvedValue({});
    const adapter = makeAdapter();
    const obj: StorageObject = {
      key: { tenant: "Mibera", path: "generated/0.webp" },
      contentType: "image/webp",
      bytes: Buffer.from("payload-bytes"),
      etag: "",
      lastModified: new Date(),
    };

    await adapter.put(obj);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const cmd = firstCommand();
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    expect(cmd.input).toMatchObject({
      Bucket: BUCKET,
      Key: "Mibera/generated/0.webp",
      Body: obj.bytes,
      ContentType: "image/webp",
    });
  });

  it("flattens a tenant-only key (empty path) to the bare tenant", async () => {
    sendMock.mockResolvedValue({});
    const adapter = makeAdapter();

    await adapter.put({
      key: { tenant: "Mibera", path: "" },
      contentType: "application/json",
      bytes: Buffer.from("{}"),
      etag: "",
      lastModified: new Date(),
    });

    expect(firstCommand().input).toMatchObject({ Key: "Mibera" });
  });
});

describe("S3Adapter.get", () => {
  it("round-trips bytes + metadata, stripping quotes from the ETag", async () => {
    const adapter = makeAdapter();
    sendMock.mockResolvedValue({
      Body: Readable.from([Buffer.from("RESTORED-payload")]),
      ContentType: "image/webp",
      ETag: '"abc123"',
      LastModified: new Date("2026-01-02T03:04:05Z"),
    });

    const result = await adapter.get({
      tenant: "Mibera",
      path: "generated/7.webp",
    });

    const cmd = firstCommand();
    expect(cmd).toBeInstanceOf(GetObjectCommand);
    expect(cmd.input).toMatchObject({
      Bucket: BUCKET,
      Key: "Mibera/generated/7.webp",
    });
    expect(result.bytes.toString("utf8")).toBe("RESTORED-payload");
    expect(result.contentType).toBe("image/webp");
    expect(result.etag).toBe("abc123"); // surrounding quotes stripped
    expect(result.lastModified).toEqual(new Date("2026-01-02T03:04:05Z"));
    expect(result.key).toEqual({ tenant: "Mibera", path: "generated/7.webp" });
  });

  it("throws the explicit guard error when GetObject returns no body", async () => {
    const adapter = makeAdapter();
    sendMock.mockResolvedValue({}); // SDK returned no Body

    await expect(
      adapter.get({ tenant: "Mibera", path: "missing.webp" }),
    ).rejects.toThrow(
      /S3 GetObject returned no body for thj-assets\/Mibera\/missing\.webp/,
    );
  });

  it("defaults contentType + etag when the SDK omits them", async () => {
    const adapter = makeAdapter();
    sendMock.mockResolvedValue({
      Body: Readable.from([Buffer.from("x")]),
    });

    const result = await adapter.get({ tenant: "Mibera", path: "a.bin" });

    expect(result.contentType).toBe("application/octet-stream");
    expect(result.etag).toBe("");
    expect(result.lastModified).toBeInstanceOf(Date);
  });
});

describe("S3Adapter.presignedURL", () => {
  it("returns the URL produced by the presigner for a GetObjectCommand", async () => {
    const adapter = makeAdapter();
    getSignedUrlMock.mockResolvedValue(
      "https://signed.example/Mibera/0.webp?sig=xyz",
    );

    const url = await adapter.presignedURL(
      { tenant: "Mibera", path: "0.webp" },
      900,
    );

    expect(url).toBe("https://signed.example/Mibera/0.webp?sig=xyz");
    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
    const [, command, opts] = getSignedUrlMock.mock.calls[0];
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect((command as { input: Record<string, unknown> }).input).toMatchObject({
      Bucket: BUCKET,
      Key: "Mibera/0.webp",
    });
    expect(opts).toEqual({ expiresIn: 900 });
  });
});

describe("S3Adapter.list", () => {
  it("sends ListObjectsV2 with the tenant prefix and maps Contents to StorageKeys", async () => {
    const adapter = makeAdapter();
    sendMock.mockResolvedValue({
      Contents: [
        { Key: "Mibera/generated/0.webp", LastModified: new Date("2026-01-01") },
        { Key: "Mibera/generated/1.webp", LastModified: new Date("2026-02-01") },
        { Key: undefined }, // dropped — no Key
      ],
      NextContinuationToken: "TOKEN-2",
    });

    const res = await adapter.list("Mibera", {
      limit: 50,
      continuationToken: "TOKEN-1",
    });

    const cmd = firstCommand();
    expect(cmd).toBeInstanceOf(ListObjectsV2Command);
    expect(cmd.input).toMatchObject({
      Bucket: BUCKET,
      Prefix: "Mibera/",
      MaxKeys: 50,
      ContinuationToken: "TOKEN-1",
    });
    expect(res.keys).toEqual([
      { tenant: "Mibera", path: "generated/0.webp" },
      { tenant: "Mibera", path: "generated/1.webp" },
    ]);
    expect(res.nextContinuationToken).toBe("TOKEN-2");
  });

  it("applies the `since` filter, excluding objects modified before it", async () => {
    const adapter = makeAdapter();
    sendMock.mockResolvedValue({
      Contents: [
        { Key: "Mibera/old.webp", LastModified: new Date("2026-01-01") },
        { Key: "Mibera/new.webp", LastModified: new Date("2026-03-01") },
      ],
    });

    const res = await adapter.list("Mibera", {
      since: new Date("2026-02-01"),
    });

    expect(res.keys).toEqual([{ tenant: "Mibera", path: "new.webp" }]);
    expect(res.nextContinuationToken).toBeUndefined();
  });
});

describe("S3Adapter.verifyParity", () => {
  const key: StorageKey = { tenant: "Mibera", path: "0.webp" };

  function sourceWithEtag(etag: string): FakeSource {
    return new FakeSource(
      new Map([
        [
          "Mibera/0.webp",
          {
            key,
            contentType: "image/webp",
            bytes: Buffer.from("a"),
            etag,
            lastModified: new Date(),
          },
        ],
      ]),
    );
  }

  it("reports `identical` when the target HEAD etag matches the source", async () => {
    const source = sourceWithEtag("same-etag");
    const adapter = makeAdapter();
    sendMock.mockImplementation(async (command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        return { ETag: '"same-etag"', LastModified: new Date() };
      }
      throw new Error(`unexpected command ${(command as object).constructor.name}`);
    });

    const report = await adapter.verifyParity(source, {
      samplePerTenant: 10,
      tenants: ["Mibera"],
    });

    expect(report.variant).toBe("identical");
    expect(report.sampledKeys).toBe(1);
    expect(report.identical).toBe(1);
  });

  it("reports `drift` when the target HEAD etag differs from the source", async () => {
    const source = sourceWithEtag("src-etag");
    const adapter = makeAdapter();
    sendMock.mockImplementation(async (command: unknown) => {
      if (command instanceof HeadObjectCommand) return { ETag: '"tgt-etag"' };
      throw new Error(`unexpected command ${(command as object).constructor.name}`);
    });

    const report = await adapter.verifyParity(source, {
      samplePerTenant: 10,
      tenants: ["Mibera"],
    });

    expect(report.variant).toBe("drift");
    if (report.variant === "drift") {
      expect(report.drifted).toEqual([
        { key, sourceEtag: "src-etag", targetEtag: "tgt-etag" },
      ]);
    }
  });

  it("reports `missing` from target when the target HEAD 404s (exercises tryHead's 404→null path)", async () => {
    const source = sourceWithEtag("src-etag");
    const adapter = makeAdapter();
    sendMock.mockImplementation(async (command: unknown) => {
      if (command instanceof HeadObjectCommand) throw notFound();
      throw new Error(`unexpected command ${(command as object).constructor.name}`);
    });

    const report = await adapter.verifyParity(source, {
      samplePerTenant: 10,
      tenants: ["Mibera"],
    });

    expect(report.variant).toBe("missing");
    if (report.variant === "missing") {
      expect(report.missing).toEqual([{ key, missingFrom: "target" }]);
    }
  });
});

describe("S3Adapter.sync", () => {
  const key: StorageKey = { tenant: "Mibera", path: "0.webp" };

  function sourceWith(etag: string): FakeSource {
    return new FakeSource(
      new Map([
        [
          "Mibera/0.webp",
          {
            key,
            contentType: "image/webp",
            bytes: Buffer.from("payload"),
            etag,
            lastModified: new Date(),
          },
        ],
      ]),
    );
  }

  it("copies a source key absent from the target (HEAD 404 → PUT) and reports success", async () => {
    const source = sourceWith("src-etag");
    const adapter = makeAdapter();
    const putInputs: Record<string, unknown>[] = [];
    sendMock.mockImplementation(async (command: unknown) => {
      if (command instanceof HeadObjectCommand) throw notFound(); // not in target
      if (command instanceof PutObjectCommand) {
        putInputs.push(command.input as Record<string, unknown>);
        return {};
      }
      throw new Error(`unexpected command ${(command as object).constructor.name}`);
    });

    const result = await adapter.sync(source, { tenants: ["Mibera"] });

    expect(result.variant).toBe("success");
    expect(result.keysSynced).toBe(1);
    expect(result.keysSkipped).toBe(0);
    expect(putInputs).toHaveLength(1);
    expect(putInputs[0]).toMatchObject({
      Bucket: BUCKET,
      Key: "Mibera/0.webp",
      Body: Buffer.from("payload"),
      ContentType: "image/webp",
    });
  });

  it("skips a key whose target etag already matches the source (no PUT issued)", async () => {
    const source = sourceWith("same");
    const adapter = makeAdapter();
    let puts = 0;
    sendMock.mockImplementation(async (command: unknown) => {
      if (command instanceof HeadObjectCommand) return { ETag: '"same"' };
      if (command instanceof PutObjectCommand) {
        puts += 1;
        return {};
      }
      throw new Error(`unexpected command ${(command as object).constructor.name}`);
    });

    const result = await adapter.sync(source, { tenants: ["Mibera"] });

    expect(result.variant).toBe("success");
    expect(result.keysSkipped).toBe(1);
    expect(result.keysSynced).toBe(0);
    expect(puts).toBe(0); // etag short-circuit fires before any write
  });
});
