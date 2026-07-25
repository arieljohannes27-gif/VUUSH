import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  adjustments,
  driverProfiles,
  earningLines,
  jobs,
  paymentWebhookEvents,
  payments,
  payoutBatches,
  payoutItems,
  quotes,
  users,
} from "../../db/schema.js";
import { env } from "../../config.js";
import { writeAuditEvent } from "../audit/service.js";
import {
  getPaymentProvider,
  getPayoutProvider,
  getPaystackProvider,
} from "./factory.js";
import { resolveDriverShare } from "./driver-share.js";
import {
  incidentFreezeReason,
  isAutoIncidentFreezeReason,
} from "./incident-freeze.js";

async function resolvePayerEmail(payerUserId: string): Promise<string> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, payerUserId),
  });
  if (user?.email) return user.email;
  return `payer+${payerUserId}@vuush.local`;
}

export async function chargeForJobConfirm(input: {
  jobId: string;
  payerUserId: string;
  methodRef?: string;
  correlationId?: string;
}) {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, input.jobId) });
  if (!job) throw new Error("job_not_found");
  if (job.state !== "QUOTED") throw new Error("illegal_transition");
  if (!job.activeQuoteId) throw new Error("quote_required");

  const quote = await db.query.quotes.findFirst({
    where: eq(quotes.id, job.activeQuoteId),
  });
  if (!quote || quote.expiresAt < new Date()) throw new Error("quote_expired");

  const idempotencyKey = `job_confirm:${job.id}:${quote.id}`;
  const existing = await db.query.payments.findFirst({
    where: eq(payments.idempotencyKey, idempotencyKey),
  });
  if (existing?.status === "captured") {
    return { payment: existing, reused: true };
  }

  const provider = getPaymentProvider();
  const payerEmail = await resolvePayerEmail(input.payerUserId);
  const [payment] = await db
    .insert(payments)
    .values({
      jobId: job.id,
      payerUserId: input.payerUserId,
      amountCents: quote.totalCents,
      currency: quote.currency,
      status: "processing",
      provider: provider.name,
      idempotencyKey,
      providerMethodRef: input.methodRef,
      metadata: { quoteId: quote.id },
    })
    .onConflictDoNothing()
    .returning();

  const row =
    payment ??
    (await db.query.payments.findFirst({
      where: eq(payments.idempotencyKey, idempotencyKey),
    }));
  if (!row) throw new Error("payment_create_failed");

  if (row.status === "captured") return { payment: row, reused: true };

  const result = await provider.createPayment({
    amountCents: quote.totalCents,
    currency: quote.currency,
    jobId: job.id,
    payerUserId: input.payerUserId,
    payerEmail,
    idempotencyKey,
    methodRef: input.methodRef,
  });

  const [updated] = await db
    .update(payments)
    .set({
      status: result.status === "captured" ? "captured" : result.status,
      providerPaymentId: result.providerPaymentId,
      providerMethodRef: result.providerMethodRef ?? row.providerMethodRef,
      failureCode: result.failureCode,
      updatedAt: new Date(),
      metadata: {
        ...((row.metadata as Record<string, unknown> | null) ?? {}),
        providerRaw: result.raw ?? {},
      },
    })
    .where(eq(payments.id, row.id))
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.payerUserId,
    action:
      result.status === "captured" ? "PAYMENT_CAPTURED" : "PAYMENT_FAILED",
    subjectType: "payment",
    subjectId: updated.id,
    correlationId: input.correlationId,
    payload: {
      jobId: job.id,
      amountCents: quote.totalCents,
      provider: provider.name,
      status: result.status,
    },
  });

  if (result.status !== "captured") {
    throw new Error(result.failureCode ?? "payment_failed");
  }

  return { payment: updated, reused: false };
}

