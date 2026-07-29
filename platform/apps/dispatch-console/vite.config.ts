import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const root = path.dirname(fileURLToPath(import.meta.url));
const shared = path.resolve(root, "../../shared");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "");
  if (mode === "production" && !env.VITE_API_BASE_URL?.trim()) {
    throw new Error(
      "VITE_API_BASE_URL is required for production builds (Railway API origin, no trailing slash)",
    );
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@swift/maps": path.join(shared, "maps"),
      },
    },
    server: {
      port: 5173,
      fs: {
        allow: [root, path.resolve(root, "../../design-system"), shared],
      },
      proxy: {
        "/v1": "http://localhost:3000",
        "/health": "http://localhost:3000",
      },
    },
  };
});
