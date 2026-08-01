import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = path.dirname(fileURLToPath(import.meta.url));
const sharedAuth = path.resolve(root, "../../src/shared/auth");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@vuush/auth": sharedAuth,
    },
  },
  server: {
    port: 5182,
    host: true,
    fs: {
      allow: [
        root,
        sharedAuth,
        path.resolve(root, "../../design-system"),
        path.resolve(root, "../../src"),
      ],
    },
    proxy: {
      "/v1": "http://127.0.0.1:3000",
      "/health": "http://127.0.0.1:3000",
    },
  },
});
