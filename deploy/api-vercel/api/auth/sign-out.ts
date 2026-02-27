import type { VercelRequest, VercelResponse } from '@vercel/node';

import { clearAuthCookie } from './_shared';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({
      code: 'METHOD_NOT_ALLOWED',
      message: 'Method not allowed',
    });
  }

  clearAuthCookie(res);
  return res.status(200).json({ success: true });
}
