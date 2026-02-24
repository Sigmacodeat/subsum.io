import { NextFunction, Request, Response } from 'express';

/**
 * Security headers middleware.
 * Sets a minimal but effective set of HTTP security headers on every response.
 * Does NOT set Content-Security-Policy here because CSP for a SaaS with
 * dynamic origins is best managed at the reverse-proxy / CDN layer.
 * We do set the headers that are safe to apply globally without breaking
 * any legitimate functionality.
 */
export const securityHeaders = (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Disallow embedding in iframes from other origins (clickjacking protection)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Enable XSS auditor in older browsers (no-op in modern ones, harmless)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Enforce HTTPS for 1 year, include subdomains
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );

  // Restrict referrer information to same-origin only
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Disable browser features that are not needed by the API
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );

  next();
};
