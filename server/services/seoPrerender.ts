import fs from 'node:fs';
import path from 'node:path';
import { getRecentAnnouncements } from '../database/announcementDao.js';
import { parseBseDate } from '../utils/helpers.js';

/**
 * Escapes characters for safe inclusion inside HTML text nodes.
 */
export function escapeHtmlText(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escapes characters for safe inclusion inside HTML attributes.
 */
export function escapeHtmlAttr(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Cleans canonical URLs by automatically stripping utility and tracking query parameters
 * (?tab=, ?utm_*, ?design=, ?preview=, ?action=, etc.) and enforcing the official origin.
 */
export function cleanCanonicalUrl(rawUrl: string): string {
  if (!rawUrl) return 'https://bsenexus.in/';
  try {
    const parsed = new URL(rawUrl, 'https://bsenexus.in');
    // Strictly strip utility query parameters
    const paramsToDelete: string[] = [];
    parsed.searchParams.forEach((_val, key) => {
      const lower = key.toLowerCase();
      if (
        lower === 'tab' ||
        lower.startsWith('utm_') ||
        lower === 'design' ||
        lower === 'preview' ||
        lower === 'action' ||
        lower === 'query' ||
        lower === 'text' ||
        lower === 'title' ||
        lower === 'url' ||
        lower === 'q'
      ) {
        paramsToDelete.push(key);
      }
    });
    for (const key of paramsToDelete) {
      parsed.searchParams.delete(key);
    }
    const cleanSearch = parsed.searchParams.toString();
    const cleanPath = parsed.pathname.replace(/\/+$/, '') || '/';
    return `https://bsenexus.in${cleanPath}${cleanSearch ? `?${cleanSearch}` : ''}`;
  } catch {
    return 'https://bsenexus.in/';
  }
}

let cachedDistTemplate: string | null = null;

/**
 * Reads the base HTML SPA template (dist/index.html in production, fallback to index.html in dev).
 */
export function getSpaTemplate(): string {
  if (cachedDistTemplate) return cachedDistTemplate;

  const distPath = path.join(process.cwd(), 'dist', 'index.html');
  const rootPath = path.join(process.cwd(), 'index.html');

  if (fs.existsSync(distPath)) {
    try {
      cachedDistTemplate = fs.readFileSync(distPath, 'utf8');
      return cachedDistTemplate;
    } catch {
      // Fall through to root template
    }
  }

  if (fs.existsSync(rootPath)) {
    return fs.readFileSync(rootPath, 'utf8');
  }

  // Minimal safe fallback shell
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Bsenexus</title></head><body><div id="root"></div></body></html>`;
}

export interface PrehydrateOptions {
  title: string;
  description: string;
  canonical: string;
  ogType?: 'website' | 'article';
  ogImage?: string;
  robots?: string;
  jsonLd?: Record<string, any>;
  rootInnerHtml: string;
}

/**
 * Dynamically injects route-specific metadata, OpenGraph, JSON-LD, and pre-hydrated
 * semantic HTML inside #root into the SPA template.
 */
export function buildPrehydratedHtml(options: PrehydrateOptions, customTemplate?: string): string {
  const baseHtml = customTemplate || getSpaTemplate();
  const canonicalUrl = cleanCanonicalUrl(options.canonical);
  const title = options.title.trim();
  const description = options.description.trim();
  const robots = options.robots || 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';
  const ogType = options.ogType || 'website';
  const ogImage = options.ogImage || 'https://bsenexus.in/og-image.png';

  let html = baseHtml;

  // 1. Replace or inject <title>
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtmlText(title)}</title>`);
  } else {
    html = html.replace('</head>', `  <title>${escapeHtmlText(title)}</title>\n</head>`);
  }

  // 2. Canonical URL
  if (/<link\s+rel=["']canonical["'][^>]*\/?>/i.test(html)) {
    html = html.replace(
      /<link\s+rel=["']canonical["'][^>]*\/?>/i,
      `<link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" />`
    );
  } else {
    html = html.replace('</head>', `  <link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" />\n</head>`);
  }

  // 3. Meta description
  if (/<meta\s+name=["']description["'][^>]*\/?>/i.test(html)) {
    html = html.replace(
      /<meta\s+name=["']description["'][^>]*\/?>/i,
      `<meta name="description" content="${escapeHtmlAttr(description)}" />`
    );
  } else {
    html = html.replace('</head>', `  <meta name="description" content="${escapeHtmlAttr(description)}" />\n</head>`);
  }

  // 4. Meta robots
  if (/<meta\s+name=["']robots["'][^>]*\/?>/i.test(html)) {
    html = html.replace(
      /<meta\s+name=["']robots["'][^>]*\/?>/i,
      `<meta name="robots" content="${escapeHtmlAttr(robots)}" />`
    );
  } else {
    html = html.replace('</head>', `  <meta name="robots" content="${escapeHtmlAttr(robots)}" />\n</head>`);
  }

  // 5. OpenGraph Tags
  const ogTags = [
    `<meta property="og:title" content="${escapeHtmlAttr(title)}" />`,
    `<meta property="og:description" content="${escapeHtmlAttr(description)}" />`,
    `<meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />`,
    `<meta property="og:type" content="${escapeHtmlAttr(ogType)}" />`,
    `<meta property="og:image" content="${escapeHtmlAttr(ogImage)}" />`,
    `<meta property="og:site_name" content="Bsenexus" />`,
  ];

  for (const tag of ['title', 'description', 'url', 'type', 'image', 'site_name']) {
    const regex = new RegExp(`<meta\\s+property=["']og:${tag}["'][^>]*\\/?>`, 'i');
    const replacement = ogTags.find(t => t.includes(`og:${tag}`)) || '';
    if (regex.test(html)) {
      html = html.replace(regex, replacement);
    } else {
      html = html.replace('</head>', `  ${replacement}\n</head>`);
    }
  }

  // 6. Twitter Card Tags
  const twitterTags = [
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtmlAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtmlAttr(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtmlAttr(ogImage)}" />`,
  ];

  for (const tag of ['card', 'title', 'description', 'image']) {
    const regex = new RegExp(`<meta\\s+name=["']twitter:${tag}["'][^>]*\\/?>`, 'i');
    const replacement = twitterTags.find(t => t.includes(`twitter:${tag}`)) || '';
    if (regex.test(html)) {
      html = html.replace(regex, replacement);
    } else {
      html = html.replace('</head>', `  ${replacement}\n</head>`);
    }
  }

  // 7. Inject JSON-LD Structured Data
  if (options.jsonLd) {
    const jsonString = JSON.stringify(options.jsonLd, null, 2);
    const jsonLdScript = `  <script type="application/ld+json">\n${jsonString}\n  </script>\n`;
    html = html.replace('</head>', `${jsonLdScript}</head>`);
  }

  // 8. Inject Semantic Content inside <div id="root">...</div>
  const rootRegex = /<div\s+id=["']root["']>([\s\S]*?)<\/div>/i;
  if (rootRegex.test(html)) {
    html = html.replace(rootRegex, `<div id="root">\n${options.rootInnerHtml}\n</div>`);
  } else {
    // Fallback if #root is somehow not matched
    html = html.replace('<body>', `<body>\n<div id="root">\n${options.rootInnerHtml}\n</div>`);
  }

  return html;
}

/**
 * Generates pre-hydrated semantic HTML and metadata for individual company pages (/company/:symbol).
 */
export function prerenderCompanyHtml(
  data: any,
  symbol: string,
  scripCode?: string,
  customTemplate?: string
): string {
  const companyName = data?.companyName || symbol;
  const cleanCompanyName = companyName.replace(/\s+(Limited|Ltd\.?)$/i, '').trim();
  const canonicalUrl = `https://bsenexus.in/company/${encodeURIComponent(symbol)}`;
  const pageTitle = `${cleanCompanyName} (${symbol}) BSE Announcements & Filings Live | Bsenexus`;

  const recentFilings = Array.isArray(data?.recentFilings) ? data.recentFilings : [];
  const latestFiling = recentFilings[0];
  const latestHeadline = latestFiling?.headline || latestFiling?.subject || latestFiling?.NEWSSUB || '';
  const safeHeadline = latestHeadline.replace(/`/g, "'").replace(/\$\{/g, '$ {').replace(/\s+/g, ' ').trim();
  const scripTag = scripCode ? ` | BSE: ${scripCode}` : '';
  const currentYear = new Date().getFullYear();

  const description = safeHeadline
    ? `Get live BSE announcements & PDF filings for ${cleanCompanyName} (${symbol}${scripTag}). Latest disclosure: "${safeHeadline.slice(0, 48)}...". Track in real-time.`.slice(0, 155)
    : `Get live BSE announcements, ${currentYear} results & official PDF filings for ${cleanCompanyName} (${symbol}${scripTag}). Track board meetings & corporate actions.`.slice(0, 155);

  const latestFilingDate = latestFiling?.bseTime || (latestFiling?.timestamp ? new Date(latestFiling.timestamp).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : '');

  const faqItems = [
    {
      q: `What is the latest BSE announcement by ${companyName}?`,
      a: safeHeadline
        ? `The latest BSE disclosure by ${companyName} (${symbol})${latestFilingDate ? `, filed on ${latestFilingDate},` : ''} is: "${safeHeadline}". Bsenexus tracks every official filing for ${companyName} with AI-powered summaries on its announcements feed.`
        : `${companyName} (${symbol}) disclosures are tracked on Bsenexus, which structures every official BSE filing with AI-powered summaries.`
    },
    {
      q: `When is ${companyName}'s next board meeting?`,
      a: data?.upcomingEvent?.meetingDate
        ? `${companyName} has a board meeting scheduled for ${data.upcomingEvent.meetingDate}${data.upcomingEvent.purpose ? ` to consider: ${data.upcomingEvent.purpose}` : ''}.`
        : `No upcoming board meeting is currently tracked for ${companyName}. Companies disclose meeting intimations under SEBI LODR, and scheduled dates appear on the Bsenexus Results Calendar.`
    },
    {
      q: `When does ${companyName} declare quarterly results?`,
      a: `Under SEBI (LODR) Regulation 33, listed companies submit quarterly unaudited results within 45 days of the quarter ending, and annual audited figures within 60 days. Track scheduled board meetings on the Bsenexus Results Calendar.`
    }
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Corporation',
        '@id': `${canonicalUrl}#corporation`,
        name: companyName,
        tickerSymbol: `BSE:${scripCode || symbol}`,
        url: canonicalUrl,
        description,
        sameAs: scripCode
          ? [`https://www.bseindia.com/stock-share-price/${encodeURIComponent(symbol.toLowerCase())}/${encodeURIComponent(symbol.toLowerCase())}/${scripCode}/`]
          : []
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://bsenexus.in/' },
          { '@type': 'ListItem', position: 2, name: 'Companies', item: 'https://bsenexus.in/companies' },
          { '@type': 'ListItem', position: 3, name: companyName, item: canonicalUrl }
        ]
      },
      {
        '@type': 'FAQPage',
        '@id': `${canonicalUrl}#faq`,
        mainEntity: faqItems.map(item => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.a
          }
        }))
      }
    ]
  };

  const rootInnerHtml = `
    <div class="ssr-prehydration-wrapper" style="max-width:920px;margin:24px auto;padding:0 20px;font-family:sans-serif;">
      <header class="ssr-company-header" style="margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-weight:700;font-size:0.875rem;padding:2px 8px;background:#ECFDF5;color:#065F46;border-radius:4px;">${escapeHtmlText(symbol)}</span>
          ${scripCode ? `<span style="font-size:0.875rem;padding:2px 8px;background:#F1F5F9;color:#334155;border-radius:4px;">BSE: ${escapeHtmlText(String(scripCode))}</span>` : ''}
        </div>
        <h1 style="font-size:1.875rem;font-weight:700;color:#0F172A;margin:0 0 8px 0;">${escapeHtmlText(companyName)} (${escapeHtmlText(symbol)})</h1>
        <p style="color:#64748B;font-size:0.95rem;line-height:1.5;">${escapeHtmlText(description)}</p>
      </header>
      <main class="ssr-company-content">
        <section style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;padding:24px;margin-bottom:24px;">
          <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:16px;">Latest Regulatory Announcements &amp; BSE Disclosures</h2>
          ${recentFilings.length > 0 ? `
            <div style="display:flex;flex-direction:column;gap:12px;">
              ${recentFilings.slice(0, 5).map((f: any) => `
                <article style="border-bottom:1px solid #F1F5F9;padding-bottom:12px;">
                  <h3 style="font-size:1rem;font-weight:600;margin:0 0 4px 0;">
                    ${f.id || f.newsId ? `<a href="/filing/${escapeHtmlAttr(symbol)}/${escapeHtmlAttr(f.id || f.newsId)}" style="color:#0F172A;text-decoration:none;">${escapeHtmlText(f.headline || f.subject || f.NEWSSUB || 'Corporate Filing')}</a>` : escapeHtmlText(f.headline || f.subject || f.NEWSSUB || 'Corporate Filing')}
                  </h3>
                  <div style="font-size:0.8125rem;color:#64748B;">${escapeHtmlText(f.bseTime || '')}</div>
                </article>
              `).join('\n')}
            </div>
          ` : '<p style="color:#64748B;">Official disclosures for this company are tracked live from the BSE feed.</p>'}
        </section>
        <section style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;padding:24px;">
          <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:16px;">Frequently Asked Questions</h2>
          <div style="display:flex;flex-direction:column;gap:16px;">
            ${faqItems.map(faq => `
              <div>
                <h3 style="font-size:1rem;font-weight:600;color:#1C362A;margin:0 0 4px 0;">${escapeHtmlText(faq.q)}</h3>
                <p style="color:#334155;font-size:0.9375rem;line-height:1.5;margin:0;">${escapeHtmlText(faq.a)}</p>
              </div>
            `).join('\n')}
          </div>
        </section>
      </main>
    </div>
  `;

  return buildPrehydratedHtml(
    {
      title: pageTitle,
      description,
      canonical: canonicalUrl,
      ogType: 'website',
      jsonLd,
      rootInnerHtml
    },
    customTemplate
  );
}

