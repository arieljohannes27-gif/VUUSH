import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRoles } from "../../plugins/auth.js";
import {
  closeBreakGlass,
  getAdminHome,
  grantStaffRole,
  listDriverApplications,
  listFlags,
  listOpenBreakGlass,
  listPricingParams,
  listProhibitedGoods,
  listReasonCodes,
  listServiceTypesAdmin,
  listStaff,
  listZones,
  openBreakGlass,
  reviewDriverApplication,
  revokeStaffRole,
  searchAudit,
  updateFlag,
  updatePricingParam,
  upsertProhibitedGood,
  upsertReasonCode,
  upsertServiceType,
  upsertZone,
} from "./service.js";

const adminOnly = ["administrator"] as const;

function mapError(err: unknown) {
  const message = err instanceof Error ? err.message : "unknown_error";
  const status =
    message.endsWith("_not_found") || message === "user_not_found"
      ? 404
      : message === "last_administrator" || message === "break_glass_not_yours"
        ? 403
        : 400;
  return { status, error: message };
}

export async function adminRoutes(app: FastifyInstance) {
  app.get(
    "/v1/admin/home",
    { preHandler: requireRoles(...adminOnly) },
    async () => getAdminHome(),
  );

  app.get(
    "/v1/admin/flags",
    { preHandler: requireRoles(...adminOnly) },
    async () => ({ flags: await listFlags() }),
  );

  app.patch(
    "/v1/admin/flags/:key",
    { preHandler: requireRoles(...adminOnly) },
    async (request, reply) => {
      const { key } = request.params as { key: string };
      const parsed = z
        .object({
          enabled: z.boolean(),
          value: z.string().nullable().optional(),
          reasonCode: z.string().min(2),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const flag = await updateFlag({
          key,
          enabled: parsed.data.enabled,
          value: parsed.data.value,
          reasonCode: parsed.data.reasonCode,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return { flag };
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/admin/zones",
    { preHandler: requireRoles(...adminOnly) },
    async () => ({ zones: await listZones() }),
  );

  app.post(
    "/v1/admin/zones",
    { preHandler: requireRoles(...adminOnly) },
    async (request, reply) => {
      const parsed = z
        .object({
          code: z.string().min(2),
          name: z.string().min(2),
          city: z.string().min(2),
          active: z.boolean().default(true),
          reasonCode: z.string().min(2),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const zone = await upsertZone({
          ...parsed.data,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return reply.status(201).send({ zone });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.patch(
    "/v1/admin/zones/:id",
    { preHandler: requireRoles(...adminOnly) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z
        .object({
          code: z.string().min(2),
          name: z.string().min(2),
          city: z.string().min(2),
          active: z.boolean(),
          reasonCode: z.string().min(2),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const zone = await upsertZone({
          id,
          ...parsed.data,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return { zone };
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/admin/service-types",
    { preHandler: requireRoles(...adminOnly) },
    async () => ({ serviceTypes: await listServiceTypesAdmin() }),
  );

  app.post(
    "/v1/admin/service-types",
    { preHandler: requireRoles(...adminOnly) },
    async (request, reply) => {
      const parsed = z
        .object({
          code: z.string().min(2),
          name: z.string().min(2),
          description: z.string().nullable().optional(),
          baseFeeCents: z.number().int().nonnegative(),
          perKmFeeCents: z.number().int().nonnegative(),
          priorityMultiplier: z.number().positive(),
          active: z.boolean().default(true),
          reasonCode: z.string().min(2),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const serviceType = await upsertServiceType({
          ...parsed.data,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return reply.status(201).send({ serviceType });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.patch(
    "/v1/admin/service-types/:id",
    { preHandler: requireRoles(...adminOnly) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z
        .object({
          code: z.string().min(2),
          name: z.string().min(2),
          description: z.string().nullable().optional(),
          baseFeeCents: z.number().int().nonnegative(),
          perKmFeeCents: z.number().int().nonnegative(),
          priorityMultiplier: z.number().positive(),
          active: z.boolean(),
          reasonCode: z.string().min(2),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const serviceType = await upsertServiceType({
          id,
          ...parsed.data,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return { serviceType };
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/admin/reason-codes",
    { preHandler: requireRoles(...adminOnly) },
    async () => ({ reasonCodes: await listReasonCodes() }),
  );

  app.post(
    "/v1/admin/reason-codes",
    { preHandler: requireRoles(...adminOnly) },
    async (request, reply) => {
      const parsed = z
        .object({
          code: z.string().min(2),
          domain: z.string().min(2),
          label: z.string().min(2),
          active: z.boolean().default(true),
          severity: z.string().default("ops"),
          reasonCode: z.string().min(2),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const item = await upsertReasonCode({
          ...parsed.data,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return reply.status(201).send({ reasonCode: item });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.patch(
    "/v1/admin/reason-codes/:id",
    { preHandler: requireRoles(...adminOnly) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z
        .object({
          code: z.string().min(2),
          domain: z.string().min(2),
          label: z.string().min(2),
          active: z.boolean(),
          severity: z.string(),
          reasonCode: z.string().min(2),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const item = await upsertReasonCode({
          id,
          ...parsed.data,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return { reasonCode: item };
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/admin/pricing-params",
    { preHandler: requireRoles(...adminOnly) },
    async () => ({ params: await listPricingParams() }),
  );

  app.patch(
    "/v1/admin/pricing-params/:key",
    { preHandler: requireRoles(...adminOnly) },
    async (request, reply) => {
      const { key } = request.params as { key: string };
      const parsed = z
        .object({
          valueJson: z.record(z.unknown()),
          description: z.string().nullable().optional(),
          reasonCode: z.string().min(2),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const param = await updatePricingParam({
          key,
          valueJson: parsed.data.valueJson,
          description: parsed.data.description,
          reasonCode: parsed.data.reasonCode,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return { param };
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/admin/prohibited-goods",
    { preHandler: requireRoles(...adminOnly) },
    async () => ({ items: await listProhibitedGoods() }),
  );

  app.post(
    "/v1/admin/prohibited-goods",
    { preHandler: requireRoles(...adminOnly) },
    async (request, reply) => {
      const parsed = z
        .object({
          label: z.string().min(2),
          active: z.boolean().default(true),
          sortOrder: z.number().int().default(0),
          reasonCode: z.string().min(2),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const item = await upsertProhibitedGood({
          ...parsed.data,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return reply.status(201).send({ item });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.patch(
    "/v1/admin/prohibited-goods/:id",
    { preHandler: requireRoles(...adminOnly) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z
        .object({
          label: z.string().min(2),
          active: z.boolean(),
          sortOrder: z.number().int(),
          reasonCode: z.string().min(2),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const item = await upsertProhibitedGood({
          id,
          ...parsed.data,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return { item };
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/admin/drivers/applications",
    { preHandler: requireRoles(...adminOnly) },
    async (request) => {
      const q = request.query as { status?: string };
      return {
        applications: await listDriverApplications(q.status),
      };
    },
  );

  app.post(
    "/v1/admin/drivers/:userId/review",
    { preHandler: requireRoles(...adminOnly) },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const parsed = z
        .object({
          decision: z.enum(["approve", "reject", "needs_more_info"]),
          reasonCode: z.string().min(2),
          reasonNote: z.string().max(500).optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const profile = await reviewDriverApplication({
          userId,
          decision: parsed.data.decision,
          reasonCode: parsed.data.reasonCode,
          reasonNote: parsed.data.reasonNote,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return { profile };
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/admin/staff",
    { preHandler: requireRoles(...adminOnly) },
    async () => ({ staff: await listStaff() }),
  );

  app.post(
    "/v1/admin/staff/:userId/roles",
    { preHandler: requireRoles(...adminOnly) },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const parsed = z
        .object({
          role: z.string().min(2),
          reasonCode: z.string().min(2),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        await grantStaffRole({
          userId,
          role: parsed.data.role,
          reasonCode: parsed.data.reasonCode,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return { ok: true };
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.delete(
    "/v1/admin/staff/:userId/roles/:role",
    { preHandler: requireRoles(...adminOnly) },
    async (request, reply) => {
      const { userId, role } = request.params as {
        userId: string;
        role: string;
      };
      const q = request.query as { reasonCode?: string };
      const reasonCode = q.reasonCode;
      if (!reasonCode || reasonCode.length < 2) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        await revokeStaffRole({
          userId,
          role,
          reasonCode,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return { ok: true };
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/admin/audit",
    { preHandler: requireRoles(...adminOnly) },
    async (request) => {
      const q = request.query as { q?: string; action?: string; limit?: string };
      const events = await searchAudit({
        q: q.q,
        action: q.action,
        limit: q.limit ? Number(q.limit) : undefined,
      });
      return { events };
    },
  );

  app.get(
    "/v1/admin/break-glass",
    { preHandler: requireRoles(...adminOnly) },
    async () => ({ sessions: await listOpenBreakGlass() }),
  );

  app.post(
    "/v1/admin/break-glass",
    { preHandler: requireRoles(...adminOnly) },
    async (request, reply) => {
      const parsed = z
        .object({
          reason: z.string().min(4),
          minutes: z.number().int().min(5).max(30).optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const session = await openBreakGlass({
          userId: request.authUser!.id,
          reason: parsed.data.reason,
          minutes: parsed.data.minutes,
          correlationId: request.id,
        });
        return reply.status(201).send({ session });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/admin/break-glass/:id/close",
    { preHandler: requireRoles(...adminOnly) },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const session = await closeBreakGlass({
          id,
          userId: request.authUser!.id,
          correlationId: request.id,
        });
        return { session };
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );
}
