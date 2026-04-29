# freeside-metadata — agent instructions

This is a freeside-* attachment module: NFT metadata serving + storage layout. **Stub today** — full content lands when the parallel `metadata-module-placement` design session resolves.

## When loaded

Load this CLAUDE.md when:
- Operator works on NFT metadata schemas, file-storage layouts, or per-token metadata serving
- Operator extends the freeside-* family with metadata-shape modules
- The parallel kickoff (`~/bonfire/grimoires/bonfire/context/metadata-module-placement.md`) advances and lands content here

## Hard rules

- **STUB until earned**. Don't pre-architect content this repo doesn't yet need. Let real friction (Irys gateway death rerun, cross-collection metadata standardization, etc.) drive what lands here.
- **`packages/protocol/` is the single schema vocabulary.** Per [[loa-org-naming-conventions]] — same convention as freeside-world and freeside-score.
- **File-system discipline is load-bearing.** Operator-stated: *"file system that can be cleanly managed"*. Storage layout convention is part of the contract this module owns.

## Composition

- `loa-freeside` — currently does NOT own metadata schemas in the way it owns score schemas. This module is more net-new than extraction-shaped.
- `freeside-world` — sibling module; world manifests can declare compose_with: freeside-metadata
- `freeside-ruggy` — consumer (persona-bot fan-out per collection)

## What this repo does NOT own

- Per-collection metadata content (each collection's tokenURI JSON files belong to that collection's repo)
- World-specific renderers (each world's metadata UI lives in that world's app)
- Chain-specific tokenURI implementations (live in mibera-contracts, etc.)

## References

- Doctrine: `vault/wiki/concepts/freeside-modules-as-installables.md`
- Sister kickoff: `~/bonfire/grimoires/bonfire/context/metadata-module-placement.md`
- Sibling: `freeside-world/CLAUDE.md`, `freeside-score/CLAUDE.md`
