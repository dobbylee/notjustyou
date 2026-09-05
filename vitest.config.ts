import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL(".", import.meta.url).pathname,
      "@notjustyou/cli/reporting-setup": new URL(
        "./packages/notjustyou-cli/src/reporting-setup.ts",
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    environment: "node",
    unstubEnvs: true,
    unstubGlobals: true,
    restoreMocks: true,
    environmentOptions: {
      jsdom: {
        url: "http://localhost:3000/",
      },
    },
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["./tests/setup.ts"],
  },
});
