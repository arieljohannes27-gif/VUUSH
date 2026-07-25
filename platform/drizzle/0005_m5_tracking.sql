CREATE TABLE IF NOT EXISTS "tracking_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"driver_user_id" uuid NOT NULL,
	"status" text DEFAULT 'streaming' NOT NULL,
	"integrity_class" text DEFAULT 'fresh' NOT NULL,
	"last_lat" double precision,
	"last_lng" double precision,
	"last_known_lat" double precision,
	"last_known_lng" double precision,
	"last_signal_at" timestamp with time zone,
	"last_known_at" timestamp with time zone,
	"lost_at" timestamp with time zone,
	"conflict_reason" text,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracking_sessions" ADD CONSTRAINT "tracking_sessions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tracking_sessions" ADD CONSTRAINT "tracking_sessions_driver_user_id_users_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tracking_sessions_job_idx" ON "tracking_sessions" USING btree ("job_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tracking_sessions_driver_idx" ON "tracking_sessions" USING btree ("driver_user_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tracking_sessions_one_open_per_job_uidx" ON "tracking_sessions" ("job_id") WHERE "status" IN ('streaming','degraded','lost','conflicted');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tracking_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"accuracy_m" double precision,
	"speed_mps" double precision,
	"recorded_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rejected" boolean DEFAULT false NOT NULL,
	"reject_reason" text
);
--> statement-breakpoint
ALTER TABLE "tracking_signals" ADD CONSTRAINT "tracking_signals_session_id_tracking_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."tracking_sessions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tracking_signals_session_time_idx" ON "tracking_signals" USING btree ("session_id","recorded_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tracking_lost_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acked_at" timestamp with time zone,
	"acked_by_user_id" uuid,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tracking_lost_tasks" ADD CONSTRAINT "tracking_lost_tasks_session_id_tracking_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."tracking_sessions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tracking_lost_tasks" ADD CONSTRAINT "tracking_lost_tasks_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tracking_lost_tasks" ADD CONSTRAINT "tracking_lost_tasks_acked_by_user_id_users_id_fk" FOREIGN KEY ("acked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tracking_lost_tasks_status_idx" ON "tracking_lost_tasks" USING btree ("status","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tracking_lost_tasks_open_session_uidx" ON "tracking_lost_tasks" ("session_id") WHERE "status" = 'open';
