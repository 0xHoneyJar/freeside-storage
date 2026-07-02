import { describe, expect, it } from "vitest";

import {
  purupuruRowToDocument,
  purupuruRowToIngestItem,
} from "./purupuru-pg-extract.js";

describe("purupuruRowToDocument", () => {
  it("maps genesis row to MetadataDocument", () => {
    const doc = purupuruRowToDocument({
      token_id: 7,
      image_url: "https://ipfs.example/p7.png",
      genesis_element: "Wood",
      heavenly_stem_name: "Jia",
    });
    expect(doc.name).toBe("Purupuru #7");
    expect(doc.image).toBe("https://ipfs.example/p7.png");
    expect(doc.description).toContain("Wood");
    expect(doc.attributes).toEqual([
      { trait_type: "Element", value: "Wood" },
      { trait_type: "Heavenly Stem", value: "Jia" },
    ]);
  });
});

describe("purupuruRowToIngestItem", () => {
  it("uses decimal tokenId string for sovereign path", () => {
    const item = purupuruRowToIngestItem({
      token_id: 29,
      image_url: "https://ipfs.example/p29.png",
      genesis_element: null,
      heavenly_stem_name: null,
    });
    expect(item.tokenId).toBe("29");
    expect(item.document.name).toBe("Purupuru #29");
  });
});
