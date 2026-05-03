# INTENT — why freeside-storage exists

Operator framing 2026-04-28 late:

> *"score is module, ruggy is module, and metadata or any future modules that we create for free side should be understood as easy to install."*
>
> *"freeside ruggy already good to go. stub metadata (or file system that can be cleanly managed)."*
>
> *"It's connected with this https://github.com/0xHoneyJar/loa-freeside/issues/167 and another file system issue eileen made. we should probably name it something like filesystem or something."*

## The renames

Originally scaffolded as `freeside-metadata`. Renamed to `freeside-filesystem` 2026-04-28 late after operator review surfaced that:
1. `metadata` is too narrow — the friction is broader
2. [`loa-freeside#167`](https://github.com/0xHoneyJar/loa-freeside/issues/167) names the same substrate concern with the static-asset CDN framing (Honey Road 502MB music)
3. Eileen has filed adjacent file-system issues

Renamed again to `freeside-storage` 2026-04-29 during Sprint 1 of the `mature-freeside-operator-and-cutover` cycle. The triggering reframe: the URL contract (`assets.0xhoneyjar.xyz/{world}/{category}/{...}`) and the StorageAdapter interface (`packages/protocol/StorageAdapter.ts`) both speak in *storage* primitives (object keys, byte-level ops, presigned URLs), not *filesystem* primitives (paths, directories, mode bits). The module's siblings (`freeside-worlds`, `freeside-score`, `freeside-ruggy`) all name a storage-shaped concern; `freeside-storage` matches that family naming and closes the abstraction. See ADR-001 in this repo.

## Why this module exists

Recent friction the org hit:

- **Honey Road 502MB Docker build**: docker build hung 37+ minutes copying music + archetype images. Ad-hoc fix: `.dockerignore public/music`. Music URLs 404 at runtime. Filed as [#167](https://github.com/0xHoneyJar/loa-freeside/issues/167).
- **Irys gateway death 2026-04-27**: tokenURI resolver stopped working when metadata gateway died. Recovery required ad-hoc re-hosting + per-consumer re-coding.
- **Cross-collection metadata duplication**: each NFT collection (Honeycomb, Henlo, Mibera, future) reimplements its own JSON serving + CDN strategy.
- **File-system layout drift**: per-token JSON file naming + directory shape diverges between collections.
- **No agent surface for metadata queries**: ruggy's persona-bot can't ask "what trait does token #12345 have" without bespoke per-collection HTTP fetches.

Each wants a shared sealed contract. This repo is where that contract goes.

## Scope candidates (NOT yet locked)

The parallel `metadata-module-placement` design session will determine what's in/out. Strong candidates:

- **Metadata format schemas** — per-collection JSON shape, with branded types for traits/attributes
- **Storage layout convention** — file-naming + directory structure that survives gateway swaps (Arweave / IPFS / S3 mirrors should round-trip)
- **Retrieval API contract** — how consumers ask for token metadata; standardized over multiple backends
- **Static-asset CDN config** — the schema + terraform-module-input pattern from [#167](https://github.com/0xHoneyJar/loa-freeside/issues/167) (S3 + CloudFront per-world bucket, allowed_extensions, custom domain)
- **MCP tool specs** — agent-callable surface for metadata + asset queries
- **CLI** — `freeside-fs` helper for collection authors to validate + publish + mirror + sync to S3

## What's deferred to design

- Whether this module owns rendering (probably no — that's per-world)
- Whether this module owns tokenURI on-chain logic (probably no — that's per-contract)
- Whether the storage convention is opinionated (one canonical layout) or flexible (multiple supported layouts)
- How the module integrates with existing collections (which mirror first?)
- Whether terraform modules live here (the schema) or in loa-freeside (the actual provisioning) or both with cross-reference

## Why STUB now

Per [[freeside-modules-as-installables]]: design with module boundaries from day 1; let extraction follow when it earns the cycles. The repo exists; the content waits for the parallel design session to land OR the next 502MB-friction event.

If the metadata-module-placement design decides this module isn't the right home for some concerns (e.g., rendering belongs in `freeside-worlds` instead), the stub re-shapes accordingly — no content has accumulated to fight about.

## Promotion triggers (codified · cycle 001 phase 4)

Stub-to-foundation promotion happens when **EITHER** trigger fires. Each has an observable signal so a future tender doesn't have to re-derive when promotion is earned.

### Trigger A · Design crystallization

The parallel `metadata-module-placement` design session lands sufficient signal:
- `StorageAdapter` interface stabilizes (read/write/list/sign/expire methods, pluggable typed clients)
- URL contract for sovereign metadata serving freezes (per [[metadata-as-integration-contract]])
- Per-pattern layout templates are named (NFT collection layout, per-world music layout, per-Door asset bundles)

Observable signal: `~/bonfire/grimoires/bonfire/context/metadata-module-placement.md` (or successor) reaches a "design locked" state with the three pieces above. The stub locks via cycle.

### Trigger B · Friction reaches a second instance

An operator hits a 502MB-music-style wall a SECOND time on a different collection or world. The first instance was Honey Road ([loa-freeside#167](https://github.com/0xHoneyJar/loa-freeside/issues/167)). The second instance — whichever world it is — is the signal that ad-hoc fixes have stopped scaling.

Observable signal: an operator surfaces some variant of *"this collection's metadata serving is broken because [...]"* AND the fix would benefit ≥2 worlds going forward. Not the first instance — the **second**.

### Either trigger is sufficient

Whichever fires first owns the cycle that promotes the stub to foundation. Cycle scope: extract the relevant pieces from `loa-freeside`, instantiate the package layout per `docs/ADR-001-package-layout.md`, document the cutover in `docs/INTEGRATION-PATH.md`, ship.

Codified during ecosystem-health cycle 001 (TEND mode · phase 4 clarification gap ④). See [[constructs-ecosystem-health-cycle]] for cycle context.

## Reference

- Sister kickoff: `~/bonfire/grimoires/bonfire/context/metadata-module-placement.md`
- Doctrine: [[freeside-modules-as-installables]]
- Friction source: [`loa-freeside#167`](https://github.com/0xHoneyJar/loa-freeside/issues/167) (static-asset CDN as Freeside Component)
- Recent friction: Irys gateway death incident in `~/bonfire/grimoires/bonfire/context/freeside-migration-queue-2026-04-19.md`
