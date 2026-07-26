import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  auditEvents,
  breakGlassSessions,
  driverProfiles,
  featureFlags,
  pricingParams,
  prohibitedGoods,
  reasonCodes,
  roleBindings,
  serviceTypes,
  users,
  zones,
} from "../../db/schema.js";
import { writeAuditEvent } from "../audit/service.js";
import { assignRole } from "../identity/service.js";
import { isRole, type Role } from "../identity/roles.js";

const STAFF_ROLES = [
  "administrator",
  "dispatcher",
  "support_agent",
  "operations_manager",
] as const;

const DEFAULT_FLAGS: Array<{
  key: string;
  enabled: boolean;
  description: string;
}> = [
  { key: "cod_enabled", enabled: false, description: "Cash on delivery" },
  { key: "booking_enabled", enabled: true, description: "Allow new bookings" },
  {
    key: "dispatch_offers_enabled",
    enabled: true,
    description: "Allow dispatch offers / assigns",
  },
  {
    key: "support_refunds_enabled",
    enabled: true,
    description: "Allow Support refunds",
  },
  {
    key: "driver_emergency_enabled",
    enabled: true,
    description: "Driver emergency controls",
  },
  {
    key: "city_live",
    enabled: false,
    description: "Public live-city claim (RC gate)",
  },
  {
    key: "maps_experience_enabled",
    enabled: true,
    description: "In-app maps + driver auto-nav (M5b)",
  },
];

const DEFAULT_REASONS: Array<{
  code: string;
  domain: string;
  label: string;
  severity?: string;
}> = [
  { code: "ops_override", domain: "dispatch", label: "Ops override" },
  { code: "reassign_capacity", domain: "dispatch", label: "Capacity reassign" },
  { code: "backup_custody", domain: "dispatch", label: "Backup custody" },
  { code: "DISPATCH_HOLD", domain: "hold", label: "Dispatch hold" },
  { code: "INCIDENT_HOLD", domain: "hold", label: "Incident hold" },
  { code: "PAYMENT_HOLD", domain: "hold", label: "Payment hold" },
  { code: "customer_cancel", domain: "cancel", label: "Customer cancel" },
  { code: "undeliverable", domain: "cancel", label: "Undeliverable" },
  { code: "prohibited_goods", domain: "cancel", label: "Prohibited goods" },
  { code: "goodwill_credit", domain: "support", label: "Goodwill credit" },
  { code: "claim_opened", domain: "support", label: "Claim opened" },
  { code: "escalated_dispatch", domain: "support", label: "Escalated to dispatch" },
  {
    code: "emergency_medical",
    domain: "emergency",
    label: "Emergency medical",
    severity: "safety",
  },
  {
    code: "emergency_threat",
    domain: "emergency",
    label: "Emergency threat",
    severity: "safety",
  },
  {
    code: "emergency_accident",
    domain: "emergency",
    label: "Emergency accident",
    severity: "safety",
  },
  { code: "driver_declined", domain: "offer", label: "Driver declined" },
  { code: "offer_timeout", domain: "offer", label: "Offer timed out" },
];

export async function seedAdminDefaults() {
  for (const f of DEFAULT_FLAGS) {
    await db
      .insert(featureFlags)
      .values(f)
      .onConflictDoNothing({ target: featureFlags.key });
  }
  for (const r of DEFAULT_REASONS) {
    await db
      .insert(reasonCodes)
      .values({
        code: r.code,
        domain: r.domain,
        label: r.label,
        severity: r.severity ?? "ops",
      })
      .onConflictDoNothing({ target: reasonCodes.code });
  }
  await db
    .insert(pricingParams)
    .values({
      key: "currency_default",
      valueJson: { currency: "ZAR" },
      description: "Default quote currency",
    })
    .onConflictDoNothing({ target: pricingParams.key });
  await db
    .insert(pricingParams)
    .values({
      key: "floor_standard_cents",
      valueJson: { cents: 4500 },
      description: "Soft floor for standard jobs (cents)",
    })
    .onConflictDoNothing({ target: pricingParams.key });
  await db
    .insert(pricingParams)
    .values({
      key: "driver_share",
      valueJson: { share: 0.75 },
      description:
        "Driver share of quote total (0–1). Default 0.75 = 75%. Used when earnings are created.",
    })
    .onConflictDoNothing({ target: pricingParams.key });

  const goods = ["Weapons", "Illegal substances", "Hazardous chemicals", "Cash > policy limit"];
  const existing = await db.select().from(prohibitedGoods).limit(1);
  if (existing.length === 0) {
    for (let i = 0; i < goods.length; i++) {
      await db.insert(prohibitedGoods).values({
        label: goods[i],
        sortOrder: i,
      });
    }
  }
  return { ok: true };
}

