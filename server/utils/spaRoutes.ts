import type { RequestHandler } from 'express';

// Match App.getAppPathRoute's bounded case/trailing-slash normalization.
// Unknown paths stay unknown; this is never a universal SPA fallback.
export const SPA_PATHS = [
  "/", "/announcements", "/live", "/results-calendar", "/watchlist",
  "/watchlists", "/companies", "/about", "/contact", "/disclaimer",
  "/privacy-policy", "/terms", "/plugin", "/ai-plugin", "/settings",
];
export function normalizeSpaPath(path: string): string {
  return path.toLowerCase().replace(/\/+$/, "") || "/";
}
// Run before both development and production SPA fallbacks. Canonical metadata
// alone left these old links serving the generic homepage document.
export const redirectLegacyCalendar: RequestHandler = (req, res, next) => {
  if (req.path !== '/' || !['GET', 'HEAD'].includes(req.method)) return next();
  const url = new URL(req.originalUrl, 'https://bsenexus.in');
  const tabs = url.searchParams.getAll('tab');
  if (tabs.length !== 1 || !['results-calendar', 'results'].includes(tabs[0].trim().toLowerCase())) return next();
  url.searchParams.delete('tab');
  // Keep referral, share, filter and tracking parameters, including duplicates.
  // The fixed local path cannot become an external redirect.
  return res.redirect(301, '/results-calendar' + url.search);
};
