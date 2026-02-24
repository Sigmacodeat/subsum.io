import '../../plugins/payment';

import { createHmac, randomUUID } from 'node:crypto';

import ava, { TestFn } from 'ava';
import Sinon from 'sinon';
import supertest from 'supertest';
import Stripe from 'stripe';

import { AppModule } from '../../app.module';
import { Cache, EventBus } from '../../base';
import { ConfigModule } from '../../base/config';
import { StripeFactory } from '../../plugins/payment/stripe';
import { createTestingApp, type TestingApp } from '../utils';

const test = ava as TestFn<{
  app: TestingApp;
  cache: Cache;
  eventBus: EventBus;
  stripeFactory: StripeFactory;
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
          esign: {
            enabled: true,
            webhookSecret: 'esign_test_secret',
            webhookToleranceSec: 300,
          },
        },
      }),
      AppModule,
    ],
  });

  t.context.app = app;
  t.context.cache = app.get(Cache);
  t.context.eventBus = app.get(EventBus);
  t.context.stripeFactory = app.get(StripeFactory);
});

test.beforeEach(async t => {
  Sinon.restore();
  await t.context.app.initTestingDB();
});

test.after.always(async t => {
  Sinon.restore();
  await t.context.app.close();
});

test('stripe webhook should return 400 for invalid signature', async t => {
  const { app, stripeFactory } = t.context;

  const signatureError = Object.create(
    Stripe.errors.StripeSignatureVerificationError.prototype
  ) as Error;
  signatureError.message = 'invalid signature';

  Sinon.stub(stripeFactory.stripe.webhooks, 'constructEvent').throws(signatureError);

  const res = await supertest(app.getHttpServer())
    .post('/api/stripe/webhook')
    .set('stripe-signature', 'invalid-signature')
    .send('{}')
    .expect(400);

  t.is(res.body.name, 'BAD_REQUEST');
  t.is(res.body.message, 'Invalid Stripe webhook signature');
});

test('stripe webhook should process duplicate events only once', async t => {
  const { app, cache, eventBus, stripeFactory } = t.context;
  const eventId = `evt_test_dedupe_${randomUUID()}`;

  const event = {
    id: eventId,
    type: 'invoice.paid',
    object: 'event',
    api_version: '2024-06-20',
    created: Date.now(),
    data: { object: { id: 'in_test' } },
    livemode: false,
    pending_webhooks: 1,
    request: null,
  } as unknown as Stripe.Event;

  const constructEvent = Sinon.stub(
    stripeFactory.stripe.webhooks,
    'constructEvent'
  ).returns(event);
  const setnx = Sinon.stub(cache, 'setnx');
  setnx.onFirstCall().resolves(true);
  setnx.onSecondCall().resolves(false);
  Sinon.stub(cache, 'has').resolves(true);
  const emitAsync = Sinon.stub(eventBus, 'emitAsync').resolves([] as unknown[]);

  await supertest(app.getHttpServer())
    .post('/api/stripe/webhook')
    .set('stripe-signature', 'valid-signature')
    .send('{}')
    .expect(200);

  await new Promise(resolve => setImmediate(resolve));

  await supertest(app.getHttpServer())
    .post('/api/stripe/webhook')
    .set('stripe-signature', 'valid-signature')
    .send('{}')
    .expect(200);

  await new Promise(resolve => setImmediate(resolve));

  t.true(constructEvent.calledTwice);
  t.true(emitAsync.calledOnce);
  t.deepEqual(emitAsync.firstCall.args[0], 'stripe.invoice.paid');
});

test('esign webhook should return 400 for invalid signature', async t => {
  const { app } = t.context;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = JSON.stringify({
    provider: 'docusign',
    envelopeId: 'env_test_1',
    event: 'envelope.completed',
  });

  const res = await supertest(app.getHttpServer())
    .post('/api/esign/webhook')
    .set('content-type', 'application/json')
    .set('x-esign-timestamp', timestamp)
    .set('x-esign-signature', 'deadbeef')
    .send(payload)
    .expect(400);

  t.is(res.body.name, 'BAD_REQUEST');
  t.is(res.body.message, 'Invalid eSign webhook signature');
});

