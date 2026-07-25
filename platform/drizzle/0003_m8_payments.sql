CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"payer_user_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"status" text NOT NULL,
	"provider" text NOT NULL,
	"provider_payment_id" text,
	"provider_method_ref" text,
	"failure_code" text,
	"idempotency_key" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_user_id_users_id_fk" FOREIGN KEY ("payer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_idempotency_uidx" ON "payments" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_provider_payment_uidx" ON "payments" USING btree ("provider","provider_payment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_job_idx" ON "payments" USING btree ("job_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_webhook_provider_event_uidx" ON "payment_webhook_events" USING btree ("provider","provider_event_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"payment_id" uuid,
	"type" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"reason_code" text NOT NULL,
	"status" text DEFAULT 'posted' NOT NULL,
	"created_by_user_id" uuid,
	"provider_refund_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "adjustments_job_idx" ON "adjustments" USING btree ("job_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "earning_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"driver_user_id" uuid,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"frozen" boolean DEFAULT false NOT NULL,
	"freeze_reason" text,
	"payout_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "earning_lines" ADD CONSTRAINT "earning_lines_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "earning_lines" ADD CONSTRAINT "earning_lines_driver_user_id_users_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "earning_lines_job_idx" ON "earning_lines" USING btree ("job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "earning_lines_driver_idx" ON "earning_lines" USING btree ("driver_user_id","status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payout_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payout_batches" ADD CONSTRAINT "payout_batches_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payout_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"driver_user_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_transfer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_batch_id_payout_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."payout_batches"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payout_items" ADD CONSTRAINT "payout_items_driver_user_id_users_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payout_items_batch_idx" ON "payout_items" USING btree ("batch_id");
