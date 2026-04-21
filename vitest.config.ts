import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["apps/web/**/*.test.ts", "packages/**/*.test.ts", "tools/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["packages/core/src/**/*.ts", "tools/jd-fetch/src/**/*.ts"],
      exclude: [
        "packages/core/src/types.ts",
        "tools/jd-fetch/src/index.ts",
        "tools/jd-fetch/src/adapters/types.ts",
      ],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 85,
      },
    },
  },
});
