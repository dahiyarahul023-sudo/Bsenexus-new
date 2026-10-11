import { randomBytes } from 'node:crypto';
import { getSupabase } from './supabase.js';
import { invalidateUserProfileCache } from './usersDao.js';

/** Durable-only: no instance-local cache can authorize ownership or confirm rewards. */
export class ReferralError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const failures: Record<string, [number,string]> = {
  REFERRAL_CODE_TAKEN: [409, 'This code already belongs to another account. Please choose another.'],
  REFERRAL_INVALID_CODE: [400, 'Use 3–20 letters, numbers, hyphens or underscores.'],
  REFERRAL_SELF: [400, 'You cannot use your own referral code.'],
  REFERRAL_ACCOUNT_MISSING: [404, 'Referral account not found. Open your referral dashboard first.'],
  REFERRAL_ORDER_MISMATCH: [409, 'Referral attribution does not match this payment order.'],
  REFERRAL_INVALID_PAYOUT: [400, 'Enter a valid payout amount, reference and details.'],
  REFERRAL_PAYOUT_CONFLICT: [409, 'This transaction reference has already been used.'],
  REFERRAL_PAYOUT_EXCEEDS_BALANCE: [409, 'Payout amount exceeds the pending balance.'],
};
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  try {
    const { data, error } = await getSupabase().rpc(name,args).abortSignal(AbortSignal.timeout(10_000));
    if (error) {
      for (const [code,[status,message]] of Object.entries(failures)) if (error.message.includes(code)) throw new ReferralError(status,code,message);
      throw error;
    }
    return data as T;
  } catch (error) {
    if (error instanceof ReferralError) throw error;
    throw new ReferralError(503,'REFERRAL_UNAVAILABLE','Referral storage is temporarily unavailable. Your request was not confirmed; retry safely.');
  }
}
function command<T=any>(action: string, uid: string, data: Record<string,unknown> = {}): Promise<T> {
  return rpc<T>('referral_command',{p_action:action,p_uid:uid,p_data:data});
}
export function validateReferralCode(raw: string): string {
  const code = String(raw || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) throw new ReferralError(400,'REFERRAL_INVALID_CODE',failures.REFERRAL_INVALID_CODE[1]);
  return code;
}
function toRecord(a: any): ReferralCodeRecord {
  return { code:a.current_code,referrerUid:a.uid,referrerEmail:a.email,referrerName:a.display_name,type:a.reward_type,
    commissionPercent:getTierCommissionPercent(Number(a.conversions)),totalClicks:Number(a.clicks),totalSignups:0,
    totalConversions:Number(a.conversions),totalEarningsPaise:Number(a.earnings_paise),pendingPayoutPaise:Number(a.pending_paise),
    paidPayoutPaise:Number(a.paid_paise),payoutUpiId:a.upi,payoutBankInfo:a.bank_info,
    createdAt:Date.parse(a.created_at),updatedAt:Date.parse(a.updated_at),isActive:a.active };
}
export interface ReferralCodeRecord {
  code: string; // Uppercase, alphanumeric, e.g. "RAHUL", "AKSHAT", "NEXUS100"
  referrerUid: string;
  referrerEmail: string;
  referrerName: string;
  type: 'creator' | 'user';
  commissionPercent: number; // Tier-based: 15%, 20%, 25%, 30%
  totalClicks: number;
  totalSignups: number;
  totalConversions: number;
  totalEarningsPaise: number;
  pendingPayoutPaise: number;
  paidPayoutPaise: number;
  payoutUpiId?: string;
  payoutBankInfo?: string;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

export interface ReferralConversionRecord {
  id: string; // e.g. "ref_conv_BN_M_..."
  referralCode: string;
  referrerUid: string;
  referrerEmail: string;
  referredUid: string;
  referredEmail: string;
  referredName: string;
  orderId: string;
  planId: string;
  planLabel: string;
  baseAmountPaise: number;
  discountAmountPaise: number;
  finalAmountPaidPaise: number;
  commissionEarnedPaise: number;
  rewardType: 'free_pro_days' | 'cash_commission';
  freeProDaysGranted?: number;
  status: 'confirmed' | 'paid_out' | 'refunded';
  convertedAt: number;
}

/** Sanitize a referral code to uppercase alphanumeric and hyphen/underscore only. */
export function sanitizeReferralCode(code: string): string {
  return String(code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .trim()
    .slice(0, 20);
}

/**
 * Clean, memorable referral code generation.
 * Uses the user's name/handle or clean readable prefix.
 */
export function generateCleanUserReferralCode(displayName: string = '', email: string = ''): string {
  let base = (displayName || email.split('@')[0] || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();

  // If base is too short or generic, fallback to BSE / NEXUS
  if (base.length < 3 || /^(USER|MEMBER|GUEST|ADMIN|TEST)/i.test(base)) {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `NEXUS${suffix}`;
  }

  return base.slice(0, 8);
}

/**
 * Volume-based tiered commission structure:
 * The more verified conversions a creator brings, the higher their commission!
 */
export function getTierCommissionPercent(conversionsCount: number, customPercent?: number): number {
  if (customPercent && customPercent > 0) return customPercent;
  if (conversionsCount >= 50) return 30; // Platinum: 30%
  if (conversionsCount >= 20) return 25; // Gold: 25%
  if (conversionsCount >= 5) return 20;  // Silver: 20%
  return 15;                             // Bronze / Starter: 15%
}

export function getTierInfo(conversionsCount: number): {
  tierName: string;
  commissionPercent: number;
  nextTierName?: string;
  conversionsToNext?: number;
} {
  if (conversionsCount >= 50) {
    return {
      tierName: 'Platinum Elite (30%)',
      commissionPercent: 30,
    };
  }
  if (conversionsCount >= 20) {
    return {
      tierName: 'Gold Partner (25%)',
      commissionPercent: 25,
      nextTierName: 'Platinum Elite (30%)',
      conversionsToNext: 50 - conversionsCount,
    };
  }
  if (conversionsCount >= 5) {
    return {
      tierName: 'Silver Creator (20%)',
      commissionPercent: 20,
      nextTierName: 'Gold Partner (25%)',
      conversionsToNext: 20 - conversionsCount,
    };
  }
  return {
    tierName: 'Bronze Starter (15%)',
    commissionPercent: 15,
    nextTierName: 'Silver Creator (20%)',
    conversionsToNext: 5 - conversionsCount,
  };
}


export async function getReferralByCode(rawCode: string): Promise<ReferralCodeRecord | null> {
  const a = await command('lookup','',{code:validateReferralCode(rawCode)});
  return a ? toRecord(a) : null;
}
export async function getOrCreateUserReferralCode(uid: string,email='',displayName=''): Promise<ReferralCodeRecord> {
  if (!uid) throw new ReferralError(401,'AUTH_REQUIRED','Sign in first.');
  const base = generateCleanUserReferralCode(displayName,email);
  for (let attempt=0;attempt<8;attempt++) {
    const code=attempt===0 ? base : base.slice(0,10)+'_'+randomBytes(4).toString('hex').toUpperCase();
    try { return toRecord(await command('ensure',uid,{code,email,displayName})); }
    catch(error) { if (!(error instanceof ReferralError) || error.code!=='REFERRAL_CODE_TAKEN') throw error; }
  }
  throw new ReferralError(503,'REFERRAL_UNAVAILABLE','Could not reserve a unique code. Please retry.');
}
export async function setCustomReferralCode(uid:string,rawCode:string,_isCreator=false): Promise<{success:boolean;code?:string;error?:string}> {
  return command('rename',uid,{code:validateReferralCode(rawCode)});
}
export async function updateReferralPayoutInfo(uid:string,upi:string,bank='') {
  if ((!upi.trim()&&!bank.trim()) || upi.length>120 || bank.length>500) throw new ReferralError(400,'REFERRAL_INVALID_PAYOUT',failures.REFERRAL_INVALID_PAYOUT[1]);
  return command('payout-info',uid,{upi:upi.trim(),bank:bank.trim()});
}
export async function setReferralType(uid:string,type:'creator'|'user') { return command('type',uid,{type}); }
export async function recordReferralClick(rawCode:string):Promise<boolean> { return (await command('click','',{code:validateReferralCode(rawCode)})).success; }
export async function applyReferralCode(uid:string,rawCode:string) { return command('apply',uid,{code:validateReferralCode(rawCode)}); }
export async function clearReferralApplication(uid:string) { return command('unapply',uid); }
/** Legacy signup callers must supply verified UID; anonymous clicks cannot count as signups. */
export async function recordReferralSignup(rawCode:string,uid?:string):Promise<boolean> { if(!uid)return false;return (await applyReferralCode(uid,rawCode)).success; }
export async function bindReferralOrder(uid:string,input:{orderId:string;code:string;planId:string;basePaise:number;paidPaise:number;currency:string}) {
  return command('bind',uid,{...input,code:validateReferralCode(input.code)});
}
export async function settleReferralOrder(orderId:string) {
  const result=await rpc<any>('referral_settle_order',{p_order_id:orderId});
  if(result?.referrer_uid) invalidateUserProfileCache(result.referrer_uid);
  return result;
}
/** Compatibility entry point: financial values and owner come from durable order attribution. */
export async function recordReferralConversion(params:{orderId:string;[key:string]:unknown}) {
  const r=await settleReferralOrder(params.orderId);
  return {success:true,commissionEarnedPaise:Number(r.commission_paise||0),freeProDaysGranted:Number(r.free_days||0)};
}
export async function getReferralStats(uid:string) {
  const snapshot=await rpc<any>('referral_snapshot',{p_uid:uid});
  if(!snapshot?.account)return null;
  const a=snapshot.account,record=toRecord(a);
  return {...record,tierInfo:getTierInfo(record.totalConversions),totalPending:Number(snapshot.pending||0),totalFreeDaysEarned:Number(a.free_days),
    conversions:(snapshot.rewards||[]).map((r:any)=>({id:'ref_conv_'+r.order_id,orderId:r.order_id,
      planLabel:r.plan_id,convertedAt:Date.parse(r.created_at),referredEmailMasked:'Verified member',
      finalAmount:Number(r.paid_paise)/100,discountAmount:(Number(r.base_paise)-Number(r.paid_paise))/100,
      commission:Number(r.commission_paise)/100,rewardType:r.reward_type==='creator'?'cash_commission':'free_pro_days',
      freeProDaysGranted:Number(r.free_days),status:r.status})),
    historyLimit:100,
  };
}
export async function getAllReferralsAdmin():Promise<ReferralCodeRecord[]> {
  const snapshot=await rpc<any[]>('referral_admin_accounts',{});
  return snapshot.map(toRecord);
}
export async function markReferralPayout(code:string,amountPaise:number,txReference:string) {
  if (!Number.isSafeInteger(amountPaise)||amountPaise<=0||txReference.trim().length<3||txReference.length>120) throw new ReferralError(400,'REFERRAL_INVALID_PAYOUT',failures.REFERRAL_INVALID_PAYOUT[1]);
  const account=await getReferralByCode(code);
  if(!account)throw new ReferralError(404,'REFERRAL_ACCOUNT_MISSING','Referral account not found.');
  return command('payout',account.referrerUid,{amountPaise,reference:txReference.trim()});
}
