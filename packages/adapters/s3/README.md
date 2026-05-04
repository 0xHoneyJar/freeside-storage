# @freeside-storage/adapters-s3

S3 implementation of [`@0xhoneyjar/freeside-protocol`'s](../../protocol/README.md)
`StorageAdapter` interface, plus S3-specific extensions (`presignedURL`,
`setACL`, `invalidateCDN`) as escape hatches.

## Install

```bash
pnpm add @freeside-storage/adapters-s3
```

## Usage

```typescript
import { S3Adapter } from '@freeside-storage/adapters-s3';

const adapter = new S3Adapter({
  bucket: 'thj-assets',
  region: 'us-west-2',
  // optional: credentials override (defaults to AWS SDK chain)
});

// Common surface (StorageAdapter)
const obj = await adapter.get({ tenant: 'Mibera', path: 'generated/0.webp' });
const list = await adapter.list('Mibera', { limit: 100 });
const sync = await adapter.sync(otherAdapter, { tenants: ['Mibera'] });
const parity = await adapter.verifyParity(otherAdapter, { samplePerTenant: 10 });

// S3-specific extensions (escape hatches; not part of common contract)
const url = await adapter.presignedURL(key, 300);                       // 5min
await adapter.setACL(key, 'private');
await adapter.invalidateCDN('E1HF4XT1MLU2G4', ['/Mibera/*']);
```

## Cross-account assumed-role

`crossAccount.ts` exposes a helper for the cross-account assumed-role pattern
(L9 in SDD §0). Sprint 1 of `mature-freeside-operator-and-cutover` does NOT
need cross-account access (per Amendment 3 — single account, single bucket),
but the helper ships for future cycles that DO need it (e.g., pre-prod / prod
isolation, mibera-2/3/4 cycles per SDD §0.2).

```typescript
import { S3Adapter, assumeRoleAdapter } from '@freeside-storage/adapters-s3';

const sourceAdapter = await assumeRoleAdapter({
  roleArn: 'arn:aws:iam::OTHER_ACCOUNT:role/freeside-storage-readonly',
  bucket: 'legacy-bucket',
  region: 'us-west-2',
  sessionName: 'mirror-sync-2026-04-29',
});
```

## Status

Lean instance-1 per [ADR-001](../../../docs/ADR-001-package-layout.md). Cycle-1
ships interface implementation only; LocalStack integration tests are deferred
to a follow-up batch.
