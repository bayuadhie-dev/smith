import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Skip type checking during build (use tsc separately for type checking)
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress "use client" warnings from libraries
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
        warn(warning)
      }
    }
  },
  esbuild: {
    // Ignore TypeScript errors during build
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  },
  server: {
    port: Number(process.env.PORT) || 3000,
    host: '0.0.0.0',  // Allow LAN access
    allowedHosts: true,  // Allow all hosts for dev server
    cors: true,  // Enable CORS for dev server
    origin: process.env.VITE_ORIGIN || 'http://erp.graterp.my.id:3000',  // Set proper origin
    // Default (hmr: true) makes the browser dial ws://<hostname>:3000 directly,
    // which only works when port 3000 itself is publicly reachable. Behind a
    // reverse proxy that only exposes 80/443 (e.g. fsnindonesia.com's Nginx),
    // the client must instead connect through the public host/port so the
    // proxy can upgrade it back to the local dev server. VITE_HMR_HOST is
    // opt-in per environment (set only where needed) so this stays a no-op
    // (hmr: true) for every setup that doesn't define it.
    hmr: process.env.VITE_HMR_HOST
      ? {
          protocol: process.env.VITE_HMR_PROTOCOL || 'wss',
          host: process.env.VITE_HMR_HOST,
          clientPort: Number(process.env.VITE_HMR_CLIENT_PORT) || 443,
        }
      : true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
