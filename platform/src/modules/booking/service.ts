import { and, desc, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "../../db/client.js";
import { jobs, organisations, quotes, serviceTypes, zones } from "../../db/schema.js";
import { writeAuditEvent } from "../audit/service.js";
import { placeHold } from "../dispatch/service.js";
import {
  calculatePrice,
  haversineKm,
  zonePairDistanceKm,
} from "./pricing.js";
import { canTransition, type JobState } from "./states.js";

const QUOTE_TTL_MS = 15 * 60 * 1000;

function publicCode(): string {
  return `SW-${randomBytes(3).toString("hex").toUpperCase()}`;
}

async function requireZone(code: string) {
  const zone = await db.query.zones.findFirst({
    where: and(eq(zones.code, code), eq(zones.active, true)),
  });
  if (!zone) throw new Error("zone_unserviceable");
  return zone;
}

async function requireService(code: string) {
  const service = await db.query.serviceTypes.findFirst({
    where: and(eq(serviceTypes.code, code), eq(serviceTypes.active, true)),
  });
  if (!service) throw new Error("service_type_invalid");
  return service;
}

async function getOwnedJob(jobId: string, userId: string, isAdmin: boolean) {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) return null;
  if (!isAdmin && job.shipperUserId !== userId) return null;
  return job;
}

export async function listCatalog() {
  const [serviceRows, zoneRows] = await Promise.all([
    db.select().from(serviceTypes).where(eq(serviceTypes.active, true)),
    db.select().from(zones).where(eq(zones.active, true)),
  ]);
  return { serviceTypes: serviceRows, zones: zoneRows };
}

export async function createDraftJob(input: {
  shipperUserId: string;
  orgId?: string | null;
  serviceTypeCode: string;
  packageClass: string;
  pickupAddress: string;
  pickupZoneCode: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffAddress: string;
  dropoffZoneCode: string;
  dropoffLat?: number;
  dropoffLng?: number;
  pickupContactName?: string;
  pickupContactPhone?: string;
  recipientName?: string;
  recipientPhone?: string;
  notes?: string;
  prohibitedGoodsDeclared: boolean;
  containsProhibitedGoods: boolean;
  scheduledFor?: Date | null;
  correlationId?: string;
}) {
  if (!input.prohibitedGoodsDeclared) {
    throw new Error("prohibited_goods_declaration_required");
  }
  if (input.containsProhibitedGoods) {
    throw new Error("prohibited_goods_blocked");
  }

  await requireService(input.serviceTypeCode);
  await requireZone(input.pickupZoneCode);
  await requireZone(input.dropoffZoneCode);

  const [job] = await db
    .insert(jobs)
    .values({
      publicCode: publicCode(),
      shipperUserId: input.shipperUserId,
      orgId: input.orgId ?? null,
      state: "DRAFT",
      serviceTypeCode: input.serviceTypeCode,
      packageClass: input.packageClass,
      pickupAddress: input.pickupAddress,
      pickupZoneCode: input.pickupZoneCode,
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      dropoffAddress: input.dropoffAddress,
      dropoffZoneCode: input.dropoffZoneCode,
      dropoffLat: input.dropoffLat,
      dropoffLng: input.dropoffLng,
      pickupContactName: input.pickupContactName,
      pickupContactPhone: input.pickupContactPhone,
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
      notes: input.notes,
      prohibitedGoodsDeclared: true,
      containsProhibitedGoods: false,
      scheduledFor: input.scheduledFor ?? null,
      paymentStatus: "not_required",
    })
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.shipperUserId,
    action: "JOB_CREATED",
    subjectType: "job",
    subjectId: job.id,
    correlationId: input.correlationId,
    payload: {
      state: job.state,
      publicCode: job.publicCode,
      orgId: job.orgId,
    },
  });

  return job;
}

export async function quoteJob(input: {
  jobId: string;
  userId: string;
  isAdmin: boolean;
  correlationId?: string;
}) {
  const job = await getOwnedJob(input.jobId, input.userId, input.isAdmin);
  if (!job) throw new Error("job_not_found");
  if (!canTransition(job.state, "QUOTED") && job.state !== "QUOTED") {
    throw new Error("illegal_transition");
  }

  const service = await requireService(job.serviceTypeCode);

  let distanceKm: number;
  if (
    job.pickupLat != null &&
    job.pickupLng != null &&
    job.dropoffLat != null &&
    job.dropoffLng != null
  ) {
    distanceKm = haversineKm(
      job.pickupLat,
      job.pickupLng,
      job.dropoffLat,
      job.dropoffLng,
    );
  } else {
    distanceKm = zonePairDistanceKm(job.pickupZoneCode, job.dropoffZoneCode);
  }

  const priced = calculatePrice({
    baseFeeCents: service.baseFeeCents,
    perKmFeeCents: service.perKmFeeCents,
    priorityMultiplier: service.priorityMultiplier,
    packageClass: job.packageClass,
    distanceKm,
  });

  const [quote] = await db
    .insert(quotes)
    .values({
      jobId: job.id,
      currency: "ZAR",
      totalCents: priced.totalCents,
      components: priced.components,
      distanceKm: priced.distanceKm,
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS),
    })
    .returning();

  const nextState: JobState =
    job.scheduledFor != null ? "SCHEDULED" : "QUOTED";
  // Keep QUOTED until confirm; scheduledFor only affects confirm target.
  const stateAfterQuote: JobState = "QUOTED";

  const [updated] = await db
    .update(jobs)
    .set({
      state: stateAfterQuote,
      activeQuoteId: quote.id,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, job.id))
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.userId,
    action: "JOB_QUOTED",
    subjectType: "job",
    subjectId: job.id,
    correlationId: input.correlationId,
    payload: {
      quoteId: quote.id,
      totalCents: quote.totalCents,
      from: job.state,
      to: stateAfterQuote,
      nextStateHint: nextState,
    },
  });

  return { job: updated, quote };
}

