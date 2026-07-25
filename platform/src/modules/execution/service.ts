import { and, eq, inArray } from "drizzle-orm";
import { env } from "../../config.js";
import { db } from "../../db/client.js";
import {
  assignments,
  earningLines,
  jobs,
  proofArtefacts,
  trackingSessions,
} from "../../db/schema.js";
import { writeAuditEvent } from "../audit/service.js";
import { haversineKm } from "../booking/pricing.js";
import {
  canTransition,
  DELIVERY_PROOF_KINDS,
  PICKUP_PROOF_KINDS,
  type JobState,
  type ProofKind,
  PROOF_KINDS,
} from "../booking/states.js";
import { endTrackingSession } from "../tracking/service.js";
import { storeProofObject } from "./storage.js";

async function requireActiveAssignment(jobId: string, driverUserId: string) {
  const assignment = await db.query.assignments.findFirst({
    where: and(
      eq(assignments.jobId, jobId),
      eq(assignments.status, "active"),
      eq(assignments.driverUserId, driverUserId),
    ),
  });
  if (!assignment) throw new Error("not_assigned_driver");
  return assignment;
}

async function getJob(jobId: string) {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
  if (!job) throw new Error("job_not_found");
  return job;
}

async function transitionJob(input: {
  jobId: string;
  to: JobState;
  actorUserId: string;
  action: string;
  correlationId?: string;
  reasonCode?: string;
  payload?: Record<string, unknown>;
}) {
  const job = await getJob(input.jobId);
  if (!canTransition(job.state, input.to)) throw new Error("illegal_transition");

  const [updated] = await db
    .update(jobs)
    .set({ state: input.to, updatedAt: new Date() })
    .where(eq(jobs.id, job.id))
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: input.action,
    subjectType: "job",
    subjectId: job.id,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    payload: { from: job.state, to: input.to, ...(input.payload ?? {}) },
  });

  return updated;
}

export async function addProofArtefact(input: {
  jobId: string;
  actorUserId: string;
  kind: ProofKind;
  note?: string;
  contentBase64?: string;
  textContent?: string;
  contentType?: string;
  lat?: number;
  lng?: number;
  correlationId?: string;
}) {
  if (!(PROOF_KINDS as readonly string[]).includes(input.kind)) {
    throw new Error("invalid_proof_kind");
  }
  await requireActiveAssignment(input.jobId, input.actorUserId);

  const stored = await storeProofObject({
    jobId: input.jobId,
    kind: input.kind,
    contentBase64: input.contentBase64,
    textContent: input.textContent,
    contentType: input.contentType,
  });

  const [row] = await db
    .insert(proofArtefacts)
    .values({
      jobId: input.jobId,
      kind: input.kind,
      objectKey: stored.objectKey,
      contentType: stored.contentType,
      note: input.note,
      lat: input.lat,
      lng: input.lng,
      createdByUserId: input.actorUserId,
    })
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "PROOF_ARTEFACT_ADDED",
    subjectType: "proof_artefact",
    subjectId: row.id,
    correlationId: input.correlationId,
    payload: { jobId: input.jobId, kind: input.kind, objectKey: stored.objectKey },
  });

  return row;
}

export async function listProofs(jobId: string) {
  return db.select().from(proofArtefacts).where(eq(proofArtefacts.jobId, jobId));
}

async function hasProof(jobId: string, kinds: ProofKind[]) {
  const rows = await db
    .select()
    .from(proofArtefacts)
    .where(
      and(eq(proofArtefacts.jobId, jobId), inArray(proofArtefacts.kind, kinds)),
    )
    .limit(1);
  return rows.length > 0;
}

export async function markEnRoutePickup(input: {
  jobId: string;
  actorUserId: string;
  correlationId?: string;
}) {
  await requireActiveAssignment(input.jobId, input.actorUserId);
  return transitionJob({
    jobId: input.jobId,
    to: "EN_ROUTE_PICKUP",
    actorUserId: input.actorUserId,
    action: "JOB_EN_ROUTE_PICKUP",
    correlationId: input.correlationId,
  });
}

export async function markArrivedPickup(input: {
  jobId: string;
  actorUserId: string;
  correlationId?: string;
}) {
  await requireActiveAssignment(input.jobId, input.actorUserId);
  return transitionJob({
    jobId: input.jobId,
    to: "ARRIVED_PICKUP",
    actorUserId: input.actorUserId,
    action: "JOB_ARRIVED_PICKUP",
    correlationId: input.correlationId,
  });
}

export async function completePickup(input: {
  jobId: string;
  actorUserId: string;
  correlationId?: string;
}) {
  await requireActiveAssignment(input.jobId, input.actorUserId);
  const ok = await hasProof(input.jobId, PICKUP_PROOF_KINDS);
  if (!ok) throw new Error("pickup_proof_required");

  const picked = await transitionJob({
    jobId: input.jobId,
    to: "PICKED_UP",
    actorUserId: input.actorUserId,
    action: "JOB_PICKED_UP",
    correlationId: input.correlationId,
  });

  // Custody start → move into transit for Wave 1 (single continuous leg)
  return transitionJob({
    jobId: input.jobId,
    to: "IN_TRANSIT",
    actorUserId: input.actorUserId,
    action: "JOB_IN_TRANSIT",
    correlationId: input.correlationId,
    payload: { afterPickup: true, priorState: picked.state },
  });
}

