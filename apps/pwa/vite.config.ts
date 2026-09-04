import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'maskable-icon-512x512.png'],
      manifest: {
        name: 'WastePL – Harmonogram Wywozu Odpadów',
        short_name: 'WastePL',
        description: 'Harmonogram odbioru odpadów komunalnych i baza punktów PSZOK',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        importScripts: ['/custom-sw.js'],
        runtimeCaching: [
          {
            urlPattern: /^\/v1\/(?:addresses|collection|facilities)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'wastepl-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 86400, // 24 hours offline cache
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  // @ts-ignore
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
});
