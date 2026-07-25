import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5176,
    fs: {
      allow: [root, path.resolve(root, "../../design-system")],
    },
    proxy: {
      "/v1": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
});
