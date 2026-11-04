import { Bell, FileText, Sparkles } from 'lucide-react';

const benefits = [
  { title: 'Exchange filings', description: 'Read BSE disclosures, board meeting notices and company results.', Icon: FileText },
  { title: 'Watchlist alerts', description: 'Follow your companies and choose which updates reach you on Telegram.', Icon: Bell },
  { title: 'Filing analysis', description: 'Use AI summaries to review results and return to the original document.', Icon: Sparkles },
];

export function CoreCapabilitiesBento() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12" aria-labelledby="landing-capabilities">
      <h2 id="landing-capabilities" className="mb-4 text-xl font-semibold sm:text-2xl">What you can do</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {benefits.map(({ title, description, Icon }) => (
          <article key={title} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <Icon size={18} className="mb-2 text-teal-700 dark:text-teal-300" aria-hidden="true" />
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
