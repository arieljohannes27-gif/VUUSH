import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    // Listen on IPv4 + IPv6 so both localhost and 127.0.0.1 work on macOS.
    host: true,
    port: 5177,
    strictPort: true,
    fs: {
      allow: [root, path.resolve(root, "../../design-system")],
    },
    proxy: {
      "/v1": "http://127.0.0.1:3000",
      "/health": "http://127.0.0.1:3000",
    },
  },
});