/** Start Paystack hosted checkout; confirm later with methodRef = reference (or webhook). */
export async function initializePaystackCheckout(input: {
  jobId: string;
  payerUserId: string;
  correlationId?: string;
}) {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, input.jobId) });
  if (!job) throw new Error("job_not_found");
  if (job.shipperUserId !== input.payerUserId) throw new Error("forbidden");
  if (job.state !== "QUOTED") throw new Error("illegal_transition");
  if (!job.activeQuoteId) throw new Error("quote_required");

  const quote = await db.query.quotes.findFirst({
    where: eq(quotes.id, job.activeQuoteId),
  });
  if (!quote || quote.expiresAt < new Date()) throw new Error("quote_expired");

  const paystack = getPaystackProvider();
  const payerEmail = await resolvePayerEmail(input.payerUserId);
  const idempotencyKey = `job_confirm:${job.id}:${quote.id}`;

  const existing = await db.query.payments.findFirst({
    where: eq(payments.idempotencyKey, idempotencyKey),
  });
  if (existing?.status === "captured") {
    throw new Error("payment_already_captured");
  }

  const checkout = await paystack.initializeCheckout({
    amountCents: quote.totalCents,
    currency: quote.currency,
    email: payerEmail,
    jobId: job.id,
    idempotencyKey,
    metadata: { quoteId: quote.id },
  });

  const [payment] = await db
    .insert(payments)
    .values({
      jobId: job.id,
      payerUserId: input.payerUserId,
      amountCents: quote.totalCents,
      currency: quote.currency,
      status: "requires_action",
      provider: paystack.name,
      idempotencyKey,
      providerPaymentId: checkout.reference,
      metadata: {
        quoteId: quote.id,
        authorizationUrl: checkout.authorizationUrl,
        accessCode: checkout.accessCode,
      },
    })
    .onConflictDoNothing()
    .returning();

  const row =
    payment ??
    (await db.query.payments.findFirst({
      where: eq(payments.idempotencyKey, idempotencyKey),
    }));
  if (!row) throw new Error("payment_create_failed");

  if (row.status !== "captured") {
    await db
      .update(payments)
      .set({
        status: "requires_action",
        providerPaymentId: checkout.reference,
        updatedAt: new Date(),
        metadata: {
          ...((row.metadata as Record<string, unknown> | null) ?? {}),
          quoteId: quote.id,
          authorizationUrl: checkout.authorizationUrl,
          accessCode: checkout.accessCode,
        },
      })
      .where(eq(payments.id, row.id));
  }

  await writeAuditEvent({
    actorType: "user",
    actorId: input.payerUserId,
    action: "PAYMENT_CHECKOUT_INITIALIZED",
    subjectType: "payment",
    subjectId: row.id,
    correlationId: input.correlationId,
    payload: {
      jobId: job.id,
      reference: checkout.reference,
      provider: paystack.name,
    },
  });

  return {
    paymentId: row.id,
    reference: checkout.reference,
    authorizationUrl: checkout.authorizationUrl,
    accessCode: checkout.accessCode,
    publicKey: checkout.publicKey,
  };
}

/** After Paystack capture (webhook), advance QUOTED → CONFIRMED/SCHEDULED once. */
export async function completeQuotedJobAfterCapture(input: {
  jobId: string;
  paymentId: string;
  correlationId?: string;
}) {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, input.jobId) });
  if (!job || job.state !== "QUOTED") return { completed: false as const };
  if (!job.activeQuoteId) return { completed: false as const };

  const quote = await db.query.quotes.findFirst({
    where: eq(quotes.id, job.activeQuoteId),
  });
  if (!quote) return { completed: false as const };

  const target = job.scheduledFor ? "SCHEDULED" : "CONFIRMED";
  const [updated] = await db
    .update(jobs)
    .set({
      state: target,
      paymentStatus: "captured",
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.id, job.id), eq(jobs.state, "QUOTED")))
    .returning();

  if (!updated) return { completed: false as const };

  await createPendingEarningForJob({
    jobId: job.id,
    amountCents: quote.totalCents,
    currency: quote.currency,
    correlationId: input.correlationId,
  });

  await writeAuditEvent({
    actorType: "system",
    action: "JOB_CONFIRMED",
    subjectType: "job",
    subjectId: job.id,
    correlationId: input.correlationId,
    payload: {
      from: "QUOTED",
      to: target,
      quoteId: quote.id,
      totalCents: quote.totalCents,
      paymentId: input.paymentId,
      paymentStatus: "captured",
      via: "paystack_webhook",
    },
  });

  return { completed: true as const, job: updated };
}

export async function createPendingEarningForJob(input: {
  jobId: string;
  amountCents: number;
  currency: string;
  correlationId?: string;
}) {
  const existing = await db.query.earningLines.findFirst({
    where: eq(earningLines.jobId, input.jobId),
  });
  if (existing) return existing;

  const share = await resolveDriverShare();
  const driverAmount = Math.round(input.amountCents * share);
  const [line] = await db
    .insert(earningLines)
    .values({
      jobId: input.jobId,
      amountCents: driverAmount,
      currency: input.currency,
      status: "pending",
      frozen: false,
    })
    .returning();

  await writeAuditEvent({
    actorType: "system",
    action: "EARNING_LINE_CREATED",
    subjectType: "earning_line",
    subjectId: line.id,
    correlationId: input.correlationId,
    payload: {
      jobId: input.jobId,
      amountCents: driverAmount,
      driverShare: share,
    },
  });

  return line;
}

