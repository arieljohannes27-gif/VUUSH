-- M7b beachhead: keep booker order + record how stops were ordered
ALTER TABLE "job_stops" ADD COLUMN IF NOT EXISTS "booker_sequence" integer;
ALTER TABLE "job_stops" ADD COLUMN IF NOT EXISTS "ordering_mode" text DEFAULT 'booker' NOT NULL;

UPDATE "job_stops"
SET "booker_sequence" = "sequence"
WHERE "booker_sequence" IS NULL;
