---
title: External collection metadata onboarding (STOR-1)
task: STOR-1
master_issue: 0xHoneyJar/inventory-api#19
coord_cycle: member-pfp-2026-07
status: design (spec landed; ingest + CF routes pending)
date: 2026-07-01
---

# External collection metadata onboarding

**Goal:** One-time snapshot of pythenians + purupuru token metadata into the sovereign manifest pattern at `metadata.0xhoneyjar.xyz`, unblocking inventory-api INV-3 and dashboard member avatars (DASH-1).

**Out of scope for STOR-1:** Live per-request Magic Eden / DAS calls, on-chain `tokenURI` flips, sonar ownership indexing (INV-2), dashboard BFF wiring (DASH-1).

---

## Architecture (belt model)

```
┌─────────────────────┐     ┌──────────────────────────┐     ┌─────────────────────┐
│ Source systems      │     │ storage-api (this cell)   │     │ Consumers           │
│                     │     │                           │     │                     │
│ purupuru Railway PG │──┐  │ snapshot scripts          │     │ inventory-api       │
│ puru_wallet_holdings│  │  │   → MetadataDocument[]    │──►  │   fetchSovereign…   │
│ puru_token_genesis  │  ├─►│   → ingestCollection…     │     │ freeside-dashboard  │
│                     │  │  │   → S3 thj-assets         │     │   getProfilePicture │
│ pythenians ME API   │──┘  │ CF Function + KV pointer  │     │                     │
│ (one-time mint list)│     │ metadata.0xhoneyjar.xyz   │     │                     │
└─────────────────────┘     └──────────────────────────┘     └─────────────────────┘
         ▲                              ▲
         │                              │
   sonar belt (ownership SoT)    metadata SoT (this task)
   NEVER use ME/DAS owner field
```

**Invariants (from member-pfp SDD):**

1. **Ownership** always from sonar — not ME/DAS `owner` (staked/listing escrow).
2. **SVM wallets** — base58 verbatim; never lowercase.
3. **Metadata** — snapshot at onboard time; no ME/DAS on dashboard request path.

---

## Existing sovereign manifest patterns (Mibera reference)

Discovered in this repo (`packages/storage-client`, `packages/protocol`):

| Layer | Artifact | Role |
|-------|----------|------|
| **URL contract** | `packages/protocol/src/url-contract.ts` | `METADATA_HOST = metadata.0xhoneyjar.xyz`; assets host separate from metadata host |
| **Payload schema** | `packages/protocol/src/metadata-document.ts` | `MetadataDocument`: `{ name, description, image, attributes?, … }` |
| **URL builder** | `packages/storage-client/src/client.ts` | `lookupSovereignManifest({ world, collection?, tokenId })` — today `SovereignWorldSlug = "mibera"` only |
| **Live routes (shipped)** | audit script + tests | `mibera/{N}`, `mibera/mst/{N}` (+ tarot/gif/candies gated) |
| **S3 layout (seam contract)** | upstream `ingestCollectionMetadata` in `freeside-storage` | `{world}/{collection}/metadata/v/{version}/{tokenId}.json` in `thj-assets` |
| **Edge routing** | loa-freeside terraform + CF Function | Public URL `/{world}/[{collection}/]{tokenId}` → KV version pointer → versioned S3 key |

**Mibera cutover recipe (distill target):**

1. Build `MetadataDocument` per token from authoritative source (codex / PG / API snapshot).
2. PUT versioned JSON to S3 (`ingestCollectionMetadata` or equivalent).
3. Flip CF KV pointer for `{world}/{collection}` (operator act — `flipping-kv-pointer` skill).
4. Extend URL contract + `SovereignWorldSlug` union when world goes live.
5. Verify with `scripts/audit-metadata-v140-additivity.ts`-style sampling.

**Gap for STOR-1:** This checkout (`storage-api`) does not yet ship `packages/storage-client/src/ingest.ts`. The generic ingest abstraction exists on upstream `freeside-storage` main — port or cherry-pick before running production snapshots.

---

## URL contract — external worlds (INV-3 alignment)

inventory-api `collection-registry.ts` already declares target routes (hermetic tests):

| Collection | World slug | Collection slug | Token key | Example URL |
|------------|------------|-----------------|-----------|-------------|
| Pythenians (SVM) | `pythenians` | `pythians` | mint (base58) | `https://metadata.0xhoneyjar.xyz/pythenians/pythians/{mint}` |
| Purupuru (EVM Base) | `purupuru` | `genesis` | numeric tokenId | `https://metadata.0xhoneyjar.xyz/purupuru/genesis/{tokenId}` |

**Shape:** Same three-segment pattern as Mibera siblings (`mibera/mst/{N}`):

```
https://metadata.0xhoneyjar.xyz/{world}/{collection}/{tokenId}
```

