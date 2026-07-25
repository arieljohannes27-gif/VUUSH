import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRoles } from "../../plugins/auth.js";
import {
  addCaseMessage,
  escalateCase,
  getCaseDetail,
  isSupportAgent,
  listDeskCases,
  listMyCases,
  openClaim,
  openSupportCase,
  refundForCase,
  resolveCase,
} from "./service.js";

const staffSupport = [
  "support_agent",
  "administrator",
  "operations_manager",
] as const;

function mapError(err: unknown) {
  const message = err instanceof Error ? err.message : "unknown_error";
  const status =
    message === "case_not_found" || message === "job_not_found"
      ? 404
      : message === "case_forbidden"
        ? 403
        : 400;
  return { status, error: message };
}

export async function supportRoutes(app: FastifyInstance) {
  app.post(
    "/v1/support/cases",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = z
        .object({
          subject: z.string().min(2).max(200),
          message: z.string().min(2).max(4000),
          jobId: z.string().uuid().optional(),
          channel: z.enum(["customer", "driver"]).optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const opened = await openSupportCase({
          userId: request.authUser!.id,
          ...parsed.data,
          correlationId: request.id,
        });
        return reply.status(201).send({ case: opened });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/support/cases",
    { preHandler: requireAuth },
    async (request) => {
      const cases = await listMyCases(request.authUser!.id);
      return { cases };
    },
  );

  app.get(
    "/v1/support/cases/:caseId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { caseId } = request.params as { caseId: string };
      try {
        const detail = await getCaseDetail({
          caseId,
          userId: request.authUser!.id,
          isAgent: isSupportAgent(request.authUser?.roles),
        });
        return detail;
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/support/cases/:caseId/messages",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { caseId } = request.params as { caseId: string };
      const parsed = z
        .object({ body: z.string().min(1).max(4000) })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const message = await addCaseMessage({
          caseId,
          userId: request.authUser!.id,
          isAgent: isSupportAgent(request.authUser?.roles),
          body: parsed.data.body,
          correlationId: request.id,
        });
        return reply.status(201).send({ message });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/support/desk/cases",
    { preHandler: requireRoles(...staffSupport) },
    async (request) => {
      const q = request.query as { status?: string };
      const cases = await listDeskCases(q.status);
      return { cases };
    },
  );

  app.get(
    "/v1/support/desk/cases/:caseId",
    { preHandler: requireRoles(...staffSupport) },
    async (request, reply) => {
      const { caseId } = request.params as { caseId: string };
      try {
        return await getCaseDetail({
          caseId,
          userId: request.authUser!.id,
          isAgent: true,
        });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/support/desk/cases/:caseId/resolve",
    { preHandler: requireRoles(...staffSupport) },
    async (request, reply) => {
      const { caseId } = request.params as { caseId: string };
      const parsed = z
        .object({ note: z.string().optional() })
        .safeParse(request.body ?? {});
      try {
        const updated = await resolveCase({
          caseId,
          actorUserId: request.authUser!.id,
          note: parsed.success ? parsed.data.note : undefined,
          correlationId: request.id,
        });
        return reply.send({ case: updated });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/support/desk/cases/:caseId/escalate",
    { preHandler: requireRoles(...staffSupport) },
    async (request, reply) => {
      const { caseId } = request.params as { caseId: string };
      const parsed = z
        .object({
          reasonCode: z.string().min(2),
          note: z.string().optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const result = await escalateCase({
          caseId,
          actorUserId: request.authUser!.id,
          ...parsed.data,
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
    "/v1/support/desk/cases/:caseId/claim",
    { preHandler: requireRoles(...staffSupport) },
    async (request, reply) => {
      const { caseId } = request.params as { caseId: string };
      const parsed = z
        .object({ note: z.string().min(2) })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const updated = await openClaim({
          caseId,
          actorUserId: request.authUser!.id,
          note: parsed.data.note,
          correlationId: request.id,
        });
        return reply.status(201).send({ case: updated });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/support/desk/cases/:caseId/refund",
    {
      preHandler: requireRoles(
        "support_agent",
        "administrator",
        "finance_officer",
        "operations_manager",
      ),
    },
    async (request, reply) => {
      const { caseId } = request.params as { caseId: string };
      const parsed = z
        .object({
          reasonCode: z.string().min(2),
          amountCents: z.number().int().positive().optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const result = await refundForCase({
          caseId,
          actorUserId: request.authUser!.id,
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
}
