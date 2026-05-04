/**
 * T0-3 parseImage tests — URL_CONTRACT v1.3.0 backward-compat invariant.
 *
 * Per SDD §10.4 + sprint plan acceptance: ≥4 parseImage unit tests pass;
 * existing protocol tests still green.
 *
 * Risk 5 mitigation: external code reading `meta.image` as flat string
 * keeps working unchanged after v1.3.0 union introduction.
 */

import { describe, expect, it } from "vitest";
import { Effect, Either, Schema } from "effect";
import {
  parseImage,
  decodeAndParseImage,
  MetadataDocument,
  MetadataImage,
  MetadataImageStruct,
} from "@freeside-storage/protocol";

describe("parseImage — URL_CONTRACT v1.3.0 normalizer", () => {
  it("flat string → struct with canonical only", () => {
    const url =
      "https://assets.0xhoneyjar.xyz/Mibera/grails/cancer.png";
    expect(parseImage(url)).toEqual({ canonical: url });
  });

  it("struct passthrough preserves all fields", () => {
    const struct = {
      canonical: "https://x/a.png",
      variants: { webp: "https://x/a.webp", png256: "https://x/a-256.png" },
      transform: "https://x/_optimize?path=a.png",
      capabilities: ["webp", "resize"] as const,
    };
    const result = parseImage(struct);
    expect(result.canonical).toBe("https://x/a.png");
    expect(result.variants).toEqual(struct.variants);
    expect(result.transform).toBe(struct.transform);
    expect(result.capabilities).toEqual(["webp", "resize"]);
  });

  it("struct without variants/transform passes through", () => {
    const struct = { canonical: "https://x/a.png" };
    expect(parseImage(struct)).toEqual(struct);
  });

  it("type-level: parseImage on MetadataImage always yields ParsedImage with canonical", () => {
    const flat: MetadataImage = "https://x/a.png";
    const struct: MetadataImage = {
      canonical: "https://x/a.png",
      variants: { webp: "https://x/a.webp" },
    };
    // both paths produce { canonical: string, variants?, transform?, capabilities? }
    expect(parseImage(flat).canonical).toBe("https://x/a.png");
    expect(parseImage(struct).canonical).toBe("https://x/a.png");
  });
});

describe("decodeAndParseImage — boundary decode + parse", () => {
  it("decodes flat-string raw payload + parses", async () => {
    const result = await Effect.runPromise(
      decodeAndParseImage("https://x/a.png"),
    );
    expect(result).toEqual({ canonical: "https://x/a.png" });
  });

  it("decodes struct raw payload + parses", async () => {
    const result = await Effect.runPromise(
      decodeAndParseImage({
        canonical: "https://x/a.png",
        variants: { webp: "https://x/a.webp" },
      }),
    );
    expect(result.canonical).toBe("https://x/a.png");
    expect(result.variants).toEqual({ webp: "https://x/a.webp" });
  });

  it("rejects malformed raw payload (number)", async () => {
    const exit = await Effect.runPromiseExit(decodeAndParseImage(42));
    expect(exit._tag).toBe("Failure");
  });

  it("rejects empty-string canonical (preserves v1.2.0 minLength invariant)", async () => {
    const exit = await Effect.runPromiseExit(decodeAndParseImage(""));
    expect(exit._tag).toBe("Failure");
  });
});

describe("MetadataDocument — v1.3.0 union + animation_url", () => {
  it("decodes legacy flat-string image payload (v1.2.0 + earlier compat)", () => {
    const decoded = Schema.decodeUnknownEither(MetadataDocument)({
      name: "Mibera #1234",
      description: "Test",
      image: "https://x/a.png",
    });
    expect(Either.isRight(decoded)).toBe(true);
  });

  it("decodes new struct-shape image payload (v1.3.0)", () => {
    const decoded = Schema.decodeUnknownEither(MetadataDocument)({
      name: "Mibera #1234",
      description: "Test",
      image: {
        canonical: "https://x/a.png",
        variants: {
          webp: "https://x/a.webp",
          png256: "https://x/a-256.png",
        },
        transform: "https://x/_optimize?path=a.png",
        capabilities: ["webp", "resize"],
      },
    });
    expect(Either.isRight(decoded)).toBe(true);
  });

  it("decodes optional animation_url sibling (FR-8)", () => {
    const decoded = Schema.decodeUnknownEither(MetadataDocument)({
      name: "Mibera #1234",
      description: "Test",
      image: "https://x/a.png",
      animation_url: "https://x/a.mp4",
    });
    expect(Either.isRight(decoded)).toBe(true);
  });

  it("rejects empty-string flat image (preserves Schema.minLength invariant)", () => {
    const decoded = Schema.decodeUnknownEither(MetadataDocument)({
      name: "Mibera #1234",
      description: "Test",
      image: "",
    });
    expect(Either.isLeft(decoded)).toBe(true);
  });
});

describe("MetadataImageStruct — sealed shape", () => {
  it("requires canonical (non-empty)", () => {
    expect(
      Either.isLeft(
        Schema.decodeUnknownEither(MetadataImageStruct)({ canonical: "" }),
      ),
    ).toBe(true);
  });

  it("optional variants is a string→string map", () => {
    expect(
      Either.isRight(
        Schema.decodeUnknownEither(MetadataImageStruct)({
          canonical: "a.png",
          variants: { "webp@1024": "a.webp", "webp@256": "a-256.webp" },
        }),
      ),
    ).toBe(true);
  });

  it("rejects unknown capabilities (sealed enum)", () => {
    expect(
      Either.isLeft(
        Schema.decodeUnknownEither(MetadataImageStruct)({
          canonical: "a.png",
          capabilities: ["webp", "rotate-90" as unknown as "resize"],
        }),
      ),
    ).toBe(true);
  });
});
