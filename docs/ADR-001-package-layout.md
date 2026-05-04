# ADR-001: `freeside-storage` Package Layout — Lean Instance-1

**Date**: 2026-04-29
**Status**: Accepted
**Cycle**: `mature-freeside-operator-and-cutover` (Sprint 1)
**Authors**: opus-4-7-1m + zksoju (operator approval)
**Lock-source**: SDD §0 L4 + §6.2; PRD D2 (rename) + D5 (lean cluster); doctrine [[freeside-modules-as-installables]]

## Context

`freeside-storage` was scaffolded 2026-04-28 as `freeside-metadata`, renamed to
`freeside-filesystem` later that day, and renamed again to `freeside-storage`
2026-04-29 during this cycle. The repo has been a stub since creation —
README + INTENT only, no source. Sprint 1 of `mature-freeside-operator-and-cutover`
is the first cycle that puts content in.

The README's ["Intended scope"](../README.md#intended-scope) section enumerates
six possible packages: `protocol`, `adapters`, `storage-layouts`, `cdn-config`,
`cli`, plus the docs surface. Putting all six in motion at once would burst
[[freeside-modules-as-installables]] doctrine — *design with module boundaries
from day 1; let extraction follow when it earns the cycles* — and would also
contradict PRD D5 (lean cluster: 3 net-new skills, not a kitchen sink).

This ADR locks the **lean instance-1** shape: only what cycle-1 actually
consumes ships. Everything else stays in the README's "Intended scope" as
declared shape with no source.

## Decision

| ID | Decision | In/Out for cycle-1 |
|---|---|---|
| **A** | `packages/protocol/` is the schema source-of-truth (StorageAdapter interface + types + URL contract) | **IN** |
| **B** | `packages/adapters/s3/` ships in instance-1 (the only adapter for cycle-1) | **IN** |
| **C** | `packages/adapters/{ipfs,arweave,irys}/` are NOT shipped in instance-1 | **OUT** |
| **D** | `packages/cli/freeside-storage` is NOT shipped in instance-1 | **OUT** |
| **E** | `packages/storage-layouts/` is NOT shipped in instance-1 | **OUT** |
| **F** | `packages/cdn-config/` is NOT shipped in instance-1 | **OUT** |
| **G** | `StorageAdapter` is the common contract; per-adapter narrow extensions are escape hatches | **IN** |
| **H** | `packages/protocol/` exports both TS interfaces AND a JSON Schema (`url-contract.schema.json`); ajv-runtime check at consumer boundary | **IN** |

### What ships (instance-1 lean)

```
freeside-storage/
├── README.md
├── package.json                                 (renamed: freeside-storage)
├── pnpm-workspace.yaml                          (NEW)
├── tsconfig.base.json                           (NEW)
├── docs/
│   ├── INTENT.md
│   └── ADR-001-package-layout.md                (this file)
└── packages/
    ├── protocol/
    │   ├── package.json                         (npm scope: @0xhoneyjar/freeside-protocol)
    │   ├── tsconfig.json                        (NEW)
    │   ├── README.md
    │   └── src/
    │       ├── StorageAdapter.ts                (NEW — common interface)
    │       ├── types.ts                         (NEW — StorageKey, StorageObject, SyncResult, ParityReport)
    │       └── index.ts                         (NEW — barrel)
    └── adapters/
        └── s3/
            ├── package.json                     (NEW — @freeside-storage/adapters-s3)
            ├── tsconfig.json                    (NEW)
            ├── README.md                        (NEW)
            └── src/
                ├── S3Adapter.ts                 (NEW — implements StorageAdapter + S3 extensions)
                ├── crossAccount.ts              (NEW — assumed-role helper, kept for future cross-account work)
                └── index.ts                     (NEW)
```

### What does NOT ship

`packages/adapters/{ipfs,arweave,irys}/`, `packages/cli/`,
`packages/storage-layouts/`, `packages/cdn-config/`. These are reserved
scaffolds in the README's "Intended scope" but explicitly deferred per
ADR-001-C/D/E/F. They earn placement when:

- An adapter has a real consumer (Mibera-2/3/4 cycles per SDD §0.2 may
  surface IPFS/Irys readers as candidate adapters)
- The CLI surface has a use case distinct from the Node API consumers
  (gaib-cli covers ops; freeside-storage CLI would cover authoring)
- A second world replicates a storage-layout pattern that wants codifying
- A second consumer wants the terraform fragment shape that lives today
  in `loa-freeside/infrastructure/terraform/freeside-storage/`

