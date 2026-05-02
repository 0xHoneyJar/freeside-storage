# Live-Manifest Fixtures

Checked-in snapshots of CDN expression manifests. Used by
`tests/profile.live-manifest.snapshot.test.ts` to verify the `StickerProfile`
Schema round-trips against the canonical substrate today, and to surface drift
when the substrate evolves.

Per SDD §7.4 (composable-sticker-substrate-2026-05-01) and SDD §10.3 A-2 lean.

## Filename convention

```
{world}-current-{YYYY-MM-DD}.json
```

The date suffix is the **day the snapshot was fetched**, not a Schema version.
Multiple dated snapshots may coexist; the test imports the most-recent one.

Examples:
- `mibera-current-2026-05-01.json` — fetched 2026-05-01 from
  `https://assets.0xhoneyjar.xyz/Mibera/expressions/current.json`
- `shadow-current-{YYYY-MM-DD}.json` — Shadow CDN (currently 403's per F-1
  Shadow ops handoff; skip until ops resolves bucket policy)

## Refresh cadence — ON-DEMAND, NOT EVERY-CYCLE

Fixtures are **not** refreshed mechanically every cycle. Per SDD §10.3 A-2:

> Live snapshot is a checked-in fixture; refreshing it is a deliberate act,
> not a CI loop. The staleness IS the refresh signal.

**Refresh trigger** — refresh fixtures only when EITHER:

1. The drift snapshot test goes red AND operator confirms the drift is a
   substrate evolution (not a regression to investigate), OR
2. Operator wants a baseline bump explicitly (e.g. when staging a Schema
   minor bump or before a substrate cutover).

## Refresh procedure

```bash
# 1. Fetch live manifest
curl -sS "https://assets.0xhoneyjar.xyz/Mibera/expressions/current.json" \
  > packages/stickers/tests/fixtures/mibera-current-$(date -u +%Y-%m-%d).json

# 2. Verify well-formed JSON
jq . packages/stickers/tests/fixtures/mibera-current-$(date -u +%Y-%m-%d).json

# 3. Diff against prior snapshot (visible drift surface)
diff packages/stickers/tests/fixtures/mibera-current-2026-05-01.json \
     packages/stickers/tests/fixtures/mibera-current-$(date -u +%Y-%m-%d).json

# 4. Commit with operator-approved PR body that names the drift
```

Old snapshots may be retained for a few cycles to enable historical drift
analysis, then deleted when the audit trail no longer needs them.

## R-7 risk acknowledgment

Per PRD §7.2 and SDD §10.3 A-2, R-7 risk: *"Live-manifest fixture goes
stale."* Probability Med · Impact Low · Mitigation: date-suffixed filename
convention surfaces staleness mechanically; refresh is operator-gated, not
auto. **Stale fixture is by design — staleness IS a refresh signal.**

## Doctrine cite

Operationalizes [[migration-tail-as-bug-source]] — the fixture is the
listening primitive. When the live manifest evolves, the snapshot test goes
red BEFORE consumers see broken stickers. The fixture catches drift in CI
rather than in production.
