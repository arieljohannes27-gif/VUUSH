import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRoles } from "../../plugins/auth.js";
import {
  acknowledgeIncident,
  addIncidentNote,
  escalateIncident,
  getActiveDriverIncident,
  getIncidentDetail,
  listIncidents,
  notifyCustomerIncident,
  openEmergencyIncident,
  resolveIncident,
} from "./service.js";

const staffDispatch = ["dispatcher", "operations_manager", "administrator"] as const;

function mapError(err: unknown) {
  const message = err instanceof Error ? err.message : "unknown_error";
  const status =
    message === "incident_not_found" || message === "driver_profile_missing"
      ? 404
      : message === "threat_hold_release_blocked"
        ? 403
        : 400;
  return { status, error: message };
}

export async function incidentRoutes(app: FastifyInstance) {
  app.post(
    "/v1/drivers/me/emergency",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = z
        .object({
          category: z.enum(["medical", "threat", "accident", "assault"]),
          note: z.string().optional(),
          lat: z.number().optional(),
          lng: z.number().optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const result = await openEmergencyIncident({
          userId: request.authUser!.id,
          ...parsed.data,
          correlationId: request.id,
        });
        return reply.status(201).send(result);
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/drivers/me/incidents/active",
    { preHandler: requireAuth },
    async (request) => {
      const incident = await getActiveDriverIncident(request.authUser!.id);
      return { incident: incident ?? null };
    },
  );

  app.get(
    "/v1/dispatch/incidents",
    { preHandler: requireRoles(...staffDispatch) },
    async (request) => {
      const q = request.query as { status?: string };
      const rows = await listIncidents({ status: q.status });
      return { incidents: rows };
    },
  );

  app.get(
    "/v1/dispatch/incidents/:id",
    { preHandler: requireRoles(...staffDispatch) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        return await getIncidentDetail(id);
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/dispatch/incidents/:id/acknowledge",
    { preHandler: requireRoles(...staffDispatch) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const incident = await acknowledgeIncident({
          incidentId: id,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return { incident };
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/dispatch/incidents/:id/escalate",
    { preHandler: requireRoles(...staffDispatch) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z
        .object({ note: z.string().optional() })
        .safeParse(request.body ?? {});
      try {
        const incident = await escalateIncident({
          incidentId: id,
          actorUserId: request.authUser!.id,
          note: parsed.success ? parsed.data.note : undefined,
          correlationId: request.id,
        });
        return { incident };
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/dispatch/incidents/:id/notify-customer",
    { preHandler: requireRoles(...staffDispatch) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await notifyCustomerIncident({
          incidentId: id,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return result;
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/dispatch/incidents/:id/notes",
    { preHandler: requireRoles(...staffDispatch) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z.object({ note: z.string().min(2) }).safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        await addIncidentNote({
          incidentId: id,
          actorUserId: request.authUser!.id,
          note: parsed.data.note,
          correlationId: request.id,
        });
        return { ok: true };
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/dispatch/incidents/:id/resolve",
    { preHandler: requireRoles(...staffDispatch) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z
        .object({
          resolutionCode: z.string().min(2),
          resolutionNote: z.string().optional(),
          releaseHold: z.boolean().optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const incident = await resolveIncident({
          incidentId: id,
          actorUserId: request.authUser!.id,
          ...parsed.data,
          correlationId: request.id,
        });
        return { incident };
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );
}
