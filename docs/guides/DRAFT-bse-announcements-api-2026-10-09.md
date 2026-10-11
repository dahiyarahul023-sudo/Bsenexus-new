---
title: "BSE Announcements API Explained: BSE, NSE & Open Feeds"
meta_description: "Explore BSE announcement endpoints, a public JSON feed, curl and Python examples, PDF links, and the checks needed before building an integration."
slug: /guides/bse-announcements-api
canonical: https://bsenexus.in/guides/bse-announcements-api
status: complete-draft-verification-pending
language: en
---

# BSE Announcements API Explained: BSE, NSE & Open Feeds

BSE has no official public API, but its website exposes JSON endpoints (e.g. `api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w`) that developers use with proper headers. NSE offers `nseindia.com/api/corporate-announcements`. For a ready-made feed, BSE Nexus publishes a free public JSON endpoint: `https://bsenexus.in/api/announcements?limit=20` returning filings within ~15 seconds of BSE.

> [VERIFY — editorial review before publication] The required opening is reproduced verbatim from the brief. Its statement about an official API needs qualification: a website endpoint is different from a licensed exchange data product. The ~15-second figure is a homepage claim, not an independently measured latency guarantee. Exchange endpoint availability remains unverified in this draft.

## Does BSE have an official API?

For this guide, distinguish a free, documented developer interface from the JSON services used by an exchange website. Finding a callable URL does not establish a supported API contract, redistribution rights or guaranteed availability. Do not interpret the opening as a claim that BSE has no licensed data products.

