/**
 * Composition skeleton — `getProfile` + `lookupSticker` + `lookupCatalog`.
 *
 * Per SDD §5.3 sequence diagram + §10.3 A-3 (composable-sticker-substrate-2026-05-01).
 *
 * **Phase-1 DEAD CODE**: these helpers compile + typecheck and demonstrate
 * the composition shape that Phase-2 will wire into `StickerServiceLive`.
 * `StickerServiceLive` (in `service.ts`) currently ships the Phase-0 placeholder
 * Layer that short-circuits every method. When Phase-2 lands, the skeleton
 * below is the seed for the full implementation.
 *
 * Doctrine: [[contracts-as-bridges]] — service impl rotates underneath the
 * sealed Schema contract. This file is the seed for the rotation.
 */

import { Effect, Either, Schema } from "effect";
import {
  MalformedURLError,
  NotFoundError,
  lookupGrail,
} from "@0xhoneyjar/freeside-storage-client";
import {
  StickerProfile,
  type StickerLookupQueryT,
  type StickerLookupResult,
  type StickerProfileT,
  type StickerWorldT,
} from "./profile.js";
import {
  COLLECTION_MANIFEST_URLS,
  synthesizeStickerProfile,
  type GlobalManifest,
} from "./adapter.js";
import { StickerProfileDecodeError } from "./service.js";

/**
 * Compose `lookupGrail` + manifest fetch + Schema decode into a per-token
 * profile fetch. **Phase-1 DEAD CODE** — Phase-2 wires this into
 * `StickerServiceLive`. Today nothing in the service tree calls this.
 */
export const getProfile = (args: {
  tokenId: number;
  world: StickerWorldT;
}): Effect.Effect<
  StickerProfileT,
  NotFoundError | MalformedURLError | StickerProfileDecodeError
> =>
  Effect.gen(function* () {
    // 1. Grail discrimination — lookupGrail fails NotGrailError when not a grail.
    //    We catch into an Either and translate to a boolean.
    const grailEither = yield* Effect.either(lookupGrail(args.tokenId));
    const isGrail = Either.isRight(grailEither);

    // 2. Fetch global manifest.
    const manifestUrl = COLLECTION_MANIFEST_URLS[args.world];
    const globalManifest = yield* Effect.tryPromise({
      try: async (): Promise<GlobalManifest> => {
        const response = await fetch(manifestUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<GlobalManifest>;
      },
      catch: (err) =>
        new MalformedURLError({
          raw: manifestUrl,
          reason: `manifest fetch failed: ${String(err)}`,
        }),
    });

    // 3. Synthesize per-token virtual profile + decode against StickerProfile.
    const virtual = synthesizeStickerProfile(globalManifest, {
      tokenId: args.tokenId,
      world: args.world,
      isGrail,
    });
    const profile = yield* Schema.decodeUnknown(StickerProfile)(virtual).pipe(
      Effect.mapError(
        (issue) =>
          new StickerProfileDecodeError({
            tokenId: args.tokenId,
            world: args.world,
            issues: String(issue),
          }),
      ),
    );

    return profile;
  });

/**
 * Resolve a single sticker URL from a profile + query. **Phase-1 DEAD CODE**.
 *
 * Phase-2 fills in the URL_CONTRACT_V1-anchored builder for non-grail
 * profiles. Grail profiles short-circuit to `Skipped/grail-no-stickers` per
 * SDD §5.3 sequence diagram. Today the non-grail path also returns Skipped
 * because the URL builder isn't wired (Phase-2 work).
 */
export const lookupSticker = (
  profile: StickerProfileT,
  _query: StickerLookupQueryT,
): Effect.Effect<StickerLookupResult, MalformedURLError> => {
  if (profile.isGrail) {
    return Effect.succeed({
      _tag: "Skipped" as const,
      reason: "grail-no-stickers" as const,
    });
  }
  // Phase-2: build URL via URL_CONTRACT_V1 + return { _tag: "Resolved", url, via: "cdn" }.
  // Phase-1 skeleton: surface `missing-token` so consumers see the seam.
  return Effect.succeed({
    _tag: "Skipped" as const,
    reason: "missing-token" as const,
  });
};

/**
 * Fan-out over `profile.expressionsAvailable` returning a Map of expression →
 * lookup result. **Phase-1 DEAD CODE** — Phase-2 wires the URL builder + the
 * fallback strategy.
 */
export const lookupCatalog = (
  profile: StickerProfileT,
  _opts?: { variant?: string; fallback?: "cdn-only" | "compose" | "signal" },
): Effect.Effect<ReadonlyMap<string, StickerLookupResult>, MalformedURLError> =>
  Effect.gen(function* () {
    const map = new Map<string, StickerLookupResult>();
    for (const expressionId of profile.expressionsAvailable) {
      const result = yield* lookupSticker(profile, {
        expressionId,
      } as StickerLookupQueryT);
      map.set(expressionId, result);
    }
    return map;
  });
