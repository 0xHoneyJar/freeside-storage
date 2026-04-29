# freeside-filesystem — agent instructions

This is a freeside-* attachment module: **file storage layout + static-asset CDN + NFT metadata serving + retrieval API**. **Stub today** — full content lands when the parallel `metadata-module-placement` design session resolves OR when the next 502MB-music-style friction surfaces.

Renamed from `freeside-metadata` 2026-04-28 late (`filesystem` is the broader abstraction; matches operator hint + closes [`loa-freeside#167`](https://github.com/0xHoneyJar/loa-freeside/issues/167)).

## When loaded

Load this CLAUDE.md when:
- Operator works on NFT metadata schemas, file-storage layouts, static-asset CDN configs, or per-token metadata serving
- Operator extends the freeside-* family with file-shape modules
- The parallel kickoff (`~/bonfire/grimoires/bonfire/context/metadata-module-placement.md`) advances and lands content here
- The next world hits 502MB-music-style asset friction

## Hard rules

- **STUB until earned**. Don't pre-architect content this repo doesn't yet need. Let real friction (Irys gateway death rerun, cross-collection metadata standardization, big-static-asset Docker build, etc.) drive what lands here.
- **`packages/protocol/` is the single schema vocabulary.** Per [[loa-org-naming-conventions]] — same convention as freeside-worlds and freeside-score.
- **File-system discipline is load-bearing.** Operator-stated 2026-04-28: *"file system that can be cleanly managed"*. Storage layout convention is part of the contract this module owns.
- **Cross-link Issue #167.** This module is the home for the static-asset CDN pattern that issue describes.

## Composition

- `loa-freeside` — does NOT yet own the file-system schemas; some adjacent CDN/static-asset friction lives in [`#167`](https://github.com/0xHoneyJar/loa-freeside/issues/167) and elsewhere
- `freeside-worlds` — sibling module; world manifests can declare compose_with: freeside-filesystem
- `freeside-ruggy` — consumer (persona-bot fan-out per collection)

## What this repo does NOT own

- Per-collection metadata content (each collection's tokenURI JSON files belong to that collection's repo)
- World-specific renderers (each world's metadata UI lives in that world's app)
- Chain-specific tokenURI implementations (live in mibera-contracts, etc.)
- The actual S3/CloudFront resources (those provision via loa-freeside terraform; this repo provides the schema + module shape)

## References

- Doctrine: `vault/wiki/concepts/freeside-modules-as-installables.md`
- Sister kickoff: `~/bonfire/grimoires/bonfire/context/metadata-module-placement.md`
- Sibling: `freeside-worlds/CLAUDE.md`, `freeside-score/CLAUDE.md`
- Friction sources: [`loa-freeside#167`](https://github.com/0xHoneyJar/loa-freeside/issues/167) + Irys gateway death incident `~/bonfire/grimoires/bonfire/context/freeside-migration-queue-2026-04-19.md`
