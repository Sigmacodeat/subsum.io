import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';

import { HttpStatus } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import ava, { TestFn } from 'ava';
import Sinon from 'sinon';
import supertest from 'supertest';

import { ConfigFactory } from '../../base/config';
import { parseCookies as safeParseCookies } from '../../base/utils/request';
import { AuthService } from '../../core/auth/service';
import { Models } from '../../models';
import {
  createTestingApp,
  currentUser,
  parseCookies,
  TestingApp,
} from '../utils';

const test = ava as TestFn<{
  auth: AuthService;
  db: PrismaClient;
  models: Models;
  app: TestingApp;
}>;

test.before(async t => {
  const app = await createTestingApp();

  t.context.auth = app.get(AuthService);
  t.context.db = app.get(PrismaClient);
  t.context.models = app.get(Models);
  t.context.app = app;
});

test.beforeEach(async t => {
  Sinon.reset();
  await t.context.app.initTestingDB();
});

test.after.always(async t => {
  await t.context.app.close();
});

test('should be able to sign in with credential', async t => {
  const { app } = t.context;

  const u1 = await app.createUser('u1@affine.pro');

  await app
    .POST('/api/auth/sign-in')
    .send({ email: u1.email, password: u1.password })
    .expect(200);

  const session = await currentUser(app);
  t.is(session?.id, u1.id);
});

test('should require and verify admin MFA step-up', async t => {
  const { app, models } = t.context;

  const admin = await app.createUser('admin-mfa@affine.pro');
  await models.userFeature.add(admin.id, 'administrator', 'test admin');

  const signInRes = await app
    .POST('/api/auth/sign-in')
    .send({
      email: admin.email,
      password: admin.password,
      admin_step_up: true,
    })
    .expect(HttpStatus.ACCEPTED);

  t.true(signInRes.body.mfaRequired);
  t.truthy(signInRes.body.ticket);

  const signInMail = app.mails.last('SignIn');
  const otp = signInMail?.props?.otp as string | undefined;
  t.truthy(otp);

  await app
    .POST('/api/auth/admin/verify-mfa')
    .send({
      ticket: signInRes.body.ticket,
      otp,
    })
    .expect(HttpStatus.CREATED);

  const session = await currentUser(app);
  t.is(session?.id, admin.id);
});

test('should reject admin MFA verification with wrong OTP', async t => {
  const { app, models } = t.context;

  const admin = await app.createUser('admin-wrong-otp@affine.pro');
  await models.userFeature.add(admin.id, 'administrator', 'test admin');

  const signInRes = await app
    .POST('/api/auth/sign-in')
    .send({
      email: admin.email,
      password: admin.password,
      admin_step_up: true,
    })
    .expect(HttpStatus.ACCEPTED);

  await app
    .POST('/api/auth/admin/verify-mfa')
    .send({
      ticket: signInRes.body.ticket,
      otp: '000000',
    })
    .expect(HttpStatus.BAD_REQUEST);

  const session = await currentUser(app);
  t.is(session, null);
});

test('should allow admin MFA resend with same ticket', async t => {
  const { app, models } = t.context;

  const admin = await app.createUser('admin-resend@affine.pro');
  await models.userFeature.add(admin.id, 'administrator', 'test admin');

  const signInRes = await app
    .POST('/api/auth/sign-in')
    .send({
      email: admin.email,
      password: admin.password,
      admin_step_up: true,
    })
    .expect(HttpStatus.ACCEPTED);

  const ticket = signInRes.body.ticket;
  const initialMailCount = app.mails.count('SignIn');

  const resendRes = await app
    .POST('/api/auth/admin/resend-mfa')
    .send({ ticket })
    .expect(HttpStatus.CREATED);

  t.true(resendRes.body.resent);
  t.is(resendRes.body.ticket, ticket);
  t.is(app.mails.count('SignIn'), initialMailCount + 1);

  const newOtp = app.mails.last('SignIn')?.props?.otp as string;
  t.truthy(newOtp);

  await app
    .POST('/api/auth/admin/verify-mfa')
    .send({ ticket, otp: newOtp })
    .expect(HttpStatus.CREATED);

  const session = await currentUser(app);
  t.is(session?.id, admin.id);
});

test('should reject admin MFA resend with invalid ticket', async t => {
  const { app } = t.context;

  const res = await app
    .POST('/api/auth/admin/resend-mfa')
    .send({ ticket: 'invalid-ticket-12345' })
    .expect(HttpStatus.BAD_REQUEST);

  t.is(res.status, HttpStatus.BAD_REQUEST);
});

