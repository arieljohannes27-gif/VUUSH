import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  adjustmentRequests,
  auditEvents,
  auditPacks,
  creditNotes,
  earningLines,
  financeReconcileItems,
  jobs,
  orgInvoices,
  organisations,
  payments,
  payoutBatches,
  pricingParams,
  users,
} from "../../db/schema.js";
import { writeAuditEvent } from "../audit/service.js";
import { generateWeeklyStatement } from "../enterprise/service.js";
import { refundPayment } from "../payments/service.js";
import { zipStoreFiles } from "./zip-store.js";

export const FINANCE_CREDIT_THRESHOLD_KEY = "finance_credit_approve_above_cents";
const DEFAULT_THRESHOLD_CENTS = 50_000;

export async function getFinanceCreditThresholdCents(): Promise<number> {
  const row = await db.query.pricingParams.findFirst({
    where: eq(pricingParams.key, FINANCE_CREDIT_THRESHOLD_KEY),
  });
  const cents = (row?.valueJson as { cents?: number } | undefined)?.cents;
  return Number.isFinite(cents) ? Number(cents) : DEFAULT_THRESHOLD_CENTS;
}

export async function seedFinanceDefaults() {
  await db
    .insert(pricingParams)
    .values({
      key: FINANCE_CREDIT_THRESHOLD_KEY,
      valueJson: { cents: DEFAULT_THRESHOLD_CENTS },
      description:
        "Support refunds/credits above this (cents) need Finance approve. Default R500.",
    })
    .onConflictDoNothing({ target: pricingParams.key });
  return { ok: true };
}

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

export async function getFinanceHome() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const [failedPayments] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(
      and(
        inArray(payments.status, ["failed", "declined", "cancelled"]),
        gte(payments.createdAt, sevenDaysAgo),
      ),
    );

  const [frozen] = await db
    .select({
      count: sql<number>`count(*)::int`,
      sumCents: sql<number>`coalesce(sum(${earningLines.amountCents}),0)::int`,
    })
    .from(earningLines)
    .where(eq(earningLines.frozen, true));

  const [badBatches] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payoutBatches)
    .where(inArray(payoutBatches.status, ["failed", "partial"]));

  const [staleReconcile] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(financeReconcileItems)
    .where(
      and(
        eq(financeReconcileItems.status, "open"),
        lte(financeReconcileItems.createdAt, fortyEightHoursAgo),
      ),
    );

  const [pendingAdjustments] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(adjustmentRequests)
    .where(eq(adjustmentRequests.status, "pending_finance"));

  /**
   * Beachhead demo composition (see 41_FINANCE_INCOME_DISPLAY.md).
   * Hero = company net take R350k; supports illustrate 25% take on R1.4m gross.
   */
  const companyIncomeCents = 35_000_000;
  const grossVolumeCents = 140_000_000;
  const driverShareCents = 105_000_000;
  const cashCollectedCents = 98_000_000;

  return {
    companyIncome: {
      label: "Company income",
      definition: "What VUUSH keeps after driver share (net take)",
      amountCents: companyIncomeCents,
      currency: "ZAR",
      periodLabel: "This month",
      isDemo: true,
      supports: [
        {
          key: "gross",
          label: "Gross volume",
          hint: "All job prices",
          amountCents: grossVolumeCents,
        },
        {
          key: "drivers",
          label: "Driver share",
          hint: "Owed to drivers",
          amountCents: driverShareCents,
        },
        {
          key: "cash",
          label: "Cash collected",
          hint: "Card captures",
          amountCents: cashCollectedCents,
        },
      ],
    },
    needsYou: {
      failedPayments: failedPayments?.count ?? 0,
      frozenEarnings: frozen?.count ?? 0,
      frozenEarningsCents: frozen?.sumCents ?? 0,
      payoutBatchesAttention: badBatches?.count ?? 0,
      staleReconcile: staleReconcile?.count ?? 0,
      pendingAdjustments: pendingAdjustments?.count ?? 0,
    },
    thresholdCents: await getFinanceCreditThresholdCents(),
  };
}

