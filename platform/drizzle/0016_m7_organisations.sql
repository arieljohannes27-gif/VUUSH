CREATE TABLE IF NOT EXISTS "organisations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "billing_email" text,
  "approval_threshold_cents" integer,
  "pay_mode" text DEFAULT 'statement' NOT NULL,
  "city_code" text DEFAULT 'CPT' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "organisations_name_uidx" ON "organisations" ("name");
CREATE INDEX IF NOT EXISTS "organisations_status_idx" ON "organisations" ("status");

CREATE TABLE IF NOT EXISTS "org_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organisations"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "role" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "org_memberships_org_user_uidx" ON "org_memberships" ("org_id", "user_id");
CREATE INDEX IF NOT EXISTS "org_memberships_user_idx" ON "org_memberships" ("user_id");

CREATE TABLE IF NOT EXISTS "org_sites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organisations"("id"),
  "label" text NOT NULL,
  "address" text NOT NULL,
  "zone_code" text,
  "lat" double precision,
  "lng" double precision,
  "kind" text DEFAULT 'other' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "org_sites_org_idx" ON "org_sites" ("org_id");

CREATE INDEX IF NOT EXISTS "jobs_org_idx" ON "jobs" ("org_id");