export async function refundPayment(input: {
  jobId: string;
  amountCents?: number;
  reasonCode: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const payment = await db.query.payments.findFirst({
    where: and(eq(payments.jobId, input.jobId), eq(payments.status, "captured")),
  });
  if (!payment?.providerPaymentId) throw new Error("payment_not_found");

  const amount = input.amountCents ?? payment.amountCents;
  if (amount <= 0 || amount > payment.amountCents) {
    throw new Error("invalid_refund_amount");
  }

  const provider = getPaymentProvider();
  const result = await provider.refund({
    providerPaymentId: payment.providerPaymentId,
    amountCents: amount,
    reasonCode: input.reasonCode,
    idempotencyKey: `refund:${payment.id}:${amount}:${input.reasonCode}`,
  });
  if (result.status !== "succeeded") {
    throw new Error(result.failureCode ?? "refund_failed");
  }

  const [adjustment] = await db
    .insert(adjustments)
    .values({
      jobId: input.jobId,
      paymentId: payment.id,
      type: "refund",
      amountCents: amount,
      currency: payment.currency,
      reasonCode: input.reasonCode,
      createdByUserId: input.actorUserId,
      providerRefundId: result.providerRefundId,
      status: "posted",
    })
    .returning();

  await db
    .update(payments)
    .set({
      status: amount === payment.amountCents ? "refunded" : "partially_refunded",
      updatedAt: new Date(),
    })
    .where(eq(payments.id, payment.id));

  await db
    .update(jobs)
    .set({
      paymentStatus:
        amount === payment.amountCents ? "refunded" : "partially_refunded",
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, input.jobId));

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "PAYMENT_REFUNDED",
    subjectType: "payment",
    subjectId: payment.id,
    correlationId: input.correlationId,
    reasonCode: input.reasonCode,
    payload: { amountCents: amount, adjustmentId: adjustment.id },
  });

  return { paymentId: payment.id, adjustment };
}

export async function freezeEarningsForJob(input: {
  jobId: string;
  reason: string;
  actorUserId: string;
  correlationId?: string;
}) {
  await db
    .update(earningLines)
    .set({ frozen: true, freezeReason: input.reason })
    .where(eq(earningLines.jobId, input.jobId));

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "EARNINGS_FROZEN",
    subjectType: "job",
    subjectId: input.jobId,
    correlationId: input.correlationId,
    reasonCode: input.reason,
  });
}

/**
 * Clear auto incident freezes only (manual finance freezes stay).
 * Used when the last active INCIDENT_HOLD on a job is released.
 */
export async function unfreezeAutoIncidentEarningsForJob(input: {
  jobId: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const lines = await db
    .select()
    .from(earningLines)
    .where(
      and(eq(earningLines.jobId, input.jobId), eq(earningLines.frozen, true)),
    );

  const autoIds = lines
    .filter((l) => isAutoIncidentFreezeReason(l.freezeReason))
    .map((l) => l.id);
  if (autoIds.length === 0) return { released: 0 };

  await db
    .update(earningLines)
    .set({ frozen: false, freezeReason: null })
    .where(inArray(earningLines.id, autoIds));

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "EARNINGS_UNFROZEN",
    subjectType: "job",
    subjectId: input.jobId,
    correlationId: input.correlationId,
    reasonCode: "incident_hold_released",
    payload: { lineCount: autoIds.length },
  });

  return { released: autoIds.length };
}

/** Called from dispatch placeHold when holdType is INCIDENT_HOLD. */
export async function freezeEarningsForIncidentHold(input: {
  jobId: string;
  reasonCode: string;
  actorUserId: string;
  correlationId?: string;
}) {
  await freezeEarningsForJob({
    jobId: input.jobId,
    reason: incidentFreezeReason(input.reasonCode),
    actorUserId: input.actorUserId,
    correlationId: input.correlationId,
  });
}

