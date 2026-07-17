# ACCEPT-STORAGE — Owner acceptance

| Field | Value |
|---|---|
| Task | `ACCEPT-STORAGE` (collection-report-coordinator-f09.55) |
| Repository | `0xHoneyJar/storage-api` (GitHub canonical name; the legacy `0xHoneyJar/freeside-storage` remote and local `freeside-storage` checkout resolve to this same repository) |
| Repository alias evidence | `gh pr view 28 -R 0xHoneyJar/freeside-storage --json url` → `https://github.com/0xHoneyJar/storage-api/pull/28`; pushes to the legacy remote emit GitHub's moved-repository notice naming `https://github.com/0xHoneyJar/storage-api.git` |
| Branch | `coord/collection-report-coordinator-f09.55` |
| Acceptance transport | PR #28; the immutable artifact revision is the Git commit carrying this file (`git log -1 --format=%H -- grimoires/loa/coordination/collection-report/owner-acceptance.md`). The SHA is intentionally not embedded in its own contents because doing so would be self-referential. |
| Audited baseline | `origin/main` @ `99bd9bc` (`ci(storage-api): stand up CI — typecheck + test (#25)`) |
| Coordinator snapshot | `collection-report-coordinator` @ `f3b1b8ed616836c586545bceb5618507bc0f4e14` |
| PRD master | coordinator snapshot path `grimoires/loa/prd.md`, v0.3 (`sha256:4866ca1ccb580e7743a6f3523e73249d4ade13b0931424df1be782f644247f0c`) |
| SDD master | coordinator snapshot path `grimoires/loa/sdd.md`, v0.5 (`sha256:255ec5874f944b9c255ba7d9b58d1abe073c1989aded55a39483b23d73cd0f09`) |
| Sprint master | coordinator snapshot path `grimoires/loa/sprint.md`, v0.6 (`sha256:682368e29051309c4d0c16e457a14127f207f9824b58ac75138f96fcbb1ed04e`) |
| Date | 2026-07-16 |
| Author role | freeside-storage maintainer (boundary owner) |
| **Verdict** | **conditional** |

This document is owner acceptance under sprint §13. It does **not** authorize
CR implementation, issue creation, push, PR, or merge.
The verdict applies only to the audited repository baseline and immutable
coordinator snapshot above. A material change to a cited master reopens the
affected conditions; only a later dispatch-referenced revision of this file
that names the prior artifact commit and pins its replacement inputs may
supersede this verdict.

---

## 1. Verdict

**conditional** — Storage accepts its assigned collection-report boundary and
the SDD contracts it must eventually satisfy, and acknowledges that
`origin/main` today is a **public sovereign-metadata / asset substrate**, not
the restricted Key Index + restore-quarantine system required for Gate Leak
artifacts.

| Lane | Status | Meaning |
|---|---|---|
| Public metadata / URL contract / versioned ingest (existing charter) | acknowledged | May continue under normal Loa gates; not Gate Leak restricted release |
| CR-010 participant (`artifact_manifest.v1` receipts) | conditional | Accept participation only after shared protocol ratifies CR-010 |
| CR-014 Deletion-aware Key Index | **blocked for issue-ready** | No Key Index, tombstone log, KMS custody, or restore quarantine on main |
| CR-405 Optional metadata snapshot capability | deferred / conditional | STOR-1-class snapshots exist as design+scripts; rights/proxy/mirror/excluded policy and pointer-flip owner are not closed for report capability |

Unestimated Key Index / HSM / restore chaos capacity remains **not issue-ready**
per sprint §6 (“unestimated is blocked”).

---

## 2. Interfaces (produce / consume)

### 2.1 Present on `origin/main` (acknowledged)