test('should list admin trusted devices', async t => {
  const { app, models } = t.context;

  const admin = await app.createUser('admin-devices@affine.pro');
  await models.userFeature.add(admin.id, 'administrator', 'test admin');
  await app.login(admin);

  const res = await app
    .GET('/api/auth/admin/trusted-devices')
    .expect(HttpStatus.OK);

  t.true(Array.isArray(res.body.devices));
});

test('should reject trusted devices list for non-admin', async t => {
  const { app } = t.context;

  const user = await app.createUser('regular-user@affine.pro');
  await app.login(user);

  const res = await app
    .GET('/api/auth/admin/trusted-devices')
    .expect(HttpStatus.FORBIDDEN);

  t.is(res.status, HttpStatus.FORBIDDEN);
});

test('should revoke specific admin trusted device', async t => {
  const { app, models } = t.context;

  const admin = await app.createUser('admin-revoke@affine.pro');
  await models.userFeature.add(admin.id, 'administrator', 'test admin');
  await app.login(admin);

  const fingerprint = 'test-device-fingerprint-123';

  const revokeRes = await app
    .DELETE(`/api/auth/admin/trusted-devices?fingerprint=${fingerprint}`)
    .expect(HttpStatus.OK);

  t.is(typeof revokeRes.body.removed, 'number');
});

test('should revoke all admin trusted devices', async t => {
  const { app, models } = t.context;

  const admin = await app.createUser('admin-revoke-all@affine.pro');
  await models.userFeature.add(admin.id, 'administrator', 'test admin');
  await app.login(admin);

  const revokeRes = await app
    .DELETE('/api/auth/admin/trusted-devices')
    .expect(HttpStatus.OK);

  t.is(typeof revokeRes.body.removed, 'number');
});

test('should reject trusted device revoke for non-admin', async t => {
  const { app } = t.context;

  const user = await app.createUser('regular-revoke@affine.pro');
  await app.login(user);

  const res = await app
    .DELETE('/api/auth/admin/trusted-devices')
    .expect(HttpStatus.FORBIDDEN);

  t.is(res.status, HttpStatus.FORBIDDEN);
});

test('should record sign in client version when header is provided', async t => {
  const { app, db } = t.context;

  const u1 = await app.createUser('u1@affine.pro');

  await app
    .POST('/api/auth/sign-in')
    .set('x-affine-version', '0.25.1')
    .send({ email: u1.email, password: u1.password })
    .expect(200);

  const userSession1 = await db.userSession.findFirst({
    where: { userId: u1.id },
  });
  t.is(userSession1?.signInClientVersion, '0.25.1');

  // should not overwrite existing value with null/undefined
  await app
    .POST('/api/auth/sign-in')
    .send({ email: u1.email, password: u1.password })
    .expect(200);

  const userSession2 = await db.userSession.findFirst({
    where: { userId: u1.id },
  });
  t.is(userSession2?.signInClientVersion, '0.25.1');
});

test('should be able to sign in with email', async t => {
  const { app } = t.context;

  const u1 = await app.createUser('u1@affine.pro');

  const res = await app
    .POST('/api/auth/sign-in')
    .send({ email: u1.email })
    .expect(200);

  t.is(res.body.email, u1.email);
  const signInMail = app.mails.last('SignIn');

  t.is(signInMail.to, u1.email);

  const url = new URL(signInMail.props.url);
  const email = url.searchParams.get('email');
  const token = url.searchParams.get('token');

  await app.POST('/api/auth/magic-link').send({ email, token }).expect(201);

  const session = await currentUser(app);
  t.is(session?.id, u1.id);
});

test('should be able to sign up with email', async t => {
  const { app } = t.context;

  const res = await app
    .POST('/api/auth/sign-in')
    .send({ email: 'u2@affine.pro' })
    .expect(200);

  t.is(res.body.email, 'u2@affine.pro');
  const signUpMail = app.mails.last('SignUp');

  t.is(signUpMail.to, 'u2@affine.pro');

  const url = new URL(signUpMail.props.url);
  const email = url.searchParams.get('email');
  const token = url.searchParams.get('token');

  await app.POST('/api/auth/magic-link').send({ email, token }).expect(201);

  const session = await currentUser(app);
  t.is(session?.email, 'u2@affine.pro');
});

test('should not be able to sign in if email is invalid', async t => {
  const { app } = t.context;

  const res = await app
    .POST('/api/auth/sign-in')
    .send({ email: '' })
    .expect(400);

  t.is(res.body.message, 'An invalid email provided: ');
});

