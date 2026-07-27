import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  jobs,
  orgMemberships,
  organisations,
  orgSites,
  users,
  zones,
} from "../../db/schema.js";
import { writeAuditEvent } from "../audit/service.js";
import { assignRole } from "../identity/service.js";

const ORG_ROLES = ["org_admin", "booker", "approver", "viewer"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

function isOrgRole(value: string): value is OrgRole {
  return (ORG_ROLES as readonly string[]).includes(value);
}

function emailLookupCandidates(email: string): string[] {
  const e = email.trim().toLowerCase();
  const out = [e];
  if (e.endsWith("@vuush.local")) {
    out.push(e.replace(/@vuush\.local$/, "@swift.local"));
  } else if (e.endsWith("@swift.local")) {
    out.push(e.replace(/@swift\.local$/, "@vuush.local"));
  }
  return [...new Set(out)];
}

async function findOrCreateUserByEmail(email: string, displayName?: string) {
  const normalized = email.trim().toLowerCase();
  const candidates = emailLookupCandidates(normalized);
  const existing = await db.query.users.findFirst({
    where: inArray(users.email, candidates),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({
      email: normalized,
      displayName: displayName?.trim() || normalized,
      status: "active",
    })
    .returning();
  return created;
}

export async function listOrganisations() {
  const rows = await db
    .select({
      id: organisations.id,
      name: organisations.name,
      status: organisations.status,
      billingEmail: organisations.billingEmail,
      approvalThresholdCents: organisations.approvalThresholdCents,
      payMode: organisations.payMode,
      cityCode: organisations.cityCode,
      createdAt: organisations.createdAt,
      memberCount: sql<number>`(
        select count(*)::int from org_memberships m where m.org_id = ${organisations.id}
      )`,
    })
    .from(organisations)
    .orderBy(desc(organisations.createdAt));
  return rows;
}

export async function getOrganisation(orgId: string) {
  const org = await db.query.organisations.findFirst({
    where: eq(organisations.id, orgId),
  });
  if (!org) throw new Error("org_not_found");

  const members = await db
    .select({
      membershipId: orgMemberships.id,
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      role: orgMemberships.role,
      createdAt: orgMemberships.createdAt,
    })
    .from(orgMemberships)
    .innerJoin(users, eq(users.id, orgMemberships.userId))
    .where(eq(orgMemberships.orgId, orgId))
    .orderBy(orgMemberships.createdAt);

  const sites = await db
    .select()
    .from(orgSites)
    .where(eq(orgSites.orgId, orgId))
    .orderBy(orgSites.createdAt);

  return { org, members, sites };
}

export async function createOrganisation(input: {
  name: string;
  billingEmail?: string;
  approvalThresholdCents?: number | null;
  payMode?: string;
  cityCode?: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("org_name_required");

  const existing = await db.query.organisations.findFirst({
    where: eq(organisations.name, name),
  });
  if (existing) throw new Error("org_name_taken");

  const [org] = await db
    .insert(organisations)
    .values({
      name,
      billingEmail: input.billingEmail?.trim().toLowerCase() || null,
      approvalThresholdCents: input.approvalThresholdCents ?? null,
      payMode: input.payMode ?? "statement",
      cityCode: input.cityCode ?? "CPT",
      status: "active",
    })
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "ORG_CREATED",
    subjectType: "organisation",
    subjectId: org.id,
    correlationId: input.correlationId,
    payload: { name: org.name, cityCode: org.cityCode },
  });

  return org;
}

export async function updateOrganisation(input: {
  orgId: string;
  status?: string;
  billingEmail?: string | null;
  approvalThresholdCents?: number | null;
  actorUserId: string;
  correlationId?: string;
}) {
  const org = await db.query.organisations.findFirst({
    where: eq(organisations.id, input.orgId),
  });
  if (!org) throw new Error("org_not_found");

  if (input.status && !["active", "suspended"].includes(input.status)) {
    throw new Error("invalid_org_status");
  }

  const [updated] = await db
    .update(organisations)
    .set({
      status: input.status ?? org.status,
      billingEmail:
        input.billingEmail !== undefined
          ? input.billingEmail?.trim().toLowerCase() || null
          : org.billingEmail,
      approvalThresholdCents:
        input.approvalThresholdCents !== undefined
          ? input.approvalThresholdCents
          : org.approvalThresholdCents,
      updatedAt: new Date(),
    })
    .where(eq(organisations.id, input.orgId))
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "ORG_UPDATED",
    subjectType: "organisation",
    subjectId: updated.id,
    correlationId: input.correlationId,
    payload: {
      status: updated.status,
      billingEmail: updated.billingEmail,
    },
  });

  return updated;
}

