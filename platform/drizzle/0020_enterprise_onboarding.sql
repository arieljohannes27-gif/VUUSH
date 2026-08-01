ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "registration_number" text;
ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "vat_number" text;
ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "billing_contact_name" text;
ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "company_doc_url" text;