| Interface | Location | Version / notes |
|---|---|---|
| `MetadataDocument` (+ `MetadataImage` union, `medium_capabilities?`) | `packages/protocol/src/metadata-document.ts` | v1.3–v1.4 additive surface |
| `URL_CONTRACT` / sovereign hosts | `packages/protocol/src/url-contract.ts` | `metadata.0xhoneyjar.xyz`, `assets.0xhoneyjar.xyz` |
| `StorageAdapter` port | `packages/protocol/src/StorageAdapter.ts` | put/get/list/sync/verifyParity |
| `ingestCollectionMetadata` | `packages/storage-client/src/ingest.ts` | Versioned S3 layout `{world}/{collection}/metadata/v/{version}/{tokenId}.json`; KV pointer flip is **out of module** |
| `ingestAssets` / CDN mirror | `packages/storage-client/src/ingest-assets.ts` | Byte-identical skip; not rights policy |
| Asset-pipeline `AssetService` | `packages/asset-pipeline` | Consumer-label `:v<N>` cache rollback (ADR-13) — **not** Key Index rollback |
| BeaconV3 identity | `packages/protocol/beacon.yaml` | Declares public metadata substrate; explicitly not ownership/indexing |
| STOR-1 external snapshot design | `grimoires/loa/specs/external-collection-metadata-onboarding.md` + `scripts/snapshot-external-collection.ts` | One-time onboard snapshots; kitchen `metadata_snapshot` hook is future |

### 2.2 Required by collection-report masters — **absent on main**

| Interface | Owner expectation (SDD / CR-014 / CR-010) | Main evidence |
|---|---|---|
| Deletion-aware Key Index | AES-256-GCM-SIV bundles; create-if-absent on `(artifact_attempt_id, row_id, canonical_plaintext_digest)`; AAD binds order/artifact/attempt/row/schema/digest | **None** (no matches for Key Index, GCM-SIV, erasure handle, tombstone watermark) |
| Key Index replication + tombstone-aware backups | Online deletion-aware replicas; log-based availability backups; never restore DEKs from artifact backups | **None** |
| Restore quarantine | Restore → replay tombstones through snapshot watermark → verify Key Index + manifest deletions → only then enable proxy/workers | **None** |
| `artifact_manifest.v1` receipts / provisional objects | Storage receipts for hierarchical manifests; provisional namespace; orphan sweeper | **None** as restricted-artifact API |
| Restricted retention workers | ≤30-day restricted evidence/rows; tombstone ≤60s; erasure ≤15m (V1 objectives) | **None** |
| Rights-aware snapshot policy (CR-405) | Explicit `proxy` \| `mirror` \| `excluded`; named source + pointer-flip owner; no third-party art rehosted by inference | **Not closed** — ingest can write any validated `MetadataDocument`; no policy enum gate |

Storage will consume ratified shared-protocol schemas from `loa-freeside` (CR-009 /
CR-010) and will not fork Ordering schemas by hand.

---

## 3. Authority boundaries

### 3.1 Storage owns

- Byte-addressable object layout, sovereign metadata documents, URL contract,
  and adapter ports for public asset/metadata serving.
- Future: deletion-aware Key Index custody boundary, Storage receipts for
  hierarchical manifests, provisional-object lifecycle, restore quarantine
  gate for Key Index replicas (CR-014 + CR-010 participant).
- Future (only after CR-002 and a versioned CR-403 Go): rights-gated
  `metadata_snapshot` capability separate from ownership indexing (CR-405).

### 3.2 Storage does **not** own / must not infer

| Forbidden | Authority |
|---|---|
| Collection recognition, chain qualification, ownership truth | Sonar / Inventory |
| Report order lifecycle, disclosure ledger, artifact availability CAS | Ordering |
| Identity links, opaque erasure-handle minting from Discord IDs, consent | Identity API |
| Gate mapping / Discord snapshots / disclosure bands | Shadow Audit + privacy owner (CR-015) |
| S3/CloudFront provisioning / CF KV pointer flips as IaC | loa-freeside terraform + operator `flipping-kv-pointer` |
| Treating public RPC or marketplace metadata as rehost license | Explicit rights policy (CR-405) — missing today |
| Stable public URLs for restricted Gate Leak artifacts | Forbidden by SDD; opaque IDs + authenticated proxy only |
| Inferring logical-collection equivalence from metadata bytes | Inventory / Sonar evidence only |

