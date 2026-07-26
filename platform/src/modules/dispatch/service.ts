import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  assignments,
  driverProfiles,
  earningLines,
  jobHolds,
  jobs,
  users,
} from "../../db/schema.js";
import { writeAuditEvent } from "../audit/service.js";
import {
  canTransition,
  vehicleEligibleForPackage,
} from "../booking/states.js";
import { assignRole } from "../identity/service.js";
import { assignDriverToEarning } from "../payments/service.js";

/** Human label for dispatch desks (dogfood-friendly). */
export function driverCallsign(
  email: string | null | undefined,
  displayName: string | null | undefined,
): string {
  const e = (email ?? "").toLowerCase();
  // Exact beachhead accounts only — don’t rename smoke-script clones
  if (e === "driver1-m4@swift.local" || e === "driver1-m4@vuush.local") return "Dave";
  if (e === "driver2-m4@swift.local" || e === "driver2-m4@vuush.local") return "Tom";
  if (e === "driver@swift.local" || e === "driver@vuush.local") return "Driver";
  if (displayName && !displayName.includes("@")) return displayName;
  const local = e.split("@")[0] ?? "";
  if (!local) return "Driver";
  // Keep smoke emails readable but unique
  if (local.includes("driver1")) return "Dave (test)";
  if (local.includes("driver2")) return "Tom (test)";
  const token = local.split(/[-_.\d]+/)[0] || local;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

async function assertNoActiveHold(jobId: string) {
  const hold = await db.query.jobHolds.findFirst({
    where: and(eq(jobHolds.jobId, jobId), eq(jobHolds.active, true)),
  });
  if (hold) throw new Error("job_on_hold");
  return hold;
}

async function requireDriverProfile(userId: string) {
  const profile = await db.query.driverProfiles.findFirst({
    where: eq(driverProfiles.userId, userId),
  });
  if (!profile || !profile.active) throw new Error("driver_profile_missing");
  return profile;
}

function assertEligible(profile: typeof driverProfiles.$inferSelect, packageClass: string) {
  if (
    profile.eligibilityStatus !== "eligible" ||
    profile.applicationStatus !== "approved"
  ) {
    throw new Error("driver_not_eligible");
  }
  if (!profile.onDuty) throw new Error("driver_off_duty");
  if (!vehicleEligibleForPackage(profile.vehicleClass, packageClass)) {
    throw new Error("vehicle_class_blocked");
  }
}

export async function upsertDriverProfile(input: {
  userId: string;
  vehicleClass?: string;
  homeZoneCode?: string;
  eligibilityStatus?: string;
  applicationStatus?: string;
  licenceRef?: string | null;
  insuranceRef?: string | null;
  permitRef?: string | null;
  applicationNote?: string | null;
  vehiclePlate?: string | null;
  vehicleLabel?: string | null;
  publicName?: string | null;
  actorUserId?: string;
  correlationId?: string;
}) {
  const existing = await db.query.driverProfiles.findFirst({
    where: eq(driverProfiles.userId, input.userId),
  });

  let profile;
  if (existing) {
    [profile] = await db
      .update(driverProfiles)
      .set({
        vehicleClass: input.vehicleClass ?? existing.vehicleClass,
        homeZoneCode: input.homeZoneCode ?? existing.homeZoneCode,
        eligibilityStatus:
          input.eligibilityStatus ?? existing.eligibilityStatus,
        applicationStatus:
          input.applicationStatus ?? existing.applicationStatus,
        licenceRef: input.licenceRef ?? existing.licenceRef,
        insuranceRef: input.insuranceRef ?? existing.insuranceRef,
        permitRef: input.permitRef ?? existing.permitRef,
        applicationNote: input.applicationNote ?? existing.applicationNote,
        vehiclePlate: input.vehiclePlate ?? existing.vehiclePlate,
        vehicleLabel: input.vehicleLabel ?? existing.vehicleLabel,
        publicName: input.publicName ?? existing.publicName,
        active: true,
        updatedAt: new Date(),
      })
      .where(eq(driverProfiles.id, existing.id))
      .returning();
  } else {
    [profile] = await db
      .insert(driverProfiles)
      .values({
        userId: input.userId,
        vehicleClass: input.vehicleClass ?? "car",
        homeZoneCode: input.homeZoneCode,
        eligibilityStatus: input.eligibilityStatus ?? "pending",
        applicationStatus: input.applicationStatus ?? "pending_review",
        licenceRef: input.licenceRef,
        insuranceRef: input.insuranceRef,
        permitRef: input.permitRef,
        applicationNote: input.applicationNote,
        vehiclePlate: input.vehiclePlate,
        vehicleLabel: input.vehicleLabel,
        publicName: input.publicName,
      })
      .returning();
  }

  await assignRole({
    userId: input.userId,
    role: "driver",
    correlationId: input.correlationId,
  });

  // Friendly desk names for common dogfood accounts
  const user = await db.query.users.findFirst({ where: eq(users.id, input.userId) });
  if (user?.email) {
    const callsign = driverCallsign(user.email, user.displayName);
    if (callsign === "Dave" || callsign === "Tom" || !user.displayName || user.displayName.includes("@")) {
      await db
        .update(users)
        .set({ displayName: callsign, updatedAt: new Date() })
        .where(eq(users.id, input.userId));
    }
  }

  await writeAuditEvent({
    actorType: input.actorUserId ? "user" : "system",
    actorId: input.actorUserId,
    action: "DRIVER_PROFILE_UPSERTED",
    subjectType: "driver_profile",
    subjectId: profile.id,
    correlationId: input.correlationId,
    payload: {
      userId: input.userId,
      vehicleClass: profile.vehicleClass,
      eligibilityStatus: profile.eligibilityStatus,
    },
  });

  return profile;
}

export async function setDutyStatus(input: {
  userId: string;
  onDuty: boolean;
  correlationId?: string;
}) {
  const profile = await requireDriverProfile(input.userId);
  if (
    input.onDuty &&
    (profile.eligibilityStatus !== "eligible" ||
      profile.applicationStatus !== "approved")
  ) {
    throw new Error("driver_not_eligible");
  }

  const [updated] = await db
    .update(driverProfiles)
    .set({
      onDuty: input.onDuty,
      onDutyAt: input.onDuty ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(driverProfiles.id, profile.id))
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.userId,
    action: input.onDuty ? "DRIVER_ON_DUTY" : "DRIVER_OFF_DUTY",
    subjectType: "driver_profile",
    subjectId: profile.id,
    correlationId: input.correlationId,
  });

  return updated;
}

