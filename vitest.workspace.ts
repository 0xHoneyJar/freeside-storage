import { defineWorkspace } from "vitest/config";

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
