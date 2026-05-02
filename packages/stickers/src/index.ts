/**
 * @freeside-storage/stickers — Sealed StickerProfile Effect Schema + service
 * interface for the freeside-storage asset plane.
 *
 * Phase-0 substrate per composable-sticker-substrate-2026-05-01 cycle.
 * Schema (T-3) ships first; Service (T-4) and lookup skeleton (T-5) layer on
 * top. The compositor layer (`-canvas` companion) is deferred indefinitely
 * per PRD D-4 (5+ consumer earn-weight gate).
 *
 * Doctrine: this module IS instance-N of [[contracts-as-bridges]] at the
 * sticker plane. Schema is the durable artifact; canvas compositing, CDN URL
 * shapes, expression catalogs, and daemon-stage axes are impls that rotate
 * underneath it.
 */

export const STICKERS_PACKAGE_VERSION = "0.0.1" as const;

// ── Profile Schema (T-3 · SDD §3.1, §5.2) ────────────────────────────────
export {
  StickerWorld,
  ExpressionId,
  VariantId,
  DaemonState,
  LifecyclePhase,
  StickerProfile,
  FallbackStrategy,
  StickerLookupQuery,
  type StickerWorldT,
  type ExpressionIdT,
  type VariantIdT,
  type DaemonStateT,
  type LifecyclePhaseT,
  type StickerProfileT,
  type FallbackStrategyT,
  type StickerLookupQueryT,
  type StickerLookupResult,
} from "./profile.js";

// ── Service interface + tagged error + Phase-0 Layer (T-4 · SDD §5.1) ────
export {
  StickerProfileDecodeError,
  StickerService,
  StickerServiceLive,
} from "./service.js";

// ── Adapter shim — global manifest → per-token virtual (T-8 · SDD §10.3 A-1) ──
export {
  COLLECTION_MANIFEST_URLS,
  V06X_EXPRESSIONS,
  checkManifestDrift,
  synthesizeStickerProfile,
  type GlobalManifest,
  type ManifestDriftResult,
  type SynthesizedProfile,
} from "./adapter.js";

// ── Composition skeleton (T-5 · SDD §5.3 · Phase-1 dead code) ────────────
export { getProfile, lookupSticker, lookupCatalog } from "./lookup.js";