export async function listDispatchQueue() {
  const rows = await db
    .select()
    .from(jobs)
    .where(inArray(jobs.state, ["CONFIRMED", "SCHEDULED"]))
    .orderBy(desc(jobs.createdAt));

  const withHolds = await Promise.all(
    rows.map(async (job) => {
      const holds = await db
        .select()
        .from(jobHolds)
        .where(and(eq(jobHolds.jobId, job.id), eq(jobHolds.active, true)));
      return { job, holds, onHold: holds.length > 0 };
    }),
  );

  return withHolds;
}

export async function listEligibleDrivers(jobId: string) {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) throw new Error("job_not_found");

  const rows = await db
    .select({
      profile: driverProfiles,
      email: users.email,
      displayName: users.displayName,
    })
    .from(driverProfiles)
    .innerJoin(users, eq(users.id, driverProfiles.userId))
    .where(
      and(
        eq(driverProfiles.active, true),
        eq(driverProfiles.onDuty, true),
        eq(driverProfiles.eligibilityStatus, "eligible"),
      ),
    );

  return rows
    .filter(({ profile: p }) =>
      vehicleEligibleForPackage(p.vehicleClass, job.packageClass),
    )
    .map(({ profile: p, email, displayName }) => ({
      ...p,
      email,
      displayName,
      callsign: driverCallsign(email, displayName),
      zoneMatch:
        !p.homeZoneCode ||
        p.homeZoneCode === job.pickupZoneCode ||
        p.homeZoneCode === job.dropoffZoneCode,
    }))
    .sort((a, b) => Number(b.zoneMatch) - Number(a.zoneMatch));
}

