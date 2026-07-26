import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * PR25 audit spine (Phase 6 DB-D2).
 * Append-only by convention — application must not UPDATE/DELETE rows.
 */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id"),
    reasonCode: text("reason_code"),
    correlationId: text("correlation_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_events_subject_idx").on(
      table.subjectType,
      table.subjectId,
      table.occurredAt,
    ),
    index("audit_events_actor_idx").on(table.actorId, table.occurredAt),
    index("audit_events_action_idx").on(table.action, table.occurredAt),
  ],
);

export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;

/** Canonical Phase 3 roles (string-enforced in app). */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phone: text("phone"),
    email: text("email"),
    displayName: text("display_name"),
    status: text("status").notNull().default("active"),
    /** scrypt hash for driver password login (null = OTP-only / legacy). */
    passwordHash: text("password_hash"),
    totpSecret: text("totp_secret"),
    totpEnabled: boolean("totp_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("users_phone_uidx").on(table.phone),
    uniqueIndex("users_email_uidx").on(table.email),
  ],
);

export const otpChallenges = pgTable(
  "otp_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    channel: text("channel").notNull(),
    destination: text("destination").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("otp_challenges_destination_idx").on(
      table.destination,
      table.createdAt,
    ),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    accessTokenHash: text("access_token_hash").notNull(),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    mfaSatisfied: boolean("mfa_satisfied").notNull().default(false),
    deviceLabel: text("device_label"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    refreshExpiresAt: timestamp("refresh_expires_at", {
      withTimezone: true,
    }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("sessions_access_hash_uidx").on(table.accessTokenHash),
    uniqueIndex("sessions_refresh_hash_uidx").on(table.refreshTokenHash),
    index("sessions_user_idx").on(table.userId),
  ],
);

export const roleBindings = pgTable(
  "role_bindings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull(),
    scopeType: text("scope_type").notNull().default("platform"),
    scopeId: text("scope_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("role_bindings_user_idx").on(table.userId),
    uniqueIndex("role_bindings_unique_uidx").on(
      table.userId,
      table.role,
      table.scopeType,
      table.scopeId,
    ),
  ],
);

export const mfaTickets = pgTable("mfa_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  purpose: text("purpose").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Minimal catalogue until M8b Admin. */
export const serviceTypes = pgTable(
  "service_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    baseFeeCents: integer("base_fee_cents").notNull(),
    perKmFeeCents: integer("per_km_fee_cents").notNull(),
    priorityMultiplier: doublePrecision("priority_multiplier")
      .notNull()
      .default(1),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("service_types_code_uidx").on(table.code)],
);

export const zones = pgTable(
  "zones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("zones_code_uidx").on(table.code)],
);

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").notNull(),
    currency: text("currency").notNull().default("ZAR"),
    totalCents: integer("total_cents").notNull(),
    components: jsonb("components")
      .$type<Record<string, number>>()
      .notNull(),
    distanceKm: doublePrecision("distance_km").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("quotes_job_idx").on(table.jobId)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicCode: text("public_code").notNull(),
    shipperUserId: uuid("shipper_user_id")
      .notNull()
      .references(() => users.id),
    orgId: uuid("org_id"),
    state: text("state").notNull().default("DRAFT"),
    serviceTypeCode: text("service_type_code").notNull(),
    packageClass: text("package_class").notNull().default("small"),
    pickupAddress: text("pickup_address").notNull(),
    pickupZoneCode: text("pickup_zone_code").notNull(),
    pickupLat: doublePrecision("pickup_lat"),
    pickupLng: doublePrecision("pickup_lng"),
    dropoffAddress: text("dropoff_address").notNull(),
    dropoffZoneCode: text("dropoff_zone_code").notNull(),
    dropoffLat: doublePrecision("dropoff_lat"),
    dropoffLng: doublePrecision("dropoff_lng"),
    pickupContactName: text("pickup_contact_name"),
    pickupContactPhone: text("pickup_contact_phone"),
    recipientName: text("recipient_name"),
    recipientPhone: text("recipient_phone"),
    notes: text("notes"),
    prohibitedGoodsDeclared: boolean("prohibited_goods_declared")
      .notNull()
      .default(false),
    containsProhibitedGoods: boolean("contains_prohibited_goods")
      .notNull()
      .default(false),
    activeQuoteId: uuid("active_quote_id"),
    paymentStatus: text("payment_status").notNull().default("not_required"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    activeAssignmentId: uuid("active_assignment_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("jobs_public_code_uidx").on(table.publicCode),
    index("jobs_shipper_idx").on(table.shipperUserId, table.createdAt),
    index("jobs_state_idx").on(table.state, table.updatedAt),
  ],
);

/** M4 — supply + assignment spine (PR05 / PR18). */
export const driverProfiles = pgTable(
  "driver_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    eligibilityStatus: text("eligibility_status").notNull().default("pending"),
    /**
     * draft | pending_review | needs_more_info | approved | rejected | suspended
     * Duty/offers require approved (+ eligibility eligible).
     */
    applicationStatus: text("application_status").notNull().default("pending_review"),
    vehicleClass: text("vehicle_class").notNull().default("car"),
    homeZoneCode: text("home_zone_code"),
    onDuty: boolean("on_duty").notNull().default(false),
    onDutyAt: timestamp("on_duty_at", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    publicName: text("public_name"),
    photoUrl: text("photo_url"),
    phonePublic: text("phone_public"),
    vehiclePlate: text("vehicle_plate"),
    vehicleLabel: text("vehicle_label"),
    /** Live camera capture at signup (beachhead: data URL). */
    vehiclePhotoUrl: text("vehicle_photo_url"),
    /** ID document — PDF or clear photo (data URL beachhead). */
    idDocUrl: text("id_doc_url"),
    /** Driver licence — PDF or clear photo. */
    licenceDocUrl: text("licence_doc_url"),
    /** Live selfie only (camera). */
    selfiePhotoUrl: text("selfie_photo_url"),
    /** Vehicle insurance document. */
    vehicleInsuranceDocUrl: text("vehicle_insurance_doc_url"),
    /** Goods-in-transit / cargo cover proof (beachhead: ≥ R100 000). */
    goodsInsuranceDocUrl: text("goods_insurance_doc_url"),
    /** Police clearance — PDF or clear photo. */
    policeClearanceDocUrl: text("police_clearance_doc_url"),
    bio: text("bio"),
    licenceStatus: text("licence_status").notNull().default("pending"),
    vehicleDocStatus: text("vehicle_doc_status").notNull().default("pending"),
    insuranceStatus: text("insurance_status").notNull().default("pending"),
    licenceRef: text("licence_ref"),
    insuranceRef: text("insurance_ref"),
    permitRef: text("permit_ref"),
    applicationNote: text("application_note"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: uuid("reviewed_by_user_id"),
    reviewReason: text("review_reason"),
    /** Paystack transfer recipient code (RCP_…) — never raw bank PANs. */
    payoutRecipientCode: text("payout_recipient_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("driver_profiles_user_uidx").on(table.userId),
    index("driver_profiles_duty_idx").on(table.onDuty, table.eligibilityStatus),
  ],
);

export const jobHolds = pgTable(
  "job_holds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    holdType: text("hold_type").notNull(),
    reasonCode: text("reason_code").notNull(),
    reasonNote: text("reason_note"),
    active: boolean("active").notNull().default(true),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releasedByUserId: uuid("released_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("job_holds_job_active_idx").on(table.jobId, table.active),
  ],
);

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    driverUserId: uuid("driver_user_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull(),
    mode: text("mode").notNull(),
    reasonCode: text("reason_code"),
    previousAssignmentId: uuid("previous_assignment_id"),
    custodyHandoffRequired: boolean("custody_handoff_required")
      .notNull()
      .default(false),
    offeredAt: timestamp("offered_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("assignments_idempotency_uidx").on(table.idempotencyKey),
    index("assignments_job_idx").on(table.jobId, table.status),
    index("assignments_driver_idx").on(table.driverUserId, table.status),
  ],
);

/** M8 — money spine. Never store card PAN/CVV. */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    payerUserId: uuid("payer_user_id")
      .notNull()
      .references(() => users.id),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("ZAR"),
    status: text("status").notNull(),
    provider: text("provider").notNull(),
    providerPaymentId: text("provider_payment_id"),
    providerMethodRef: text("provider_method_ref"),
    failureCode: text("failure_code"),
    idempotencyKey: text("idempotency_key").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("payments_idempotency_uidx").on(table.idempotencyKey),
    uniqueIndex("payments_provider_payment_uidx").on(
      table.provider,
      table.providerPaymentId,
    ),
    index("payments_job_idx").on(table.jobId),
  ],
);

export const paymentWebhookEvents = pgTable(
  "payment_webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("payment_webhook_provider_event_uidx").on(
      table.provider,
      table.providerEventId,
    ),
  ],
);

