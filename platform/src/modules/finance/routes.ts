import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRoles } from "../../plugins/auth.js";
import {
  approveAdjustmentRequest,
  buildFinanceExports,
  createAuditPack,
  createCreditNote,
  createReconcileItem,
  financeGenerateStatement,
  getAuditPackZip,
  getFinanceHome,
  getFinanceStatement,
  listAdjustmentRequests,
  listAuditPacks,
  listCreditNotes,
  listFinancePayments,
  listFinanceStatements,
  listReconcileItems,
  matchReconcileItem,
  rejectAdjustmentRequest,
  waiveReconcileItem,
} from "./service.js";

const financeRoles = ["administrator", "finance_officer"] as const;

export async function financeRoutes(app: FastifyInstance) {
  app.get(
    "/v1/finance/home",
    { preHandler: requireRoles(...financeRoles) },
    async () => getFinanceHome(),
  );

  app.get(
    "/v1/finance/payments",
    { preHandler: requireRoles(...financeRoles) },
    async (request) => {
      const q = request.query as { status?: string; limit?: string };
      const payments = await listFinancePayments({
        status: q.status || undefined,
        limit: q.limit ? Number(q.limit) : undefined,
      });
      return { payments };
    },
  );

  app.get(
    "/v1/finance/statements",
    { preHandler: requireRoles(...financeRoles) },
    async (request) => {
      const q = request.query as { limit?: string };
      const statements = await listFinanceStatements({
        limit: q.limit ? Number(q.limit) : undefined,
      });
      return { statements };
    },
  );

  app.get(
    "/v1/finance/statements/:invoiceId",
    { preHandler: requireRoles(...financeRoles) },
    async (request, reply) => {
      const { invoiceId } = request.params as { invoiceId: string };
      try {
        return await getFinanceStatement(invoiceId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "statement_error";
        const status = message === "statement_not_found" ? 404 : 400;
        return reply.status(status).send({ error: message });
      }
    },
  );

  app.post(
    "/v1/finance/statements/generate",
    { preHandler: requireRoles(...financeRoles) },
    async (request, reply) => {
      const parsed = z
        .object({ orgId: z.string().uuid() })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const invoice = await financeGenerateStatement({
          orgId: parsed.data.orgId,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return reply.status(201).send({ invoice });
      } catch (err) {
        const message = err instanceof Error ? err.message : "statement_error";
        return reply.status(400).send({ error: message });
      }
    },
  );

  app.get(
    "/v1/finance/credit-notes",
    { preHandler: requireRoles(...financeRoles) },
    async (request) => {
      const q = request.query as { limit?: string };
      return {
        creditNotes: await listCreditNotes({
          limit: q.limit ? Number(q.limit) : undefined,
        }),
      };
    },
  );

  app.post(
    "/v1/finance/credit-notes",
    { preHandler: requireRoles(...financeRoles) },
    async (request, reply) => {
      const parsed = z
        .object({
          orgId: z.string().uuid().optional(),
          jobId: z.string().uuid().optional(),
          statementId: z.string().uuid().optional(),
          amountCents: z.number().int().positive(),
          reasonCode: z.string().min(2),
          notes: z.string().optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const creditNote = await createCreditNote({
          ...parsed.data,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return reply.status(201).send({ creditNote });
      } catch (err) {
        const message = err instanceof Error ? err.message : "credit_error";
        return reply.status(400).send({ error: message });
      }
    },
  );

  app.get(
    "/v1/finance/adjustments",
    { preHandler: requireRoles(...financeRoles) },
    async (request) => {
      const q = request.query as { status?: string; limit?: string };
      return {
        adjustments: await listAdjustmentRequests({
          status: q.status || undefined,
          limit: q.limit ? Number(q.limit) : undefined,
        }),
      };
    },
  );

  app.post(
    "/v1/finance/adjustments/:id/approve",
    { preHandler: requireRoles(...financeRoles) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await approveAdjustmentRequest({
          id,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return reply.send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "adjust_error";
        return reply.status(400).send({ error: message });
      }
    },
  );

  app.post(
    "/v1/finance/adjustments/:id/reject",
    { preHandler: requireRoles(...financeRoles) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z
        .object({ note: z.string().optional() })
        .safeParse(request.body ?? {});
      try {
        const adjustment = await rejectAdjustmentRequest({
          id,
          actorUserId: request.authUser!.id,
          note: parsed.success ? parsed.data.note : undefined,
          correlationId: request.id,
        });
        return reply.send({ adjustment });
      } catch (err) {
        const message = err instanceof Error ? err.message : "adjust_error";
        return reply.status(400).send({ error: message });
      }
    },
  );

  app.get(
    "/v1/finance/reconcile",
    { preHandler: requireRoles(...financeRoles) },
    async (request) => {
      const q = request.query as { status?: string; limit?: string };
      return {
        items: await listReconcileItems({
          status: q.status || undefined,
          limit: q.limit ? Number(q.limit) : undefined,
        }),
      };
    },
  );

  app.post(
    "/v1/finance/reconcile",
    { preHandler: requireRoles(...financeRoles) },
    async (request, reply) => {
      const parsed = z
        .object({
          source: z.string().min(2),
          externalRef: z.string().optional(),
          jobId: z.string().uuid().optional(),
          paymentId: z.string().uuid().optional(),
          amountCents: z.number().int(),
          notes: z.string().optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      const item = await createReconcileItem({
        ...parsed.data,
        actorUserId: request.authUser!.id,
        correlationId: request.id,
      });
      return reply.status(201).send({ item });
    },
  );

  app.post(
    "/v1/finance/reconcile/:id/match",
    { preHandler: requireRoles(...financeRoles) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z
        .object({ jobId: z.string().uuid() })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const item = await matchReconcileItem({
          id,
          jobId: parsed.data.jobId,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return reply.send({ item });
      } catch (err) {
        const message = err instanceof Error ? err.message : "reconcile_error";
        return reply.status(400).send({ error: message });
      }
    },
  );

  app.post(
    "/v1/finance/reconcile/:id/waive",
    { preHandler: requireRoles(...financeRoles) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z
        .object({ notes: z.string().optional() })
        .safeParse(request.body ?? {});
      try {
        const item = await waiveReconcileItem({
          id,
          notes: parsed.success ? parsed.data.notes : undefined,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return reply.send({ item });
      } catch (err) {
        const message = err instanceof Error ? err.message : "reconcile_error";
        return reply.status(400).send({ error: message });
      }
    },
  );

  app.post(
    "/v1/finance/exports",
    { preHandler: requireRoles(...financeRoles) },
    async (request, reply) => {
      const parsed = z
        .object({
          from: z.string().min(4),
          to: z.string().min(4),
          datasets: z.array(z.string()).min(1),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const zip = await buildFinanceExports({
          from: new Date(parsed.data.from),
          to: new Date(parsed.data.to),
          datasets: parsed.data.datasets,
        });
        return reply
          .header("content-type", "application/zip")
          .header(
            "content-disposition",
            'attachment; filename="vuush-finance-export.zip"',
          )
          .send(zip);
      } catch (err) {
        const message = err instanceof Error ? err.message : "export_error";
        return reply.status(400).send({ error: message });
      }
    },
  );

  app.get(
    "/v1/admin/audit-packs",
    { preHandler: requireRoles(...financeRoles) },
    async (request) => {
      const q = request.query as { limit?: string };
      return {
        packs: await listAuditPacks({
          limit: q.limit ? Number(q.limit) : undefined,
        }),
      };
    },
  );

  app.post(
    "/v1/admin/audit-packs",
    { preHandler: requireRoles(...financeRoles) },
    async (request, reply) => {
      const parsed = z
        .object({
          from: z.string().min(4),
          to: z.string().min(4),
          orgId: z.string().uuid().optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      const pack = await createAuditPack({
        from: new Date(parsed.data.from),
        to: new Date(parsed.data.to),
        orgId: parsed.data.orgId,
        actorUserId: request.authUser!.id,
        correlationId: request.id,
      });
      return reply.status(201).send({ pack });
    },
  );

  app.get(
    "/v1/admin/audit-packs/:id/download",
    { preHandler: requireRoles(...financeRoles) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const { zip } = await getAuditPackZip(id);
        return reply
          .header("content-type", "application/zip")
          .header(
            "content-disposition",
            `attachment; filename="vuush-audit-pack-${id.slice(0, 8)}.zip"`,
          )
          .send(zip);
      } catch (err) {
        const message = err instanceof Error ? err.message : "pack_error";
        const status = message === "audit_pack_not_found" ? 404 : 400;
        return reply.status(status).send({ error: message });
      }
    },
  );
}