export async function processWebhook(input: {
  provider: string;
  rawBody: unknown;
  headers: Record<string, string | string[] | undefined>;
  correlationId?: string;
}) {
  const provider = getPaymentProvider();
  if (input.provider !== provider.name) {
    throw new Error("provider_mismatch");
  }

  const event = provider.parseWebhook(input.rawBody, input.headers);

  const inserted = await db
    .insert(paymentWebhookEvents)
    .values({
      provider: provider.name,
      providerEventId: event.providerEventId,
      eventType: event.eventType,
      payload: event.payload,
    })
    .onConflictDoNothing()
    .returning();

  if (inserted.length === 0) {
    return { duplicate: true, eventId: event.providerEventId };
  }

  if (event.providerPaymentId && event.status) {
    const payment = await db.query.payments.findFirst({
      where: and(
        eq(payments.provider, provider.name),
        eq(payments.providerPaymentId, event.providerPaymentId),
      ),
    });
    if (payment) {
      await db
        .update(payments)
        .set({ status: event.status, updatedAt: new Date() })
        .where(eq(payments.id, payment.id));
      if (event.status === "captured") {
        await db
          .update(jobs)
          .set({ paymentStatus: "captured", updatedAt: new Date() })
          .where(eq(jobs.id, payment.jobId));
        await completeQuotedJobAfterCapture({
          jobId: payment.jobId,
          paymentId: payment.id,
          correlationId: input.correlationId,
        });
      }
    }
  }

  await db
    .update(paymentWebhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(paymentWebhookEvents.id, inserted[0].id));

  await writeAuditEvent({
    actorType: "system",
    action: "PAYMENT_WEBHOOK_PROCESSED",
    subjectType: "payment_webhook_event",
    subjectId: inserted[0].id,
    correlationId: input.correlationId,
    payload: { eventType: event.eventType, providerEventId: event.providerEventId },
  });

  return { duplicate: false, eventId: event.providerEventId };
}

async function resolvePayoutRecipientCode(
  driverUserId: string,
): Promise<string> {
  const profile = await db.query.driverProfiles.findFirst({
    where: eq(driverProfiles.userId, driverUserId),
  });
  if (profile?.payoutRecipientCode?.trim()) {
    return profile.payoutRecipientCode.trim();
  }
  if (env.PSP_PROVIDER === "paystack") {
    const fallback = env.PAYSTACK_DEFAULT_TRANSFER_RECIPIENT?.trim() ?? "";
    if (fallback) return fallback;
    throw new Error("recipient_required");
  }
  return `rcp_dev_${driverUserId.replace(/-/g, "").slice(0, 12)}`;
}

/**
 * Release earnings from a failed/blocked payout item so they can be re-batched.
 * Frozen lines stay pending+frozen (still excluded from createPayoutBatch).
 */
async function releaseEarningLinesFromItem(itemId: string) {
  await db
    .update(earningLines)
    .set({ status: "pending", payoutItemId: null })
    .where(eq(earningLines.payoutItemId, itemId));
}

export async function createPayoutBatch(input: {
  actorUserId: string;
  driverUserId: string;
  correlationId?: string;
}) {
  // Never include frozen=true (or already-batched) earnings.
  const lines = await db
    .select()
    .from(earningLines)
    .where(
      and(
        eq(earningLines.driverUserId, input.driverUserId),
        eq(earningLines.status, "pending"),
        eq(earningLines.frozen, false),
        isNull(earningLines.payoutItemId),
      ),
    );

  if (lines.length === 0) throw new Error("no_payable_earnings");

  const total = lines.reduce((s, l) => s + l.amountCents, 0);
  const [batch] = await db
    .insert(payoutBatches)
    .values({
      status: "open",
      currency: lines[0].currency,
      totalCents: total,
      createdByUserId: input.actorUserId,
    })
    .returning();

  const [item] = await db
    .insert(payoutItems)
    .values({
      batchId: batch.id,
      driverUserId: input.driverUserId,
      amountCents: total,
      currency: lines[0].currency,
      status: "pending",
    })
    .returning();

  await db
    .update(earningLines)
    .set({ status: "included", payoutItemId: item.id })
    .where(
      inArray(
        earningLines.id,
        lines.map((l) => l.id),
      ),
    );

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "PAYOUT_BATCH_CREATED",
    subjectType: "payout_batch",
    subjectId: batch.id,
    correlationId: input.correlationId,
    payload: { totalCents: total, driverUserId: input.driverUserId },
  });

  return { batch, item, lineCount: lines.length };
}

