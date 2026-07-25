import { and, desc, eq, inArray } from "drizzle-orm";
import { env } from "../../config.js";
import { db } from "../../db/client.js";
import {
  assignments,
  jobs,
  trackingLostTasks,
  trackingSessions,
  trackingSignals,
} from "../../db/schema.js";
import { writeAuditEvent } from "../audit/service.js";
import { haversineKm } from "../booking/pricing.js";

const OPEN_STATUSES = ["streaming", "degraded", "lost", "conflicted"] as const;

function ageSeconds(at: Date | null | undefined, now = new Date()) {
  if (!at) return Number.POSITIVE_INFINITY;
  return (now.getTime() - at.getTime()) / 1000;
}

function customerMessage(integrityClass: string): string {
  switch (integrityClass) {
    case "fresh":
      return "Driver location is updating normally.";
    case "stale":
    case "degraded":
      return "Connection is weak — showing last known position.";
    case "conflicted":
      return "Location temporarily unavailable while we verify the signal.";
    case "absent":
      return "We’re reconnecting — last known position shown. No invented movement.";
    default:
      return "Tracking status updating.";
  }
}

export async function startTrackingSession(input: {
  jobId: string;
  actorUserId: string;
  isStaff?: boolean;
  correlationId?: string;
}) {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, input.jobId) });
  if (!job) throw new Error("job_not_found");

  const assignment = await db.query.assignments.findFirst({
    where: and(
      eq(assignments.jobId, input.jobId),
      eq(assignments.status, "active"),
    ),
  });
  if (!assignment) throw new Error("assignment_required");

  if (
    !input.isStaff &&
    assignment.driverUserId !== input.actorUserId
  ) {
    throw new Error("not_assigned_driver");
  }

  const existing = await db.query.trackingSessions.findFirst({
    where: and(
      eq(trackingSessions.jobId, input.jobId),
      inArray(trackingSessions.status, [...OPEN_STATUSES]),
    ),
  });
  if (existing) return { session: existing, reused: true };

  const [session] = await db
    .insert(trackingSessions)
    .values({
      jobId: input.jobId,
      driverUserId: assignment.driverUserId,
      status: "streaming",
      integrityClass: "fresh",
    })
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "TRACKING_SESSION_STARTED",
    subjectType: "tracking_session",
    subjectId: session.id,
    correlationId: input.correlationId,
    payload: { jobId: input.jobId },
  });

  return { session, reused: false };
}

export async function endTrackingSession(input: {
  sessionId: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const session = await db.query.trackingSessions.findFirst({
    where: eq(trackingSessions.id, input.sessionId),
  });
  if (!session) throw new Error("session_not_found");
  if (session.status === "ended") return session;

  const [updated] = await db
    .update(trackingSessions)
    .set({
      status: "ended",
      endedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(trackingSessions.id, session.id))
    .returning();

  await db
    .update(trackingLostTasks)
    .set({ status: "closed", closedAt: new Date() })
    .where(
      and(
        eq(trackingLostTasks.sessionId, session.id),
        eq(trackingLostTasks.status, "open"),
      ),
    );

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "TRACKING_SESSION_ENDED",
    subjectType: "tracking_session",
    subjectId: session.id,
    correlationId: input.correlationId,
  });

  return updated;
}

async function openLostTask(session: typeof trackingSessions.$inferSelect) {
  const existing = await db.query.trackingLostTasks.findFirst({
    where: and(
      eq(trackingLostTasks.sessionId, session.id),
      eq(trackingLostTasks.status, "open"),
    ),
  });
  if (existing) return existing;

  try {
    const [task] = await db
      .insert(trackingLostTasks)
      .values({
        sessionId: session.id,
        jobId: session.jobId,
        status: "open",
      })
      .onConflictDoNothing()
      .returning();
    if (task) {
      await writeAuditEvent({
        actorType: "system",
        action: "TRACKING_LOST_TASK_OPENED",
        subjectType: "tracking_lost_task",
        subjectId: task.id,
        payload: { jobId: session.jobId, sessionId: session.id },
      });
      return task;
    }
  } catch {
    // partial unique may race
  }
  return db.query.trackingLostTasks.findFirst({
    where: and(
      eq(trackingLostTasks.sessionId, session.id),
      eq(trackingLostTasks.status, "open"),
    ),
  });
}

