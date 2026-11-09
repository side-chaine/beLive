import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import { SITE } from './src/lib/site.mjs';
import { isSitemapPath } from './src/lib/doors.mjs';

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
      // Publication is decided by the door registry, not by the build:
      // 404 is a utility page, and 'soon' doors stay out until their feature
      // actually ships.
      filter: (page) => isSitemapPath(new URL(page).pathname),
    }),
  ],
});
