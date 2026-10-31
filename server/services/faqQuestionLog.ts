import { mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

interface Question { q: string; source: 'bank' | 'ai'; ts: number }
async function writeQuestions(entries: Question[]) {
  const dir = path.join(process.cwd(), 'data');
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, 'faq_questions.json');
  await writeFile(target + '.tmp', JSON.stringify(entries), 'utf8');
  await rename(target + '.tmp', target);
}
/** Best-effort log: bounded memory, no synchronous I/O on the request path. */
export function createFaqQuestionLog(write = writeQuestions) {
  const entries: Question[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writing: Promise<void> | undefined;
  let dirty = false;
  const schedule = () => {
    if (!timer && !writing) { timer = setTimeout(() => { timer = undefined; void flush(); }, 30_000); timer.unref(); }
  };
  const flush = async (): Promise<void> => {
    if (writing) return writing;
    if (!dirty) return;
    if (timer) { clearTimeout(timer); timer = undefined; }
    dirty = false;
    writing = write(entries.slice()).catch(() => { /* Logging never blocks answers. */ });
    try { await writing; } finally { writing = undefined; if (dirty) schedule(); }
  };
  return { log(q: string, source: Question['source']) {
    entries.push({ q: q.slice(0, 200), source, ts: Date.now() });
    if (entries.length > 500) entries.splice(0, entries.length - 500);
    dirty = true; schedule();
  }, flush, size: () => entries.length };
}
export const faqQuestionLog = createFaqQuestionLog();
