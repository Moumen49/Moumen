import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'نظام إدارة بيانات العائلات',
        short_name: 'نظام العائلات',
        description: 'تطبيق لإدارة بيانات العائلات والمساعدات - يعمل دون اتصال',
        theme_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        background_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // Cache all typical assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Ensure navigation fallback to index.html for SPA routing
        navigateFallback: '/index.html',
        // Don't cache API calls to Supabase by default in this generic rule, 
        // they are online-only anyway (except what we manually handle in OfflineEntry)
      },
      devOptions: {
        enabled: true
      }
    })
  ],
})
