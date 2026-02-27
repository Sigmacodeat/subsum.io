import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    status: 'ok',
    service: 'subsumio-api-stub',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
}
