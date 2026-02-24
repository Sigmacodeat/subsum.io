import '../../plugins/payment';

import ava, { TestFn } from 'ava';
import { PrismaClient } from '@prisma/client';
import Sinon from 'sinon';
import supertest from 'supertest';

import { AppModule } from '../../app.module';
import { Mutex } from '../../base';
import { ConfigModule } from '../../base/config';
import { SelfhostTeamSubscriptionManager } from '../../plugins/payment/manager/selfhost';
import {
  SubscriptionPlan,
  SubscriptionRecurring,
  SubscriptionStatus,
} from '../../plugins/payment/types';
import { createTestingApp, type TestingApp } from '../utils';

type Ctx = {
  app: TestingApp;
  db: PrismaClient;
  mutex: Mutex;
  manager: SelfhostTeamSubscriptionManager;
};

const test = ava as TestFn<Ctx>;

test.before(async t => {
  const app = await createTestingApp({
    imports: [
      ConfigModule.override({
        payment: {
          enabled: true,
          stripe: {
            apiKey: 'sk_test',
            webhookKey: 'whsec_test',
          },
        },
      }),
      AppModule,
    ],
  });

  t.context.app = app;
  t.context.db = app.get(PrismaClient);
  t.context.mutex = app.get(Mutex);
  t.context.manager = app.get(SelfhostTeamSubscriptionManager);
});

test.beforeEach(async t => {
  Sinon.restore();
  await t.context.app.initTestingDB();
});

test.after.always(async t => {
  await t.context.app.close();
});

test('team license deactivate should reject request without validate key header', async t => {
  const { app, db } = t.context;

  await db.license.create({
    data: {
      key: 'lic_missing_header',
      installedAt: new Date(),
      validateKey: 'vk_required',
    },
  });

  const res = await supertest(app.getHttpServer())
    .post('/api/team/licenses/lic_missing_header/deactivate')
    .expect(400);

  t.is(res.body.name, 'INVALID_LICENSE_TO_ACTIVATE');
});

test('team license health should reject request without validate key header', async t => {
  const { app, db, manager } = t.context;

  Sinon.stub(manager, 'getActiveSubscription').resolves({
    plan: SubscriptionPlan.SelfHostedTeam,
    recurring: SubscriptionRecurring.Monthly,
    quantity: 5,
    status: SubscriptionStatus.Active,
    end: new Date(Date.now() + 3600_000),
  } as any);

  await db.license.create({
    data: {
      key: 'lic_health_missing_header',
      installedAt: new Date(),
      validateKey: 'vk_health_required',
    },
  });

  const res = await supertest(app.getHttpServer())
    .get('/api/team/licenses/lic_health_missing_header/health')
    .expect(400);

  t.is(res.body.name, 'INVALID_LICENSE_TO_ACTIVATE');
});

test('team license health should rotate validate key on success', async t => {
  const { app, db, manager } = t.context;

  Sinon.stub(manager, 'getActiveSubscription').resolves({
    plan: SubscriptionPlan.SelfHostedTeam,
    recurring: SubscriptionRecurring.Monthly,
    quantity: 5,
    status: SubscriptionStatus.Active,
    end: new Date(Date.now() + 3600_000),
  } as any);

  await db.license.create({
    data: {
      key: 'lic_health_success',
      installedAt: new Date(),
      validateKey: 'vk_health_old',
    },
  });

  const res = await supertest(app.getHttpServer())
    .get('/api/team/licenses/lic_health_success/health')
    .set('x-validate-key', 'vk_health_old')
    .expect(200);

  const nextValidateKey = res.headers['x-next-validate-key'];
  t.truthy(nextValidateKey);
  t.not(nextValidateKey, 'vk_health_old');

  const license = await db.license.findUnique({ where: { key: 'lic_health_success' } });
  t.is(license?.validateKey, nextValidateKey);
});

