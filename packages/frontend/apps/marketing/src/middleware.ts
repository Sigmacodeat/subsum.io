import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { locales } from './i18n/config';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

function normalizeRequestedLocale(locale: string | null | undefined) {
  if (!locale) return null;
  const trimmed = locale.trim();
  if (!trimmed) return null;
  const [rawLanguage, rawRegion] = trimmed.split('-');
  const language = rawLanguage?.toLowerCase();
  if (!language) return null;
  if (!rawRegion) return language;
  return `${language}-${rawRegion.toUpperCase()}`;
}

function isSupportedLocale(locale: string | null): locale is (typeof locales)[number] {
  return !!locale && locales.includes(locale as any);
}

function resolveSupportedLocale(
  requestedLocale: string | null,
  geoCountry: string | null
): (typeof locales)[number] | null {
  if (!requestedLocale) return null;

  const [baseLanguage, rawRegion] = requestedLocale.split('-');
  if (!baseLanguage) return null;

  if (rawRegion && isSupportedLocale(requestedLocale)) return requestedLocale;

  if (baseLanguage === 'de') {
    if (geoCountry === 'AT' && isSupportedLocale('de-AT')) return 'de-AT';
    if (geoCountry === 'CH' && isSupportedLocale('de-CH')) return 'de-CH';
    if (isSupportedLocale('de-DE')) return 'de-DE';
  }

  if (baseLanguage === 'fr') {
    if (geoCountry === 'CH' && isSupportedLocale('fr-CH')) return 'fr-CH';
    if (isSupportedLocale('fr')) return 'fr';
    if (isSupportedLocale('fr-FR')) return 'fr-FR';
  }

  if (baseLanguage === 'it') {
    if (geoCountry === 'CH' && isSupportedLocale('it-CH')) return 'it-CH';
    if (isSupportedLocale('it')) return 'it';
    if (isSupportedLocale('it-IT')) return 'it-IT';
  }

  const direct = isSupportedLocale(baseLanguage) ? baseLanguage : null;
  if (direct) return direct;

  return null;
}

function resolveGeoAdjustedPathLocale(
  pathLocale: (typeof locales)[number] | null,
  geoCountry: string | null
): (typeof locales)[number] | null {
  if (!pathLocale) return null;
  const [baseLanguage] = pathLocale.split('-');
  if (!baseLanguage || !['de', 'fr', 'it'].includes(baseLanguage)) return null;

  const geoPreferredLocale = resolveSupportedLocale(baseLanguage, geoCountry);
  if (!geoPreferredLocale || geoPreferredLocale === pathLocale) return null;

  return geoPreferredLocale;
}

function parseAcceptLanguage(headerValue: string | null) {
  if (!headerValue) return [] as Array<{ tag: string; q: number }>;
  return headerValue
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const [rawTag, ...params] = part.split(';').map(p => p.trim());
      const qParam = params.find(p => p.toLowerCase().startsWith('q='));
      const q = qParam ? Number(qParam.slice(2)) : 1;
      return { tag: rawTag, q: Number.isFinite(q) ? q : 1 };
    })
    .sort((a, b) => b.q - a.q);
}

function resolveLocaleFromAcceptLanguage(
  acceptLanguage: string | null,
  geoCountry: string | null
): (typeof locales)[number] | null {
  const parsed = parseAcceptLanguage(acceptLanguage);

  for (const { tag } of parsed) {
    const resolved = resolveSupportedLocale(normalizeRequestedLocale(tag), geoCountry);
    if (resolved) return resolved;
  }

  return null;
}

function getGeoCountry(request: NextRequest) {
  const candidates = [
    request.headers.get('cf-ipcountry'),
    request.headers.get('x-vercel-ip-country'),
    request.headers.get('x-country'),
  ];

  for (const raw of candidates) {
    const value = raw?.trim().toUpperCase() ?? '';
    if (value && /^[A-Z]{2}$/.test(value)) {
      return value;
    }
  }

  return null;
}

function getPathLocale(pathname: string) {
  const [, firstSegment] = pathname.split('/');
  if (!firstSegment) return null;
  return locales.includes(firstSegment as any) ? (firstSegment as any) : null;
}

