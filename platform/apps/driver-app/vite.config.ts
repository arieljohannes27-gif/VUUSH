import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = path.dirname(fileURLToPath(import.meta.url));
const shared = path.resolve(root, "../../shared");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@swift/maps": path.join(shared, "maps"),
    },
  },
  server: {
    port: 5174,
    fs: {
      allow: [root, path.resolve(root, "../../design-system"), shared],
    },
    proxy: {
      "/v1": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
});
