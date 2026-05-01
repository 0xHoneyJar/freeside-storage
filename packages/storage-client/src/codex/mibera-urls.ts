/**
 * Codex consumer — `mibera-image-urls.json` from construct-mibera-codex.
 *
 * Authority: maps Mibera-canon tokenId (1-10000, including the 43 grail IDs)
 * to a published `assets.0xhoneyjar.xyz` image URL. Substrate-truth reads from
 * the canonical codex artifact; this module is read-only.
 *
 * URL shape examples (from substrate inspection 2026-05-01):
 *   "1"    → "https://assets.0xhoneyjar.xyz/reveal_phase8/images/8a7e394...png"
 *   "235"  → "https://assets.0xhoneyjar.xyz/reveal_phase8/images/scorpio.png"
 *   "309"  → "https://assets.0xhoneyjar.xyz/reveal_phase8/images/moon.PNG"
 *   "876"  → "https://assets.0xhoneyjar.xyz/reveal_phase8/images/black hole.PNG"
 *
 * Extensions are heterogeneous (`.png` / `.PNG`); some slugs contain spaces.
 * Don't construct these URLs from slug + ext — read the codex.
 */

import { Effect } from "effect";
import { NotFoundError } from "../errors.js";

const DEFAULT_SOURCE_URL =
  "https://raw.githubusercontent.com/0xHoneyJar/construct-mibera-codex/main/_codex/data/mibera-image-urls.json";

type MiberaImageUrlMap = Record<string, string>;

const cache = new Map<string, MiberaImageUrlMap>();

const fetchMap = (
  sourceUrl: string,
): Effect.Effect<MiberaImageUrlMap, NotFoundError> => {
  const cached = cache.get(sourceUrl);
  if (cached) return Effect.succeed(cached);

  return Effect.tryPromise({
    try: async () => {
      const res = await fetch(sourceUrl);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const map = (await res.json()) as MiberaImageUrlMap;
      cache.set(sourceUrl, map);
      return map;
    },
    catch: () =>
      new NotFoundError({ collection: "mibera-image-urls", tokenId: -1 }),
  });
};

/**
 * Look up the canonical image URL for a Mibera-canon token. Fails
 * NotFoundError if the codex doesn't publish an entry for the tokenId.
 */
export const lookupMiberaURL = (
  tokenId: number,
  opts: { sourceUrl?: string } = {},
): Effect.Effect<string, NotFoundError> => {
  const sourceUrl = opts.sourceUrl ?? DEFAULT_SOURCE_URL;
  return fetchMap(sourceUrl).pipe(
    Effect.flatMap((map) => {
      const url = map[String(tokenId)];
      return url
        ? Effect.succeed(url)
        : Effect.fail(new NotFoundError({ collection: "mibera", tokenId }));
    }),
  );
};

/**
 * Reset the in-memory cache. For testing.
 */
export const resetMiberaURLCache = (): void => {
  cache.clear();
};
