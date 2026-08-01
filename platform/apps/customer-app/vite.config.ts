import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = path.dirname(fileURLToPath(import.meta.url));
const shared = path.resolve(root, "../../shared");
const sharedAuth = path.resolve(root, "../../src/shared/auth");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@swift/maps": path.join(shared, "maps"),
      "@vuush/auth": sharedAuth,
    },
  },
  server: {
    port: 5175,
    host: true,
    fs: {
      allow: [
        root,
        path.resolve(root, "../../design-system"),
        shared,
        sharedAuth,
        path.resolve(root, "../../src"),
      ],
    },
    proxy: {
      "/v1": "http://127.0.0.1:3000",
      "/health": "http://127.0.0.1:3000",
    },
  },
});
