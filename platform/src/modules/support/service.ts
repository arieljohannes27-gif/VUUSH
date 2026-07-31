import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "../../db/client.js";
import {
  auditEvents,
  jobs,
  supportCases,
  supportMessages,
  users,
} from "../../db/schema.js";
import { writeAuditEvent } from "../audit/service.js";
import { placeHold } from "../dispatch/service.js";
import { listPaymentsForJob } from "../payments/service.js";

function publicCode() {
  return `SU-${randomBytes(3).toString("hex").toUpperCase()}`;
}

const agentRoles = new Set([
  "support_agent",
  "administrator",
  "operations_manager",
]);

export function isSupportAgent(roles: string[] | undefined) {
  return Boolean(roles?.some((r) => agentRoles.has(r)));
}

async function requireCase(caseId: string) {
  const row = await db.query.supportCases.findFirst({
    where: eq(supportCases.id, caseId),
  });
  if (!row) throw new Error("case_not_found");
  return row;
}

export async function openSupportCase(input: {
  userId: string;
  subject: string;
  message: string;
  jobId?: string;
  channel?: string;
  correlationId?: string;
}) {
  if (input.jobId) {
    const job = await db.query.jobs.findFirst({ where: eq(jobs.id, input.jobId) });
    if (!job) throw new Error("job_not_found");
  }

  const [opened] = await db
    .insert(supportCases)
    .values({
      publicCode: publicCode(),
      openedByUserId: input.userId,
      jobId: input.jobId,
      subject: input.subject,
      status: "open",
      channel: input.channel ?? "customer",
    })
    .returning();

  const [message] = await db
    .insert(supportMessages)
    .values({
      caseId: opened.id,
      authorUserId: input.userId,
      authorKind: "customer",
      body: input.message,
    })
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.userId,
    action: "SUPPORT_CASE_OPENED",
    subjectType: "support_case",
    subjectId: opened.id,
    correlationId: input.correlationId,
    payload: {
      publicCode: opened.publicCode,
      jobId: input.jobId ?? null,
      subject: input.subject,
    },
  });

  return {
    caseId: opened.id,
    publicCode: opened.publicCode,
    status: opened.status,
    subject: opened.subject,
    createdAt: opened.createdAt,
    firstMessageId: message.id,
  };
}

export async function listMyCases(userId: string) {
  return db
    .select()
    .from(supportCases)
    .where(eq(supportCases.openedByUserId, userId))
    .orderBy(desc(supportCases.createdAt))
    .limit(50);
}

export async function listDeskCases(status?: string) {
  if (status) {
    return db
      .select()
      .from(supportCases)
      .where(eq(supportCases.status, status))
      .orderBy(desc(supportCases.createdAt))
      .limit(100);
  }
  return db
    .select()
    .from(supportCases)
    .where(inArray(supportCases.status, ["open", "pending", "escalated"]))
    .orderBy(desc(supportCases.createdAt))
    .limit(100);
}

export async function getCaseDetail(input: {
  caseId: string;
  userId: string;
  isAgent: boolean;
}) {
  const row = await requireCase(input.caseId);
  if (!input.isAgent && row.openedByUserId !== input.userId) {
    throw new Error("case_forbidden");
  }

  const messages = await db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.caseId, row.id))
    .orderBy(asc(supportMessages.createdAt));

  let job = null;
  let payments: Awaited<ReturnType<typeof listPaymentsForJob>> = [];
  let timeline: Array<{
    id: string;
    action: string;
    occurredAt: Date;
    reasonCode: string | null;
  }> = [];

  if (row.jobId) {
    job = await db.query.jobs.findFirst({ where: eq(jobs.id, row.jobId) });
    payments = await listPaymentsForJob(row.jobId);
    const events = await db
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        occurredAt: auditEvents.occurredAt,
        reasonCode: auditEvents.reasonCode,
      })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.subjectType, "job"),
          eq(auditEvents.subjectId, row.jobId),
        ),
      )
      .orderBy(desc(auditEvents.occurredAt))
      .limit(40);
    timeline = events;
  }

  const opener = await db.query.users.findFirst({
    where: eq(users.id, row.openedByUserId),
  });

  return {
    case: row,
    messages,
    job,
    payments,
    timeline,
    opener: opener
      ? {
          id: opener.id,
          email: opener.email,
          phone: opener.phone,
          displayName: opener.displayName,
        }
      : null,
  };
}