export async function evaluateSessionIntegrity(
  sessionId: string,
  opts?: { correlationId?: string },
) {
  const session = await db.query.trackingSessions.findFirst({
    where: eq(trackingSessions.id, sessionId),
  });
  if (!session || session.status === "ended") return session;

  const now = new Date();
  if (!session.lastSignalAt) {
    return session;
  }
  const age = ageSeconds(session.lastSignalAt, now);
  let status = session.status;
  let integrityClass = session.integrityClass;
  let lostAt = session.lostAt;

  if (session.integrityClass === "conflicted" && session.conflictReason) {
    status = "conflicted";
    integrityClass = "conflicted";
  } else if (age >= env.TRACK_LOST_SECONDS) {
    status = "lost";
    integrityClass = "absent";
    lostAt = lostAt ?? now;
  } else if (age >= env.TRACK_STALE_SECONDS) {
    status = "degraded";
    integrityClass = "stale";
  } else if (age >= env.TRACK_FRESH_SECONDS) {
    status = "degraded";
    integrityClass = "degraded";
  } else {
    status = "streaming";
    integrityClass = "fresh";
    lostAt = null;
  }

  const [updated] = await db
    .update(trackingSessions)
    .set({
      status,
      integrityClass,
      lostAt,
      updatedAt: now,
    })
    .where(eq(trackingSessions.id, session.id))
    .returning();

  if (status === "lost") {
    await openLostTask(updated);
  } else if (status === "streaming") {
    await db
      .update(trackingLostTasks)
      .set({ status: "closed", closedAt: now })
      .where(
        and(
          eq(trackingLostTasks.sessionId, session.id),
          eq(trackingLostTasks.status, "open"),
        ),
      );
  }

  return updated;
}

export async function ingestSignal(input: {
  sessionId: string;
  actorUserId: string;
  isStaff?: boolean;
  lat: number;
  lng: number;
  accuracyM?: number;
  speedMps?: number;
  recordedAt?: Date;
  correlationId?: string;
}) {
  const session = await db.query.trackingSessions.findFirst({
    where: eq(trackingSessions.id, input.sessionId),
  });
  if (!session) throw new Error("session_not_found");
  if (session.status === "ended") throw new Error("session_ended");
  if (!input.isStaff && session.driverUserId !== input.actorUserId) {
    throw new Error("not_assigned_driver");
  }

  const recordedAt = input.recordedAt ?? new Date();
  let rejected = false;
  let rejectReason: string | undefined;
  let conflictReason: string | undefined;

  if (
    session.lastLat != null &&
    session.lastLng != null &&
    session.lastSignalAt
  ) {
    const dt = Math.max(
      1,
      (recordedAt.getTime() - session.lastSignalAt.getTime()) / 1000,
    );
    const km = haversineKm(
      session.lastLat,
      session.lastLng,
      input.lat,
      input.lng,
    );
    const speed = (km * 1000) / dt;
    if (km >= env.TRACK_TELEPORT_KM && speed > env.TRACK_MAX_SPEED_MPS) {
      rejected = true;
      rejectReason = "teleport_suspect";
      conflictReason = `teleport_${km.toFixed(1)}km_${dt.toFixed(0)}s`;
    }
  }

  const [signal] = await db
    .insert(trackingSignals)
    .values({
      sessionId: session.id,
      lat: input.lat,
      lng: input.lng,
      accuracyM: input.accuracyM,
      speedMps: input.speedMps,
      recordedAt,
      rejected,
      rejectReason,
    })
    .returning();

  if (rejected) {
    const [updated] = await db
      .update(trackingSessions)
      .set({
        status: "conflicted",
        integrityClass: "conflicted",
        conflictReason,
        updatedAt: new Date(),
      })
      .where(eq(trackingSessions.id, session.id))
      .returning();

    await writeAuditEvent({
      actorType: "system",
      action: "TRACKING_SIGNAL_CONFLICTED",
      subjectType: "tracking_session",
      subjectId: session.id,
      correlationId: input.correlationId,
      reasonCode: rejectReason,
      payload: { signalId: signal.id, conflictReason },
    });

    return { signal, session: updated };
  }

  await db
    .update(trackingSessions)
    .set({
      lastLat: input.lat,
      lastLng: input.lng,
      lastKnownLat: input.lat,
      lastKnownLng: input.lng,
      lastSignalAt: recordedAt,
      lastKnownAt: recordedAt,
      conflictReason: null,
      status: "streaming",
      integrityClass: "fresh",
      lostAt: null,
      updatedAt: new Date(),
    })
    .where(eq(trackingSessions.id, session.id));

  const evaluated = await evaluateSessionIntegrity(session.id, {
    correlationId: input.correlationId,
  });

  return { signal, session: evaluated };
}