test('esign webhook should emit event when signature is valid', async t => {
  const { app, eventBus } = t.context;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = JSON.stringify({
    provider: 'docusign',
    envelopeId: 'env_test_2',
    event: 'envelope.completed',
    payload: {
      signingRequestId: 'signing:1',
    },
  });
  const signature = createHmac('sha256', 'esign_test_secret')
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  const emitAsync = Sinon.stub(eventBus, 'emitAsync').resolves([] as unknown[]);

  await supertest(app.getHttpServer())
    .post('/api/esign/webhook')
    .set('content-type', 'application/json')
    .set('x-esign-timestamp', timestamp)
    .set('x-esign-signature', signature)
    .send(payload)
    .expect(200);

  await new Promise(resolve => setImmediate(resolve));

  t.true(emitAsync.calledOnce);
  t.is(emitAsync.firstCall.args[0], 'esign.webhook');
  const emittedPayload = emitAsync.firstCall.args[1] as Events['esign.webhook'];
  t.is(emittedPayload.provider, 'docusign');
  t.is(emittedPayload.event, 'envelope.completed');
});

test('stripe webhook should continue processing when dedupe storage is unavailable', async t => {
  const { app, cache, eventBus, stripeFactory } = t.context;
  const eventId = `evt_test_dedupe_fallback_${randomUUID()}`;

  const event = {
    id: eventId,
    type: 'invoice.paid',
    object: 'event',
    api_version: '2024-06-20',
    created: Date.now(),
    data: { object: { id: 'in_test_fallback' } },
    livemode: false,
    pending_webhooks: 1,
    request: null,
  } as unknown as Stripe.Event;

  Sinon.stub(stripeFactory.stripe.webhooks, 'constructEvent').returns(event);
  Sinon.stub(cache, 'setnx').resolves(false);
  Sinon.stub(cache, 'has').resolves(false);
  const emitAsync = Sinon.stub(eventBus, 'emitAsync').resolves([] as unknown[]);

  await supertest(app.getHttpServer())
    .post('/api/stripe/webhook')
    .set('stripe-signature', 'valid-signature')
    .send('{}')
    .expect(200);

  await new Promise(resolve => setImmediate(resolve));

  t.true(emitAsync.calledOnce);
  t.deepEqual(emitAsync.firstCall.args[0], 'stripe.invoice.paid');
});

test('stripe webhook should not leak internal errors', async t => {
  const { app, stripeFactory } = t.context;

  Sinon.stub(stripeFactory.stripe.webhooks, 'constructEvent').throws(
    new Error('super-secret-internal-message')
  );

  const res = await supertest(app.getHttpServer())
    .post('/api/stripe/webhook')
    .set('stripe-signature', 'valid-signature')
    .send('{}')
    .expect(500);

  t.is(res.body.message, 'An internal error occurred.');
});

test('stripe webhook should acknowledge valid event and dispatch asynchronously', async t => {
  const { app, stripeFactory, eventBus } = t.context;
  const eventId = `evt_test_${randomUUID()}`;

  const stripeEvent = {
    id: eventId,
    type: 'invoice.paid',
    data: {
      object: {
        id: 'in_test_1',
      },
    },
  } as unknown as Stripe.Event;

  const constructEventStub = Sinon.stub(
    stripeFactory.stripe.webhooks,
    'constructEvent'
  ).returns(stripeEvent);
  const emitAsyncStub = Sinon.stub(eventBus, 'emitAsync').resolves([] as any);

  const res = await supertest(app.getHttpServer())
    .post('/api/stripe/webhook')
    .set('stripe-signature', 'valid-signature')
    .send('{}')
    .expect(200);

  t.deepEqual(res.body, { received: true });

  await new Promise(resolve => setImmediate(resolve));

  t.true(constructEventStub.calledOnce);
  t.true(emitAsyncStub.calledOnceWith('stripe.invoice.paid', stripeEvent));
});
