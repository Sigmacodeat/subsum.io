/*
  Warnings:

  - A unique constraint covering the columns `[user_id,transaction_type,reference_id]` on the table `addon_credit_transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed');

-- DropForeignKey
ALTER TABLE "addon_credit_transactions" DROP CONSTRAINT "addon_credit_transactions_addon_purchase_id_fkey";

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" VARCHAR NOT NULL,
    "workspace_id" VARCHAR NOT NULL,
    "webhook_id" VARCHAR NOT NULL,
    "event_id" VARCHAR NOT NULL,
    "event_type" VARCHAR NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'pending',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "last_response_status" INTEGER,
    "next_retry_at" TIMESTAMPTZ(3),
    "succeeded_at" TIMESTAMPTZ(3),
    "failed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_delivery_attempts" (
    "id" VARCHAR NOT NULL,
    "delivery_id" VARCHAR NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "finished_at" TIMESTAMPTZ(3),
    "duration_ms" INTEGER,
    "response_status" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_deliveries_workspace_id_created_at_idx" ON "webhook_deliveries"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_workspace_id_webhook_id_created_at_idx" ON "webhook_deliveries"("workspace_id", "webhook_id", "created_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_workspace_id_status_created_at_idx" ON "webhook_deliveries"("workspace_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_workspace_id_event_type_created_at_idx" ON "webhook_deliveries"("workspace_id", "event_type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_deliveries_workspace_id_event_id_webhook_id_key" ON "webhook_deliveries"("workspace_id", "event_id", "webhook_id");

-- CreateIndex
CREATE INDEX "webhook_delivery_attempts_delivery_id_started_at_idx" ON "webhook_delivery_attempts"("delivery_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_delivery_attempts_delivery_id_attempt_no_key" ON "webhook_delivery_attempts"("delivery_id", "attempt_no");

-- CreateIndex
CREATE INDEX "addon_credit_balances_user_id_idx" ON "addon_credit_balances"("user_id");

-- CreateIndex
CREATE INDEX "addon_credit_transactions_user_id_idx" ON "addon_credit_transactions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "addon_credit_transactions_user_id_transaction_type_referenc_key" ON "addon_credit_transactions"("user_id", "transaction_type", "reference_id");

-- CreateIndex
CREATE INDEX "addon_purchases_user_id_idx" ON "addon_purchases"("user_id");

-- CreateIndex
CREATE INDEX "addon_purchases_user_id_addon_type_idx" ON "addon_purchases"("user_id", "addon_type");

-- AddForeignKey
ALTER TABLE "addon_credit_transactions" ADD CONSTRAINT "addon_credit_transactions_addon_purchase_id_fkey" FOREIGN KEY ("addon_purchase_id") REFERENCES "addon_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "webhook_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "addon_credit_transactions_user_id_addon_type_created_at" RENAME TO "addon_credit_transactions_user_id_addon_type_created_at_idx";

-- RenameIndex
ALTER INDEX "affiliate_commission_ledger_affiliate_user_id_status_available_" RENAME TO "affiliate_commission_ledger_affiliate_user_id_status_availa_idx";

-- RenameIndex
ALTER INDEX "affiliate_referral_attributions_affiliate_user_id_created_at_id" RENAME TO "affiliate_referral_attributions_affiliate_user_id_created_a_idx";
