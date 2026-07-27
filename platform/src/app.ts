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
    modules: [
      "M0 — Platform foundation",
      "M1 — Authentication & identity",
      "M2 — Customer app",
      "M3 — Booking engine",
      "M8 — Payments & settlements",
      "M8a — Support centre",
      "M8b — Admin portal",
      "M8c — Incidents & emergency",
      "M4 — Dispatch engine",
      "M5 — GPS / tracking",
      "M6a — Execution & proof",
      "M6 — Driver app",
    ],
    docs: "Project Atlas / 09_ARCHITECTURE",
    health: "/health",
    customer: {
      ui: "http://localhost:5175",
      jobs: "GET /v1/jobs",
      mutations: "POST /v1/jobs/:id/mutations",
      support: "POST /v1/support/cases",
      track: "GET /v1/tracking/jobs/:id/projection",
    },
    support: {
      ui: "http://localhost:5176",
      desk: "GET /v1/support/desk/cases",
    },
    dispatch: {
      ui: "http://localhost:5173",
      queue: "GET /v1/dispatch/queue",
      incidents: "GET /v1/dispatch/incidents",
    },
    admin: {
      ui: "http://localhost:5177",
      home: "GET /v1/admin/home",
    },
    driver: {
      home: "GET /v1/drivers/me",
      duty: "POST /v1/drivers/me/duty",
      earnings: "GET /v1/drivers/me/earnings",
      emergency: "POST /v1/drivers/me/emergency",
      ui: "http://localhost:5174",
    },
    execution: {
      pickup: "POST /v1/jobs/:id/execution/pickup",
      deliver: "POST /v1/jobs/:id/execution/deliver",
      proofs: "POST /v1/jobs/:id/proofs",
    },
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
