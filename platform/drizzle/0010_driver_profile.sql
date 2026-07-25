ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "public_name" text;
ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "photo_url" text;
ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "phone_public" text;
ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "vehicle_plate" text;
ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "vehicle_label" text;
ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "bio" text;
ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "licence_status" text DEFAULT 'pending' NOT NULL;
ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "vehicle_doc_status" text DEFAULT 'pending' NOT NULL;
ALTER TABLE "driver_profiles" ADD COLUMN IF NOT EXISTS "insurance_status" text DEFAULT 'pending' NOT NULL;

-- Beachhead seed for Dave
UPDATE driver_profiles d
SET
  public_name = 'Dave',
  phone_public = '+27 82 000 1001',
  vehicle_plate = 'CA 458-291',
  vehicle_label = 'White Toyota Quantum',
  bio = 'Cape Town courier · careful with parcels · on-time focused.',
  licence_status = 'verified',
  vehicle_doc_status = 'verified',
  insurance_status = 'verified',
  updated_at = now()
FROM users u
WHERE d.user_id = u.id AND u.email = 'driver1-m4@swift.local';

UPDATE driver_profiles d
SET
  public_name = 'Tom',
  phone_public = '+27 82 000 1002',
  vehicle_plate = 'CA 912-044',
  vehicle_label = 'Silver Nissan NV200',
  bio = 'Atlantic Seaboard regular.',
  licence_status = 'verified',
  vehicle_doc_status = 'pending',
  insurance_status = 'verified',
  updated_at = now()
FROM users u
WHERE d.user_id = u.id AND u.email = 'driver2-m4@swift.local';