/**
 * Generates pre-hydrated semantic HTML and metadata for individual filing pages (/filing/:symbol/:id).
 */
export function prerenderFilingHtml(
  announcement: any,
  symbol: string,
  newsId: string,
  customTemplate?: string
): string {
  const companyName = announcement?.companyName || announcement?.SLONGNAME || symbol || 'BSE Listed Company';
  const subject = announcement?.subject || announcement?.NEWSSUB || 'Corporate Announcement';
  const details = announcement?.details || announcement?.ATTACHMENTNAME || '';
  const category = announcement?.category || 'CORPORATE_ACTION';
  const scripCode = announcement?.scripCode || announcement?.scrip_cd || announcement?.SCRIP_CD || '';
  const aiSummary = announcement?.aiSummary || '';
  const bseTime = announcement?.bseTime || '';

  let pubTs = announcement?.bseTimestamp || announcement?.fetched_at;
  if (!pubTs && announcement?.timestamp) pubTs = announcement.timestamp;
  if (!pubTs || isNaN(pubTs) || pubTs <= 0) pubTs = Date.now();
  const publishedIso = new Date(pubTs).toISOString();

  const displayDate = bseTime || new Date(pubTs).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }) + ' IST';

  const canonicalUrl = `https://bsenexus.in/filing/${encodeURIComponent(symbol)}/${encodeURIComponent(newsId)}`;
  const pageTitle = `${companyName} — ${subject} | Bsenexus`;

  let description = `${companyName} — ${subject} (${displayDate}). `;
  if (aiSummary && aiSummary.trim()) {
    description += aiSummary.trim().replace(/\s+/g, ' ');
  } else if (details && details.trim() && details.trim() !== subject.trim()) {
    description += details.trim().replace(/\s+/g, ' ');
  } else {
    description += `Official regulatory disclosure filed with BSE India. Track real-time corporate announcements on Bsenexus.`;
  }
  if (description.length > 158) {
    description = description.slice(0, 155).trim() + '...';
  }

  const isBatchTest = newsId.toLowerCase().includes('batch_test_');
  const robots = isBatchTest
    ? 'noindex, nofollow'
    : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: `${companyName}: ${subject}`.slice(0, 110),
    datePublished: publishedIso,
    dateModified: publishedIso,
    description,
    mainEntityOfPage: canonicalUrl,
    url: canonicalUrl,
    publisher: {
      '@type': 'Organization',
      name: 'Bsenexus',
      url: 'https://bsenexus.in',
      logo: {
        '@type': 'ImageObject',
        url: 'https://bsenexus.in/icon-192.png'
      }
    },
    author: {
      '@type': 'Organization',
      name: companyName || 'BSE Corporate Announcements'
    }
  };

  const rootInnerHtml = `
    <div class="ssr-prehydration-wrapper" style="max-width:820px;margin:24px auto;padding:0 20px;font-family:sans-serif;">
      <article class="ssr-filing-card" style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;padding:32px;">
        <header style="margin-bottom:20px;">
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:12px;">
            <span style="font-weight:700;font-size:0.75rem;padding:4px 10px;background:#ECFDF5;color:#047857;border-radius:6px;text-transform:uppercase;">${escapeHtmlText(category)}</span>
            ${scripCode ? `<span style="font-size:0.75rem;padding:4px 10px;background:#F1F5F9;color:#475569;border-radius:6px;">BSE: ${escapeHtmlText(String(scripCode))}</span>` : ''}
            <span style="font-size:0.75rem;padding:4px 10px;background:#F1F5F9;color:#475569;border-radius:6px;">${escapeHtmlText(symbol)}</span>
            <time datetime="${escapeHtmlAttr(publishedIso)}" style="font-size:0.8125rem;color:#64748B;margin-left:auto;">${escapeHtmlText(displayDate)}</time>
          </div>
          <h1 style="font-size:1.75rem;font-weight:800;color:#0F172A;line-height:1.3;margin:0 0 8px 0;">${escapeHtmlText(companyName)}</h1>
          <h2 style="font-size:1.125rem;font-weight:600;color:#334155;margin:0;line-height:1.4;">${escapeHtmlText(subject)}</h2>
        </header>
        ${aiSummary ? `
          <section style="background:#F0FDF4;border:1px solid #BBF7D0;border-left:4px solid #16A34A;border-radius:12px;padding:20px;margin-bottom:24px;">
            <h3 style="font-size:0.875rem;font-weight:700;color:#15803D;text-transform:uppercase;margin:0 0 8px 0;">⚡ AI Intelligence Summary</h3>
            <p style="font-size:0.9375rem;color:#166534;line-height:1.6;margin:0;">${escapeHtmlText(aiSummary)}</p>
          </section>
        ` : ''}
        ${details && details !== subject ? `
          <section style="margin-bottom:24px;">
            <h3 style="font-size:0.8125rem;font-weight:700;text-transform:uppercase;color:#64748B;margin:0 0 8px 0;">Filing Description</h3>
            <div style="font-size:0.9375rem;color:#334155;white-space:pre-line;line-height:1.6;background:#F8FAFC;border:1px solid #F1F5F9;border-radius:12px;padding:20px;">
              ${escapeHtmlText(details)}
            </div>
          </section>
        ` : ''}
        <div style="padding-top:16px;border-top:1px solid #E2E8F0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <a href="/announcements" style="color:#059669;font-weight:600;font-size:0.875rem;text-decoration:none;">&larr; Return to Live BSE Announcements</a>
          <a href="https://bsenexus.in/" style="color:#64748B;font-size:0.875rem;text-decoration:none;">Bsenexus Terminal</a>
        </div>
      </article>
    </div>
  `;

  return buildPrehydratedHtml(
    {
      title: pageTitle,
      description,
      canonical: canonicalUrl,
      ogType: 'article',
      robots,
      jsonLd,
      rootInnerHtml
    },
    customTemplate
  );
}