export const adjustments = pgTable(
  "adjustments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").references(() => jobs.id),
    paymentId: uuid("payment_id").references(() => payments.id),
    type: text("type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("ZAR"),
    reasonCode: text("reason_code").notNull(),
    status: text("status").notNull().default("posted"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    providerRefundId: text("provider_refund_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("adjustments_job_idx").on(table.jobId)],
);

export const earningLines = pgTable(
  "earning_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    driverUserId: uuid("driver_user_id").references(() => users.id),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("ZAR"),
    status: text("status").notNull().default("pending"),
    frozen: boolean("frozen").notNull().default(false),
    freezeReason: text("freeze_reason"),
    payoutItemId: uuid("payout_item_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("earning_lines_job_idx").on(table.jobId),
    index("earning_lines_driver_idx").on(table.driverUserId, table.status),
  ],
);

export const payoutBatches = pgTable("payout_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  status: text("status").notNull().default("open"),
  currency: text("currency").notNull().default("ZAR"),
  totalCents: integer("total_cents").notNull().default(0),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const payoutItems = pgTable(
  "payout_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => payoutBatches.id),
    driverUserId: uuid("driver_user_id")
      .notNull()
      .references(() => users.id),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("ZAR"),
    status: text("status").notNull().default("pending"),
    providerTransferId: text("provider_transfer_id"),
    failureCode: text("failure_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("payout_items_batch_idx").on(table.batchId)],
);

/** M5 — tracking spine (PR23). Append-only signals; session holds integrity. */
export const trackingSessions = pgTable(
  "tracking_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    driverUserId: uuid("driver_user_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().default("streaming"),
    integrityClass: text("integrity_class").notNull().default("fresh"),
    lastLat: doublePrecision("last_lat"),
    lastLng: doublePrecision("last_lng"),
    lastKnownLat: doublePrecision("last_known_lat"),
    lastKnownLng: doublePrecision("last_known_lng"),
    lastSignalAt: timestamp("last_signal_at", { withTimezone: true }),
    lastKnownAt: timestamp("last_known_at", { withTimezone: true }),
    lostAt: timestamp("lost_at", { withTimezone: true }),
    conflictReason: text("conflict_reason"),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("tracking_sessions_job_idx").on(table.jobId, table.status),
    index("tracking_sessions_driver_idx").on(table.driverUserId, table.status),
  ],
);

export const trackingSignals = pgTable(
  "tracking_signals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => trackingSessions.id),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    accuracyM: doublePrecision("accuracy_m"),
    speedMps: doublePrecision("speed_mps"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    rejected: boolean("rejected").notNull().default(false),
    rejectReason: text("reject_reason"),
  },
  (table) => [
    index("tracking_signals_session_time_idx").on(
      table.sessionId,
      table.recordedAt,
    ),
  ],
);

export const trackingLostTasks = pgTable(
  "tracking_lost_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => trackingSessions.id),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ackedAt: timestamp("acked_at", { withTimezone: true }),
    ackedByUserId: uuid("acked_by_user_id").references(() => users.id),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    index("tracking_lost_tasks_status_idx").on(table.status, table.createdAt),
  ],
);

/** M6a — proof artefacts (PR08). Object refs only — never public URLs. */
export const proofArtefacts = pgTable(
  "proof_artefacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    kind: text("kind").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type"),
    note: text("note"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("proof_artefacts_job_idx").on(table.jobId, table.kind),
  ],
);

/** M8a — Support Centre cases + thread. */
export const supportCases = pgTable(
  "support_cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicCode: text("public_code").notNull(),
    openedByUserId: uuid("opened_by_user_id")
      .notNull()
      .references(() => users.id),
    jobId: uuid("job_id").references(() => jobs.id),
    subject: text("subject").notNull(),
    status: text("status").notNull().default("open"),
    channel: text("channel").notNull().default("customer"),
    priority: text("priority").notNull().default("normal"),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id),
    claimOpened: boolean("claim_opened").notNull().default(false),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("support_cases_public_code_uidx").on(table.publicCode),
    index("support_cases_status_idx").on(table.status, table.createdAt),
    index("support_cases_opener_idx").on(table.openedByUserId, table.createdAt),
    index("support_cases_job_idx").on(table.jobId),
  ],
);

