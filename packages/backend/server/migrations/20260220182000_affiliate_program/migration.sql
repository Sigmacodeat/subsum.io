-- CreateEnum
CREATE TYPE "AffiliateStatus" AS ENUM ('pending', 'active', 'suspended', 'blocked');

-- CreateEnum
CREATE TYPE "AffiliateLedgerStatus" AS ENUM ('pending', 'approved', 'paid', 'reversed');

-- CreateEnum
CREATE TYPE "AffiliatePayoutStatus" AS ENUM ('pending', 'processing', 'paid', 'failed');

-- CreateTable
CREATE TABLE "affiliate_profiles" (
    "user_id" VARCHAR NOT NULL,
    "referral_code" VARCHAR(32) NOT NULL,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'active',
    "parent_affiliate_user_id" VARCHAR,
    "level_one_rate_bps" INTEGER NOT NULL DEFAULT 2000,
    "level_two_rate_bps" INTEGER NOT NULL DEFAULT 500,
    "payout_email" VARCHAR,
    "tax_info" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "affiliate_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "affiliate_referral_attributions" (
    "id" VARCHAR NOT NULL,
    "affiliate_user_id" VARCHAR NOT NULL,
    "referred_user_id" VARCHAR NOT NULL,
    "referral_code" VARCHAR(32) NOT NULL,
    "source" VARCHAR(64),
    "campaign" VARCHAR(128),
    "metadata" JSONB,
    "activated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "affiliate_referral_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_commission_ledger" (
    "id" VARCHAR NOT NULL,
    "affiliate_user_id" VARCHAR NOT NULL,
    "referred_user_id" VARCHAR NOT NULL,
    "invoice_id" TEXT,
    "level" SMALLINT NOT NULL,
    "status" "AffiliateLedgerStatus" NOT NULL DEFAULT 'pending',
    "amount_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "reason" VARCHAR(64),
    "available_at" TIMESTAMPTZ(3) NOT NULL,
    "paid_at" TIMESTAMPTZ(3),
    "reversed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "affiliate_commission_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_payouts" (
    "id" VARCHAR NOT NULL,
    "affiliate_user_id" VARCHAR NOT NULL,
    "status" "AffiliatePayoutStatus" NOT NULL DEFAULT 'pending',
    "period_start" TIMESTAMPTZ(3) NOT NULL,
    "period_end" TIMESTAMPTZ(3) NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "paid_at" TIMESTAMPTZ(3),

    CONSTRAINT "affiliate_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_payout_items" (
    "payout_id" VARCHAR NOT NULL,
    "ledger_id" VARCHAR NOT NULL,

    CONSTRAINT "affiliate_payout_items_pkey" PRIMARY KEY ("payout_id", "ledger_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_profiles_referral_code_key" ON "affiliate_profiles"("referral_code");

-- CreateIndex
CREATE INDEX "affiliate_profiles_status_idx" ON "affiliate_profiles"("status");

-- CreateIndex
CREATE INDEX "affiliate_profiles_parent_affiliate_user_id_idx" ON "affiliate_profiles"("parent_affiliate_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_referral_attributions_referred_user_id_key" ON "affiliate_referral_attributions"("referred_user_id");

-- CreateIndex
CREATE INDEX "affiliate_referral_attributions_affiliate_user_id_created_at_idx" ON "affiliate_referral_attributions"("affiliate_user_id", "created_at");

-- CreateIndex
CREATE INDEX "affiliate_referral_attributions_referral_code_idx" ON "affiliate_referral_attributions"("referral_code");

-- CreateIndex
CREATE INDEX "affiliate_commission_ledger_affiliate_user_id_status_available_at_idx" ON "affiliate_commission_ledger"("affiliate_user_id", "status", "available_at");

-- CreateIndex
CREATE INDEX "affiliate_commission_ledger_referred_user_id_idx" ON "affiliate_commission_ledger"("referred_user_id");

-- CreateIndex
CREATE INDEX "affiliate_commission_ledger_invoice_id_idx" ON "affiliate_commission_ledger"("invoice_id");

-- CreateIndex
CREATE INDEX "affiliate_payouts_affiliate_user_id_created_at_idx" ON "affiliate_payouts"("affiliate_user_id", "created_at");

-- CreateIndex
CREATE INDEX "affiliate_payout_items_ledger_id_idx" ON "affiliate_payout_items"("ledger_id");

-- AddForeignKey
ALTER TABLE "affiliate_profiles" ADD CONSTRAINT "affiliate_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_referral_attributions" ADD CONSTRAINT "affiliate_referral_attributions_affiliate_user_id_fkey" FOREIGN KEY ("affiliate_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_referral_attributions" ADD CONSTRAINT "affiliate_referral_attributions_referred_user_id_fkey" FOREIGN KEY ("referred_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commission_ledger" ADD CONSTRAINT "affiliate_commission_ledger_affiliate_user_id_fkey" FOREIGN KEY ("affiliate_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commission_ledger" ADD CONSTRAINT "affiliate_commission_ledger_referred_user_id_fkey" FOREIGN KEY ("referred_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_affiliate_user_id_fkey" FOREIGN KEY ("affiliate_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_payout_items" ADD CONSTRAINT "affiliate_payout_items_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "affiliate_payouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_payout_items" ADD CONSTRAINT "affiliate_payout_items_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "affiliate_commission_ledger"("id") ON DELETE CASCADE ON UPDATE CASCADE;
