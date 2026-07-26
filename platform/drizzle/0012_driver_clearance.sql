-- Driver clearance: password login + application status
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;

ALTER TABLE "driver_profiles"
  ADD COLUMN IF NOT EXISTS "application_status" text NOT NULL DEFAULT 'approved';
ALTER TABLE "driver_profiles"
  ADD COLUMN IF NOT EXISTS "licence_ref" text;
ALTER TABLE "driver_profiles"
  ADD COLUMN IF NOT EXISTS "insurance_ref" text;
ALTER TABLE "driver_profiles"
  ADD COLUMN IF NOT EXISTS "permit_ref" text;
ALTER TABLE "driver_profiles"
  ADD COLUMN IF NOT EXISTS "application_note" text;
ALTER TABLE "driver_profiles"
  ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone;
ALTER TABLE "driver_profiles"
  ADD COLUMN IF NOT EXISTS "reviewed_by_user_id" uuid;
ALTER TABLE "driver_profiles"
  ADD COLUMN IF NOT EXISTS "review_reason" text;

-- Existing dogfood drivers stay approved + eligible
UPDATE "driver_profiles"
SET "application_status" = 'approved'
WHERE "eligibility_status" = 'eligible';
