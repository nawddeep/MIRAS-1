import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  // Quick-tunnel testing on a phone (cloudflared): allow the tunnel hostnames.
  preview: { allowedHosts: ['.trycloudflare.com'] },
  server: { allowedHosts: ['.trycloudflare.com'] },
  define: {
    // Shown on the capture screen so testers can confirm which version is running.
    __BUILD_ID__: JSON.stringify(new Date().toISOString().slice(5, 16).replace('T', ' '))
  },
  build: {
    outDir: 'dist',
    target: 'es2022'
  },
  worker: {
    format: 'es'
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        globIgnores: ['**/MIRAS_VR_Test_Panorama.png'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html'
      },
      manifest: {
        id: './',
        name: 'MIRAS Capture — 360° Heritage Camera',
        short_name: 'MIRAS Capture',
        description:
          'Guided 360° spherical photography, on-device stitching, hotspot authoring, and MIRAS viewer package export.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0e0e0e',
        theme_color: '#0e0e0e',
        categories: ['photo', 'productivity', 'utilities'],
        icons: [
          {
            src: './icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: './icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: './icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: './icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ],
        shortcuts: [
          {
            name: 'New 360° Capture',
            short_name: 'New Capture',
            description: 'Start a guided 360° spherical capture session',
            url: './?action=capture',
            icons: [
              {
                src: './icon-192.png',
                sizes: '192x192',
                type: 'image/png'
              }
            ]
          }
        ]
      }
    })
  ]
});
