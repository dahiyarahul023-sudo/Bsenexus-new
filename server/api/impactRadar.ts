import express from 'express';
import { requireAuth, requireAdmin, apiRateLimiter } from '../security/auth.js';
import { listRadarEvents, getRadarEvent, listRadarUpdates, firstRadarUpdate, getRadarFollowing, setRadarFollowing, publishRadarRecords } from '../database/impactRadarDao.js';
import { getRadarMovement } from '../services/radarMovementService.js';
import { refreshRadarIntake, radarIntakeStatus } from '../services/impactRadarService.js';
import { RADAR_ID, isRadarEvent, isRadarUpdate, publicRadarEvent } from '../../src/shared/impactRadar.js';

export const impactRadarRouter = express.Router();
impactRadarRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
const unavailable = (res: express.Response) => res.status(503).json({ success: false, error: 'Impact Radar is unavailable. Please retry; previous information may be out of date.' });
impactRadarRouter.get('/', apiRateLimiter, async (_req, res) => {
  try {
    await refreshRadarIntake();
    const items = await listRadarEvents();
    res.json({ success: true, items, checkedAt: new Date().toISOString(), intake: radarIntakeStatus(), limit: 200 });
  } catch { unavailable(res); }
});
impactRadarRouter.get('/following', requireAuth, async (req, res) => {
  try { res.json({ success: true, ...await getRadarFollowing((req as any).user.uid) }); }
  catch { unavailable(res); }
});
impactRadarRouter.put('/:id/follow', requireAuth, apiRateLimiter, async (req, res) => {
  const id = String(req.params.id);
  if (!RADAR_ID.test(id) || typeof req.body?.followed !== 'boolean') return res.status(400).json({ success: false, error: 'Invalid event or tracking choice.' });
  try {
    if (!await getRadarEvent(id)) return res.status(404).json({ success: false, error: 'Event not found.' });
    await setRadarFollowing((req as any).user.uid, id, req.body.followed);
    res.json({ success: true, id, followed: req.body.followed });
  } catch { unavailable(res); }
});
// Explicit source-backed publishing also links later developments to an existing event ID.
impactRadarRouter.post('/admin/publish', requireAuth, requireAdmin, apiRateLimiter, async (req, res) => {
  const { event, update } = req.body || {};
  if (!isRadarEvent(event) || !isRadarUpdate(update) || update.eventId !== event.id || Date.parse(event.updatedAt) > Date.now() || Date.parse(update.publishedAt) > Date.now()) return res.status(400).json({ success: false, error: 'Use sourced facts, a listed Indian company and valid dates. Forecasts and trade recommendations are not accepted.' });
  try {
    const companies = await import('../utils/stockResolver.js');
    if (event.companies.some(c => companies.resolveStockDetailsSync(c.scripCode)?.symbol !== c.symbol)) return res.status(400).json({ success: false, error: 'Company identity must match the Indian stock master.' });
    await publishRadarRecords([{ event: publicRadarEvent(event), update }]);
    res.json({ success: true, id: event.id });
  } catch { unavailable(res); }
});
impactRadarRouter.get('/:id/movement', apiRateLimiter, async (req, res) => {
  if (!RADAR_ID.test(String(req.params.id))) return res.status(400).json({ success: false, error: 'Invalid event.' });
  try {
    const event = await getRadarEvent(String(req.params.id));
    if (!event) return res.status(404).json({ success: false, error: 'Event not found.' });
    res.json({ success: true, id: event.id, movement: await getRadarMovement(event) });
  } catch { unavailable(res); }
});
impactRadarRouter.get('/:id', apiRateLimiter, async (req, res) => {
  if (!RADAR_ID.test(String(req.params.id))) return res.status(400).json({ success: false, error: 'Invalid event.' });
  try {
    const event = await getRadarEvent(String(req.params.id));
    if (!event) return res.status(404).json({ success: false, error: 'Event not found.' });
    const [updates, firstUpdate, all] = await Promise.all([listRadarUpdates(event.id), firstRadarUpdate(event.id), listRadarEvents()]);
    const related = all.filter(e => e.id !== event.id && e.authority === event.authority && e.companies.some(c => event.companies.some(x => x.scripCode === c.scripCode))).slice(0, 8);
    res.json({ success: true, event, updates, firstUpdate, related, timelineLimit: 50 });
  } catch { unavailable(res); }
});
