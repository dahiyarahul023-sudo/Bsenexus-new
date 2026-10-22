import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { renderPublicCalendarShell } from "../services/publicCalendar.js";
import type { ResultCalendarItem } from "../services/resultsCalendarService.js";

const now = Date.parse("2026-10-23T06:00:00Z");
const day = (offset: number) => now + offset * 86400000;
const item = (i: number, extra: Partial<ResultCalendarItem> = {}): ResultCalendarItem => ({
  id: `public-coverage-${i}`, symbol: `COVERAGE${i}`, scripCode: String(900000 + i),
  companyName: `Calendar coverage company ${i}`, purpose: "Quarterly financial results",
  meetingDate: "2026-10-23", meetingTimestamp: day(i % 14), daysLeft: 0,
  status: "UPCOMING", updatedAt: new Date(now).toISOString(), ...extra,
});
const base = () => fs.readFileSync("index.html", "utf8");

test("public results calendar exposes all 86 cached meetings beyond the old 25-row cutoff", () => {
  const items = Array.from({ length: 86 }, (_, i) => item(i));
  const snapshot = { items, lastUpdated: now };
  const before = JSON.stringify(snapshot);
  const html = renderPublicCalendarShell(base(), snapshot, now);
  assert.equal((html.match(/<article\b/g) || []).length, 86);
  assert.ok(html.includes("Showing 86 of 86 matching cached dates."));
  assert.ok(html.includes("scripcode=900085"), "later meetings must be present without a click");
  const structured = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
  assert.equal(structured.mainEntity.numberOfItems, 86);
  assert.equal(structured.mainEntity.itemListElement.length, 86);
  assert.deepEqual(structured.mainEntity.itemListElement.map((m: any) => m.position), Array.from({ length: 86 }, (_, i) => i + 1));
  assert.equal(JSON.stringify(snapshot), before, "rendering must not change the shared snapshot");
  assert.ok(html.includes("/src/main.tsx"));
});

test("complete public window still filters invalid, declared, past and later meetings and deduplicates", () => {
  const items = Array.from({ length: 30 }, (_, i) => item(i));
  items.push(item(0, { id: "duplicate-notice" }));
  items.push(item(100, { isDeclared: true }));
  items.push(item(101, { meetingTimestamp: day(-1) }));
  items.push(item(102, { meetingTimestamp: day(15) }));
  items.push(item(103, { scripCode: "invalid-code" }));
  const html = renderPublicCalendarShell(base(), { items, lastUpdated: now }, now);
  assert.equal((html.match(/<article\b/g) || []).length, 30);
  assert.ok(html.includes("Showing 30 of 30 matching cached dates."));
  for (const code of ["900100", "900101", "900102", "invalid-code"]) assert.ok(!html.includes("scripcode=" + code));
  assert.ok(html.includes("scheduled meeting dates, not confirmed financial-result declarations"));
});

test("empty public calendar retains the truthful stale state", () => {
  const html = renderPublicCalendarShell(base(), { items: [], lastUpdated: 0 }, now);
  assert.equal((html.match(/<article\b/g) || []).length, 0);
  assert.ok(html.includes("No scheduled dates are available in this cached window."));
  assert.ok(html.includes("Cached coverage is stale or unavailable."));
});
