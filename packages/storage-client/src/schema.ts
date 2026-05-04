/**
 * Effect Schema input validators for @freeside-storage/client.
 *
 * URL_CONTRACT_V1 (from @0xhoneyjar/freeside-protocol) is the source of truth for
 * URL shapes; this module narrows raw inputs (number, string) to branded types
 * that builders accept. Bad inputs surface AT THE BOUNDARY with a typed error,
 * not three layers deep in a render tree.
 */

import { Schema } from "effect";

/**
 * A positive integer token ID. Branded so callers can't accidentally pass a
 * raw `number` where a validated TokenId is expected.
 */
export const TokenId = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.brand("TokenId"),
);

export type ValidatedTokenId = Schema.Schema.Type<typeof TokenId>;

/**
 * A 40-character lowercase hex string — matches the hash filenames in
 * `reveal_phase{N}/images/{hash}.png`. Branded.
 */
export const Sha40 = Schema.String.pipe(
  Schema.pattern(/^[a-f0-9]{40}$/),
  Schema.brand("Sha40"),
);

export type ValidatedSha40 = Schema.Schema.Type<typeof Sha40>;

/**
 * Decoder helpers — convenience wrappers that return Either so callers don't
 * have to import Effect at the boundary.
 */
export const decodeTokenId = Schema.decodeEither(TokenId);
export const decodeSha40 = Schema.decodeEither(Sha40);