export async function placeHold(input: {
  jobId: string;
  holdType: string;
  reasonCode: string;
  reasonNote?: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, input.jobId) });
  if (!job) throw new Error("job_not_found");

  const [hold] = await db
    .insert(jobHolds)
    .values({
      jobId: input.jobId,
      holdType: input.holdType,
      reasonCode: input.reasonCode,
      reasonNote: input.reasonNote,
      createdByUserId: input.actorUserId,
      active: true,
    })
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "JOB_HOLD_PLACED",
    subjectType: "job",
    subjectId: input.jobId,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    payload: { holdId: hold.id, holdType: input.holdType },
  });

  // Harden H4: INCIDENT_HOLD freezes payout until release (medical = non-punitive).
  if (input.holdType === "INCIDENT_HOLD") {
    const { freezeEarningsForIncidentHold } = await import(
      "../payments/service.js"
    );
    await freezeEarningsForIncidentHold({
      jobId: input.jobId,
      reasonCode: input.reasonCode,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
    });
  }

  return hold;
}

export async function releaseHold(input: {
  holdId: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const hold = await db.query.jobHolds.findFirst({
    where: eq(jobHolds.id, input.holdId),
  });
  if (!hold) throw new Error("hold_not_found");
  if (!hold.active) return hold;

  const [updated] = await db
    .update(jobHolds)
    .set({
      active: false,
      releasedAt: new Date(),
      releasedByUserId: input.actorUserId,
    })
    .where(eq(jobHolds.id, hold.id))
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "JOB_HOLD_RELEASED",
    subjectType: "job",
    subjectId: hold.jobId,
    correlationId: input.correlationId,
    payload: { holdId: hold.id },
  });

  if (hold.holdType === "INCIDENT_HOLD") {
    const otherActive = await db.query.jobHolds.findFirst({
      where: and(
        eq(jobHolds.jobId, hold.jobId),
        eq(jobHolds.holdType, "INCIDENT_HOLD"),
        eq(jobHolds.active, true),
      ),
    });
    if (!otherActive) {
      const { unfreezeAutoIncidentEarningsForJob } = await import(
        "../payments/service.js"
      );
      await unfreezeAutoIncidentEarningsForJob({
        jobId: hold.jobId,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
      });
    }
  }

  return updated;
}

async function activateAssignment(input: {
  assignment: typeof assignments.$inferSelect;
  jobId: string;
  correlationId?: string;
}) {
  const now = new Date();
  const [active] = await db
    .update(assignments)
    .set({
      status: "active",
      acceptedAt: now,
      updatedAt: now,
    })
    .where(eq(assignments.id, input.assignment.id))
    .returning();

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, input.jobId) });
  if (!job) throw new Error("job_not_found");

  if (job.state !== "ASSIGNED" && !canTransition(job.state, "ASSIGNED")) {
    throw new Error("illegal_transition");
  }

  await db
    .update(jobs)
    .set({
      state: "ASSIGNED",
      activeAssignmentId: active.id,
      updatedAt: now,
    })
    .where(eq(jobs.id, input.jobId));

  try {
    await assignDriverToEarning({
      jobId: input.jobId,
      driverUserId: active.driverUserId,
    });
  } catch {
    // earnings line may not exist yet for unpaid paths; ignore
  }

  await writeAuditEvent({
    actorType: "system",
    action: "ASSIGNMENT_ACTIVATED",
    subjectType: "assignment",
    subjectId: active.id,
    correlationId: input.correlationId,
    payload: { jobId: input.jobId, driverUserId: active.driverUserId },
  });

  return active;
}

