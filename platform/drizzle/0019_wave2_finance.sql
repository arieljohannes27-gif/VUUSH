-- Wave 2 Finance — reconcile, credit notes, adjustment queue, audit packs

CREATE TABLE IF NOT EXISTS "finance_reconcile_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source" text NOT NULL,
  "external_ref" text,
  "job_id" uuid REFERENCES "jobs"("id"),
  "payment_id" uuid REFERENCES "payments"("id"),
  "amount_cents" integer NOT NULL,
  "currency" text DEFAULT 'ZAR' NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "notes" text,
  "created_by_user_id" uuid REFERENCES "users"("id"),
  "resolved_by_user_id" uuid REFERENCES "users"("id"),
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finance_reconcile_status_idx"
  ON "finance_reconcile_items" ("status", "created_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "credit_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid REFERENCES "organisations"("id"),
  "job_id" uuid REFERENCES "jobs"("id"),
  "statement_id" uuid REFERENCES "org_invoices"("id"),
  "amount_cents" integer NOT NULL,
  "currency" text DEFAULT 'ZAR' NOT NULL,
  "reason_code" text NOT NULL,
  "notes" text,
  "created_by_user_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_notes_org_idx"
  ON "credit_notes" ("org_id", "created_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "adjustment_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "jobs"("id"),
  "case_id" uuid,
  "amount_cents" integer NOT NULL,
  "currency" text DEFAULT 'ZAR' NOT NULL,
  "reason_code" text NOT NULL,
  "status" text DEFAULT 'pending_finance' NOT NULL,
  "requested_by_user_id" uuid REFERENCES "users"("id"),
  "resolved_by_user_id" uuid REFERENCES "users"("id"),
  "resolution_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "adjustment_requests_status_idx"
  ON "adjustment_requests" ("status", "created_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "audit_packs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "requested_by_user_id" uuid REFERENCES "users"("id"),
  "org_id" uuid REFERENCES "organisations"("id"),
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'ready' NOT NULL,
  "manifest_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_packs_created_idx"
  ON "audit_packs" ("created_at");
