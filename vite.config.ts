import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fontDataUri } from './fontDataUriPlugin';
import fs from 'node:fs';
import path from 'node:path';

function onnxWasmPlugin(): Plugin {
  const onnxDist = path.resolve(__dirname, 'node_modules/onnxruntime-web/dist');
  const wasmFiles = [
    'ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd-threaded.mjs',
    'ort-wasm-simd-threaded.jsep.wasm',
    'ort-wasm-simd-threaded.jsep.mjs'
  ];

  return {
    name: 'onnx-wasm-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/onnx/')) {
          const fileName = req.url.replace(/^\/onnx\//, '').split('?')[0];
          const filePath = path.join(onnxDist, fileName);
          if (wasmFiles.includes(fileName) && fs.existsSync(filePath)) {
            if (fileName.endsWith('.wasm')) {
              res.setHeader('Content-Type', 'application/wasm');
            } else if (fileName.endsWith('.mjs') || fileName.endsWith('.js')) {
              res.setHeader('Content-Type', 'application/javascript');
            }
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }
        next();
      });
    },
    buildStart() {
      const publicOnnx = path.resolve(__dirname, 'public/onnx');
      if (!fs.existsSync(publicOnnx)) {
        fs.mkdirSync(publicOnnx, { recursive: true });
      }
      for (const file of wasmFiles) {
        const src = path.join(onnxDist, file);
        const dest = path.join(publicOnnx, file);
        if (fs.existsSync(src) && !fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
        }
      }
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    onnxWasmPlugin(),
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
        // woff2 only: every supported browser takes it, and the legacy .woff copies doubled the precache.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@fontsource') || id.includes('?datauri')) {
            return 'embedded-fonts';
          }
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/zustand') ||
            id.includes('node_modules/dexie') ||
            id.includes('node_modules/zod')
          ) {
            return 'core-vendor';
          }
        }
      }
    }
  },
  // The exporter is loaded on demand; pre-bundle its dependency at startup so the dev server does
  // not re-optimize mid-session and break the import with "504 Outdated Optimize Dep".
  optimizeDeps: {
    include: ['mediabunny']
  },
  server: {
    port: 3000,
    open: false
  }
});