**S3 keys (mirror Mibera seam):**

```
s3://thj-assets/pythenians/pythians/metadata/v/{version}/{mint}.json
s3://thj-assets/purupuru/genesis/metadata/v/{version}/{tokenId}.json
```

**URL contract bump (follow-up sprint, not STOR-1 spec-only):**

- Extend `SovereignWorldSlug` in `packages/storage-client/src/client.ts` with `"pythenians" | "purupuru"`.
- Add migration phase `external-world-sovereign` in `url-contract.ts` with affected routes above.
- CF Function dispatch table must register both worlds (loa-freeside infra).

**Token ID rules:**

- **Pythenians:** mint address string (base58, case-sensitive). Path segment = raw mint, URL-encoded.
- **Purupuru:** ERC-721 tokenId as decimal string (`"1"` … `"29"` today; schema allows growth).

---

## Snapshot pipeline design

### Phase 0 — Preconditions

- [ ] Operator confirms Railway PG read creds for purupuru tables (or score-api DB URL with read-only role).
- [ ] Mint inventory for pythenians: sonar `svm.collection_nft` snapshot OR static mint list export (~3682 rows).
- [ ] Choose version label: `v1-2026-07-01` (immutable; new onboard = new version folder + KV flip).

### Phase 1 — Extract → normalize

Unified intermediate shape (NDJSON or SQLite staging):

```json
{
  "world": "pythenians",
  "collection": "pythians",
  "tokenId": "<mint>",
  "document": {
    "name": "Pythenians #3180",
    "description": "Pythenians genesis NFT",
    "image": "https://ipfs.pythenians.xyz/nft/<hash>.png",
    "attributes": []
  }
}
```

Each row MUST validate against `MetadataDocument` before ingest.

### Phase 2 — Publish (S3)

Call `ingestCollectionMetadata(adapter, { world, collection, version, items })` (upstream API):

- Idempotent: byte-identical re-run → `skipped`.
- Per-item errors isolated; batch continues.
- Output manifest: `{ written, skipped, errored, results[] }`.

Stub entrypoint: `scripts/snapshot-external-collection.ts` (this repo).

### Phase 3 — Edge pointer flip (operator)

Separate from ingest (KRANZ Act 4):

1. HEAD-sample N random public URLs → expect 403/404 pre-flip.
2. KV PUT `{world}/{collection}` → `{version}` with `--if-match`.
3. Re-sample → expect 200 + valid JSON.

### Phase 4 — Consumer verification

- inventory-api hermetic fixtures → live fetch against new URLs.
- Dashboard smoke: `getProfilePicture(wallet, collection)` non-null for known holders.

---

## Purupuru PG import procedure

