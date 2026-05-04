# `@freeside-storage/client`

Type-safe URL builders + codex consumers for the freeside-storage URL contract. EffectTS Schema validates inputs; typed errors make failure modes first-class; codex-authority cascade for per-token overrides (read-only).

## What it gives you

```ts
import {
  miberaImageURL,           // sync, hash → URL
  miberaImageURLByToken,    // Effect, tokenId → URL (codex)
  miberaMetadataURL,        // sync, tokenId → manifest URL
  mstImageURL,              // Effect, tokenId → MST image (handles timestamp-suffix)
  mstMetadataURL,           // sync, tokenId → honeyroad endpoint
  grailImageURL,            // Effect, tokenId → grail image (codex authority)
} from "@freeside-storage/client";
```

Sync builders are pure functions. Async builders return `Effect.Effect<string, AssetError>` and integrate codex authority + remote fetch.

## Why EffectTS

Three things bare TypeScript doesn't give you:

### 1. Schema-validated inputs

```ts
import { TokenId, Sha40 } from "@freeside-storage/client";
import { Schema } from "effect";

const decoded = Schema.decodeEither(TokenId)(rawNumber);
// → Either<ParseError, ValidatedTokenId>
```

Bad inputs surface AT THE BOUNDARY with a typed error, not three layers deep in a render tree.

### 2. Typed error channel

`Effect<A, E, R>` — `A` is success, `E` is a typed error union, `R` is the dependency context. Errors are first-class values:

```ts
type AssetError =
  | NotFoundError       // collection + tokenId
  | MalformedURLError   // raw + reason
  | VersionDriftError   // expected + got
  | MissingHashError    // tokenId + source
  | NotGrailError       // tokenId
```

Consumers `Effect.catchTag("NotFoundError", ...)` to handle each case.

### 3. Composable layers

```ts
import { Effect, pipe } from "effect";
import { mstImageURL } from "@freeside-storage/client";

const fetchWithFallback = (tokenId: number) =>
  pipe(
    mstImageURL(tokenId),
    Effect.timeout("3 seconds"),
    Effect.retry({ times: 2 }),
    Effect.catchTag("NotFoundError", () =>
      Effect.succeed("https://example.com/fallback.webp"),
    ),
  );
```

Each `pipe` step is a composable layer. Same primitives across honeyroad, dimensions, midi.

## Substrate-truth resolution

`URL_CONTRACT_V1` (from `@0xhoneyjar/freeside-protocol`) is the source of truth. Builders return URLs where bytes live TODAY — both canonical `routes` and `legacyRoutes` are consumed.

Mibera image URLs resolve via the `reveal_phase{N}/images/{hash}.png` legacyRoute shape (where bytes live), since URL_CONTRACT_V1 marks the canonical `Mibera/final/{tokenId}.png` as gated by the optional mibera-2 polish cycle.

Grail URLs are NOT constructed from slug + extension — extensions are heterogeneous (`.png` / `.PNG`), some slugs contain spaces. The codex `mibera-image-urls.json` publishes the full URL per tokenId; the client reads.

## Codex consumers (read-only)

Per [[consuming-codex-overrides]] doctrine. The client reads the published codex artifacts; never writes.

| codex source | consumer | what it provides |
|---|---|---|
| `mibera-image-urls.json` | `lookupMiberaURL(tokenId)` | tokenId → published image URL |
| `grails.jsonl` | `lookupGrail(tokenId)` | grail identity (id, name, slug, category) |

In-memory cache per source URL. Call `resetMiberaURLCache()` / `resetGrailCache()` to clear (testing).

## Install

```sh
pnpm add @freeside-storage/client effect
```

## Test

```sh
pnpm -F @freeside-storage/client test
```
