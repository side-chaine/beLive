import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import tsconfigPaths from 'vite-tsconfig-paths'
import { resolve } from 'path'

/**
 * @TC-088: Mock feed API for local dev
 * Remove this plugin when deploying — production uses gateway Worker.
 */
function feedMockPlugin(): Plugin {
  return {
    name: 'feed-mock',
    configureServer(server) {
      // Intercept /api/feed before Vite static file handler
      server.middlewares.use('/api/feed', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Cache', 'MOCK');
        res.end(JSON.stringify({
          sections: [
            {
              id: 'featured', title: 'Избранное', type: 'hero-stack', sortOrder: 0,
            },
            {
              id: 'events', title: 'Ближайшие мероприятия', type: 'list', sortOrder: 1,
            },
            {
              id: 'tracks', title: 'Новинки', type: 'scroll', sortOrder: 2,
            },
          ],
          items: [
            {
              id: 'f1', type: 'event', title: 'Мастер-класс: Джаз', subtitle: 'Анна К.',
              description: 'Основы импровизации', priority: 10, status: 'published',
              eventDate: '2026-07-01', price: '1500₽', sectionId: 'featured',
            },
            {
              id: 'p1', type: 'poll', title: '🏆 Лучшее приложение для вокалистов 2026',
              priority: 5, status: 'published', sectionId: 'featured',
              data: { options: [{ id: 'opt1', title: 'Vocal Pitch Monitor', votes: 12 }, { id: 'opt2', title: 'SingTrue', votes: 8 }] },
            },
            {
              id: 'e1', type: 'event', title: 'Вокальный вечер', subtitle: 'Студия beLive',
              description: 'Онлайн стрим', priority: 0, status: 'published', sectionId: 'events',
              eventDate: '2026-06-20', price: 'Бесплатно',
              coverR2Key: null, // будет заполняться ботом через R2
            },
            {
              id: 't1', type: 'track', title: 'Bohemian Rhapsody', subtitle: 'Queen',
              priority: 0, status: 'published', sectionId: 'tracks',
            },
            {
              id: 't2', type: 'track', title: 'Yesterday', subtitle: 'The Beatles',
              priority: 0, status: 'published', sectionId: 'tracks',
            },
          ],
          generatedAt: Date.now(),
        }));
      });
    },
  };
}

export default defineConfig({
  root: './',
  base: process.env.CF_PAGES ? '/' : '/beLive/',
  publicDir: 'public',

  build: {
    outDir: 'dist',
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    },
    copyPublicDir: true
  },

  plugins: [
    tsconfigPaths(),
    feedMockPlugin(), // @TC-088: Remove for production
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',

      manifest: {
        name: 'beLive',
        short_name: 'beLive',
        description: 'Karaoke Rehearsal | Concert Live',
        theme_color: '#6366f1',
        background_color: '#6366f1',
        display: 'standalone',
        orientation: 'landscape',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/img/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/img/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },

      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}', '**/*.wasm'],
        globIgnores: ['**/*.jpg', '**/*.jpeg'],
        runtimeCaching: [
          {
            urlPattern: /\.(jpg|jpeg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          },
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
          },
          {
            urlPattern: /^https:\/\/esm\.sh\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'esm-cache',
              networkTimeoutSeconds: 10
            }
          },
          // @TC-088: Aurora Stage feed API cache
          {
            urlPattern: /^https:\/\/belive-gateway\.nikitosss007\.workers\.dev\/api\/feed/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'feed-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60
              }
            }
          }
        ],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true
      }
    })
  ],

  optimizeDeps: {
    exclude: ['@libraz/libsonare'],
  },

  server: {
    host: '0.0.0.0',
    port: 3000
  }
})
