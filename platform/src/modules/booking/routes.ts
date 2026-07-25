import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../plugins/auth.js";
import {
  cancelJob,
  confirmJob,
  createDraftJob,
  getJob,
  listCatalog,
  listJobsForUser,
  quoteJob,
  requestDestinationChange,
  seedBookingCatalog,
} from "./service.js";

const createSchema = z.object({
  serviceTypeCode: z.string().min(2),
  packageClass: z.enum(["small", "medium", "large"]).default("small"),
  pickupAddress: z.string().min(3),
  pickupZoneCode: z.string().min(2),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  dropoffAddress: z.string().min(3),
  dropoffZoneCode: z.string().min(2),
  dropoffLat: z.number().optional(),
  dropoffLng: z.number().optional(),
  pickupContactName: z.string().optional(),
  pickupContactPhone: z.string().optional(),
  recipientName: z.string().optional(),
  recipientPhone: z.string().optional(),
  notes: z.string().optional(),
  prohibitedGoodsDeclared: z.literal(true),
  containsProhibitedGoods: z.boolean().default(false),
  scheduledFor: z.string().datetime().optional().nullable(),
});

function isAdmin(roles: string[] | undefined) {
  return Boolean(
    roles?.includes("administrator") || roles?.includes("operations_manager"),
  );
}

function mapError(err: unknown) {
  const message = err instanceof Error ? err.message : "unknown_error";
  const status =
    message === "job_not_found"
      ? 404
      : message === "illegal_transition" ||
          message === "quote_expired" ||
          message === "quote_required" ||
          message === "payment_failed" ||
          message === "card_declined_stub" ||
          message === "prohibited_goods_declaration_required" ||
          message === "prohibited_goods_blocked" ||
          message === "zone_unserviceable" ||
          message === "service_type_invalid"
        ? 400
        : 500;
  return { status, error: message };
}

export async function bookingRoutes(app: FastifyInstance) {
  app.get("/v1/catalog", async () => listCatalog());

  app.post(
    "/v1/dev/seed-catalog",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (
        !isAdmin(request.authUser?.roles) &&
        process.env.NODE_ENV === "production"
      ) {
        return reply.status(403).send({ error: "forbidden" });
      }
      const result = await seedBookingCatalog();
      return reply.send(result);
    },
  );

  app.post(
    "/v1/jobs",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "validation_error",
          details: parsed.error.flatten(),
        });
      }
      try {
        const job = await createDraftJob({
          ...parsed.data,
          shipperUserId: request.authUser!.id,
          scheduledFor: parsed.data.scheduledFor
            ? new Date(parsed.data.scheduledFor)
            : null,
          correlationId: request.id,
        });
        return reply.status(201).send({ job });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/jobs",
    { preHandler: requireAuth },
    async (request) => {
      const rows = await listJobsForUser(
        request.authUser!.id,
        isAdmin(request.authUser?.roles),
      );
      return { jobs: rows };
    },
  );

  app.get(
    "/v1/jobs/:jobId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const result = await getJob({
        jobId,
        userId: request.authUser!.id,
        isAdmin: isAdmin(request.authUser?.roles),
      });
      if (!result) return reply.status(404).send({ error: "job_not_found" });
      return result;
    },
  );

  app.post(
    "/v1/jobs/:jobId/quote",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      try {
        const result = await quoteJob({
          jobId,
          userId: request.authUser!.id,
          isAdmin: isAdmin(request.authUser?.roles),
          correlationId: request.id,
        });
        return reply.send(result);
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/jobs/:jobId/confirm",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const body = z
        .object({
          methodRef: z.string().min(3).optional(),
        })
        .safeParse(request.body ?? {});
      try {
        const result = await confirmJob({
          jobId,
          userId: request.authUser!.id,
          isAdmin: isAdmin(request.authUser?.roles),
          methodRef: body.success ? body.data.methodRef : undefined,
          correlationId: request.id,
        });
        return reply.send(result);
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/jobs/:jobId/cancel",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      try {
        const job = await cancelJob({
          jobId,
          userId: request.authUser!.id,
          isAdmin: isAdmin(request.authUser?.roles),
          correlationId: request.id,
        });
        return reply.send({ job });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/jobs/:jobId/mutations",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const parsed = z
        .object({
          dropoffAddress: z.string().min(3),
          dropoffZoneCode: z.string().min(2),
          note: z.string().optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const result = await requestDestinationChange({
          jobId,
          userId: request.authUser!.id,
          isAdmin: isAdmin(request.authUser?.roles),
          ...parsed.data,
          correlationId: request.id,
        });
        return reply.status(201).send(result);
      } catch (err) {
        const mapped = mapError(err);
        const message = err instanceof Error ? err.message : "unknown_error";
        const status =
          message === "mutation_not_allowed" ? 400 : mapped.status;
        return reply.status(status).send({ error: message });
      }
    },
  );
}
