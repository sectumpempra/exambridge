import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  server: {
    proxy: {
      "/api/ai": {
        target: "http://127.0.0.1:8789",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist-static",
    emptyOutDir: true,
    sourcemap: false,
  },
});
