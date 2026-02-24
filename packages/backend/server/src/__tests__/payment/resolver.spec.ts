import '../../plugins/payment';

import ava, { TestFn } from 'ava';
import Sinon from 'sinon';
import supertest from 'supertest';

import { AppModule } from '../../app.module';
import { ConfigModule } from '../../base/config';
import { ThrottlerStorage } from '../../base/throttler';
import { createTestingApp, type TestingApp } from '../utils';

const test = ava as TestFn<{
  app: TestingApp;
}>;

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
});

test.beforeEach(async t => {
  Sinon.restore();
  await t.context.app.initTestingDB();
  await t.context.app.signupV1('u1@affine.pro');
});

test.after.always(async t => {
  Sinon.restore();
  await t.context.app.close();
});

test('cancelSubscription should require idempotency key', async t => {
  const { app } = t.context;

  const res = await app
    .POST('/graphql')
    .send({
      query: `
        mutation {
          cancelSubscription {
            plan
          }
        }
      `,
    })
    .expect(200);

  const err = res.body?.errors?.[0];
  t.truthy(err);
  t.is(err?.extensions?.name, 'BAD_REQUEST');
  t.true((err?.message as string | undefined)?.includes('Idempotency key is required.'));
});

test('cancelSubscription should accept deprecated idempotencyKey argument', async t => {
  const { app } = t.context;

  const res = await app
    .POST('/graphql')
    .send({
      query: `
        mutation {
          cancelSubscription(idempotencyKey: "legacy-key") {
            plan
          }
        }
      `,
    })
    .expect(200);

  const message = res.body?.errors?.[0]?.message as string | undefined;
  t.truthy(message);
  t.false(message?.includes('Idempotency key is required.'));
});

test('resumeSubscription should require idempotency key', async t => {
  const { app } = t.context;

  const res = await app
    .POST('/graphql')
    .send({
      query: `
        mutation {
          resumeSubscription {
            plan
          }
        }
      `,
    })
    .expect(200);

  const err = res.body?.errors?.[0];
  t.truthy(err);
  t.is(err?.extensions?.name, 'BAD_REQUEST');
  t.true((err?.message as string | undefined)?.includes('Idempotency key is required.'));
});

test('resumeSubscription should accept deprecated idempotencyKey argument', async t => {
  const { app } = t.context;

  const res = await app
    .POST('/graphql')
    .send({
      query: `
        mutation {
          resumeSubscription(idempotencyKey: "legacy-key") {
            plan
          }
        }
      `,
    })
    .expect(200);

  const message = res.body?.errors?.[0]?.message as string | undefined;
  t.truthy(message);
  t.false(message?.includes('Idempotency key is required.'));
});

test('resumeSubscription should accept Idempotency-Key header', async t => {
  const { app } = t.context;

  const res = await app
    .POST('/graphql')
    .set('idempotency-key', 'header-key')
    .send({
      query: `
        mutation {
          resumeSubscription {
            plan
          }
        }
      `,
    })
    .expect(200);

  const message = res.body?.errors?.[0]?.message as string | undefined;
  t.truthy(message);
  t.false(message?.includes('Idempotency key is required.'));
});

test('updateSubscriptionRecurring should require idempotency key', async t => {
  const { app } = t.context;

  const res = await app
    .POST('/graphql')
    .send({
      query: `
        mutation {
          updateSubscriptionRecurring(recurring: Yearly) {
            plan
          }
        }
      `,
    })
    .expect(200);

  const err = res.body?.errors?.[0];
  t.truthy(err);
  t.is(err?.extensions?.name, 'BAD_REQUEST');
  t.true((err?.message as string | undefined)?.includes('Idempotency key is required.'));
});

test('updateSubscriptionRecurring should accept deprecated idempotencyKey argument', async t => {
  const { app } = t.context;

  const res = await app
    .POST('/graphql')
    .send({
      query: `
        mutation {
          updateSubscriptionRecurring(recurring: Yearly, idempotencyKey: "legacy-key") {
            plan
          }
        }
      `,
    })
    .expect(200);

  const message = res.body?.errors?.[0]?.message as string | undefined;
  t.truthy(message);
  t.false(message?.includes('Idempotency key is required.'));
});

