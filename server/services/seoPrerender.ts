import fs from 'node:fs';
import path from 'node:path';

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
  const canonicalUrl = `https://bsenexus.in/company/${encodeURIComponent(symbol)}`;
  const pageTitle = `${companyName} (${symbol}) — BSE Announcements, Results & Corporate Actions | Bsenexus`;

  const recentFilings = Array.isArray(data?.recentFilings) ? data.recentFilings : [];
  const latestFiling = recentFilings[0];
  const latestHeadline = latestFiling?.headline || latestFiling?.subject || latestFiling?.NEWSSUB || '';

  const description = latestHeadline
    ? `Track ${companyName} (${symbol} / BSE:${scripCode || ''}) announcements, results & corporate actions. Latest disclosure: ${latestHeadline}`.slice(0, 155)
    : `Track ${companyName} (${symbol} / BSE:${scripCode || ''}) announcements, quarterly results, board meetings, and corporate actions live on Bsenexus.`.slice(0, 155);

  const safeHeadline = latestHeadline.replace(/`/g, "'").replace(/\$\{/g, '$ {');
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
