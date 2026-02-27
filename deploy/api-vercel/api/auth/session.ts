import type { VercelRequest, VercelResponse } from '@vercel/node';

import { hasAuthCookie, MOCK_USER } from './_shared';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'Method not allowed' });

  const cookieHeader = req.headers.cookie;
  const user = hasAuthCookie(cookieHeader) ? MOCK_USER : null;

  return res.status(200).json({ user });
}