test('updateSubscriptionRecurring should accept Idempotency-Key header', async t => {
  const { app } = t.context;

  const res = await app
    .POST('/graphql')
    .set('idempotency-key', 'header-key')
    .send({
      query: `
        mutation {
          updateSubscriptionRecurring(recurring: Yearly) {
            plan
          }
        }
      `,
    })
    .expect(200);

  const message = res.body?.errors?.[0]?.message as string | undefined;
  t.truthy(message);
  t.false(message?.includes('Idempotency key is required.'));
});

test('mutating billing graphql should be rate-limited when strict throttler blocks', async t => {
  const { app } = t.context;

  const stub = Sinon.stub(app.get(ThrottlerStorage), 'increment').resolves({
    timeToExpire: 10,
    totalHits: 21,
    isBlocked: true,
    timeToBlockExpire: 10,
  });

  const res = await app
    .POST('/graphql')
    .set('Idempotency-Key', 'header-key')
    .send({
      query: `
        mutation {
          cancelSubscription {
            plan
          }
        }
      `,
    })
    .expect(res => {
      t.true([200, 429].includes(res.status));
    });

  t.true(stub.called);

  if (res.status === 200) {
    t.truthy(res.body?.errors?.[0]);
  }
});

test('createCheckoutSession should require workspaceId for team plan', async t => {
  const { app } = t.context;

  const res = await app
    .POST('/graphql')
    .send({
      query: `
        mutation {
          createCheckoutSession(input: { plan: Team, successCallbackLink: "https://affine.pro/success" })
        }
      `,
    })
    .expect(200);

  const err = res.body?.errors?.[0];
  t.truthy(err);
  t.is(err?.extensions?.name, 'WORKSPACE_ID_REQUIRED_TO_UPDATE_TEAM_SUBSCRIPTION');
});

test('cancelSubscription should reject team plan without workspace payment permission', async t => {
  const { app } = t.context;

  const res = await app
    .POST('/graphql')
    .set('Idempotency-Key', 'header-key')
    .send({
      query: `
        mutation {
          cancelSubscription(plan: Team, workspaceId: "ws_unknown") {
            plan
          }
        }
      `,
    })
    .expect(200);

  const message = res.body?.errors?.[0]?.message as string | undefined;
  t.truthy(message);
  t.false(message?.includes('workspace id'));
});

test('resumeSubscription should reject team plan without workspace payment permission', async t => {
  const { app } = t.context;

  const res = await app
    .POST('/graphql')
    .set('Idempotency-Key', 'header-key')
    .send({
      query: `
        mutation {
          resumeSubscription(plan: Team, workspaceId: "ws_unknown") {
            plan
          }
        }
      `,
    })
    .expect(200);

  const message = res.body?.errors?.[0]?.message as string | undefined;
  t.truthy(message);
  t.false(message?.includes('workspace id'));
});

test('updateSubscriptionRecurring should reject team plan without workspace payment permission', async t => {
  const { app } = t.context;

  const res = await app
    .POST('/graphql')
    .set('Idempotency-Key', 'header-key')
    .send({
      query: `
        mutation {
          updateSubscriptionRecurring(plan: Team, workspaceId: "ws_unknown", recurring: Yearly) {
            plan
          }
        }
      `,
    })
    .expect(200);

  const message = res.body?.errors?.[0]?.message as string | undefined;
  t.truthy(message);
  t.false(message?.includes('workspace id'));
});

test('createCheckoutSession should reject team plan without workspace payment permission', async t => {
  const { app } = t.context;

  const res = await app
    .POST('/graphql')
    .send({
      query: `
        mutation {
          createCheckoutSession(input: { plan: Team, successCallbackLink: "https://affine.pro/success", args: { workspaceId: "ws_unknown" } })
        }
      `,
    })
    .expect(200);

  const message = res.body?.errors?.[0]?.message as string | undefined;
  t.truthy(message);
  t.false(message?.includes('workspace id'));
});