export async function listFinancePayments(input?: {
  status?: string;
  limit?: number;
}) {
  const limit = Math.min(input?.limit ?? 100, 200);
  const conditions = [];
  if (input?.status) conditions.push(eq(payments.status, input.status));

  return db
    .select({
      id: payments.id,
      jobId: payments.jobId,
      jobPublicCode: jobs.publicCode,
      amountCents: payments.amountCents,
      currency: payments.currency,
      status: payments.status,
      provider: payments.provider,
      providerPaymentId: payments.providerPaymentId,
      failureCode: payments.failureCode,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .innerJoin(jobs, eq(payments.jobId, jobs.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(payments.createdAt))
    .limit(limit);
}

export async function listFinanceStatements(input?: { limit?: number }) {
  const limit = Math.min(input?.limit ?? 50, 100);
  return db
    .select({
      id: orgInvoices.id,
      orgId: orgInvoices.orgId,
      orgName: organisations.name,
      periodStart: orgInvoices.periodStart,
      periodEnd: orgInvoices.periodEnd,
      currency: orgInvoices.currency,
      totalCents: orgInvoices.totalCents,
      status: orgInvoices.status,
      createdAt: orgInvoices.createdAt,
    })
    .from(orgInvoices)
    .innerJoin(organisations, eq(orgInvoices.orgId, organisations.id))
    .orderBy(desc(orgInvoices.createdAt))
    .limit(limit);
}

export async function getFinanceStatement(invoiceId: string) {
  const invoice = await db.query.orgInvoices.findFirst({
    where: eq(orgInvoices.id, invoiceId),
  });
  if (!invoice) throw new Error("statement_not_found");
  const org = await db.query.organisations.findFirst({
    where: eq(organisations.id, invoice.orgId),
  });
  return { invoice, orgName: org?.name ?? null };
}

export async function financeGenerateStatement(input: {
  orgId: string;
  actorUserId: string;
  correlationId?: string;
}) {
  return generateWeeklyStatement(input);
}

export async function createCreditNote(input: {
  orgId?: string;
  jobId?: string;
  statementId?: string;
  amountCents: number;
  reasonCode: string;
  notes?: string;
  actorUserId: string;
  correlationId?: string;
}) {
  if (input.amountCents <= 0) throw new Error("invalid_amount");
  const [row] = await db
    .insert(creditNotes)
    .values({
      orgId: input.orgId ?? null,
      jobId: input.jobId ?? null,
      statementId: input.statementId ?? null,
      amountCents: input.amountCents,
      reasonCode: input.reasonCode,
      notes: input.notes ?? null,
      createdByUserId: input.actorUserId,
    })
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "CREDIT_NOTE_CREATED",
    subjectType: "credit_note",
    subjectId: row.id,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    payload: {
      amountCents: input.amountCents,
      orgId: input.orgId,
      jobId: input.jobId,
      statementId: input.statementId,
    },
  });
  return row;
}

export async function listCreditNotes(input?: { limit?: number }) {
  const limit = Math.min(input?.limit ?? 50, 100);
  return db
    .select()
    .from(creditNotes)
    .orderBy(desc(creditNotes.createdAt))
    .limit(limit);
}

export async function listAdjustmentRequests(input?: {
  status?: string;
  limit?: number;
}) {
  const limit = Math.min(input?.limit ?? 50, 100);
  const status = input?.status ?? "pending_finance";
  return db
    .select({
      id: adjustmentRequests.id,
      jobId: adjustmentRequests.jobId,
      jobPublicCode: jobs.publicCode,
      caseId: adjustmentRequests.caseId,
      amountCents: adjustmentRequests.amountCents,
      currency: adjustmentRequests.currency,
      reasonCode: adjustmentRequests.reasonCode,
      status: adjustmentRequests.status,
      requestedByUserId: adjustmentRequests.requestedByUserId,
      requesterEmail: users.email,
      createdAt: adjustmentRequests.createdAt,
      resolutionNote: adjustmentRequests.resolutionNote,
    })
    .from(adjustmentRequests)
    .innerJoin(jobs, eq(adjustmentRequests.jobId, jobs.id))
    .leftJoin(users, eq(adjustmentRequests.requestedByUserId, users.id))
    .where(eq(adjustmentRequests.status, status))
    .orderBy(desc(adjustmentRequests.createdAt))
    .limit(limit);
}

export async function createAdjustmentRequest(input: {
  jobId: string;
  caseId?: string;
  amountCents: number;
  reasonCode: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const [row] = await db
    .insert(adjustmentRequests)
    .values({
      jobId: input.jobId,
      caseId: input.caseId ?? null,
      amountCents: input.amountCents,
      reasonCode: input.reasonCode,
      requestedByUserId: input.actorUserId,
      status: "pending_finance",
    })
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "ADJUSTMENT_REQUESTED",
    subjectType: "adjustment_request",
    subjectId: row.id,
    reasonCode: input.reasonCode,
    correlationId: input.correlationId,
    payload: {
      jobId: input.jobId,
      amountCents: input.amountCents,
      caseId: input.caseId,
    },
  });
  return row;
}

