/** Compare provider-verified payment with the immutable server checkout record. */
export function matchesReferralPayment(
  recorded:{uid:string;planId:string;currency:string;amountPaise:number}|null,
  expected:{uid:string;planId:string;amount:number;currency:string},
):boolean {
  const paise=expected.amount*100;
  // SEC-108 fix (Oct 2026 audit): Currency comparison was case-sensitive (===)
  // — 'inr' or ' INR ' from provider would fail. Now trimmed + uppercased.
  return Boolean(recorded && recorded.uid===expected.uid && recorded.planId===expected.planId
    && String(recorded.currency).trim().toUpperCase()===String(expected.currency).trim().toUpperCase()
    && Number.isFinite(paise) && Number.isSafeInteger(Math.round(paise))
    && Math.abs(paise-Math.round(paise))<0.000001 && Math.round(paise)===recorded.amountPaise);
}