export async function inviteOrgMember(input: {
  orgId: string;
  email: string;
  displayName?: string;
  role: string;
  actorUserId: string;
  correlationId?: string;
}) {
  if (!isOrgRole(input.role)) throw new Error("invalid_org_role");

  const org = await db.query.organisations.findFirst({
    where: eq(organisations.id, input.orgId),
  });
  if (!org) throw new Error("org_not_found");
  if (org.status !== "active") throw new Error("org_not_active");

  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("invalid_email");

  const user = await findOrCreateUserByEmail(email, input.displayName);

  const existing = await db.query.orgMemberships.findFirst({
    where: and(
      eq(orgMemberships.orgId, input.orgId),
      eq(orgMemberships.userId, user.id),
    ),
  });
  if (existing) throw new Error("already_member");

  const [membership] = await db
    .insert(orgMemberships)
    .values({
      orgId: input.orgId,
      userId: user.id,
      role: input.role,
    })
    .returning();

  await assignRole({
    userId: user.id,
    role: "enterprise_customer",
    scopeType: "org",
    scopeId: input.orgId,
    actorId: input.actorUserId,
    correlationId: input.correlationId,
  });

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "ORG_MEMBER_INVITED",
    subjectType: "organisation",
    subjectId: input.orgId,
    correlationId: input.correlationId,
    payload: {
      userId: user.id,
      email,
      role: input.role,
      membershipId: membership.id,
    },
  });

  return {
    membership,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
  };
}

/** Portal — memberships for the signed-in user. */
export async function listMyOrgMemberships(userId: string) {
  const rows = await db
    .select({
      orgId: organisations.id,
      orgName: organisations.name,
      orgStatus: organisations.status,
      cityCode: organisations.cityCode,
      payMode: organisations.payMode,
      role: orgMemberships.role,
      membershipId: orgMemberships.id,
    })
    .from(orgMemberships)
    .innerJoin(organisations, eq(organisations.id, orgMemberships.orgId))
    .where(eq(orgMemberships.userId, userId))
    .orderBy(organisations.name);
  return rows;
}

export async function assertOrgMembership(userId: string, orgId: string) {
  const row = await db
    .select({
      membershipId: orgMemberships.id,
      role: orgMemberships.role,
      orgId: organisations.id,
      orgName: organisations.name,
      orgStatus: organisations.status,
      cityCode: organisations.cityCode,
      payMode: organisations.payMode,
      billingEmail: organisations.billingEmail,
      approvalThresholdCents: organisations.approvalThresholdCents,
    })
    .from(orgMemberships)
    .innerJoin(organisations, eq(organisations.id, orgMemberships.orgId))
    .where(
      and(eq(orgMemberships.userId, userId), eq(orgMemberships.orgId, orgId)),
    )
    .limit(1);
  const membership = row[0];
  if (!membership) throw new Error("not_org_member");
  if (membership.orgStatus !== "active") throw new Error("org_not_active");
  return membership;
}

