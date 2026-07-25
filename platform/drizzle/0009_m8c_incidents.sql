CREATE TABLE IF NOT EXISTS "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_code" text NOT NULL,
	"category" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"playbook" text NOT NULL,
	"driver_user_id" uuid NOT NULL,
	"job_id" uuid,
	"hold_id" uuid,
	"lat" double precision,
	"lng" double precision,
	"note" text,
	"security_restricted" boolean DEFAULT false NOT NULL,
	"do_not_normal_return" boolean DEFAULT false NOT NULL,
	"non_punitive" boolean DEFAULT false NOT NULL,
	"acknowledged_by_user_id" uuid,
	"acknowledged_at" timestamp with time zone,
	"resolved_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_code" text,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "incident_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"actor_user_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "incident_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"audience" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_driver_user_id_users_id_fk" FOREIGN KEY ("driver_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_hold_id_job_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."job_holds"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_acknowledged_by_user_id_users_id_fk" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "incident_events" ADD CONSTRAINT "incident_events_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "incident_events" ADD CONSTRAINT "incident_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "incident_notifications" ADD CONSTRAINT "incident_notifications_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "incidents_public_code_uidx" ON "incidents" USING btree ("public_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incidents_status_idx" ON "incidents" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incidents_driver_idx" ON "incidents" USING btree ("driver_user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incidents_job_idx" ON "incidents" USING btree ("job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incident_events_incident_idx" ON "incident_events" USING btree ("incident_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incident_notifications_incident_idx" ON "incident_notifications" USING btree ("incident_id","created_at");
