import { and, desc, eq, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "../../db/client.js";
import {
  incidentEvents,
  incidentNotifications,
  incidents,
  jobHolds,
  jobs,
} from "../../db/schema.js";
import { writeAuditEvent } from "../audit/service.js";
import { assertFlagEnabled } from "../admin/service.js";
import { getDriverHome, placeHold, releaseHold } from "../dispatch/service.js";

export type EmergencyCategory = "medical" | "threat" | "accident" | "assault";

const OPEN_STATUSES = ["open", "acknowledged", "escalated"] as const;

function publicCode() {
  return `IN-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function playbookFor(category: EmergencyCategory) {
  if (category === "medical") return "WC-01";
  if (category === "threat") return "WC-02";
  if (category === "accident") return "WC-23";
  return "GENERAL";
}

function severityFor(category: EmergencyCategory) {
  if (category === "medical") return "medical";
  if (category === "accident") return "s2";
  return "s1";
}

function customerBucket(category: EmergencyCategory): "medical" | "safety" | "delay" {
  if (category === "medical") return "medical";
  if (category === "accident") return "delay";
  return "safety";
}

export function customerPauseMessage(bucket: "medical" | "safety" | "delay") {
  if (bucket === "medical") {
    return "Your driver has a medical emergency. Delivery is paused while we secure the parcel and arrange recovery. We’ll update you shortly.";
  }
  if (bucket === "safety") {
    return "Your delivery is paused for a safety reason. We’re handling it carefully and will share the next update soon.";
  }
  return "Your delivery is delayed due to a safety incident. We’re arranging the next step and will update you shortly.";
}

async function appendEvent(input: {
  incidentId: string;
  kind: string;
  actorUserId?: string;
  payload?: Record<string, unknown>;
}) {
  const [row] = await db
    .insert(incidentEvents)
    .values({
      incidentId: input.incidentId,
      kind: input.kind,
      actorUserId: input.actorUserId,
      payload: input.payload ?? {},
    })
    .returning();
  return row;
}

async function queueNotify(input: {
  incidentId: string;
  channel: string;
  audience: string;
  payload: Record<string, unknown>;
}) {
  const [row] = await db
    .insert(incidentNotifications)
    .values({
      incidentId: input.incidentId,
      channel: input.channel,
      audience: input.audience,
      status: "queued",
      payload: input.payload,
    })
    .returning();

  // Wave-1 notify path: log + mark sent (vendor later)
  console.info(
    `[swift-incident] audience=${input.audience} channel=${input.channel} incident=${input.incidentId}`,
    input.payload,
  );
  const [sent] = await db
    .update(incidentNotifications)
    .set({ status: "sent", sentAt: new Date() })
    .where(eq(incidentNotifications.id, row.id))
    .returning();
  return sent;
}

export async function openEmergencyIncident(input: {
  userId: string;
  category: EmergencyCategory;
  note?: string;
  lat?: number;
  lng?: number;
  correlationId: string;
}) {
  await assertFlagEnabled(
    "driver_emergency_enabled",
    true,
    "driver_emergency_disabled",
  );

  const home = await getDriverHome(input.userId);
  if (!home.profile) throw new Error("driver_profile_missing");

  const existing = await db.query.incidents.findFirst({
    where: and(
      eq(incidents.driverUserId, input.userId),
      inArray(incidents.status, [...OPEN_STATUSES]),
    ),
    orderBy: (t, { desc: d }) => [d(t.createdAt)],
  });
  if (existing) {
    return {
      incident: existing,
      hold: existing.holdId
        ? await db.query.jobHolds.findFirst({
            where: eq(jobHolds.id, existing.holdId),
          })
        : null,
      jobId: existing.jobId,
      category: existing.category as EmergencyCategory,
      reused: true,
    };
  }

  let hold = null as Awaited<ReturnType<typeof placeHold>> | null;
  if (home.job) {
    hold = await placeHold({
      jobId: home.job.id,
      holdType: "INCIDENT_HOLD",
      reasonCode: `emergency_${input.category}`,
      reasonNote: input.note,
      actorUserId: input.userId,
      correlationId: input.correlationId,
    });
  }

  const playbook = playbookFor(input.category);
  const severity = severityFor(input.category);
  const securityRestricted =
    input.category === "threat" || input.category === "assault";
  const doNotNormalReturn = input.category === "threat";
  const nonPunitive = input.category === "medical";

  const [incident] = await db
    .insert(incidents)
    .values({
      publicCode: publicCode(),
      category: input.category,
      severity,
      status: "open",
      playbook,
      driverUserId: input.userId,
      jobId: home.job?.id ?? null,
      holdId: hold?.id ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      note: input.note ?? null,
      securityRestricted,
      doNotNormalReturn,
      nonPunitive,
    })
    .returning();

  await appendEvent({
    incidentId: incident.id,
    kind: "opened",
    actorUserId: input.userId,
    payload: { category: input.category, playbook },
  });
  if (hold) {
    await appendEvent({
      incidentId: incident.id,
      kind: "hold_placed",
      actorUserId: input.userId,
      payload: { holdId: hold.id },
    });
  }

  await queueNotify({
    incidentId: incident.id,
    channel: "in_app",
    audience: "dispatch",
    payload: {
      publicCode: incident.publicCode,
      category: input.category,
      severity,
      jobId: home.job?.id ?? null,
    },
  });
  await queueNotify({
    incidentId: incident.id,
    channel: "in_app",
    audience: "ops",
    payload: {
      publicCode: incident.publicCode,
      playbook,
      severity,
    },
  });
  if (home.job) {
    const bucket = customerBucket(input.category);
    await queueNotify({
      incidentId: incident.id,
      channel: "in_app",
      audience: "customer",
      payload: {
        jobId: home.job.id,
        bucket,
        message: customerPauseMessage(bucket),
      },
    });
    await appendEvent({
      incidentId: incident.id,
      kind: "customer_notified",
      actorUserId: input.userId,
      payload: { bucket },
    });
  }

  await writeAuditEvent({
    actorType: "user",
    actorId: input.userId,
    action: "DRIVER_EMERGENCY_DECLARED",
    subjectType: "incident",
    subjectId: incident.id,
    reasonCode: `emergency_${input.category}`,
    correlationId: input.correlationId,
    payload: {
      category: input.category,
      note: input.note ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      holdId: hold?.id ?? null,
      jobId: home.job?.id ?? null,
      publicCode: incident.publicCode,
      playbook,
    },
  });

  return {
    incident,
    hold,
    jobId: home.job?.id ?? null,
    category: input.category,
    reused: false,
  };
}

export async function getActiveDriverIncident(userId: string) {
  return db.query.incidents.findFirst({
    where: and(
      eq(incidents.driverUserId, userId),
      inArray(incidents.status, [...OPEN_STATUSES]),
    ),
    orderBy: (t, { desc: d }) => [d(t.createdAt)],
  });
}

export async function listIncidents(input?: { status?: string }) {
  if (input?.status) {
    return db
      .select()
      .from(incidents)
      .where(eq(incidents.status, input.status))
      .orderBy(desc(incidents.createdAt))
      .limit(100);
  }
  return db
    .select()
    .from(incidents)
    .where(inArray(incidents.status, [...OPEN_STATUSES]))
    .orderBy(desc(incidents.createdAt))
    .limit(100);
}

export async function getIncidentDetail(incidentId: string) {
  const incident = await db.query.incidents.findFirst({
    where: eq(incidents.id, incidentId),
  });
  if (!incident) throw new Error("incident_not_found");

  const events = await db
    .select()
    .from(incidentEvents)
    .where(eq(incidentEvents.incidentId, incidentId))
    .orderBy(desc(incidentEvents.createdAt));

  const notifications = await db
    .select()
    .from(incidentNotifications)
    .where(eq(incidentNotifications.incidentId, incidentId))
    .orderBy(desc(incidentNotifications.createdAt));

  let job = null;
  if (incident.jobId) {
    job = await db.query.jobs.findFirst({ where: eq(jobs.id, incident.jobId) });
  }
  let hold = null;
  if (incident.holdId) {
    hold = await db.query.jobHolds.findFirst({
      where: eq(jobHolds.id, incident.holdId),
    });
  }

  return { incident, events, notifications, job, hold };
}

export async function acknowledgeIncident(input: {
  incidentId: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const incident = await db.query.incidents.findFirst({
    where: eq(incidents.id, input.incidentId),
  });
  if (!incident) throw new Error("incident_not_found");
  if (incident.status !== "open") throw new Error("incident_not_open");

  const [updated] = await db
    .update(incidents)
    .set({
      status: "acknowledged",
      acknowledgedByUserId: input.actorUserId,
      acknowledgedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(incidents.id, input.incidentId))
    .returning();

  await appendEvent({
    incidentId: input.incidentId,
    kind: "acknowledged",
    actorUserId: input.actorUserId,
  });
  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "INCIDENT_ACKNOWLEDGED",
    subjectType: "incident",
    subjectId: input.incidentId,
    correlationId: input.correlationId,
  });
  return updated;
}

export async function escalateIncident(input: {
  incidentId: string;
  actorUserId: string;
  note?: string;
  correlationId?: string;
}) {
  const incident = await db.query.incidents.findFirst({
    where: eq(incidents.id, input.incidentId),
  });
  if (!incident) throw new Error("incident_not_found");
  if (!OPEN_STATUSES.includes(incident.status as (typeof OPEN_STATUSES)[number])) {
    throw new Error("incident_not_open");
  }

  const [updated] = await db
    .update(incidents)
    .set({
      status: "escalated",
      updatedAt: new Date(),
    })
    .where(eq(incidents.id, input.incidentId))
    .returning();

  await appendEvent({
    incidentId: input.incidentId,
    kind: "escalated",
    actorUserId: input.actorUserId,
    payload: { note: input.note ?? null },
  });
  await queueNotify({
    incidentId: input.incidentId,
    channel: "in_app",
    audience: "ops",
    payload: {
      publicCode: incident.publicCode,
      note: input.note ?? null,
      escalated: true,
    },
  });
  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "INCIDENT_ESCALATED",
    subjectType: "incident",
    subjectId: input.incidentId,
    correlationId: input.correlationId,
    payload: { note: input.note ?? null },
  });
  return updated;
}

export async function notifyCustomerIncident(input: {
  incidentId: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const incident = await db.query.incidents.findFirst({
    where: eq(incidents.id, input.incidentId),
  });
  if (!incident) throw new Error("incident_not_found");
  if (!incident.jobId) throw new Error("incident_has_no_job");

  const bucket = customerBucket(incident.category as EmergencyCategory);
  const message = customerPauseMessage(bucket);
  await queueNotify({
    incidentId: input.incidentId,
    channel: "in_app",
    audience: "customer",
    payload: { jobId: incident.jobId, bucket, message },
  });
  await appendEvent({
    incidentId: input.incidentId,
    kind: "customer_notified",
    actorUserId: input.actorUserId,
    payload: { bucket },
  });
  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "INCIDENT_CUSTOMER_NOTIFIED",
    subjectType: "incident",
    subjectId: input.incidentId,
    correlationId: input.correlationId,
  });
  return { ok: true, message, bucket };
}

export async function addIncidentNote(input: {
  incidentId: string;
  actorUserId: string;
  note: string;
  correlationId?: string;
}) {
  const incident = await db.query.incidents.findFirst({
    where: eq(incidents.id, input.incidentId),
  });
  if (!incident) throw new Error("incident_not_found");
  await appendEvent({
    incidentId: input.incidentId,
    kind: "note_added",
    actorUserId: input.actorUserId,
    payload: { note: input.note },
  });
  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "INCIDENT_NOTE_ADDED",
    subjectType: "incident",
    subjectId: input.incidentId,
    correlationId: input.correlationId,
  });
  return { ok: true };
}

export async function resolveIncident(input: {
  incidentId: string;
  actorUserId: string;
  resolutionCode: string;
  resolutionNote?: string;
  releaseHold?: boolean;
  correlationId?: string;
}) {
  const incident = await db.query.incidents.findFirst({
    where: eq(incidents.id, input.incidentId),
  });
  if (!incident) throw new Error("incident_not_found");
  if (!OPEN_STATUSES.includes(incident.status as (typeof OPEN_STATUSES)[number])) {
    throw new Error("incident_already_closed");
  }

  if (
    incident.doNotNormalReturn &&
    input.releaseHold &&
    !["external_emergency_handled", "false_alarm", "backup_completed"].includes(
      input.resolutionCode,
    )
  ) {
    throw new Error("threat_hold_release_blocked");
  }

  const [updated] = await db
    .update(incidents)
    .set({
      status: input.resolutionCode === "false_alarm" ? "cancelled" : "resolved",
      resolvedByUserId: input.actorUserId,
      resolvedAt: new Date(),
      resolutionCode: input.resolutionCode,
      resolutionNote: input.resolutionNote ?? null,
      updatedAt: new Date(),
    })
    .where(eq(incidents.id, input.incidentId))
    .returning();

  await appendEvent({
    incidentId: input.incidentId,
    kind: "resolved",
    actorUserId: input.actorUserId,
    payload: {
      resolutionCode: input.resolutionCode,
      resolutionNote: input.resolutionNote ?? null,
    },
  });

  if (input.releaseHold && incident.holdId) {
    const hold = await db.query.jobHolds.findFirst({
      where: eq(jobHolds.id, incident.holdId),
    });
    if (hold?.active) {
      await releaseHold({
        holdId: hold.id,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
      });
      await appendEvent({
        incidentId: input.incidentId,
        kind: "hold_released",
        actorUserId: input.actorUserId,
        payload: { holdId: hold.id },
      });
    }
  }

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "INCIDENT_RESOLVED",
    subjectType: "incident",
    subjectId: input.incidentId,
    reasonCode: input.resolutionCode,
    correlationId: input.correlationId,
    payload: {
      resolutionNote: input.resolutionNote ?? null,
      releaseHold: Boolean(input.releaseHold),
      doNotNormalReturn: incident.doNotNormalReturn,
    },
  });

  return updated;
}

export async function getIncidentPauseForJob(jobId: string) {
  const incident = await db.query.incidents.findFirst({
    where: and(
      eq(incidents.jobId, jobId),
      inArray(incidents.status, [...OPEN_STATUSES]),
    ),
    orderBy: (t, { desc: d }) => [d(t.createdAt)],
  });
  if (!incident) return null;

  const bucket = customerBucket(incident.category as EmergencyCategory);
  return {
    publicCode: incident.publicCode,
    categoryBucket: bucket,
    message: customerPauseMessage(bucket),
    playbook: incident.playbook,
    securityRestricted: incident.securityRestricted,
  };
}
