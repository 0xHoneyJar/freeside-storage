/**
 * Behavioral tests for the REAL `assumeRoleAdapter` (Icebreaker-found gap).
 *
 * Before this file, NO test exercised `crossAccount.ts` — a cross-account STS
 * AssumeRole trust boundary shipped unasserted. These tests mock ONLY the AWS
 * STS boundary (`@aws-sdk/client-sts`) and assert that the helper builds the
 * right AssumeRoleCommand, honors duration/externalId, returns a ready
 * `S3Adapter` from the temp credentials, and — the load-bearing SECURITY
 * assertion — FAILS CLOSED when STS returns incomplete credentials. The
 * helper under test is never substituted.
 *
 * Hermetic — NO live AWS, NO network. Run scoped to this package:
 *   pnpm vitest run --root packages/adapters/s3
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted so the `vi.mock` factory (which runs before imports) captures the
// same mock fn the tests configure.
const { stsSendMock } = vi.hoisted(() => ({ stsSendMock: vi.fn() }));

// Replace ONLY the STSClient transport; keep the REAL `AssumeRoleCommand` so
// `command instanceof AssumeRoleCommand` and `command.input` work as the SDK
// intends. Every `sts.send(...)` the helper issues lands on `stsSendMock`.
vi.mock("@aws-sdk/client-sts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-sts")>();
  return {
    ...actual,
    STSClient: class {
      send(command: unknown) {
        return stsSendMock(command);
      }
    },
  };
});

import { AssumeRoleCommand } from "@aws-sdk/client-sts";
import { assumeRoleAdapter, type AssumeRoleAdapterOptions } from "../src/crossAccount.js";
import { S3Adapter } from "../src/S3Adapter.js";

const OPTS: AssumeRoleAdapterOptions = {
  roleArn: "arn:aws:iam::999999999999:role/foreign-assets",
  bucket: "foreign-account-bucket",
  region: "us-east-1",
  sessionName: "icebreaker-crossaccount-test",
};

const FULL_CREDS = {
  Credentials: {
    AccessKeyId: "ASIAEXAMPLE",
    SecretAccessKey: "secret-example",
    SessionToken: "session-token-example",
    Expiration: new Date("2030-01-01T00:00:00Z"),
  },
};

beforeEach(() => {
  stsSendMock.mockReset();
});

describe("assumeRoleAdapter", () => {
  it("issues a single AssumeRoleCommand with the role, session, and default 1h duration", async () => {
    stsSendMock.mockResolvedValue(FULL_CREDS);
    await assumeRoleAdapter(OPTS);
    expect(stsSendMock).toHaveBeenCalledTimes(1);
    const command = stsSendMock.mock.calls[0][0];
    expect(command).toBeInstanceOf(AssumeRoleCommand);
    expect(command.input).toMatchObject({
      RoleArn: OPTS.roleArn,
      RoleSessionName: OPTS.sessionName,
      DurationSeconds: 3600,
    });
  });

  it("honors a custom durationSeconds and externalId (trust-policy constraint)", async () => {
    stsSendMock.mockResolvedValue(FULL_CREDS);
    await assumeRoleAdapter({ ...OPTS, durationSeconds: 900, externalId: "ext-id-42" });
    const command = stsSendMock.mock.calls[0][0];
    expect(command.input).toMatchObject({ DurationSeconds: 900, ExternalId: "ext-id-42" });
  });

  it("returns a ready S3Adapter built from the temporary credentials", async () => {
    stsSendMock.mockResolvedValue(FULL_CREDS);
    const adapter = await assumeRoleAdapter(OPTS);
    expect(adapter).toBeInstanceOf(S3Adapter);
  });

  // The SECURITY assertion that was missing: the helper must FAIL CLOSED — never
  // hand back an adapter built on partial/empty credentials.
  it.each([
    ["AccessKeyId", { SecretAccessKey: "s", SessionToken: "t" }],
    ["SecretAccessKey", { AccessKeyId: "a", SessionToken: "t" }],
    ["SessionToken", { AccessKeyId: "a", SecretAccessKey: "s" }],
    ["the whole Credentials object", undefined],
  ])("throws (fail-closed) when STS omits %s", async (_missing, creds) => {
    stsSendMock.mockResolvedValue({ Credentials: creds });
    await expect(assumeRoleAdapter(OPTS)).rejects.toThrow(/did not return full credentials/);
    expect(stsSendMock).toHaveBeenCalledTimes(1);
  });
});
