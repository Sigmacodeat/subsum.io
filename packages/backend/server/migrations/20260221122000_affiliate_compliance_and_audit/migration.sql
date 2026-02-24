-- AlterTable
ALTER TABLE "affiliate_profiles"
ADD COLUMN "terms_accepted_at" TIMESTAMPTZ(3),
ADD COLUMN "terms_version" VARCHAR(64);

-- CreateTable
CREATE TABLE "affiliate_compliance_events" (
    "id" VARCHAR NOT NULL,
    "affiliate_user_id" VARCHAR NOT NULL,
    "actor_user_id" VARCHAR,
    "payout_id" VARCHAR,
    "event_type" VARCHAR(64) NOT NULL,
    "severity" VARCHAR(16) NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_compliance_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "affiliate_compliance_events_affiliate_user_id_created_at_idx" ON "affiliate_compliance_events"("affiliate_user_id", "created_at");

-- CreateIndex
CREATE INDEX "affiliate_compliance_events_payout_id_created_at_idx" ON "affiliate_compliance_events"("payout_id", "created_at");

-- CreateIndex
CREATE INDEX "affiliate_compliance_events_event_type_created_at_idx" ON "affiliate_compliance_events"("event_type", "created_at");

-- AddForeignKey
ALTER TABLE "affiliate_compliance_events" ADD CONSTRAINT "affiliate_compliance_events_affiliate_user_id_fkey" FOREIGN KEY ("affiliate_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_compliance_events" ADD CONSTRAINT "affiliate_compliance_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_compliance_events" ADD CONSTRAINT "affiliate_compliance_events_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "affiliate_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
