// Production-only resource discovery. No feature is evaluated or authorized here.
export function landingPreloadFiles(bundle) {
  const landing = Object.values(bundle).find(chunk => chunk.type === 'chunk' &&
    [chunk.facadeModuleId, ...(chunk.moduleIds || [])].some(id => id?.replaceAll('\\', '/').endsWith('/src/components/LandingPage.tsx')));
  if (!landing) throw Error('LandingPage production chunk is missing');
  const seen = new Set();
  const visit = file => {
    if (seen.has(file)) return;
    const chunk = bundle[file];
    if (!chunk || chunk.type !== 'chunk') throw Error(`Missing public preload chunk: ${file}`);
    seen.add(file);
    for (const dependency of chunk.imports) visit(dependency);
  };
  visit(landing.fileName);
  return [...seen];
}

/** @returns {import('vite').Plugin} */
export function publicLandingPreload() {
  let base = '/';
  return {
    name: 'public-landing-preload',
    apply: 'build',
    configResolved(config) { base = config.base; },
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        const urls = landingPreloadFiles(context.bundle).map(file => base + file);
        // Keep this root-only: shared HTML also serves private, payment and gift routes.
        // Cached identity is only a routing hint, never a permission check.
        const encoded = JSON.stringify(urls).replaceAll('<', '\\u003c');
        return [{ tag: 'script', attrs: { nonce: '__CSP_NONCE__', 'data-public-preload': '' },
          injectTo: 'head-prepend', children: `try{if(location.pathname==='/'&&!location.search&&!localStorage.getItem('bse_nexus_auth_session')){for(const href of ${encoded}){const link=document.createElement('link');link.rel='modulepreload';link.crossOrigin='';link.href=href;document.head.appendChild(link)}}}catch{}` }];
      },
    },
  };
}
