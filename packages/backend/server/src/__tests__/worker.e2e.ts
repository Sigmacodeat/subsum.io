import { LookupAddress } from 'node:dns';

import type { ExecutionContext, TestFn } from 'ava';
import ava from 'ava';
import { PrismaClient } from '@prisma/client';
import Sinon from 'sinon';
import type { Response } from 'supertest';

import {
  __resetDnsLookupForTests,
  __setDnsLookupForTests,
  type DnsLookup,
} from '../base/utils/ssrf';
import { debugProcessHolding } from './utils/utils';
import { createTestingApp, TestingApp } from './utils';

type TestContext = {
  app: TestingApp;
};
const test = ava as TestFn<TestContext>;

const LookupAddressStub = (async (_hostname, options) => {
  const result = [{ address: '76.76.21.21', family: 4 }] as LookupAddress[];
  const isOptions = options && typeof options === 'object';
  if (isOptions && 'all' in options && options.all) {
    return result;
  }
  return result[0];
}) as DnsLookup;

test.before(async t => {
  // @ts-expect-error test
  env.DEPLOYMENT_TYPE = 'selfhosted';

  // Avoid relying on real DNS during tests. SSRF protection uses dns.lookup().
  __setDnsLookupForTests(LookupAddressStub);

  const app = await createTestingApp({
    disableWebSocketAdapter: true,
  });

  t.context.app = app;
});

test.after.always(async t => {
  Sinon.restore();
  __resetDnsLookupForTests();

  const prisma = t.context.app.get(PrismaClient, { strict: false });
  if (prisma) {
    await prisma.$disconnect();
  }

  const server = t.context.app.getHttpServer();
  server.closeAllConnections?.();
  server.closeIdleConnections?.();

  await t.context.app.close();

  if (process.env.DEBUG_TEST_HOLDING === '1') {
    debugProcessHolding();
  }
});

const assertAndSnapshotRaw = async (
  t: ExecutionContext<TestContext>,
  route: string,
  message: string,
  options?: {
    status?: number;
    origin?: string | null;
    referer?: string | null;
    method?: 'GET' | 'OPTIONS' | 'POST';
    body?: any;
    checker?: (res: Response) => any;
  }
) => {
  const {
    status = 200,
    origin = 'http://localhost:3010',
    referer,
    method = 'GET',
    checker = () => {},
  } = options || {};
  const { app } = t.context;
  const req = app[method](route);
  if (origin) {
    req.set('Origin', origin);
  }
  if (referer) {
    req.set('Referer', referer);
  }

  const res = req.send(options?.body).expect(status).expect(checker);
  await t.notThrowsAsync(res, message);
  t.snapshot((await res).body);
};

test('should proxy image', async t => {
  const assertAndSnapshot = assertAndSnapshotRaw.bind(null, t);

  await assertAndSnapshot(
    '/api/worker/image-proxy',
    'should return proper CORS headers on OPTIONS request',
    {
      status: 204,
      method: 'OPTIONS',
      checker: (res: Response) => {
        if (!res.headers['access-control-allow-methods']) {
          throw new Error('Missing CORS headers');
        }
      },
    }
  );

  {
    await assertAndSnapshot(
      '/api/worker/image-proxy',
      'should return 400 if "url" query parameter is missing',
      { status: 400 }
    );
  }

  {
    await assertAndSnapshot(
      '/api/worker/image-proxy?url=http://example.com/image.png',
      'should return 400 if origin and referer are missing',
      { status: 400, origin: null, referer: null }
    );
  }

  {
    await assertAndSnapshot(
      '/api/worker/image-proxy?url=http://example.com/image.png',
      'should return 400 for invalid origin header',
      { status: 400, origin: 'http://invalid.com' }
    );
  }

  {
    const fakeBuffer = Buffer.from('fake image');
    const fakeResponse = new Response(fakeBuffer, {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'content-disposition': 'inline',
      },
    });

    const fetchSpy = Sinon.stub(global, 'fetch').resolves(fakeResponse);

    await assertAndSnapshot(
      '/api/worker/image-proxy?url=http://example.com/image.png',
      'should return image buffer'
    );

    fetchSpy.restore();
  }
});

