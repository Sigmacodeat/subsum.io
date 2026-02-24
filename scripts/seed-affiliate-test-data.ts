#!/usr/bin/env ts-node
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const db = new PrismaClient();

const TEST_AFFILIATE_CODE = 'TESTCODE';
const ADMIN_EMAIL = 'admin@subsumio.test';
const ADMIN_PASSWORD = 'admin1234!';

async function main() {
  console.log('🌱 Seeding affiliate test data...');

  // 1) Create or find admin user
  const adminUser = await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      name: 'Admin Test',
      password: await hash(ADMIN_PASSWORD, 10),
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`✅ Admin user: ${adminUser.email} (id: ${adminUser.id})`);

  // 2) Create affiliate user
  const affiliateEmail = 'affiliate@subsumio.test';
  const affiliateUser = await db.user.upsert({
    where: { email: affiliateEmail },
    update: {},
    create: {
      email: affiliateEmail,
      name: 'Test Affiliate',
      password: await hash('affiliate1234!', 10),
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`✅ Affiliate user: ${affiliateUser.email} (id: ${affiliateUser.id})`);

  // 3) Create affiliate profile with referral code
  const affiliateProfile = await db.affiliateProfile.upsert({
    where: { userId: affiliateUser.id },
    update: {
      referralCode: TEST_AFFILIATE_CODE,
      status: 'active',
      stripeConnectAccountId: 'acct_test_placeholder',
      stripePayoutsEnabled: true,
      payoutEmail: 'payout@subsumio.test',
      levelOneRateBps: 1000, // 10%
      levelTwoRateBps: 200,   // 2%
    },
    create: {
      userId: affiliateUser.id,
      referralCode: TEST_AFFILIATE_CODE,
      status: 'active',
      stripeConnectAccountId: 'acct_test_placeholder',
      stripePayoutsEnabled: true,
      payoutEmail: 'payout@subsumio.test',
      levelOneRateBps: 1000,
      levelTwoRateBps: 200,
    },
  });

  console.log(`✅ Affiliate profile: code=${affiliateProfile.referralCode}`);

  // 4) Create a sample payout (pending) for testing admin actions
  const payout = await db.affiliatePayout.create({
    data: {
      affiliateUserId: affiliateUser.id,
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
      totalCents: 123456, // €1,234.56
      status: 'pending',
      currency: 'EUR',
    },
  });

  console.log(`✅ Sample payout: ${payout.id} (${payout.totalCents / 100}€)`);

  // 5) Create a sample ledger entry for the payout
  await (db as any).affiliateLedger.create({
    data: {
      affiliateUserId: affiliateUser.id,
      type: 'commission',
      amountCents: 123456,
      description: 'Test commission for Jan 2026',
      payoutId: payout.id,
      createdAt: new Date('2026-01-15'),
    },
  });

  console.log('✅ Ledger entry created');

  console.log('\n🎉 Seed complete!');
  console.log('\n--- Admin Access ---');
  console.log(`Email: ${ADMIN_EMAIL}`);
  console.log(`Password: ${ADMIN_PASSWORD}`);
  console.log(`Dashboard: http://localhost:8080/admin/affiliates`);
  console.log('\n--- Affiliate Access ---');
  console.log(`Email: ${affiliateEmail}`);
  console.log(`Password: affiliate1234!`);
  console.log(`Referral Code: ${TEST_AFFILIATE_CODE}`);
  console.log(`Settings: http://localhost:8080/settings?tab=affiliate`);
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
