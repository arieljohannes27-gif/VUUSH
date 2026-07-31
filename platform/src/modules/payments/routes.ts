import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRoles } from "../../plugins/auth.js";
import {
  assignDriverToEarning,
  createPayoutBatch,
  executePayoutBatch,
  freezeEarningsForJob,
  getJobMoney,
  getPayoutBatchDetail,
  initializePaystackCheckout,
  listFinanceEarnings,
  listPaymentsForJob,
  listPayoutBatches,
  processWebhook,
} from "./service.js";
import { requestOrExecuteRefund } from "../finance/service.js";
import { env } from "../../config.js";

const financeRoles = ["administrator", "finance_officer"] as const;
const financeReadRoles = [
  "administrator",
  "finance_officer",
  "support_agent",
  "operations_manager",
] as const;

export async function paymentRoutes(app: FastifyInstance) {
  // Capture raw bytes for Paystack HMAC without replacing the global JSON parser.
  app.addHook("preParsing", async (request, _reply, payload) => {
    if (!request.url.includes("/v1/payments/webhooks/")) return payload;
    const chunks: Buffer[] = [];
    for await (const chunk of payload) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks);
    (request as { rawBody?: string }).rawBody = raw.toString("utf8");
    const { Readable } = await import("node:stream");
    return Readable.from(raw);
  });

  app.post(`/v1/payments/webhooks/${env.PSP_PROVIDER}`, async (request, reply) => {
    try {
      const withRaw = request as unknown as { rawBody?: string };
      const rawBody =
        typeof withRaw.rawBody === "string" ? withRaw.rawBody : request.body;
      const result = await processWebhook({
        provider: env.PSP_PROVIDER,
        rawBody,
        headers: request.headers as Record<string, string | string[] | undefined>,
        correlationId: request.id,
      });
      return reply.send({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "webhook_error";
      return reply.status(400).send({ error: message });
    }
  });

  app.post(
    "/v1/jobs/:jobId/payments/initialize",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (env.PSP_PROVIDER !== "paystack") {
        return reply.status(400).send({ error: "paystack_provider_required" });
      }
      const { jobId } = request.params as { jobId: string };
      try {
        const result = await initializePaystackCheckout({
          jobId,
          payerUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return reply.status(201).send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "initialize_error";
        const status =
          message === "forbidden"
            ? 403
            : message === "job_not_found"
              ? 404
              : 400;
        return reply.status(status).send({ error: message });
      }
    },
  );

  app.get(
    "/v1/jobs/:jobId/payments",
    { preHandler: requireAuth },
    async (request) => {
      const { jobId } = request.params as { jobId: string };
      const rows = await listPaymentsForJob(jobId);
      return { payments: rows };
    },
  );

  app.post(
    "/v1/jobs/:jobId/refunds",
    {
      preHandler: requireRoles(
        "administrator",
        "finance_officer",
        "support_agent",
      ),
    },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const parsed = z
        .object({
          amountCents: z.number().int().positive().optional(),
          reasonCode: z.string().min(2),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "validation_error",
          details: parsed.error.flatten(),
        });
      }
      try {
        const result = await requestOrExecuteRefund({
          jobId,
          amountCents: parsed.data.amountCents,
          reasonCode: parsed.data.reasonCode,
          actorUserId: request.authUser!.id,
          actorRoles: request.authUser!.roles,
          correlationId: request.id,
        });
        const status =
          result.status === "needs_finance_approval" ? 202 : 201;
        return reply.status(status).send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "refund_error";
        return reply.status(400).send({ error: message });
      }
    },
  );

  app.get(
    "/v1/finance/earnings",
    { preHandler: requireRoles(...financeReadRoles) },
    async (request) => {
      const q = request.query as {
        driverUserId?: string;
        frozen?: string;
        status?: string;
        limit?: string;
      };
      const frozen =
        q.frozen === "true" ? true : q.frozen === "false" ? false : undefined;
      const earnings = await listFinanceEarnings({
        driverUserId: q.driverUserId || undefined,
        frozen,
        status: q.status || undefined,
        limit: q.limit ? Number(q.limit) : undefined,
      });
      return { earnings };
    },
  );

  app.get(
    "/v1/finance/payout-batches",
    { preHandler: requireRoles(...financeRoles) },
    async (request) => {
      const q = request.query as { limit?: string };
      const batches = await listPayoutBatches({
        limit: q.limit ? Number(q.limit) : undefined,
      });
      return { batches };
    },
  );

  app.get(
    "/v1/finance/payout-batches/:batchId",
    { preHandler: requireRoles(...financeRoles) },
    async (request, reply) => {
      const { batchId } = request.params as { batchId: string };
      try {
        const detail = await getPayoutBatchDetail(batchId);
        return reply.send(detail);
      } catch (err) {
        const message = err instanceof Error ? err.message : "batch_error";
        const status = message === "batch_not_found" ? 404 : 400;
        return reply.status(status).send({ error: message });
      }
    },
  );

  app.get(
    "/v1/finance/jobs/:jobId/money",
    { preHandler: requireRoles(...financeReadRoles) },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      try {
        const money = await getJobMoney(jobId);
        return reply.send(money);
      } catch (err) {
        const message = err instanceof Error ? err.message : "job_money_error";
        const status = message === "job_not_found" ? 404 : 400;
        return reply.status(status).send({ error: message });
      }
    },
  );

  app.post(
    "/v1/finance/earnings/:jobId/freeze",
    {
      preHandler: requireRoles(
        "administrator",
        "finance_officer",
        "operations_manager",
      ),
    },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const parsed = z
        .object({ reason: z.string().min(2) })
        .safeParse(request.body ?? { reason: "incident_hold" });
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      await freezeEarningsForJob({
        jobId,
        reason: parsed.data.reason,
        actorUserId: request.authUser!.id,
        correlationId: request.id,
      });
      return reply.send({ ok: true });
    },
  );

  app.post(
    "/v1/finance/earnings/:jobId/assign-driver",
    {
      preHandler: requireRoles(
        "administrator",
        "finance_officer",
        "dispatcher",
        "operations_manager",
      ),
    },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const parsed = z
        .object({ driverUserId: z.string().uuid() })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      await assignDriverToEarning({
        jobId,
        driverUserId: parsed.data.driverUserId,
      });
      return reply.send({ ok: true });
    },
  );

  app.post(
    "/v1/finance/payout-batches",
    { preHandler: requireRoles(...financeRoles) },
    async (request, reply) => {
      const parsed = z
        .object({ driverUserId: z.string().uuid() })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const result = await createPayoutBatch({
          actorUserId: request.authUser!.id,
          driverUserId: parsed.data.driverUserId,
          correlationId: request.id,
        });
        return reply.status(201).send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "payout_error";
        return reply.status(400).send({ error: message });
      }
    },
  );

  app.post(
    "/v1/finance/payout-batches/:batchId/execute",
    { preHandler: requireRoles(...financeRoles) },
    async (request, reply) => {
      const { batchId } = request.params as { batchId: string };
      try {
        const batch = await executePayoutBatch({
          batchId,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return reply.send({ batch });
      } catch (err) {
        const message = err instanceof Error ? err.message : "payout_error";
        return reply.status(400).send({ error: message });
      }
    },
  );
}
