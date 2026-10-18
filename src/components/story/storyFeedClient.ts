import { buildStoryChapters } from './storyBuilder';
import type { StoryChapter } from './storyTypes';

/** Public-data cache shared by both entry points. A forced newer read wins every race. */
export function createStoryFeedClient(options: {
  request: (force: boolean) => Promise<unknown>;
  now?: () => number;
  session: () => { storySessionId: string; showMarketMoves: boolean };
}) {
  const now = options.now || Date.now;
  let snapshot: { payload: unknown; fetchedAt: number; session: string } | undefined;
  let pending: Promise<StoryChapter[]> | undefined;
  let generation = 0;
  function peek(): StoryChapter[] {
    const session = options.session();
    if (!snapshot || snapshot.session !== session.storySessionId || now() - snapshot.fetchedAt >= 180_000) return [];
    try { return buildStoryChapters(snapshot.payload, now(), session.showMarketMoves); } catch { return []; }
  }
  function load(force = false): Promise<StoryChapter[]> {
    if (!force && pending) return pending;
    if (!force && snapshot && snapshot.session === options.session().storySessionId && now() - snapshot.fetchedAt < 60_000) return Promise.resolve(peek());
    const version = ++generation;
    const session = options.session();
    const read = Promise.resolve().then(() => options.request(force)).then(payload => {
      if (version !== generation) return pending || peek();
      const chapters = buildStoryChapters(payload, now(), options.session().showMarketMoves);
      // A request started before the market-session boundary is not cached into the next session.
      if (session.storySessionId === options.session().storySessionId) snapshot = { payload, fetchedAt: now(), session: session.storySessionId };
      return chapters;
    }).finally(() => { if (pending === read) pending = undefined; });
    pending = read;
    return read;
  }
  return { peek, load };
}
