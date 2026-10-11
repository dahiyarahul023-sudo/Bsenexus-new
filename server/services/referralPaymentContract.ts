/** Compare provider-verified payment with the immutable server checkout record. */
export function matchesReferralPayment(
  recorded:{uid:string;planId:string;currency:string;amountPaise:number}|null,
  expected:{uid:string;planId:string;amount:number;currency:string},
):boolean {
  const paise=expected.amount*100;
  return Boolean(recorded && recorded.uid===expected.uid && recorded.planId===expected.planId
    && recorded.currency===expected.currency && Number.isFinite(paise) && Number.isSafeInteger(Math.round(paise))
    && Math.abs(paise-Math.round(paise))<0.000001 && Math.round(paise)===recorded.amountPaise);
}