function buildRedirectUrl(
  request: NextRequest,
  targetLocale: (typeof locales)[number]
) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const segments = pathname.split('/').filter(Boolean);
  const currentLocale = segments[0] && locales.includes(segments[0] as any)
    ? (segments[0] as any)
    : null;
  const restSegments = currentLocale ? segments.slice(1) : segments;

  const nextPath =
    targetLocale === routing.defaultLocale
      ? `/${restSegments.join('/')}`
      : `/${targetLocale}/${restSegments.join('/')}`;
  url.pathname = nextPath === '/' ? '/' : nextPath.endsWith('/') ? nextPath : `${nextPath}/`;
  return url;
}

function setLocaleCookie(response: NextResponse, locale: string) {
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export default function middleware(request: NextRequest) {
  const url = new URL(request.url);
  const geoCountry = getGeoCountry(request);

  const queryLocaleRaw = url.searchParams.get('lang');
  const queryLocale = resolveSupportedLocale(
    normalizeRequestedLocale(queryLocaleRaw),
    geoCountry
  );

  if (url.pathname === '/workspace' || url.pathname.startsWith('/workspace/')) {
    url.pathname = '/';
    return NextResponse.redirect(url, 308);
  }

  const [, firstSegment, secondSegment] = url.pathname.split('/');
  if (
    firstSegment &&
    locales.includes(firstSegment as any) &&
    secondSegment === 'workspace'
  ) {
    url.pathname = `/${firstSegment}/`;
    return NextResponse.redirect(url, 308);
  }

  if (url.pathname === '/de' || url.pathname.startsWith('/de/')) {
    const rest = url.pathname === '/de' ? '' : url.pathname.slice('/de'.length);
    const germanLocale = resolveSupportedLocale('de', geoCountry) ?? 'de-DE';
    url.pathname = `/${germanLocale}${rest}`;
    return NextResponse.redirect(url, 308);
  }
  const pathLocale = getPathLocale(url.pathname);

  if (queryLocale && queryLocale !== pathLocale) {
    url.searchParams.delete('lang');
    const redirectUrl = buildRedirectUrl(request, queryLocale);
    redirectUrl.search = url.search;
    const response = NextResponse.redirect(redirectUrl, 308);
    setLocaleCookie(response, queryLocale);
    return response;
  }

  if (pathLocale && !queryLocale) {
    const geoAdjustedPathLocale = resolveGeoAdjustedPathLocale(pathLocale, geoCountry);
    if (geoAdjustedPathLocale) {
      const redirectUrl = buildRedirectUrl(request, geoAdjustedPathLocale);
      const response = NextResponse.redirect(redirectUrl, 308);
      setLocaleCookie(response, geoAdjustedPathLocale);
      return response;
    }
  }

  if (!pathLocale) {
    const resolvedCookieLocale = resolveSupportedLocale(
      normalizeRequestedLocale(request.cookies.get(LOCALE_COOKIE_NAME)?.value),
      geoCountry
    );

    const resolvedHeaderLocale = resolveLocaleFromAcceptLanguage(
      request.headers.get('accept-language'),
      geoCountry
    );

    const bestLocale =
      resolvedHeaderLocale || resolvedCookieLocale || routing.defaultLocale;

    if (bestLocale !== routing.defaultLocale) {
      const redirectUrl = buildRedirectUrl(request, bestLocale);
      const response = NextResponse.redirect(redirectUrl, 308);
      setLocaleCookie(response, bestLocale);
      return response;
    }
  }

  return intlMiddleware(request);
}

export const config = {
  // Ensure Next.js internal assets and direct file requests are not rewritten
  // into locale-prefixed paths (e.g. /en/_next/static/...), which would break CSS/JS.
  // Use a single regex-style matcher (Next.js pattern) to avoid accidental matches.
  // This must exclude /_next/static and /_next/image explicitly.
  matcher: [
    '/((?!api|_next/static|_next/image|robots\\.txt|sitemap\\.xml|.*\\..*).*)',
  ],
};
