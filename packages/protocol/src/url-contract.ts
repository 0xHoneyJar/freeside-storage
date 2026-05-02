/**
 * URL Contract — Tier 1 schema-bridge for `assets.0xhoneyjar.xyz`.
 *
 * Per SDD §0.2 (per-world URL contract) + §0.3 (contracts-as-bridges
 * instance-N reframe). The schema is the durable artifact; the doc
 * (`loa-freeside/docs/asset-url-contract.md`) is the human surface.
 *
 * Consumers READ this contract; never re-derive it from prose:
 *   - construct-freeside skill `coordinating-cutover` (planning input)
 *   - construct-freeside skill `mirroring-storage` (path validation)
 *   - Future Mibera-2/3/4/rekey cycles (programmatic phase consumption)
 *   - Adeitasuna's MibeStats (codegens client types from JSON Schema)
 *   - Any future external builder
 */

/**
 * URL contract version. v1.0 was the authored shape for the
 * `mature-freeside-operator-and-cutover` cycle (assets-host only).
 * v1.1 (cross-collection-sovereignty cycle, 2026-05-01) introduced the
 * companion sovereign metadata host + cf-function-kv-manifest backing +
 * 3 sovereignty migration phase IDs.
 * v1.2 (mibera-family-sticker-substrate cycle, 2026-05-02) adds Mibera-family
 * sub-collection prefixes (Shadow + MST under /Mibera/) for sticker substrate
 * publishing — companion to the composable-sticker-substrate consumer-side
 * cycle that shipped 2026-05-02 via freeside-storage#4 + mibera-dimensions#206.
 * All bumps additive-only — no consumer breakage. Breaking changes require
 * a major bump + deprecation window per Section 7.
 */
export const URL_CONTRACT_VERSION = '1.2.0' as const;

/**
 * The hostname under which the URL contract resolves. v1 locks this to
 * `assets.0xhoneyjar.xyz`. Future versions may add alternates (e.g.,
 * IPFS gateway origin failover); the host field becomes a discriminated
 * union at that point.
 */
export type AssetsHost = 'assets.0xhoneyjar.xyz';

/**
 * Sovereign metadata host. Companion to `AssetsHost`: where AssetsHost
 * serves immutable image bytes, MetadataHost serves the JSON manifest that
 * links those bytes to NFT identity. Backed by a CloudFront Function +
 * KV pointer (see `RouteBacking: 'cf-function-kv-manifest'`); the manifest
 * payload itself lives at `s3://thj-assets/mibera/{collection}/metadata/v/{ver}/`.
 *
 * Introduced in v1.1.0 (cross-collection-sovereignty cycle, 2026-05-01).
 */
export type MetadataHost = 'metadata.0xhoneyjar.xyz';

/**
 * `MetadataHost` as a const value. SDK code that constructs sovereign
 * manifest URLs without going through `lookupSovereignManifest` may import
 * this directly.
 */
export const METADATA_HOST: MetadataHost = 'metadata.0xhoneyjar.xyz';

/**
 * Top-level worlds the contract recognizes. Slugs match the
 * `freeside-worlds/packages/registry/worlds/{slug}.yaml` filenames AND the
 * top-level S3 prefix on `thj-assets`.
 */
export type WorldSlug = 'Mibera' | 'Purupuru' | 'sprawl';

/**
 * Mibera-family sub-collection slugs. Treated as second-segment prefixes
 * under the `Mibera` world so that paths take the shape
 * `/Mibera/{SubCollection}/expressions/...` — operator's canonical 2026-05-02
 * framing (sub-collections are NOT top-level worlds; they're nested under
 * Mibera). Each sub-collection has its own `expressions/` (sticker) sub-tree
 * mirroring Mibera's canonical sticker layout.
 *
 * Introduced in v1.2.0 (mibera-family-sticker-substrate cycle).
 *
 * Forward-compat: as new Mibera-family collections ship sticker substrate
 * (Tarot, Candies, GIF, Fractures, …) they extend this union. The cycle
 * `cross-collection-sovereignty-2026-05-01` already touches metadata for
 * those four; sticker substrate is the next layer.
 */
export type MiberaSubCollection = 'Shadow' | 'MST';

