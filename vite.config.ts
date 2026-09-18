import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // Treat iconify-icon as a custom element (Web Component)
          isCustomElement: (tag) => tag === 'iconify-icon'
        }
      }
    }),
    {
      // Strip console/debugger from production bundles only.
      //
      // `apply: 'build'` rather than a top-level esbuild.drop: vitest merges
      // this config, and a global drop would strip console from the test run
      // and break any test asserting on a warning. It must also not fire in
      // `vite dev`, where console is the debugging channel.
      name: 'kwami:drop-console-in-build',
      apply: 'build',
      config() {
        return { esbuild: { drop: ['console', 'debugger'] as const } }
      }
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'sphere.svg',
        'welcome.mp3',
        'pwa-192.png',
        'pwa-512.png',
        'pwa-512-maskable.png',
        'apple-touch-icon.png'
      ],
      manifest: {
        id: '/',
        name: 'Kwami App',
        short_name: 'Kwami',
        description: 'Kwami AI voice agent app',
        theme_color: '#050608',
        background_color: '#050608',
        display: 'standalone',
        orientation: 'any',
        lang: 'en',
        scope: '/',
        start_url: '/',
        categories: ['utilities', 'productivity'],
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
          { src: '/sphere.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,mp3}'],
        // The 55 tour tracks under `public/audio/tour` are ~380 MB together,
        // and precaching is install-time and all-or-nothing: including them
        // would make every visitor pull the whole crate down before the app
        // worked offline, and since vite-plugin-pwa 0.20.2 it simply fails the
        // build on the 2 MiB per-file ceiling. The crate is loaded lazily, one
        // record at a time, so it belongs in the runtime cache below instead.
        // Overriding this drops workbox's default, hence node_modules here.
        // `welcome.mp3` sits at the public root and stays precached.
        globIgnores: ['**/node_modules/**/*', '**/audio/tour/**'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 },
              // Cross-origin font responses are opaque (status 0); without
              // this they cache unpredictably.
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Tolerates a `?v=` cache-buster: anchored on .mp3 alone, a
            // query string would quietly fall through to the network.
            urlPattern: /\/audio\/tour\/[^?]+\.mp3(?:\?.*)?$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'kwami-soundtrack',
              // Around 10 MB a record: hold a few recent ones, not the crate.
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
              // An audio element asks for byte ranges, and a 206 is not
              // cacheable on its own; this serves the slice from the full
              // response workbox stored.
              rangeRequests: true
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    // The entry chunk was 2.63 MB, over workbox's 2 MiB precache ceiling, so
    // vite-plugin-pwa (>=0.20.2) failed the build outright. Splitting the
    // heavy vendors keeps every chunk precacheable and lets the app shell
    // load without waiting on Three.js or LiveKit.
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          kwami: ['kwami'],
          supabase: ['@supabase/supabase-js'],
          vendor: ['vue', 'pinia', 'vue-i18n', 'vue-toastification']
        }
      }
    }
  }
})
