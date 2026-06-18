import path from 'path'
import { writeFileSync } from 'fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const BUILD_ID = Date.now().toString()

export default defineConfig({
  base: '/mjb-prestamos/',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
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
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // version.json: siempre desde la red, nunca cacheado (auto-limpiador)
            urlPattern: /\/version\.json/i,
            handler: 'NetworkOnly',
          },
          {
            // Caché de la app (network-first, fallback a caché)
            urlPattern: /^https:\/\/julitch80\.github\.io\/mjb-prestamos\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'mjb-app-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
    {
      name: 'emit-version-json',
      closeBundle() {
        writeFileSync(
          path.resolve(__dirname, 'dist/version.json'),
          JSON.stringify({ buildId: BUILD_ID })
        );
      },
    },
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
