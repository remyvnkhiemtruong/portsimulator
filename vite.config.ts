import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  // Keep local development at /; GitHub Pages supplies /portsimulator/.
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react(), tailwindcss()],
  test: { include: ["src/tests/**/*.test.ts"] },
  build: { chunkSizeWarningLimit: 1000 },
});
