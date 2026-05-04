import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "node",
      environment: "node",
      include: [
        "packages/*/tests/**/*.test.ts",
        "scripts/**/*.test.ts",
      ],
    },
  },
  {
    test: {
      name: "jsdom",
      environment: "jsdom",
      include: ["packages/*/tests/**/*.test.ts"],
      server: {
        deps: {
          inline: [/^@freeside-storage\//, /^@0xhoneyjar\//, "effect"],
        },
      },
    },
  },
]);