/** Safe default when row missing. */
export async function isFlagEnabled(
  key: string,
  defaultEnabled: boolean,
): Promise<boolean> {
  const row = await db.query.featureFlags.findFirst({
    where: eq(featureFlags.key, key),
  });
  if (!row) return defaultEnabled;
  return row.enabled;
}

export async function assertFlagEnabled(
  key: string,
  defaultEnabled: boolean,
  errorCode: string,
) {
  const on = await isFlagEnabled(key, defaultEnabled);
  if (!on) throw new Error(errorCode);
}

export async function getAdminHome() {
  await seedAdminDefaults();
  const [zoneCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(zones)
    .where(eq(zones.active, true));
  const [flagCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(featureFlags);
  const [reasonCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reasonCodes)
    .where(eq(reasonCodes.active, true));
  const openGlass = await db.query.breakGlassSessions.findMany({
    where: and(
      isNull(breakGlassSessions.endedAt),
      sql`${breakGlassSessions.expiresAt} > now()`,
    ),
    limit: 5,
  });
  const recentAudit = await db
    .select()
    .from(auditEvents)
    .orderBy(desc(auditEvents.occurredAt))
    .limit(8);

  return {
    zonesActive: zoneCount?.n ?? 0,
    flags: flagCount?.n ?? 0,
    reasonCodesActive: reasonCount?.n ?? 0,
    openBreakGlass: openGlass.length,
    recentAudit,
  };
}

export async function listFlags() {
  await seedAdminDefaults();
  return db.select().from(featureFlags).orderBy(featureFlags.key);
}

export async function updateFlag(input: {
  key: string;
  enabled: boolean;
  value?: string | null;
  reasonCode: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const before = await db.query.featureFlags.findFirst({
    where: eq(featureFlags.key, input.key),
  });
  if (!before) throw new Error("flag_not_found");

  const [updated] = await db
    .update(featureFlags)
    .set({
      enabled: input.enabled,
      value: input.value === undefined ? before.value : input.value,
      updatedByUserId: input.actorUserId,
      updatedAt: new Date(),
    })
    .where(eq(featureFlags.key, input.key))
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "FLAG_UPDATED",
    subjectType: "feature_flag",
    subjectId: input.key,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    payload: { before, after: updated },
  });
  return updated;
}

export async function listZones() {
  return db.select().from(zones).orderBy(zones.code);
}

export async function upsertZone(input: {
  id?: string;
  code: string;
  name: string;
  city: string;
  active: boolean;
  reasonCode: string;
  actorUserId: string;
  correlationId?: string;
}) {
  let before = null as typeof zones.$inferSelect | null;
  let row: typeof zones.$inferSelect;

  if (input.id) {
    before =
      (await db.query.zones.findFirst({ where: eq(zones.id, input.id) })) ??
      null;
    if (!before) throw new Error("zone_not_found");
    const [updated] = await db
      .update(zones)
      .set({
        code: input.code,
        name: input.name,
        city: input.city,
        active: input.active,
      })
      .where(eq(zones.id, input.id))
      .returning();
    row = updated;
  } else {
    const [created] = await db
      .insert(zones)
      .values({
        code: input.code,
        name: input.name,
        city: input.city,
        active: input.active,
      })
      .returning();
    row = created;
  }

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "ZONE_UPSERTED",
    subjectType: "zone",
    subjectId: row.id,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    payload: { before, after: row },
  });
  return row;
}

export async function listServiceTypesAdmin() {
  return db.select().from(serviceTypes).orderBy(serviceTypes.code);
}

