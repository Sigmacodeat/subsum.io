import ava, { TestFn } from 'ava';
import Sinon from 'sinon';
import supertest from 'supertest';

import { AppModule } from '../../app.module';
import { TelemetryService } from '../../core/telemetry/service';
import { createTestingApp, type TestingApp } from '../utils';

const test = ava as TestFn<{
  app: TestingApp;
}>;

test.before(async t => {
  const app = await createTestingApp({
    imports: [AppModule],
  });
  t.context.app = app;
});

test.beforeEach(async t => {
  Sinon.restore();
  await t.context.app.initTestingDB();
});

test.after.always(async t => {
  Sinon.restore();
  await t.context.app.close();
});

test('telemetry collect should reject requests with no origin and no referer', async t => {
  const { app } = t.context;

  await supertest(app.getHttpServer())
    .post('/api/telemetry/collect')
    .send({ schemaVersion: 1, events: [], sentAt: Date.now() })
    .expect(400);

  t.pass();
});

test('telemetry collect should reject requests with disallowed origin', async t => {
  const { app } = t.context;

  await supertest(app.getHttpServer())
    .post('/api/telemetry/collect')
    .set('Origin', 'https://evil.example.com')
    .send({ schemaVersion: 1, events: [], sentAt: Date.now() })
    .expect(400);

  t.pass();
});

test('telemetry collect should not leak origin value in error response', async t => {
  const { app } = t.context;

  const res = await supertest(app.getHttpServer())
    .post('/api/telemetry/collect')
    .set('Origin', 'https://evil.example.com')
    .send({ schemaVersion: 1, events: [], sentAt: Date.now() })
    .expect(400);

  const body = JSON.stringify(res.body);
  t.false(body.includes('evil.example.com'));
});

test('telemetry collect should accept requests from allowed origin', async t => {
  const { app } = t.context;
  const telemetry = app.get(TelemetryService);

  Sinon.stub(telemetry, 'isOriginAllowed').returns(true);

  await supertest(app.getHttpServer())
    .post('/api/telemetry/collect')
    .set('Origin', 'https://app.affine.pro')
    .send({ schemaVersion: 1, events: [], sentAt: Date.now() })
    .expect(201);

  t.pass();
});

test('isOriginAllowed should deny when both origin and referer are absent', t => {
  const { app } = t.context;
  const telemetry = app.get(TelemetryService);

  t.false(telemetry.isOriginAllowed(undefined, undefined));
  t.false(telemetry.isOriginAllowed(null, null));
  t.false(telemetry.isOriginAllowed('', ''));
});

test('isOriginAllowed should deny disallowed origin', t => {
  const { app } = t.context;
  const telemetry = app.get(TelemetryService);

  t.false(telemetry.isOriginAllowed('https://evil.example.com', undefined));
});

test('isOriginAllowed should deny disallowed referer', t => {
  const { app } = t.context;
  const telemetry = app.get(TelemetryService);

  t.false(
    telemetry.isOriginAllowed(undefined, 'https://evil.example.com/page')
  );
});