test('team license health should reject when lock cannot be acquired', async t => {
  const { app, db, manager, mutex } = t.context;

  const acquire = Sinon.stub(mutex, 'acquire').resolves(undefined);
  const getActiveSubscription = Sinon.stub(manager, 'getActiveSubscription');

  await db.license.create({
    data: {
      key: 'lic_health_locked',
      installedAt: new Date(),
      validateKey: 'vk_health_locked',
    },
  });

  const res = await supertest(app.getHttpServer())
    .get('/api/team/licenses/lic_health_locked/health')
    .set('x-validate-key', 'vk_health_locked')
    .expect(400);

  t.true(acquire.calledOnce);
  t.true(getActiveSubscription.notCalled);
  t.is(res.body.name, 'INVALID_LICENSE_TO_ACTIVATE');
});

test('team license health should record license_not_found outcome when no active subscription exists', async t => {
  const { app, db, manager } = t.context;

  Sinon.stub(manager, 'getActiveSubscription').resolves(null);

  await db.license.create({
    data: {
      key: 'lic_health_no_subscription',
      installedAt: new Date(),
      validateKey: 'vk_health_no_subscription',
    },
  });

  const res = await supertest(app.getHttpServer())
    .get('/api/team/licenses/lic_health_no_subscription/health')
    .set('x-validate-key', 'vk_health_no_subscription')
    .expect(404);

  t.is(res.body.name, 'LICENSE_NOT_FOUND');
});

test('team license deactivate should pass with valid validate key and reset license state', async t => {
  const { app, db } = t.context;

  await db.license.create({
    data: {
      key: 'lic_valid_header',
      installedAt: new Date(),
      validateKey: 'vk_valid',
    },
  });

  const res = await supertest(app.getHttpServer())
    .post('/api/team/licenses/lic_valid_header/deactivate')
    .set('x-validate-key', 'vk_valid')
    .expect(201);

  t.deepEqual(res.body, { success: true });

  const license = await db.license.findUnique({ where: { key: 'lic_valid_header' } });
  t.truthy(license);
  t.is(license?.installedAt, null);
  t.is(license?.validateKey, null);
});

test('team license deactivate should reject request with invalid validate key and keep license state', async t => {
  const { app, db } = t.context;

  const installedAt = new Date();
  await db.license.create({
    data: {
      key: 'lic_invalid_header',
      installedAt,
      validateKey: 'vk_expected',
    },
  });

  const res = await supertest(app.getHttpServer())
    .post('/api/team/licenses/lic_invalid_header/deactivate')
    .set('x-validate-key', 'vk_wrong')
    .expect(400);

  t.is(res.body.name, 'INVALID_LICENSE_TO_ACTIVATE');

  const license = await db.license.findUnique({ where: { key: 'lic_invalid_header' } });
  t.truthy(license);
  t.truthy(license?.installedAt);
  t.is(license?.validateKey, 'vk_expected');
});

test('team license seats should reject missing validate key before payload validation', async t => {
  const { app, db } = t.context;

  await db.license.create({
    data: {
      key: 'lic_seats_missing_header',
      installedAt: new Date(),
      validateKey: 'vk_required',
    },
  });

  const res = await supertest(app.getHttpServer())
    .post('/api/team/licenses/lic_seats_missing_header/seats')
    .send({ seats: 0 })
    .expect(400);

  t.is(res.body.name, 'INVALID_LICENSE_TO_ACTIVATE');
});

test('team license recurring should reject missing validate key before payload validation', async t => {
  const { app, db } = t.context;

  await db.license.create({
    data: {
      key: 'lic_recurring_missing_header',
      installedAt: new Date(),
      validateKey: 'vk_required',
    },
  });

  const res = await supertest(app.getHttpServer())
    .post('/api/team/licenses/lic_recurring_missing_header/recurring')
    .send({ recurring: 'invalid' })
    .expect(400);

  t.is(res.body.name, 'INVALID_LICENSE_TO_ACTIVATE');
});