export async function upsertServiceType(input: {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  baseFeeCents: number;
  perKmFeeCents: number;
  priorityMultiplier: number;
  active: boolean;
  reasonCode: string;
  actorUserId: string;
  correlationId?: string;
}) {
  let before = null as typeof serviceTypes.$inferSelect | null;
  let row: typeof serviceTypes.$inferSelect;

  if (input.id) {
    before =
      (await db.query.serviceTypes.findFirst({
        where: eq(serviceTypes.id, input.id),
      })) ?? null;
    if (!before) throw new Error("service_type_not_found");
    const [updated] = await db
      .update(serviceTypes)
      .set({
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        baseFeeCents: input.baseFeeCents,
        perKmFeeCents: input.perKmFeeCents,
        priorityMultiplier: input.priorityMultiplier,
        active: input.active,
      })
      .where(eq(serviceTypes.id, input.id))
      .returning();
    row = updated;
  } else {
    const [created] = await db
      .insert(serviceTypes)
      .values({
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        baseFeeCents: input.baseFeeCents,
        perKmFeeCents: input.perKmFeeCents,
        priorityMultiplier: input.priorityMultiplier,
        active: input.active,
      })
      .returning();
    row = created;
  }

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "SERVICE_TYPE_UPSERTED",
    subjectType: "service_type",
    subjectId: row.id,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    payload: { before, after: row },
  });
  return row;
}

export async function listReasonCodes() {
  await seedAdminDefaults();
  return db.select().from(reasonCodes).orderBy(reasonCodes.domain, reasonCodes.code);
}

export async function upsertReasonCode(input: {
  id?: string;
  code: string;
  domain: string;
  label: string;
  active: boolean;
  severity: string;
  reasonCode: string;
  actorUserId: string;
  correlationId?: string;
}) {
  let before = null as typeof reasonCodes.$inferSelect | null;
  let row: typeof reasonCodes.$inferSelect;

  if (input.id) {
    before =
      (await db.query.reasonCodes.findFirst({
        where: eq(reasonCodes.id, input.id),
      })) ?? null;
    if (!before) throw new Error("reason_code_not_found");
    const [updated] = await db
      .update(reasonCodes)
      .set({
        code: input.code,
        domain: input.domain,
        label: input.label,
        active: input.active,
        severity: input.severity,
        updatedAt: new Date(),
      })
      .where(eq(reasonCodes.id, input.id))
      .returning();
    row = updated;
  } else {
    const [created] = await db
      .insert(reasonCodes)
      .values({
        code: input.code,
        domain: input.domain,
        label: input.label,
        active: input.active,
        severity: input.severity,
      })
      .returning();
    row = created;
  }

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "REASON_CODE_UPSERTED",
    subjectType: "reason_code",
    subjectId: row.id,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    payload: { before, after: row },
  });
  return row;
}

export async function listPricingParams() {
  await seedAdminDefaults();
  return db.select().from(pricingParams).orderBy(pricingParams.key);
}

export async function updatePricingParam(input: {
  key: string;
  valueJson: Record<string, unknown>;
  description?: string | null;
  reasonCode: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const before = await db.query.pricingParams.findFirst({
    where: eq(pricingParams.key, input.key),
  });
  if (!before) throw new Error("pricing_param_not_found");
  const [updated] = await db
    .update(pricingParams)
    .set({
      valueJson: input.valueJson,
      description:
        input.description === undefined ? before.description : input.description,
      updatedByUserId: input.actorUserId,
      updatedAt: new Date(),
    })
    .where(eq(pricingParams.key, input.key))
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "PRICING_PARAM_UPDATED",
    subjectType: "pricing_param",
    subjectId: input.key,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    payload: { before, after: updated },
  });
  return updated;
}

export async function listProhibitedGoods() {
  await seedAdminDefaults();
  return db
    .select()
    .from(prohibitedGoods)
    .orderBy(prohibitedGoods.sortOrder, prohibitedGoods.label);
}

export async function upsertProhibitedGood(input: {
  id?: string;
  label: string;
  active: boolean;
  sortOrder: number;
  reasonCode: string;
  actorUserId: string;
  correlationId?: string;
}) {
  let before = null as typeof prohibitedGoods.$inferSelect | null;
  let row: typeof prohibitedGoods.$inferSelect;
  if (input.id) {
    before =
      (await db.query.prohibitedGoods.findFirst({
        where: eq(prohibitedGoods.id, input.id),
      })) ?? null;
    if (!before) throw new Error("prohibited_good_not_found");
    const [updated] = await db
      .update(prohibitedGoods)
      .set({
        label: input.label,
        active: input.active,
        sortOrder: input.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(prohibitedGoods.id, input.id))
      .returning();
    row = updated;
  } else {
    const [created] = await db
      .insert(prohibitedGoods)
      .values({
        label: input.label,
        active: input.active,
        sortOrder: input.sortOrder,
      })
      .returning();
    row = created;
  }
  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "PROHIBITED_GOOD_UPSERTED",
    subjectType: "prohibited_good",
    subjectId: row.id,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    payload: { before, after: row },
  });
  return row;
}