export async function assignJob(input: {
  jobId: string;
  driverUserId: string;
  actorUserId: string;
  requireAccept?: boolean;
  reasonCode?: string;
  correlationId?: string;
  idempotencyKey?: string;
}) {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, input.jobId) });
  if (!job) throw new Error("job_not_found");
  if (job.state !== "CONFIRMED" && job.state !== "SCHEDULED") {
    throw new Error("illegal_transition");
  }
  if (
    job.paymentStatus !== "captured" &&
    job.paymentStatus !== "not_required"
  ) {
    throw new Error("payment_not_ready");
  }

  await assertNoActiveHold(job.id);
  const { assertFlagEnabled } = await import("../admin/service.js");
  await assertFlagEnabled(
    "dispatch_offers_enabled",
    true,
    "dispatch_offers_disabled",
  );
  const profile = await requireDriverProfile(input.driverUserId);
  assertEligible(profile, job.packageClass);

  const open = await db.query.assignments.findFirst({
    where: and(
      eq(assignments.jobId, job.id),
      inArray(assignments.status, ["offered", "active"]),
    ),
  });
  if (open) throw new Error("assignment_already_open");

  const idempotencyKey =
    input.idempotencyKey ??
    `assign:${job.id}:${input.driverUserId}:${input.requireAccept ? "offer" : "direct"}`;

  const existing = await db.query.assignments.findFirst({
    where: eq(assignments.idempotencyKey, idempotencyKey),
  });
  // Only reuse a live offer/active row. Rejected/superseded/expired keys must mint a new offer.
  if (
    existing &&
    (existing.status === "offered" || existing.status === "active")
  ) {
    return { assignment: existing, reused: true };
  }

  const requireAccept = Boolean(input.requireAccept);
  // If a dead row still owns the static key, mint a unique key so insert can proceed.
  const writeKey =
    existing &&
    existing.status !== "offered" &&
    existing.status !== "active"
      ? `${idempotencyKey}:${Date.now()}`
      : idempotencyKey;

  const [created] = await db
    .insert(assignments)
    .values({
      jobId: job.id,
      driverUserId: input.driverUserId,
      status: requireAccept ? "offered" : "active",
      mode: requireAccept ? "offer" : "manual",
      reasonCode: input.reasonCode,
      offeredAt: new Date(),
      acceptedAt: requireAccept ? null : new Date(),
      createdByUserId: input.actorUserId,
      idempotencyKey: writeKey,
    })
    .onConflictDoNothing()
    .returning();

  const assignment =
    created ??
    (await db.query.assignments.findFirst({
      where: eq(assignments.idempotencyKey, writeKey),
    }));
  if (!assignment) throw new Error("assignment_create_failed");

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: requireAccept ? "ASSIGNMENT_OFFERED" : "ASSIGNMENT_DIRECT",
    subjectType: "assignment",
    subjectId: assignment.id,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    payload: {
      jobId: job.id,
      driverUserId: input.driverUserId,
      mode: assignment.mode,
    },
  });

  if (!requireAccept) {
    const active = await activateAssignment({
      assignment,
      jobId: job.id,
      correlationId: input.correlationId,
    });
    return { assignment: active, reused: false };
  }

  return { assignment, reused: false };
}

