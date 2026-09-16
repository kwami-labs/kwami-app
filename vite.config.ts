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
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['sphere.svg'],
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 }
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
  }
})
