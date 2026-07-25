import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRoles } from "../../plugins/auth.js";
import { isDev } from "../../config.js";
import {
  acceptAssignment,
  assignJob,
  backupAssign,
  getDriverHome,
  getDriverJobHistory,
  getDriverProfileBundle,
  getJobDriverProfessional,
  getJobAssignment,
  listDispatchQueue,
  listDriverEarnings,
  listDriverProfiles,
  listEligibleDrivers,
  placeHold,
  reassignJob,
  rejectAssignment,
  releaseHold,
  setDutyStatus,
  updateDriverProfileBundle,
  upsertDriverProfile,
} from "./service.js";

const staffDispatch = ["dispatcher", "operations_manager", "administrator"] as const;

function mapError(err: unknown) {
  const message = err instanceof Error ? err.message : "unknown_error";
  const status =
    message === "job_not_found" ||
    message === "assignment_not_found" ||
    message === "hold_not_found" ||
    message === "driver_profile_missing" ||
    message === "user_not_found"
      ? 404
      : message === "assignment_not_yours" || message === "forbidden"
        ? 403
        : 400;
  return { status, error: message };
}

export async function dispatchRoutes(app: FastifyInstance) {
  app.get(
    "/v1/drivers/me",
    { preHandler: requireAuth },
    async (request) => {
      return getDriverHome(request.authUser!.id);
    },
  );

  app.get(
    "/v1/drivers/me/earnings",
    { preHandler: requireAuth },
    async (request) => {
      const earnings = await listDriverEarnings(request.authUser!.id);
      return { earnings };
    },
  );

  app.get(
    "/v1/drivers/me/jobs/:jobId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const history = await getDriverJobHistory(request.authUser!.id, jobId);
      if (!history) return reply.status(404).send({ error: "job_not_found" });
      return history;
    },
  );

  app.get(
    "/v1/drivers/me/profile",
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        return await getDriverProfileBundle(request.authUser!.id);
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.patch(
    "/v1/drivers/me/profile",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = z
        .object({
          publicName: z.string().min(1).max(80).nullable().optional(),
          // Allows https URLs or small beachhead data-URLs from driver photo pick.
          photoUrl: z.string().max(600_000).nullable().optional(),
          phonePublic: z.string().min(3).max(40).nullable().optional(),
          vehiclePlate: z.string().min(1).max(32).nullable().optional(),
          vehicleLabel: z.string().min(1).max(120).nullable().optional(),
          bio: z.string().max(500).nullable().optional(),
          vehicleClass: z.enum(["bike", "car", "van"]).optional(),
          homeZoneCode: z.string().min(2).max(32).nullable().optional(),
          licenceStatus: z.enum(["pending", "verified", "missing", "expired"]).optional(),
          vehicleDocStatus: z
            .enum(["pending", "verified", "missing", "expired"])
            .optional(),
          insuranceStatus: z
            .enum(["pending", "verified", "missing", "expired"])
            .optional(),
          displayName: z.string().min(1).max(80).nullable().optional(),
          phone: z.string().min(3).max(40).nullable().optional(),
        })
        .safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        return await updateDriverProfileBundle(
          request.authUser!.id,
          parsed.data,
        );
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/jobs/:jobId/driver-profile",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const roles = request.authUser?.roles ?? [];
      try {
        return await getJobDriverProfessional({
          jobId,
          requesterUserId: request.authUser!.id,
          isAdmin: roles.includes("administrator"),
        });
      } catch (err) {
        const mapped = mapError(err);
        const status =
          mapped.error === "forbidden"
            ? 403
            : mapped.status;
        return reply.status(status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/drivers/me/duty",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = z
        .object({ onDuty: z.boolean() })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const profile = await setDutyStatus({
          userId: request.authUser!.id,
          onDuty: parsed.data.onDuty,
          correlationId: request.id,
        });
        return reply.send({ profile });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/dispatch/queue",
    { preHandler: requireRoles(...staffDispatch) },
    async () => {
      const queue = await listDispatchQueue();
      return { queue };
    },
  );

  app.get(
    "/v1/dispatch/drivers",
    { preHandler: requireRoles(...staffDispatch) },
    async () => {
      const drivers = await listDriverProfiles();
      return { drivers };
    },
  );

  app.get(
    "/v1/dispatch/jobs/:jobId",
    { preHandler: requireRoles(...staffDispatch) },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      try {
        return await getJobAssignment(jobId);
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/dispatch/jobs/:jobId/eligible-drivers",
    { preHandler: requireRoles(...staffDispatch) },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      try {
        const drivers = await listEligibleDrivers(jobId);
        return { drivers };
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/dispatch/jobs/:jobId/assign",
    { preHandler: requireRoles(...staffDispatch) },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const parsed = z
        .object({
          driverUserId: z.string().uuid(),
          requireAccept: z.boolean().optional(),
          reasonCode: z.string().min(2).optional(),
          idempotencyKey: z.string().min(4).optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const result = await assignJob({
          jobId,
          driverUserId: parsed.data.driverUserId,
          actorUserId: request.authUser!.id,
          requireAccept: parsed.data.requireAccept,
          reasonCode: parsed.data.reasonCode,
          idempotencyKey: parsed.data.idempotencyKey,
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
    "/v1/dispatch/jobs/:jobId/reassign",
    { preHandler: requireRoles(...staffDispatch) },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const parsed = z
        .object({
          driverUserId: z.string().uuid(),
          reasonCode: z.string().min(2),
          requireAccept: z.boolean().optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const result = await reassignJob({
          jobId,
          driverUserId: parsed.data.driverUserId,
          actorUserId: request.authUser!.id,
          reasonCode: parsed.data.reasonCode,
          requireAccept: parsed.data.requireAccept,
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
    "/v1/dispatch/jobs/:jobId/backup",
    { preHandler: requireRoles(...staffDispatch) },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const parsed = z
        .object({
          driverUserId: z.string().uuid(),
          reasonCode: z.string().min(2),
          custodyHandoffRequired: z.boolean().optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const result = await backupAssign({
          jobId,
          driverUserId: parsed.data.driverUserId,
          actorUserId: request.authUser!.id,
          reasonCode: parsed.data.reasonCode,
          custodyHandoffRequired: parsed.data.custodyHandoffRequired,
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
    "/v1/dispatch/jobs/:jobId/holds",
    { preHandler: requireRoles(...staffDispatch) },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const parsed = z
        .object({
          holdType: z.enum([
            "INCIDENT_HOLD",
            "MUTATION_PENDING",
            "AUTHORITY_HOLD",
            "DISPATCH_HOLD",
          ]),
          reasonCode: z.string().min(2),
          reasonNote: z.string().optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const hold = await placeHold({
          jobId,
          holdType: parsed.data.holdType,
          reasonCode: parsed.data.reasonCode,
          reasonNote: parsed.data.reasonNote,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return reply.status(201).send({ hold });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/dispatch/holds/:holdId/release",
    { preHandler: requireRoles(...staffDispatch) },
    async (request, reply) => {
      const { holdId } = request.params as { holdId: string };
      try {
        const hold = await releaseHold({
          holdId,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return reply.send({ hold });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/dispatch/assignments/:assignmentId/accept",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { assignmentId } = request.params as { assignmentId: string };
      try {
        const assignment = await acceptAssignment({
          assignmentId,
          driverUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return reply.send({ assignment });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/dispatch/assignments/:assignmentId/reject",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { assignmentId } = request.params as { assignmentId: string };
      const parsed = z
        .object({ reasonCode: z.string().min(2).optional() })
        .safeParse(request.body ?? {});
      try {
        const assignment = await rejectAssignment({
          assignmentId,
          driverUserId: request.authUser!.id,
          reasonCode: parsed.success ? parsed.data.reasonCode : undefined,
          correlationId: request.id,
        });
        return reply.send({ assignment });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  /** Dev/ops seed: create driver profile + role. */
  app.post(
    "/v1/dev/ensure-driver",
    async (request, reply) => {
      if (!isDev()) {
        return reply.status(404).send({ error: "not_found" });
      }
      const parsed = z
        .object({
          userId: z.string().uuid(),
          vehicleClass: z.enum(["bike", "car", "van"]).optional(),
          homeZoneCode: z.string().optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      const profile = await upsertDriverProfile({
        userId: parsed.data.userId,
        vehicleClass: parsed.data.vehicleClass,
        homeZoneCode: parsed.data.homeZoneCode,
        correlationId: request.id,
      });
      return reply.status(201).send({ profile });
    },
  );

  app.post(
    "/v1/dispatch/drivers",
    { preHandler: requireRoles("administrator", "operations_manager") },
    async (request, reply) => {
      const parsed = z
        .object({
          userId: z.string().uuid(),
          vehicleClass: z.enum(["bike", "car", "van"]).default("car"),
          homeZoneCode: z.string().optional(),
          eligibilityStatus: z
            .enum(["eligible", "pending", "suspended"])
            .optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      const profile = await upsertDriverProfile({
        userId: parsed.data.userId,
        vehicleClass: parsed.data.vehicleClass,
        homeZoneCode: parsed.data.homeZoneCode,
        eligibilityStatus: parsed.data.eligibilityStatus,
        actorUserId: request.authUser!.id,
        correlationId: request.id,
      });
      return reply.status(201).send({ profile });
    },
  );
}
