# packages/protocol — sealed metadata schemas (stub)

The schema home for freeside-metadata. **Empty today.** Content lands when the parallel `metadata-module-placement` design session crystallizes what belongs here.

## Planned shape (per [[freeside-modules-as-installables]])

When content lands, expect:
- `metadata-format.schema.json` — per-token NFT metadata JSON shape
- `storage-layout.schema.json` — file-naming + directory structure convention
- `retrieval-api.schema.json` — typed HTTP/MCP surface for metadata queries
- `types.ts` — branded TS types (TokenId, CollectionSlug, AttributeKey, …)
- `VERSIONING.md` — imported from loa-constructs (enum-locked, additive-only minors)

## Status

🌱 stub. Awaiting `metadata-module-placement.md` design session output.
