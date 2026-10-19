import type { RadarEvent } from '../shared/impactRadar';

/** One feed card per exact company set; individual evidence and follows retain their IDs. */
export function groupRadarCompanies(events: RadarEvent[]): { key: string; latest: RadarEvent; reports: RadarEvent[] }[] {
  const groups = new Map<string, RadarEvent[]>();
  for (const event of events) {
    const key = [...new Set(event.companies.map(company => company.scripCode))].sort().join(':');
    const group = groups.get(key) || [];
    if (!group.some(item => item.id === event.id)) group.push(event);
    groups.set(key, group);
  }
  return [...groups].map(([key, reports]) => {
    reports.sort((a,b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
    return {key,latest:reports[0],reports};
  }).sort((a,b) => Date.parse(b.latest.updatedAt) - Date.parse(a.latest.updatedAt));
}
