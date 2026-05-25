@.claude/loa/CLAUDE.loa.md

# freeside-storage — agent instructions

> **Loa mounted** 2026-05-25 (cluster-meta remediation Tier-2 per [ADR-009 D-4 in `loa-freeside`](https://github.com/0xHoneyJar/loa-freeside/blob/feat/identity-api/decisions/009-freeside-hexagonal-federation.md)). System Zone (`.claude/`) is **COPY-STYLE mounted** — full `cp -R` of the canonical Loa template from `~/Documents/GitHub/score-api/.claude/` (with `cache/` removed); 9.2M of fully-tracked content. State Zone (`grimoires/`, `.beads/`, `.run/`) is local. Mount provenance: see `.loa-version.json` (`mount_mode: "copy"`).

## Cell topology (hexagonal federation)

`freeside-storage` is a **storage substrate cell** in the freeside hexagonal federation. Authority-of-record for the federation contract lives in `loa-freeside`.

- **Consumes**: raw blob backends (S3 / CloudFront / IPFS adapters in `packages/adapters/`)
- **Publishes**: asset metadata + tokenURI-shaped JSON via `packages/storage-client` and `packages/asset-pipeline`
- **Plane spread** (orthogonal to building boundary, per loa-freeside ADR-008 §D-8):
  - **Contract**: `packages/protocol/` (single schema vocabulary — same convention as `freeside-worlds` and `freeside-score`)
  - **Construct**: `packages/storage-client/`, `packages/asset-pipeline/`, `packages/stickers/`
  - **Execution**: `packages/adapters/*`

## Tooling

| Tool | Use for |
|------|---------|
| `br` (beads_rust ≥ 0.2.11) | Task graph — `br create`, `br ready`, `br update`, `br close`, `br sync` |
| `ck` (seek) | Code search — `ck "pattern" packages/` (NOT grep/rg) |
| `pnpm` (workspace manager, NOT bun) | `pnpm install --frozen-lockfile`, `pnpm -r typecheck`, `pnpm test` |
| `vitest` | Test runner (configured via `vitest.workspace.ts`) |

## Loa cycle gates for runtime changes

Any change to `packages/**/src/**` or test files MUST flow through the normal Loa cycle: `/plan-and-analyze` → `/architect` → `/sprint-plan` → `/run sprint-N` (which wraps implement + review + audit). Cosmetic/copy fixes ≤ 3 files may use creative-latitude micro-fix per the framework rules.

Do NOT directly invoke `/implement` outside of `/run sprint-N` or a `/bug` triage handoff — that bypasses the review + audit gates.

---

> Below: original pre-Loa CLAUDE.md content (preserved verbatim from Apr 29, 2026).

## Module charter (pre-Loa, 2026-04-29)

This is a freeside-* attachment module: **file storage layout + static-asset CDN + NFT metadata serving + retrieval API**. **Stub today** — full content lands when the parallel `metadata-module-placement` design session resolves OR when the next 502MB-music-style friction surfaces.

Renamed twice: `freeside-metadata` → `freeside-filesystem` (2026-04-28 late) → `freeside-storage` (2026-04-29 — final canonical name; sovereign asset-surface framing per Sprint 1 of `mature-freeside-operator-and-cutover` cycle). Closes [`loa-freeside#167`](https://github.com/0xHoneyJar/loa-freeside/issues/167).

## When loaded

Load this CLAUDE.md when:
- Operator works on NFT metadata schemas, file-storage layouts, static-asset CDN configs, or per-token metadata serving
- Operator extends the freeside-* family with file-shape modules
- The parallel `metadata-module-placement` kickoff (historical bonfire context, Apr 2026) advances and lands content here
- The next world hits 502MB-music-style asset friction

## Hard rules

- **STUB until earned**. Don't pre-architect content this repo doesn't yet need. Let real friction (Irys gateway death rerun, cross-collection metadata standardization, big-static-asset Docker build, etc.) drive what lands here.
- **`packages/protocol/` is the single schema vocabulary.** Per [[loa-org-naming-conventions]] — same convention as freeside-worlds and freeside-score.
- **File-system discipline is load-bearing.** Operator-stated 2026-04-28: *"file system that can be cleanly managed"*. Storage layout convention is part of the contract this module owns.
- **Cross-link Issue #167.** This module is the home for the static-asset CDN pattern that issue describes.

## Composition

- `loa-freeside` — does NOT yet own the file-system schemas; some adjacent CDN/static-asset friction lives in [`#167`](https://github.com/0xHoneyJar/loa-freeside/issues/167) and elsewhere
- `freeside-worlds` — sibling module; world manifests can declare compose_with: freeside-storage
- `freeside-ruggy` — consumer (persona-bot fan-out per collection)

## What this repo does NOT own

- Per-collection metadata content (each collection's tokenURI JSON files belong to that collection's repo)
- World-specific renderers (each world's metadata UI lives in that world's app)
- Chain-specific tokenURI implementations (live in mibera-contracts, etc.)
- The actual S3/CloudFront resources (those provision via loa-freeside terraform; this repo provides the schema + module shape)

## References

- Doctrine: `vault/wiki/concepts/freeside-modules-as-installables.md`
- Sister kickoff: `metadata-module-placement` (historical bonfire context; path moved post-rename — verify via `find ~/bonfire -name "metadata-module-placement*"` before relying)
- Sibling: `freeside-worlds/CLAUDE.md`, `freeside-score/CLAUDE.md`
- Friction sources: [`loa-freeside#167`](https://github.com/0xHoneyJar/loa-freeside/issues/167) + Irys gateway death incident `~/bonfire/grimoires/bonfire/context/freeside-migration-queue-2026-04-19.md`
