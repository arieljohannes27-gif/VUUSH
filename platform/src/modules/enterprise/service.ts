import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { db } from "../../db/client.js";
import {
  jobs,
  jobStops,
  orgApiKeys,
  orgInvoiceLines,
  orgInvoices,
  orgMemberships,
  organisations,
  orgSites,
  quotes,
  users,
  zones,
} from "../../db/schema.js";
import { writeAuditEvent } from "../audit/service.js";
import { hashPassword } from "../identity/crypto.js";
import { emailLookupCandidates } from "../identity/email-aliases.js";
import {
  assignRole,
  consumeOtpChallenge,
  createSessionForUser,
  getUserRoles,
  requestOtp,
} from "../identity/service.js";
import { assertPdfOrImageDataUrl } from "../identity/doc-validate.js";

const ORG_ROLES = ["org_admin", "booker", "approver", "viewer"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

function isOrgRole(value: string): value is OrgRole {
  return (ORG_ROLES as readonly string[]).includes(value);
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
      billingContactName: organisations.billingContactName,
      registrationNumber: organisations.registrationNumber,
      vatNumber: organisations.vatNumber,
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

/** Self-serve: company + Org Admin account with password (returned session). */
export async function startEnterpriseRegister(input: {
  companyName: string;
  displayName: string;
  email: string;
  correlationId?: string;
}) {
  const companyName = input.companyName.trim();
  const displayName = input.displayName.trim();
  const email = input.email.trim().toLowerCase();
  if (companyName.length < 2) throw new Error("org_name_required");
  if (displayName.length < 2) throw new Error("display_name_required");
  if (!email.includes("@")) throw new Error("invalid_email");

  const nameTaken = await db.query.organisations.findFirst({
    where: eq(organisations.name, companyName),
  });
  if (nameTaken) throw new Error("org_name_taken");

  const existingUser = await db.query.users.findFirst({
    where: inArray(users.email, emailLookupCandidates(email)),
  });
  if (existingUser?.passwordHash) throw new Error("email_taken");

  const otp = await requestOtp({
    channel: "email",
    destination: email,
    correlationId: input.correlationId,
  });

  await writeAuditEvent({
    actorType: "system",
    action: "ORG_REGISTER_START",
    subjectType: "organisation",
    subjectId: null,
    correlationId: input.correlationId,
    payload: { email, companyName },
  });

  return {
    challengeId: otp.challengeId,
    expiresAt: otp.expiresAt,
    ...(otp.devCode ? { devCode: otp.devCode } : {}),
  };
}

export async function completeEnterpriseRegister(input: {
  challengeId: string;
  code: string;
  companyName: string;
  displayName: string;
  email: string;
  password: string;
  billingEmail: string;
  billingContactName?: string;
  payMode?: "statement" | "card";
  cityCode?: string;
  registrationNumber?: string;
  vatNumber?: string;
  companyDocUrl?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}) {
  const companyName = input.companyName.trim();
  const displayName = input.displayName.trim();
  const email = input.email.trim().toLowerCase();
  const billingEmail = input.billingEmail.trim().toLowerCase();
  const billingContactName = input.billingContactName?.trim() || displayName;
  const payMode = input.payMode ?? "statement";
  const cityCode = (input.cityCode ?? "CPT").trim().toUpperCase() || "CPT";
  const registrationNumber = input.registrationNumber?.trim() || null;
  const vatNumber = input.vatNumber?.trim() || null;

  if (companyName.length < 2) throw new Error("org_name_required");
  if (displayName.length < 2) throw new Error("display_name_required");
  if (!email.includes("@")) throw new Error("invalid_email");
  if (!billingEmail.includes("@")) throw new Error("billing_email_required");
  if (input.password.length < 8) throw new Error("password_too_short");
  if (payMode !== "statement" && payMode !== "card") {
    throw new Error("pay_mode_invalid");
  }

  const consumed = await consumeOtpChallenge({
    challengeId: input.challengeId,
    code: input.code,
    correlationId: input.correlationId,
  });
  if (!consumed.ok) throw new Error(consumed.error);
  if (consumed.channel !== "email") throw new Error("invalid_code");
  if (consumed.destination.trim().toLowerCase() !== email) {
    throw new Error("email_mismatch");
  }

  let companyDocUrl: string | null = null;
  if (input.companyDocUrl?.trim()) {
    const doc = assertPdfOrImageDataUrl(
      input.companyDocUrl.trim(),
      "company_doc_invalid",
    );
    if (typeof doc !== "string") throw new Error(doc.error);
    companyDocUrl = doc;
  }

  const nameTaken = await db.query.organisations.findFirst({
    where: eq(organisations.name, companyName),
  });
  if (nameTaken) throw new Error("org_name_taken");

  const existingUser = await db.query.users.findFirst({
    where: inArray(users.email, emailLookupCandidates(email)),
  });
  if (existingUser?.passwordHash) throw new Error("email_taken");

  const missingRequired =
    !billingEmail || !billingContactName || companyName.length < 2;
  // Self-serve signups always wait for VUUSH Admin approval.
  const status = "pending_review";
  void missingRequired;

  const [org] = await db
    .insert(organisations)
    .values({
      name: companyName,
      billingEmail,
      billingContactName,
      registrationNumber,
      vatNumber,
      companyDocUrl,
      payMode,
      cityCode,
      status,
    })
    .returning();

  let user = existingUser;
  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        email,
        displayName,
        passwordHash: hashPassword(input.password),
        status: "active",
      })
      .returning();
  } else {
    await db
      .update(users)
      .set({
        displayName,
        passwordHash: hashPassword(input.password),
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    user = (
      await db.query.users.findFirst({ where: eq(users.id, user.id) })
    )!;
  }

  const [membership] = await db
    .insert(orgMemberships)
    .values({
      orgId: org.id,
      userId: user.id,
      role: "org_admin",
    })
    .returning();

  await assignRole({
    userId: user.id,
    role: "enterprise_customer",
    scopeType: "org",
    scopeId: org.id,
    actorId: user.id,
    correlationId: input.correlationId,
  });

  await writeAuditEvent({
    actorType: "user",
    actorId: user.id,
    action: "ORG_SELF_SIGNUP_REVIEW",
    subjectType: "organisation",
    subjectId: org.id,
    correlationId: input.correlationId,
    payload: {
      email,
      membershipId: membership.id,
      status,
      payMode,
      hasCompanyDoc: Boolean(companyDocUrl),
      incomplete: missingRequired,
    },
  });

  return {
    status: "pending_review" as const,
    org: {
      id: org.id,
      name: org.name,
      cityCode: org.cityCode,
      payMode: org.payMode,
      status: org.status,
    },
  };
}

/** @deprecated Prefer startEnterpriseRegister + completeEnterpriseRegister */
export async function signupEnterprise(input: {
  companyName: string;
  displayName: string;
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}) {
  const start = await startEnterpriseRegister({
    companyName: input.companyName,
    displayName: input.displayName,
    email: input.email,
    correlationId: input.correlationId,
  });
  if (!start.devCode) {
    throw new Error("email_verification_required");
  }
  return completeEnterpriseRegister({
    challengeId: start.challengeId,
    code: start.devCode,
    companyName: input.companyName,
    displayName: input.displayName,
    email: input.email,
    password: input.password,
    billingEmail: input.email,
    billingContactName: input.displayName,
    payMode: "statement",
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    correlationId: input.correlationId,
  });
}

/** Admin cannot read old passwords — only issue a new temporary one (shown once). */
export async function adminResetOrgMemberPassword(input: {
  orgId: string;
  userId: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const membership = await db.query.orgMemberships.findFirst({
    where: and(
      eq(orgMemberships.orgId, input.orgId),
      eq(orgMemberships.userId, input.userId),
    ),
  });
  if (!membership) throw new Error("not_org_member");

  const user = await db.query.users.findFirst({
    where: eq(users.id, input.userId),
  });
  if (!user) throw new Error("user_not_found");

  const temporaryPassword = `Vuush-${randomBytes(5).toString("hex")}`;
  await db
    .update(users)
    .set({
      passwordHash: hashPassword(temporaryPassword),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "ORG_MEMBER_PASSWORD_RESET",
    subjectType: "user",
    subjectId: user.id,
    correlationId: input.correlationId,
    payload: { orgId: input.orgId, email: user.email },
  });

  return {
    userId: user.id,
    email: user.email,
    temporaryPassword,
  };
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

  if (
    input.status &&
    !["active", "suspended", "pending_review", "rejected"].includes(input.status)
  ) {
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

  const action =
    input.status === "active" && org.status === "pending_review"
      ? "ORG_APPROVED"
      : input.status === "rejected"
        ? "ORG_REJECTED"
        : "ORG_UPDATED";

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action,
    subjectType: "organisation",
    subjectId: updated.id,
    correlationId: input.correlationId,
    payload: {
      status: updated.status,
      previousStatus: org.status,
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
  const [pending] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(jobs)
    .where(
      and(eq(jobs.orgId, orgId), eq(jobs.state, "PENDING_APPROVAL")),
    );

  return {
    sites: siteCount?.n ?? 0,
    members: memberCount?.n ?? 0,
    liveShipments: liveJobs?.n ?? 0,
    todayShipments: todayJobs?.n ?? 0,
    pendingApprovals: pending?.n ?? 0,
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

export function canBookShipments(role: string) {
  return role === "org_admin" || role === "booker";
}

export function canApproveShipments(role: string) {
  return role === "org_admin" || role === "approver";
}

export async function listPendingApprovalJobs(orgId: string) {
  return db
    .select()
    .from(jobs)
    .where(and(eq(jobs.orgId, orgId), eq(jobs.state, "PENDING_APPROVAL")))
    .orderBy(jobs.createdAt);
}

export async function listOrgInvoices(orgId: string) {
  return db
    .select()
    .from(orgInvoices)
    .where(eq(orgInvoices.orgId, orgId))
    .orderBy(desc(orgInvoices.createdAt));
}

export async function getOrgInvoice(orgId: string, invoiceId: string) {
  const invoice = await db.query.orgInvoices.findFirst({
    where: and(eq(orgInvoices.id, invoiceId), eq(orgInvoices.orgId, orgId)),
  });
  if (!invoice) throw new Error("invoice_not_found");
  const lines = await db
    .select()
    .from(orgInvoiceLines)
    .where(eq(orgInvoiceLines.invoiceId, invoiceId));
  return { invoice, lines };
}

export async function generateWeeklyStatement(input: {
  orgId: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const already = await db.select({ jobId: orgInvoiceLines.jobId }).from(orgInvoiceLines);
  const billed = new Set(already.map((r) => r.jobId));

  const candidates = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.orgId, input.orgId),
        eq(jobs.state, "DELIVERED"),
        eq(jobs.paymentStatus, "invoiced"),
      ),
    )
    .orderBy(jobs.createdAt);

  const eligible = candidates.filter((j) => !billed.has(j.id));
  if (eligible.length === 0) throw new Error("no_billable_jobs");

  const quotesById = new Map<string, number>();
  for (const j of eligible) {
    if (!j.activeQuoteId) continue;
    const q = await db.query.quotes.findFirst({ where: eq(quotes.id, j.activeQuoteId) });
    quotesById.set(j.id, q?.totalCents ?? 0);
  }

  const periodStart = eligible[0].createdAt;
  const periodEnd = eligible[eligible.length - 1].createdAt;
  let total = 0;
  const csvRows = ["public_code,pickup,dropoff,amount_cents,delivered_at"];
  for (const j of eligible) {
    const amount = quotesById.get(j.id) ?? 0;
    total += amount;
    csvRows.push(
      [
        j.publicCode,
        JSON.stringify(j.pickupAddress),
        JSON.stringify(j.dropoffAddress),
        String(amount),
        j.updatedAt.toISOString(),
      ].join(","),
    );
  }

  const [invoice] = await db
    .insert(orgInvoices)
    .values({
      orgId: input.orgId,
      periodStart,
      periodEnd,
      totalCents: total,
      currency: "ZAR",
      status: "issued",
      csvBody: csvRows.join("\n"),
    })
    .returning();

  for (const j of eligible) {
    await db.insert(orgInvoiceLines).values({
      invoiceId: invoice.id,
      jobId: j.id,
      publicCode: j.publicCode,
      description: `${j.pickupAddress} → ${j.dropoffAddress}`,
      amountCents: quotesById.get(j.id) ?? 0,
    });
  }

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "ORG_STATEMENT_GENERATED",
    subjectType: "organisation",
    subjectId: input.orgId,
    correlationId: input.correlationId,
    payload: { invoiceId: invoice.id, totalCents: total, lines: eligible.length },
  });

  return invoice;
}

export async function listOrgApiKeys(orgId: string) {
  return db
    .select({
      id: orgApiKeys.id,
      name: orgApiKeys.name,
      keyPrefix: orgApiKeys.keyPrefix,
      createdAt: orgApiKeys.createdAt,
      revokedAt: orgApiKeys.revokedAt,
    })
    .from(orgApiKeys)
    .where(eq(orgApiKeys.orgId, orgId))
    .orderBy(desc(orgApiKeys.createdAt));
}

export async function createOrgApiKey(input: {
  orgId: string;
  name: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const raw = `vuush_${randomBytes(24).toString("hex")}`;
  const keyPrefix = raw.slice(0, 12);
  const keyHash = createHash("sha256").update(raw).digest("hex");
  const [row] = await db
    .insert(orgApiKeys)
    .values({
      orgId: input.orgId,
      name: input.name.trim() || "default",
      keyPrefix,
      keyHash,
      createdByUserId: input.actorUserId,
    })
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "ORG_API_KEY_CREATED",
    subjectType: "organisation",
    subjectId: input.orgId,
    correlationId: input.correlationId,
    payload: { keyId: row.id, keyPrefix },
  });

  return { key: row, secret: raw };
}

export async function revokeOrgApiKey(input: {
  orgId: string;
  keyId: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const existing = await db.query.orgApiKeys.findFirst({
    where: and(eq(orgApiKeys.id, input.keyId), eq(orgApiKeys.orgId, input.orgId)),
  });
  if (!existing) throw new Error("api_key_not_found");
  const [row] = await db
    .update(orgApiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(orgApiKeys.id, input.keyId))
    .returning();
  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "ORG_API_KEY_REVOKED",
    subjectType: "organisation",
    subjectId: input.orgId,
    correlationId: input.correlationId,
    payload: { keyId: input.keyId },
  });
  return row;
}

