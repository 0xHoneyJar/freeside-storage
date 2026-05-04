/**
 * T0-2 schema unit tests — sealed Effect Schema for asset-pipeline.
 *
 * Per SDD §3 + sprint plan acceptance: ≥6 schema unit tests pass; tagged-error
 * narrowing works under `Effect.catchTag`.
 */

import { describe, expect, it } from "vitest";
import { Effect, Either, Schema } from "effect";
import {
  AssetReference,
  ConsumerConstraint,
  ConsumerLabel,
  AssetVariant,
  AssetSource,
  ImageFormat,
  NetworkError,
  BudgetExceeded,
  PathDenied,
  type AssetError,
} from "../../src/schema/index.js";

describe("AssetReference", () => {
  it("accepts a minimal struct with canonicalUrl only", () => {
    const decoded = Schema.decodeUnknownEither(AssetReference)({
      canonicalUrl: "https://assets.0xhoneyjar.xyz/Mibera/grails/cancer.png",
    });
    expect(Either.isRight(decoded)).toBe(true);
  });

  it("accepts optional fields (refId, contentType, etag)", () => {
    const decoded = Schema.decodeUnknownEither(AssetReference)({
      canonicalUrl: "https://example.com/a.png",
      refId: "mibera:1234",
      contentType: "image/png",
      etag: "W/\"abc123\"",
    });
    expect(Either.isRight(decoded)).toBe(true);
  });

  it("rejects empty canonicalUrl", () => {
    const decoded = Schema.decodeUnknownEither(AssetReference)({
      canonicalUrl: "",
    });
    expect(Either.isLeft(decoded)).toBe(true);
  });
});

describe("ConsumerLabel", () => {
  it("accepts <repo>:<surface> shape", () => {
    const decoded = Schema.decodeUnknownEither(ConsumerLabel)(
      "freeside-characters:discord-attach",
    );
    expect(Either.isRight(decoded)).toBe(true);
  });

  it("accepts <repo>:<surface>:v<N> shape (rollback)", () => {
    const decoded = Schema.decodeUnknownEither(ConsumerLabel)(
      "mibera-dimensions:pfp:v2",
    );
    expect(Either.isRight(decoded)).toBe(true);
  });

  it("rejects uppercase + missing surface", () => {
    expect(
      Either.isLeft(
        Schema.decodeUnknownEither(ConsumerLabel)("Mibera-Dim:PFP"),
      ),
    ).toBe(true);
    expect(
      Either.isLeft(Schema.decodeUnknownEither(ConsumerLabel)("nosurface")),
    ).toBe(true);
  });

  it("rejects invalid version suffix (vAB / v / v1.2)", () => {
    expect(
      Either.isLeft(Schema.decodeUnknownEither(ConsumerLabel)("a:b:vAB")),
    ).toBe(true);
    expect(
      Either.isLeft(Schema.decodeUnknownEither(ConsumerLabel)("a:b:v")),
    ).toBe(true);
    expect(
      Either.isLeft(Schema.decodeUnknownEither(ConsumerLabel)("a:b:v1.2")),
    ).toBe(true);
  });
});

describe("ConsumerConstraint", () => {
  it("accepts a Discord-shaped constraint", () => {
    const decoded = Schema.decodeUnknownEither(ConsumerConstraint)({
      maxBytes: 8 * 1024 * 1024,
      acceptFormats: ["webp", "png"],
      consumerLabel: "freeside-characters:discord-attach:v1",
    });
    expect(Either.isRight(decoded)).toBe(true);
  });

  it("accepts a PFP-shaped constraint with maxWidth", () => {
    const decoded = Schema.decodeUnknownEither(ConsumerConstraint)({
      maxBytes: 100 * 1024,
      acceptFormats: ["webp"],
      maxWidth: 256,
      consumerLabel: "mibera-dimensions:pfp:v1",
    });
    expect(Either.isRight(decoded)).toBe(true);
  });

  it("rejects empty acceptFormats", () => {
    const decoded = Schema.decodeUnknownEither(ConsumerConstraint)({
      maxBytes: 1024,
      acceptFormats: [],
      consumerLabel: "a:b",
    });
    expect(Either.isLeft(decoded)).toBe(true);
  });

  it("rejects maxBytes ≤ 0 and beyond 50MB sanity cap", () => {
    expect(
      Either.isLeft(
        Schema.decodeUnknownEither(ConsumerConstraint)({
          maxBytes: 0,
          acceptFormats: ["webp"],
          consumerLabel: "a:b",
        }),
      ),
    ).toBe(true);

    expect(
      Either.isLeft(
        Schema.decodeUnknownEither(ConsumerConstraint)({
          maxBytes: 100 * 1024 * 1024,
          acceptFormats: ["webp"],
          consumerLabel: "a:b",
        }),
      ),
    ).toBe(true);
  });

  it("rejects maxWidth out of [16, 4096] range", () => {
    expect(
      Either.isLeft(
        Schema.decodeUnknownEither(ConsumerConstraint)({
          maxBytes: 1024,
          acceptFormats: ["webp"],
          maxWidth: 8,
          consumerLabel: "a:b",
        }),
      ),
    ).toBe(true);

    expect(
      Either.isLeft(
        Schema.decodeUnknownEither(ConsumerConstraint)({
          maxBytes: 1024,
          acceptFormats: ["webp"],
          maxWidth: 8192,
          consumerLabel: "a:b",
        }),
      ),
    ).toBe(true);
  });

  it("rejects invalid format in acceptFormats", () => {
    const decoded = Schema.decodeUnknownEither(ConsumerConstraint)({
      maxBytes: 1024,
      acceptFormats: ["gif" as unknown as "webp"],
      consumerLabel: "a:b",
    });
    expect(Either.isLeft(decoded)).toBe(true);
  });
});

