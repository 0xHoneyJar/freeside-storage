# INTENT — why freeside-metadata exists

Operator framing 2026-04-28 late:

> *"score is module, ruggy is module, and metadata or any future modules that we create for free side should be understood as easy to install."*
>
> *"freeside ruggy already good to go. stub metadata (or file system that can be cleanly managed)."*

This repo's intent is to own the **NFT metadata serving + storage layout** concerns as a freeside-* installable module. It's a stub today; substance lands when the parallel design session (`metadata-module-placement.md`) resolves what specifically belongs.

## The need this addresses

Recent friction the org hit:
- **Irys gateway death 2026-04-27**: `mibera-honeyroad`'s tokenURI resolver stopped working when the metadata gateway went down. Recovery required ad-hoc re-hosting + per-consumer re-coding. No shared module to swap in.
- **Cross-collection metadata duplication**: each NFT collection (Honeycomb, Henlo, Mibera, future) reimplements its own JSON serving + CDN strategy. No shared discipline.
- **File-system layout drift**: per-token JSON file naming + directory shape diverges between collections. Re-hosting requires per-collection work.
- **No agent surface for metadata queries**: ruggy's persona-bot can't ask "what trait does token #12345 have" without bespoke per-collection HTTP fetches.

Each of these wants a shared sealed contract. This repo is where that contract goes.

## Scope candidates (NOT yet locked)

The parallel `metadata-module-placement` design session will determine what's in/out. Strong candidates:

- **Metadata format schemas** — per-collection JSON shape, with branded types for traits/attributes
- **Storage layout convention** — file-naming + directory structure that survives gateway swaps (Arweave / IPFS / S3 mirrors should round-trip)
- **Retrieval API contract** — how consumers ask for token metadata; standardized over multiple backends
- **MCP tool specs** — agent-callable surface for metadata queries
- **CLI** — `freeside-metadata` helper for collection authors to validate + publish + mirror

## What's deferred to the design session

- Whether this module owns rendering (probably no — that's per-world)
- Whether this module owns tokenURI on-chain logic (probably no — that's per-contract)
- Whether the storage convention is opinionated (one canonical layout) or flexible (multiple supported layouts)
- How the module integrates with existing collections (which mirror first?)

## Why STUB now

Per [[freeside-modules-as-installables]]: design with module boundaries from day 1; let extraction follow when it earns the cycles. The repo exists; the content waits for the parallel design session to land.

If the metadata-module-placement design session decides this module isn't the right home for some concerns (e.g., rendering belongs in `freeside-world` instead), the stub re-shapes accordingly — no content has accumulated to fight about.

## Reference

- Sister kickoff: `~/bonfire/grimoires/bonfire/context/metadata-module-placement.md` (existed before this repo; will land content here when its design crystallizes)
- Doctrine: [[freeside-modules-as-installables]]
- Recent friction: Irys gateway death incident in `~/bonfire/grimoires/bonfire/context/freeside-migration-queue-2026-04-19.md` (and adjacent recovery docs)