Beacon `is_not` on main already refuses live chain RPC, ownership indexing, and
third-party gateway calls on the live read path — retained.

---

## 4. Bottom-up estimate (capacity / headcount)

Assumptions: one primary maintainer familiar with this repo; shared protocol
fixtures land from loa-freeside; production KMS/HSM is platform-owned (CR-013);
no concurrent world-onboarding fire drill.

| Work | Size | Headcount · calendar | Uncertainty |
|---|---|---|---|
| ACCEPT-STORAGE (this artifact) | S | 0.5 eng-day | Low |
| CR-010 participant: receipt + provisional object adapter against ratified schema | M | 1 eng · ~1–1.5 weeks after CR-010 fixtures | Medium — schema churn |
| CR-014 Key Index service + deletion-aware replication + restore quarantine + chaos suite | L / Critical | 1–2 eng · **4–7 weeks** after CR-007B + CR-013 KMS posture + CR-010 | **High** — no existing crypto/index code; HSM ops unknown |
| CR-015 participation (field matrix / deletion participant rows only) | S–M | 0.5 eng · ~3 days | Medium — privacy owner leads |
| CR-405 rights policy + snapshot capability + pointer-flip contract | L | 1 eng · **2–4 weeks** after CR-002 and CR-403 Go | High — legal/rights evidence |
| Ongoing ops for Key Index (on-call, restore game days, key compromise) | steady | 0.2–0.4 FTE after G1B-4 | High until first game day |

**Capacity statement for public substrate (current main):** hermetic unit tests +
CI typecheck/test; network tests gated. No Key Index QPS, tombstone SLO, or
50k-row manifest receipt load proof exists — those are release-gate fixtures
Storage must still design under CR-014.

**Issue-ready rule:** CR-014 remains blocked until a revised estimate binds
named KMS/HSM owner, replica regions, and restore-chaos owners (platform +
Storage).

---

## 5. Mixed-version / flags / deploy / rollback

### 5.1 Acknowledged from SDD §16.6 / §17

Storage is a named cell in the mixed-version matrix:

- New manifest roots/pages read by **old Storage** must remain provisional and
  must not fulfill until complete-verification is supported.
- Expand → deploy → constrain; rollback allowed until all readers support the
  constrained schema.
- Restricted flags (`collection_report_restricted_enabled`,
  `collection_report_restricted_rows_enabled`) are **server-evaluated** in
  Ordering/Dashboard — Storage must fail closed when contracts/keys are missing,
  not invent client flags inside adapters.

### 5.2 What main actually provides today

| Mechanism | Behavior | Fits restricted Key Index? |
|---|---|---|
| Metadata `v/{version}/` + CF KV pointer | Operator flip forward/back without overwriting bytes | Public metadata only |
| Asset-pipeline consumerLabel `:v<N>` | Cache namespace rollback (ADR-13); anti-pattern = Lambda feature flags | Public assets only |
| Feature flags for Gate Leak | **Not present** in this repo | N/A |

### 5.3 Rollback limits (accepted)

- **Public metadata:** roll KV pointer to prior version; do not delete prior
  version folders casually; no silent overwrite of immutable version keys.
- **Restricted Key Index (future):** no break-glass serve across tombstone gap;
  rollback of application code must not re-enable proxy reads from a
  pre-erasure backup; restore always enters quarantine first (SDD §11).
- **In-flight Gate Leak orders:** Storage rollback must preserve receipts and
  key references already handed to Ordering; orphan sweeper stays idempotent.

Deploy position: Storage Key Index / restricted writers deploy **after**
CR-013 key custody and **with** CR-010 fixtures; never ahead of Ordering
tombstone watermark consumers.

---

## 6. Ops ownership

