import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { isDev } from "../../config.js";
import { requireAuth, requireRoles } from "../../plugins/auth.js";
import {
  ackLostSignalTask,
  endTrackingSession,
  getCustomerProjection,
  getStaffTrackingView,
  ingestSignal,
  listActiveBoardPositions,
  listLostSignalTasks,
  startTrackingSession,
} from "./service.js";

const staff = ["dispatcher", "operations_manager", "administrator"] as const;

function mapError(err: unknown) {
  const message = err instanceof Error ? err.message : "unknown_error";
  const status =
    message === "job_not_found" ||
    message === "session_not_found" ||
    message === "task_not_found"
      ? 404
      : message === "not_assigned_driver"
        ? 403
        : 400;
  return { status, error: message };
}

function isStaff(roles: string[] | undefined) {
  return Boolean(
    roles?.some((r) =>
      ["dispatcher", "operations_manager", "administrator"].includes(r),
    ),
  );
}

export async function trackingRoutes(app: FastifyInstance) {
  app.post(
    "/v1/tracking/sessions/start",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = z
        .object({ jobId: z.string().uuid() })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const result = await startTrackingSession({
          jobId: parsed.data.jobId,
          actorUserId: request.authUser!.id,
          isStaff: isStaff(request.authUser?.roles),
          correlationId: request.id,
        });
        return reply.status(201).send(result);
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/tracking/sessions/:sessionId/signals",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const parsed = z
        .object({
          lat: z.number().min(-90).max(90),
          lng: z.number().min(-180).max(180),
          accuracyM: z.number().positive().optional(),
          speedMps: z.number().min(0).optional(),
          recordedAt: z.string().datetime().optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const result = await ingestSignal({
          sessionId,
          actorUserId: request.authUser!.id,
          isStaff: isStaff(request.authUser?.roles),
          lat: parsed.data.lat,
          lng: parsed.data.lng,
          accuracyM: parsed.data.accuracyM,
          speedMps: parsed.data.speedMps,
          recordedAt: parsed.data.recordedAt
            ? new Date(parsed.data.recordedAt)
            : undefined,
          correlationId: request.id,
        });
        return reply.status(201).send(result);
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/tracking/sessions/:sessionId/end",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      try {
        const session = await endTrackingSession({
          sessionId,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return reply.send({ session });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/tracking/jobs/:jobId/projection",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      try {
        const projection = await getCustomerProjection(jobId);
        return reply.send({ projection });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/tracking/jobs/:jobId",
    { preHandler: requireRoles(...staff) },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      try {
        return reply.send(await getStaffTrackingView(jobId));
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/dispatch/board-positions",
    { preHandler: requireRoles(...staff) },
    async () => {
      const positions = await listActiveBoardPositions();
      return { positions };
    },
  );

  app.get(
    "/v1/dispatch/lost-signal-tasks",
    { preHandler: requireRoles(...staff) },
    async () => {
      const tasks = await listLostSignalTasks();
      return { tasks };
    },
  );

  app.post(
    "/v1/dispatch/lost-signal-tasks/:taskId/ack",
    { preHandler: requireRoles(...staff) },
    async (request, reply) => {
      const { taskId } = request.params as { taskId: string };
      try {
        const task = await ackLostSignalTask({
          taskId,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return reply.send({ task });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  /** Dev helper: force-evaluate / age simulation via past recordedAt. */
  app.post("/v1/dev/tracking/ping", async (request, reply) => {
    if (!isDev()) return reply.status(404).send({ error: "not_found" });
    const parsed = z
      .object({
        sessionId: z.string().uuid(),
        actorUserId: z.string().uuid(),
        lat: z.number(),
        lng: z.number(),
        recordedAt: z.string().datetime().optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation_error" });
    }
    try {
      const result = await ingestSignal({
        sessionId: parsed.data.sessionId,
        actorUserId: parsed.data.actorUserId,
        isStaff: true,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        recordedAt: parsed.data.recordedAt
          ? new Date(parsed.data.recordedAt)
          : undefined,
        correlationId: request.id,
      });
      return reply.send(result);
    } catch (err) {
      const mapped = mapError(err);
      return reply.status(mapped.status).send({ error: mapped.error });
    }
  });
}
