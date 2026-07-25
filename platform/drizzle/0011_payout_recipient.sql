-- H2 — driver Paystack transfer recipient + payout item failure reason
ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "payout_recipient_code" text;
ALTER TABLE "payout_items" ADD COLUMN IF NOT EXISTS "failure_code" text;