export async function confirmJob(input: {
  jobId: string;
  userId: string;
  isAdmin: boolean;
  methodRef?: string;
  /** When true, finish a PENDING_APPROVAL job (approver path). */
  fromApproval?: boolean;
  correlationId?: string;
}) {
  const job = await getOwnedJob(input.jobId, input.userId, input.isAdmin);
  if (!job) throw new Error("job_not_found");

  const fromApproval = Boolean(input.fromApproval);
  if (fromApproval) {
    if (job.state !== "PENDING_APPROVAL") throw new Error("illegal_transition");
  } else if (job.state !== "QUOTED") {
    throw new Error("illegal_transition");
  }
  if (!job.activeQuoteId) throw new Error("quote_required");

  const { assertFlagEnabled } = await import("../admin/service.js");
  await assertFlagEnabled("booking_enabled", true, "booking_disabled");

  const quote = await db.query.quotes.findFirst({
    where: eq(quotes.id, job.activeQuoteId),
  });
  if (!quote || quote.expiresAt < new Date()) {
    throw new Error("quote_expired");
  }

  // E3: org threshold → hold for approver (unless this call is the approval)
  if (!fromApproval && job.orgId) {
    const org = await db.query.organisations.findFirst({
      where: eq(organisations.id, job.orgId),
    });
    if (
      org?.approvalThresholdCents != null &&
      quote.totalCents >= org.approvalThresholdCents
    ) {
      if (!canTransition(job.state, "PENDING_APPROVAL")) {
        throw new Error("illegal_transition");
      }
      const [held] = await db
        .update(jobs)
        .set({
          state: "PENDING_APPROVAL",
          paymentStatus: "awaiting_approval",
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, job.id))
        .returning();
      await writeAuditEvent({
        actorType: "user",
        actorId: input.userId,
        action: "JOB_PENDING_APPROVAL",
        subjectType: "job",
        subjectId: job.id,
        correlationId: input.correlationId,
        payload: {
          totalCents: quote.totalCents,
          thresholdCents: org.approvalThresholdCents,
          orgId: job.orgId,
        },
      });
      return { job: held, quote, payment: null, needsApproval: true as const };
    }
  }

  const target: JobState = job.scheduledFor ? "SCHEDULED" : "CONFIRMED";
  if (!canTransition(job.state, target) && !canTransition(job.state, "CONFIRMED")) {
    throw new Error("illegal_transition");
  }

  const { chargeForJobConfirm, createPendingEarningForJob } = await import(
    "../payments/service.js"
  );

  let payment: { id: string } | null = null;
  let paymentStatus = "captured";

  if (job.orgId) {
    const org = await db.query.organisations.findFirst({
      where: eq(organisations.id, job.orgId),
    });
    if (!org) throw new Error("org_not_found");
    if (org.payMode === "statement") {
      paymentStatus = "invoiced";
    } else {
      const charged = await chargeForJobConfirm({
        jobId: job.id,
        payerUserId: input.userId,
        methodRef: input.methodRef,
        correlationId: input.correlationId,
      });
      payment = charged.payment;
    }
  } else {
    const charged = await chargeForJobConfirm({
      jobId: job.id,
      payerUserId: input.userId,
      methodRef: input.methodRef,
      correlationId: input.correlationId,
    });
    payment = charged.payment;
  }

  const [updated] = await db
    .update(jobs)
    .set({
      state: target,
      paymentStatus,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, job.id))
    .returning();

  await createPendingEarningForJob({
    jobId: job.id,
    amountCents: quote.totalCents,
    currency: quote.currency,
    correlationId: input.correlationId,
  });

  await writeAuditEvent({
    actorType: "user",
    actorId: input.userId,
    action: "JOB_CONFIRMED",
    subjectType: "job",
    subjectId: job.id,
    correlationId: input.correlationId,
    payload: {
      from: job.state,
      to: target,
      quoteId: quote.id,
      totalCents: quote.totalCents,
      paymentId: payment?.id ?? null,
      paymentStatus,
      orgId: job.orgId,
      fromApproval,
    },
  });

  return { job: updated, quote, payment, needsApproval: false as const };
}

