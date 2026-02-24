-- Add Stripe Connect fields to affiliate_profiles
ALTER TABLE "affiliate_profiles"
  ADD COLUMN "stripe_connect_account_id" VARCHAR,
  ADD COLUMN "stripe_connect_country" VARCHAR(2),
  ADD COLUMN "stripe_charges_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stripe_payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stripe_details_submitted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stripe_requirements" JSONB;

-- Add Stripe transfer fields to affiliate_payouts
ALTER TABLE "affiliate_payouts"
  ADD COLUMN "stripe_transfer_id" VARCHAR,
  ADD COLUMN "stripe_transfer_status" VARCHAR(32);

-- Indexes / constraints
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_profiles_stripe_connect_account_id_key"
  ON "affiliate_profiles"("stripe_connect_account_id");

CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_payouts_stripe_transfer_id_key"
  ON "affiliate_payouts"("stripe_transfer_id");
