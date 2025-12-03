import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  base: '/beLive/',
  plugins: [
    tsconfigPaths(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['**/*'],
      manifest: {
        name: 'beLive - Karaoke & Rehearsal',
        short_name: 'beLive',
        description: 'Practice karaoke and rehearsals anywhere, anytime',
        theme_color: '#6366f1',
        background_color: '#0f0f23',
        display: 'standalone',
        scope: '/beLive/',
        start_url: '/beLive/',
        icons: [
          {
            src: 'img/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'img/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    mimeTypes: {
      '.ts': 'application/javascript',
    },
  },
})
