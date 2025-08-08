import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { visualizer } from "rollup-plugin-visualizer";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    viteSingleFile(),
    visualizer({
      filename: "stats.html",
      open: true,
      gzipSize: true,
    }),
  ],
  build: {
    target: "esnext",
    cssCodeSplit: false,
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: "bundle.js",
      },
    },
  },
});