export async function listDriverApplications(status?: string) {
  const base = db
    .select({
      userId: driverProfiles.userId,
      email: users.email,
      displayName: users.displayName,
      phone: users.phone,
      applicationStatus: driverProfiles.applicationStatus,
      eligibilityStatus: driverProfiles.eligibilityStatus,
      licenceRef: driverProfiles.licenceRef,
      insuranceRef: driverProfiles.insuranceRef,
      permitRef: driverProfiles.permitRef,
      licenceStatus: driverProfiles.licenceStatus,
      insuranceStatus: driverProfiles.insuranceStatus,
      vehiclePlate: driverProfiles.vehiclePlate,
      vehicleLabel: driverProfiles.vehicleLabel,
      vehicleClass: driverProfiles.vehicleClass,
      vehiclePhotoUrl: driverProfiles.vehiclePhotoUrl,
      idDocUrl: driverProfiles.idDocUrl,
      licenceDocUrl: driverProfiles.licenceDocUrl,
      selfiePhotoUrl: driverProfiles.selfiePhotoUrl,
      vehicleInsuranceDocUrl: driverProfiles.vehicleInsuranceDocUrl,
      goodsInsuranceDocUrl: driverProfiles.goodsInsuranceDocUrl,
      policeClearanceDocUrl: driverProfiles.policeClearanceDocUrl,
      applicationNote: driverProfiles.applicationNote,
      reviewReason: driverProfiles.reviewReason,
      reviewedAt: driverProfiles.reviewedAt,
      createdAt: driverProfiles.createdAt,
    })
    .from(driverProfiles)
    .innerJoin(users, eq(users.id, driverProfiles.userId));

  const rows = status
    ? await base
        .where(eq(driverProfiles.applicationStatus, status))
        .orderBy(desc(driverProfiles.createdAt))
    : await base.orderBy(desc(driverProfiles.createdAt));
  return rows;
}

export async function reviewDriverApplication(input: {
  userId: string;
  decision: "approve" | "reject" | "needs_more_info";
  reasonCode: string;
  reasonNote?: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const profile = await db.query.driverProfiles.findFirst({
    where: eq(driverProfiles.userId, input.userId),
  });
  if (!profile) throw new Error("driver_profile_missing");

  const applicationStatus =
    input.decision === "approve"
      ? "approved"
      : input.decision === "reject"
        ? "rejected"
        : "needs_more_info";
  const eligibilityStatus =
    input.decision === "approve" ? "eligible" : "pending";

  const [updated] = await db
    .update(driverProfiles)
    .set({
      applicationStatus,
      eligibilityStatus,
      onDuty: input.decision === "approve" ? profile.onDuty : false,
      licenceStatus:
        input.decision === "approve" ? "approved" : profile.licenceStatus,
      insuranceStatus:
        input.decision === "approve" ? "approved" : profile.insuranceStatus,
      reviewedAt: new Date(),
      reviewedByUserId: input.actorUserId,
      reviewReason: input.reasonNote?.trim() || input.reasonCode,
      updatedAt: new Date(),
    })
    .where(eq(driverProfiles.id, profile.id))
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "DRIVER_APPLICATION_REVIEWED",
    subjectType: "driver_profile",
    subjectId: profile.id,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    payload: {
      decision: input.decision,
      applicationStatus,
      userId: input.userId,
    },
  });

  return updated;
}

export async function listStaff() {
  const bindings = await db
    .select({
      userId: roleBindings.userId,
      role: roleBindings.role,
      email: users.email,
      displayName: users.displayName,
      totpEnabled: users.totpEnabled,
      status: users.status,
    })
    .from(roleBindings)
    .innerJoin(users, eq(users.id, roleBindings.userId))
    .where(
      or(...STAFF_ROLES.map((r) => eq(roleBindings.role, r))),
    );

  const byUser = new Map<
    string,
    {
      id: string;
      email: string | null;
      displayName: string | null;
      totpEnabled: boolean;
      status: string;
      roles: string[];
    }
  >();

  for (const b of bindings) {
    const cur = byUser.get(b.userId) ?? {
      id: b.userId,
      email: b.email,
      displayName: b.displayName,
      totpEnabled: b.totpEnabled,
      status: b.status,
      roles: [],
    };
    if (!cur.roles.includes(b.role)) cur.roles.push(b.role);
    byUser.set(b.userId, cur);
  }
  return [...byUser.values()].sort((a, b) =>
    (a.email ?? a.id).localeCompare(b.email ?? b.id),
  );
}