test('should not be able to sign in if forbidden', async t => {
  const { app, auth } = t.context;

  const u1 = await app.createUser('u1@affine.pro');
  const canSignInStub = Sinon.stub(auth, 'canSignIn').resolves(false);

  await app
    .POST('/api/auth/sign-in')
    .send({ email: u1.email })
    .expect(HttpStatus.FORBIDDEN);

  canSignInStub.restore();
  t.pass();
});

test('should forbid magic link with external callbackUrl', async t => {
  const { app } = t.context;

  const u1 = await app.createUser('u1@affine.pro');

  await app
    .POST('/api/auth/sign-in')
    .send({
      email: u1.email,
      callbackUrl: 'https://evil.example/magic-link',
    })
    .expect(HttpStatus.FORBIDDEN);
  t.pass();
});

test('should forbid magic link with untrusted redirect_uri in callbackUrl', async t => {
  const { app } = t.context;

  const u1 = await app.createUser('u1@affine.pro');

  await app
    .POST('/api/auth/sign-in')
    .send({
      email: u1.email,
      callbackUrl: '/magic-link?redirect_uri=https://evil.example',
    })
    .expect(HttpStatus.FORBIDDEN);
  t.pass();
});

test('should be able to sign out', async t => {
  const { app } = t.context;

  const u1 = await app.createUser('u1@affine.pro');

  await app
    .POST('/api/auth/sign-in')
    .send({ email: u1.email, password: u1.password })
    .expect(200);

  await app.POST('/api/auth/sign-out').expect(200);

  const session = await currentUser(app);

  t.falsy(session);
});

test('should reject sign out when csrf header is missing in strict mode', async t => {
  const { app } = t.context;

  const u1 = await app.createUser('u1@affine.pro');

  const signInRes = await supertest(app.getHttpServer())
    .post('/api/auth/sign-in')
    .send({ email: u1.email, password: u1.password })
    .expect(200);

  const cookies = parseCookies(signInRes);
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

  await supertest(app.getHttpServer())
    .post('/api/auth/sign-out')
    .set('Cookie', cookieHeader)
    .expect(HttpStatus.FORBIDDEN);

  const sessionRes = await supertest(app.getHttpServer())
    .get('/api/auth/session')
    .set('Cookie', cookieHeader)
    .expect(200);

  t.truthy(sessionRes.body.user);
});

test('should be able to sign out when csrf header is missing in compat mode', async t => {
  const { app } = t.context;
  app.get(ConfigFactory).override({
    auth: {
      csrf: {
        strictSignOut: false,
      },
    },
  });

  const u1 = await app.createUser('u1@affine.pro');

  const signInRes = await supertest(app.getHttpServer())
    .post('/api/auth/sign-in')
    .send({ email: u1.email, password: u1.password })
    .expect(200);

  const cookies = parseCookies(signInRes);
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

  await supertest(app.getHttpServer())
    .post('/api/auth/sign-out')
    .set('Cookie', cookieHeader)
    .expect(200);

  const sessionRes = await supertest(app.getHttpServer())
    .get('/api/auth/session')
    .set('Cookie', cookieHeader)
    .expect(200);

  t.falsy(sessionRes.body.user);
});

test('should be able to sign out when duplicated csrf cookies exist', async t => {
  const { app } = t.context;

  const u1 = await app.createUser('u1@affine.pro');

  const signInRes = await supertest(app.getHttpServer())
    .post('/api/auth/sign-in')
    .send({ email: u1.email, password: u1.password })
    .expect(200);

  const cookies = parseCookies(signInRes);
  const csrf = cookies[AuthService.csrfCookieName];

  const cookieHeader = [
    `${AuthService.sessionCookieName}=${cookies[AuthService.sessionCookieName]}`,
    `${AuthService.userCookieName}=${cookies[AuthService.userCookieName]}`,
    `${AuthService.csrfCookieName}=${csrf}`,
    `${AuthService.csrfCookieName}=${randomUUID()}`,
  ].join('; ');

  await supertest(app.getHttpServer())
    .post('/api/auth/sign-out')
    .set('Cookie', cookieHeader)
    .set('x-affine-csrf-token', csrf)
    .expect(200);

  const sessionRes = await supertest(app.getHttpServer())
    .get('/api/auth/session')
    .set('Cookie', cookieHeader)
    .expect(200);

  t.falsy(sessionRes.body.user);
});

test('should be able to sign out via GET /api/auth/sign-out (deprecated)', async t => {
  const { app } = t.context;

  const u1 = await app.createUser('u1@affine.pro');

  await app
    .POST('/api/auth/sign-in')
    .send({ email: u1.email, password: u1.password })
    .expect(200);

  const res = await app.GET('/api/auth/sign-out').expect(200);
  t.is(res.headers.deprecation, 'true');

  const session = await currentUser(app);
  t.falsy(session);
});