/**
 * Execute via PayoutProvider. Item statuses: pending → processing → paid | failed.
 * Failed/processing items do not mark earnings paid.
 * Retries: no auto-retry — finance re-creates a batch after failed items release lines.
 */
export async function executePayoutBatch(input: {
  batchId: string;
  actorUserId: string;
  correlationId?: string;
}) {
  const batch = await db.query.payoutBatches.findFirst({
    where: eq(payoutBatches.id, input.batchId),
  });
  if (!batch) throw new Error("batch_not_found");
  if (batch.status !== "open" && batch.status !== "processing") {
    throw new Error("batch_not_open");
  }

  const items = await db
    .select()
    .from(payoutItems)
    .where(
      and(
        eq(payoutItems.batchId, batch.id),
        inArray(payoutItems.status, ["pending", "processing", "failed"]),
      ),
    );

  if (items.length === 0) throw new Error("no_payout_items");

  await db
    .update(payoutBatches)
    .set({ status: "processing" })
    .where(eq(payoutBatches.id, batch.id));

  const provider = getPayoutProvider();
  let paidCount = 0;
  let failedCount = 0;
  let processingCount = 0;

  for (const item of items) {
    if (item.status === "paid") {
      paidCount += 1;
      continue;
    }

    const linked = await db
      .select()
      .from(earningLines)
      .where(eq(earningLines.payoutItemId, item.id));

    const frozenLinked = linked.filter((l) => l.frozen);
    if (frozenLinked.length > 0) {
      await db
        .update(payoutItems)
        .set({
          status: "failed",
          failureCode: "earnings_frozen",
          providerTransferId: item.providerTransferId,
        })
        .where(eq(payoutItems.id, item.id));
      await releaseEarningLinesFromItem(item.id);
      failedCount += 1;
      continue;
    }

    await db
      .update(payoutItems)
      .set({ status: "processing", failureCode: null })
      .where(eq(payoutItems.id, item.id));

    let recipientCode: string;
    try {
      recipientCode = await resolvePayoutRecipientCode(item.driverUserId);
    } catch (err) {
      const code = err instanceof Error ? err.message : "recipient_required";
      await db
        .update(payoutItems)
        .set({ status: "failed", failureCode: code })
        .where(eq(payoutItems.id, item.id));
      await releaseEarningLinesFromItem(item.id);
      failedCount += 1;
      continue;
    }

    const result = await provider.createTransfer({
      amountCents: item.amountCents,
      currency: item.currency,
      driverUserId: item.driverUserId,
      recipientCode,
      idempotencyKey: `payout:${item.id}`,
      reason: `VUUSH payout batch ${batch.id}`,
    });

    await db
      .update(payoutItems)
      .set({
        status: result.status,
        providerTransferId: result.providerTransferId,
        failureCode: result.failureCode ?? null,
      })
      .where(eq(payoutItems.id, item.id));

    if (result.status === "paid") {
      await db
        .update(earningLines)
        .set({ status: "paid" })
        .where(eq(earningLines.payoutItemId, item.id));
      paidCount += 1;
    } else if (result.status === "failed") {
      await releaseEarningLinesFromItem(item.id);
      failedCount += 1;
    } else {
      processingCount += 1;
    }
  }

  const batchStatus =
    processingCount > 0
      ? "processing"
      : failedCount > 0 && paidCount === 0
        ? "failed"
        : failedCount > 0
          ? "partial"
          : "executed";

  const [updated] = await db
    .update(payoutBatches)
    .set({
      status: batchStatus,
      executedAt:
        batchStatus === "executed" || batchStatus === "partial"
          ? new Date()
          : null,
    })
    .where(eq(payoutBatches.id, batch.id))
    .returning();

  await writeAuditEvent({
    actorType: "user",
    actorId: input.actorUserId,
    action: "PAYOUT_BATCH_EXECUTED",
    subjectType: "payout_batch",
    subjectId: batch.id,
    correlationId: input.correlationId,
    payload: {
      provider: provider.name,
      batchStatus,
      paidCount,
      failedCount,
      processingCount,
    },
  });

  return updated;
}

export async function assignDriverToEarning(input: {
  jobId: string;
  driverUserId: string;
}) {
  await db
    .update(earningLines)
    .set({ driverUserId: input.driverUserId })
    .where(
      and(eq(earningLines.jobId, input.jobId), isNull(earningLines.driverUserId)),
    );
}

export async function listPaymentsForJob(jobId: string) {
  return db.select().from(payments).where(eq(payments.jobId, jobId));
}