export async function acceptAssignment(input: {
  assignmentId: string;
  driverUserId: string;
  correlationId?: string;
}) {
  const assignment = await db.query.assignments.findFirst({
    where: eq(assignments.id, input.assignmentId),
  });
  if (!assignment) throw new Error("assignment_not_found");
  if (assignment.driverUserId !== input.driverUserId) {
    throw new Error("assignment_not_yours");
  }
  if (assignment.status !== "offered") throw new Error("assignment_not_offered");

  await assertNoActiveHold(assignment.jobId);
  const profile = await requireDriverProfile(input.driverUserId);
  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, assignment.jobId),
  });
  if (!job) throw new Error("job_not_found");
  assertEligible(profile, job.packageClass);

  const active = await activateAssignment({
    assignment,
    jobId: assignment.jobId,
    correlationId: input.correlationId,
  });

  await writeAuditEvent({
    actorType: "user",
    actorId: input.driverUserId,
    action: "ASSIGNMENT_ACCEPTED",
    subjectType: "assignment",
    subjectId: active.id,
    correlationId: input.correlationId,
  });

  return active;
}

export async function rejectAssignment(input: {
  assignmentId: string;
  driverUserId: string;
  reasonCode?: string;
  correlationId?: string;
}) {
  const assignment = await db.query.assignments.findFirst({
    where: eq(assignments.id, input.assignmentId),
  });
  if (!assignment) throw new Error("assignment_not_found");
  if (assignment.driverUserId !== input.driverUserId) {
    throw new Error("assignment_not_yours");
  }
  if (assignment.status !== "offered") throw new Error("assignment_not_offered");

  const [updated] = await db
    .update(assignments)
    .set({
      status: "rejected",
      reasonCode: input.reasonCode ?? assignment.reasonCode,
      endedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(assignments.id, assignment.id))
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.driverUserId,
    action: "ASSIGNMENT_REJECTED",
    subjectType: "assignment",
    subjectId: updated.id,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
  });

  return updated;
}

export async function reassignJob(input: {
  jobId: string;
  driverUserId: string;
  actorUserId: string;
  reasonCode: string;
  requireAccept?: boolean;
  correlationId?: string;
}) {
  if (!input.reasonCode || input.reasonCode.length < 2) {
    throw new Error("reason_code_required");
  }

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, input.jobId) });
  if (!job) throw new Error("job_not_found");
  if (job.state !== "ASSIGNED" && job.state !== "CONFIRMED" && job.state !== "SCHEDULED") {
    throw new Error("illegal_transition");
  }

  await assertNoActiveHold(job.id);
  const profile = await requireDriverProfile(input.driverUserId);
  assertEligible(profile, job.packageClass);

  const previous = await db.query.assignments.findFirst({
    where: and(
      eq(assignments.jobId, job.id),
      inArray(assignments.status, ["offered", "active"]),
    ),
  });

  if (previous) {
    await db
      .update(assignments)
      .set({
        status: "superseded",
        endedAt: new Date(),
        updatedAt: new Date(),
        reasonCode: input.reasonCode,
      })
      .where(eq(assignments.id, previous.id));
  }

  const requireAccept = Boolean(input.requireAccept);
  const idempotencyKey = `reassign:${job.id}:${input.driverUserId}:${Date.now()}`;
  const [created] = await db
    .insert(assignments)
    .values({
      jobId: job.id,
      driverUserId: input.driverUserId,
      status: requireAccept ? "offered" : "active",
      mode: "reassign",
      reasonCode: input.reasonCode,
      previousAssignmentId: previous?.id,
      offeredAt: new Date(),
      acceptedAt: requireAccept ? null : new Date(),
      createdByUserId: input.actorUserId,
      idempotencyKey,
    })
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "ASSIGNMENT_REASSIGNED",
    subjectType: "assignment",
    subjectId: created.id,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    payload: {
      jobId: job.id,
      previousAssignmentId: previous?.id,
      driverUserId: input.driverUserId,
    },
  });

  if (!requireAccept) {
    const active = await activateAssignment({
      assignment: created,
      jobId: job.id,
      correlationId: input.correlationId,
    });
    return { assignment: active, previous };
  }

  await db
    .update(jobs)
    .set({ activeAssignmentId: null, updatedAt: new Date() })
    .where(eq(jobs.id, job.id));

  return { assignment: created, previous };
}