export async function listJobStops(jobId: string) {
  const rows = await db
    .select()
    .from(jobStops)
    .where(eq(jobStops.jobId, jobId))
    .orderBy(jobStops.sequence);

  // Enrich missing coords from zone centroids (map view)
  return rows.map((row) => {
    if (row.lat != null && row.lng != null) return row;
    const coords = coordsForStop(row.zoneCode, row.sequence);
    return { ...row, lat: coords.lat, lng: coords.lng };
  });
}

/** Cape Town pilot zone centres — honest pins for map view (not geocoded addresses). */
const ZONE_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  "CPT-CBD": { lat: -33.9249, lng: 18.4241 },
  "CPT-ATL": { lat: -33.9125, lng: 18.3876 },
  "CPT-SOU": { lat: -33.9806, lng: 18.465 },
  "CPT-NOR": { lat: -33.855, lng: 18.64 },
};

/** Beachhead suburb ring — not a full route optimiser (M7b lite). */
const ZONE_RING = ["CPT-CBD", "CPT-ATL", "CPT-SOU", "CPT-NOR"] as const;

function zoneRingIndex(zoneCode: string | null | undefined) {
  const code = (zoneCode ?? "").trim().toUpperCase();
  const idx = ZONE_RING.indexOf(code as (typeof ZONE_RING)[number]);
  return idx === -1 ? ZONE_RING.length : idx;
}

