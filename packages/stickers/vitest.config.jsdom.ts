import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "jsdom",
    server: {
      deps: {
        inline: [/^@freeside-storage\//, "effect"],
      },
    },
  },
});
