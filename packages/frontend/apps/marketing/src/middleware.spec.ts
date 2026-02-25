import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { intlMiddlewareMock } = vi.hoisted(() => ({
  intlMiddlewareMock: vi.fn(),
}));

vi.mock('next-intl/middleware', () => ({
  default: () => intlMiddlewareMock,
}));

import middleware from './middleware';

type RequestOptions = {
  cookieLocale?: string;
  headers?: Record<string, string>;
};

function createRequest(url: string, options: RequestOptions = {}): NextRequest {
  const headers = new Headers(options.headers);

  return {
    url,
    headers,
    cookies: {
      get: (name: string) =>
        name === 'NEXT_LOCALE' && options.cookieLocale
          ? { name, value: options.cookieLocale }
          : undefined,
    },
  } as unknown as NextRequest;
}

describe('marketing locale middleware', () => {
  beforeEach(() => {
    intlMiddlewareMock.mockReset();
    intlMiddlewareMock.mockReturnValue(new Response(null, { status: 200 }));
  });

  it('redirects /de to /de-AT for AT geolocation', () => {
    const request = createRequest('https://subsum.io/de', {
      headers: { 'x-vercel-ip-country': 'AT' },
    });

    const response = middleware(request);

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://subsum.io/de-AT');
  });

  it('corrects existing de-DE path to de-AT when request geolocation is AT', () => {
    const request = createRequest('https://subsum.io/de-DE/pricing', {
      headers: { 'x-vercel-ip-country': 'AT' },
    });

    const response = middleware(request);

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://subsum.io/de-AT/pricing/');
    expect(response.cookies.get('NEXT_LOCALE')?.value).toBe('de-AT');
  });

  it('prefers accept-language over cookie for locale selection on root path', () => {
    const request = createRequest('https://subsum.io/', {
      cookieLocale: 'de-DE',
      headers: {
        'accept-language': 'de;q=1,en;q=0.8',
        'x-vercel-ip-country': 'AT',
      },
    });

    const response = middleware(request);

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://subsum.io/de-AT/');
    expect(response.cookies.get('NEXT_LOCALE')?.value).toBe('de-AT');
  });

  it('resolves ?lang=de dynamically to de-AT in Austria', () => {
    const request = createRequest('https://subsum.io/?lang=de', {
      headers: { 'x-vercel-ip-country': 'AT' },
    });

    const response = middleware(request);

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://subsum.io/de-AT/');
    expect(response.cookies.get('NEXT_LOCALE')?.value).toBe('de-AT');
  });

  it('resolves ?lang=de dynamically to de-CH in Switzerland', () => {
    const request = createRequest('https://subsum.io/?lang=de', {
      headers: { 'x-vercel-ip-country': 'CH' },
    });

    const response = middleware(request);

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://subsum.io/de-CH/');
    expect(response.cookies.get('NEXT_LOCALE')?.value).toBe('de-CH');
  });

  it('resolves french accept-language to fr-CH in Switzerland', () => {
    const request = createRequest('https://subsum.io/', {
      headers: {
        'accept-language': 'fr;q=1,en;q=0.8',
        'x-vercel-ip-country': 'CH',
      },
    });

    const response = middleware(request);

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://subsum.io/fr-CH/');
    expect(response.cookies.get('NEXT_LOCALE')?.value).toBe('fr-CH');
  });

  it('resolves italian accept-language to it-CH in Switzerland', () => {
    const request = createRequest('https://subsum.io/', {
      headers: {
        'accept-language': 'it;q=1,en;q=0.8',
        'x-vercel-ip-country': 'CH',
      },
    });

    const response = middleware(request);

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://subsum.io/it-CH/');
    expect(response.cookies.get('NEXT_LOCALE')?.value).toBe('it-CH');
  });

  it('prefers cf-ipcountry over x-vercel-ip-country when both are present', () => {
    const request = createRequest('https://subsum.io/?lang=de', {
      headers: {
        'cf-ipcountry': 'CH',
        'x-vercel-ip-country': 'AT',
      },
    });

    const response = middleware(request);

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://subsum.io/de-CH/');
    expect(response.cookies.get('NEXT_LOCALE')?.value).toBe('de-CH');
  });

  it('falls back to x-vercel-ip-country when cf-ipcountry is invalid', () => {
    const request = createRequest('https://subsum.io/?lang=de', {
      headers: {
        'cf-ipcountry': 'XXY',
        'x-vercel-ip-country': 'AT',
      },
    });

    const response = middleware(request);

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://subsum.io/de-AT/');
    expect(response.cookies.get('NEXT_LOCALE')?.value).toBe('de-AT');
  });

  it('normalizes x-country values with lowercase and whitespace', () => {
    const request = createRequest('https://subsum.io/?lang=de', {
      headers: {
        'x-country': ' at ',
      },
    });

    const response = middleware(request);

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://subsum.io/de-AT/');
    expect(response.cookies.get('NEXT_LOCALE')?.value).toBe('de-AT');
  });
});
