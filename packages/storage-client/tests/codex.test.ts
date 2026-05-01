import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Effect, Either } from "effect";
import {
  lookupMiberaURL,
  resetMiberaURLCache,
} from "../src/codex/mibera-urls.js";
import { lookupGrail, resetGrailCache } from "../src/codex/grails.js";
import { grailImageURL } from "../src/client.js";

describe("lookupMiberaURL", () => {
  beforeEach(() => {
    resetMiberaURLCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves a hash-keyed canon token URL", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          "1": "https://assets.0xhoneyjar.xyz/reveal_phase8/images/8a7e39404ebf86073fab1d068d7037930298d121.png",
          "5000": "https://assets.0xhoneyjar.xyz/reveal_phase8/images/abcdef0123456789abcdef0123456789abcdef01.png",
        }),
      ),
    );
    const url = await Effect.runPromise(lookupMiberaURL(5000));
    expect(url).toBe(
      "https://assets.0xhoneyjar.xyz/reveal_phase8/images/abcdef0123456789abcdef0123456789abcdef01.png",
    );
  });

  it("resolves a grail slug-keyed URL with heterogeneous casing", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          "235": "https://assets.0xhoneyjar.xyz/reveal_phase8/images/scorpio.png",
          "309": "https://assets.0xhoneyjar.xyz/reveal_phase8/images/moon.PNG",
          "876": "https://assets.0xhoneyjar.xyz/reveal_phase8/images/black hole.PNG",
        }),
      ),
    );
    const moon = await Effect.runPromise(lookupMiberaURL(309));
    expect(moon).toBe(
      "https://assets.0xhoneyjar.xyz/reveal_phase8/images/moon.PNG",
    );
    const blackHole = await Effect.runPromise(lookupMiberaURL(876));
    expect(blackHole).toBe(
      "https://assets.0xhoneyjar.xyz/reveal_phase8/images/black hole.PNG",
    );
  });

  it("fails NotFoundError for missing tokenIds", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ "1": "https://example/foo.png" })),
    );
    const result = await Effect.runPromise(
      Effect.either(lookupMiberaURL(99999)),
    );
    expect(Either.isLeft(result)).toBe(true);
  });
});

describe("lookupGrail", () => {
  beforeEach(() => {
    resetGrailCache();
    vi.restoreAllMocks();
  });

  it("returns grail identity for a known grail tokenId", async () => {
    const jsonl =
      '{"id": 235, "name": "Scorpio", "type": "grail", "category": "zodiac", "slug": "scorpio", "description": "Kali as Scorpio"}\n' +
      '{"id": 309, "name": "Moon", "type": "grail", "category": "luminary", "slug": "moon", "description": "Speaker cone necklace"}\n';
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(jsonl));
    const entry = await Effect.runPromise(lookupGrail(235));
    expect(entry.name).toBe("Scorpio");
    expect(entry.slug).toBe("scorpio");
  });

  it("fails NotGrailError for non-grail tokenId", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        '{"id": 235, "name": "Scorpio", "type": "grail", "category": "zodiac", "slug": "scorpio"}\n',
      ),
    );
    const result = await Effect.runPromise(Effect.either(lookupGrail(5000)));
    expect(Either.isLeft(result)).toBe(true);
  });
});

describe("grailImageURL — composes grails.jsonl + mibera-image-urls.json", () => {
  beforeEach(() => {
    resetGrailCache();
    resetMiberaURLCache();
    vi.restoreAllMocks();
  });

  it("returns the URL for a known grail", async () => {
    const grailsJsonl =
      '{"id": 235, "name": "Scorpio", "type": "grail", "category": "zodiac", "slug": "scorpio"}\n';
    const miberaUrls = {
      "235": "https://assets.0xhoneyjar.xyz/reveal_phase8/images/scorpio.png",
    };
    vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      const u = String(url);
      if (u.endsWith(".jsonl")) return new Response(grailsJsonl);
      return new Response(JSON.stringify(miberaUrls));
    });
    const url = await Effect.runPromise(grailImageURL(235));
    expect(url).toBe(
      "https://assets.0xhoneyjar.xyz/reveal_phase8/images/scorpio.png",
    );
  });

  it("fails NotGrailError for non-grail tokenIds", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      const u = String(url);
      if (u.endsWith(".jsonl")) {
        return new Response(
          '{"id": 235, "name": "Scorpio", "type": "grail", "category": "zodiac", "slug": "scorpio"}\n',
        );
      }
      return new Response(JSON.stringify({ "5000": "https://example/foo.png" }));
    });
    const result = await Effect.runPromise(Effect.either(grailImageURL(5000)));
    expect(Either.isLeft(result)).toBe(true);
  });
});
