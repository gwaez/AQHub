import { defineConfig } from "vite";
import { cpSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

function copyCharacterPacks() {
  const from = resolve(root, "characters");
  const to = resolve(root, "public/characters");
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

export default defineConfig({
  plugins: [
    {
      name: "copy-character-packs",
      buildStart() {
        copyCharacterPacks();
      },
      configureServer() {
        copyCharacterPacks();
      },
    },
  ],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
