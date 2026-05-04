/**
 * URL DSL — ConsumerConstraint → query string mapper for the Lambda /_optimize
 * endpoint.
 *
 * Per SDD §5.1 + §5.2 (Cloudinary-aligned grammar `?w=&fmt=&q=&maxBytes=`).
 *
 * Used when a metadata document declares a `transform` URL hint OR when
 * falling back from the variant set. Pure synchronous — agents and external
 * builders that don't import the SDK can construct the same URLs by hand.
 */

import type { ConsumerConstraint, ImageFormat } from "../schema/index.js";

export interface UrlDslOptions {
  /** Target width in px. */
  readonly w: number;
  /** Target format. */
  readonly fmt: ImageFormat;
  /** Quality 1-100, default 80. */
  readonly q?: number;
  /** Optional informational hint. */
  readonly maxBytes?: number;
}

/**
 * Build a `_optimize`-style query string from a constraint + width.
 *
 * Path is provided by the caller (it's derived from the canonical URL).
 * Width is REQUIRED — a constraint without a maxWidth must use a default
 * (e.g. 1024) before calling this.
 */
export const buildTransformQuery = (
  path: string,
  opts: UrlDslOptions,
): string => {
  const params = new URLSearchParams();
  params.set("path", path);
  params.set("w", String(opts.w));
  params.set("fmt", opts.fmt);
  params.set("q", String(opts.q ?? 80));
  if (opts.maxBytes !== undefined) {
    params.set("maxBytes", String(opts.maxBytes));
  }
  return params.toString();
};

/**
 * Default width for constraints that don't specify maxWidth. Aligns with
 * the cookbook PFP/preview/full ladder per SDD §8.2 (256 / 1024 / native).
 */
export const DEFAULT_WIDTH = 1024;

/**
 * Pick a target width from the constraint. Uses `maxWidth` if present,
 * otherwise DEFAULT_WIDTH.
 */
export const widthFromConstraint = (
  constraint: ConsumerConstraint,
): number => constraint.maxWidth ?? DEFAULT_WIDTH;