test('should reject sign out when csrf token mismatched', async t => {
  const { app } = t.context;

  const u1 = await app.createUser('u1@affine.pro');

  await app
    .POST('/api/auth/sign-in')
    .send({ email: u1.email, password: u1.password })
    .expect(200);

  await app
    .POST('/api/auth/sign-out')
    .set('x-affine-csrf-token', 'invalid')
    .expect(HttpStatus.FORBIDDEN);

  const session = await currentUser(app);
  t.is(session?.id, u1.id);
});

test('should sign in desktop app via one-time open-app code', async t => {
  const { app } = t.context;

  const u1 = await app.createUser('u1@affine.pro');

  await app
    .POST('/api/auth/sign-in')
    .send({ email: u1.email, password: u1.password })
    .expect(200);

  const codeRes = await app.POST('/api/auth/open-app/sign-in-code').expect(201);

  const code = codeRes.body.code as string;
  t.truthy(code);

  const exchangeRes = await supertest(app.getHttpServer())
    .post('/api/auth/open-app/sign-in')
    .send({ code })
    .expect(201);

  const exchangedCookies = exchangeRes.get('Set-Cookie') ?? [];
  t.true(
    exchangedCookies.some(c =>
      c.startsWith(`${AuthService.sessionCookieName}=`)
    )
  );

  const cookieHeader = exchangedCookies.map(c => c.split(';')[0]).join('; ');
  const sessionRes = await supertest(app.getHttpServer())
    .get('/api/auth/session')
    .set('Cookie', cookieHeader)
    .expect(200);

  t.is(sessionRes.body.user?.id, u1.id);

  // one-time use
  await supertest(app.getHttpServer())
    .post('/api/auth/open-app/sign-in')
    .send({ code })
    .expect(400)
    .expect({
      status: 400,
      code: 'Bad Request',
      type: 'BAD_REQUEST',
      name: 'INVALID_AUTH_STATE',
      message:
        'Invalid auth state. You might start the auth progress from another device.',
    });
});

test('should be able to correct user id cookie', async t => {
  const { app } = t.context;

  const u1 = await app.signupV1('u1@affine.pro');

  const req = app.GET('/api/auth/session');
  let cookies = req.get('cookie') as unknown as string[];
  cookies = cookies.filter(c => !c.startsWith(AuthService.userCookieName));
  cookies.push(`${AuthService.userCookieName}=invalid_user_id`);
  const res = await req.set('Cookie', cookies).expect(200);
  const setCookies = parseCookies(res);
  const userIdCookie = setCookies[AuthService.userCookieName];

  t.is(userIdCookie, u1.id);
});

test('should not throw on parse of a bad cookie', async t => {
  const badCookieKey = 'auth_session';
  const badCookieVal = '^13l3PK9qJs*J%X$MOOOIguhkqWvVh7*';

  const req = {
    headers: { cookie: `${badCookieKey}=${badCookieVal}` },
  } as IncomingMessage & { cookies?: Record<string, string> };

  t.notThrows(() => safeParseCookies(req));

  t.is(req.cookies?.[badCookieKey], badCookieVal);
});

// multiple accounts session tests
test('should be able to sign in another account in one session', async t => {
  const { app } = t.context;

  const u1 = await app.createUser('u1@affine.pro');
  const u2 = await app.createUser('u2@affine.pro');

  // sign in u1
  const res = await app
    .POST('/api/auth/sign-in')
    .send({ email: u1.email, password: u1.password })
    .expect(200);

  const cookies = parseCookies(res);

  // sign in u2 in the same session
  await app
    .POST('/api/auth/sign-in')
    .send({ email: u2.email, password: u2.password })
    .expect(200);

  // list [u1, u2]
  const sessions = await app.GET('/api/auth/sessions').expect(200);

  t.is(sessions.body.users.length, 2);
  t.like(
    sessions.body.users.map((u: any) => u.id),
    [u1.id, u2.id]
  );

  // default to latest signed in user: u2
  let session = await app.GET('/api/auth/session').expect(200);

  t.is(session.body.user.id, u2.id);

  // switch to u1
  session = await app
    .GET('/api/auth/session')
    .set(
      'Cookie',
      Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')
    )
    .expect(200);

  t.is(session.body.user.id, u1.id);
});

