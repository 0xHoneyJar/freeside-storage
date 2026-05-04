/**
 * ConsumerConstraint — what the consumer environment requires.
 *
 * Per SDD §3.2 (asset-pipeline-substrate cycle B). The consumer encodes the
 * environment's hard ceiling (Discord 8MB · GitHub Camo 5MB · PFP 100KB),
 * format preference order, and a `<repo>:<surface>[:v<N>]` label for
 * telemetry segmentation + cache namespacing (rollback per ADR-13).
 *
 * The label format is the Risk 4 mitigation (consumer-label collision) and
 * the ADR-13 rollback mechanism — bumping `:v1` → `:v2` flips the cache
 * namespace cleanly without touching the Lambda.
 */

import { Schema } from "effect";

/**
 * Format scope — stills only per ADR-4. No animated, no video, no audio.
 * AVIF lands at Lambda level alongside webp; jpeg is read-only (canonical
 * inputs may be jpeg, transform output target is webp/png/avif).
 */
export const ImageFormat = Schema.Literal("webp", "png", "jpeg", "avif");
export type ImageFormat = Schema.Schema.Type<typeof ImageFormat>;

/**
 * Consumer label format: `<repo>:<surface>[:v<N>]`.
 *
 * Examples:
 *   - freeside-characters:discord-attach
 *   - freeside-characters:grail-prefetch:v1
 *   - mibera-dimensions:pfp:v2
 *   - score-mibera:wallet-card
 *
 * The optional `:v<N>` suffix is the rollback flag (ADR-13). Different
 * labels are different cache namespaces — flip = clean slate.
 *
 * Authoritative registry lives at:
 *   codex.0xhoneyjar.xyz/asset-pipeline/labels (vocs page)
 *   packages/asset-pipeline/docs/pages/label-registry.mdx (source)
 */
export const ConsumerLabel = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9-]+:[a-z0-9-]+(?::v[0-9]+)?$/),
  Schema.annotations({
    identifier: "ConsumerLabel",
    description:
      "Format: <repo>:<surface>[:v<N>]. Examples: bot:discord-attach · dimensions:pfp:v2",
  }),
);
export type ConsumerLabel = Schema.Schema.Type<typeof ConsumerLabel>;

/**
 * Consumer constraint — environment ceiling + format preference.
 *
 * `acceptFormats` is preference-ordered (first = preferred). The service
 * walks the list left-to-right against server capabilities and returns the
 * first format that resolves under `maxBytes`.
 */
export const ConsumerConstraint = Schema.Struct({
  /** Hard ceiling. BudgetExceeded fires post-fetch if bytes > maxBytes. */
  maxBytes: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.lessThanOrEqualTo(50 * 1024 * 1024), // 50MB sanity cap; Discord max is 8MB
  ),
  /** Format preference order — first match wins. */
  acceptFormats: Schema.Array(ImageFormat).pipe(Schema.minItems(1)),
  /** Optional max width hint — service uses to pick variant URL (e.g. PFP 256px). */
  maxWidth: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThanOrEqualTo(16),
      Schema.lessThanOrEqualTo(4096),
    ),
  ),
  /** Telemetry + cache-namespace key. */
  consumerLabel: ConsumerLabel,
}).pipe(Schema.annotations({ identifier: "ConsumerConstraint" }));

export type ConsumerConstraint = Schema.Schema.Type<typeof ConsumerConstraint>;
