import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import tsconfigPaths from 'vite-tsconfig-paths'
import { resolve } from 'path'

export default defineConfig({
  root: './',
  base: '/beLive/',
  
  // ← ДОБАВЛЯЕМ ПУБЛИЧНУЮ ДИРЕКТОРИЮ!
  publicDir: 'public',
  
  build: {
    outDir: 'dist',
    minify: 'esbuild',
    
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    },
    
    // ← КОПИРУЕМ ДОПОЛНИТЕЛЬНЫЕ АССЕТЫ!
    assetsInlineLimit: 0,
    
    copyPublicDir: true
  },
  
  plugins: [
    tsconfigPaths(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      
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
            src: '/beLive/img/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/beLive/img/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,ico,png,jpg,jpeg,svg,woff,woff2}',
          'Concert/**/*.jpg',
          'Karaoke/**/*.jpg',
          'Rehearsal/**/*.jpg'
        ],
        
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
          },
          {
            urlPattern: /^https:\/\/esm\.sh\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'esm-cache',
              networkTimeoutSeconds: 10
            }
          },
          {
            urlPattern: /\.(jpg|jpeg|png|svg)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30
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
  
  server: {
    host: '0.0.0.0',
    port: 3000
  }
})
