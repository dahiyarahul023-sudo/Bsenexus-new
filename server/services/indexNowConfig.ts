import fs from 'node:fs';
import path from 'node:path';

export const INDEXNOW_HOST = 'bsenexus.in';
/** Public ownership token, kept out of client modules. An explicit host env wins. */
export function loadIndexNowKey(env: NodeJS.ProcessEnv = process.env): string {
  let key = env.INDEXNOW_KEY?.trim() || '';
  if (!key) {
    try { key = fs.readFileSync(path.join(process.cwd(), 'public/indexnow-key.txt'), 'utf8').trim(); } catch {}
  }
  if (!/^[a-f0-9]{32,128}$/i.test(key)) return '';
  env.INDEXNOW_KEY = key;
  return key;
}
export const INDEXNOW_KEY = loadIndexNowKey();
export const INDEXNOW_KEY_LOCATION = INDEXNOW_KEY ? `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt` : '';
export const INDEXNOW_SUBMITTER = process.env.INDEXNOW_SUBMITTER || 'server';