export async function backupAssign(input: {
  jobId: string;
  driverUserId: string;
  actorUserId: string;
  reasonCode: string;
  custodyHandoffRequired?: boolean;
  correlationId?: string;
}) {
  if (!input.reasonCode || input.reasonCode.length < 2) {
    throw new Error("reason_code_required");
  }

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, input.jobId) });
  if (!job) throw new Error("job_not_found");
  await assertNoActiveHold(job.id);

  const profile = await requireDriverProfile(input.driverUserId);
  assertEligible(profile, job.packageClass);

  const previous = await db.query.assignments.findFirst({
    where: and(
      eq(assignments.jobId, job.id),
      inArray(assignments.status, ["offered", "active"]),
    ),
  });

  if (previous) {
    await db
      .update(assignments)
      .set({
        status: "superseded",
        endedAt: new Date(),
        updatedAt: new Date(),
        reasonCode: input.reasonCode,
      })
      .where(eq(assignments.id, previous.id));
  }

  const [created] = await db
    .insert(assignments)
    .values({
      jobId: job.id,
      driverUserId: input.driverUserId,
      status: "active",
      mode: "backup",
      reasonCode: input.reasonCode,
      previousAssignmentId: previous?.id,
      custodyHandoffRequired: Boolean(input.custodyHandoffRequired),
      offeredAt: new Date(),
      acceptedAt: new Date(),
      createdByUserId: input.actorUserId,
      idempotencyKey: `backup:${job.id}:${input.driverUserId}:${Date.now()}`,
    })
    .returning();

  const active = await activateAssignment({
    assignment: created,
    jobId: job.id,
    correlationId: input.correlationId,
  });

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "BACKUP_ASSIGNMENT",
    subjectType: "assignment",
    subjectId: active.id,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    payload: {
      jobId: job.id,
      previousAssignmentId: previous?.id,
      custodyHandoffRequired: Boolean(input.custodyHandoffRequired),
    },
  });

  return { assignment: active, previous };
}

export async function listDriverProfiles() {
  const rows = await db
    .select({
      profile: driverProfiles,
      email: users.email,
      displayName: users.displayName,
    })
    .from(driverProfiles)
    .innerJoin(users, eq(users.id, driverProfiles.userId))
    .where(eq(driverProfiles.active, true))
    .orderBy(desc(driverProfiles.onDuty), desc(driverProfiles.updatedAt));

  return rows.map(({ profile, email, displayName }) => ({
    ...profile,
    email,
    displayName,
    callsign: driverCallsign(email, displayName),
  }));
}

