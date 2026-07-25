import { buildApp, ensureCatalogSeed } from "./app.js";
import { env } from "./config.js";
import { dbPool } from "./db/client.js";

async function main() {
  const app = await buildApp();

  try {
    // Listen first so Railway /health can pass even if DB seed is slow/fails.
    await app.listen({ host: env.HOST, port: env.PORT });
    app.log.info(
      { port: env.PORT, env: env.NODE_ENV },
      "VUUSH platform listening",
    );
  } catch (err) {
    app.log.error(err);
    await dbPool.end();
    process.exit(1);
  }

  try {
    await ensureCatalogSeed(app.log);
  } catch (err) {
    app.log.error(
      { err },
      "catalog seed failed — API is up; check DATABASE_URL / Supabase",
    );
  }

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Shutting down");
    await app.close();
    await dbPool.end();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();
