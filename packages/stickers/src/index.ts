/**
 * @freeside-storage/stickers — Sealed StickerProfile Effect Schema + service
 * interface for the freeside-storage asset plane.
 *
 * Phase-0 substrate per composable-sticker-substrate-2026-05-01 cycle. Public
 * exports are added incrementally as Schema · Service · Lookup land in
 * subsequent sprint tasks (T-3 · T-4 · T-5).
 *
 * Doctrine: this module IS instance-N of [[contracts-as-bridges]] at the
 * sticker plane. Schema is the durable artifact; canvas compositing, CDN URL
 * shapes, expression catalogs, and daemon-stage axes are impls that rotate
 * underneath it.
 */

export const STICKERS_PACKAGE_VERSION = "0.0.1" as const;
