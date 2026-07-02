import pg from "pg";

import type { MetadataDocument } from "@0xhoneyjar/freeside-protocol";
import type { IngestItem } from "@freeside-storage/client";

export interface PurupuruGenesisRow {
  token_id: number;
  image_url: string;
  genesis_element: string | null;
  heavenly_stem_name: string | null;
}

/** Read-only export — see external-collection-metadata-onboarding.md */
export const PURUPURU_GENESIS_SQL = `
SELECT
  g.token_id,
  g.image_url,
  g.genesis_element,
  g.heavenly_stem_name
FROM puru_token_genesis g
WHERE g.image_url IS NOT NULL
  AND g.image_url <> ''
ORDER BY g.token_id ASC
`;

export function purupuruRowToDocument(row: PurupuruGenesisRow): MetadataDocument {
  const element = row.genesis_element?.trim();
  const description = element
    ? `Purupuru genesis · ${element}`
    : "Purupuru genesis NFT";
  const attributes: MetadataDocument["attributes"] = [];
  if (element) {
    attributes.push({ trait_type: "Element", value: element });
  }
  if (row.heavenly_stem_name?.trim()) {
    attributes.push({
      trait_type: "Heavenly Stem",
      value: row.heavenly_stem_name.trim(),
    });
  }
  return {
    name: `Purupuru #${row.token_id}`,
    description,
    image: row.image_url,
    ...(attributes.length > 0 ? { attributes } : {}),
  };
}

export function purupuruRowToIngestItem(row: PurupuruGenesisRow): IngestItem {
  return {
    tokenId: String(row.token_id),
    document: purupuruRowToDocument(row),
  };
}

export interface ExtractPurupuruOptions {
  databaseUrl?: string;
  limit?: number;
}

export async function extractPurupuruGenesis(
  options: ExtractPurupuruOptions = {},
): Promise<IngestItem[]> {
  const databaseUrl = options.databaseUrl ?? process.env.PURUPURU_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("PURUPURU_DATABASE_URL is required for purupuru-pg extract");
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const sql =
      options.limit != null
        ? `${PURUPURU_GENESIS_SQL.trim()}\nLIMIT $1`
        : PURUPURU_GENESIS_SQL;
    const params = options.limit != null ? [options.limit] : [];
    const result = await client.query<PurupuruGenesisRow>(sql, params);
    return result.rows.map(purupuruRowToIngestItem);
  } finally {
    await client.end();
  }
}