function coordsForStop(zoneCode: string | null | undefined, sequence: number) {
  const base =
    ZONE_CENTROIDS[zoneCode?.trim() || ""] ?? ZONE_CENTROIDS["CPT-CBD"];
  // Fan out same-zone stops so markers stay readable
  const offset = (sequence - 1) * 0.0035;
  return {
    lat: base.lat + offset * 0.25,
    lng: base.lng + offset,
  };
}

export type StopInput = {
  label?: string;
  address: string;
  zoneCode?: string;
};

/**
 * Suburb sort: keep stop 1 fixed (warehouse/start), group the rest by zone ring,
 * preserve booker relative order inside each zone. Not a TSP / traffic optimiser.
 */
export function suburbSortStops(stops: StopInput[]): Array<
  StopInput & { bookerSequence: number }
> {
  if (stops.length < 2) {
    return stops.map((s, i) => ({ ...s, bookerSequence: i + 1 }));
  }
  const tagged = stops.map((s, i) => ({
    ...s,
    bookerSequence: i + 1,
  }));
  const [first, ...rest] = tagged;
  rest.sort((a, b) => {
    const za = zoneRingIndex(a.zoneCode);
    const zb = zoneRingIndex(b.zoneCode);
    if (za !== zb) return za - zb;
    return a.bookerSequence - b.bookerSequence;
  });
  return [first, ...rest];
}

export async function attachJobStops(input: {
  jobId: string;
  stops: StopInput[];
  /** booker = typed order · suburb = zone-ring sort (M7b lite) */
  orderingMode?: "booker" | "suburb";
}) {
  if (input.stops.length < 2) throw new Error("stops_min_two");
  const orderingMode = input.orderingMode ?? "suburb";
  const ordered =
    orderingMode === "suburb"
      ? suburbSortStops(input.stops)
      : input.stops.map((s, i) => ({ ...s, bookerSequence: i + 1 }));

  const rows = [];
  for (let i = 0; i < ordered.length; i++) {
    const s = ordered[i];
    const sequence = i + 1;
    const zoneCode = s.zoneCode?.trim() || null;
    const coords = coordsForStop(zoneCode, sequence);
    const [row] = await db
      .insert(jobStops)
      .values({
        jobId: input.jobId,
        sequence,
        bookerSequence: s.bookerSequence,
        orderingMode,
        label: s.label?.trim() || `Stop ${sequence}`,
        address: s.address.trim(),
        zoneCode,
        lat: coords.lat,
        lng: coords.lng,
      })
      .returning();
    rows.push(row);
  }
  return rows;
}