export async function getSessionForJob(jobId: string) {
  const rows = await db
    .select()
    .from(trackingSessions)
    .where(
      and(
        eq(trackingSessions.jobId, jobId),
        inArray(trackingSessions.status, [...OPEN_STATUSES]),
      ),
    )
    .orderBy(desc(trackingSessions.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCustomerProjection(jobId: string) {
  const { getIncidentPauseForJob } = await import("../incidents/service.js");
  let session = await getSessionForJob(jobId);
  if (session) {
    session = (await evaluateSessionIntegrity(session.id)) ?? session;
  }

  if (!session) {
    const pause = await getIncidentPauseForJob(jobId).catch(() => null);
    return {
      jobId,
      active: false,
      integrityClass: "absent" as const,
      allowLiveMarker: false,
      lastKnown: null,
      customerMessage: pause?.message ?? "Tracking not started for this delivery yet.",
      incidentPause: pause,
    };
  }

  const integrity = session.integrityClass;
  const allowLiveMarker = integrity === "fresh" || integrity === "stale" || integrity === "degraded";
  // Conflicted / absent: last known only, never imply live motion
  const showLive = integrity === "fresh";
  const pause = await getIncidentPauseForJob(jobId).catch(() => null);

  return {
    jobId,
    active: true,
    sessionId: session.id,
    status: session.status,
    integrityClass: integrity,
    allowLiveMarker,
    showLiveMotion: showLive,
    lastKnown:
      session.lastKnownLat != null && session.lastKnownLng != null
        ? {
            lat: session.lastKnownLat,
            lng: session.lastKnownLng,
            at: session.lastKnownAt,
          }
        : null,
    customerMessage: pause?.message ?? customerMessage(integrity),
    incidentPause: pause,
  };
}

export async function getStaffTrackingView(jobId: string) {
  const session = await getSessionForJob(jobId);
  if (session) await evaluateSessionIntegrity(session.id);
  const fresh = await getSessionForJob(jobId);
  const projection = await getCustomerProjection(jobId);
  const recent = fresh
    ? await db
        .select()
        .from(trackingSignals)
        .where(eq(trackingSignals.sessionId, fresh.id))
        .orderBy(desc(trackingSignals.recordedAt))
        .limit(20)
    : [];
  return { session: fresh, projection, recentSignals: recent };
}

export async function listActiveBoardPositions() {
  const sessions = await db
    .select()
    .from(trackingSessions)
    .where(inArray(trackingSessions.status, [...OPEN_STATUSES]));

  const evaluated = [];
  for (const s of sessions) {
    const next = (await evaluateSessionIntegrity(s.id)) ?? s;
    evaluated.push(next);
  }

  return evaluated.map((s) => ({
    sessionId: s.id,
    jobId: s.jobId,
    status: s.status,
    integrityClass: s.integrityClass,
    lat: s.lastKnownLat,
    lng: s.lastKnownLng,
    at: s.lastKnownAt,
    allowLiveMarker:
      s.integrityClass === "fresh" ||
      s.integrityClass === "stale" ||
      s.integrityClass === "degraded",
    showLiveMotion: s.integrityClass === "fresh",
  }));
}

export async function listLostSignalTasks() {
  return db
    .select()
    .from(trackingLostTasks)
    .where(eq(trackingLostTasks.status, "open"))
    .orderBy(desc(trackingLostTasks.createdAt));
}

export async function ackLostSignalTask(input: {
  taskId: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const task = await db.query.trackingLostTasks.findFirst({
    where: eq(trackingLostTasks.id, input.taskId),
  });
  if (!task) throw new Error("task_not_found");
  if (task.status !== "open") return task;

  const [updated] = await db
    .update(trackingLostTasks)
    .set({
      status: "acked",
      ackedAt: new Date(),
      ackedByUserId: input.actorUserId,
    })
    .where(eq(trackingLostTasks.id, task.id))
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "TRACKING_LOST_TASK_ACKED",
    subjectType: "tracking_lost_task",
    subjectId: task.id,
    correlationId: input.correlationId,
  });

  return updated;
}