/**
 * Generates pre-hydrated semantic HTML and metadata for the /announcements feed page.
 * Eliminates Google Search Console Soft 404 by rendering the latest 20-30 corporate filings
 * directly inside the HTML body (#root), enabling seamless client-side React hydration without cloaking.
 */
export function prerenderAnnouncementsHtml(
  filings: any[] = [],
  customTemplate?: string
): string {
  const canonicalUrl = 'https://bsenexus.in/announcements';
  const pageTitle = 'BSE Corporate Announcements & Financial Results Feed | Bsenexus';
  const description = 'Track BSE corporate announcements, board meetings, financial disclosures, and regulatory filings with AI-powered financial summaries on Bsenexus.';

  const recentItems = Array.isArray(filings) ? filings.slice(0, 30) : [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${canonicalUrl}#feed`,
        url: canonicalUrl,
        name: pageTitle,
        description,
        mainEntity: {
          '@type': 'ItemList',
          name: 'Latest BSE Corporate Filings',
          numberOfItems: recentItems.length,
          itemListElement: recentItems.map((f: any, idx: number) => {
            const cleanId = String(f.id || f.newsId || '').trim();
            const comp = f.companyName || f.SLONGNAME || f.symbol || 'BSE Listed Company';
            const subj = f.subject || f.headline || f.NEWSSUB || 'Corporate Filing';
            return {
              '@type': 'ListItem',
              position: idx + 1,
              url: `https://bsenexus.in/announcement/${encodeURIComponent(cleanId)}`,
              name: `${comp}: ${subj}`.slice(0, 110)
            };
          })
        }
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://bsenexus.in/' },
          { '@type': 'ListItem', position: 2, name: 'Announcements', item: canonicalUrl }
        ]
      }
    ]
  };

  const rootInnerHtml = `
    <div class="ssr-prehydration-wrapper ssr-announcements-feed" style="max-width:960px;margin:24px auto;padding:0 20px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif;">
      <header class="ssr-announcements-header" style="margin-bottom:24px;border-bottom:1px solid #E2E8F0;padding-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-weight:700;font-size:0.75rem;padding:3px 8px;background:#ECFDF5;color:#065F46;border-radius:4px;text-transform:uppercase;letter-spacing:0.04em;">Live Feed</span>
          <span style="font-size:0.75rem;color:#64748B;">Automated 15s BSE Regulatory Stream</span>
        </div>
        <h1 style="font-size:1.875rem;font-weight:800;color:#0F172A;line-height:1.25;margin:0 0 8px 0;">BSE Corporate Announcements &amp; Regulatory Filings</h1>
        <p style="color:#64748B;font-size:0.95rem;line-height:1.5;margin:0;">Track real-time Bombay Stock Exchange disclosures, board meeting intimations, quarterly financial results, and SEBI LODR Regulation 30/33 announcements with instant summaries.</p>
      </header>
      <main class="ssr-announcements-content">
        <section style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;padding:24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;border-bottom:1px solid #F1F5F9;padding-bottom:12px;">
            <h2 style="font-size:1.125rem;font-weight:700;color:#0F172A;margin:0;">Latest Corporate Disclosures (${recentItems.length})</h2>
            <span style="font-size:0.75rem;font-weight:600;color:#059669;background:#ECFDF5;padding:3px 8px;border-radius:4px;">Real-Time</span>
          </div>
          ${recentItems.length > 0 ? `
            <div style="display:flex;flex-direction:column;gap:16px;">
              ${recentItems.map((item: any) => {
                const cleanId = String(item.id || item.newsId || '').trim();
                const symbol = String(item.symbol || item.scrip_id || '').toUpperCase();
                const scripCode = item.scripCode || item.scrip_cd || item.SCRIP_CD || '';
                const companyName = item.companyName || item.SLONGNAME || symbol || 'BSE Listed Company';
                const headline = item.headline || item.subject || item.NEWSSUB || 'BSE Corporate Announcement';
                const category = item.category || 'CORPORATE_ACTION';
                const snippet = (item.aiSummary || item.details || item.ATTACHMENTNAME || '').trim();

                let pubTs = item.bseTimestamp || item.fetched_at || item.timestamp;
                if (!pubTs || isNaN(pubTs) || pubTs <= 0) pubTs = Date.now();
                const pubIso = new Date(pubTs).toISOString();
                const displayDate = item.bseTime || new Date(pubTs).toLocaleString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                }) + ' IST';

                return `
                  <article style="border-bottom:1px solid #F1F5F9;padding-bottom:14px;">
                    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:6px;">
                      ${symbol ? `<span style="font-weight:700;font-size:0.75rem;padding:2px 6px;background:#F1F5F9;color:#334155;border-radius:4px;">${escapeHtmlText(symbol)}</span>` : ''}
                      ${scripCode ? `<span style="font-size:0.75rem;color:#64748B;">BSE: ${escapeHtmlText(String(scripCode))}</span>` : ''}
                      <span style="font-size:0.7rem;font-weight:600;padding:2px 6px;background:#ECFDF5;color:#065F46;border-radius:4px;text-transform:uppercase;">${escapeHtmlText(category)}</span>
                      <time datetime="${escapeHtmlAttr(pubIso)}" style="font-size:0.75rem;color:#94A3B8;margin-left:auto;">${escapeHtmlText(displayDate)}</time>
                    </div>
                    <div style="font-size:0.8125rem;color:#475569;margin-bottom:4px;">
                      <strong>${escapeHtmlText(companyName)}</strong>
                    </div>
                    <h3 style="font-size:0.95rem;font-weight:600;margin:0 0 6px 0;line-height:1.4;">
                      <a href="/announcement/${escapeHtmlAttr(cleanId)}" style="color:#0F172A;text-decoration:none;">${escapeHtmlText(headline)}</a>
                    </h3>
                    ${snippet && snippet !== headline ? `
                      <p style="font-size:0.8125rem;color:#64748B;line-height:1.4;margin:0;">${escapeHtmlText(snippet.slice(0, 180))}${snippet.length > 180 ? '...' : ''}</p>
                    ` : ''}
                  </article>
                `;
              }).join('\n')}
            </div>
          ` : '<p style="color:#64748B;">Monitoring BSE feed for live corporate filings...</p>'}
        </section>
        <section style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:20px;text-align:center;">
          <h3 style="font-size:1rem;font-weight:700;color:#1C362A;margin:0 0 8px 0;">Looking for company intelligence or scheduled earnings?</h3>
          <p style="color:#64748B;font-size:0.875rem;margin:0 0 14px 0;">Explore upcoming board meetings on the Results Calendar or explore detailed corporate hubs.</p>
          <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;">
            <a href="/results-calendar" style="display:inline-block;background:#1C362A;color:#34D399;font-weight:600;font-size:0.8125rem;padding:8px 16px;border-radius:6px;text-decoration:none;">Results Calendar &rarr;</a>
            <a href="/companies" style="display:inline-block;background:#FFFFFF;border:1px solid #CBD5E1;color:#334155;font-weight:600;font-size:0.8125rem;padding:8px 16px;border-radius:6px;text-decoration:none;">Company Directory</a>
          </div>
        </section>
      </main>
    </div>
  `;

  return buildPrehydratedHtml(
    {
      title: pageTitle,
      description,
      canonical: canonicalUrl,
      ogType: 'website',
      jsonLd,
      rootInnerHtml
    },
    customTemplate
  );
}