export const supportMessages = pgTable(
  "support_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => supportCases.id),
    authorUserId: uuid("author_user_id").references(() => users.id),
    authorKind: text("author_kind").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("support_messages_case_idx").on(table.caseId, table.createdAt),
  ],
);

/** M8b — Admin catalogue & controls */
export const featureFlags = pgTable(
  "feature_flags",
  {
    key: text("key").primaryKey(),
    enabled: boolean("enabled").notNull().default(false),
    value: text("value"),
    description: text("description"),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

export const reasonCodes = pgTable(
  "reason_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    domain: text("domain").notNull(),
    label: text("label").notNull(),
    active: boolean("active").notNull().default(true),
    severity: text("severity").notNull().default("ops"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("reason_codes_code_uidx").on(table.code)],
);

export const pricingParams = pgTable(
  "pricing_params",
  {
    key: text("key").primaryKey(),
    valueJson: jsonb("value_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    description: text("description"),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

export const prohibitedGoods = pgTable(
  "prohibited_goods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    label: text("label").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

export const breakGlassSessions = pgTable(
  "break_glass_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("break_glass_user_idx").on(table.userId, table.createdAt),
  ],
);

/** M8c — Incidents & Emergency */
export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicCode: text("public_code").notNull(),
    category: text("category").notNull(),
    severity: text("severity").notNull(),
    status: text("status").notNull().default("open"),
    playbook: text("playbook").notNull(),
    driverUserId: uuid("driver_user_id")
      .notNull()
      .references(() => users.id),
    jobId: uuid("job_id").references(() => jobs.id),
    holdId: uuid("hold_id").references(() => jobHolds.id),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    note: text("note"),
    securityRestricted: boolean("security_restricted").notNull().default(false),
    doNotNormalReturn: boolean("do_not_normal_return").notNull().default(false),
    nonPunitive: boolean("non_punitive").notNull().default(false),
    acknowledgedByUserId: uuid("acknowledged_by_user_id").references(() => users.id),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionCode: text("resolution_code"),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("incidents_public_code_uidx").on(table.publicCode),
    index("incidents_status_idx").on(table.status, table.createdAt),
    index("incidents_driver_idx").on(table.driverUserId, table.createdAt),
    index("incidents_job_idx").on(table.jobId),
  ],
);

export const incidentEvents = pgTable(
  "incident_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id),
    kind: text("kind").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("incident_events_incident_idx").on(table.incidentId, table.createdAt),
  ],
);

export const incidentNotifications = pgTable(
  "incident_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id),
    channel: text("channel").notNull(),
    audience: text("audience").notNull(),
    status: text("status").notNull().default("queued"),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    index("incident_notifications_incident_idx").on(
      table.incidentId,
      table.createdAt,
    ),
  ],
);
