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
        // Los genera scripts/generar-iconos.py a partir de UNA imagen fuente.
        // Antes esto declaraba 192x192 y 512x512 apuntando las dos al MISMO
        // archivo, que en realidad mide 699x796 y ni siquiera es cuadrado.
        // Mentir en `sizes` hace que el navegador elija mal.
        //
        // Y sobre todo: el de 512 estaba marcado `maskable` sin serlo. Android
        // recorta los maskable a la forma del lanzador dando por hecho que lo
        // importante cabe en el 80% central; un dibujo a sangre sale aplastado
        // y con los bordes cortados. Eso era lo que Julian veia en su telefono.
        // Ahora son archivos DISTINTOS: los `any` van a sangre, los `maskable`
        // con su zona segura.
        icons: [
          { src: '/mjb-prestamos/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/mjb-prestamos/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/mjb-prestamos/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/mjb-prestamos/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Las fotos de la brigada (kit de inmovilización) se consultan justo
        // en una emergencia: si no están en el precache, un celular sin señal
        // muestra un ícono roto en el peor momento posible. Por eso se
        // precachean imágenes, PERO SOLO las de esa carpeta.
        //
        // El patrón va acotado a fotos-brigada/ a propósito. Incluir imágenes
        // con un glob general metía al precache mjb_hd.png (1,9 MB) y el
        // escudo (843 KB), que no sirven de nada en una emergencia y casi
        // duplicaban lo que cada usuario descarga al instalar o actualizar.
        globPatterns: [
          '**/*.{js,css,html,ico,svg,woff2}',
          'fotos-brigada/**/*.{jpg,jpeg,png,webp}',
        ],
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
