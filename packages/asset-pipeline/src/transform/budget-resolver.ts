/**
 * Budget resolver — ConsumerConstraint × ParsedImage → variant URL.
 *
 * Per SDD §1.2 read flow + §2.1 (transform/budget-resolver.ts). Walks the
 * variant set the metadata document declared and picks the best match for
 * the consumer's preference order. Falls back to the URL DSL transform
 * endpoint when the metadata only declares a canonical (cdn-original-then-
 * transform path).
 */

import type { ConsumerConstraint } from "../schema/index.js";
import type { ParsedImage } from "../parse/index.js";
import { buildTransformQuery, widthFromConstraint } from "./url-dsl.js";

export interface ResolvedVariant {
  /** URL to fetch bytes from. */
  readonly url: string;
  /** Provenance hint — `cdn-mirror` if from declared variants, else transform. */
  readonly source: "cdn-mirror" | "cdn-original-then-transform";
  /** Realized format the URL targets. */
  readonly format: string;
}

/**
 * Try to find a declared variant in `parsed.variants` that matches the
 * constraint's preferred format(s). Variant key shape is `{format}` or
 * `{format}@{width}` (per SDD §6 manifest convention) — first matching
 * format wins; among matching format keys, prefer maxWidth-bounded if
 * present.
 */
const pickDeclaredVariant = (
  parsed: ParsedImage,
  constraint: ConsumerConstraint,
): ResolvedVariant | undefined => {
  if (!parsed.variants) return undefined;
  const targetWidth = constraint.maxWidth;
  for (const fmt of constraint.acceptFormats) {
    // pass 1: match `{fmt}@{w}` where w ≤ targetWidth
    if (targetWidth !== undefined) {
      const matches = Object.entries(parsed.variants).filter(([key]) =>
        key.startsWith(`${fmt}@`),
      );
      let best: { width: number; url: string } | undefined;
      for (const [key, url] of matches) {
        const widthPart = key.slice(fmt.length + 1);
        const width = Number.parseInt(widthPart, 10);
        if (Number.isNaN(width)) continue;
        if (width > targetWidth) continue;
        if (!best || width > best.width) {
          best = { width, url };
        }
      }
      if (best) {
        return { url: best.url, source: "cdn-mirror", format: fmt };
      }
    }
    // pass 2: bare `{fmt}` key
    const bare = parsed.variants[fmt];
    if (bare) {
      return { url: bare, source: "cdn-mirror", format: fmt };
    }
  }
  return undefined;
};

/**
 * Build a transform URL for cdn-original-then-transform path.
 *
 * Uses `parsed.transform` as the endpoint base if present; otherwise
 * derives from the canonical URL host. The Lambda enforces the path
 * allowlist server-side (NFR-3), so a misuse client-side surfaces as
 * a 403 PathDenied rather than silent corruption.
 */
const buildTransformVariant = (
  parsed: ParsedImage,
  constraint: ConsumerConstraint,
): ResolvedVariant => {
  const fmt = constraint.acceptFormats[0] ?? "webp";
  const w = widthFromConstraint(constraint);
  const canonical = new URL(parsed.canonical);
  // path is the canonical's pathname, leading slash stripped
  const path = canonical.pathname.replace(/^\/+/, "");
  const query = buildTransformQuery(path, {
    w,
    fmt,
    q: 80,
    maxBytes: constraint.maxBytes,
  });
  // Endpoint resolution:
  //   1. metadata declared a `transform` URL → use it
  //   2. otherwise: same-origin /_optimize on the canonical's host
  const base =
    parsed.transform ?? `${canonical.protocol}//${canonical.host}/_optimize`;
  // strip any existing query from the base, then attach ours
  const baseUrl = new URL(base);
  baseUrl.search = "";
  return {
    url: `${baseUrl.toString()}?${query}`,
    source: "cdn-original-then-transform",
    format: fmt,
  };
};

/**
 * Resolve `ParsedImage × ConsumerConstraint` → `ResolvedVariant`.
 *
 * Pure synchronous — does not fetch bytes. Caller (AssetServiceLive)
 * fetches the resolved URL and may post-validate against `maxBytes`.
 */
export const resolveBudget = (
  parsed: ParsedImage,
  constraint: ConsumerConstraint,
): ResolvedVariant => {
  const declared = pickDeclaredVariant(parsed, constraint);
  if (declared) return declared;
  return buildTransformVariant(parsed, constraint);
};