| Concern | Owner | Current state on main |
|---|---|---|
| Public metadata ingest scripts / version publish | freeside-storage maintainer (@zkSoju CODEOWNERS) | Scripts + client exist; operator runs |
| CF KV pointer flip / CDN IaC | loa-freeside platform + operator | Out of this repo (acknowledged) |
| Key Index availability, replica lag, tombstone watermark | freeside-storage (future) + platform KMS | **Missing** |
| Restore quarantine game days / pre-erasure restore chaos | freeside-storage + privacy/security | **Missing** |
| Deletion receipt inbox / overdue erasure paging | Ordering saga + Storage participant | **Missing** here |
| Safe disablement of restricted artifact writes | Platform flag + Storage fail-closed | **Missing** Storage switch |
| Rights / rehost incidents on snapshots | Storage + Inventory + legal/rights (CR-405) | Informal STOR-1 only |
| Alerts for public CDN/metadata 5xx | Existing world ops (not codified in this repo) | No collection-report runbook |

Storage accepts future ownership of Key Index / restore / deletion-participant
ops **only after** CR-014 lands with a written runbook (detect → disable writes →
quarantine restore → resume). Until then, ops ownership for restricted artifacts
is **unassigned in this repository**.

During that gap, restricted writes remain forbidden. If restricted material is
suspected in the public substrate, containment is scoped as follows:

1. Stop the suspected writer and quarantine the affected objects or prefixes.
2. Stop every read and write against those affected objects or prefixes, and
   stop every restricted-artifact path, while escalating to the Freeside
   privacy/security owner and loa-freeside operations/coordinator owners.
3. Public metadata reads outside the affected prefixes may continue only after
   responders verify that credentials, caches, pointer flips, and CDN behavior
   do not extend the suspected blast radius. Otherwise fail closed at the
   broader shared boundary.
4. Resume a named scope only after those authorities record that the source is
   contained, the affected set is enumerated and quarantined, relevant keys are
   rotated, caches/pointers are invalidated where applicable, and the written
   disposition explicitly names the paths permitted to resume.

This is a fail-closed escalation rule, not a claim that a production
collection-report on-call rotation already exists.

---

## 7. Evidence (audit of `origin/main` @ `99bd9bc`)

Commands and observations used for this acceptance (worktree =
`coord/collection-report-coordinator-f09.55`, aligned with `origin/main`):

1. **Baseline:** `git rev-parse origin/main` → `99bd9bc1e0cd697cd68498acd04d4747432cc835`.
2. **Deletion-aware Key Index:** ripgrep over `packages/`, `docs/`, `grimoires/`,
   `scripts/` for `key index`, `tombstone`, `restore quarantine`, `AES-256-GCM`,
   `GCM-SIV`, `artifact_manifest`, erasure/DEK terms → **no substantive hits**
   (only incidental `indexOf` / license “rights”).
3. **Public substrate present:** `MetadataDocument`, `ingestCollectionMetadata`,
   asset-pipeline, S3 adapter, STOR-1 spec + snapshot script, CI workflow
   (build → typecheck → hermetic test).
4. **Rights boundary:** SDD §19.3 states mirroring cannot be automatic because
   rehosting rights are explicit; main ingest has **no** `proxy|mirror|excluded`
   policy gate. STOR-1 prefers leaving image URLs on source hosts for some
   collections but does not encode a rights decision type.
5. **Restore / rollback:** versioned metadata + KV flip and ADR-13 label rollback
   only; no restore-quarantine path.
6. **Capacity / ops:** no Key Index SLO dashboards or deletion runbooks in-repo;
   beacon + README still describe a storage substrate that grew past “stub” for
   public metadata but not for restricted erasure.
7. **Coordinator mapping:** task-manifest assigns Storage
   `ACCEPT-STORAGE`, `CR-014`, `CR-405`; sprint §12 names Storage maintainer for
   CR-010 participant + CR-014.

The negative audit above is reproducible from this repository checkout. It
searches all tracked repository text at the audited baseline (`-I` skips binary
files) without generated, vendor, or path exclusions:

