import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: parseInt(process.env.VITE_PORT, 10) || 5175,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:5005',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:5005',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        importScripts: ['/sw-push.js'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: null,
        maximumFileSizeToCacheInBytes: 5000000,
        // Never precache versioned HTML/JS/CSS bundles so active tabs or reloads never hit deleted hashes
        globPatterns: ['favicon.{ico,svg}', 'logo-mark.png', 'icons.svg', 'manifest.webmanifest'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 31536000 } }
          }
        ]
      },
      manifest: {
        name: 'JahzJournal',
        short_name: 'JahzJournal',
        description: 'A soulful, celestial digital sanctuary for journaling, trading, and analytics.',
        theme_color: '#030712',
        background_color: '#030712',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/logo-mark.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/logo-mark.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }
        ]
      }
    })
  ],
})
