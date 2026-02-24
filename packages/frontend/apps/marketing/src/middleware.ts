import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { locales } from './i18n/config';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const url = new URL(request.url);

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
    url.pathname = `/de-DE${rest}`;
    return NextResponse.redirect(url, 308);
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
