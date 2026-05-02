/**
 * StickerService — Effect-style port (interface) for sticker resolution.
 *
 * Per SDD §5.1 (composable-sticker-substrate-2026-05-01). This module ships
 * the type signatures + a Phase-0 placeholder Layer; the full implementation
 * rolls out across Phases 1-5 as consumers light up. Service.Live below is
 * a SKELETON — full impl is dead code until Phase-2 (per SDD §10.3 A-3).
 *
 * Doctrine: [[contracts-as-bridges]] — the Schema (profile.ts) is the
 * durable artifact; this Service is the rotating impl above it.
 */

import { Context, Data, Effect, Layer } from "effect";
import type {
  StickerLookupQueryT,
  StickerLookupResult,
  StickerProfileT,
} from "./profile.js";
import {
  type MalformedURLError,
  type NotFoundError,
} from "@freeside-storage/client";

// ── Tagged error for decode failures (SDD §6) ─────────────────────────────
export class StickerProfileDecodeError extends Data.TaggedError(
  "StickerProfileDecodeError",
)<{
  readonly tokenId: number;
  readonly world: string;
  readonly issues: string;
}> {}

// ── Service interface ─────────────────────────────────────────────────────
export interface StickerService {
  readonly getProfile: (args: {
    tokenId: number;
    world: "mibera" | "shadow" | "grail";
  }) => Effect.Effect<
    StickerProfileT,
    NotFoundError | MalformedURLError | StickerProfileDecodeError
  >;

  readonly lookupSticker: (
    profile: StickerProfileT,
    query: StickerLookupQueryT,
  ) => Effect.Effect<StickerLookupResult, MalformedURLError>;

  readonly lookupCatalog: (
    profile: StickerProfileT,
    opts?: { variant?: string; fallback?: "cdn-only" | "compose" | "signal" },
  ) => Effect.Effect<
    ReadonlyMap<string, StickerLookupResult>,
    MalformedURLError
  >;
}

export const StickerService = Context.GenericTag<StickerService>(
  "@freeside-storage/stickers/StickerService",
);

// ── Default Layer · Phase-0 skeleton ─────────────────────────────────────
// Full impl rolls out across Phases 1-5 as consumers light up. Today every
// method short-circuits: getProfile fails with the placeholder error,
// lookupSticker returns Skipped/missing-token, lookupCatalog returns empty.
export const StickerServiceLive: Layer.Layer<StickerService, never, never> =
  Layer.succeed(StickerService, {
    getProfile: ({ tokenId, world }) =>
      Effect.fail(
        new StickerProfileDecodeError({
          tokenId,
          world,
          issues: "Phase-0 skeleton: getProfile not yet implemented",
        }),
      ),
    lookupSticker: () =>
      Effect.succeed({
        _tag: "Skipped" as const,
        reason: "missing-token" as const,
      }),
    lookupCatalog: () => Effect.succeed(new Map()),
  });
