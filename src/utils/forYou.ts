import { activeWatchlistIdentities, matchesWatchlistIdentity } from '../shared/watchlistIdentity';
import { calendarDayKey } from '../shared/calendarTiming';
import type { StoryChapter } from '../components/story/storyTypes';
export function watchlistTerms(lists: any[]) {
  return [...new Set(activeWatchlistIdentities(lists).flatMap(stock => [stock.symbol, stock.scripCode || '', (stock.companyName || '').replace(/\s+(?:ltd\.?|limited)$/i, '')]).filter(Boolean))];
}
export function selectPersonalResults(items: any[], lists: any[], now = Date.now()) {
  const stocks = activeWatchlistIdentities(lists);
  return items.filter(item => stocks.some(stock => matchesWatchlistIdentity(item, stock)))
    .map(item => ({...item, daysLeft: item.meetingTimestamp > 0 ? calendarDayKey(item.meetingTimestamp)-calendarDayKey(now) : item.daysLeft}))
    .filter(item => Number.isFinite(item.daysLeft) && item.daysLeft >= 0 && item.daysLeft <= 7)
    .sort((a,b)=>a.daysLeft-b.daysLeft || Number(b.isDeclared===true)-Number(a.isDeclared===true)).slice(0,4);
}
export function personalStoryChapters(chapters: StoryChapter[], watched?: string[]): StoryChapter[] {
  if (!watched) return chapters;
  const keys = new Set(watched.map(value => value.toUpperCase()));
  const match = (company: {symbol:string;scripCode:string}) => keys.has(company.symbol.toUpperCase()) || keys.has(company.scripCode);
  return chapters.map(chapter=>({...chapter,slides:chapter.slides.flatMap(slide=> {
    if (slide.subject.kind === 'company') return match(slide.subject.company) ? [slide] : [];
    if (slide.layout !== 'list') return [];
    const items = slide.items.filter(item=>item.company && match(item.company));
    return items.length ? [{...slide,items}] : [];
  })})).filter(chapter=>chapter.slides.length>0);
}