**Source:** Railway Postgres (purupuru world app DB). Tables verified live (~31k join rows per inventory-api#19 triage):

| Table | Join key | Fields used |
|-------|----------|-------------|
| `puru_wallet_holdings` | `token_id`, `wallet` | ownership context (not written to manifest; sonar owns holdings) |
| `puru_token_genesis` | `token_id` | `image_url`, genesis metadata |

**SQL (read-only export):**

```sql
SELECT
  g.token_id,
  g.image_url,
  g.genesis_element,
  g.heavenly_stem_name
FROM puru_token_genesis g
WHERE g.image_url IS NOT NULL
  AND g.image_url <> '';
```

**Document mapping:**

| MetadataDocument field | Source |
|------------------------|--------|
| `name` | `` `Purupuru #${token_id}` `` |
| `description` | `` `Purupuru genesis · ${genesis_element}` `` (or static flavor) |
| `image` | `image_url` verbatim (IPFS gateway or CDN — immutable) |
| `attributes` | optional: `Element`, `Heavenly Stem` from genesis columns |

**Parameters:**

- `world`: `purupuru`
- `collection`: `genesis`
- `tokenId`: `token_id` as string
- EVM contract (consumer): `0x6CfB9280767a3596Ee6af887D900014a755ffc75` (Base 8453) — not embedded in manifest path

**Env:** `PURUPURU_DATABASE_URL` (read-only). Never commit credentials.

---

## Pythenians ME snapshot procedure

**Why one-time:** Art is immutable; ME returns stable `image` URLs on `ipfs.pythenians.xyz` with hash-based filenames. Per-mint resolution is required once, not per dashboard request.

**Mint list source (preferred order):**

1. Sonar export: `SELECT nft_mint, name FROM svm.collection_nft WHERE collection_key = 'pythians'`
2. Fallback: static file from operator (`mints.txt`, one base58 per line)

**API:**

```
GET https://api-mainnet.magiceden.dev/v2/tokens/{mint}
```

**Rate limiting:** Concurrency 4–8, exponential backoff on 429, resume from checkpoint file.

**Document mapping:**

| Field | ME JSON path |
|-------|----------------|
| `name` | `name` or `` `Pythenians #${rank}` `` |
| `description` | `description` or default genesis copy |
| `image` | `image` (must resolve to `ipfs.pythenians.xyz/...`) |
| `attributes` | map `attributes[]` if present |

**Parameters:**

- `world`: `pythenians`
- `collection`: `pythians` (legacy sonar key — intentional; matches inventory registry)
- `tokenId`: mint address (NOT rank integer)

**Checkpoint:** Write `out/pythenians/checkpoint.jsonl` during run so interrupted snapshots resume without re-fetching completed mints.

---

## Kitchen ingredient hook — `metadata_snapshot` (future)

**Context:** score-api issue #378 — Kitchen upstream `lookup` + `register` for community contracts. Today registers `community_registry` + `community_tracked_contracts` only.

**Proposal:** Add optional post-register ingredient **`metadata_snapshot`** to the community-onboarding preset:

```yaml
# ordering-service / kitchen preset (conceptual)
ingredients:
  - id: contract_register          # shipped (#378)
  - id: sonar_index                # sonar-api kitchen routes
  - id: metadata_snapshot          # NEW — triggers storage-api snapshot
    params:
      world_slug: "{{ world_slug }}"
      collection_slug: "{{ metadata_slug }}"
      source: "pg | magiceden | codex"
      source_ref: "{{ connection_string | mint_list_url }}"
```

**Hook surface (score-api → storage-api):**

| Step | Actor | Action |
|------|-------|--------|
| 1 | ordering-service | POST `/kitchen/advance-ingredient` with `ingredient=metadata_snapshot` |
| 2 | score-api (or storage-api worker) | Enqueue snapshot job `{ chainId, contract, world, collection, source }` |
| 3 | storage-api | Run extract → ingest → emit `{ version, written, errored }` |
| 4 | loa-freeside operator | KV flip when `errored === 0` (or policy threshold) |
| 5 | kitchen | Mark ingredient complete → unlock downstream (inventory register) |

**Idempotency:** Re-register same contract → ingest skips byte-identical docs.

**V1 shortcut (member-pfp):** Manual operator run of snapshot scripts for pythenians + purupuru; kitchen hook documents the target seam without blocking Zerker.

---

## Acceptance criteria (full STOR-1 implementation sprint)

1. Pythenians: ≥3680 manifests at `metadata.0xhoneyjar.xyz/pythenians/pythians/{mint}` return 200 + `MetadataDocument`.
2. Purupuru: all genesis tokens with `image_url` served at `…/purupuru/genesis/{tokenId}`.
3. inventory-api live `getNftsForOwner` resolves non-empty `imageUrl` for fixture wallets.
4. No runtime ME/DAS dependency in inventory-api or dashboard hot path.
5. URL contract + `SovereignWorldSlug` extended; audit script covers new worlds (sample mode).

---

## Recommended implementation steps

| Step | Owner | Work |
|------|-------|------|
| 1 | storage-api | Port `ingestCollectionMetadata` from upstream `freeside-storage` into `packages/storage-client/src/ingest.ts` + tests |
| 2 | storage-api | Implement `scripts/snapshot-external-collection.ts` subcommands: `purupuru-pg`, `pythenians-me` |
| 3 | operator | Run purupuru PG export against Railway; dry-run ingest to staging prefix |
| 4 | operator | Run pythenians ME snapshot with checkpoint; validate image host allowlist |
| 5 | loa-freeside | CF Function + KV entries for `pythenians/pythians`, `purupuru/genesis` |
| 6 | storage-api | Bump URL contract v1.5.0 — external worlds + migration phase |
| 7 | storage-api | Extend `lookupSovereignManifest` world union + client tests |
| 8 | inventory-api | INV-3: wire live fetch (already designed in `sovereign-metadata.ts`) |
| 9 | score-api | (Future) Kitchen `metadata_snapshot` ingredient + job queue |

---

## References

- `member-pfp-coordinator/grimoires/loa/sdd.md` — cross-repo task graph
- `inventory-api/src/collection-registry.ts` — world/slug registry
- `inventory-api/src/sovereign-metadata.ts` — 3-arg URL builder (already supports external worlds)
- `packages/storage-client/src/client.ts` — Mibera-only world slug today
- `packages/protocol/src/metadata-document.ts` — payload contract
- `scripts/audit-metadata-v140-additivity.ts` — post-publish validation pattern
- `freeside-storage/packages/storage-client/src/ingest.ts` — ingest seam (upstream)
- `score-api/src/lib/community/community-kitchen.ts` — kitchen register (#378)
- `sonar-api/grimoires/loa/specs/2026-06-23-svm-pythians-collection-design.md` — ownership pipe (not metadata)
