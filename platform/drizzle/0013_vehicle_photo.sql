-- Live vehicle photo captured at driver signup (data URL or object URL later)
ALTER TABLE "driver_profiles"
  ADD COLUMN IF NOT EXISTS "vehicle_photo_url" text;