describe("AssetVariant + AssetSource", () => {
  it("accepts a complete variant struct", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const decoded = Schema.decodeUnknownEither(AssetVariant)({
      bytes,
      format: "webp",
      byteLength: bytes.byteLength,
      width: 256,
      source: "cdn-mirror",
      fetchedAt: Date.now(),
      cacheKey: "https://x/a.png::a:b",
    });
    expect(Either.isRight(decoded)).toBe(true);
  });

  it("AssetSource literal accepts all 4 provenance tags", () => {
    for (const s of [
      "cache-hit",
      "cdn-mirror",
      "cdn-original-then-transform",
      "live-fetch",
    ] as const) {
      expect(
        Either.isRight(Schema.decodeUnknownEither(AssetSource)(s)),
      ).toBe(true);
    }
  });

  it("AssetSource rejects unknown provenance", () => {
    expect(
      Either.isLeft(Schema.decodeUnknownEither(AssetSource)("from-mars")),
    ).toBe(true);
  });
});

describe("ImageFormat", () => {
  it("accepts the locked stills-only set (per ADR-4)", () => {
    for (const f of ["webp", "png", "jpeg", "avif"] as const) {
      expect(
        Either.isRight(Schema.decodeUnknownEither(ImageFormat)(f)),
      ).toBe(true);
    }
  });

  it("rejects animated/video formats per ADR-4", () => {
    for (const f of ["gif", "mp4", "webm", "apng"]) {
      expect(
        Either.isLeft(Schema.decodeUnknownEither(ImageFormat)(f)),
      ).toBe(true);
    }
  });
});

describe("AssetError tagged-error union", () => {
  it("NetworkError is narrowable by _tag via Effect.catchTag", async () => {
    const program = Effect.fail(
      new NetworkError({
        url: "https://x/y.png",
        status: 502,
        cause: "upstream",
      }),
    ).pipe(
      Effect.catchTag("NetworkError", (e) =>
        Effect.succeed({ recovered: true, status: e.status }),
      ),
    );
    const result = await Effect.runPromise(program);
    expect(result).toEqual({ recovered: true, status: 502 });
  });

  it("BudgetExceeded carries triedFormats for graceful degrade", async () => {
    const err = new BudgetExceeded({
      url: "https://x/a.png",
      actualBytes: 9_500_000,
      budgetBytes: 8_000_000,
      triedFormats: ["webp", "png"],
    });
    expect(err._tag).toBe("BudgetExceeded");
    expect(err.triedFormats).toEqual(["webp", "png"]);
  });

  it("PathDenied reason is sealed to the 2 documented variants", () => {
    const a = new PathDenied({ path: "Foo/", reason: "not-in-allowlist" });
    const b = new PathDenied({ path: "..", reason: "invalid-shape" });
    expect(a.reason).toBe("not-in-allowlist");
    expect(b.reason).toBe("invalid-shape");
  });

  it("Effect.catchTags handles multiple variants (NetworkError + BudgetExceeded)", async () => {
    const make = (
      pickNetwork: boolean,
    ): Effect.Effect<string, AssetError> =>
      pickNetwork
        ? Effect.fail(
            new NetworkError({ url: "x", status: 500, cause: "nope" }),
          )
        : Effect.fail(
            new BudgetExceeded({
              url: "x",
              actualBytes: 100,
              budgetBytes: 50,
              triedFormats: ["webp"],
            }),
          );

    const handler = (eff: Effect.Effect<string, AssetError>) =>
      eff.pipe(
        Effect.catchTags({
          NetworkError: (e) => Effect.succeed(`net:${e.status}`),
          BudgetExceeded: (e) => Effect.succeed(`budget:${e.actualBytes}`),
          TransformError: (_e) => Effect.succeed("transform"),
          UnsupportedFormat: (_e) => Effect.succeed("unsupported"),
          PathDenied: (_e) => Effect.succeed("path-denied"),
          MetadataParseError: (_e) => Effect.succeed("parse"),
          CacheError: (_e) => Effect.succeed("cache"),
        }),
      );

    expect(await Effect.runPromise(handler(make(true)))).toBe("net:500");
    expect(await Effect.runPromise(handler(make(false)))).toBe("budget:100");
  });
});
