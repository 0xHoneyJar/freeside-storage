/**
 * Sealed StickerProfile Effect Schema for the freeside-storage asset plane.
 *
 * Per SDD §3.1 (composable-sticker-substrate-2026-05-01) — this is the durable
 * contract between L3 substrate (CDN manifest + codex) and L4 consumers
 * (dimensions, characters, headless renderers). The required-field surface is
 * sealed by literal/branded validation; daemon-stage axes are reserved as
 * `Schema.optional` for V0.7+ forward-compat (PRD D-2). Note: `Schema.Struct`
 * is permissive on additional properties — extras decode through silently.
 * Drift detection in Phase-1 surfaces shape mismatches via the missing /
 * malformed required fields, not via unexpected extras.
 *
 * Doctrine: [[contracts-as-bridges]] · [[url-contract-as-bridge]] ·
 * [[continuous-metadata-as-daemon-substrate]] · [[composition-schema-as-bridge]].
 */

import { Schema } from "effect";
import { TokenId } from "@0xhoneyjar/freeside-storage-client";

// ── Sticker world enum (subset of URL_CONTRACT_V1.WorldSlug) ──────────────
export const StickerWorld = Schema.Literal("mibera", "shadow", "grail");
export type StickerWorldT = Schema.Schema.Type<typeof StickerWorld>;

// ── Branded ids (kebab-case · per PRD D-5 schema-flexible · NOT enum) ────
export const ExpressionId = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9-]{0,31}$/),
  Schema.brand("ExpressionId"),
);
export type ExpressionIdT = Schema.Schema.Type<typeof ExpressionId>;

export const VariantId = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9-]{0,31}$/),
  Schema.brand("VariantId"),
);
export type VariantIdT = Schema.Schema.Type<typeof VariantId>;

// ── V0.7+ daemon-stage axes (PRD D-2 · ship-today permissive decode) ─────
export const DaemonState = Schema.Literal(
  "dormant",
  "stirring",
  "breathing",
  "soul",
);
export type DaemonStateT = Schema.Schema.Type<typeof DaemonState>;

export const LifecyclePhase = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9-]{0,31}$/),
  Schema.brand("LifecyclePhase"),
);
export type LifecyclePhaseT = Schema.Schema.Type<typeof LifecyclePhase>;

// ── The PROFILE — sealed contract ────────────────────────────────────────
export const StickerProfile = Schema.Struct({
  schemaVersion: Schema.Literal("1.0"),
  tokenId: TokenId,
  world: StickerWorld,

  expressionsAvailable: Schema.Array(ExpressionId).pipe(Schema.minItems(1)),
  variantsAvailable: Schema.Array(VariantId).pipe(Schema.minItems(1)),
  defaultVariant: VariantId,

  manifestVersion: Schema.String,
  manifestUrl: Schema.String.pipe(
    Schema.pattern(/^https:\/\/assets\.0xhoneyjar\.xyz\/.+$/),
  ),

  isGrail: Schema.Boolean, // PRD D-3 frozen field — derived once, stored on profile

  // V0.7+ axes — Schema.optional, permissive decode (PRD D-2, G-5)
  daemonState: Schema.optional(DaemonState),
  lifecyclePhase: Schema.optional(LifecyclePhase),
  voicePointer: Schema.optional(Schema.String),
  experimentPointers: Schema.optional(Schema.Array(Schema.String)),
}).pipe(Schema.brand("StickerProfile"));

export type StickerProfileT = Schema.Schema.Type<typeof StickerProfile>;

// ── Lookup query + result (SDD §5.2) ─────────────────────────────────────
export const FallbackStrategy = Schema.Literal(
  "cdn-only",
  "compose",
  "signal",
);
export type FallbackStrategyT = Schema.Schema.Type<typeof FallbackStrategy>;

export const StickerLookupQuery = Schema.Struct({
  expressionId: ExpressionId,
  variant: Schema.optional(VariantId),
  fallback: Schema.optional(FallbackStrategy),
  daemonStateOverride: Schema.optional(DaemonState),
});
export type StickerLookupQueryT = Schema.Schema.Type<typeof StickerLookupQuery>;

export type StickerLookupResult =
  | {
      readonly _tag: "Resolved";
      readonly url: string;
      readonly via: "cdn" | "codex" | "metadata-image";
    }
  | {
      readonly _tag: "NeedsCompose";
      readonly reason: string;
      readonly profile: StickerProfileT;
    }
  | {
      readonly _tag: "Skipped";
      readonly reason: "grail-no-stickers" | "missing-token";
    };
