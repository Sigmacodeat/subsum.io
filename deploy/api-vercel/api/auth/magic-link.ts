import type { VercelRequest, VercelResponse } from '@vercel/node';

import {
  clearPendingOtpCookie,
  readPendingOtpCookie,
  setAuthCookie,
  verifyPendingOtpToken,
} from './_shared';

type MagicLinkPayload = {
  email?: string;
  token?: string;
};

function parseBody(body: unknown): MagicLinkPayload {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as MagicLinkPayload;
    } catch {
      return {};
    }
  }

  if (body && typeof body === 'object') {
    return body as MagicLinkPayload;
  }

  return {};
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({
      code: 'METHOD_NOT_ALLOWED',
      message: 'Method not allowed',
    });
  }

  const body = parseBody(req.body);
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const token = typeof body.token === 'string' ? body.token.trim() : '';

  if (!email || !email.includes('@')) {
    return res.status(400).json({
      code: 'INVALID_EMAIL',
      message: 'Please provide a valid email address.',
    });
  }

  if (!/^\d{6}$/.test(token)) {
    return res.status(400).json({
      code: 'INVALID_TOKEN',
      message: 'Verification code must be a 6-digit number.',
    });
  }

  const pendingOtpToken = readPendingOtpCookie(req.headers.cookie);
  const valid = verifyPendingOtpToken(pendingOtpToken, email, token);
  if (!valid) {
    clearPendingOtpCookie(res);
    return res.status(400).json({
      code: 'INVALID_OR_EXPIRED_TOKEN',
      message:
        'Verification code is invalid or expired. Please request a new code.',
    });
  }

  clearPendingOtpCookie(res);
  setAuthCookie(res);
  return res.status(200).json({
    success: true,
    method: 'otp',
  });
}