## Rationale

1. **Lean by design**: doctrine [[freeside-modules-as-installables]] says the
   shape exists from day 1; content earns its way in. Six pre-built packages
   on day 1 is over-investment. Two packages with one consumer (Sprint 1's
   `mirroring-storage` SKILL) is calibrated.
2. **Single forcing function**: `mirroring-storage` consumes the
   `StorageAdapter` interface from `packages/protocol/` and instantiates the
   S3 adapter from `packages/adapters/s3/`. The interface earns its shape
   from the consumer; the consumer earns its shape from the cutover (per
   PRD §4.2.B for Phase 0).
3. **Construct composition without coupling (L4)**: both `the-orchard`'s
   `tending-storage` SKILL and `construct-freeside`'s `mirroring-storage`
   SKILL can consume `StorageAdapter` without a construct-to-construct
   dependency. The common surface enables shared adapters; per-adapter
   narrow extensions (e.g., `S3Adapter.presignedURL`) stay invisible to the
   common contract.
4. **Schema home placement**: `packages/protocol/` matches the family
   pattern across `freeside-worlds/packages/protocol/`,
   `freeside-score/packages/protocol/`, `freeside-ruggy/packages/protocol/`.
   Single-vocab doctrine (per [[loa-org-naming-conventions]]).
5. **JSON Schema co-resident with TS**: `url-contract.schema.json` (authored
   in T20a per SDD §0.3 contracts-as-bridges instance-N) lives at
   `packages/protocol/url-contract.schema.json` so consumers can ajv-validate
   without TS compilation.

## Composition

```
the-orchard's tending-storage   ─┐
                                 ├─→ StorageAdapter (common surface)
construct-freeside's              │     (packages/protocol/)
mirroring-storage                ─┘
                                  │
                                  ▼
                          @freeside-storage/adapters-s3
                                  │
                                  ▼
                                AWS S3
```

Both constructs consume the COMMON `StorageAdapter` surface. The orchard's
`tending-storage` and freeside's `mirroring-storage` are different methods on
the same adapter — no construct-to-construct dependency, no shared mutable
state.

## Consequences

### Positive

- **Boundaries declared, content lean**: future readers see the intended
  shape (README) and the actual shape (this layout) clearly.
- **Cycle-1 shippable**: protocol + S3 adapter is enough to satisfy
  `mirroring-storage` SKILL acceptance (SDD §3.2).
- **Construct composition unblocked**: `the-orchard`'s `tending-storage` can
  consume the same `StorageAdapter` once orchard refactors to the common
  surface (separate cycle).
- **Forward-compat preserved**: adding `packages/adapters/ipfs/` later is an
  additive change. The common interface does not break.

### Negative

- **Reserved-but-empty packages list**: README enumerates six packages but
  only two ship. Risk of confusion. Mitigation: README's "Intended scope"
  section now cross-links this ADR.
- **No CLI in cycle-1**: operators who want to invoke `freeside-storage` from
  shell shell out to `aws s3` directly OR consume via `gaib-cli` (the secrets
  CLI). Acceptable because cycle-1's primary consumer is `mirroring-storage`
  SKILL invoking via Node.

### Forward-pointing

- A future cycle authoring an IPFS adapter implements the common
  `StorageAdapter` interface and adds `packages/adapters/ipfs/`. No protocol
  change required.
- A future cycle wanting a CLI authors `packages/cli/freeside-storage`
  importing from both `protocol/` and `adapters/s3/`. No protocol change
  required.
- A future cycle codifying storage layouts authors
  `packages/storage-layouts/{nft-collection,per-world-music,...}` with each
  layout exposing a `Layout` shape consumed by adapters at write-time.

## Cross-references

- SDD §3.1 (StorageAdapter interface spec)
- SDD §6.2 (this ADR's decision matrix)
- SDD §6.3 (composition diagram)
- SDD §6.5 (package layout — instance-1 lean)
- PRD §4.3.C (Deliverable C scope)
- Doctrine: [[freeside-modules-as-installables]]
- Sibling pattern: `freeside-worlds/packages/registry/`,
  `freeside-score/packages/protocol/`,
  `freeside-ruggy/packages/protocol/`

## Approval

- **2026-04-29**: opus-4-7-1m + zksoju — accepted via /architect L4 lock and
  /sprint-plan T10 acceptance. ADR locks instance-1 lean per
  [[freeside-modules-as-installables]] doctrine.
