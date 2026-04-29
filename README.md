# freeside-metadata

> **STUB**. The freeside-* attachment module for NFT metadata serving + storage layout. Operator hint 2026-04-28: *"file system that can be cleanly managed"* — emphasis on storage layout discipline as a first-class concern.

This repo is a stub today. It establishes the shape so future content has a home; substantive work lands when the first metadata schema or serving need surfaces.

Doctrine: [`freeside-modules-as-installables`](https://github.com/0xHoneyJar/loa-hivemind/blob/main/wiki/concepts/freeside-modules-as-installables.md) (instance-3 of the freeside-* attachment-prefix family; siblings are `freeside-world` and `freeside-score`).

Sister kickoff (existing): `~/bonfire/grimoires/bonfire/context/metadata-module-placement.md` — referenced in the freeside-world meta design session as a parallel session to determine metadata's placement in the org.

## Intended scope (when the friction earns it)

```
freeside-metadata/
├── packages/
│   ├── protocol/         📐 metadata format schemas (per-collection, per-token)
│   │                        + storage layout convention (file-system-clean)
│   │                        + retrieval API contract
│   ├── adapters/         🔁 (eventually) typed clients for serving + retrieval
│   ├── storage-layouts/  🗂 (eventually) per-pattern file-system templates
│   └── cli/              🛠 (eventually) freeside-metadata CLI for managing
└── docs/
    ├── INTENT.md            why this module exists (filed today)
    ├── EXTRACTION-MAP.md    (when content lands) what to pull from where
    └── INTEGRATION-PATH.md  (when content lands) staged cutover plan
```

The `packages/protocol/` slot is consistent across every freeside-* module per [[loa-org-naming-conventions]] single-vocab doctrine.

## Why "file system that can be cleanly managed"

Operator framing: NFT metadata serving has a long-tail of file-system pain (Irys gateway death 2026-04-27 surfaced this). Cleanly-managed file storage = one of the load-bearing concerns:
- Where do per-token metadata JSON files live?
- How do we mirror them across CDNs / IPFS / Arweave / S3?
- What's the file-naming convention?
- How do we re-host a defunct gateway without each consumer re-coding their tokenURI logic?

This module's job: turn that into a sealed, reusable contract.

## Why STUB now (not full content)

- No active extraction work yet (loa-freeside doesn't own metadata schemas the same way it owns score schemas — different friction shape)
- Metadata kickoff (`metadata-module-placement.md`) is a parallel design session whose outputs will populate this repo
- Scaffolding now reserves the name + establishes shape; content lands when design crystallizes
- Per [[freeside-modules-as-installables]]: design with module boundaries from day 1; impl follows

## Family

| sibling | relation |
|---|---|
| [`freeside-world`](https://github.com/0xHoneyJar/freeside-world) | scaffold + creator + registry; world manifests can declare compose_with: freeside-metadata |
| [`freeside-score`](https://github.com/0xHoneyJar/freeside-score) | scoring schemas; sibling pattern reference for what a fully-fleshed module looks like |
| [`freeside-ruggy`](https://github.com/0xHoneyJar/freeside-ruggy) (zerker authoring) | persona-bot; will consume metadata schemas for collection-aware fan-out |

## License

MIT.

---

🌱 instance-3 stub. Schema vocabulary: `packages/protocol/`. The shape exists; the content waits for friction.