/**
 * Support (or anyone without finance role) hitting the threshold creates a queue item.
 * Finance / admin always execute immediately.
 */
export async function requestOrExecuteRefund(input: {
  jobId: string;
  amountCents?: number;
  reasonCode: string;
  actorUserId: string;
  actorRoles: string[];
  caseId?: string;
  correlationId?: string;
}) {
  const isFinance =
    input.actorRoles.includes("administrator") ||
    input.actorRoles.includes("finance_officer");

  const [money] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.jobId, input.jobId), eq(payments.status, "captured")))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  if (!money) throw new Error("no_captured_payment");
  const amount = input.amountCents ?? money.amountCents;
  const threshold = await getFinanceCreditThresholdCents();

  if (!isFinance && amount > threshold) {
    const req = await createAdjustmentRequest({
      jobId: input.jobId,
      caseId: input.caseId,
      amountCents: amount,
      reasonCode: input.reasonCode,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
    });
    return {
      status: "needs_finance_approval" as const,
      adjustmentId: req.id,
      thresholdCents: threshold,
      amountCents: amount,
    };
  }

  const result = await refundPayment({
    jobId: input.jobId,
    amountCents: amount,
    reasonCode: input.reasonCode,
    actorUserId: input.actorUserId,
    correlationId: input.correlationId,
  });
  return { status: "refunded" as const, ...result };
}

export async function approveAdjustmentRequest(input: {
  id: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const row = await db.query.adjustmentRequests.findFirst({
    where: eq(adjustmentRequests.id, input.id),
  });
  if (!row) throw new Error("adjustment_not_found");
  if (row.status !== "pending_finance") throw new Error("adjustment_not_pending");

  const result = await refundPayment({
    jobId: row.jobId,
    amountCents: row.amountCents,
    reasonCode: row.reasonCode,
    actorUserId: input.actorUserId,
    correlationId: input.correlationId,
  });

  const [updated] = await db
    .update(adjustmentRequests)
    .set({
      status: "approved",
      resolvedByUserId: input.actorUserId,
      resolvedAt: new Date(),
      resolutionNote: "approved",
    })
    .where(eq(adjustmentRequests.id, row.id))
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "ADJUSTMENT_APPROVED",
    subjectType: "adjustment_request",
    subjectId: row.id,
    correlationId: input.correlationId,
    payload: { jobId: row.jobId, amountCents: row.amountCents },
  });

  return { adjustment: updated, refund: result };
}

export async function rejectAdjustmentRequest(input: {
  id: string;
  actorUserId: string;
  note?: string;
  correlationId?: string;
}) {
  const row = await db.query.adjustmentRequests.findFirst({
    where: eq(adjustmentRequests.id, input.id),
  });
  if (!row) throw new Error("adjustment_not_found");
  if (row.status !== "pending_finance") throw new Error("adjustment_not_pending");

  const [updated] = await db
    .update(adjustmentRequests)
    .set({
      status: "rejected",
      resolvedByUserId: input.actorUserId,
      resolvedAt: new Date(),
      resolutionNote: input.note ?? "rejected",
    })
    .where(eq(adjustmentRequests.id, row.id))
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "ADJUSTMENT_REJECTED",
    subjectType: "adjustment_request",
    subjectId: row.id,
    correlationId: input.correlationId,
    payload: { note: input.note },
  });
  return updated;
}

