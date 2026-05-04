# `@0xhoneyjar/asset-pipeline` docs source

Vocs source for the published docs site at:

> [`codex.0xhoneyjar.xyz/asset-pipeline`](https://codex.0xhoneyjar.xyz/asset-pipeline)

## Pages

| File | Page | Status |
|---|---|---|
| `pages/index.mdx` | `/asset-pipeline` (5-min getting started) | T0-7 scaffold |
| `pages/cookbook.mdx` | `/asset-pipeline/cookbook` (Discord 8MB · PFP · marketplace · GitHub Camo) | T0-7 scaffold |
| `pages/url-dsl.mdx` | `/asset-pipeline/url-dsl` (non-SDK reference) | T0-7 scaffold |
| `pages/migration.mdx` | `/asset-pipeline/migration` (flat-string → struct) | T0-7 scaffold |
| `pages/label-registry.mdx` | `/asset-pipeline/labels` (authoritative consumer labels) | T0-7 scaffold |
| `pages/api.mdx` | `/asset-pipeline/api` (TypeDoc auto-generated) | DEFERRED — wires when first consumer migration ships |

## Site integration

The site is published from `0xHoneyJar/construct-mibera-codex` (vocs umbrella site at `codex.0xhoneyjar.xyz`). T0-7 of the asset-pipeline-substrate sprint plan ships the **source** here in the package; the **deployment** wiring to the codex tree is a separate task in cycle B sprint-1b (loa-freeside terraform side · operator-bounded).

## Local preview

Until the codex umbrella picks up these pages:

```bash
# inside packages/asset-pipeline
pnpm dlx vocs preview docs   # one-off preview
```

The pages compile as standalone MDX. No vocs config lives here yet — the umbrella site at construct-mibera-codex consumes them.

## Doctrine

This documentation surface is the public face of the asset-pipeline substrate per ADR-6 (Builder-DX = NPM SDK + vocs docs). The label registry page (`label-registry.mdx`) is the load-bearing one — Risk 4 mitigation requires a single canonical list.