test('should be able to sign out multiple accounts in one session', async t => {
  const { app } = t.context;

  const u1 = await app.signupV1('u1@affine.pro');
  const u2 = await app.signupV1('u2@affine.pro');

  // sign out u2
  await app.POST(`/api/auth/sign-out?user_id=${u2.id}`).expect(200);

  // list [u1]
  let session = await app.GET('/api/auth/session').expect(200);
  t.is(session.body.user.id, u1.id);

  // sign in u2 in the same session
  await app
    .POST('/api/auth/sign-in')
    .send({ email: u2.email, password: u2.password })
    .expect(200);

  // sign out all account in session
  await app.POST('/api/auth/sign-out').expect(200);

  session = await app.GET('/api/auth/session').expect(200);
  t.falsy(session.body.user);
});

test('should be able to sign in with email and client nonce', async t => {
  const { app } = t.context;

  const clientNonce = randomUUID();
  const u1 = await app.createUser();

  const res = await app
    .POST('/api/auth/sign-in')
    .send({ email: u1.email, client_nonce: clientNonce })
    .expect(200);

  t.is(res.body.email, u1.email);
  const signInMail = app.mails.last('SignIn');

  t.is(signInMail.to, u1.email);

  const url = new URL(signInMail.props.url);
  const email = url.searchParams.get('email');
  const token = url.searchParams.get('token');

  await app
    .POST('/api/auth/magic-link')
    .send({ email, token, client_nonce: clientNonce })
    .expect(201);

  const session = await currentUser(app);
  t.is(session?.id, u1.id);
});

test('should not be able to sign in with email and client nonce if invalid', async t => {
  const { app } = t.context;

  const clientNonce = randomUUID();
  const u1 = await app.createUser();

  const res = await app
    .POST('/api/auth/sign-in')
    .send({ email: u1.email, client_nonce: clientNonce })
    .expect(200);

  t.is(res.body.email, u1.email);
  const signInMail = app.mails.last('SignIn');

  t.is(signInMail.to, u1.email);

  const url = new URL(signInMail.props.url);
  const email = url.searchParams.get('email');
  const token = url.searchParams.get('token');

  // invalid client nonce
  await app
    .POST('/api/auth/magic-link')
    .send({ email, token, client_nonce: randomUUID() })
    .expect(400)
    .expect({
      status: 400,
      code: 'Bad Request',
      type: 'BAD_REQUEST',
      name: 'INVALID_AUTH_STATE',
      message:
        'Invalid auth state. You might start the auth progress from another device.',
    });
  // no client nonce
  await app
    .POST('/api/auth/magic-link')
    .send({ email, token })
    .expect(400)
    .expect({
      status: 400,
      code: 'Bad Request',
      type: 'BAD_REQUEST',
      name: 'INVALID_AUTH_STATE',
      message:
        'Invalid auth state. You might start the auth progress from another device.',
    });

  const session = await currentUser(app);
  t.falsy(session);
});

test('should not be able to sign in if token is invalid', async t => {
  const { app } = t.context;

  const res = await app
    .POST('/api/auth/magic-link')
    .send({ email: 'u1@affine.pro', token: 'invalid' })
    .expect(400);

  t.is(res.body.message, 'An invalid email token provided.');
});

test('should not allow magic link OTP replay', async t => {
  const { app } = t.context;

  const u1 = await app.createUser('u1@affine.pro');

  await app.POST('/api/auth/sign-in').send({ email: u1.email }).expect(200);
  const signInMail = app.mails.last('SignIn');
  const url = new URL(signInMail.props.url);
  const email = url.searchParams.get('email');
  const token = url.searchParams.get('token');

  await app.POST('/api/auth/magic-link').send({ email, token }).expect(201);

  await app
    .POST('/api/auth/magic-link')
    .send({ email, token })
    .expect(400)
    .expect({
      status: 400,
      code: 'Bad Request',
      type: 'INVALID_INPUT',
      name: 'INVALID_EMAIL_TOKEN',
      message: 'An invalid email token provided.',
    });
  t.pass();
});

test('should lock magic link OTP after too many attempts', async t => {
  const { app } = t.context;

  const u1 = await app.createUser('u1@affine.pro');

  await app.POST('/api/auth/sign-in').send({ email: u1.email }).expect(200);
  const signInMail = app.mails.last('SignIn');
  const url = new URL(signInMail.props.url);
  const email = url.searchParams.get('email');
  const token = url.searchParams.get('token') as string;

  const wrongOtp = token === '000000' ? '000001' : '000000';

  for (let i = 0; i < 10; i++) {
    await app
      .POST('/api/auth/magic-link')
      .send({ email, token: wrongOtp })
      .expect(400);
  }

  await app.POST('/api/auth/magic-link').send({ email, token }).expect(400);

  const session = await currentUser(app);
  t.falsy(session);
});