test('should serve releases with rollout filtering', async t => {
  const fakeGitHubReleases = [
    {
      html_url: 'https://github.com/toeverything/AFFiNE/releases/tag/v1.0.0',
      name: '1.0.0',
      tag_name: 'v1.0.0',
      body: 'stable release 1',
      draft: false,
      prerelease: false,
      published_at: '2026-02-28T00:00:00Z',
      assets: [
        {
          name: 'release-go-no-go.json',
          size: 88,
          browser_download_url: 'https://example.com/release-go-no-go-v1.0.0.json',
        },
      ],
    },
    {
      html_url: 'https://github.com/toeverything/AFFiNE/releases/tag/v0.9.0',
      name: '0.9.0',
      tag_name: 'v0.9.0',
      body: 'stable release 0.9.0',
      draft: false,
      prerelease: false,
      published_at: '2026-02-20T00:00:00Z',
      assets: [],
    },
  ];

  const fetchStub = Sinon.stub(global, 'fetch').callsFake((input: any) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/repos/toeverything/AFFiNE/releases')) {
      return Promise.resolve(
        new Response(JSON.stringify(fakeGitHubReleases), { status: 200 })
      );
    }
    if (url === 'https://example.com/release-go-no-go-v1.0.0.json') {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            releaseInputs: { desktopRolloutPercentage: '10' },
          }),
          { status: 200 }
        )
      );
    }

    return Promise.resolve(new Response('not found', { status: 404 }));
  });

  const { app } = t.context;
  try {
    const invalidRollout = await app
      .GET('/api/worker/releases?channel=stable&rolloutBucket=101')
      .expect(400);
    t.true((invalidRollout.body?.message ?? '').includes('Invalid rolloutBucket'));

    const filtered = await app
      .GET('/api/worker/releases?channel=stable&minimal=true&rolloutBucket=50')
      .expect(200);
    t.is(Array.isArray(filtered.body), true);
    t.is(filtered.body.length, 1);
    t.is(filtered.body[0]?.tag_name, 'v0.9.0');
  } finally {
    fetchStub.restore();
  }
});

test('should preview link', async t => {
  const assertAndSnapshot = assertAndSnapshotRaw.bind(null, t);

  await assertAndSnapshot(
    '/api/worker/link-preview',
    'should return proper CORS headers on OPTIONS request',
    {
      status: 204,
      method: 'OPTIONS',
      checker: (res: Response) => {
        if (!res.headers['access-control-allow-methods']) {
          throw new Error('Missing CORS headers');
        }
      },
    }
  );

  await assertAndSnapshot(
    '/api/worker/link-preview',
    'should return 400 if request body is invalid',
    { status: 400, method: 'POST' }
  );

  await assertAndSnapshot(
    '/api/worker/link-preview',
    'should return 400 if origin and referer are missing',
    {
      status: 400,
      method: 'POST',
      origin: null,
      referer: null,
      body: { url: 'http://external.com/page' },
    }
  );

  await assertAndSnapshot(
    '/api/worker/link-preview',
    'should return 400 if provided URL is from the same origin',
    { status: 400, method: 'POST', body: { url: 'http://localhost/somepage' } }
  );

  {
    const fakeHTML = new Response(`
        <html>
          <head>
            <meta property="og:title" content="Test Title" />
            <meta property="og:description" content="Test Description" />
            <meta property="og:image" content="http://example.com/image.png" />
          </head>
          <body>
            <title>Fallback Title</title>
          </body>
        </html>
      `);

    Object.defineProperty(fakeHTML, 'url', {
      value: 'http://example.com/page',
    });

    const fetchSpy = Sinon.stub(global, 'fetch').resolves(fakeHTML);

    await assertAndSnapshot(
      '/api/worker/link-preview',
      'should process a valid external URL and return link preview data',
      {
        status: 200,
        method: 'POST',
        body: { url: 'http://external.com/page' },
      }
    );

    fetchSpy.restore();
  }

  {
    const encoded = [
      {
        content: 'xOO6w6OsysC956Gj',
        charset: 'gb2312',
      },
      {
        content: 'grGC8YLJgr+CzYFBkKKKRYFC',
        charset: 'shift-jis',
      },
      {
        content: 'p0GmbqFBpUCsyaFD',
        charset: 'big5',
      },
      {
        content: 'vsiz58fPvLy/5CwgvLyw6C4=',
        charset: 'euc-kr',
      },
    ];

    for (const { content, charset } of encoded) {
      const before = Buffer.from(`<html>
          <head>
            <meta http-equiv="Content-Type" content="text/html; charset=${charset}" />
            <meta property="og:title" content="`);
      const encoded = Buffer.from(content, 'base64');
      const after = Buffer.from(`" />
          </head>
        </html>
      `);
      const fakeHTML = new Response(Buffer.concat([before, encoded, after]));

      Object.defineProperty(fakeHTML, 'url', {
        value: `http://example.com/${charset}`,
      });

      const fetchSpy = Sinon.stub(global, 'fetch').resolves(fakeHTML);

      await assertAndSnapshot(
        '/api/worker/link-preview',
        'should decode HTML content with charset',
        {
          status: 200,
          method: 'POST',
          body: { url: `http://example.com/${charset}` },
        }
      );

      fetchSpy.restore();
    }
  }
});