export async function getDriverHome(userId: string) {
  const profile = await db.query.driverProfiles.findFirst({
    where: eq(driverProfiles.userId, userId),
  });

  // Prefer a live offer over older active jobs (dogfood can leave multiple actives).
  const offered = await db.query.assignments.findFirst({
    where: and(
      eq(assignments.driverUserId, userId),
      eq(assignments.status, "offered"),
    ),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  const assignment =
    offered ??
    (await db.query.assignments.findFirst({
      where: and(
        eq(assignments.driverUserId, userId),
        eq(assignments.status, "active"),
      ),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    }));

  let job = null;
  if (assignment) {
    job = await db.query.jobs.findFirst({ where: eq(jobs.id, assignment.jobId) });
  }

  let navTarget: {
    lat: number | null;
    lng: number | null;
    address: string;
    leg: "pickup" | "dropoff";
  } | null = null;

  if (job && assignment?.status === "active") {
    const toDropoff = ["PICKED_UP", "IN_TRANSIT", "ARRIVED_DROPOFF"].includes(
      job.state,
    );
    navTarget = toDropoff
      ? {
          lat: job.dropoffLat,
          lng: job.dropoffLng,
          address: job.dropoffAddress,
          leg: "dropoff",
        }
      : {
          lat: job.pickupLat,
          lng: job.pickupLng,
          address: job.pickupAddress,
          leg: "pickup",
        };
  }

  return {
    profile: profile ?? null,
    assignment: assignment ?? null,
    job,
    navTarget,
  };
}

const DOC_STATUSES = ["pending", "verified", "missing", "expired"] as const;

function docsVerified(p: typeof driverProfiles.$inferSelect) {
  return (
    p.licenceStatus === "verified" &&
    p.vehicleDocStatus === "verified" &&
    p.insuranceStatus === "verified"
  );
}

export function toDriverProfessionalView(
  profile: typeof driverProfiles.$inferSelect,
  user: { email: string | null; phone: string | null; displayName: string | null },
  opts?: { includePrivateContact?: boolean },
) {
  const includePrivate = opts?.includePrivateContact !== false;
  return {
    publicName:
      profile.publicName ||
      driverCallsign(user.email, user.displayName),
    photoUrl: profile.photoUrl,
    phone: profile.phonePublic || user.phone,
    email: includePrivate ? user.email : null,
    vehicleClass: profile.vehicleClass,
    vehicleLabel: profile.vehicleLabel,
    vehiclePlate: profile.vehiclePlate,
    bio: profile.bio,
    homeZoneCode: profile.homeZoneCode,
    eligibilityStatus: profile.eligibilityStatus,
    licenceStatus: profile.licenceStatus,
    vehicleDocStatus: profile.vehicleDocStatus,
    insuranceStatus: profile.insuranceStatus,
    docsVerified: docsVerified(profile),
  };
}

export async function getDriverProfileBundle(userId: string) {
  const profile = await db.query.driverProfiles.findFirst({
    where: eq(driverProfiles.userId, userId),
  });
  if (!profile) throw new Error("driver_profile_missing");
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new Error("user_not_found");
  return {
    profile,
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      displayName: user.displayName,
    },
    professional: toDriverProfessionalView(profile, user, {
      includePrivateContact: true,
    }),
  };
}

export async function updateDriverProfileBundle(
  userId: string,
  patch: {
    publicName?: string | null;
    photoUrl?: string | null;
    phonePublic?: string | null;
    vehiclePlate?: string | null;
    vehicleLabel?: string | null;
    bio?: string | null;
    vehicleClass?: string;
    homeZoneCode?: string | null;
    licenceStatus?: string;
    vehicleDocStatus?: string;
    insuranceStatus?: string;
    displayName?: string | null;
    phone?: string | null;
  },
) {
  const existing = await db.query.driverProfiles.findFirst({
    where: eq(driverProfiles.userId, userId),
  });
  if (!existing) throw new Error("driver_profile_missing");

  for (const key of ["licenceStatus", "vehicleDocStatus", "insuranceStatus"] as const) {
    const v = patch[key];
    if (v != null && !DOC_STATUSES.includes(v as (typeof DOC_STATUSES)[number])) {
      throw new Error("invalid_doc_status");
    }
  }

  const [profile] = await db
    .update(driverProfiles)
    .set({
      publicName: patch.publicName !== undefined ? patch.publicName : existing.publicName,
      photoUrl: patch.photoUrl !== undefined ? patch.photoUrl : existing.photoUrl,
      phonePublic:
        patch.phonePublic !== undefined ? patch.phonePublic : existing.phonePublic,
      vehiclePlate:
        patch.vehiclePlate !== undefined ? patch.vehiclePlate : existing.vehiclePlate,
      vehicleLabel:
        patch.vehicleLabel !== undefined ? patch.vehicleLabel : existing.vehicleLabel,
      bio: patch.bio !== undefined ? patch.bio : existing.bio,
      vehicleClass: patch.vehicleClass ?? existing.vehicleClass,
      homeZoneCode:
        patch.homeZoneCode !== undefined ? patch.homeZoneCode : existing.homeZoneCode,
      licenceStatus: patch.licenceStatus ?? existing.licenceStatus,
      vehicleDocStatus: patch.vehicleDocStatus ?? existing.vehicleDocStatus,
      insuranceStatus: patch.insuranceStatus ?? existing.insuranceStatus,
      updatedAt: new Date(),
    })
    .where(eq(driverProfiles.id, existing.id))
    .returning();

  if (patch.displayName !== undefined || patch.phone !== undefined) {
    await db
      .update(users)
      .set({
        ...(patch.displayName !== undefined
          ? { displayName: patch.displayName }
          : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  return getDriverProfileBundle(userId);
}

/** Customer-safe professional card for a job’s assigned driver. */
export async function getJobDriverProfessional(input: {
  jobId: string;
  requesterUserId: string;
  isAdmin: boolean;
}) {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, input.jobId) });
  if (!job) throw new Error("job_not_found");
  if (!input.isAdmin && job.shipperUserId !== input.requesterUserId) {
    throw new Error("forbidden");
  }

  const assignment = await db.query.assignments.findFirst({
    where: and(
      eq(assignments.jobId, input.jobId),
      inArray(assignments.status, ["offered", "active"]),
    ),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  if (!assignment) return { driver: null };

  const profile = await db.query.driverProfiles.findFirst({
    where: eq(driverProfiles.userId, assignment.driverUserId),
  });
  const user = await db.query.users.findFirst({
    where: eq(users.id, assignment.driverUserId),
  });
  if (!profile || !user) return { driver: null };

  return {
    driver: toDriverProfessionalView(profile, user, {
      includePrivateContact: true,
    }),
    assignmentStatus: assignment.status,
  };
}

export async function listDriverEarnings(userId: string) {
  return db
    .select({
      id: earningLines.id,
      jobId: earningLines.jobId,
      amountCents: earningLines.amountCents,
      currency: earningLines.currency,
      status: earningLines.status,
      frozen: earningLines.frozen,
      createdAt: earningLines.createdAt,
      publicCode: jobs.publicCode,
      jobState: jobs.state,
      pickupAddress: jobs.pickupAddress,
      dropoffAddress: jobs.dropoffAddress,
      pickupZoneCode: jobs.pickupZoneCode,
      dropoffZoneCode: jobs.dropoffZoneCode,
      packageClass: jobs.packageClass,
      recipientName: jobs.recipientName,
    })
    .from(earningLines)
    .innerJoin(jobs, eq(jobs.id, earningLines.jobId))
    .where(eq(earningLines.driverUserId, userId))
    .orderBy(desc(earningLines.createdAt))
    .limit(50);
}

export async function getDriverJobHistory(userId: string, jobId: string) {
  const assigned = await db.query.assignments.findFirst({
    where: and(
      eq(assignments.jobId, jobId),
      eq(assignments.driverUserId, userId),
    ),
  });
  if (!assigned) return null;

  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) return null;

  const earning = await db.query.earningLines.findFirst({
    where: and(
      eq(earningLines.jobId, jobId),
      eq(earningLines.driverUserId, userId),
    ),
  });

  return {
    job,
    assignment: assigned,
    earning: earning ?? null,
  };
}

/** @deprecated Use openEmergencyIncident from incidents module (M8c). */
export async function declareDriverEmergency(input: {
  userId: string;
  category: "medical" | "threat" | "accident" | "assault";
  note?: string;
  lat?: number;
  lng?: number;
  correlationId: string;
}) {
  const { openEmergencyIncident } = await import("../incidents/service.js");
  return openEmergencyIncident(input);
}

export async function getJobAssignment(jobId: string) {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) throw new Error("job_not_found");
  const open = await db.query.assignments.findFirst({
    where: and(
      eq(assignments.jobId, jobId),
      inArray(assignments.status, ["offered", "active"]),
    ),
  });
  const holds = await db
    .select()
    .from(jobHolds)
    .where(and(eq(jobHolds.jobId, jobId), eq(jobHolds.active, true)));
  return { job, assignment: open ?? null, holds };
}
