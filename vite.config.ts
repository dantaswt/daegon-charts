import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    spa: {
      enabled: true,
    },
    server: { entry: "server" },
  },
  // SPA shell prerendering expects TanStack Start's standard dist/server output.
  // Nitro is unnecessary because production is static GitHub Pages.
  nitro: false,
  vite: {
    server: {
      allowedHosts: true,
    },
  },
});
