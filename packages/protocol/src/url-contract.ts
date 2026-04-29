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
 * URL contract version. v1 is the authored shape for the
 * `mature-freeside-operator-and-cutover` cycle. Breaking changes require a
 * version bump + deprecation window per Section 7 of the public doc.
 */
export const URL_CONTRACT_VERSION = '1.0.0' as const;

/**
 * The hostname under which the URL contract resolves. v1 locks this to
 * `assets.0xhoneyjar.xyz`. Future versions may add alternates (e.g.,
 * IPFS gateway origin failover); the host field becomes a discriminated
 * union at that point.
 */
export type AssetsHost = 'assets.0xhoneyjar.xyz';

/**
 * Top-level worlds the contract recognizes. Slugs match the
 * `freeside-worlds/packages/registry/worlds/{slug}.yaml` filenames AND the
 * top-level S3 prefix on `thj-assets`.
 */
export type WorldSlug = 'Mibera' | 'Purupuru' | 'sprawl';

/**
 * Allowed category sub-prefixes per world. Each world enumerates its
 * canonical categories. Routes outside this enum are LEGACY-shape and may
 * exist for grace-window compatibility (per `legacyRoutes`).
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
    | 'archetypes';
  Purupuru: 'cards' | 'layers' | 'archetypes' | 'sound';
  sprawl: 'rektdrop' | 'cubquests';
};

/**
 * Migration phase IDs. Each phase corresponds to a deferred future cycle
 * (per SDD §0.2). The current cycle is `sprint-1`; downstream cycles
 * (Mibera-2/3/4/rekey) extend the enum as they ship.
 */
export type MigrationPhaseId =
  | 'sprint-1'
  | 'mibera-2'
  | 'mibera-3'
  | 'mibera-4'
  | 'mibera-rekey';

/**
 * Backing layer for a route. v1 worlds back routes via S3, IPFS gateway,
 * Irys gateway, or remain pinned to the legacy CloudFront optimizer chain
 * (per ADR-006). Future versions add more backings as adapters land.
 */
export type RouteBacking =
  | 's3-thj-assets'
  | 'cloudfront-d163-optimizer'
  | 'ipfs-dweb'
  | 'irys-gateway'
  | 'thj-assets-direct';

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
          currentBacking: 'irys-gateway',
          migrationPhase: 'mibera-2',
          postPhaseBacking: 's3-thj-assets',
          description: 'Final mibera artwork (re-host from Irys in mibera-2)',
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
      ],
      legacyRoutes: [
        {
          pattern: '/images/reveal_phase{N}/{...}/{hash}.png',
          reason: 'Pre-canonical naming preserved during sprint-1 mirror; legacy shape retained for app compatibility',
          retiredBy: 'mibera-rekey',
          canonicalEquivalent: '/Mibera/reveal/phase{N}/{hash}.png',
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
      cycleName: 'mibera-2 (TBD)',
      scope: 'Re-host Mibera finals from Irys gateway to assets bucket; rewrite mibera-image-urls.json',
      affectedRoutes: ['Mibera/final/{tokenId}.png'],
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
  ],
  versioning: {
    policy: 'semver',
    breakingChangeRequires: 'major-bump-with-deprecation-window',
    deprecationWindow: '90d-min',
  },
};
