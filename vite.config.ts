import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  root: "src",
  plugins: [vue(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "es2022",
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: "index.html",
        panelToolbar: "panel-toolbar.html",
        layoutPresetDropdown: "layout-preset-dropdown.html",
        layoutPresetMenu: "layout-preset-menu.html",
      },
    },
  },
});
