import type { RequestHandler } from 'express';
import type { AdrSnapshot } from '../../src/shared/adr.js';
export function createAdrHandler(read: () => Promise<AdrSnapshot>): RequestHandler {
  return async (_req, res) => {
    try {
      const snapshot = await read();
      res.setHeader('Cache-Control', snapshot.items.length ? 'public, max-age=30' : 'no-store');
      res.status(snapshot.items.length ? 200 : 503).json(snapshot);
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      res.status(503).json({ error: 'ADR quotes are unavailable' });
    }
  };
}
