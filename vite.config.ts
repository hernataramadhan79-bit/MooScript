import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fontDataUri } from './fontDataUriPlugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    fontDataUri(),
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['logo.svg', 'favicon.ico', 'apple-touch-icon-180x180.png', 'fonts/*'],
      manifest: {
        id: '/',
        name: 'MooScript Studio',
        short_name: 'MooScript',
        description: 'Zero-Server Motion Graphics Generator & Short Video Studio',
        lang: 'id',
        categories: ['productivity', 'multimedia'],
        theme_color: '#131315',
        background_color: '#131315',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallbackDenylist: [/^\/privacy\.html$/],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\.(?:wasm)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mooscript-wasm-cache',
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/huggingface\.co\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'huggingface-models-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Hugging Face LFS redirect target (cas-bridge.xethub.hf.co)
            urlPattern: /^https:\/\/([a-z0-9-]+\.)?xethub\.hf\.co\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'huggingface-lfs-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    open: false
  }
});