/**
 * Allowed category sub-prefixes per world. Each world enumerates its
 * canonical categories. Routes outside this enum are LEGACY-shape and may
 * exist for grace-window compatibility (per `legacyRoutes`).
 *
 * Mibera includes Mibera-family sub-collection slugs (Shadow, MST, …) as
 * categories — see `MiberaSubCollection`. The path shape under those is
 * `/Mibera/{SubCollection}/expressions/{version}/{tokenId}/{variant}/{expr}.webp`
 * plus the `current.json` manifest at `/Mibera/{SubCollection}/expressions/`.
 */
export type CategoryByWorld = {
  Mibera:
    | 'final'
    | 'reveal'
    | 'parcels'
    | 'miladies'
    | 'traits'
    | 'og'
    | 'generated'
    | 'expressions'
    | 'layers'
    | 'archetypes'
    | MiberaSubCollection;
  Purupuru: 'cards' | 'layers' | 'archetypes' | 'sound';
  sprawl: 'rektdrop' | 'cubquests';
};

/**
 * Migration phase IDs. Each phase corresponds to a (past or future) cycle
 * that re-hosts a slice of the URL contract.
 *
 * Asset-host phases (sprint-1 / mibera-2 / mibera-3 / mibera-4 / mibera-rekey)
 * track migrations of the bytes themselves on `assets.0xhoneyjar.xyz`.
 *
 * Sovereignty phases (mibera-sovereign-cutover / mst-sovereign-cutover /
 * cross-collection-sovereign) — added in v1.1.0 — track migrations of the
 * manifest-host pointer on `metadata.0xhoneyjar.xyz`. They flip on-chain
 * `tokenURI`/`uri` from honeyroad's Vercel app to the sovereign manifest
 * pattern (CF Function + KV pointer + S3 manifest payload).
 */
export type MigrationPhaseId =
  | 'sprint-1'
  | 'mibera-2'
  | 'mibera-3'
  | 'mibera-4'
  | 'mibera-rekey'
  | 'mibera-sovereign-cutover'
  | 'mst-sovereign-cutover'
  | 'cross-collection-sovereign'
  | 'mibera-family-sticker-substrate';

/**
 * Backing layer for a route. v1 worlds back routes via S3, IPFS gateway,
 * Irys gateway, or remain pinned to the legacy CloudFront optimizer chain
 * (per ADR-006). v1.1 adds `cf-function-kv-manifest` — the sovereign
 * manifest substrate (CloudFront Function reads a KV pointer per
 * `{world}/[{collection}/]{tokenId}` key, redirects to the versioned S3
 * manifest payload). Future versions add more backings as adapters land.
 */
export type RouteBacking =
  | 's3-thj-assets'
  | 'cloudfront-d163-optimizer'
  | 'ipfs-dweb'
  | 'irys-gateway'
  | 'thj-assets-direct'
  | 'cf-function-kv-manifest';

/**
 * A single canonical route within a world. The shape of `path` follows the
 * template `assets.0xhoneyjar.xyz/{world}/{category}/{...rest}`.
 *
 * `currentBacking` is what serves the route TODAY (sprint-1 close).
 * `postCycleBacking` is what serves it AFTER the named migration phase.
 */
export interface CanonicalRoute {
  /** World slug — top-level S3 prefix */
  world: WorldSlug;
  /** Category — second path segment */
  category: string;
  /** Pattern after `{world}/{category}/` (e.g. "{tokenId}.png", "{hash}.png") */
  pattern: string;
  /** Where bytes resolve TODAY (post-sprint-1) */
  currentBacking: RouteBacking;
  /** Optional migration phase that re-hosts this route (per SDD §0.2) */
  migrationPhase?: MigrationPhaseId;
  /** Where bytes resolve AFTER the migration phase ships */
  postPhaseBacking?: RouteBacking;
  /** Optional human description for the doc surface */
  description?: string;
}

/**
 * Legacy route shape preserved for compatibility. After Mibera-rekey, these
 * gain redirects to canonical routes (CloudFront function or S3 redirect
 * rules); after the grace window, they are deprecated.
 */
export interface LegacyRoute {
  /** Pattern as-served today (e.g. "/images/reveal_phase{N}/{...}/{hash}.png") */
  pattern: string;
  /** Reason kept (typically: pre-canonical naming preserved during sprint-1 mirror) */
  reason: string;
  /** Migration phase that retires the legacy shape */
  retiredBy?: MigrationPhaseId;
  /** Canonical route the legacy shape maps to (post-retire) */
  canonicalEquivalent?: string;
}

