CREATE TABLE IF NOT EXISTS "service_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"base_fee_cents" integer NOT NULL,
	"per_km_fee_cents" integer NOT NULL,
	"priority_multiplier" double precision DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "service_types_code_uidx" ON "service_types" USING btree ("code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "zones_code_uidx" ON "zones" USING btree ("code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_code" text NOT NULL,
	"shipper_user_id" uuid NOT NULL,
	"org_id" uuid,
	"state" text DEFAULT 'DRAFT' NOT NULL,
	"service_type_code" text NOT NULL,
	"package_class" text DEFAULT 'small' NOT NULL,
	"pickup_address" text NOT NULL,
	"pickup_zone_code" text NOT NULL,
	"pickup_lat" double precision,
	"pickup_lng" double precision,
	"dropoff_address" text NOT NULL,
	"dropoff_zone_code" text NOT NULL,
	"dropoff_lat" double precision,
	"dropoff_lng" double precision,
	"pickup_contact_name" text,
	"pickup_contact_phone" text,
	"recipient_name" text,
	"recipient_phone" text,
	"notes" text,
	"prohibited_goods_declared" boolean DEFAULT false NOT NULL,
	"contains_prohibited_goods" boolean DEFAULT false NOT NULL,
	"active_quote_id" uuid,
	"payment_status" text DEFAULT 'not_required' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_shipper_user_id_users_id_fk" FOREIGN KEY ("shipper_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "jobs_public_code_uidx" ON "jobs" USING btree ("public_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_shipper_idx" ON "jobs" USING btree ("shipper_user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_state_idx" ON "jobs" USING btree ("state","updated_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"total_cents" integer NOT NULL,
	"components" jsonb NOT NULL,
	"distance_km" double precision NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_job_idx" ON "quotes" USING btree ("job_id");
