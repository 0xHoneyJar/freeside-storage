# `@0xhoneyjar/asset-pipeline`

> Self-hosted Cloudinary/Vercel-Image substrate. Metadata declares variants · Lambda materializes them · consumers READ.

Effect-Schema-sealed `AssetService` for Discord/PFP/marketplace consumer constraints. Per the asset-pipeline-substrate cycle (cycle B · 2026-05-03 · operator-validated doctrine 0.80 confidence).

## Install

```bash
pnpm add @0xhoneyjar/asset-pipeline effect
```

`effect ^3.10.0` is a peer dependency.

## Quickstart

```ts
import { Effect } from "effect";
import { AssetService, AssetServiceLive } from "@0xhoneyjar/asset-pipeline";

const ref = { canonicalUrl: "https://assets.0xhoneyjar.xyz/Mibera/grails/cancer.png" };
const constraint = {
  maxBytes: 8 * 1024 * 1024,
  acceptFormats: ["webp", "png"] as const,
  consumerLabel: "freeside-characters:discord-attach:v1",
};

const program = Effect.gen(function* () {
  const svc = yield* AssetService;
  return yield* svc.fetchOptimal(ref, constraint);
});

const variant = await Effect.runPromise(
  program.pipe(Effect.provide(AssetServiceLive)),
);
```

## Architecture

```
Consumer → AssetService.fetchOptimal(ref, constraint) → AssetVariant {bytes, format, source}
                                  ↓
                            cache lookup
                                  ↓ (miss)
                       parseImage(canonical)
                                  ↓
                       resolveBudget → variantUrl
                                  ↓
                  CloudFront /_optimize?w=&fmt=&q=  (Lambda transform)
                                  ↓
                                bytes
```

## Documentation

Full reference at [`codex.0xhoneyjar.xyz/asset-pipeline`](https://codex.0xhoneyjar.xyz/asset-pipeline) (vocs site).

- **Cookbook** — Discord 8MB · PFP 256 · GitHub Camo 5MB · marketplace full
- **URL DSL** — non-SDK reference for agents and external builders
- **Migration** — `image: "url"` (flat) → `image: { canonical, variants, transform }` (struct)
- **Label registry** — authoritative `<repo>:<surface>[:v<N>]` consumer label list

## Decisions (locked)

- **Schema** = Effect Schema (peer dep · sealed)
- **Format scope** = stills only (PNG · WebP · AVIF)
- **Cache** = immutable per-input (`max-age=31536000, immutable`)
- **NPM scope** = `@0xhoneyjar/asset-pipeline`
- **URL_CONTRACT** = v1.3.0 additive (flat-string OR struct image; `animation_url` nullable sibling)
- **Telemetry** = CloudWatch (prod) · console (dev) · Sentry pluggable · noop (tests)
- **Rollback** = `:v<N>` suffix on consumerLabel · cache namespace flip · Lambda stays stateless

## Status

`v0.1.0` · cycle B sprint-1 P0 scaffolding. Live consumer wiring lands in P1 (`freeside-characters` grail-cache · 2026-05-04+).

## Source

- Repo: [`0xHoneyJar/freeside-storage/packages/asset-pipeline`](https://github.com/0xHoneyJar/freeside-storage/tree/master/packages/asset-pipeline)
- License: MIT
