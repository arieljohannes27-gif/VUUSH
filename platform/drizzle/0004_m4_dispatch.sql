ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "active_assignment_id" uuid;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "driver_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"eligibility_status" text DEFAULT 'eligible' NOT NULL,
	"vehicle_class" text DEFAULT 'car' NOT NULL,
	"home_zone_code" text,
	"on_duty" boolean DEFAULT false NOT NULL,
	"on_duty_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "driver_profiles_user_uidx" ON "driver_profiles" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_profiles_duty_idx" ON "driver_profiles" USING btree ("on_duty","eligibility_status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"hold_type" text NOT NULL,
	"reason_code" text NOT NULL,
	"reason_note" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_user_id" uuid,
	"released_at" timestamp with time zone,
	"released_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_holds" ADD CONSTRAINT "job_holds_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "job_holds" ADD CONSTRAINT "job_holds_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "job_holds" ADD CONSTRAINT "job_holds_released_by_user_id_users_id_fk" FOREIGN KEY ("released_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_holds_job_active_idx" ON "job_holds" USING btree ("job_id","active");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"driver_user_id" uuid NOT NULL,
	"status" text NOT NULL,
	"mode" text NOT NULL,
	"reason_code" text,
	"previous_assignment_id" uuid,
	"custody_handoff_required" boolean DEFAULT false NOT NULL,
	"offered_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_driver_user_id_users_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assignments_idempotency_uidx" ON "assignments" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignments_job_idx" ON "assignments" USING btree ("job_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignments_driver_idx" ON "assignments" USING btree ("driver_user_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assignments_one_open_per_job_uidx" ON "assignments" ("job_id") WHERE "status" IN ('offered', 'active');
