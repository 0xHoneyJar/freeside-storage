# @freeside-storage/stickers

Sealed `StickerProfile` Effect Schema + service interface for the freeside-storage
asset plane. Profile-scaffolds-all sticker resolution; client/server agnostic;
composes with `@freeside-storage/client` URL_CONTRACT_V1.

## Status

Phase-0 substrate (`composable-sticker-substrate-2026-05-01` cycle · sprint-1).
Package skeleton landed; Schema · Service · Lookup land in subsequent sprint
tasks (T-3 · T-4 · T-5).

## Design

Three-tier pyramid (structure precedes behavior precedes material):

1. **`StickerProfile` Schema** — sealed Effect Schema · branded primitives ·
   reserves V0.7+ daemon-stage axes (`daemonState` · `lifecyclePhase` ·
   `voicePointer` · `experimentPointers`) as `Schema.optional` · contract is
   `Schema.Literal("1.0")`-versioned for additive bumps.
2. **`StickerService`** — Effect Layer · `getProfile` · `lookupSticker` ·
   `lookupCatalog` · returns discriminated `StickerLookupResult` union
   (`Resolved` · `NeedsCompose` · `Skipped`).
3. **`stickers-canvas`** companion package — DOM compositor · *deferred
   indefinitely* under earn-weight gate (5+ consumers OR multi-runtime pull).

## Composition

```
StickerService.getProfile(tokenId, world)
  ├── lookupGrail(tokenId)              ← @freeside-storage/client (shipped v0.1.0)
  ├── fetch(manifestUrl)                ← URL_CONTRACT_V1.host (shipped)
  └── Schema.decodeUnknown(StickerProfile)
        │
        ▼
  StickerService.lookupSticker(profile, query)
```

## Universality

Strict-universal (Node + browser + edge). Tests run under both `node` and
`jsdom` environments per the workspace `vitest.workspace.ts`. No DOM imports,
no Node-only imports.

DOM compositing (when Phase-3 ships) lives in optional sibling
`@freeside-storage/stickers-canvas` OR is provided by caller as injected
`composeFn` — core stays universal.

## References

- PRD: `grimoires/loa/prd-composable-sticker-substrate-2026-05-01.md`
- SDD: `grimoires/loa/sdd-composable-sticker-substrate-2026-05-01.md`
- Sprint plan: `grimoires/loa/sprint-composable-sticker-substrate-2026-05-01.md`
- Architectural seed: `grimoires/freeside/specs/composable-sticker-substrate-2026-05-01.md`
- Vault doctrines: `[[contracts-as-bridges]]` · `[[url-contract-as-bridge]]` ·
  `[[fallback-shape-divergence]]` · `[[migration-tail-as-bug-source]]` ·
  `[[continuous-metadata-as-daemon-substrate]]`

## License

MIT