export async function markArrivedDropoff(input: {
  jobId: string;
  actorUserId: string;
  correlationId?: string;
}) {
  await requireActiveAssignment(input.jobId, input.actorUserId);
  return transitionJob({
    jobId: input.jobId,
    to: "ARRIVED_DROPOFF",
    actorUserId: input.actorUserId,
    action: "JOB_ARRIVED_DROPOFF",
    correlationId: input.correlationId,
  });
}

async function closeOpenTracking(jobId: string, actorUserId: string) {
  const session = await db.query.trackingSessions.findFirst({
    where: and(
      eq(trackingSessions.jobId, jobId),
      inArray(trackingSessions.status, [
        "streaming",
        "degraded",
        "lost",
        "conflicted",
      ]),
    ),
  });
  if (session) {
    await endTrackingSession({
      sessionId: session.id,
      actorUserId,
    });
  }
}

export async function completeDelivery(input: {
  jobId: string;
  actorUserId: string;
  lat: number;
  lng: number;
  correlationId?: string;
}) {
  await requireActiveAssignment(input.jobId, input.actorUserId);
  const ok = await hasProof(input.jobId, DELIVERY_PROOF_KINDS);
  if (!ok) throw new Error("delivery_proof_required");
  if (
    input.lat == null ||
    input.lng == null ||
    Number.isNaN(input.lat) ||
    Number.isNaN(input.lng)
  ) {
    throw new Error("gps_required");
  }

  const job = await getJob(input.jobId);
  if (job.dropoffLat == null || job.dropoffLng == null) {
    throw new Error("dropoff_location_missing");
  }

  const distanceM =
    haversineKm(input.lat, input.lng, job.dropoffLat, job.dropoffLng) * 1000;
  if (distanceM > env.PROOF_DROPOFF_RADIUS_M) {
    await writeAuditEvent({
      actorType: "user",
      actorId: input.actorUserId,
      action: "DELIVERY_GEOFENCE_DENIED",
      subjectType: "job",
      subjectId: input.jobId,
      correlationId: input.correlationId,
      reasonCode: "outside_dropoff_geofence",
      payload: {
        distanceM: Math.round(distanceM),
        radiusM: env.PROOF_DROPOFF_RADIUS_M,
        lat: input.lat,
        lng: input.lng,
        dropoffLat: job.dropoffLat,
        dropoffLng: job.dropoffLng,
      },
    });
    throw new Error("outside_dropoff_geofence");
  }

  // Stamp GPS onto latest delivery proof if none has coords
  const proofs = await listProofs(input.jobId);
  const deliveryProof = proofs.find((p) =>
    DELIVERY_PROOF_KINDS.includes(p.kind as ProofKind),
  );
  if (deliveryProof && deliveryProof.lat == null) {
    await db
      .update(proofArtefacts)
      .set({ lat: input.lat, lng: input.lng })
      .where(eq(proofArtefacts.id, deliveryProof.id));
  }

  const delivered = await transitionJob({
    jobId: input.jobId,
    to: "DELIVERED",
    actorUserId: input.actorUserId,
    action: "JOB_DELIVERED",
    correlationId: input.correlationId,
    payload: {
      lat: input.lat,
      lng: input.lng,
      distanceM: Math.round(distanceM),
      radiusM: env.PROOF_DROPOFF_RADIUS_M,
    },
  });

  await closeOpenTracking(input.jobId, input.actorUserId);

  await db
    .update(earningLines)
    .set({ status: "pending" })
    .where(
      and(
        eq(earningLines.jobId, input.jobId),
        inArray(earningLines.status, ["pending", "included"]),
      ),
    );

  await writeAuditEvent({
    actorType: "system",
    action: "JOB_SETTLEMENT_ELIGIBLE",
    subjectType: "job",
    subjectId: input.jobId,
    correlationId: input.correlationId,
  });

  return delivered;
}

export async function failAttempt(input: {
  jobId: string;
  actorUserId: string;
  reasonCode: string;
  correlationId?: string;
}) {
  if (!input.reasonCode || input.reasonCode.length < 2) {
    throw new Error("reason_code_required");
  }
  await requireActiveAssignment(input.jobId, input.actorUserId);

  const job = await getJob(input.jobId);
  if (!canTransition(job.state, "FAILED_ATTEMPT")) {
    throw new Error("illegal_transition");
  }

  const failed = await transitionJob({
    jobId: input.jobId,
    to: "FAILED_ATTEMPT",
    actorUserId: input.actorUserId,
    action: "JOB_FAILED_ATTEMPT",
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
  });

  await closeOpenTracking(input.jobId, input.actorUserId);
  return failed;
}
