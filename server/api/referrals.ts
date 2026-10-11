import express from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { requireAuth, requireAdmin } from '../security/auth.js';
import { getUserProfile } from '../database/usersDao.js';
import { getSupabase } from '../database/supabase.js';
import { parsePayoutPaise } from '../utils/referralValidation.js';
import { PRO_PLANS } from '../config/plans.js';
import {
  getOrCreateUserReferralCode,getReferralByCode,getReferralStats,setCustomReferralCode,
  recordReferralClick,getAllReferralsAdmin,markReferralPayout,updateReferralPayoutInfo,
  setReferralType,ReferralError,applyReferralCode,clearReferralApplication,
} from '../database/referralsDao.js';

export const referralsRouter=express.Router();
const uid=(req:express.Request):string => (req as any).user?.uid || '';
const limit=rateLimit({windowMs:60_000,max:60,standardHeaders:true,legacyHeaders:false});
const mutationLimit=rateLimit({windowMs:60_000,max:20,standardHeaders:true,legacyHeaders:false});
referralsRouter.use((_req,res,next)=>{res.setHeader('Cache-Control','private, no-store');next();});
function failure(res:express.Response,error:unknown) {
  if(error instanceof ReferralError)return res.status(error.status).json({success:false,error:error.message,code:error.code});
  return res.status(503).json({success:false,error:'Referral service is temporarily unavailable. Please retry.',code:'REFERRAL_UNAVAILABLE'});
}
const discounts=Object.fromEntries(Object.values(PRO_PLANS).map(p=>[p.id,(p.amountPaise-p.referralAmountPaise)/100]));
async function ensure(req:express.Request) {
  const profile=await getUserProfile(uid(req),{durable:true});
  return getOrCreateUserReferralCode(uid(req),(req as any).user?.email||profile?.email||'',profile?.displayName||'');
}
async function dashboard(userId:string) {
  const s=await getReferralStats(userId);
  if(!s)throw new ReferralError(404,'REFERRAL_ACCOUNT_MISSING','Referral account not found.');
  return {success:true,code:s.code,referralLink:`https://bsenexus.in/?ref=${encodeURIComponent(s.code)}`,
    type:s.type,tierInfo:s.tierInfo,commissionPercent:s.tierInfo.commissionPercent,
    freeProDaysPerReferral:14,totalFreeDaysEarned:s.totalFreeDaysEarned,
    payoutUpiId:s.payoutUpiId||'',payoutBankInfo:s.payoutBankInfo||'',
    stats:{totalClicks:s.totalClicks,totalSignups:s.totalSignups,totalPending:s.totalPending,totalConversions:s.totalConversions,
      totalEarningsRupees:s.totalEarningsPaise/100,pendingPayoutRupees:s.pendingPayoutPaise/100,paidPayoutRupees:s.paidPayoutPaise/100},
    conversions:s.conversions,historyLimit:s.historyLimit,
    benefits:{monthlyDiscount:discounts.pro_monthly,weeklyDiscount:discounts.pro_weekly,
      halfyearlyDiscount:discounts.pro_halfyearly,yearlyDiscount:discounts.pro_yearly,
      freeProReward:'+14 Days Free Pro after verified payment',commissionRate:'Tiered cash commission after verified payment'}};
}
referralsRouter.get('/my-code',requireAuth,async(req,res)=>{try{await ensure(req);res.json(await dashboard(uid(req)));}catch(e){failure(res,e);}});

