-- Full clearance pack: ID, licence file, live selfie, vehicle + goods insurance
ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "id_doc_url" text;
ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "licence_doc_url" text;
ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "selfie_photo_url" text;
ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "vehicle_insurance_doc_url" text;
ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "goods_insurance_doc_url" text;