export async function addCaseMessage(input: {
  caseId: string;
  userId: string;
  isAgent: boolean;
  body: string;
  correlationId?: string;
}) {
  const row = await requireCase(input.caseId);
  if (!input.isAgent && row.openedByUserId !== input.userId) {
    throw new Error("case_forbidden");
  }
  if (row.status === "resolved") throw new Error("case_resolved");

  const [message] = await db
    .insert(supportMessages)
    .values({
      caseId: row.id,
      authorUserId: input.userId,
      authorKind: input.isAgent ? "agent" : "customer",
      body: input.body,
    })
    .returning();

  const nextStatus = input.isAgent ? "pending" : "open";
  await db
    .update(supportCases)
    .set({
      status: row.status === "escalated" ? "escalated" : nextStatus,
      assignedToUserId: input.isAgent ? input.userId : row.assignedToUserId,
      updatedAt: new Date(),
    })
    .where(eq(supportCases.id, row.id));

  await writeAuditEvent({
    actorType: "user",
    actorId: input.userId,
    action: "SUPPORT_MESSAGE_ADDED",
    subjectType: "support_case",
    subjectId: row.id,
    correlationId: input.correlationId,
    payload: { authorKind: input.isAgent ? "agent" : "customer" },
  });

  return message;
}

export async function resolveCase(input: {
  caseId: string;
  actorUserId: string;
  note?: string;
  correlationId?: string;
}) {
  const row = await requireCase(input.caseId);
  const [updated] = await db
    .update(supportCases)
    .set({
      status: "resolved",
      resolvedAt: new Date(),
      assignedToUserId: input.actorUserId,
      updatedAt: new Date(),
    })
    .where(eq(supportCases.id, row.id))
    .returning();

  if (input.note?.trim()) {
    await db.insert(supportMessages).values({
      caseId: row.id,
      authorUserId: input.actorUserId,
      authorKind: "agent",
      body: input.note.trim(),
    });
  }

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "SUPPORT_CASE_RESOLVED",
    subjectType: "support_case",
    subjectId: row.id,
    correlationId: input.correlationId,
  });

  return updated;
}

export async function escalateCase(input: {
  caseId: string;
  actorUserId: string;
  reasonCode: string;
  note?: string;
  correlationId?: string;
}) {
  const row = await requireCase(input.caseId);
  let hold = null;
  if (row.jobId) {
    hold = await placeHold({
      jobId: row.jobId,
      holdType: "DISPATCH_HOLD",
      reasonCode: input.reasonCode,
      reasonNote: input.note,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
    });
  }

  const [updated] = await db
    .update(supportCases)
    .set({
      status: "escalated",
      priority: "high",
      assignedToUserId: input.actorUserId,
      updatedAt: new Date(),
    })
    .where(eq(supportCases.id, row.id))
    .returning();

  await db.insert(supportMessages).values({
    caseId: row.id,
    authorUserId: input.actorUserId,
    authorKind: "system",
    body: `Escalated to dispatch/ops (${input.reasonCode})${input.note ? `: ${input.note}` : ""}`,
  });

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "SUPPORT_CASE_ESCALATED",
    subjectType: "support_case",
    subjectId: row.id,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    payload: { holdId: hold?.id ?? null, jobId: row.jobId },
  });

  return { case: updated, hold };
}

export async function openClaim(input: {
  caseId: string;
  actorUserId: string;
  note: string;
  correlationId?: string;
}) {
  const row = await requireCase(input.caseId);
  const [updated] = await db
    .update(supportCases)
    .set({
      claimOpened: true,
      priority: "high",
      updatedAt: new Date(),
    })
    .where(eq(supportCases.id, row.id))
    .returning();

  await db.insert(supportMessages).values({
    caseId: row.id,
    authorUserId: input.actorUserId,
    authorKind: "system",
    body: `Claim opened: ${input.note}`,
  });

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "SUPPORT_CLAIM_OPENED",
    subjectType: "support_case",
    subjectId: row.id,
    correlationId: input.correlationId,
    payload: { jobId: row.jobId, note: input.note },
  });

  return updated;
}

export async function refundForCase(input: {
  caseId: string;
  actorUserId: string;
  reasonCode: string;
  amountCents?: number;
  correlationId?: string;
}) {
  const { assertFlagEnabled } = await import("../admin/service.js");
  await assertFlagEnabled(
    "support_refunds_enabled",
    true,
    "support_refunds_disabled",
  );

  const row = await requireCase(input.caseId);
  if (!row.jobId) throw new Error("case_has_no_job");

  const { requestOrExecuteRefund } = await import("../finance/service.js");
  const { getUserRoles } = await import("../identity/service.js");
  const actorRoles = await getUserRoles(input.actorUserId);

  const result = await requestOrExecuteRefund({
    jobId: row.jobId,
    amountCents: input.amountCents,
    reasonCode: input.reasonCode,
    actorUserId: input.actorUserId,
    actorRoles,
    caseId: row.id,
    correlationId: input.correlationId,
  });

  const body =
    result.status === "needs_finance_approval"
      ? `Refund sent to Finance for approval (${input.reasonCode})`
      : `Refund issued (${input.reasonCode})`;

  await db.insert(supportMessages).values({
    caseId: row.id,
    authorUserId: input.actorUserId,
    authorKind: "system",
    body,
  });

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action:
      result.status === "needs_finance_approval"
        ? "SUPPORT_REFUND_PENDING_FINANCE"
        : "SUPPORT_REFUND_ISSUED",
    subjectType: "support_case",
    subjectId: row.id,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    payload: { jobId: row.jobId, result },
  });

  return result;
}
