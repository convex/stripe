import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    exclude: [...configDefaults.exclude, "e2e/**"],
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
  },
});
