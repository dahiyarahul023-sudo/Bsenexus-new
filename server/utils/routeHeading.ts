/** Public route headings are visible in the initial document and replaced with #root on React mount. */
export const PUBLIC_ROUTE_HEADINGS: Record<string, string> = {
  default: 'Every BSE filing, decoded in seconds.',
  announcements: 'BSE Corporate Announcements & Filings',
  live: 'BSE Corporate Announcements & Filings',
  plugin: 'Use BSE Nexus in your AI',
  watchlists: 'Your Stock Watchlist',
};
export function injectRouteHeading(html: string, route = 'default'): string {
  const heading = PUBLIC_ROUTE_HEADINGS[route];
  const safe = heading?.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return html.replace(/<!--route-heading-->[\s\S]*?<!--\/route-heading-->/,
    () => `<!--route-heading-->${safe ? `<h1 class="app-boot-heading">${safe}</h1>` : '<span>BSE Nexus</span>'}<!--/route-heading-->`);
}