/**
 * One world's section of the URL contract. Per SDD §0.3 Tier 2, the
 * `prefix` field is also exposed on the world's `freeside-worlds` registry
 * entry as a future minor (additive). Sprint-1 ships Tier 1 only; the Tier-2
 * extension is the next compositional move.
 */
export interface WorldContract {
  slug: WorldSlug;
  /** The S3 / asset-host prefix (matches `slug` for v1; extracted for forward-compat) */
  prefix: string;
  /** Allowed categories (Tier 2 extension home) */
  categories: string[];
  /** Canonical routes (≥1 row) */
  routes: CanonicalRoute[];
  /** Legacy routes preserved for grace window */
  legacyRoutes?: LegacyRoute[];
  /** Public doc reference (deep-link into asset-url-contract.md) */
  docAnchor?: string;
}

/**
 * Migration phase metadata. Each phase carries: its scope, the routes it
 * re-hosts, the future-cycle shape it implies. Phase IDs match
 * `MigrationPhaseId`.
 */
export interface MigrationPhase {
  id: MigrationPhaseId;
  /** Cycle name (e.g. "mature-freeside-operator-and-cutover") */
  cycleName: string;
  /** What this phase ships */
  scope: string;
  /** Routes touched (cross-references CanonicalRoute.migrationPhase) */
  affectedRoutes: string[];
  /** ISO date when this phase shipped, or null if future */
  shippedAt: string | null;
}

/**
 * The full contract — what `url-contract.schema.json` describes.
 */
export interface URLContract {
  /** Schema version — semver. Bumps on breaking changes. */
  version: typeof URL_CONTRACT_VERSION;
  /** Asset hostname (locked at v1) */
  host: AssetsHost;
  /** Canonical template the contract enforces */
  template: 'assets.0xhoneyjar.xyz/{world}/{category}/{...}';
  /** Per-world contracts */
  worlds: WorldContract[];
  /** Migration phase roster (current + future) */
  migrationPhases: MigrationPhase[];
  /** Versioning policy summary (links to public doc Section 7) */
  versioning: {
    policy: 'semver';
    breakingChangeRequires: 'major-bump-with-deprecation-window';
    deprecationWindow: '90d-min';
  };
}

/**
 * Validate a path against the canonical template. Returns true if the path
 * matches `{world}/{category}/{...}` with `{world}` in `WorldSlug` and
 * `{category}` in the world's allowed categories.
 *
 * NOTE: this is a TS-side helper. Runtime validators (ajv) consume the
 * JSON Schema co-located at `packages/protocol/url-contract.schema.json`.
 */
export function isCanonicalPath(
  contract: URLContract,
  path: string,
): boolean {
  const trimmed = path.replace(/^\/+/, '');
  const parts = trimmed.split('/');
  if (parts.length < 2) return false;

  const worldPart = parts[0];
  if (!worldPart) return false;

  const world = contract.worlds.find((w) => w.prefix === worldPart);
  if (!world) return false;

  if (parts.length === 1) {
    return false; // path must include a category
  }

  const categoryPart = parts[1];
  if (!categoryPart) return false;

  return world.categories.includes(categoryPart);
}

/**
 * The default v1 contract instance — the authored shape that ships in
 * sprint-1. Consumers MAY import this directly OR fetch the JSON Schema
 * via the schema's `$id` and ajv-validate.
 */
