import ava, { TestFn } from 'ava';
import Sinon from 'sinon';
import { PrismaClient } from '@prisma/client';

import { AppModule } from '../../app.module';
import { ConfigModule } from '../../base/config';
import { LicenseNotFound } from '../../base/error';
import { SubscriptionRecurring } from '../../plugins/payment/types';
import { LicenseService } from '../../plugins/license/service';
import { createTestingApp, type TestingApp } from '../utils';

type Ctx = {
  app: TestingApp;
  service: LicenseService;
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
  t.context.service = app.get(LicenseService);
});

test.beforeEach(async t => {
  Sinon.restore();
  await t.context.app.initTestingDB();
});

test.after.always(async t => {
  await t.context.app.close();
});

function okResponse(body: object) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function headerValue(init: RequestInit | undefined, key: string) {
  return new Headers(init?.headers).get(key);
}

test('deactivateTeamLicense should forward x-validate-key header', async t => {
  const { service } = t.context;
  const fetchStub = Sinon.stub(globalThis, 'fetch').resolves(okResponse({}));

  await service.deactivateTeamLicense({
    key: 'lic_deactivate',
    workspaceId: 'ws_deactivate',
    validateKey: 'vk_deactivate',
    quantity: 1,
    recurring: SubscriptionRecurring.Monthly,
    variant: null,
    validatedAt: new Date(),
    installedAt: new Date(),
    expiredAt: null,
    license: null,
  });

  t.true(fetchStub.calledOnce);
  const [, init] = fetchStub.firstCall.args;
  t.is(headerValue(init as RequestInit, 'x-validate-key'), 'vk_deactivate');
});

test('updateTeamRecurring should include x-validate-key header from installed license', async t => {
  const { app, service } = t.context;
  const db = app.get(PrismaClient);
  const fetchStub = Sinon.stub(globalThis, 'fetch').resolves(okResponse({}));

  await db.installedLicense.create({
    data: {
      key: 'lic_recurring',
      workspaceId: 'ws_recurring',
      validateKey: 'vk_recurring',
      validatedAt: new Date(),
      quantity: 3,
      recurring: SubscriptionRecurring.Monthly,
      variant: null,
    },
  });

  await service.updateTeamRecurring('lic_recurring', SubscriptionRecurring.Yearly);

  t.true(fetchStub.calledOnce);
  const [, init] = fetchStub.firstCall.args;
  t.is(headerValue(init as RequestInit, 'x-validate-key'), 'vk_recurring');
});

test('updateTeamRecurring should throw when installed license does not exist', async t => {
  const { service } = t.context;

  await t.throwsAsync(
    () => service.updateTeamRecurring('missing_license', SubscriptionRecurring.Yearly),
    {
      instanceOf: LicenseNotFound,
    }
  );
});

test('createCustomerPortal should include x-validate-key header', async t => {
  const { app, service } = t.context;
  const db = app.get(PrismaClient);
  const fetchStub = Sinon.stub(globalThis, 'fetch').resolves(
    okResponse({ url: 'https://billing.example/portal' })
  );

  await db.installedLicense.create({
    data: {
      key: 'lic_portal',
      workspaceId: 'ws_portal',
      validateKey: 'vk_portal',
      validatedAt: new Date(),
      quantity: 2,
      recurring: SubscriptionRecurring.Monthly,
      variant: null,
    },
  });

  await service.createCustomerPortal('ws_portal');

  t.true(fetchStub.calledOnce);
  const [, init] = fetchStub.firstCall.args;
  t.is(headerValue(init as RequestInit, 'x-validate-key'), 'vk_portal');
});
