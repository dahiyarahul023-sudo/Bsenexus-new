/** Story presentation contract. Financial facts belong to the feed, never to a template. */
export type StoryTopic = 'market-pulse' | 'institutional-flows' | 'earnings-radar' | 'corporate-actions';
export type StoryArtworkKind = 'banking' | 'industry' | 'energy' | 'healthcare' | 'markets';
export interface StoryCompany { symbol: string; scripCode: string; name: string }
export type StorySubject = { kind: 'company'; company: StoryCompany } | { kind: 'topic'; topic: StoryTopic };
export interface StorySource { name: string; url?: string; publishedAt?: number; dateLabel?: string }
export interface StoryChartData {
  title: string;
  unit: string;
  series: { label: string; colour?: 'accent' | 'blue' | 'rose' }[];
  points: { label: string; values: number[] }[];
  signed?: boolean;
}
export interface StoryListItem {
  id: string;
  label: string;
  detail?: string;
  value?: string;
  tone?: 'positive' | 'negative' | 'neutral';
  company?: StoryCompany;
}
interface StoryBase {
  id: string;
  /** Related pages stay together; progress always covers the entire chapter. */
  sequenceId?: string;
  chapterId: StoryTopic;
  title: string;
  emphasis?: string;
  summary?: string;
  subject: StorySubject;
  source: StorySource;
  /** Feed check time is not the publication time or the quote's trade time. */
  checkedAt: number;
}
export type StorySlide = StoryBase & (
  | { layout: 'news'; artwork?: StoryArtworkKind }
  | { layout: 'metric'; metric: { label: string; value: string; detail?: string } }
  | { layout: 'comparison'; blocks: { label: string; value: string; detail?: string; tone?: 'positive' | 'negative' | 'neutral' }[] }
  | { layout: 'chart'; chart: StoryChartData }
  | { layout: 'list'; items: StoryListItem[] }
);
export interface StoryChapter { id: StoryTopic; title: string; shortLabel: string; slides: StorySlide[] }

export const STORY_TOPICS: { id: StoryTopic; label: string; hint: string }[] = [
  { id: 'market-pulse', label: 'Market pulse', hint: 'Indices & movers' },
  { id: 'corporate-actions', label: 'Company news', hint: 'Fresh disclosures' },
  { id: 'earnings-radar', label: 'Results calendar', hint: 'Board meetings' },
  { id: 'institutional-flows', label: 'FII / DII', hint: 'Institutional flows' },
];