/**
 * Builds the tiered sitemap index linking to core, companies, and hot filings sitemaps.
 */
export function buildSitemapIndexXml(todayStr: string = new Date().toISOString().split('T')[0]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://bsenexus.in/sitemap-core.xml</loc>
    <lastmod>${todayStr}</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://bsenexus.in/sitemap-companies.xml</loc>
    <lastmod>${todayStr}</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://bsenexus.in/sitemap-filings-hot.xml</loc>
    <lastmod>${todayStr}</lastmod>
  </sitemap>
</sitemapindex>
`;
}

/**
 * Matches ONLY the static placeholder filing cards inside .critical-preloader
 * (dist/index.html) by their distinctive inline style. The hidden AEO <main> FAQ
 * uses plain <article> tags and is intentionally NOT matched.
 */
export const PRELOADER_CARD_RE = /<article style="background: #181624;[\s\S]*?<\/article>/g;

/**
 * Normalized feed items shared by the pre-rendered cards and the dynamic
 * CollectionPage JSON-LD: same real filings, same canonical /filing link rule
 * as the /announcement/:newsId route. No cloaking — both consumers see the
 * same data the React client renders.
 */
export interface AnnouncementsFeedItem {
  newsId: string;
  companyName: string;
  subject: string;
  symbol: string;
  scripCode: string;
  category: string;
  link: string;
  dateStr: string;
}

export async function getAnnouncementsFeedItems(limit: number): Promise<AnnouncementsFeedItem[]> {
  const recent = await getRecentAnnouncements(30);
  const items: AnnouncementsFeedItem[] = [];
  for (const a of (recent || [])) {
    if (!a || !(a.newsId || a.id)) continue;
    const newsId = String(a.newsId || a.id || '').trim();
    if (!newsId) continue;
    const symbol = String(a.symbol || a.scrip_id || '').trim().toUpperCase();
    // Same canonical rule as the /announcement/:newsId route: prefer /filing/:symbol/:newsId
    const link = /^[A-Z0-9-]{2,20}$/.test(symbol)
      ? `/filing/${encodeURIComponent(symbol)}/${encodeURIComponent(newsId)}`
      : `/announcement/${encodeURIComponent(newsId)}`;
    let ts: number = (typeof a.bseTimestamp === 'number' && !isNaN(a.bseTimestamp) && a.bseTimestamp > 0)
      ? a.bseTimestamp
      : (a.fetched_at || 0);
    if ((!ts || ts <= 0) && a.bseTime) {
      try { ts = parseBseDate(a.bseTime); } catch { ts = 0; }
    }
    const dateStr = ts && ts > 0
      ? new Date(ts).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
          hour: '2-digit', minute: '2-digit', hour12: true,
        })
      : '';
    items.push({
      newsId,
      companyName: String(a.companyName || a.SLONGNAME || 'BSE Listed Company'),
      subject: String(a.subject || a.NEWSSUB || 'Corporate Announcement'),
      symbol,
      scripCode: String(a.scripCode || a.scrip_cd || a.SCRIP_CD || '').trim(),
      category: String(a.category || 'DISCLOSURE').toUpperCase().replace(/_/g, ' '),
      link,
      dateStr,
    });
    if (items.length >= limit) break;
  }
  return items;
}

/**
 * Dynamic CollectionPage JSON-LD for /announcements: ItemList built from the
 * same real latest filings as the pre-rendered cards (accurate numberOfItems,
 * real /filing URLs). Replaces the previous hardcoded sample entries.
 * Returns the full <script> block, or '' when the feed is empty/failed so the
 * caller keeps the neutral CollectionPage fallback.
 */
export async function buildAnnouncementsCollectionJsonLd(): Promise<string> {
  try {
    const items = await getAnnouncementsFeedItems(10);
    if (items.length === 0) return '';
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': 'https://bsenexus.in/announcements#feed',
      name: 'Live BSE Corporate Announcements & Disclosures Feed',
      url: 'https://bsenexus.in/announcements',
      description: 'Live real-time stream of Bombay Stock Exchange (BSE India) corporate announcements, SEBI LODR Regulation 30/33 disclosures, board meeting intimations, quarterly financial results, and AI-powered earnings metric summaries.',
      mainEntity: {
        '@type': 'ItemList',
        name: 'Latest BSE Corporate Filings',
        numberOfItems: items.length,
        itemListElement: items.map((it, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: `${it.companyName} — ${it.subject}`.slice(0, 220),
          url: `https://bsenexus.in${it.link}`,
        })),
      },
    };
    // JSON.stringify escapes the payload; neutralize any stray </script in data.
    const json = JSON.stringify(schema, null, 2).replace(/<\/(script)/gi, '<\\/$1');
    return `  <script type="application/ld+json">\n${json}\n  </script>`;
  } catch {
    return '';
  }
}