```bash
BASE=99bd9bc1e0cd697cd68498acd04d4747432cc835
git cat-file -e "$BASE^{commit}"

git grep -I -n -i -E \
  '(key[ _-]?index|tombstone|restore[ _-]?quarantine|AES-256-GCM|GCM-SIV|artifact_manifest|erasure|(^|[^[:alnum:]_])DEK([^[:alnum:]_]|$))' \
  "$BASE" -- .

git ls-tree -r --name-only "$BASE" \
  | wc -l \
  | tr -d ' '
```

Observed on 2026-07-17: the repository-wide search covered `979` tracked files
and produced exactly one lexical hit:

```text
99bd9bc1e0cd697cd68498acd04d4747432cc835:.claude/protocols/beads-integration.md:49:| Delete | `br delete <id>` | Tombstone (soft delete) |
```

That hit documents Beads issue deletion and is not a restricted-storage
tombstone, Key Index, restore quarantine, encryption, manifest, or erasure
implementation. No substantive restricted-storage hit was found anywhere in
tracked repository text at the audited baseline. Reproduce coordinator master
digests from a checkout of `collection-report-coordinator` with:

```bash
COORD=f3b1b8ed616836c586545bceb5618507bc0f4e14
for artifact_path in grimoires/loa/prd.md grimoires/loa/sdd.md grimoires/loa/sprint.md
do
  git show "$COORD:$artifact_path" | shasum -a 256
done
```

Masters cross-check: SDD §14.4 — no mandatory resolver change in first slice;
restricted release **does** require Key Index + restore quarantine; CR-405
requires CR-002 and a versioned CR-403 Go, followed by explicit
rights/source/pointer-flip ownership.

---

## 8. Unresolved closure conditions

ACCEPT-STORAGE stays **conditional** (and CR-014/CR-405 stay non-issue-ready)
until each item below is closed or explicitly waived by the coordinator +
privacy/platform owners:

1. **G-1 Discord viability Go** (CR-000) — No-go stops restricted branch; Storage
   then drops CR-014 from the Gate Leak critical path without failing public
   T0/T1. CR-405 activation remains a separate CR-002 + CR-403 decision and
   cannot be inferred from G-1.
2. **CR-007B** retention/deletion policy ratified (Storage as deletion
   participant named in matrix).
3. **CR-010** `artifact_manifest.v1` fixtures published; Storage receipt shape
   frozen without coupling to Key Index ops.
4. **CR-013** production KMS/HSM custody, registry distribution, and deploy
   posture for Key Index material — named platform owner + Storage consumer
   contract.
5. **CR-014 design spike** in this repo (or linked ADR): Key Index schema,
   replica topology, tombstone log, restore quarantine state machine, chaos
   matrix, and the construction and lifecycle of
   `canonical_plaintext_digest`. The design must prove that every retained
   index, AAD field, commitment, receipt, log, and backup derivative preserves
   retry/divergence detection without enabling offline enumeration or recovery
   of erased low-entropy row data after the row's erasure. It must specify
   deletion, retention, and restore behavior for that digest before choosing a
   cryptographic construction; the SDD's separately keyed row commitment does
   not by itself answer this digest's lifecycle — then **re-estimate**
   headcount.
6. **CR-015** disclosure/deletion matrix lists every Storage-held field.
7. **Restore chaos owners** scheduled: pre-erasure restore, replica loss,
   regional failover, lost deletion receipt (SDD §11).
8. **CR-405** (only after CR-002 and a versioned CR-403 Go): written rights
   policy enum, source authority, pointer-flip owner, and “no inferred rehost”
   audit — separate from STOR-1 manual onboarding. G-1 remains a separate gate:
   if the snapshot capability participates in restricted Gate Leak release, the
   restricted branch still requires G-1 Go.
9. **Mixed-version fixtures** including old Storage + new manifests (SDD §16.6)
   attached to release gate G1B-4 / G1B-5.
10. **Ops runbook** for key compromise, safe disablement of restricted writes,
    and restore quarantine — merged before restricted writers deploy.

Public metadata work (URL contract, ingest, STOR-1) is **not** blocked by these
conditions, but must not be marketed as satisfying G1B-4 / G4B / CR-014.

---

## 9. Sign-off and waiver ledger

