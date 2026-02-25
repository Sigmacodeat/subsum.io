import { test } from '@affine-test/kit/playwright';
import {
  createRandomUser,
  deleteUser,
  getLoginCookie,
  loginUser,
} from '@affine-test/kit/utils/cloud';
import { expect } from '@playwright/test';

let user: {
  id: string;
  name: string;
  email: string;
  password: string;
};

test.beforeEach(async ({ page }) => {
  user = await createRandomUser();
  await loginUser(page, user);
});

test.afterEach(async () => {
  await deleteUser(user.email);
});

test('SSOT smoke: auth cookies are host-scoped and have safe flags', async ({
  context,
}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL as string | undefined;
  expect(
    baseURL,
    'baseURL must be configured in playwright config'
  ).toBeTruthy();

  const expected = new URL(baseURL!);

  const sid = await getLoginCookie(context);
  expect(sid, 'Expected sid cookie to be set after login').toBeTruthy();

  expect(sid!.domain, 'sid cookie domain must match app host').toBe(
    expected.hostname
  );
  expect(
    sid!.domain.startsWith('.'),
    'sid cookie must not be a broad domain cookie'
  ).toBe(false);

  expect(sid!.secure, 'sid cookie Secure flag must match https baseURL').toBe(
    expected.protocol === 'https:'
  );

  expect(sid!.sameSite, 'sid cookie SameSite must not be None').not.toBe(
    'None'
  );
});

test('SSOT smoke: CORS does not allow unknown origins', async ({
  page,
}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL as string | undefined;
  expect(
    baseURL,
    'baseURL must be configured in playwright config'
  ).toBeTruthy();

  const expectedOrigin = new URL(baseURL!).origin;

  const evilOrigin = 'https://evil.example';

  const res = await page.request.fetch(
    new URL('/api/auth/session', baseURL).toString(),
    {
      method: 'OPTIONS',
      headers: {
        Origin: evilOrigin,
        'Access-Control-Request-Method': 'GET',
      },
    }
  );

  const allowOrigin = res.headers()['access-control-allow-origin'];

  expect(
    allowOrigin,
    'Server must not reflect unknown Origin in Access-Control-Allow-Origin'
  ).not.toBe(evilOrigin);

  if (allowOrigin) {
    expect(
      allowOrigin,
      'If Access-Control-Allow-Origin is present, it must be the expected app origin'
    ).toBe(expectedOrigin);
  }
});

test('SSOT smoke: oauth preflight forbids untrusted redirect_uri', async ({
  page,
}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL as string | undefined;
  expect(
    baseURL,
    'baseURL must be configured in playwright config'
  ).toBeTruthy();

  const res = await page.request.post(
    new URL('/api/oauth/preflight', baseURL).toString(),
    {
      data: {
        provider: 'Google',
        client_nonce: 'ssot-smoke',
        redirect_uri: 'https://evil.example',
      },
    }
  );

  expect(res.status()).toBe(403);
});
