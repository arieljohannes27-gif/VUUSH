CREATE TABLE IF NOT EXISTS "org_invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organisations"("id"),
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "currency" text DEFAULT 'ZAR' NOT NULL,
  "total_cents" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'issued' NOT NULL,
  "csv_body" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "org_invoices_org_idx" ON "org_invoices" ("org_id", "created_at");

CREATE TABLE IF NOT EXISTS "org_invoice_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL REFERENCES "org_invoices"("id"),
  "job_id" uuid NOT NULL REFERENCES "jobs"("id"),
  "public_code" text NOT NULL,
  "description" text NOT NULL,
  "amount_cents" integer NOT NULL
);
CREATE INDEX IF NOT EXISTS "org_invoice_lines_invoice_idx" ON "org_invoice_lines" ("invoice_id");
CREATE UNIQUE INDEX IF NOT EXISTS "org_invoice_lines_job_uidx" ON "org_invoice_lines" ("job_id");

CREATE TABLE IF NOT EXISTS "org_api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organisations"("id"),
  "name" text NOT NULL,
  "key_prefix" text NOT NULL,
  "key_hash" text NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id"),
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "org_api_keys_org_idx" ON "org_api_keys" ("org_id");
CREATE UNIQUE INDEX IF NOT EXISTS "org_api_keys_prefix_uidx" ON "org_api_keys" ("key_prefix");

CREATE TABLE IF NOT EXISTS "job_stops" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "jobs"("id"),
  "sequence" integer NOT NULL,
  "label" text,
  "address" text NOT NULL,
  "zone_code" text,
  "lat" double precision,
  "lng" double precision,
  "status" text DEFAULT 'pending' NOT NULL,
  "proof_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "job_stops_job_idx" ON "job_stops" ("job_id", "sequence");
CREATE UNIQUE INDEX IF NOT EXISTS "job_stops_job_seq_uidx" ON "job_stops" ("job_id", "sequence");