export async function grantStaffRole(input: {
  userId: string;
  role: string;
  reasonCode: string;
  actorUserId: string;
  correlationId?: string;
}) {
  if (!isRole(input.role) || !STAFF_ROLES.includes(input.role as (typeof STAFF_ROLES)[number])) {
    throw new Error("invalid_staff_role");
  }
  const user = await db.query.users.findFirst({ where: eq(users.id, input.userId) });
  if (!user) throw new Error("user_not_found");

  await assignRole({
    userId: input.userId,
    role: input.role as Role,
    actorId: input.actorUserId,
    correlationId: input.correlationId,
  });

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "ROLE_GRANTED",
    subjectType: "user",
    subjectId: input.userId,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    payload: { role: input.role },
  });
  return { ok: true };
}

export async function revokeStaffRole(input: {
  userId: string;
  role: string;
  reasonCode: string;
  actorUserId: string;
  correlationId?: string;
}) {
  if (!isRole(input.role) || !STAFF_ROLES.includes(input.role as (typeof STAFF_ROLES)[number])) {
    throw new Error("invalid_staff_role");
  }

  if (input.role === "administrator") {
    const admins = await db
      .select()
      .from(roleBindings)
      .where(eq(roleBindings.role, "administrator"));
    if (admins.length <= 1 && admins[0]?.userId === input.userId) {
      throw new Error("last_administrator");
    }
  }

  await db
    .delete(roleBindings)
    .where(
      and(
        eq(roleBindings.userId, input.userId),
        eq(roleBindings.role, input.role),
      ),
    );

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "ROLE_REVOKED",
    subjectType: "user",
    subjectId: input.userId,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    payload: { role: input.role },
  });
  return { ok: true };
}

export async function searchAudit(input: {
  q?: string;
  action?: string;
  limit?: number;
}) {
  const limit = Math.min(input.limit ?? 50, 200);
  const rows = await db
    .select()
    .from(auditEvents)
    .where(
      and(
        input.action ? eq(auditEvents.action, input.action) : undefined,
        input.q
          ? or(
              ilike(auditEvents.action, `%${input.q}%`),
              ilike(auditEvents.subjectType, `%${input.q}%`),
              ilike(auditEvents.subjectId, `%${input.q}%`),
              ilike(auditEvents.actorId, `%${input.q}%`),
            )
          : undefined,
      ),
    )
    .orderBy(desc(auditEvents.occurredAt))
    .limit(limit);
  return rows;
}

export async function openBreakGlass(input: {
  userId: string;
  reason: string;
  minutes?: number;
  correlationId?: string;
}) {
  const minutes = Math.min(Math.max(input.minutes ?? 30, 5), 30);
  const expiresAt = new Date(Date.now() + minutes * 60_000);
  const [row] = await db
    .insert(breakGlassSessions)
    .values({
      userId: input.userId,
      reason: input.reason,
      expiresAt,
    })
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.userId,
    action: "BREAK_GLASS_OPENED",
    subjectType: "break_glass",
    subjectId: row.id,
    reasonCode: "break_glass",
    correlationId: input.correlationId,
    payload: { minutes, expiresAt: expiresAt.toISOString() },
  });
  return row;
}

export async function closeBreakGlass(input: {
  id: string;
  userId: string;
  correlationId?: string;
}) {
  const row = await db.query.breakGlassSessions.findFirst({
    where: eq(breakGlassSessions.id, input.id),
  });
  if (!row) throw new Error("break_glass_not_found");
  if (row.userId !== input.userId) throw new Error("break_glass_not_yours");
  const [updated] = await db
    .update(breakGlassSessions)
    .set({ endedAt: new Date() })
    .where(eq(breakGlassSessions.id, input.id))
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.userId,
    action: "BREAK_GLASS_CLOSED",
    subjectType: "break_glass",
    subjectId: input.id,
    correlationId: input.correlationId,
  });
  return updated;
}

export async function listOpenBreakGlass() {
  return db
    .select()
    .from(breakGlassSessions)
    .where(
      and(
        isNull(breakGlassSessions.endedAt),
        sql`${breakGlassSessions.expiresAt} > now()`,
      ),
    )
    .orderBy(desc(breakGlassSessions.createdAt));
}
