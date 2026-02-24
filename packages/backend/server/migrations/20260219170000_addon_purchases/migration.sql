-- CreateTable
CREATE TABLE "addon_purchases" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "addon_type" VARCHAR(50) NOT NULL,
    "addon_name" VARCHAR(100) NOT NULL,
    "stripe_price_id" TEXT NOT NULL,
    "stripe_checkout_session_id" TEXT,
    "stripe_invoice_id" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price_cents" INTEGER NOT NULL,
    "total_price_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'eur',
    "recurring" VARCHAR(20) NOT NULL DEFAULT 'monthly',
    "stripe_subscription_id" TEXT,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "canceled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "addon_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addon_credit_balances" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "addon_type" VARCHAR(50) NOT NULL,
    "current_balance" INTEGER NOT NULL DEFAULT 0,
    "total_purchased" INTEGER NOT NULL DEFAULT 0,
    "total_consumed" INTEGER NOT NULL DEFAULT 0,
    "last_updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addon_credit_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addon_credit_transactions" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "addon_purchase_id" INTEGER REFERENCES "addon_purchases"(id) ON DELETE CASCADE,
    "addon_type" VARCHAR(50) NOT NULL,
    "transaction_type" VARCHAR(20) NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_before" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "description" TEXT,
    "reference_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addon_credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "addon_purchases_user_id_addon_type_active" ON "addon_purchases"("user_id", "addon_type") WHERE ("status" = 'active' AND "ends_at" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "addon_purchases_stripe_checkout_session_id_key" ON "addon_purchases"("stripe_checkout_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "addon_purchases_stripe_subscription_id_key" ON "addon_purchases"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "addon_credit_balances_user_id_addon_type_key" ON "addon_credit_balances"("user_id", "addon_type");

-- CreateIndex
CREATE INDEX "addon_credit_transactions_user_id_addon_type_created_at" ON "addon_credit_transactions"("user_id", "addon_type", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "addon_purchases" ADD CONSTRAINT "addon_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addon_credit_balances" ADD CONSTRAINT "addon_credit_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addon_credit_transactions" ADD CONSTRAINT "addon_credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
