import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRoles } from "../../plugins/auth.js";
import { PROOF_KINDS } from "../booking/states.js";
import {
  addProofArtefact,
  completeDelivery,
  completePickup,
  failAttempt,
  listProofs,
  markArrivedDropoff,
  markArrivedPickup,
  markEnRoutePickup,
} from "./service.js";

const proofKindSchema = z.enum(PROOF_KINDS);

function mapError(err: unknown) {
  const message = err instanceof Error ? err.message : "unknown_error";
  const status =
    message === "job_not_found"
      ? 404
      : message === "not_assigned_driver"
        ? 403
        : 400;
  return { status, error: message };
}

function isStaff(roles: string[] | undefined) {
  return Boolean(
    roles?.some((r) =>
      ["dispatcher", "operations_manager", "administrator", "support_agent"].includes(
        r,
      ),
    ),
  );
}

export async function executionRoutes(app: FastifyInstance) {
  app.post(
    "/v1/jobs/:jobId/proofs",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const parsed = z
        .object({
          kind: proofKindSchema,
          note: z.string().optional(),
          contentBase64: z.string().optional(),
          textContent: z.string().optional(),
          contentType: z.string().optional(),
          lat: z.number().optional(),
          lng: z.number().optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const artefact = await addProofArtefact({
          jobId,
          actorUserId: request.authUser!.id,
          ...parsed.data,
          correlationId: request.id,
        });
        return reply.status(201).send({ artefact });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/jobs/:jobId/proofs",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      // Drivers and staff/shipper: shipper can read own job proofs via booking ownership later;
      // Wave 1: auth + assignment or staff
      const roles = request.authUser?.roles ?? [];
      if (!isStaff(roles)) {
        // allow any authenticated for now if they know job id — tighten with ownership in M6
      }
      const proofs = await listProofs(jobId);
      return {
        proofs: proofs.map((p) => ({
          id: p.id,
          jobId: p.jobId,
          kind: p.kind,
          objectKey: p.objectKey,
          contentType: p.contentType,
          note: p.note,
          lat: p.lat,
          lng: p.lng,
          createdAt: p.createdAt,
        })),
      };
    },
  );

  app.post(
    "/v1/jobs/:jobId/execution/en-route-pickup",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      try {
        const job = await markEnRoutePickup({
          jobId,
          actorUserId: request.authUser!.id,
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
    "/v1/jobs/:jobId/execution/arrive-pickup",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      try {
        const job = await markArrivedPickup({
          jobId,
          actorUserId: request.authUser!.id,
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
    "/v1/jobs/:jobId/execution/pickup",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      try {
        const job = await completePickup({
          jobId,
          actorUserId: request.authUser!.id,
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
    "/v1/jobs/:jobId/execution/arrive-dropoff",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      try {
        const job = await markArrivedDropoff({
          jobId,
          actorUserId: request.authUser!.id,
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
    "/v1/jobs/:jobId/execution/deliver",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const parsed = z
        .object({
          lat: z.number().min(-90).max(90),
          lng: z.number().min(-180).max(180),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const job = await completeDelivery({
          jobId,
          actorUserId: request.authUser!.id,
          lat: parsed.data.lat,
          lng: parsed.data.lng,
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
    "/v1/jobs/:jobId/execution/fail-attempt",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const parsed = z
        .object({ reasonCode: z.string().min(2) })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const job = await failAttempt({
          jobId,
          actorUserId: request.authUser!.id,
          reasonCode: parsed.data.reasonCode,
          correlationId: request.id,
        });
        return reply.send({ job });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/admin/jobs/:jobId/proofs",
    {
      preHandler: requireRoles(
        "dispatcher",
        "operations_manager",
        "administrator",
        "support_agent",
        "finance_officer",
      ),
    },
    async (request) => {
      const { jobId } = request.params as { jobId: string };
      const proofs = await listProofs(jobId);
      return { proofs };
    },
  );
}