The brief describes BSE's website endpoint as reverse-engineered rather than contracted. [VERIFY] Confirm the current exchange offering and permitted use before publishing the categorical “no official public API” wording. BSE's own [market-data portal](https://marketdata.bseindia.com/) is the primary place to check data-product availability.

Website integrations may depend on `Referer`, `Origin` and `User-Agent` headers. [VERIFY] Check the current requirements; this draft does not claim that a specific header set guarantees access. A blocked request is a reason to stop and check access conditions, not to evade restrictions.

## BSE's own endpoints (what developers actually call)

The endpoint identified in the brief is:

`https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w`

### Pagination and query parameters

[VERIFY] The brief reports 50 records per page. Confirm that page size, pagination parameter names, date formats and category or company filters against a current successful response before using them in production. No exchange query-parameter recipe is presented as a tested contract here.

Treat each announcement as a filing record: keep its identifier, subject, company reference, exchange timestamp and attachment reference together. Deduplicate repeated records rather than assuming every poll returns only new filings.

### Getting the original PDF

[VERIFY] The research supplied with the brief describes `PDFFLAG`-dependent attachment locations named `AttachLive`, `AttachHis` and `CorpAttachment`. Verify the exact flag-to-path mapping and a working attachment for each case before constructing URLs. Folder names alone are not a reliable mapping specification.

Where a feed supplies a complete `pdfLink`, use that returned link rather than guessing an attachment path. Read the original document when interpreting [Regulation 30 disclosures](https://bsenexus.in/guides/sebi-lodr-regulation-30).

## NSE's corporate announcements API

The candidate website endpoint in the brief is:

`https://www.nseindia.com/api/corporate-announcements?index=equities`

[VERIFY] Confirm this URL live, the accepted date-range parameter names and formats, and the current response shape before publishing a working NSE example. The supplied research also identifies `nsearchives.nseindia.com` as an attachment host; verify the returned PDF URLs instead of manufacturing filenames.

[VERIFY] The brief reports that NSE blocks some datacenter IPs. Access may therefore differ between environments. Respect access restrictions and use permitted exchange data routes when dependable ingestion is required.

## Open-source libraries (don't reinvent the scraper)

### jugaad-data

The [jugaad-data repository](https://github.com/jugaad-py/jugaad-data) contains a [BSELive implementation](https://github.com/jugaad-py/jugaad-data/blob/master/jugaad_data/bse/live.py). It is a useful starting point for understanding BSE requests and company-code handling. [VERIFY] Check the installed version's announcement methods and scrip mapping before describing them as a supported, working integration. A method in source code is not evidence that the exchange currently accepts its requests.

### indiafilingscraper

[VERIFY] The supplied brief describes `indiafilingscraper` as a pure-HTTP tool covering BSE, NSE and SEBI. Its exact repository URL was not supplied and could not be reliably resolved during this review. Do not invent a GitHub owner, installation command or import path. The [GitHub repository lookup](https://github.com/search?q=indiafilingscraper&type=repositories) is a discovery link, not a verified project link; replace it with the maintainer's canonical repository before publication.

For either approach, review the current source, license and maintenance status. Libraries can reduce request-handling work; they do not create an exchange service guarantee.

## The simplest option: BSE Nexus public feed

The public endpoint described in the brief is:

`GET https://bsenexus.in/api/announcements?limit=20`

The brief records same-day HTTP 200 JSON checks on 9 October 2026: `limit=1` returned one record and `limit=2` returned two. Those are the brief author's observations. This drafting environment received HTTP 403 for both URLs, so it could not independently reproduce them. [VERIFY] Repeat the checks from an allowed deployment environment before publishing the examples as currently tested.

The brief describes this as a free, no-key feed. No API key is included in the examples. No uptime, quota, historical coverage or redistribution commitment is inferred from that observation.

| Field | How to use it |
| --- | --- |
| `id` | Keep the feed's record identifier for deduplication. |
| `newsId` | Preserve the additional identifier when present. |
| `companyName` | Display the filing's company name. |
| `subject` | Display the announcement heading. |
| `details` | Read the provided description; inspect the PDF for the original disclosure. |
| `pdfLink` | Use the supplied attachment link when present. |
| `scrip_cd` | Retain the company-code field; its presence does not imply a query filter. |
| `bseTime` | Preserve the exchange-time value; do not assume a timezone or format not checked in the response. |

These fields are from the brief's response inspection, not a formal versioned schema. Handle missing values rather than assuming every filing has every field.

### curl example

```bash
curl --fail --show-error --silent --max-time 20 \
  'https://bsenexus.in/api/announcements?limit=20'
```

### Python requests example

Install `requests` in your own Python environment, then run:

```python
import requests

url = "https://bsenexus.in/api/announcements"
try:
    response = requests.get(url, params={"limit": 20}, timeout=20)
    response.raise_for_status()
    filings = response.json()
    if not isinstance(filings, list):
        raise ValueError("Expected a JSON array of filing records")
    for filing in filings:
        if not isinstance(filing, dict):
            continue
        print(filing.get("companyName", ""), filing.get("subject", ""))
        print(filing.get("pdfLink", ""))
except (requests.RequestException, ValueError) as error:
    raise SystemExit(f"Unable to read the announcements feed: {error}")
```

This code validates the response and stops on a failed request. It does not claim that a successful fetch proves ingestion latency.

[VERIFY] Do not use `?scrip_cd=` as a documented filter: the brief's request for `500325` returned a `532380` record. Filter results locally if needed, while recognizing that a limited recent-feed slice is not complete company history. Do not infer support for any other filter from the response fields.

The ~15-second figure comes from the [BSE Nexus homepage](https://bsenexus.in/) claim recorded in the brief. [VERIFY] Measure exchange-publication-to-feed availability before presenting it as observed performance. Delayed source access can affect freshness.

For a visual view, use the [live BSE announcements feed](https://bsenexus.in/announcements). You can also [track any listed company](https://bsenexus.in/companies) or consult the [results calendar](https://bsenexus.in/results-calendar).

## Which option should you pick?

| Option | Control | Convenience | Reliability consideration |
| --- | --- | --- | --- |
| BSE website endpoint | Manage exchange requests and raw responses yourself. | Requires pagination and attachment handling. | Reverse-engineered behavior needs ongoing verification. |
| NSE website endpoint | Manage a separate exchange integration. | Useful for the NSE route after live validation. | Access restrictions and response changes must be handled. |
| Open-source wrapper | Adapt the wrapper's implementation. | Reduces repeated request-handling work. | Depends on both the library and the exchange interface. |
| BSE Nexus public feed | Consume the site's normalized records. | One simple URL for the supplied recent-filings use case. | Adds a platform dependency; freshness and current access need checking. |

BSE Nexus is the convenience option for this feed use case. For exchange-direct ingestion at scale, evaluate the exchange's permitted data arrangements and your completeness requirements. Neither the examples nor the comparison establish an SLA.

## FAQ

### Does BSE provide an official API for announcements?

[VERIFY] The brief concerns an undocumented website JSON endpoint, not a contracted developer API. Check BSE's current data products before making the broader claim that no official API exists.

### How can I download BSE announcements automatically?

Use a permitted feed or a verified exchange integration, retain filing identifiers, and follow the returned attachment links. The curl and Python examples show the BSE Nexus feed; live access must be rechecked.

### Is there a free API for Indian stock market announcements?

The brief describes the BSE Nexus announcements endpoint as free and no-key. [VERIFY] Its recorded HTTP 200 checks could not be reproduced here because this environment received HTTP 403.

### What parameters does the BSE announcements endpoint accept?

[VERIFY] The exchange endpoint's pagination, date and category parameters require live validation. For the separate BSE Nexus feed, the brief verified limit=1 and limit=2. Do not document scrip_cd filtering as supported.

### How do I get announcement PDFs programmatically?

Prefer a complete attachment URL returned by the feed. [VERIFY] Confirm the exchange's PDFFLAG mapping before building AttachLive, AttachHis or CorpAttachment paths.

### Does NSE have an announcements API?

[VERIFY] The brief identifies NSE's corporate-announcements website endpoint with index=equities. Confirm current access and query behavior before relying on it as a tested interface.

### Which Python library fetches BSE corporate filings?

jugaad-data contains a BSELive implementation. [VERIFY] Check its current version and live operation. The brief also names indiafilingscraper, whose exact repository and capabilities still need confirmation.

### How fresh is the BSE Nexus announcements feed?

The brief records a homepage claim of approximately 15 seconds after BSE. [VERIFY] This is not an independently measured latency guarantee; validate freshness against original exchange publication times.

Building on this feed? BSE Nexus Pro adds instant Telegram alerts the second a filing drops — so your app isn't the only thing watching.

> [VERIFY — CTA] Required brief wording retained verbatim. Confirm current Pro alert behavior and qualify absolute delivery-timing language before publication.

<!-- Implementation metadata: inject the following graph as application/ld+json, not visible article text. Keep FAQ answers synchronized with visible copy. -->

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": "https://bsenexus.in/guides/bse-announcements-api#article",
      "headline": "BSE Announcements API Explained: BSE, NSE & Open Feeds",
      "description": "Explore BSE announcement endpoints, a public JSON feed, curl and Python examples, PDF links, and the checks needed before building an integration.",
      "url": "https://bsenexus.in/guides/bse-announcements-api",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": "https://bsenexus.in/guides/bse-announcements-api"
      },
      "inLanguage": "en",
      "author": {
        "@type": "Organization",
        "name": "BSE Nexus"
      }
    },
    {
      "@type": "FAQPage",
      "@id": "https://bsenexus.in/guides/bse-announcements-api#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Does BSE provide an official API for announcements?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "[VERIFY] The brief concerns an undocumented website JSON endpoint, not a contracted developer API. Check BSE's current data products before making the broader claim that no official API exists."
          }
        },
        {
          "@type": "Question",
          "name": "How can I download BSE announcements automatically?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Use a permitted feed or a verified exchange integration, retain filing identifiers, and follow the returned attachment links. The curl and Python examples show the BSE Nexus feed; live access must be rechecked."
          }
        },
        {
          "@type": "Question",
          "name": "Is there a free API for Indian stock market announcements?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "The brief describes the BSE Nexus announcements endpoint as free and no-key. [VERIFY] Its recorded HTTP 200 checks could not be reproduced here because this environment received HTTP 403."
          }
        },
        {
          "@type": "Question",
          "name": "What parameters does the BSE announcements endpoint accept?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "[VERIFY] The exchange endpoint's pagination, date and category parameters require live validation. For the separate BSE Nexus feed, the brief verified limit=1 and limit=2. Do not document scrip_cd filtering as supported."
          }
        },
        {
          "@type": "Question",
          "name": "How do I get announcement PDFs programmatically?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Prefer a complete attachment URL returned by the feed. [VERIFY] Confirm the exchange's PDFFLAG mapping before building AttachLive, AttachHis or CorpAttachment paths."
          }
        },
        {
          "@type": "Question",
          "name": "Does NSE have an announcements API?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "[VERIFY] The brief identifies NSE's corporate-announcements website endpoint with index=equities. Confirm current access and query behavior before relying on it as a tested interface."
          }
        },
        {
          "@type": "Question",
          "name": "Which Python library fetches BSE corporate filings?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "jugaad-data contains a BSELive implementation. [VERIFY] Check its current version and live operation. The brief also names indiafilingscraper, whose exact repository and capabilities still need confirmation."
          }
        },
        {
          "@type": "Question",
          "name": "How fresh is the BSE Nexus announcements feed?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "The brief records a homepage claim of approximately 15 seconds after BSE. [VERIFY] This is not an independently measured latency guarantee; validate freshness against original exchange publication times."
          }
        }
      ]
    }
  ]
}
```
