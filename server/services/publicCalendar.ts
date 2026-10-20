import { selectCalendarMeetings, istDay } from "../ai/calendarRead.js";
import { publicOrigin } from "../ai/policy.js";
import type { ResultCalendarItem } from "./resultsCalendarService.js";
const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]!));
export function publicCalendarCacheControl(now = Date.now()) {
  const midnight = Date.parse(istDay(now) + "T00:00:00+05:30") + 86400000;
  const seconds = Math.max(0, Math.min(60, Math.floor((midnight - now) / 1000)));
  return seconds ? `public, max-age=${Math.min(30, seconds)}, s-maxage=${seconds}` : "no-store";
}
export function renderPublicCalendarShell(html: string, snapshot: { items: ResultCalendarItem[]; lastUpdated: number }, now = Date.now()) {
  const data = selectCalendarMeetings(snapshot, { limit: 25, daysAhead: 14 }, undefined, now);
  const rows = data.meetings.filter(m => /^\d{6}$/.test(m.scripCode));
  const sourceUrl = (code: string) => "https://api.bseindia.com/BseIndiaAPI/api/BoardMeeting/w?scripcode=" + code + "&strPurpose=&fromdate=&todate=";
  const asOf = data.lastSyncedAt || "Not available";
  const cards = rows.map(m => `<article style="border:1px solid #2D283E;border-radius:12px;padding:16px;background:#181624;overflow-wrap:anywhere">
<h2 style="font-size:16px;margin:0 0 8px">${escape(m.companyName || m.symbol)}</h2>
<p><strong>${escape(m.meetingDate)}</strong> · ${m.daysLeft === 0 ? "Today" : m.daysLeft === 1 ? "Tomorrow" : escape(m.daysLeft) + " days away"} (Asia/Kolkata)</p>
<p>${escape(m.symbol)} · BSE ${escape(m.scripCode)}</p><p>${escape(m.purpose)}</p>
<a style="color:#34D399" href="${escape(sourceUrl(m.scripCode))}" rel="noopener noreferrer">View BSE source for ${escape(m.symbol)}</a>
</article>`).join("");
  const body = `<div class="critical-preloader" data-public-calendar>
<header class="critical-header" style="height:auto;min-height:56px;gap:16px;flex-wrap:wrap;padding:12px 20px">
<a href="/" style="display:flex;align-items:center;gap:10px;color:inherit;text-decoration:none"><img src="/icon-192.png" alt="BSE Nexus logo" width="32" height="32"><strong>BSE Nexus</strong></a>
<nav aria-label="Main navigation"><a href="/announcements" style="color:#34D399">Announcements</a> · <a href="/plugin" style="color:#34D399">Connect your AI</a></nav>
</header><main class="critical-body" style="max-width:1100px;overflow-wrap:anywhere">
<h1>Upcoming BSE results calendar</h1>
<p>Available results-related board-meeting dates from ${escape(data.fromDate)} to ${escape(data.toDate)}, nearest first. All dates use Asia/Kolkata.</p>
<p><strong>Last calendar sync:</strong> <time>${escape(asOf)}</time>${data.stale ? " · Cached coverage is stale or unavailable." : ""}</p>
<p>BSE Nexus is an independent aggregator. These are scheduled meeting dates, not confirmed financial-result declarations. Verify changes with the original exchange source.</p>
<p>Showing ${rows.length} of ${data.totalMatches} matching cached dates. Coverage is incomplete; no match does not mean no result is scheduled.</p>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px">${cards || "<p>No scheduled dates are available in this cached window.</p>"}</div>
</main></div>`;
  const structured = {
    "@context":"https://schema.org", "@type":"CollectionPage",
    name:"Upcoming BSE results calendar", url:publicOrigin() + "/results-calendar",
    ...(data.lastSyncedAt ? { dateModified:data.lastSyncedAt } : {}),
    publisher:{ "@type":"Organization", name:"BSE Nexus", url:publicOrigin(), logo:publicOrigin() + "/icon-192.png" },
    mainEntity:{ "@type":"ItemList", numberOfItems:rows.length,
      itemListElement:rows.map((m, i) => ({ "@type":"ListItem", position:i+1, name:m.companyName + " — " + m.meetingDate, url:sourceUrl(m.scripCode) })) },
  };
  const json = JSON.stringify(structured).replace(/</g, "\\u003c");
  const root = /<div\s+id=["']root["']\s*>/i.exec(html);
  const noScript = root ? html.indexOf("<noscript", root.index) : -1;
  const noScriptEnd = noScript >= 0 ? html.indexOf("</noscript>", noScript) : -1;
  if (!root || noScript < 0 || noScriptEnd < 0) throw new Error("Public calendar shell boundary is missing");
  // Replace the whole generic initial body, including its sample cards and
  // generic hidden/noscript copy. Users and crawlers receive identical facts.
  const head = html.slice(0, root.index).replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "");
  return head + '<div id="root">' + body + '</div>\n<script type="application/ld+json">' + json + '</script>\n' + html.slice(noScriptEnd + "</noscript>".length);
}