export const URL_CONTRACT_V1: URLContract = {
  version: URL_CONTRACT_VERSION,
  host: 'assets.0xhoneyjar.xyz',
  template: 'assets.0xhoneyjar.xyz/{world}/{category}/{...}',
  worlds: [
    {
      slug: 'Mibera',
      prefix: 'Mibera',
      categories: [
        'final',
        'reveal',
        'parcels',
        'miladies',
        'traits',
        'og',
        'generated',
        'expressions',
        'layers',
        'archetypes',
        // v1.2.0 — Mibera-family sub-collection prefixes (sticker substrate).
        // Path shape: /Mibera/{SubCollection}/expressions/...
        'Shadow',
        'MST',
      ],
      routes: [
        {
          world: 'Mibera',
          category: 'generated',
          pattern: '{tokenId}.webp',
          currentBacking: 's3-thj-assets',
          description: 'Generated mibera token render',
        },
        {
          world: 'Mibera',
          category: 'final',
          pattern: '{tokenId}.png',
          currentBacking: 's3-thj-assets',
          migrationPhase: 'mibera-2',
          postPhaseBacking: 's3-thj-assets',
          description:
            'Final mibera artwork. The bytes already live on s3 thj-assets at the legacy ' +
            '`reveal_phase{1..8}/images/{hash}.png` shape (see legacyRoutes). Codex / consumer ' +
            'apps may flip from `gateway.irys.xyz/...` directly to `assets.0xhoneyjar.xyz/' +
            'reveal_phase8/images/{hash}.png` today (literal hash-keyed swap, no cycle blocker). ' +
            'mibera-2 is now an OPTIONAL cycle that rekeys those legacy paths to the canonical ' +
            'tokenId-keyed `Mibera/final/{tokenId}.png` shape; the codex flip works without it.',
        },
        {
          world: 'Mibera',
          category: 'reveal',
          pattern: 'phase{N}/{hash}.png',
          currentBacking: 'cloudfront-d163-optimizer',
          description: 'Phase reveal artwork',
        },
        {
          world: 'Mibera',
          category: 'parcels',
          pattern: '{id}.png',
          currentBacking: 'thj-assets-direct',
          migrationPhase: 'mibera-3',
          postPhaseBacking: 's3-thj-assets',
          description: 'Mibera parcel image (re-host from S3-direct in mibera-3)',
        },
        {
          world: 'Mibera',
          category: 'miladies',
          pattern: '{id}.png',
          currentBacking: 'thj-assets-direct',
          migrationPhase: 'mibera-3',
          postPhaseBacking: 's3-thj-assets',
          description: 'Mibera milady image (re-host in mibera-3)',
        },
        {
          world: 'Mibera',
          category: 'reveal',
          pattern: 'phase1.1/{hash}.png',
          currentBacking: 'ipfs-dweb',
          migrationPhase: 'mibera-4',
          postPhaseBacking: 's3-thj-assets',
          description: 'IPFS-pinned reveal phase 1.1 (re-host in mibera-4)',
        },
        // v1.2.0 — Mibera-family sub-collection sticker substrate.
        // Companion to composable-sticker-substrate-2026-05-01 consumer side
        // (freeside-storage#4 + mibera-dimensions#206 SHIPPED 2026-05-02).
        // Manifest shape matches StickerProfile from @freeside-storage/stickers.
        //
        // CONTRACT-AHEAD-OF-SUBSTRATE NOTE: routes below are registered before
        // their substrate bytes exist. Consumers enumerating canonical routes
        // for liveness should JOIN against `migrationPhases` and skip routes
        // whose `migrationPhase.shippedAt === null`:
        //   const phase = contract.migrationPhases.find(p => p.id === route.migrationPhase);
        //   if (phase?.shippedAt == null) skip;  // not yet live
        // Per shadow-traits.md (construct-mibera-codex), Shadow ≡ MST (alias —
        // narrative name vs technical contract symbol "Mibera Shadow Traits").
        // Both path conventions registered for transitional consumer compat.
        {
          world: 'Mibera',
          category: 'Shadow',
          pattern: 'expressions/current.json',
          currentBacking: 's3-thj-assets',
          migrationPhase: 'mibera-family-sticker-substrate',
          postPhaseBacking: 's3-thj-assets',
          description:
            'Mibera Shadow sticker manifest — StickerProfile shape per ' +
            '@freeside-storage/stickers v0.0.x. Consumer-side wired but ' +
            'substrate-side pending (returns 403 until M-1 bucket policy + ' +
            'M-3 manifest publish lands).',
        },
        {
          world: 'Mibera',
          category: 'Shadow',
          pattern: 'expressions/{version}/{tokenId}/{variant}/{expr}.webp',
          currentBacking: 's3-thj-assets',
          migrationPhase: 'mibera-family-sticker-substrate',
          postPhaseBacking: 's3-thj-assets',
          description:
            'Mibera Shadow per-token sticker render. Default variant: ' +
            '`transparent`. `{version}` matches manifest.version (e.g. v1). ' +
            '`{expr}` is one of the manifest.variants[*] expression slugs.',
        },
        {
          world: 'Mibera',
          category: 'MST',
          pattern: 'expressions/current.json',
          currentBacking: 's3-thj-assets',
          migrationPhase: 'mibera-family-sticker-substrate',
          postPhaseBacking: 's3-thj-assets',
          description:
            'MST sticker manifest — 3219 known tokens. MST = "Mibera Shadow ' +
            'Traits" (on-chain symbol; narratively "Shadow" — see Shadow ' +
            'category routes above for the alias path). Sovereign metadata at ' +
            'metadata.0xhoneyjar.xyz/mibera/mst/{N} (shipped 2026-05-01 via ' +
            'mst-sovereign-cutover); sticker assets are the next layer.',
        },
        {
          world: 'Mibera',
          category: 'MST',
          pattern: 'expressions/{version}/{tokenId}/{variant}/{expr}.webp',
          currentBacking: 's3-thj-assets',
          migrationPhase: 'mibera-family-sticker-substrate',
          postPhaseBacking: 's3-thj-assets',
          description:
            'MST per-token sticker render (alias of Shadow path above — same ' +
            'collection). Mirrors the Mibera convention. Source generation ' +
            'pipeline TBD per M-2 of the substrate handoff.',
        },
      ],
      legacyRoutes: [
        {
          pattern: '/images/reveal_phase{N}/{...}/{hash}.png',
          reason: 'Pre-canonical naming preserved during sprint-1 mirror; legacy shape retained for app compatibility (optimizer chain)',
          retiredBy: 'mibera-rekey',
          canonicalEquivalent: '/Mibera/reveal/phase{N}/{hash}.png',
        },
        {
          pattern: '/reveal_phase{N}/images/{hash}.png',
          reason:
            'Depth-2 hash-keyed PNGs at /reveal_phase{1..8}/images/. ' +
            'Phase 8 is the canonical/latest reveal rendering (per Gumi 2026-04-29). ' +
            'Codex `mibera-image-urls.json` consumers can flip from Irys directly to this ' +
            'shape via the new CDN — bytes already live in thj-assets; no cycle dependency.',
          retiredBy: 'mibera-2',
          canonicalEquivalent: '/Mibera/final/{tokenId}.png',
        },
      ],
      docAnchor: '#mibera',
    },
    {
      slug: 'Purupuru',
      prefix: 'Purupuru',
      categories: ['cards', 'layers', 'archetypes', 'sound'],
      routes: [
        {
          world: 'Purupuru',
          category: 'cards',
          pattern: '{cardId}.webp',
          currentBacking: 's3-thj-assets',
          description: 'Purupuru card artwork',
        },
        {
          world: 'Purupuru',
          category: 'layers',
          pattern: '{layerId}.webp',
          currentBacking: 's3-thj-assets',
          description: 'Purupuru layered render assets',
        },
      ],
      docAnchor: '#purupuru',
    },
    {
      slug: 'sprawl',
      prefix: 'sprawl',
      categories: ['rektdrop', 'cubquests'],
      routes: [
        {
          world: 'sprawl',
          category: 'rektdrop',
          pattern: '{...}.webp',
          currentBacking: 's3-thj-assets',
          description: 'Rektdrop static assets',
        },
        {
          world: 'sprawl',
          category: 'cubquests',
          pattern: '{...}.webp',
          currentBacking: 's3-thj-assets',
          description: 'CubQuests static assets',
        },
      ],
      docAnchor: '#sprawl',
    },
  ],
  migrationPhases: [
    {
      id: 'sprint-1',
      cycleName: 'mature-freeside-operator-and-cutover',
      scope: 'Establish assets.0xhoneyjar.xyz parallel CloudFront against thj-assets bucket; mirror *.webp fast-path; preserve legacy URL shapes',
      affectedRoutes: ['Mibera/generated/{tokenId}.webp'],
      shippedAt: null,
    },
    {
      id: 'mibera-2',
      cycleName: 'mibera-2 (TBD; OPTIONAL polish — not a blocker for codex flip)',
      scope:
        'Rekey legacy `reveal_phase{1..8}/images/{hash}.png` (depth-2, hash-keyed) → canonical ' +
        '`Mibera/final/{tokenId}.png` (depth-3, tokenId-keyed). The bytes already live in ' +
        'thj-assets; codex consumers can flip from Irys to `assets.0xhoneyjar.xyz/reveal_phase8/' +
        'images/{hash}.png` TODAY without this cycle. mibera-2 is canonical-name polish only — ' +
        'a follow-up that lets the URL contract reach steady state.',
      affectedRoutes: ['Mibera/final/{tokenId}.png', '/reveal_phase{N}/images/{hash}.png'],
      shippedAt: null,
    },
    {
      id: 'mibera-3',
      cycleName: 'mibera-3 (TBD)',
      scope: 'Re-host parcels + miladies from S3-direct to assets bucket; update CSP allowlists',
      affectedRoutes: ['Mibera/parcels/{id}.png', 'Mibera/miladies/{id}.png'],
      shippedAt: null,
    },
    {
      id: 'mibera-4',
      cycleName: 'mibera-4 (TBD)',
      scope: 'Re-host IPFS-pinned reveal phase 1.1 from dweb gateway to assets bucket',
      affectedRoutes: ['Mibera/reveal/phase1.1/{hash}.png'],
      shippedAt: null,
    },
    {
      id: 'mibera-rekey',
      cycleName: 'mibera-rekey (TBD; after mibera-2/3/4)',
      scope: 'Single rekey pass: legacy /images/reveal_phase{N}/... → canonical /Mibera/reveal/phase{N}/...; provide redirects for grace window; deprecate legacy on published timeline',
      affectedRoutes: ['/images/reveal_phase{N}/{...}/{hash}.png'],
      shippedAt: null,
    },
    {
      id: 'mibera-sovereign-cutover',
      cycleName: 'migrate-mibera-sovereignty-2026-05-01',
      scope:
        'Flip canon Mibera tokenURI(N) from honeyroad to ' +
        'metadata.0xhoneyjar.xyz/mibera/{N}; provision CF Function + KV ' +
        'pointer + S3 manifest payload (manifest pattern, dogfooded).',
      affectedRoutes: ['metadata.0xhoneyjar.xyz/mibera/{N}'],
      shippedAt: '2026-05-01',
    },
    {
      id: 'mst-sovereign-cutover',
      cycleName: 'migrate-mst-sovereignty-2026-05-01',
      scope:
        'Flip MST (Mibera Shadows) tokenURI(N) to ' +
        'metadata.0xhoneyjar.xyz/mibera/mst/{N}. World-scoped hierarchy ' +
        '(amendment A2) — CF Function dispatches both single-segment ' +
        '(canon namesake) and two-segment (sibling) shapes from one origin.',
      affectedRoutes: ['metadata.0xhoneyjar.xyz/mibera/mst/{N}'],
      shippedAt: '2026-05-01',
    },
    {
      id: 'cross-collection-sovereign',
      cycleName: 'cross-collection-sovereignty-2026-05-01',
      scope:
        'Roll out the manifest pattern to remaining Mibera-world collections ' +
        '(Tarot, GIF, Candies). Each collection ships its own per-world setBaseURI ' +
        'with KV pointer + S3 manifest payload + per-collection composition adapter. ' +
        'Distills the recipe into construct-freeside as `synthesizing-from-postgres`.',
      affectedRoutes: [
        'metadata.0xhoneyjar.xyz/mibera/tarot/{N}',
        'metadata.0xhoneyjar.xyz/mibera/gif/{N}',
        'metadata.0xhoneyjar.xyz/mibera/candies/{id}',
      ],
      shippedAt: null,
    },
    {
      id: 'mibera-family-sticker-substrate',
      cycleName: 'mibera-family-sticker-substrate-2026-05-02',
      scope:
        'Publish Mibera-family sub-collection sticker substrate at ' +
        '/Mibera/{SubCollection}/expressions/... — Shadow + MST first; ' +
        'Tarot/Candies/GIF follow as their generation pipelines land. ' +
        'Companion to composable-sticker-substrate-2026-05-01 consumer side ' +
        '(SHIPPED 2026-05-02 via freeside-storage#4 + mibera-dimensions#206). ' +
        'Substrate-side deliverables: M-1 bucket policy · M-2 generation pipeline ' +
        '· M-3 manifest publish (current.json) · M-4 URL contract (this PR) · ' +
        'M-5 verification probes.',
      affectedRoutes: [
        'Mibera/Shadow/expressions/current.json',
        'Mibera/Shadow/expressions/{version}/{tokenId}/{variant}/{expr}.webp',
        'Mibera/MST/expressions/current.json',
        'Mibera/MST/expressions/{version}/{tokenId}/{variant}/{expr}.webp',
      ],
      shippedAt: null,
    },
  ],
  versioning: {
    policy: 'semver',
    breakingChangeRequires: 'major-bump-with-deprecation-window',
    deprecationWindow: '90d-min',
  },
};
