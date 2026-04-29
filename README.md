# freeside-filesystem

> The freeside-* attachment module for **file storage layout + static-asset CDN + NFT metadata serving + retrieval API**. Operator framing 2026-04-28: *"name it something like filesystem or something"* — the canonical abstraction across NFT metadata, music, archetype images, future blob types. Closes [`loa-freeside#167`](https://github.com/0xHoneyJar/loa-freeside/issues/167).

This repo is a stub today. It establishes the shape so future content has a home; substantive work lands when the parallel `metadata-module-placement` design session crystallizes OR when the next 502MB-music-style friction surfaces (whichever comes first).

Renamed from `freeside-metadata` 2026-04-28 late — `filesystem` is the broader, more accurate abstraction. See [[freeside-modules-as-installables]] §"Why the renames".

Doctrine: [`freeside-modules-as-installables`](https://github.com/0xHoneyJar/loa-hivemind/blob/main/wiki/concepts/freeside-modules-as-installables.md) (instance-3 of the freeside-* attachment-prefix family; siblings: `freeside-worlds`, `freeside-score`, `freeside-ruggy`).

## Why "filesystem"

NFT metadata is a file. Static assets (music, images, archetype PNGs) are files. Storage layout (where files live + how they're named) is a filesystem concern. CDN delivery is filesystem-serving. Retrieval API is filesystem-querying. **One abstraction; many surfaces.**

Per `loa-freeside#167`: Honey Road's 502MB of static music + archetype PNGs blocked the Docker build for 37+ minutes. The fix — S3 + CloudFront with per-world buckets — is filesystem-shaped infrastructure. This module owns that pattern.

Per Eileen's adjacent file-system framing (multiple issues across the org around storage-shaped concerns): the substrate is what the org is missing. This module is its home.

## Intended scope

```
freeside-filesystem/
├── packages/
│   ├── protocol/         📐 metadata format schemas + storage layout + retrieval API contract
│   ├── adapters/         🔁 typed clients for serving + retrieval (S3, IPFS, Arweave, local)
│   ├── storage-layouts/  🗂 per-pattern file-system templates (NFT collection layout,
│   │                        per-world music, per-Door asset bundles)
│   ├── cdn-config/       🚀 terraform fragments for the CDN side (per #167)
│   └── cli/              🛠 freeside-fs CLI for managing layouts + sync to S3 + invalidate
└── docs/
    ├── INTENT.md            why this module exists (filed today)
    ├── EXTRACTION-MAP.md    (when content lands) what to pull from where
    └── INTEGRATION-PATH.md  (when content lands) staged cutover plan
```

The `packages/protocol/` slot is consistent across every freeside-* module per [[loa-org-naming-conventions]] single-vocab doctrine.

## What this addresses

Recent friction the org hit:

- **Honey Road 502MB Docker build** ([`loa-freeside#167`](https://github.com/0xHoneyJar/loa-freeside/issues/167)): docker build hung 37+ minutes copying music. Ad-hoc fix: `.dockerignore public/music`. Music URLs 404 at runtime. Future worlds with big assets will hit the same wall.
- **Irys gateway death 2026-04-27**: `mibera-honeyroad`'s tokenURI resolver stopped working when the metadata gateway died. Recovery required ad-hoc re-hosting + per-consumer re-coding. No shared module to swap in.
- **Cross-collection metadata duplication**: each NFT collection (Honeycomb, Henlo, Mibera, future) reimplements its own JSON serving + CDN strategy.
- **File-system layout drift**: per-token JSON file naming + directory shape diverges between collections. Re-hosting requires per-collection work.
- **No agent surface for metadata queries**: ruggy's persona-bot can't ask "what trait does token #12345 have" without bespoke per-collection HTTP fetches.

Each wants a shared sealed contract. This repo is where that contract goes.

## What this repo does NOT own

- Per-collection metadata content (each collection's tokenURI JSON files belong to that collection's repo)
- World-specific renderers (each world's metadata UI lives in that world's app)
- Chain-specific tokenURI implementations (live in `mibera-contracts`, etc.)
- The actual S3 buckets / CloudFront distributions (those are loa-freeside terraform — this repo provides the schema + module input shape)

## Why STUB now

Per [[freeside-modules-as-installables]]: design with module boundaries from day 1; let extraction follow when it earns the cycles. The repo exists; substantive content waits for either:
- the parallel `metadata-module-placement` design session to land, OR
- the next 502MB-music-style friction (when an operator hits the wall a second time)

The scaffold reserves the name + establishes shape; content flows in when design crystallizes.

## Family

| sibling | role |
|---|---|
| [`freeside-worlds`](https://github.com/0xHoneyJar/freeside-worlds) | world manifests + creator + protocol + registry |
| [`freeside-score`](https://github.com/0xHoneyJar/freeside-score) | scoring schemas; sibling pattern reference |
| [`freeside-ruggy`](https://github.com/0xHoneyJar/freeside-ruggy) | persona-bot consuming metadata schemas for collection-aware fan-out |

## License

MIT.

---

🌱 instance-3 stub. Name-clarified 2026-04-28 late: filesystem, not metadata. The shape exists; the content waits for friction.
