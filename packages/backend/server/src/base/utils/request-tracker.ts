import type { Request } from 'express';

function firstForwardedForIp(value?: string) {
  if (!value) {
    return;
  }

  const [first] = value.split(',', 1);
  const ip = first?.trim();

  return ip || undefined;
}

function firstNonEmpty(...values: Array<string | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return;
}

function getHeader(req: Request, key: string) {
  if (typeof req.get === 'function') {
    return req.get(key);
  }

  const value = req.headers?.[key.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }

  return typeof value === 'string' ? value : undefined;
}

export function getRequestClientIp(req: Request) {
  return (
    firstNonEmpty(
      getHeader(req, 'CF-Connecting-IP'),
      firstForwardedForIp(getHeader(req, 'X-Forwarded-For')),
      getHeader(req, 'X-Real-IP'),
      req.ip
    ) ?? ''
  );
}

export function getRequestTrackerId(req: Request) {
  return (
    req.session?.sessionId ??
    firstNonEmpty(
      getHeader(req, 'CF-Connecting-IP'),
      firstForwardedForIp(getHeader(req, 'X-Forwarded-For')),
      getHeader(req, 'X-Real-IP'),
      getHeader(req, 'CF-Ray'),
      req.ip
    ) ??
    ''
  );
}
