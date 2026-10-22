import express from 'express';
import { requireAuth, requireAdmin, apiRateLimiter } from '../security/auth.js';
import { listRadarEvents, listRadarCompanyReports, getRadarEvent, listRadarUpdates, listRadarTimelinePage, firstRadarUpdate, getRadarFollowing, setRadarFollowing, publishRadarRecords, getRadarCategories } from '../database/impactRadarDao.js';
import { parseRadarHistoryQuery, searchRadarHistory } from '../database/radarHistoryDao.js';
import { archiveRadarCase } from '../services/radarArchiveWorker.js';
import { readRadarResearch, refreshRadarResearchCase } from '../services/radarResearchService.js';
import { getSupabase } from '../database/supabase.js';
import { getRadarMovement } from '../services/radarMovementService.js';
import { durableRadarIntakeStatus } from '../services/impactRadarService.js';
import { RADAR_ID, isRadarEvent, isRadarEventInScope, isRadarUpdate, publicRadarEvent, validRadarDate, radarUrl } from '../../src/shared/impactRadar.js';

export const impactRadarRouter = express.Router();
impactRadarRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
const unavailable = (res: express.Response) => res.status(503).json({ success: false, error: 'Impact Radar is unavailable. Please retry; previous information may be out of date.' });
impactRadarRouter.get('/', apiRateLimiter, async (_req, res) => {
  try {
    const [items,intake] = await Promise.all([listRadarEvents(),durableRadarIntakeStatus()]);
    res.json({ success: true, items, checkedAt: new Date().toISOString(), intake, limit: 200 });
  } catch { unavailable(res); }
});
impactRadarRouter.get('/categories', apiRateLimiter, async (_req, res) => {
  try { res.json({ success: true, categories: await getRadarCategories() }); } catch { unavailable(res); }
});
impactRadarRouter.get('/history', apiRateLimiter, async (req,res)=>{
  const query=parseRadarHistoryQuery(req.query);
  if(!query)return res.status(400).json({success:false,error:'Use a search up to 120 characters, valid dates and a valid page cursor.'});
  try {res.json({success:true,...await searchRadarHistory(query),coverage:'Saved source-backed records only; this is not a complete two-year market dataset.'});}catch{unavailable(res);}
});
impactRadarRouter.get('/admin/storage',requireAuth,requireAdmin,apiRateLimiter,async(_req,res)=>{
  try{const r=await getSupabase().rpc('radar_storage_usage').abortSignal(AbortSignal.timeout(4000));if(r.error)throw r.error;res.json({success:true,usage:r.data,retention:'no-expiry',hotClosedMonths:24,independentBackupConfigured:(await import('../services/radarDriveBackup.js')).radarDriveConfigured()});}catch{unavailable(res);}
});
impactRadarRouter.post('/admin/archive/:id',requireAuth,requireAdmin,apiRateLimiter,async(req,res)=>{
  if(!RADAR_ID.test(String(req.params.id)))return res.status(400).json({success:false,error:'Invalid event.'});
  try{res.json({success:true,...await archiveRadarCase(String(req.params.id),false)});}catch{unavailable(res);}
});
// Explicit reviewed exchange calendar evidence. A failed daily report must never imply a closure.
impactRadarRouter.post('/admin/research/calendar',requireAuth,requireAdmin,apiRateLimiter,async(req,res)=>{
  const days=req.body?.days;
  if(!Array.isArray(days)||!days.length||days.length>200||days.some(d=>!validRadarDate(d?.date)||!['NSE','BSE'].includes(d.exchange)||typeof d.open!=='boolean'||!radarUrl(d.sourceUrl)||!/(^|\.)(nseindia|bseindia)\.com$/.test(new URL(d.sourceUrl).hostname)))return res.status(400).json({success:false,error:'Supply at most 200 source-reviewed official exchange calendar dates.'});
  try {
    const rows=days.map(d=>({session_date:d.date,exchange:d.exchange,is_open:d.open,source_url:d.sourceUrl}));
    const r=await getSupabase().from('impact_market_days').upsert(rows,{onConflict:'exchange,session_date',ignoreDuplicates:true}).abortSignal(AbortSignal.timeout(6000));
    if(r.error)throw r.error;res.json({success:true,submitted:rows.length});
  }catch{unavailable(res);}
});
impactRadarRouter.post('/admin/research/:id',requireAuth,requireAdmin,apiRateLimiter,async(req,res)=>{
  const id=String(req.params.id);if(!RADAR_ID.test(id))return res.status(400).json({success:false,error:'Invalid event.'});
  try {
    const row=await getSupabase().from('impact_radar_events').select('data,first_public_at').eq('id',id).abortSignal(AbortSignal.timeout(4000)).maybeSingle();
    if(row.error)throw row.error;if(!isRadarEvent(row.data?.data))return res.status(404).json({success:false,error:'Event not found.'});
    res.json({success:true,research:await refreshRadarResearchCase(row.data.data,row.data.first_public_at,req.body?.capture===true)});
  }catch{unavailable(res);}
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
  if (!isRadarEvent(event) || !isRadarEventInScope(event) || !isRadarUpdate(update) || update.eventId !== event.id || Date.parse(update.publishedAt) > Date.parse(event.updatedAt) || Date.parse(event.updatedAt) > Date.now() || Date.parse(update.publishedAt) > Date.now()) return res.status(400).json({ success: false, error: 'Use a specific sourced Radar development, a listed Indian company and valid dates. Routine corporate transactions belong in ordinary news. The event timestamp must include its latest evidence.' });
  try {
    const companies = await import('../utils/stockResolver.js');
    if (event.companies.some(c => {
      const real = companies.resolveStockDetailsStrict(c.scripCode);
      return !real || real.scripCode !== c.scripCode || real.symbol !== c.symbol || real.name !== c.name;
    })) return res.status(400).json({ success: false, error: 'Company code, symbol and name must match the Indian stock master.' });
    if (!isRadarEvent(event, new Set((await getRadarCategories()).map(c => c.id)))) return res.status(400).json({ success: false, error: 'Use a registered event category.' });
    await publishRadarRecords([{ event: publicRadarEvent(event), update }]);
    res.json({ success: true, id: event.id });
  } catch { unavailable(res); }
});
impactRadarRouter.get('/:id/movement', apiRateLimiter, async (req, res) => {
  if (!RADAR_ID.test(String(req.params.id))) return res.status(400).json({ success: false, error: 'Invalid event.' });
  try {
    const [event, first] = await Promise.all([getRadarEvent(String(req.params.id)), firstRadarUpdate(String(req.params.id))]);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found.' });
    // Keep the first recorded report's session visible when a later disclosure joins its timeline.
    const anchor = !event.occurredDate && first && Date.parse(first.publishedAt) < Date.parse(event.publishedAt) ? { ...event, publishedAt: first.publishedAt } : event;
    res.json({ success: true, id: event.id, movement: await getRadarMovement(anchor) });
  } catch { unavailable(res); }
});
impactRadarRouter.get('/:id/research',apiRateLimiter,async(req,res)=>{
  const id=String(req.params.id);if(!RADAR_ID.test(id))return res.status(400).json({success:false,error:'Invalid event.'});
  try {if(!await getRadarEvent(id))return res.status(404).json({success:false,error:'Event not found.'});res.json({success:true,research:await readRadarResearch(id)});}catch{unavailable(res);}
});
impactRadarRouter.get('/:id/timeline',apiRateLimiter,async(req,res)=>{
  const id=String(req.params.id),query=parseRadarHistoryQuery({cursor:req.query.cursor});
  if(!RADAR_ID.test(id)||!query)return res.status(400).json({success:false,error:'Invalid event or cursor.'});
  try {if(!await getRadarEvent(id))return res.status(404).json({success:false,error:'Event not found.'});res.json({success:true,...await listRadarTimelinePage(id,query.before)});}catch{unavailable(res);}
});
impactRadarRouter.get('/:id', apiRateLimiter, async (req, res) => {
  if (!RADAR_ID.test(String(req.params.id))) return res.status(400).json({ success: false, error: 'Invalid event.' });
  try {
    const event = await getRadarEvent(String(req.params.id));
    if (!event) return res.status(404).json({ success: false, error: 'Event not found.' });
    const [timeline, firstUpdate, related] = await Promise.all([listRadarTimelinePage(event.id,null), firstRadarUpdate(event.id), listRadarCompanyReports(event)]);
    res.json({ success: true, event, updates:timeline.items, nextTimelineCursor:timeline.nextCursor, firstUpdate, related, timelineLimit: 50 });
  } catch { unavailable(res); }
});
