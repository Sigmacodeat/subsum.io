import type { VercelRequest, VercelResponse } from '@vercel/node';

import {
  clearPendingOtpCookie,
  createPendingOtpToken,
  generateVerificationCode,
  setAuthCookie,
  setPendingOtpCookie,
} from './_shared';

type SignInPayload = {
  email?: string;
  password?: string;
  callbackUrl?: string;
};

function isSafeCallbackUrl(
  callbackUrl: string | undefined
): callbackUrl is string {
  return typeof callbackUrl === 'string' && callbackUrl.startsWith('/');
}

function inferBaseUrl(req: VercelRequest) {
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader)
    ? protoHeader[0]
    : (protoHeader ?? 'https');
  const hostHeader = req.headers['x-forwarded-host'] ?? req.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  if (!host) {
    return null;
  }
  return `${proto}://${host}`;
}

async function sendVerificationEmail(
  req: VercelRequest,
  email: string,
  otp: string,
  callbackUrl: string
) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Email provider is not configured. Missing RESEND_API_KEY or AUTH_EMAIL_FROM.'
      );
    }
    return;
  }

  const baseUrl = inferBaseUrl(req);
  const link = baseUrl
    ? new URL(callbackUrl, baseUrl)
    : new URL(callbackUrl, 'https://app.subsum.io');

  link.searchParams.set('email', email);
  link.searchParams.set('token', otp);

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="margin: 0 0 12px;">Confirm your sign-in</h2>
      <p style="margin: 0 0 12px;">Use this verification code:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 3px; margin: 0 0 16px;">${otp}</p>
      <p style="margin: 0 0 12px;">Or continue directly with this magic link:</p>
      <p style="margin: 0 0 20px;"><a href="${link.toString()}">Continue sign-in</a></p>
      <p style="margin: 0; color: #6b7280; font-size: 12px;">This code expires in 10 minutes.</p>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: 'Your sign-in verification code',
      html,
      text: `Your verification code is ${otp}. This code expires in 10 minutes. Magic link: ${link.toString()}`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to send verification email: ${response.status} ${body}`
    );
  }
}

function parseBody(body: unknown): SignInPayload {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as SignInPayload;
    } catch {
      return {};
    }
  }

  if (body && typeof body === 'object') {
    return body as SignInPayload;
  }

  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({
      code: 'METHOD_NOT_ALLOWED',
      message: 'Method not allowed',
    });
  }

  const body = parseBody(req.body);
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password =
    typeof body.password === 'string' ? body.password.trim() : '';

  if (!email || !email.includes('@')) {
    return res.status(400).json({
      code: 'INVALID_EMAIL',
      message: 'Please provide a valid email address.',
    });
  }

  if (password) {
    setAuthCookie(res);
    return res.status(200).json({
      success: true,
      method: 'password',
    });
  }

  const otp = generateVerificationCode();
  const pendingOtpToken = createPendingOtpToken(email, otp);
  setPendingOtpCookie(res, pendingOtpToken);

  const callbackUrl = isSafeCallbackUrl(body.callbackUrl)
    ? body.callbackUrl
    : '/magic-link';

  try {
    await sendVerificationEmail(req, email, otp, callbackUrl);
    return res.status(200).json({
      success: true,
      method: 'magic-link',
      verificationRequired: true,
      message: 'Verification code sent.',
    });
  } catch (err) {
    console.error('[auth/sign-in] email dispatch failed', err);
    clearPendingOtpCookie(res);
    return res.status(503).json({
      code: 'EMAIL_DELIVERY_FAILED',
      message:
        'We could not send a verification email right now. Please try again shortly.',
    });
  }
}
