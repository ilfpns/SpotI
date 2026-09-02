import { defineConfig } from "electron-vite";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    build: {
      outDir: "dist/main",
      rollupOptions: {
        input: resolve(__dirname, "src/main/main.ts"),
      },
    },
  },
  preload: {
    build: {
      outDir: "dist/preload",
      rollupOptions: {
        input: resolve(__dirname, "src/preload/preload.ts"),
        output: {
          format: "cjs",
          entryFileNames: "preload.js",
        },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    build: {
      outDir: "dist/renderer",
      rollupOptions: {
        input: {
          pet: resolve(__dirname, "src/renderer/pet/index.html"),
          popup: resolve(__dirname, "src/renderer/popup/index.html"),
          settings: resolve(__dirname, "src/renderer/settings/index.html"),
          contextmenu: resolve(__dirname, "src/renderer/contextmenu/index.html"),
        },
      },
    },
  },
});
