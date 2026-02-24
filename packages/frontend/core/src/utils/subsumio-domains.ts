export type SubsumioSurface = 'marketing' | 'app' | 'portal' | 'api' | 'cdn';

export const SUBSUMIO_CANONICAL_ROOT_DOMAIN = 'subsum.io';
export const SUBSUMIO_ALIAS_ROOT_DOMAINS = ['subsumio.co'] as const;

export const SUBSUMIO_SURFACE_HOSTNAME: Record<SubsumioSurface, string> = {
  marketing: SUBSUMIO_CANONICAL_ROOT_DOMAIN,
  app: `app.${SUBSUMIO_CANONICAL_ROOT_DOMAIN}`,
  portal: `portal.${SUBSUMIO_CANONICAL_ROOT_DOMAIN}`,
  api: `api.${SUBSUMIO_CANONICAL_ROOT_DOMAIN}`,
  cdn: `cdn.${SUBSUMIO_CANONICAL_ROOT_DOMAIN}`,
};

export const SUBSUMIO_ALIAS_SURFACE_HOSTNAMES: Record<SubsumioSurface, string[]> = {
  marketing: SUBSUMIO_ALIAS_ROOT_DOMAINS.map(d => d),
  app: SUBSUMIO_ALIAS_ROOT_DOMAINS.map(d => `app.${d}`),
  portal: SUBSUMIO_ALIAS_ROOT_DOMAINS.map(d => `portal.${d}`),
  api: SUBSUMIO_ALIAS_ROOT_DOMAINS.map(d => `api.${d}`),
  cdn: SUBSUMIO_ALIAS_ROOT_DOMAINS.map(d => `cdn.${d}`),
};

export function getSubsumioCanonicalOrigin(surface: Exclude<SubsumioSurface, 'marketing'>) {
  return `https://${SUBSUMIO_SURFACE_HOSTNAME[surface]}`;
}

export function getSubsumioAllOrigins(surface: Exclude<SubsumioSurface, 'marketing'>) {
  return [
    getSubsumioCanonicalOrigin(surface),
    ...SUBSUMIO_ALIAS_SURFACE_HOSTNAMES[surface].map(h => `https://${h}`),
  ];
}

function normalizePath(path: string) {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

export function buildSubsumioUrl(input: {
  surface: Exclude<SubsumioSurface, 'marketing'>;
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
}) {
  const base = getSubsumioCanonicalOrigin(input.surface);
  const url = new URL(normalizePath(input.path), base);
  if (input.query) {
    for (const [k, v] of Object.entries(input.query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export function buildAppUrl(path: string, query?: Record<string, string | number | boolean | undefined | null>) {
  return buildSubsumioUrl({ surface: 'app', path, query });
}

export function buildPortalUrl(path: string, query?: Record<string, string | number | boolean | undefined | null>) {
  return buildSubsumioUrl({ surface: 'portal', path, query });
}

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/\.$/, '');
}

function hostnameMatchesDomain(hostname: string, domain: string) {
  const h = normalizeHostname(hostname);
  const d = normalizeHostname(domain);
  return h === d || h.endsWith(`.${d}`);
}

export function isSubsumioOrigin(origin: string) {
  try {
    const u = new URL(origin);
    const hostname = normalizeHostname(u.hostname);

    if (hostnameMatchesDomain(hostname, SUBSUMIO_CANONICAL_ROOT_DOMAIN)) {
      return true;
    }
    return SUBSUMIO_ALIAS_ROOT_DOMAINS.some(d => hostnameMatchesDomain(hostname, d));
  } catch {
    return false;
  }
}

export function isSubsumioAppLikeOrigin(origin: string, baseUrl: string) {
  // Keep existing behavior: always allow current baseUrl (localhost / self-hosted / custom domains).
  if (origin === baseUrl) return true;

  // Allow native / desktop `assets://` scheme.
  if (origin.startsWith('assets://')) return true;

  // Accept Subsumio official domains.
  if (isSubsumioOrigin(origin)) return true;

  // Backwards-compat: allow historical AFFiNE official origins.
  if (origin.endsWith('affine.pro')) return true;
  if (origin.endsWith('apple.getaffineapp.com')) return true;
  if (origin.endsWith('affine.fail')) return true;

  return false;
}
