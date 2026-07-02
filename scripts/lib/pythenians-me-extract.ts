import { appendFileSync, existsSync, readFileSync } from "node:fs";

import type { MetadataDocument } from "@0xhoneyjar/freeside-protocol";
import type { IngestItem } from "@freeside-storage/client";

const ME_TOKEN_URL = "https://api-mainnet.magiceden.dev/v2/tokens";

export interface MeTokenResponse {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type?: string; value?: string | number }>;
}

export interface ExtractPytheniansOptions {
  mints: readonly string[];
  concurrency?: number;
  checkpointPath?: string;
  fetchImpl?: typeof fetch;
}

export interface ExtractPytheniansResult {
  items: IngestItem[];
  completed: number;
  skipped: number;
  failed: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Persisted fetch checkpoint — includes the document so resume survives pre-ingest crashes. */
export interface CheckpointRow {
  mint: string;
  status: "fetched";
  tokenId: string;
  document: MetadataDocument;
}

export function loadCheckpointItems(path: string): Map<string, IngestItem> {
  const items = new Map<string, IngestItem>();
  if (!existsSync(path)) return items;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as Partial<CheckpointRow>;
      if (
        row.mint &&
        row.status === "fetched" &&
        row.tokenId &&
        row.document &&
        typeof row.document.image === "string"
      ) {
        items.set(row.mint, { tokenId: row.tokenId, document: row.document });
      }
    } catch {
      // ignore malformed checkpoint lines
    }
  }
  return items;
}

/** @deprecated Use loadCheckpointItems — kept for tests migrating off mint-only rows. */
export function loadCheckpointMints(path: string): Set<string> {
  return new Set(loadCheckpointItems(path).keys());
}

export function appendCheckpoint(path: string, item: IngestItem): void {
  const row: CheckpointRow = {
    mint: item.tokenId,
    status: "fetched",
    tokenId: item.tokenId,
    document: item.document,
  };
  appendFileSync(path, `${JSON.stringify(row)}\n`, "utf8");
}

export function meTokenToDocument(mint: string, token: MeTokenResponse): MetadataDocument | null {
  const image = token.image?.trim();
  if (!image) return null;
  const attributes =
    token.attributes
      ?.filter((a) => a.trait_type != null && a.value != null)
      .map((a) => ({
        trait_type: String(a.trait_type),
        value: a.value as string | number,
      })) ?? [];
  return {
    name: token.name?.trim() || `Pythenians ${mint.slice(0, 4)}`,
    description: token.description?.trim() || "Pythenians genesis NFT",
    image,
    ...(attributes.length > 0 ? { attributes } : {}),
  };
}

export async function fetchMeToken(
  mint: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MeTokenResponse | null> {
  const maxAttempts = 6;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetchImpl(`${ME_TOKEN_URL}/${mint}`, {
        headers: { Accept: "application/json" },
      });
      if (res.status === 429 || res.status >= 500) {
        const backoff = Math.min(1000 * 2 ** attempt, 30_000);
        await sleep(backoff);
        continue;
      }
      if (!res.ok) return null;
      return (await res.json()) as MeTokenResponse;
    } catch {
      return null;
    }
  }
  return null;
}

async function mapPool<T, U>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

export async function extractPytheniansFromMe(
  options: ExtractPytheniansOptions,
): Promise<ExtractPytheniansResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const concurrency = options.concurrency ?? 6;
  const checkpointPath = options.checkpointPath;
  const checkpointItems = checkpointPath
    ? loadCheckpointItems(checkpointPath)
    : new Map<string, IngestItem>();

  const items: IngestItem[] = [];
  for (const mint of options.mints) {
    const cached = checkpointItems.get(mint);
    if (cached) items.push(cached);
  }

  const pending = options.mints.filter((mint) => !checkpointItems.has(mint));
  const failed: string[] = [];
  const fetched: IngestItem[] = [];

  await mapPool(pending, concurrency, async (mint) => {
    const token = await fetchMeToken(mint, fetchImpl);
    const document = token ? meTokenToDocument(mint, token) : null;
    if (!document) {
      failed.push(mint);
      return;
    }
    const item = { tokenId: mint, document };
    fetched.push(item);
    if (checkpointPath) appendCheckpoint(checkpointPath, item);
  });

  items.push(...fetched);

  return {
    items,
    completed: fetched.length,
    skipped: options.mints.length - pending.length,
    failed,
  };
}
