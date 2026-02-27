import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import type { VercelResponse } from '@vercel/node';

const AUTH_COOKIE_NAME = 'subsumio_auth_stub';
const AUTH_COOKIE_VALUE = '1';
const PENDING_OTP_COOKIE_NAME = 'subsumio_pending_otp';
const EXPIRE_COOKIE_VALUE = 'Max-Age=0';
const DEFAULT_COOKIE_VALUE = 'Max-Age=86400';
const OTP_TTL_SECONDS = 10 * 60;
const DEV_OTP_SECRET = 'dev-only-insecure-otp-secret';

type PendingOtpPayload = {
  email: string;
  otp: string;
  expiresAt: number;
};

function secureCookieFlag() {
  return process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
}

function appendSetCookie(res: VercelResponse, cookie: string) {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookie);
    return;
  }
  const values = Array.isArray(existing) ? existing : [String(existing)];
  res.setHeader('Set-Cookie', [...values, cookie]);
}

function cookieBase() {
  return `${AUTH_COOKIE_NAME}=${AUTH_COOKIE_VALUE}; Path=/; HttpOnly; SameSite=Lax; ${secureCookieFlag()}`;
}

function pendingOtpCookieBase(value: string) {
  return `${PENDING_OTP_COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; ${secureCookieFlag()}`;
}

function getOtpSecret() {
  const configured =
    process.env.AUTH_OTP_SECRET ?? process.env.AUTH_STUB_OTP_SECRET;
  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_OTP_SECRET is required in production.');
  }

  return DEV_OTP_SECRET;
}

function signPayload(payload: string) {
  return createHmac('sha256', getOtpSecret())
    .update(payload)
    .digest('base64url');
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function generateVerificationCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function createPendingOtpToken(email: string, otp: string) {
  const payload: PendingOtpPayload = {
    email,
    otp,
    expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
}

export function verifyPendingOtpToken(
  token: string | undefined,
  email: string,
  otp: string
) {
  if (!token) {
    return false;
  }

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return false;
  }

  const expectedSignature = signPayload(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as PendingOtpPayload;
    if (payload.email !== email) {
      return false;
    }
    if (payload.otp !== otp) {
      return false;
    }
    if (!Number.isFinite(payload.expiresAt) || payload.expiresAt < Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function readCookie(
  cookieHeader: string | undefined,
  cookieName: string
) {
  if (!cookieHeader) return undefined;

  const segments = cookieHeader.split(';');
  for (const segment of segments) {
    const [key, ...rest] = segment.trim().split('=');
    if (key === cookieName) {
      return rest.join('=');
    }
  }

  return undefined;
}

export function readPendingOtpCookie(cookieHeader: string | undefined) {
  return readCookie(cookieHeader, PENDING_OTP_COOKIE_NAME);
}

export function setAuthCookie(res: VercelResponse) {
  appendSetCookie(res, `${cookieBase()}${DEFAULT_COOKIE_VALUE}`);
}

export function clearAuthCookie(res: VercelResponse) {
  appendSetCookie(res, `${cookieBase()}${EXPIRE_COOKIE_VALUE}`);
}

export function setPendingOtpCookie(res: VercelResponse, token: string) {
  appendSetCookie(
    res,
    `${pendingOtpCookieBase(token)}Max-Age=${OTP_TTL_SECONDS}`
  );
}

export function clearPendingOtpCookie(res: VercelResponse) {
  appendSetCookie(res, `${pendingOtpCookieBase('')}${EXPIRE_COOKIE_VALUE}`);
}

export function hasAuthCookie(cookieHeader?: string): boolean {
  if (!cookieHeader) return false;

  return cookieHeader
    .split(';')
    .map(part => part.trim())
    .some(part => part === `${AUTH_COOKIE_NAME}=${AUTH_COOKIE_VALUE}`);
}

export const MOCK_USER = {
  id: 'subsumio-user-1',
  name: 'Subsumio User',
  email: 'user@subsum.io',
  avatarUrl: null,
};
