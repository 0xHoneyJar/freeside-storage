/**
 * @0xhoneyjar/asset-pipeline — Self-hosted Cloudinary/Vercel-Image substrate.
 *
 * Per asset-pipeline-substrate-2026-05-03 cycle (cycle B). Metadata declares
 * variants · Lambda materializes them · consumers READ. Effect-Schema-sealed
 * AssetService for Discord/PFP/marketplace constraints.
 *
 * Public surface (per SDD §8.1 exports):
 *   - schema:  AssetReference + ConsumerConstraint + AssetVariant + AssetError
 *   - service: AssetService Tag + Live + Test layers
 *   - parse:   parseImage helper (re-export from @freeside-storage/protocol)
 *
 * Doctrine: ~/vault/wiki/concepts/asset-pipeline-as-mutable-cdn-substrate.md
 *           (operator-validated 0.80 confidence)
 */

// Schema layer (sealed Effect Schema)
export * from "./schema/index.js";

// Service layer (AssetService Tag + Live/Test layers)
export * from "./service/index.js";

// Parse helpers (re-export from protocol for convenience)
export * from "./parse/index.js";