/** Staff finance desk — pending / frozen earnings with optional filters. */
export async function listFinanceEarnings(input: {
  driverUserId?: string;
  frozen?: boolean;
  status?: string;
  limit?: number;
}) {
  const limit = Math.min(input.limit ?? 100, 200);
  const conditions = [];
  if (input.driverUserId) {
    conditions.push(eq(earningLines.driverUserId, input.driverUserId));
  }
  if (input.frozen !== undefined) {
    conditions.push(eq(earningLines.frozen, input.frozen));
  }
  if (input.status) {
    conditions.push(eq(earningLines.status, input.status));
  }

  return db
    .select({
      id: earningLines.id,
      jobId: earningLines.jobId,
      jobPublicCode: jobs.publicCode,
      driverUserId: earningLines.driverUserId,
      driverEmail: users.email,
      driverDisplayName: users.displayName,
      amountCents: earningLines.amountCents,
      currency: earningLines.currency,
      status: earningLines.status,
      frozen: earningLines.frozen,
      freezeReason: earningLines.freezeReason,
      payoutItemId: earningLines.payoutItemId,
      createdAt: earningLines.createdAt,
    })
    .from(earningLines)
    .innerJoin(jobs, eq(earningLines.jobId, jobs.id))
    .leftJoin(users, eq(earningLines.driverUserId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(earningLines.createdAt))
    .limit(limit);
}

export async function listPayoutBatches(input?: { limit?: number }) {
  const limit = Math.min(input?.limit ?? 50, 100);
  return db
    .select()
    .from(payoutBatches)
    .orderBy(desc(payoutBatches.createdAt))
    .limit(limit);
}

export async function getPayoutBatchDetail(batchId: string) {
  const batch = await db.query.payoutBatches.findFirst({
    where: eq(payoutBatches.id, batchId),
  });
  if (!batch) throw new Error("batch_not_found");

  const items = await db
    .select({
      id: payoutItems.id,
      batchId: payoutItems.batchId,
      driverUserId: payoutItems.driverUserId,
      driverEmail: users.email,
      driverDisplayName: users.displayName,
      amountCents: payoutItems.amountCents,
      currency: payoutItems.currency,
      status: payoutItems.status,
      providerTransferId: payoutItems.providerTransferId,
      failureCode: payoutItems.failureCode,
      createdAt: payoutItems.createdAt,
    })
    .from(payoutItems)
    .leftJoin(users, eq(payoutItems.driverUserId, users.id))
    .where(eq(payoutItems.batchId, batchId));

  const itemIds = items.map((i) => i.id);
  const earnings =
    itemIds.length === 0
      ? []
      : await db
          .select({
            id: earningLines.id,
            jobId: earningLines.jobId,
            jobPublicCode: jobs.publicCode,
            driverUserId: earningLines.driverUserId,
            driverEmail: users.email,
            driverDisplayName: users.displayName,
            amountCents: earningLines.amountCents,
            currency: earningLines.currency,
            status: earningLines.status,
            frozen: earningLines.frozen,
            freezeReason: earningLines.freezeReason,
            payoutItemId: earningLines.payoutItemId,
            createdAt: earningLines.createdAt,
          })
          .from(earningLines)
          .innerJoin(jobs, eq(earningLines.jobId, jobs.id))
          .leftJoin(users, eq(earningLines.driverUserId, users.id))
          .where(inArray(earningLines.payoutItemId, itemIds));

  return { batch, items, earnings };
}

/** Payments + earnings for a job (id or public code). */
export async function getJobMoney(jobIdOrCode: string) {
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      jobIdOrCode,
    );
  let job = isUuid
    ? await db.query.jobs.findFirst({ where: eq(jobs.id, jobIdOrCode) })
    : await db.query.jobs.findFirst({
        where: eq(jobs.publicCode, jobIdOrCode.trim()),
      });
  if (!job && !isUuid) {
    job = await db.query.jobs.findFirst({
      where: eq(jobs.publicCode, jobIdOrCode.trim().toUpperCase()),
    });
  }
  if (!job) throw new Error("job_not_found");

  const paymentRows = await listPaymentsForJob(job.id);
  const earnings = await db
    .select()
    .from(earningLines)
    .where(eq(earningLines.jobId, job.id));

  return {
    job: {
      id: job.id,
      publicCode: job.publicCode,
      state: job.state,
      paymentStatus: job.paymentStatus,
    },
    payments: paymentRows,
    earnings,
  };
}
