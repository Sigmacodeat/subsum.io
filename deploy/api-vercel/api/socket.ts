import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Socket.io polling transport handshake stub
  return res.status(200).json({
    sid: 'stub',
    upgrades: [],
    pingInterval: 25000,
    pingTimeout: 20000,
    maxPayload: 1000000,
  });
}
