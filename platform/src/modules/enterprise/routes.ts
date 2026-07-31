import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireAuth, requireRoles } from "../../plugins/auth.js";
import {
  assertOrgMembership,
  adminResetOrgMemberPassword,
  attachJobStops,
  canApproveShipments,
  canBookShipments,
  canManageOrg,
  canManageSites,
  createOrgApiKey,
  createOrganisation,
  createOrgSite,
  generateWeeklyStatement,
  getOrganisation,
  getOrgInvoice,
  getPortalHome,
  inviteOrgMember,
  listActiveZones,
  listJobStops,
  listMyOrgMemberships,
  listOrgApiKeys,
  listOrgInvoices,
  listOrganisations,
  listOrgMembers,
  listOrgSites,
  listPendingApprovalJobs,
  revokeOrgApiKey,
  signupEnterprise,
  suburbSortStops,
  updateOrganisation,
  updateOrgSite,
} from "./service.js";
import {
  cancelJob,
  confirmJob,
  createDraftJob,
  getJobForOrg,
  listCatalog,
  listJobsForOrg,
  quoteJob,
} from "../booking/service.js";

const adminOnly = ["administrator"] as const;

type OrgCtx = Awaited<ReturnType<typeof assertOrgMembership>>;

declare module "fastify" {
  interface FastifyRequest {
    orgContext?: OrgCtx;
  }
}

function mapError(err: unknown) {
  const message = err instanceof Error ? err.message : "unknown_error";
  const status =
    message === "org_not_found" ||
    message === "user_not_found" ||
    message === "site_not_found" ||
    message === "invoice_not_found" ||
    message === "api_key_not_found" ||
    message === "job_not_found"
      ? 404
      : message === "org_name_taken" ||
          message === "already_member" ||
          message === "email_taken"
        ? 409
        : message === "not_org_member" ||
            message === "org_not_active" ||
            message === "forbidden_role"
          ? 403
          : message === "no_billable_jobs" ||
              message === "stops_min_two" ||
              message === "illegal_transition" ||
              message === "quote_expired" ||
              message === "quote_required" ||
              message === "payment_failed" ||
              message === "zone_unserviceable" ||
              message === "service_type_invalid" ||
              message === "prohibited_goods_declaration_required" ||
              message === "prohibited_goods_blocked" ||
              message === "password_too_short" ||
              message === "org_name_required" ||
              message === "display_name_required" ||
              message === "invalid_email"
            ? 400
            : 400;
  return { status, error: message };
}

async function requireOrgContext(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  await requireAuth(request, reply);
  if (reply.sent) return;
  const orgId =
    (request.headers["x-org-id"] as string | undefined)?.trim() ||
    (request.query as { orgId?: string }).orgId?.trim();
  if (!orgId) {
    return reply.status(400).send({ error: "org_required" });
  }
  try {
    request.orgContext = await assertOrgMembership(
      request.authUser!.id,
      orgId,
    );
  } catch (err) {
    const mapped = mapError(err);
    return reply.status(mapped.status).send({ error: mapped.error });
  }
}

