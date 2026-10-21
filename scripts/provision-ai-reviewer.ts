import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { getFirebaseAuth } from '../server/security/firebaseAdmin';
import { getSupabase } from '../server/database/supabase';

export function reviewerFixture(uid: string) {
  if (!/^mcp-reviewer-[a-f0-9-]{36}$/.test(uid)) throw new Error('Only a dedicated mcp-reviewer UUID account is eligible.');
  const stamp=Date.now(),listId='mcp-review-list',noteId='mcp-review-note-'+uid;
  return {list:{id:listId,name:'Directory Review',is_active:1,items:[{symbol:'TCS',scripCode:'532540',companyName:'Tata Consultancy Services Ltd',priority:'HIGH'},{symbol:'RELIANCE',scripCode:'500325',companyName:'Reliance Industries Ltd',priority:'MEDIUM'}]},note:{id:noteId,userId:uid,text:'Directory review fixture. Check the original exchange PDF before using financial information.',icon:0,tags:['mcp-review'],link:null,createdAt:stamp,updatedAt:stamp},preferences:{resultsAndEarnings:true,orderWinsAndExpansion:false,dividendsAndBonus:true,acquisitionsAndMergers:false,creditRatings:true,muteRoutineFilings:true,boardMeetingsAndOutcomes:true,annualReportsAndAudits:false}};
}
async function main() {
  const mode=process.argv[2];
  if (!['create','seed','reset'].includes(mode)) {console.log('Usage: tsx scripts/provision-ai-reviewer.ts create|seed|reset [--apply]\nDefault is dry-run. create needs REVIEWER_EMAIL + REVIEWER_PASSWORD (16+ chars). seed/reset need AI_REVIEWER_UID. Sign in once before seed. No command grants Pro, sends email, exposes passwords or changes a real person’s account.');return;}
  const apply=process.argv.includes('--apply');
  if(mode==='create') {
    const email=process.env.REVIEWER_EMAIL?.trim(),password=process.env.REVIEWER_PASSWORD || '';
    if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length<16) throw new Error('Set a reviewer email you control and a unique REVIEWER_PASSWORD of at least 16 characters in server environment.');
    if(!apply){console.log('DRY RUN: create one dedicated password-login Firebase account. No email sent; no subscription entitlement assigned.');return;}
    const auth=getFirebaseAuth();
    try {await auth.getUserByEmail(email);throw new Error('Email already belongs to an account; refusing to reuse or overwrite it.');} catch(e:any){if(e.code!=='auth/user-not-found')throw e;}
    const user=await auth.createUser({uid:'mcp-reviewer-'+randomUUID(),email,password,displayName:'BSE Nexus Directory Reviewer',emailVerified:false});
    console.log('Created dedicated reviewer UID: '+user.uid+'. Sign in once on the website, verify email normally if required, then seed. Share login credentials privately; no password is logged.');return;
  }
  const uid=process.env.AI_REVIEWER_UID || '',fixture=reviewerFixture(uid);
  if(!apply){console.log('DRY RUN: '+mode+' only the dedicated reviewer account. Grants are revoked before reset; fixtures contain no personal data. Existing Pro/trial/AI entitlements remain unchanged.');return;}
  const auth=getFirebaseAuth(),user=await auth.getUser(uid);if(user.displayName!=='BSE Nexus Directory Reviewer')throw new Error('Dedicated reviewer identity marker missing; refusing to alter this account.');
  const db=getSupabase();const requireOk=async(query:any)=>{const response=await query;if(response.error)throw new Error('Reviewer storage operation failed; inspect safe server logs before retrying.');return response.data;};
  const profile=await requireOk(db.from('users').select('uid,tier,pro_expires_at').eq('uid',uid).maybeSingle());if(!profile)throw new Error('Sign in on the website once before seeding; no synthetic payment/profile grant will be created.');
  if(mode==='reset') {
    // This account is synthetic and explicitly selected. Stop active clients before reset.
    await requireOk(db.from('ai_connection_grants').update({revoked_at:new Date().toISOString()}).eq('uid',uid));
    await auth.revokeRefreshTokens(uid);
    await requireOk(db.from('ai_connection_operations').delete().eq('uid',uid));
    await requireOk(db.from('ai_connection_usage').delete().eq('uid',uid));
  }
  await requireOk(db.from('user_watchlists').upsert({uid,lists:[fixture.list],updated_at:new Date().toISOString()},{onConflict:'uid'}));
  await requireOk(db.from('user_notes').delete().eq('user_id',uid));
  await requireOk(db.from('user_notes').insert({id:fixture.note.id,user_id:uid,note:fixture.note,updated_at:new Date().toISOString()}));
  const existing=await requireOk(db.from('users').select('notification_prefs').eq('uid',uid).single());
  await requireOk(db.from('users').update({notification_prefs:{...existing.notification_prefs,...fixture.preferences}}).eq('uid',uid));
  console.log('Dedicated reviewer fixtures stored. No Pro, payment or shared AI allowance was granted. Start a fresh OAuth connection; inspect account_context for current entitlements and limits.');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
