import type { FastifyInstance } from "fastify";
import { checkDatabase } from "../../db/client.js";
import { env } from "../../config.js";
import { isFlagEnabled } from "../admin/service.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    const database = await checkDatabase();
    const status = database.ok ? "ok" : "degraded";

    return {
      status,
      service: "vuush-platform",
      module: "M0",
      environment: env.NODE_ENV,
      checks: {
        database,
      },
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/ready", async (_request, reply) => {
    const database = await checkDatabase();
    if (!database.ok) {
      return reply.status(503).send({
        ready: false,
        checks: { database },
      });
    }
    return { ready: true };
  });

  app.get("/v1/config/beachhead", async () => ({
    mapsExperienceEnabled: await isFlagEnabled("maps_experience_enabled", true),
  }));
}
