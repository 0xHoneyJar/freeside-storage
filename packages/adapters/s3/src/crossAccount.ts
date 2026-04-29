/**
 * Cross-account assumed-role helper for `@freeside-storage/adapters-s3`.
 *
 * Per SDD §0 L9 (and L8 for the secrets/CLI seam): cycle-1 of
 * `mature-freeside-operator-and-cutover` does NOT need cross-account access
 * (Amendment 3 — single account, single backing bucket). The helper ships
 * for FUTURE cycles that DO need it:
 *
 *   - Mibera-2/3/4 (per SDD §0.2 — re-host external sources to assets bucket)
 *   - Multi-account deploys (pre-prod / prod isolation)
 *   - Operator-side parity sampling against a foreign-account legacy bucket
 *
 * Implementation note: STS assume-role returns short-lived credentials that
 * the AWS SDK v3 can refresh automatically via a credential provider. We use
 * `@aws-sdk/client-sts`'s `AssumeRoleCommand` once and feed the returned
 * credentials into the S3 client. For long-running jobs that need refresh,
 * callers should compose `fromTemporaryCredentials` from
 * `@aws-sdk/credential-providers` instead.
 */
import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';

import { S3Adapter, type S3AdapterConfig } from './S3Adapter.js';

export interface AssumeRoleAdapterOptions {
  /** Target role ARN (in the foreign account) */
  roleArn: string;
  /** Bucket name in the foreign account */
  bucket: string;
  /** Region of the foreign-account bucket */
  region: string;
  /** Session name for STS audit trail */
  sessionName: string;
  /** Optional session duration in seconds (default: 3600 = 1h) */
  durationSeconds?: number;
  /** Optional external ID required by the trust policy of the target role */
  externalId?: string;
}

/**
 * Build an `S3Adapter` whose underlying S3 client uses credentials acquired
 * via STS AssumeRole. Returns the adapter ready to use.
 *
 * For sessions longer than the AssumeRole duration, callers should manage
 * refresh externally (e.g., via `@aws-sdk/credential-providers`'
 * `fromTemporaryCredentials`).
 */
export async function assumeRoleAdapter(
  opts: AssumeRoleAdapterOptions,
): Promise<S3Adapter> {
  const sts = new STSClient({ region: opts.region });
  const result = await sts.send(
    new AssumeRoleCommand({
      RoleArn: opts.roleArn,
      RoleSessionName: opts.sessionName,
      DurationSeconds: opts.durationSeconds ?? 3600,
      ExternalId: opts.externalId,
    }),
  );

  const creds = result.Credentials;
  if (!creds?.AccessKeyId || !creds.SecretAccessKey || !creds.SessionToken) {
    throw new Error(
      `STS AssumeRole did not return full credentials for ${opts.roleArn}`,
    );
  }

  const config: S3AdapterConfig = {
    bucket: opts.bucket,
    region: opts.region,
    credentials: {
      accessKeyId: creds.AccessKeyId,
      secretAccessKey: creds.SecretAccessKey,
      sessionToken: creds.SessionToken,
    },
  };

  return new S3Adapter(config);
}
