CREATE TABLE IF NOT EXISTS "support_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_code" text NOT NULL,
	"opened_by_user_id" uuid NOT NULL,
	"job_id" uuid,
	"subject" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"channel" text DEFAULT 'customer' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"assigned_to_user_id" uuid,
	"claim_opened" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"author_user_id" uuid,
	"author_kind" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_opened_by_user_id_users_id_fk" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_case_id_support_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."support_cases"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "support_cases_public_code_uidx" ON "support_cases" USING btree ("public_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_cases_status_idx" ON "support_cases" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_cases_opener_idx" ON "support_cases" USING btree ("opened_by_user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_cases_job_idx" ON "support_cases" USING btree ("job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_messages_case_idx" ON "support_messages" USING btree ("case_id","created_at");
