import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireAuth, requireRoles } from "../../plugins/auth.js";
import {
  assertOrgMembership,
  canManageOrg,
  canManageSites,
  createOrganisation,
  createOrgSite,
  getOrganisation,
  getPortalHome,
  inviteOrgMember,
  listActiveZones,
  listMyOrgMemberships,
  listOrganisations,
  listOrgMembers,
  listOrgSites,
  updateOrganisation,
  updateOrgSite,
} from "./service.js";

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
    message === "site_not_found"
      ? 404
      : message === "org_name_taken" || message === "already_member"
        ? 409
        : message === "not_org_member" || message === "org_not_active" || message === "forbidden_role"
          ? 403
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
}
