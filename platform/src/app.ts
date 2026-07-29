import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import { corsOriginList, env } from "./config.js";
import { adminRoutes } from "./modules/admin/routes.js";
import { enterpriseRoutes } from "./modules/enterprise/routes.js";
import { auditRoutes } from "./modules/audit/routes.js";
import { bookingRoutes } from "./modules/booking/routes.js";
import { seedBookingCatalog } from "./modules/booking/service.js";
import { dispatchRoutes } from "./modules/dispatch/routes.js";
import { executionRoutes } from "./modules/execution/routes.js";
import { healthRoutes } from "./modules/health/routes.js";
import { identityRoutes } from "./modules/identity/routes.js";
import { incidentRoutes } from "./modules/incidents/routes.js";
import { paymentRoutes } from "./modules/payments/routes.js";
import { supportRoutes } from "./modules/support/routes.js";
import { trackingRoutes } from "./modules/tracking/routes.js";
import { seedAdminDefaults } from "./modules/admin/service.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
    trustProxy: true,
    genReqId: (req) => {
      const incoming = req.headers["x-correlation-id"];
      if (typeof incoming === "string" && incoming.length > 0) return incoming;
      return randomUUID();
    },
  });

  await app.register(cors, {
    origin: corsOriginList(),
    credentials: true,
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-correlation-id", request.id);
  });

  await app.register(healthRoutes);
  await app.register(auditRoutes);
  await app.register(identityRoutes);
  await app.register(bookingRoutes);
  await app.register(paymentRoutes);
  await app.register(dispatchRoutes);
  await app.register(incidentRoutes);
  await app.register(trackingRoutes);
  await app.register(executionRoutes);
  await app.register(supportRoutes);
  await app.register(adminRoutes);
  await app.register(enterpriseRoutes);

  app.get("/", async () => ({
    name: "VUUSH Platform",
    health: "/health",
    ready: "/ready",
  }));

  return app;
}

/** Ensure beachhead seed catalogue exists (idempotent). */
export async function ensureCatalogSeed(log?: {
  info: (obj: unknown, msg?: string) => void;
}) {
  const result = await seedBookingCatalog();
  log?.info(result, "booking catalog seed");
  const admin = await seedAdminDefaults();
  log?.info(admin, "admin defaults seed");
  return result;
}
