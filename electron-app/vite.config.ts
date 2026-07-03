import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

// Standalone SPA build for the Electron desktop app.
// - Hash routing (no server needed, works from file://)
// - Outputs to dist-electron/
// - Ignores TanStack Start SSR entirely
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  root: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "..", "dist-electron"),
    emptyOutDir: true,
    sourcemap: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "..", "src"),
    },
  },
});
