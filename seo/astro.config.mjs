import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import { SITE } from './src/lib/site.mjs';

export default defineConfig({
  site: SITE,
  // Marketing URLs are served as /slug/ (directory format). `ignore` keeps both
  // /slug and /slug/ resolving while canonical always points at one form.
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    // Small pages: inlining CSS removes a render-blocking request.
    inlineStylesheets: 'auto',
  },
  integrations: [
    sitemap({
      // 404 is a utility page, not a landing page.
      filter: (page) => !page.includes('/404'),
    }),
  ],
});
