/** Scope is independent of publisher and of editable discovery terms. */
const transaction = /\b(?:acquisitions?|mergers?|demergers?|takeovers?|scheme of arrangement|incorporation of (?:a |an )?(?:wholly owned )?subsidiary|purchase orders?|letter of acceptance|order wins?)\b/i;
const risk = /\b(?:insolvency|bankruptcy|CIRP|arbitration|arbitral|disputes?|litigation|investigat\w*|fraud|allegations?|alleges|whistleblower|forensic|penalt\w*|tax demand|default|debarment|ban|bans|banned|restriction|restricted|injunction|stays?|stayed|quash\w*|overturn\w*|relief|reject\w*|block\w*|challeng\w*|contested|prohibit\w*|revok\w*|suspend\w*|plant fire|factory fire|explosion|shutdown|data breach|cyberattack|product recall)\b/i;
const development = /\b(?:order|orders|hearing|judgment|judgement|petition|appeal|litigation|tribunal|penalty|demand|restriction|ban|debarment|stays?|quashes|relief|licen[cs]e|investigat\w*|indictment|insolvency|bankruptcy|CIRP|arbitration|arbitral|market coupling|show.?cause|warning letter|settlement|accounting irregularities|financial irregularities|fraud|alleg\w*|whistleblower|short seller report|forensic report|misstatement|bribery|plant fire|factory fire|explosion|production halted|halts production|production suspended|plant shutdown|factory shutdown|cyberattack|cyber attack|data breach|product recall|default|credit rating downgrade|trading suspension|business restriction)\b/i;

/** A citation to takeover regulations is not itself an enforcement event. */
export function radarScopeText(value: string): string {
  return value.replace(/SEBI\s*\(\s*Substantial Acquisition of Shares\s*(?:&|and)\s*Takeovers?\s*\)\s*Regulations?\s*,?\s*\d{4}/gi, 'statutory disclosure')
    .replace(/SEBI\s*\(\s*(?:LODR|Listing Obligations and Disclosure Requirements)\s*\)\s*Regulations?\s*,?\s*\d{4}/gi, '');
}
export function isRoutineRadarTransaction(value: string): boolean {
  const scoped=radarScopeText(value);
  const prevention=/\b(?:fraud|cyber ?attack|data breach)\s+(?:prevention|detection|protection|awareness|simulation)|\banti[- ]fraud\b|\b(?:mock|simulation)\s+drill\b/i.test(scoped);
  const incident=/\b(?:allegations?|alleges|alleged|arrest\w*|indict\w*|bribery|whistleblower|penalt\w*|convict\w*|charged\s+with|investigation\s+(?:into|against)|probe\s+(?:into|against)|(?:suffers?|suffered|reports?|reported|discloses?|disclosed|hit\s+by)\s+(?:an?\s+)?(?:cyber ?attack|data breach|fraud|accounting irregularities|financial irregularities))\b/i.test(scoped);
  return (prevention && !incident) || (transaction.test(scoped) && !risk.test(scoped));
}
export function hasRadarDevelopment(value: string): boolean {
  return development.test(radarScopeText(value));
}

function cleanHeading(value: string): string {
  return radarScopeText(value).replace(/^.*?\s+-\s+\d{6}\s+-\s*/, '')
    .replace(/^(?:announcement|intimation|disclosure)\s+under\s+(?:SEBI\s+)?(?:Regulation|Reg\.?)\s+30\s*(?:\(LODR\))?\s*(?:of\s*)?[-:–]?\s*/i, '')
    .replace(/^(?:we wish to inform you(?: that| about)?|this is to inform you that)\s*/i, '').trim();
}
/** Use source wording, never a synthetic "development update". Original titles stay in the timeline. */
export function radarSourceSummary(title: string, information = ''): string | null {
  for (const value of [title, information]) {
    const heading = cleanHeading(value).replace(/^this is in continuation to (?:the )?/i, '');
    if (!heading || /regulation\s+30|disclosure requirements|development (?:disclosed|update)|\b(?:company|business|regulatory|corporate transaction) update\b|\b(?:order|demand) disclosure$|^other regulatory disclosures?$|^please find attached|^the company has published a legal or regulatory disclosure|^a news source has reported this development/i.test(heading)) continue;
    // Whole source wording, or a complete first sentence; never invent or truncate an outcome.
    const summary = heading.length <= 200 ? heading : heading.match(/^(.{10,199}[.!?])(?:\s|$)/)?.[1];
    // New private DB terms must remain usable without changing this presentation helper.
    if (summary && (hasRadarDevelopment(summary) || summary.split(/\s+/).length >= 3) && !isRoutineRadarTransaction(summary)) return summary;
  }
  return null;
}
