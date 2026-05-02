/**
 * Adapter shim — global manifest → per-token virtual `StickerProfile` shape.
 *
 * Per SDD §7.3 note + §10.3 A-1 (composable-sticker-substrate-2026-05-01).
 * **LOAD-BEARING for Phase-1**: without this shim, `Schema.decodeUnknownEither`
 * would fire drift warnings on every manifest fetch, drowning the listening
 * primitive that Phase-1 is supposed to surface.
 *
 * The current dimensions manifest at
 *   https://assets.0xhoneyjar.xyz/{World}/expressions/current.json
 * does NOT match the per-token `StickerProfile` shape today. It carries
 * `tokenCount`/`expressionCount`/`skippedTokenIds` (global), NOT
 * `tokenId`/`expressionsAvailable`/`isGrail` (per-token). This shim bridges
 * the two by synthesizing per-token virtual profiles from the global manifest
 * + a known-canonical V0.6.x baseline expression list.
 *
 * **Transitional by design.** Retires when EITHER:
 *   1. The manifest evolves to per-token shape, OR
 *   2. A per-world variant catalog publishes (PRD O-4 · next cycle).
 *
 * Doctrine: [[migration-tail-as-bug-source]] — this shim is the seam through
 * which migration-tail bugs become visible. The synthesizer earns its weight
 * by being the listening primitive that catches drift in CI before user UX.
 */

import { Either, ParseResult, Schema } from "effect";
import { StickerProfile, type StickerWorldT } from "./profile.js";

/**
 * Known-canonical V0.6.x baseline expression list. Hardcoded here pending
 * resolution of PRD O-4 (per-world variant catalog · codex authoring cadence).
 * When O-4 lands, this list comes from the codex; this shim retires.
 */
export const V06X_EXPRESSIONS = [
  "neutral",
  "smile",
  "angry",
  "surprised",
  "sad",
  "sleepy",
  "wink",
] as const;

/**
 * Global manifest shape as published TODAY at
 * `assets.0xhoneyjar.xyz/{World}/expressions/current.json`. Fields are all
 * optional in the type because a malformed manifest IS a drift signal — the
 * synthesizer still produces a shape, and Schema decode at the call site
 * decides whether the shape is valid.
 */
export type GlobalManifest = {
  readonly version?: string;
  readonly generatedAt?: string;
  readonly tokenCount?: number;
  readonly expressionCount?: number;
  readonly skippedTokenIds?: ReadonlyArray<number>;
  readonly variants?: ReadonlyArray<string>;
  readonly defaultVariant?: string;
};

/**
 * Per-world manifest URLs. Anchored to `assets.0xhoneyjar.xyz` per
 * URL_CONTRACT_V1 in `@freeside-storage/protocol`. The "grail" world points
 * at the Mibera manifest since grails belong to that collection — but
 * `lookupSticker` short-circuits to `Skipped/grail-no-stickers` for any
 * profile with `isGrail: true`, so the grail manifestUrl is informational.
 */
export const COLLECTION_MANIFEST_URLS: Record<StickerWorldT, string> = {
  mibera: "https://assets.0xhoneyjar.xyz/Mibera/expressions/current.json",
  shadow: "https://assets.0xhoneyjar.xyz/Shadow/expressions/current.json",
  grail: "https://assets.0xhoneyjar.xyz/Mibera/expressions/current.json",
};

/**
 * Synthesized profile shape — structurally compatible with `StickerProfile`
 * but unbranded. The caller MUST run `Schema.decodeUnknownEither(StickerProfile)`
 * before treating the result as a validated profile. This separation
 * preserves Phase-1's listening primitive: drift surfaces at the decode
 * boundary, not silently inside the synthesizer.
 */
export type SynthesizedProfile = {
  readonly schemaVersion: "1.0";
  readonly tokenId: number;
  readonly world: StickerWorldT;
  readonly expressionsAvailable: ReadonlyArray<string>;
  readonly variantsAvailable: ReadonlyArray<string>;
  readonly defaultVariant: string;
  readonly manifestVersion: string;
  readonly manifestUrl: string;
  readonly isGrail: boolean;
};

/**
 * Pure synthesis — caller computes `isGrail` (typically via `lookupGrail`
 * memoized externally per profile fetch) and passes it in. No Effect at the
 * call site, no async, no side effects.
 *
 * **Drift signal preservation**: if `tokenId in globalManifest.skippedTokenIds`,
 * the synthesized profile carries `expressionsAvailable: []`, which fails
 * `Schema.minItems(1)` decode. THAT is F-2 surfacing — the manifest claims a
 * token has no expressions, the contract rejects, drift warning fires.
 */
export function synthesizeStickerProfile(
  globalManifest: GlobalManifest,
  args: { tokenId: number; world: StickerWorldT; isGrail: boolean },
): SynthesizedProfile {
  const { tokenId, world, isGrail } = args;
  const isSkipped = globalManifest.skippedTokenIds?.includes(tokenId) ?? false;

  return {
    schemaVersion: "1.0" as const,
    tokenId,
    world,
    // Skipped tokens get empty list — Schema.minItems(1) will reject — drift signal preserved
    expressionsAvailable: isSkipped ? [] : V06X_EXPRESSIONS,
    variantsAvailable: globalManifest.variants ?? ["transparent"],
    defaultVariant: globalManifest.defaultVariant ?? "transparent",
    manifestVersion: globalManifest.version ?? "unknown",
    manifestUrl: COLLECTION_MANIFEST_URLS[world],
    isGrail,
  };
}

/**
 * Structured drift result — safe to consume across Effect-version boundaries.
 * Phase-1 callers (e.g. mibera-dimensions) read this without importing Effect.
 *
 * `ok: true` → `issues` is the empty string. `ok: false` → `issues` carries
 * the parse error detail. Flat shape (not discriminated union) so cross-repo
 * consumers don't need narrowing voodoo when types span two effect installs.
 */
export type ManifestDriftResult = {
  readonly ok: boolean;
  readonly issues: string;
};

/**
 * Canonical Phase-1 drift-detection entry point (SDD §5.4).
 *
 * Synthesizes a sample profile from `globalManifest` + decodes against the
 * sealed `StickerProfile` schema. Returns a structured `ManifestDriftResult`
 * — consumers don't need to import `effect` to surface drift as a warning.
 *
 * The cross-repo Effect-version skew (workspace package may pin a different
 * effect minor than the consumer) makes the raw `Schema.decodeUnknownEither`
 * call site fragile: branded Schema types from two effect installs aren't
 * structurally compatible at TypeScript's identity level. This helper hides
 * the version-bound types behind a plain serializable result shape.
 */
export function checkManifestDrift(
  globalManifest: unknown,
  args: { tokenId: number; world: StickerWorldT; isGrail: boolean },
): ManifestDriftResult {
  const virtual = synthesizeStickerProfile(
    globalManifest as GlobalManifest,
    args,
  );
  const decoded = Schema.decodeUnknownEither(StickerProfile)(virtual);
  if (Either.isRight(decoded)) {
    return { ok: true, issues: "" };
  }
  // Use TreeFormatter so consumers get a human-readable issue tree instead of
  // `[object Object]` from default ParseError.toString() coercion.
  return {
    ok: false,
    issues: ParseResult.TreeFormatter.formatErrorSync(decoded.left),
  };
}