export async function cancelJob(input: {
  jobId: string;
  userId: string;
  isAdmin: boolean;
  correlationId?: string;
}) {
  const job = await getOwnedJob(input.jobId, input.userId, input.isAdmin);
  if (!job) throw new Error("job_not_found");
  if (!canTransition(job.state, "CANCELLED")) {
    throw new Error("illegal_transition");
  }

  const [updated] = await db
    .update(jobs)
    .set({ state: "CANCELLED", updatedAt: new Date() })
    .where(eq(jobs.id, job.id))
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.userId,
    action: "JOB_CANCELLED",
    subjectType: "job",
    subjectId: job.id,
    correlationId: input.correlationId,
    payload: { from: job.state, to: "CANCELLED" },
  });

  return updated;
}

export async function getJob(input: {
  jobId: string;
  userId: string;
  isAdmin: boolean;
}) {
  const job = await getOwnedJob(input.jobId, input.userId, input.isAdmin);
  if (!job) return null;
  let quote = null;
  if (job.activeQuoteId) {
    quote = await db.query.quotes.findFirst({
      where: eq(quotes.id, job.activeQuoteId),
    });
  }
  return { job, quote };
}

export async function listJobsForUser(userId: string, isAdmin: boolean) {
  if (isAdmin) {
    return db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(100);
  }
  return db
    .select()
    .from(jobs)
    .where(eq(jobs.shipperUserId, userId))
    .orderBy(desc(jobs.createdAt))
    .limit(100);
}

export async function listJobsForOrg(orgId: string) {
  return db
    .select()
    .from(jobs)
    .where(eq(jobs.orgId, orgId))
    .orderBy(desc(jobs.createdAt))
    .limit(100);
}

export async function getJobForOrg(input: {
  jobId: string;
  orgId: string;
}) {
  const job = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, input.jobId), eq(jobs.orgId, input.orgId)),
  });
  if (!job) return null;
  let quote = null;
  if (job.activeQuoteId) {
    quote = await db.query.quotes.findFirst({
      where: eq(quotes.id, job.activeQuoteId),
    });
  }
  return { job, quote };
}

/** Wave-1 customer mutation request — hold + audit; commercial delta later. */
export async function requestDestinationChange(input: {
  jobId: string;
  userId: string;
  isAdmin: boolean;
  dropoffAddress: string;
  dropoffZoneCode: string;
  note?: string;
  correlationId?: string;
}) {
  const job = await getOwnedJob(input.jobId, input.userId, input.isAdmin);
  if (!job) throw new Error("job_not_found");
  if (["DELIVERED", "CANCELLED", "FAILED_ATTEMPT"].includes(job.state)) {
    throw new Error("mutation_not_allowed");
  }
  await requireZone(input.dropoffZoneCode);

  const hold = await placeHold({
    jobId: job.id,
    holdType: "MUTATION_PENDING",
    reasonCode: "customer_destination_change",
    reasonNote: input.note,
    actorUserId: input.userId,
    correlationId: input.correlationId,
  });

  await writeAuditEvent({
    actorType: "user",
    actorId: input.userId,
    action: "JOB_MUTATION_REQUESTED",
    subjectType: "job",
    subjectId: job.id,
    reasonCode: "customer_destination_change",
    correlationId: input.correlationId,
    payload: {
      holdId: hold.id,
      fromAddress: job.dropoffAddress,
      fromZone: job.dropoffZoneCode,
      toAddress: input.dropoffAddress,
      toZone: input.dropoffZoneCode,
      note: input.note ?? null,
    },
  });

  return {
    status: "pending" as const,
    hold,
    proposed: {
      dropoffAddress: input.dropoffAddress,
      dropoffZoneCode: input.dropoffZoneCode,
    },
  };
}

export async function seedBookingCatalog() {
  const existing = await db.select().from(serviceTypes).limit(1);
  if (existing.length > 0) return { seeded: false };

  await db.insert(serviceTypes).values([
    {
      code: "standard",
      name: "VUUSH Standard",
      description: "Reliable local delivery",
      baseFeeCents: 4500,
      perKmFeeCents: 800,
      priorityMultiplier: 1,
    },
    {
      code: "priority",
      name: "VUUSH Priority",
      description: "Faster assignment and tighter windows",
      baseFeeCents: 6500,
      perKmFeeCents: 1000,
      priorityMultiplier: 1.35,
    },
  ]);

  await db.insert(zones).values([
    { code: "CPT-CBD", name: "City Bowl", city: "Cape Town" },
    { code: "CPT-ATL", name: "Atlantic Seaboard", city: "Cape Town" },
    { code: "CPT-SOU", name: "Southern Suburbs", city: "Cape Town" },
    { code: "CPT-NOR", name: "Northern Suburbs", city: "Cape Town" },
  ]);

  return { seeded: true };
}