export async function listReconcileItems(input?: {
  status?: string;
  limit?: number;
}) {
  const limit = Math.min(input?.limit ?? 50, 100);
  const status = input?.status;
  return db
    .select()
    .from(financeReconcileItems)
    .where(status ? eq(financeReconcileItems.status, status) : undefined)
    .orderBy(desc(financeReconcileItems.createdAt))
    .limit(limit);
}

export async function createReconcileItem(input: {
  source: string;
  externalRef?: string;
  jobId?: string;
  paymentId?: string;
  amountCents: number;
  notes?: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const [row] = await db
    .insert(financeReconcileItems)
    .values({
      source: input.source,
      externalRef: input.externalRef ?? null,
      jobId: input.jobId ?? null,
      paymentId: input.paymentId ?? null,
      amountCents: input.amountCents,
      notes: input.notes ?? null,
      createdByUserId: input.actorUserId,
      status: "open",
    })
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "RECONCILE_ITEM_CREATED",
    subjectType: "finance_reconcile_item",
    subjectId: row.id,
    correlationId: input.correlationId,
    payload: { amountCents: input.amountCents, source: input.source },
  });
  return row;
}

export async function matchReconcileItem(input: {
  id: string;
  jobId: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const row = await db.query.financeReconcileItems.findFirst({
    where: eq(financeReconcileItems.id, input.id),
  });
  if (!row) throw new Error("reconcile_not_found");
  if (row.status !== "open") throw new Error("reconcile_not_open");

  const [updated] = await db
    .update(financeReconcileItems)
    .set({
      status: "matched",
      jobId: input.jobId,
      resolvedByUserId: input.actorUserId,
      resolvedAt: new Date(),
    })
    .where(eq(financeReconcileItems.id, row.id))
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "RECONCILE_MATCHED",
    subjectType: "finance_reconcile_item",
    subjectId: row.id,
    correlationId: input.correlationId,
    payload: { jobId: input.jobId },
  });
  return updated;
}

export async function waiveReconcileItem(input: {
  id: string;
  notes?: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const row = await db.query.financeReconcileItems.findFirst({
    where: eq(financeReconcileItems.id, input.id),
  });
  if (!row) throw new Error("reconcile_not_found");
  if (row.status !== "open") throw new Error("reconcile_not_open");

  const [updated] = await db
    .update(financeReconcileItems)
    .set({
      status: "waived",
      notes: input.notes ?? row.notes,
      resolvedByUserId: input.actorUserId,
      resolvedAt: new Date(),
    })
    .where(eq(financeReconcileItems.id, row.id))
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "RECONCILE_WAIVED",
    subjectType: "finance_reconcile_item",
    subjectId: row.id,
    correlationId: input.correlationId,
    payload: { notes: input.notes },
  });
  return updated;
}