/** Private server-side stream. Firebase auth stays on our server; no browser service-role key. */
referralsRouter.get('/events',requireAuth,limit,async(req,res)=>{
  try{await ensure(req);}catch(e){failure(res,e);return;}
  res.status(200).set({'Content-Type':'text/event-stream','Cache-Control':'private, no-store','X-Accel-Buffering':'no'});
  res.flushHeaders();
  let closed=false,busy=false,previous='';
  let channel:ReturnType<ReturnType<typeof getSupabase>['channel']>|undefined;
  const close=()=>{
    if(closed)return;closed=true;clearInterval(timer);clearTimeout(expiry);
    if(channel)void getSupabase().removeChannel(channel).catch(()=>{});
    res.end();
  };
  const refresh=async()=>{
    if(closed||busy)return;busy=true;
    try{
      const payload=JSON.stringify(await dashboard(uid(req)));
      if(closed)return;
      if(payload!==previous){previous=payload;if(!res.write(`event: snapshot\ndata: ${payload}\n\n`))close();}
      else if(!res.write(': heartbeat\n\n'))close();
    }catch{
      if(!closed)res.write('event: unavailable\ndata: {}\n\n');close();
    }finally{busy=false;}
  };
  // Polling reconciles lost realtime events, subscription outages and changes on other instances.
  const timer=setInterval(()=>void refresh(),3000);
  // Reconnect periodically through requireAuth; an open stream is not a permanent session.
  const expiry=setTimeout(close,55_000);
  res.on('close',close);
  try{
    channel=getSupabase().channel(`referral-${randomUUID()}`).on('postgres_changes',{
      event:'UPDATE',schema:'public',table:'referral_accounts_v2',filter:`uid=eq.${uid(req)}`,
    },()=>void refresh()).subscribe();
  }catch{/* Timed reconciliation continues if Realtime is unavailable. */}
  void refresh();
});

referralsRouter.post('/apply',requireAuth,mutationLimit,async(req,res)=>{try{res.json(await applyReferralCode(uid(req),req.body?.code));}catch(e){failure(res,e);}});
referralsRouter.delete('/apply',requireAuth,mutationLimit,async(req,res)=>{try{res.json(await clearReferralApplication(uid(req)));}catch(e){failure(res,e);}});
referralsRouter.post('/custom-code',requireAuth,mutationLimit,async(req,res)=>{
  try{await ensure(req);const r=await setCustomReferralCode(uid(req),req.body?.code);res.json({...r,referralLink:`https://bsenexus.in/?ref=${encodeURIComponent(r.code!)}`});}catch(e){failure(res,e);}
});
referralsRouter.post('/payout-info',requireAuth,mutationLimit,async(req,res)=>{
  try{res.json(await updateReferralPayoutInfo(uid(req),String(req.body?.upiId||''),String(req.body?.bankInfo||'')));}catch(e){failure(res,e);}
});
referralsRouter.post('/set-tier',requireAuth,mutationLimit,async(req,res)=>{
  try{
    if(!['creator','user'].includes(req.body?.type))return res.status(400).json({success:false,error:'Choose a valid reward type.'});
    res.json(await setReferralType(uid(req),req.body.type));
  }catch(e){failure(res,e);}
});
referralsRouter.get('/validate',limit,async(req,res)=>{
  try{
    const r=await getReferralByCode(String(req.query.code||''));
    if(!r)return res.status(400).json({success:false,valid:false,error:'Invalid or inactive referral code.'});
    if(uid(req)&&r.referrerUid===uid(req))return res.status(400).json({success:false,valid:false,error:'You cannot use your own referral code.'});
    res.json({success:true,valid:true,code:r.code,type:r.type,discounts,
      discountMessage:`Save ₹${discounts.pro_monthly} on Monthly. Rewards are confirmed after payment.`});
  }catch(e){failure(res,e);}
});
referralsRouter.post('/track-visit',limit,async(req,res)=>{try{res.json({success:await recordReferralClick(req.body?.code)});}catch(e){failure(res,e);}});
referralsRouter.get('/admin/creators',requireAuth,requireAdmin,async(_req,res)=>{try{res.json({success:true,referrers:await getAllReferralsAdmin(),limit:1000});}catch(e){failure(res,e);}});
referralsRouter.post('/admin/payout',requireAuth,requireAdmin,mutationLimit,async(req,res)=>{
  try{
    const paise=parsePayoutPaise(req.body?.amountRupees);
    if(paise===null)return res.status(400).json({success:false,error:'Enter a positive amount with at most two decimal places.'});
    res.json(await markReferralPayout(req.body?.code,paise,String(req.body?.txReference||'')));
  }catch(e){failure(res,e);}
});
export default referralsRouter;
