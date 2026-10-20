/** Decimal money input must not lose a paisa to floating-point multiplication. */
export function parsePayoutPaise(input: unknown): number | null {
  if(typeof input!=='string'&&typeof input!=='number')return null;
  const match=/^(\d+)(?:\.(\d{1,2}))?$/.exec(String(input).trim());
  if(!match)return null;
  const paise=Number(match[1])*100+Number((match[2]||'').padEnd(2,'0'));
  return Number.isSafeInteger(paise)&&paise>0?paise:null;
}
