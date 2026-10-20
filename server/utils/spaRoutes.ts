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
