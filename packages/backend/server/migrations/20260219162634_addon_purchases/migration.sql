/*
  Warnings:

  - You are about to drop the `addon_credit_balances` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `addon_credit_transactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `addon_purchases` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE IF EXISTS "addon_credit_balances" DROP CONSTRAINT IF EXISTS "addon_credit_balances_user_id_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "addon_credit_transactions" DROP CONSTRAINT IF EXISTS "addon_credit_transactions_addon_purchase_id_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "addon_credit_transactions" DROP CONSTRAINT IF EXISTS "addon_credit_transactions_user_id_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "addon_purchases" DROP CONSTRAINT IF EXISTS "addon_purchases_user_id_fkey";

-- DropTable
DROP TABLE IF EXISTS "addon_credit_balances";

-- DropTable
DROP TABLE IF EXISTS "addon_credit_transactions";

-- DropTable
DROP TABLE IF EXISTS "addon_purchases";
