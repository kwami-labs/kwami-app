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
      includeAssets: ['sphere.svg', 'welcome.mp3'],
      manifest: {
        name: 'Kwami App',
        short_name: 'Kwami',
        description: 'Kwami AI voice agent app',
        theme_color: '#050608',
        background_color: '#050608',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/sphere.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          { src: '/sphere.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: '/sphere.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,mp3}'],
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