/**
 * /announcements Soft-404 fix: builds real filing cards (latest live filings from
 * Firestore) in the same visual style as the shell's placeholder cards.
 *
 * - Same data the React client renders (no cloaking): createRoot replaces this on mount.
 * - All dynamic text is HTML-escaped (R08).
 * - Any failure returns '' so the caller serves the normal shell unchanged.
 */
export async function buildAnnouncementsFeedCards(): Promise<string> {
  try {
    const items = await getAnnouncementsFeedItems(24);
    if (items.length === 0) return '';

    const cards = items.map((a) => {
      const companyName = a.companyName;
      const subject = a.subject;
      const scripCode = a.scripCode;
      const link = a.link;
      const dateStr = a.dateStr;
      const category = a.category;

      return `<article style="background: #181624; border: 1px solid #2D283E; border-radius: 12px; padding: 14px;">`
        + `<a href="${escapeHtmlAttr(link)}" style="text-decoration: none; display: block;">`
        + `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 8px;">`
        + `<span style="font-weight: 700; font-size: 13px; color: #FFFFFF;">${escapeHtmlText(companyName)}</span>`
        + (scripCode ? `<span style="font-family: monospace; font-size: 11px; background: #221F30; color: #10B981; padding: 2px 6px; border-radius: 4px; border: 1px solid #342E46; white-space: nowrap;">BSE: ${escapeHtmlText(scripCode)}</span>` : '')
        + `</div>`
        + `<p style="font-size: 12px; color: #94A3B8; margin: 0 0 8px 0; line-height: 1.4;">${escapeHtmlText(subject)}</p>`
        + `<div style="display: flex; justify-content: space-between; align-items: center;">`
        + `<span style="font-size: 10px; font-weight: 700; background: rgba(16, 185, 129, 0.15); color: #10B981; padding: 2px 6px; border-radius: 4px;">${escapeHtmlText(category.slice(0, 24))}</span>`
        + (dateStr ? `<span style="font-size: 10px; color: #64748B;">${escapeHtmlText(dateStr)}</span>` : '')
        + `</div></a></article>`;
    }).filter(Boolean);

    return cards.length > 0 ? cards.join('\n') : '';
  } catch {
    return '';
  }
}
