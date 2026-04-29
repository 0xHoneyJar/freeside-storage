# packages/protocol — sealed file-system schemas (stub)

The schema home for `freeside-filesystem`. **Empty today.** Content lands when the parallel `metadata-module-placement` design session crystallizes what belongs here OR when the next 502MB-music-style friction event surfaces.

## Planned shape (per [[freeside-modules-as-installables]])

When content lands, expect:
- `metadata-format.schema.json` — per-token NFT metadata JSON shape
- `storage-layout.schema.json` — file-naming + directory structure convention
- `retrieval-api.schema.json` — typed HTTP/MCP surface for metadata queries
- `cdn-config.schema.json` — terraform-module-input for the static-asset CDN pattern from [`loa-freeside#167`](https://github.com/0xHoneyJar/loa-freeside/issues/167)
- `types.ts` — branded TS types (TokenId, CollectionSlug, AttributeKey, AssetExtension, …)
- `VERSIONING.md` — imported from loa-constructs (enum-locked, additive-only minors)

## Status

🌱 stub. Awaiting `metadata-module-placement.md` design session output OR next big-asset Docker-build friction.
