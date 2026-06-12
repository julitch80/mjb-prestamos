import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/mjb-prestamos/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      base: '/mjb-prestamos/',
      scope: '/mjb-prestamos/',
      manifest: {
        name: 'MJB Préstamos',
        short_name: 'MJB',
        description: 'Sistema de préstamo de recursos — I.E. Manuel J. Betancur',
        theme_color: '#030712',
        background_color: '#030712',
        display: 'standalone',
        start_url: '/mjb-prestamos/',
        scope: '/mjb-prestamos/',
        lang: 'es',
        icons: [
          {
            src: '/mjb-prestamos/mjb_escudo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/mjb-prestamos/mjb_escudo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        runtimeCaching: [
          {
            // Caché de la app (network-first, fallback a caché)
            urlPattern: /^https:\/\/julitch80\.github\.io\/mjb-prestamos\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'mjb-app-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Caché del Apps Script (network-first, fallback silencioso)
            urlPattern: /^https:\/\/script\.google\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'mjb-api-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 5 },
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
  },
})