export async function enterpriseRoutes(app: FastifyInstance) {
  /* —— Admin (E0) —— */

  app.get(
    "/v1/admin/orgs",
    { preHandler: requireRoles(...adminOnly) },
    async () => ({ organisations: await listOrganisations() }),
  );

  app.get(
    "/v1/admin/orgs/:orgId",
    { preHandler: requireRoles(...adminOnly) },
    async (request, reply) => {
      const { orgId } = request.params as { orgId: string };
      try {
        return await getOrganisation(orgId);
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/admin/orgs",
    { preHandler: requireRoles(...adminOnly) },
    async (request, reply) => {
      const parsed = z
        .object({
          name: z.string().min(2).max(200),
          billingEmail: z.string().email().optional(),
          approvalThresholdCents: z
            .number()
            .int()
            .nonnegative()
            .nullable()
            .optional(),
          payMode: z.enum(["statement", "card"]).optional(),
          cityCode: z.string().min(2).max(16).optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const org = await createOrganisation({
          ...parsed.data,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return reply.status(201).send({ org });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.patch(
    "/v1/admin/orgs/:orgId",
    { preHandler: requireRoles(...adminOnly) },
    async (request, reply) => {
      const { orgId } = request.params as { orgId: string };
      const parsed = z
        .object({
          status: z.enum(["active", "suspended"]).optional(),
          billingEmail: z.string().email().nullable().optional(),
          approvalThresholdCents: z
            .number()
            .int()
            .nonnegative()
            .nullable()
            .optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const org = await updateOrganisation({
          orgId,
          ...parsed.data,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return { org };
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/admin/orgs/:orgId/invite",
    { preHandler: requireRoles(...adminOnly) },
    async (request, reply) => {
      const { orgId } = request.params as { orgId: string };
      const parsed = z
        .object({
          email: z.string().email(),
          displayName: z.string().min(1).max(200).optional(),
          role: z
            .enum(["org_admin", "booker", "approver", "viewer"])
            .default("org_admin"),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const result = await inviteOrgMember({
          orgId,
          email: parsed.data.email,
          displayName: parsed.data.displayName,
          role: parsed.data.role,
          actorUserId: request.authUser!.id,
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
    "/v1/admin/orgs/:orgId/members/:userId/reset-password",
    { preHandler: requireRoles(...adminOnly) },
    async (request, reply) => {
      const { orgId, userId } = request.params as {
        orgId: string;
        userId: string;
      };
      try {
        const result = await adminResetOrgMemberPassword({
          orgId,
          userId,
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

  /* —— Public signup —— */

  app.post("/v1/enterprise/signup", async (request, reply) => {
    const parsed = z
      .object({
        companyName: z.string().min(2).max(200),
        displayName: z.string().min(2).max(200),
        email: z.string().email(),
        password: z.string().min(8).max(200),
      })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "validation_error" });
    }
    try {
      const result = await signupEnterprise({
        ...parsed.data,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
        correlationId: request.id,
      });
      return reply.status(201).send(result);
    } catch (err) {
      const mapped = mapError(err);
      return reply.status(mapped.status).send({ error: mapped.error });
    }
  });

  /* —— Portal (E1) —— */

  app.get(
    "/v1/enterprise/session",
    { preHandler: requireAuth },
    async (request, reply) => {
      const memberships = await listMyOrgMemberships(request.authUser!.id);
      if (memberships.length === 0) {
        return reply.status(403).send({ error: "no_org_membership" });
      }
      return {
        user: request.authUser,
        memberships,
      };
    },
  );

  app.get(
    "/v1/enterprise/home",
    { preHandler: requireOrgContext },
    async (request) => {
      const ctx = request.orgContext!;
      const stats = await getPortalHome(ctx.orgId);
      return {
        org: {
          id: ctx.orgId,
          name: ctx.orgName,
          cityCode: ctx.cityCode,
          payMode: ctx.payMode,
        },
        role: ctx.role,
        stats,
      };
    },
  );

  app.get(
    "/v1/enterprise/zones",
    { preHandler: requireOrgContext },
    async () => ({ zones: await listActiveZones() }),
  );

  app.get(
    "/v1/enterprise/sites",
    { preHandler: requireOrgContext },
    async (request) => ({
      sites: await listOrgSites(request.orgContext!.orgId),
    }),
  );

  app.post(
    "/v1/enterprise/sites",
    { preHandler: requireOrgContext },
    async (request, reply) => {
      if (!canManageSites(request.orgContext!.role)) {
        return reply.status(403).send({ error: "forbidden_role" });
      }
      const parsed = z
        .object({
          label: z.string().min(1).max(120),
          address: z.string().min(3).max(500),
          zoneCode: z.string().min(2).max(32).nullable().optional(),
          kind: z.enum(["warehouse", "store", "other"]).optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const site = await createOrgSite({
          orgId: request.orgContext!.orgId,
          ...parsed.data,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return reply.status(201).send({ site });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.patch(
    "/v1/enterprise/sites/:siteId",
    { preHandler: requireOrgContext },
    async (request, reply) => {
      if (!canManageSites(request.orgContext!.role)) {
        return reply.status(403).send({ error: "forbidden_role" });
      }
      const { siteId } = request.params as { siteId: string };
      const parsed = z
        .object({
          label: z.string().min(1).max(120).optional(),
          address: z.string().min(3).max(500).optional(),
          zoneCode: z.string().min(2).max(32).nullable().optional(),
          kind: z.enum(["warehouse", "store", "other"]).optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const site = await updateOrgSite({
          orgId: request.orgContext!.orgId,
          siteId,
          ...parsed.data,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return { site };
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/enterprise/members",
    { preHandler: requireOrgContext },
    async (request) => ({
      members: await listOrgMembers(request.orgContext!.orgId),
    }),
  );

  app.post(
    "/v1/enterprise/members/invite",
    { preHandler: requireOrgContext },
    async (request, reply) => {
      if (!canManageOrg(request.orgContext!.role)) {
        return reply.status(403).send({ error: "forbidden_role" });
      }
      const parsed = z
        .object({
          email: z.string().email(),
          displayName: z.string().min(1).max(200).optional(),
          role: z
            .enum(["org_admin", "booker", "approver", "viewer"])
            .default("booker"),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const result = await inviteOrgMember({
          orgId: request.orgContext!.orgId,
          email: parsed.data.email,
          displayName: parsed.data.displayName,
          role: parsed.data.role,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return reply.status(201).send(result);
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  /* —— E2 Shipments —— */

  app.get(
    "/v1/enterprise/catalog",
    { preHandler: requireOrgContext },
    async () => listCatalog(),
  );

  app.get(
    "/v1/enterprise/jobs",
    { preHandler: requireOrgContext },
    async (request) => ({
      jobs: await listJobsForOrg(request.orgContext!.orgId),
    }),
  );

  app.get(
    "/v1/enterprise/jobs/:jobId",
    { preHandler: requireOrgContext },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const detail = await getJobForOrg({
        jobId,
        orgId: request.orgContext!.orgId,
      });
      if (!detail) {
        return reply.status(404).send({ error: "job_not_found" });
      }
      return detail;
    },
  );

  app.post(
    "/v1/enterprise/jobs",
    { preHandler: requireOrgContext },
    async (request, reply) => {
      if (!canBookShipments(request.orgContext!.role)) {
        return reply.status(403).send({ error: "forbidden_role" });
      }
      const parsed = z
        .object({
          serviceTypeCode: z.string().min(2),
          packageClass: z.enum(["small", "medium", "large"]).default("small"),
          pickupAddress: z.string().min(3),
          pickupZoneCode: z.string().min(2),
          dropoffAddress: z.string().min(3),
          dropoffZoneCode: z.string().min(2),
          recipientName: z.string().optional(),
          recipientPhone: z.string().optional(),
          notes: z.string().optional(),
          prohibitedGoodsDeclared: z.literal(true),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const job = await createDraftJob({
          ...parsed.data,
          shipperUserId: request.authUser!.id,
          orgId: request.orgContext!.orgId,
          containsProhibitedGoods: false,
          correlationId: request.id,
        });
        return reply.status(201).send({ job });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/enterprise/jobs/:jobId/quote",
    { preHandler: requireOrgContext },
    async (request, reply) => {
      if (!canBookShipments(request.orgContext!.role)) {
        return reply.status(403).send({ error: "forbidden_role" });
      }
      const { jobId } = request.params as { jobId: string };
      const detail = await getJobForOrg({
        jobId,
        orgId: request.orgContext!.orgId,
      });
      if (!detail) {
        return reply.status(404).send({ error: "job_not_found" });
      }
      try {
        const result = await quoteJob({
          jobId,
          userId: request.authUser!.id,
          isAdmin: request.orgContext!.role === "org_admin",
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
    "/v1/enterprise/jobs/:jobId/confirm",
    { preHandler: requireOrgContext },
    async (request, reply) => {
      if (!canBookShipments(request.orgContext!.role)) {
        return reply.status(403).send({ error: "forbidden_role" });
      }
      const { jobId } = request.params as { jobId: string };
      const detail = await getJobForOrg({
        jobId,
        orgId: request.orgContext!.orgId,
      });
      if (!detail) {
        return reply.status(404).send({ error: "job_not_found" });
      }
      try {
        const result = await confirmJob({
          jobId,
          userId: request.authUser!.id,
          isAdmin: request.orgContext!.role === "org_admin",
          correlationId: request.id,
        });
        return result;
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  /* —— E3 Approvals —— */

  app.get(
    "/v1/enterprise/approvals",
    { preHandler: requireOrgContext },
    async (request, reply) => {
      if (!canApproveShipments(request.orgContext!.role)) {
        return reply.status(403).send({ error: "forbidden_role" });
      }
      return {
        jobs: await listPendingApprovalJobs(request.orgContext!.orgId),
      };
    },
  );

  app.post(
    "/v1/enterprise/jobs/:jobId/approve",
    { preHandler: requireOrgContext },
    async (request, reply) => {
      if (!canApproveShipments(request.orgContext!.role)) {
        return reply.status(403).send({ error: "forbidden_role" });
      }
      const { jobId } = request.params as { jobId: string };
      const detail = await getJobForOrg({
        jobId,
        orgId: request.orgContext!.orgId,
      });
      if (!detail) {
        return reply.status(404).send({ error: "job_not_found" });
      }
      try {
        const result = await confirmJob({
          jobId,
          userId: request.authUser!.id,
          isAdmin: true,
          fromApproval: true,
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
    "/v1/enterprise/jobs/:jobId/reject",
    { preHandler: requireOrgContext },
    async (request, reply) => {
      if (!canApproveShipments(request.orgContext!.role)) {
        return reply.status(403).send({ error: "forbidden_role" });
      }
      const { jobId } = request.params as { jobId: string };
      const detail = await getJobForOrg({
        jobId,
        orgId: request.orgContext!.orgId,
      });
      if (!detail) {
        return reply.status(404).send({ error: "job_not_found" });
      }
      try {
        const job = await cancelJob({
          jobId,
          userId: request.authUser!.id,
          isAdmin: true,
          correlationId: request.id,
        });
        return { job };
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.patch(
    "/v1/enterprise/settings",
    { preHandler: requireOrgContext },
    async (request, reply) => {
      if (!canManageOrg(request.orgContext!.role)) {
        return reply.status(403).send({ error: "forbidden_role" });
      }
      const parsed = z
        .object({
          approvalThresholdCents: z.number().int().nonnegative().nullable(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const org = await updateOrganisation({
          orgId: request.orgContext!.orgId,
          approvalThresholdCents: parsed.data.approvalThresholdCents,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return { org };
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  /* —— E4 Statements —— */

  app.get(
    "/v1/enterprise/statements",
    { preHandler: requireOrgContext },
    async (request) => ({
      statements: await listOrgInvoices(request.orgContext!.orgId),
    }),
  );

  app.get(
    "/v1/enterprise/statements/:invoiceId",
    { preHandler: requireOrgContext },
    async (request, reply) => {
      const { invoiceId } = request.params as { invoiceId: string };
      try {
        return await getOrgInvoice(request.orgContext!.orgId, invoiceId);
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/enterprise/statements/generate",
    { preHandler: requireOrgContext },
    async (request, reply) => {
      if (!canManageOrg(request.orgContext!.role)) {
        return reply.status(403).send({ error: "forbidden_role" });
      }
      try {
        const invoice = await generateWeeklyStatement({
          orgId: request.orgContext!.orgId,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return reply.status(201).send({ invoice });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  /* —— E5 API keys —— */

  app.get(
    "/v1/enterprise/api-keys",
    { preHandler: requireOrgContext },
    async (request, reply) => {
      if (!canManageOrg(request.orgContext!.role)) {
        return reply.status(403).send({ error: "forbidden_role" });
      }
      return { keys: await listOrgApiKeys(request.orgContext!.orgId) };
    },
  );

  app.post(
    "/v1/enterprise/api-keys",
    { preHandler: requireOrgContext },
    async (request, reply) => {
      if (!canManageOrg(request.orgContext!.role)) {
        return reply.status(403).send({ error: "forbidden_role" });
      }
      const parsed = z
        .object({ name: z.string().min(1).max(80).default("default") })
        .safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      try {
        const result = await createOrgApiKey({
          orgId: request.orgContext!.orgId,
          name: parsed.data.name,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return reply.status(201).send({
          key: {
            id: result.key.id,
            name: result.key.name,
            keyPrefix: result.key.keyPrefix,
            createdAt: result.key.createdAt,
          },
          secret: result.secret,
        });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.post(
    "/v1/enterprise/api-keys/:keyId/revoke",
    { preHandler: requireOrgContext },
    async (request, reply) => {
      if (!canManageOrg(request.orgContext!.role)) {
        return reply.status(403).send({ error: "forbidden_role" });
      }
      const { keyId } = request.params as { keyId: string };
      try {
        const key = await revokeOrgApiKey({
          orgId: request.orgContext!.orgId,
          keyId,
          actorUserId: request.authUser!.id,
          correlationId: request.id,
        });
        return { key };
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  /* —— E6 Multi-stop —— */

  app.post(
    "/v1/enterprise/jobs/multi-stop",
    { preHandler: requireOrgContext },
    async (request, reply) => {
      if (!canBookShipments(request.orgContext!.role)) {
        return reply.status(403).send({ error: "forbidden_role" });
      }
      const parsed = z
        .object({
          serviceTypeCode: z.string().min(2),
          packageClass: z.enum(["small", "medium", "large"]).default("small"),
          orderingMode: z.enum(["booker", "suburb"]).default("suburb"),
          stops: z
            .array(
              z.object({
                label: z.string().optional(),
                address: z.string().min(3),
                zoneCode: z.string().min(2).optional(),
              }),
            )
            .min(2)
            .max(20),
          notes: z.string().optional(),
          prohibitedGoodsDeclared: z.literal(true),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "validation_error" });
      }
      const stops = parsed.data.stops;
      const orderingMode = parsed.data.orderingMode;
      const driveOrder =
        orderingMode === "suburb" ? suburbSortStops(stops) : stops;
      const first = driveOrder[0];
      const last = driveOrder[driveOrder.length - 1];
      const orderNote =
        orderingMode === "suburb"
          ? `Multi-stop (${stops.length} stops — suburb-sorted order, not a full route optimiser)`
          : `Multi-stop (${stops.length} stops — your stop order)`;
      try {
        const job = await createDraftJob({
          shipperUserId: request.authUser!.id,
          orgId: request.orgContext!.orgId,
          serviceTypeCode: parsed.data.serviceTypeCode,
          packageClass: parsed.data.packageClass,
          pickupAddress: first.address,
          pickupZoneCode: first.zoneCode ?? "CPT-CBD",
          dropoffAddress: last.address,
          dropoffZoneCode: last.zoneCode ?? first.zoneCode ?? "CPT-CBD",
          notes:
            (parsed.data.notes ? `${parsed.data.notes} · ` : "") + orderNote,
          prohibitedGoodsDeclared: true,
          containsProhibitedGoods: false,
          correlationId: request.id,
        });
        const stopRows = await attachJobStops({
          jobId: job.id,
          stops,
          orderingMode,
        });
        return reply.status(201).send({
          job,
          stops: stopRows,
          orderingMode,
          orderingNote:
            orderingMode === "suburb"
              ? "Suburb-sorted order — not a full route optimiser"
              : "Your stop order",
        });
      } catch (err) {
        const mapped = mapError(err);
        return reply.status(mapped.status).send({ error: mapped.error });
      }
    },
  );

  app.get(
    "/v1/enterprise/jobs/:jobId/stops",
    { preHandler: requireOrgContext },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const detail = await getJobForOrg({
        jobId,
        orgId: request.orgContext!.orgId,
      });
      if (!detail) {
        return reply.status(404).send({ error: "job_not_found" });
      }
      return { stops: await listJobStops(jobId) };
    },
  );
}