No coordinator, privacy, or platform sign-off or waiver is recorded by this
revision.

| Condition | Disposition | Authority | Recorded at | Evidence |
|---|---|---|---|---|
| All §8 conditions | Open; no waiver | Not recorded | — | — |

A condition changes state only through a dated row naming the coordinator and
the required privacy/platform authority with immutable evidence. Updating this
ledger does not itself authorize implementation or production release; any
verdict change also requires a superseding dispatch-referenced revision under
the header rule above.

---

## 10. Advisory local validation (this dispatch)

Performed locally at immutable commit
`48606296ddc0967f5833a8c70dda965fe5eef0d3` (branch
`coord/collection-report-coordinator-f09.55`) at `2026-07-16T22:15:39Z`,
using Node `v22.23.1` and pnpm `9.0.0`, after
`pnpm install --frozen-lockfile --ignore-scripts`:

- `pnpm build` → exit `0`
- `pnpm typecheck` → exit `0`
- `pnpm test` → exit `0` (`36` files passed; `394` tests passed, `4` skipped;
  network tests unset)
- Structural check: this file exists at
  `grimoires/loa/coordination/collection-report/owner-acceptance.md` with
  verdict ∈ {accepted, conditional, blocked} and required sections.

The relationship between that validation commit and reviewed PR head
`123206622cebfd8f157e5a6cbea177f178da03ec` is git-verifiable, rather than
inferred from the branch name. These commands were run at `2026-07-17T01:01:24Z`
with the reviewed head named explicitly rather than through mutable `HEAD`:

```bash
VALIDATED=48606296ddc0967f5833a8c70dda965fe5eef0d3
REVIEW_HEAD=123206622cebfd8f157e5a6cbea177f178da03ec
git cat-file -e "$VALIDATED^{commit}"
git merge-base --is-ancestor "$VALIDATED" "$REVIEW_HEAD"
git merge-base "$VALIDATED" "$REVIEW_HEAD"
git diff --quiet "$VALIDATED..$REVIEW_HEAD" -- \
  . ':(exclude)grimoires/loa/coordination/collection-report/owner-acceptance.md'
git diff --check "$VALIDATED..$REVIEW_HEAD"
git rev-list --count "$VALIDATED..$REVIEW_HEAD"
git diff --name-only "$VALIDATED..$REVIEW_HEAD"
```

Observed results: the `cat-file`, ancestry, non-document diff, and `diff-check`
commands exited `0`; `git merge-base` printed
`48606296ddc0967f5833a8c70dda965fe5eef0d3`; the revision count was `7`; and the
only changed path was
`grimoires/loa/coordination/collection-report/owner-acceptance.md`. This proves
that executable source at reviewed head `123206622cebfd8f157e5a6cbea177f178da03ec`
was byte-for-byte identical to the validated commit while checking that exact
reviewed document delta for whitespace errors.

This follow-up evidence revision is intentionally **not** presented as
self-validation of its own eventual commit hash. It records observed results
for the immutable reviewed head above and only changes this acceptance
document. It does not claim that later evidence-only revisions reran the
product test suite or validated themselves.

This was a local validation run, not a CI run; no CI URL or immutable external
log is claimed. It is advisory baseline-health context only and is **not**
acceptance evidence for any closure condition, owner attestation, merge, or
production decision. The exact commands, timestamp, toolchain, and result above
are provided solely as a reproduction recipe; durable validation evidence must
come from a commit-referenced CI run or immutable log artifact.

No CR code was implemented. This acceptance document is committed and pushed
through PR #28 for review; it does not authorize downstream CR implementation,
merge, or production release.

---

## 11. Strongest caveat

**Audited baseline `99bd9bc1e0cd697cd68498acd04d4747432cc835` has no
deletion-aware Key Index, restricted-storage tombstone watermark, or restore
quarantine whatsoever** — Gate Leak restricted-artifact acceptance cannot be
honestly treated as “ready to schedule CR-014” until crypto custody, replica
deletion awareness, and restore chaos are designed and estimated; public
metadata versioning on main is not a substitute.
