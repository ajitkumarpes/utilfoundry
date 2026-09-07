import { defineConfig } from "vitest/config";

const config = defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});

export default config;