export async function getPortalHome(orgId: string) {
  const [siteCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orgSites)
    .where(eq(orgSites.orgId, orgId));
  const [memberCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orgMemberships)
    .where(eq(orgMemberships.orgId, orgId));
  const [liveJobs] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(jobs)
    .where(
      and(
        eq(jobs.orgId, orgId),
        inArray(jobs.state, [
          "CONFIRMED",
          "ASSIGNED",
          "EN_ROUTE_PICKUP",
          "ARRIVED_PICKUP",
          "PICKED_UP",
          "IN_TRANSIT",
          "ARRIVED_DROPOFF",
        ]),
      ),
    );
  const [todayJobs] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(jobs)
    .where(
      and(
        eq(jobs.orgId, orgId),
        sql`${jobs.createdAt} >= date_trunc('day', now())`,
      ),
    );

  return {
    sites: siteCount?.n ?? 0,
    members: memberCount?.n ?? 0,
    liveShipments: liveJobs?.n ?? 0,
    todayShipments: todayJobs?.n ?? 0,
    pendingApprovals: 0,
  };
}

export async function listOrgSites(orgId: string) {
  return db
    .select()
    .from(orgSites)
    .where(eq(orgSites.orgId, orgId))
    .orderBy(orgSites.label);
}

export async function createOrgSite(input: {
  orgId: string;
  label: string;
  address: string;
  zoneCode?: string | null;
  kind?: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const label = input.label.trim();
  const address = input.address.trim();
  if (label.length < 1) throw new Error("site_label_required");
  if (address.length < 3) throw new Error("site_address_required");
  const kind = input.kind ?? "other";
  if (!["warehouse", "store", "other"].includes(kind)) {
    throw new Error("invalid_site_kind");
  }

  const [site] = await db
    .insert(orgSites)
    .values({
      orgId: input.orgId,
      label,
      address,
      zoneCode: input.zoneCode?.trim() || null,
      kind,
    })
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "ORG_SITE_CREATED",
    subjectType: "organisation",
    subjectId: input.orgId,
    correlationId: input.correlationId,
    payload: { siteId: site.id, label: site.label, kind: site.kind },
  });

  return site;
}

export async function updateOrgSite(input: {
  orgId: string;
  siteId: string;
  label?: string;
  address?: string;
  zoneCode?: string | null;
  kind?: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const existing = await db.query.orgSites.findFirst({
    where: and(eq(orgSites.id, input.siteId), eq(orgSites.orgId, input.orgId)),
  });
  if (!existing) throw new Error("site_not_found");

  if (input.kind && !["warehouse", "store", "other"].includes(input.kind)) {
    throw new Error("invalid_site_kind");
  }

  const [site] = await db
    .update(orgSites)
    .set({
      label: input.label?.trim() || existing.label,
      address: input.address?.trim() || existing.address,
      zoneCode:
        input.zoneCode !== undefined
          ? input.zoneCode?.trim() || null
          : existing.zoneCode,
      kind: input.kind ?? existing.kind,
      updatedAt: new Date(),
    })
    .where(eq(orgSites.id, input.siteId))
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "ORG_SITE_UPDATED",
    subjectType: "organisation",
    subjectId: input.orgId,
    correlationId: input.correlationId,
    payload: { siteId: site.id },
  });

  return site;
}

export async function listOrgMembers(orgId: string) {
  return db
    .select({
      membershipId: orgMemberships.id,
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      role: orgMemberships.role,
      createdAt: orgMemberships.createdAt,
    })
    .from(orgMemberships)
    .innerJoin(users, eq(users.id, orgMemberships.userId))
    .where(eq(orgMemberships.orgId, orgId))
    .orderBy(orgMemberships.createdAt);
}

export async function listActiveZones() {
  return db
    .select({
      code: zones.code,
      name: zones.name,
      city: zones.city,
    })
    .from(zones)
    .where(eq(zones.active, true))
    .orderBy(zones.code);
}

export function canManageOrg(role: string) {
  return role === "org_admin";
}

export function canManageSites(role: string) {
  return role === "org_admin" || role === "booker";
}