export async function buildFinanceExports(input: {
  from: Date;
  to: Date;
  datasets: string[];
}) {
  const files: Record<string, string> = {};
  const set = new Set(input.datasets);

  if (set.has("payments")) {
    const rows = await db
      .select({
        id: payments.id,
        jobPublicCode: jobs.publicCode,
        amountCents: payments.amountCents,
        status: payments.status,
        provider: payments.provider,
        providerPaymentId: payments.providerPaymentId,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .innerJoin(jobs, eq(payments.jobId, jobs.id))
      .where(
        and(
          gte(payments.createdAt, input.from),
          lte(payments.createdAt, input.to),
        ),
      );
    files["payments.csv"] = toCsv(
      [
        "id",
        "job_public_code",
        "amount_cents",
        "status",
        "provider",
        "provider_payment_id",
        "created_at",
      ],
      rows.map((r) => [
        r.id,
        r.jobPublicCode,
        r.amountCents,
        r.status,
        r.provider,
        r.providerPaymentId,
        r.createdAt.toISOString(),
      ]),
    );
  }

  if (set.has("earnings")) {
    const rows = await db
      .select({
        id: earningLines.id,
        jobPublicCode: jobs.publicCode,
        driverUserId: earningLines.driverUserId,
        amountCents: earningLines.amountCents,
        status: earningLines.status,
        frozen: earningLines.frozen,
        createdAt: earningLines.createdAt,
      })
      .from(earningLines)
      .innerJoin(jobs, eq(earningLines.jobId, jobs.id))
      .where(
        and(
          gte(earningLines.createdAt, input.from),
          lte(earningLines.createdAt, input.to),
        ),
      );
    files["earnings.csv"] = toCsv(
      [
        "id",
        "job_public_code",
        "driver_user_id",
        "amount_cents",
        "status",
        "frozen",
        "created_at",
      ],
      rows.map((r) => [
        r.id,
        r.jobPublicCode,
        r.driverUserId,
        r.amountCents,
        r.status,
        r.frozen,
        r.createdAt.toISOString(),
      ]),
    );
  }

  if (set.has("payout_batches")) {
    const rows = await db
      .select()
      .from(payoutBatches)
      .where(
        and(
          gte(payoutBatches.createdAt, input.from),
          lte(payoutBatches.createdAt, input.to),
        ),
      );
    files["payout_batches.csv"] = toCsv(
      ["id", "status", "total_cents", "currency", "executed_at", "created_at"],
      rows.map((r) => [
        r.id,
        r.status,
        r.totalCents,
        r.currency,
        r.executedAt?.toISOString() ?? "",
        r.createdAt.toISOString(),
      ]),
    );
  }

  if (set.has("org_statements")) {
    const rows = await db
      .select({
        id: orgInvoices.id,
        orgId: orgInvoices.orgId,
        orgName: organisations.name,
        totalCents: orgInvoices.totalCents,
        status: orgInvoices.status,
        createdAt: orgInvoices.createdAt,
      })
      .from(orgInvoices)
      .innerJoin(organisations, eq(orgInvoices.orgId, organisations.id))
      .where(
        and(
          gte(orgInvoices.createdAt, input.from),
          lte(orgInvoices.createdAt, input.to),
        ),
      );
    files["org_statements.csv"] = toCsv(
      ["id", "org_id", "org_name", "total_cents", "status", "created_at"],
      rows.map((r) => [
        r.id,
        r.orgId,
        r.orgName,
        r.totalCents,
        r.status,
        r.createdAt.toISOString(),
      ]),
    );
  }

  if (set.has("credit_notes")) {
    const rows = await db
      .select()
      .from(creditNotes)
      .where(
        and(
          gte(creditNotes.createdAt, input.from),
          lte(creditNotes.createdAt, input.to),
        ),
      );
    files["credit_notes.csv"] = toCsv(
      [
        "id",
        "org_id",
        "job_id",
        "statement_id",
        "amount_cents",
        "reason_code",
        "created_at",
      ],
      rows.map((r) => [
        r.id,
        r.orgId,
        r.jobId,
        r.statementId,
        r.amountCents,
        r.reasonCode,
        r.createdAt.toISOString(),
      ]),
    );
  }

  if (set.has("reconcile_items")) {
    const rows = await db
      .select()
      .from(financeReconcileItems)
      .where(
        and(
          gte(financeReconcileItems.createdAt, input.from),
          lte(financeReconcileItems.createdAt, input.to),
        ),
      );
    files["reconcile_items.csv"] = toCsv(
      [
        "id",
        "source",
        "external_ref",
        "job_id",
        "amount_cents",
        "status",
        "created_at",
      ],
      rows.map((r) => [
        r.id,
        r.source,
        r.externalRef,
        r.jobId,
        r.amountCents,
        r.status,
        r.createdAt.toISOString(),
      ]),
    );
  }

  if (Object.keys(files).length === 0) throw new Error("no_datasets");
  return zipStoreFiles(files);
}

export async function createAuditPack(input: {
  from: Date;
  to: Date;
  orgId?: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const jobConds = [
    gte(jobs.createdAt, input.from),
    lte(jobs.createdAt, input.to),
  ];
  if (input.orgId) jobConds.push(eq(jobs.orgId, input.orgId));

  const jobRows = await db
    .select({
      id: jobs.id,
      publicCode: jobs.publicCode,
      state: jobs.state,
      paymentStatus: jobs.paymentStatus,
      orgId: jobs.orgId,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .where(and(...jobConds))
    .limit(2000);

  const payRows = await listFinancePayments({ limit: 200 });
  const earnRows = await db
    .select()
    .from(earningLines)
    .where(
      and(
        gte(earningLines.createdAt, input.from),
        lte(earningLines.createdAt, input.to),
      ),
    )
    .limit(2000);

  const batchRows = await db
    .select()
    .from(payoutBatches)
    .where(
      and(
        gte(payoutBatches.createdAt, input.from),
        lte(payoutBatches.createdAt, input.to),
      ),
    )
    .limit(500);

  const auditRows = await db
    .select()
    .from(auditEvents)
    .where(
      and(
        gte(auditEvents.createdAt, input.from),
        lte(auditEvents.createdAt, input.to),
      ),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(5000);

  const payload: Record<string, string> = {
    "jobs.json": JSON.stringify(jobRows, null, 2),
    "payments.csv": toCsv(
      ["id", "job_public_code", "amount_cents", "status", "created_at"],
      payRows
        .filter(
          (p) => p.createdAt >= input.from && p.createdAt <= input.to,
        )
        .map((p) => [
          p.id,
          p.jobPublicCode,
          p.amountCents,
          p.status,
          p.createdAt.toISOString(),
        ]),
    ),
    "earnings.csv": toCsv(
      ["id", "job_id", "amount_cents", "status", "frozen", "created_at"],
      earnRows.map((e) => [
        e.id,
        e.jobId,
        e.amountCents,
        e.status,
        e.frozen,
        e.createdAt.toISOString(),
      ]),
    ),
    "payouts.csv": toCsv(
      ["id", "status", "total_cents", "created_at"],
      batchRows.map((b) => [
        b.id,
        b.status,
        b.totalCents,
        b.createdAt.toISOString(),
      ]),
    ),
    "audit_events.jsonl": auditRows
      .map((a) =>
        JSON.stringify({
          id: a.id,
          action: a.action,
          subjectType: a.subjectType,
          subjectId: a.subjectId,
          actorId: a.actorId,
          createdAt: a.createdAt,
        }),
      )
      .join("\n"),
  };

  const manifest = {
    requestedBy: input.actorUserId,
    from: input.from.toISOString(),
    to: input.to.toISOString(),
    orgId: input.orgId ?? null,
    files: Object.keys(payload),
    counts: {
      jobs: jobRows.length,
      earnings: earnRows.length,
      payoutBatches: batchRows.length,
      auditEvents: auditRows.length,
    },
    createdAt: new Date().toISOString(),
  };
  payload["manifest.json"] = JSON.stringify(manifest, null, 2);

  const [pack] = await db
    .insert(auditPacks)
    .values({
      requestedByUserId: input.actorUserId,
      orgId: input.orgId ?? null,
      periodStart: input.from,
      periodEnd: input.to,
      status: "ready",
      manifestJson: manifest,
      payloadJson: payload,
    })
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "AUDIT_PACK_CREATED",
    subjectType: "audit_pack",
    subjectId: pack.id,
    correlationId: input.correlationId,
    payload: manifest,
  });

  return pack;
}

export async function listAuditPacks(input?: { limit?: number }) {
  const limit = Math.min(input?.limit ?? 20, 50);
  return db
    .select({
      id: auditPacks.id,
      periodStart: auditPacks.periodStart,
      periodEnd: auditPacks.periodEnd,
      status: auditPacks.status,
      orgId: auditPacks.orgId,
      requestedByUserId: auditPacks.requestedByUserId,
      manifestJson: auditPacks.manifestJson,
      createdAt: auditPacks.createdAt,
    })
    .from(auditPacks)
    .orderBy(desc(auditPacks.createdAt))
    .limit(limit);
}

export async function getAuditPackZip(packId: string) {
  const pack = await db.query.auditPacks.findFirst({
    where: eq(auditPacks.id, packId),
  });
  if (!pack) throw new Error("audit_pack_not_found");
  const files = (pack.payloadJson ?? {}) as Record<string, string>;
  return { pack, zip: zipStoreFiles(files) };
}
