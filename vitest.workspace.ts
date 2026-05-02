import { defineWorkspace } from "vitest/config";

/**
 * Workspace-level test config — runs every package's tests under both `node`
 * and `jsdom` environments. Per SDD §7.1, the sticker substrate must be
 * strict-universal (Node + browser + edge), and we verify that with the same
 * test files executed under each runtime.
 *
 * Adding a new package: pnpm-workspace.yaml picks it up; the glob below
 * automatically includes `packages/*/tests/`.
 */
export default defineWorkspace([
  {
    test: {
      name: "node",
      environment: "node",
      include: ["packages/*/tests/**/*.test.ts"],
    },
  },
  {
    test: {
      name: "jsdom",
      environment: "jsdom",
      include: ["packages/*/tests/**/*.test.ts"],
    },
  },
]);
