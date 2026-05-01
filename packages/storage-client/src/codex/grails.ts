/**
 * Codex consumer — `grails.jsonl` from construct-mibera-codex.
 *
 * Authority: grail identity for the 43 1/1 hand-drawn pieces in Mibera Maker.
 * Identity = id, name, type, category, slug, description. The IMAGE URL is
 * NOT in this file; it's published in `mibera-image-urls.json` (see
 * `./mibera-urls.ts`). This module exists so consumers can discriminate
 * grail-vs-canon and read grail metadata.
 */

import { Effect } from "effect";
import { NotGrailError } from "../errors.js";
import { lookupMiberaURL } from "./mibera-urls.js";

const DEFAULT_SOURCE_URL =
  "https://raw.githubusercontent.com/0xHoneyJar/construct-mibera-codex/main/_codex/data/grails.jsonl";

export interface GrailEntry {
  readonly id: number;
  readonly name: string;
  readonly type: "grail";
  readonly category: string;
  readonly slug: string;
  readonly description?: string;
}

const cache = new Map<string, Map<number, GrailEntry>>();

const fetchEntries = (
  sourceUrl: string,
): Effect.Effect<Map<number, GrailEntry>, NotGrailError> => {
  const cached = cache.get(sourceUrl);
  if (cached) return Effect.succeed(cached);

  return Effect.tryPromise({
    try: async () => {
      const res = await fetch(sourceUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const map = new Map<number, GrailEntry>();
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const entry = JSON.parse(trimmed) as GrailEntry;
        map.set(entry.id, entry);
      }
      cache.set(sourceUrl, map);
      return map;
    },
    catch: () => new NotGrailError({ tokenId: -1 }),
  });
};

/**
 * Look up grail identity for a tokenId. Fails NotGrailError if the tokenId
 * isn't published as a grail in the codex.
 */
export const lookupGrail = (
  tokenId: number,
  opts: { sourceUrl?: string } = {},
): Effect.Effect<GrailEntry, NotGrailError> => {
  const sourceUrl = opts.sourceUrl ?? DEFAULT_SOURCE_URL;
  return fetchEntries(sourceUrl).pipe(
    Effect.flatMap((map) => {
      const entry = map.get(tokenId);
      return entry
        ? Effect.succeed(entry)
        : Effect.fail(new NotGrailError({ tokenId }));
    }),
  );
};

/**
 * Build a grail's published image URL — composes grail-discrimination
 * (grails.jsonl) with the canonical URL substrate (mibera-image-urls.json).
 *
 * Substrate-truth: bytes for grails live at the same path family as canon
 * Mibera tokens (`/reveal_phase8/images/{slug-or-hash}.{ext}`), heterogeneous
 * by row. The codex publishes the URL; the client reads.
 */
export const grailImageURL = (
  tokenId: number,
): Effect.Effect<string, NotGrailError> =>
  lookupGrail(tokenId).pipe(
    Effect.flatMap(() =>
      lookupMiberaURL(tokenId).pipe(
        Effect.mapError(() => new NotGrailError({ tokenId })),
      ),
    ),
  );

/**
 * Reset the in-memory cache. For testing.
 */
export const resetGrailCache = (): void => {
  cache.clear();
};
