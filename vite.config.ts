// @lovable.dev/vite-tanstack-config already includes tanstackStart, viteReact, tailwindcss,
// tsConfigPaths, nitro (build-only, Cloudflare Worker preset por defecto), etc.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Cuando construimos para Electron pasamos ELECTRON_BUILD=1 para cambiar el preset de Nitro
// a node-server (produce dist/server/index.mjs ejecutable con Node dentro de la app).
const isElectron = process.env.ELECTRON_BUILD === "1";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  ...(isElectron
    ? {
        nitro: { preset: "node-server" },
      }
    : {}),
  vite: {
    // Rutas relativas para cargar assets bajo file:// (fallback) o desde el server local.
    base: "./",
  },
});
