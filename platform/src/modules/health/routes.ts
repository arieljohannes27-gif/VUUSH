import type { FastifyInstance } from "fastify";
import { checkDatabase } from "../../db/client.js";
import { env } from "../../config.js";
import { isFlagEnabled } from "../admin/service.js";

export async function healthRoutes(app: FastifyInstance) {
  /** Liveness — Railway healthcheck. Always 200 if the process is up. */
  app.get("/health", async () => ({
    status: "ok",
    service: "vuush-platform",
    module: "M0",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  }));

  /** Readiness — database must be reachable. */
  app.get("/ready", async (_request, reply) => {
    const database = await checkDatabase();
    if (!database.ok) {
      return reply.status(503).send({
        ready: false,
        checks: { database },
      });
    }
    return { ready: true, checks: { database } };
  });

  app.get("/v1/config/beachhead", async () => ({
    mapsExperienceEnabled: await isFlagEnabled("maps_experience_enabled", true),
  }));
}
