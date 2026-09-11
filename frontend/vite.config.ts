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
    hmr: true,  // Enable HMR
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