test('cancelSubscription should require workspaceId for team plan', async t => {
  const { app } = t.context;

  const res = await app
    .POST('/graphql')
    .set('Idempotency-Key', 'header-key')
    .send({
      query: `
        mutation {
          cancelSubscription(plan: Team) {
            plan
          }
        }
      `,
    })
    .expect(200);

  const err = res.body?.errors?.[0];
  t.truthy(err);
  t.is(err?.extensions?.name, 'WORKSPACE_ID_REQUIRED_TO_UPDATE_TEAM_SUBSCRIPTION');
});

test('resumeSubscription should require workspaceId for team plan', async t => {
  const { app } = t.context;

  const res = await app
    .POST('/graphql')
    .set('Idempotency-Key', 'header-key')
    .send({
      query: `
        mutation {
          resumeSubscription(plan: Team) {
            plan
          }
        }
      `,
    })
    .expect(200);

  const err = res.body?.errors?.[0];
  t.truthy(err);
  t.is(err?.extensions?.name, 'WORKSPACE_ID_REQUIRED_TO_UPDATE_TEAM_SUBSCRIPTION');
});

test('updateSubscriptionRecurring should require workspaceId for team plan', async t => {
  const { app } = t.context;

  const res = await app
    .POST('/graphql')
    .set('Idempotency-Key', 'header-key')
    .send({
      query: `
        mutation {
          updateSubscriptionRecurring(plan: Team, recurring: Yearly) {
            plan
          }
        }
      `,
    })
    .expect(200);

  const err = res.body?.errors?.[0];
  t.truthy(err);
  t.is(err?.extensions?.name, 'WORKSPACE_ID_REQUIRED_TO_UPDATE_TEAM_SUBSCRIPTION');
});

test('createCheckoutSession should require authentication for non-selfhost plans', async t => {
  const { app } = t.context;

  const res = await supertest(app.getHttpServer())
    .post('/graphql')
    .send({
      query: `
        mutation {
          createCheckoutSession(input: { successCallbackLink: "https://affine.pro/success" })
        }
      `,
    })
    .expect(200);

  const err = res.body?.errors?.[0];
  t.truthy(err);
  t.is(err?.extensions?.name, 'AUTHENTICATION_REQUIRED');
});

test('createCustomerPortal should require authentication', async t => {
  const { app } = t.context;

  const res = await supertest(app.getHttpServer())
    .post('/graphql')
    .send({
      query: `
        mutation {
          createCustomerPortal
        }
      `,
    })
    .expect(200);

  const err = res.body?.errors?.[0];
  t.truthy(err);
  t.is(err?.extensions?.name, 'AUTHENTICATION_REQUIRED');
});

test('createCustomerPortal should be rate-limited when strict throttler blocks', async t => {
  const { app } = t.context;

  Sinon.stub(app.get(ThrottlerStorage), 'increment').resolves({
    timeToExpire: 10,
    totalHits: 21,
    isBlocked: true,
    timeToBlockExpire: 10,
  });

  const res = await app
    .POST('/graphql')
    .send({
      query: `
        mutation {
          createCustomerPortal
        }
      `,
    })
    .expect(res => {
      t.true([200, 429].includes(res.status));
    });

  if (res.status === 200) {
    t.truthy(res.body?.errors?.[0]);
  }
});

test('createCheckoutSession should be rate-limited when strict throttler blocks', async t => {
  const { app } = t.context;

  const stub = Sinon.stub(app.get(ThrottlerStorage), 'increment').resolves({
    timeToExpire: 10,
    totalHits: 21,
    isBlocked: true,
    timeToBlockExpire: 10,
  });

  const res = await app
    .POST('/graphql')
    .send({
      query: `
        mutation {
          createCheckoutSession(input: { successCallbackLink: "https://affine.pro/success" })
        }
      `,
    })
    .expect(res => {
      t.true([200, 429].includes(res.status));
    });

  t.true(stub.called);

  if (res.status === 200) {
    t.truthy(res.body?.errors?.[0]);
  }
});
