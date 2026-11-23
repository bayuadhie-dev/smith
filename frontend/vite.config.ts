import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  // Paket berbarel besar TIDAK diurus lewat optimizeDeps.exclude. Dicoba dua
  // kali dan dua kali merugikan: mengecualikan paket ikon memecah barel
  // outline yang memang dipakai luas (138 request, 2,1 MB), dan
  // mengecualikan date-fns menyajikan ~99 berkas satuan di VPS yang masih
  // HTTP/1.1 - ukurannya nyaris tidak turun tapi request-nya meledak.
  // Caranya: impor langsung ke berkasnya di sisi src
  // ('lucide-react/dist/esm/icons/...', '@heroicons/react/24/solid/esm/...',
  // 'date-fns/<fungsi>'), sehingga Vite cuma memprabundel yang dipakai.
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Jejak error di produksi tidak terbaca tanpa ini - yang muncul cuma
    // index-XXXX.js:1:4821. Berkas .map hanya diambil peramban kalau devtools
    // dibuka, jadi tidak membebani pemakai.
    sourcemap: true,
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
    // VITE_NO_HMR=1 (dipasang di server UAT/produksi lewat env PM2) mematikan
    // HMR sepenuhnya. Alasannya: di server, soket HMR putus sendiri kalau
    // halaman didiamkan (idle timeout nginx/Cloudflare), lalu klien Vite
    // MEMUAT ULANG halaman begitu servernya terjangkau lagi - itu yang
    // dilaporkan pemakai sebagai "halaman refresh sendiri, balik ke awal"
    // (Finance, 2026-11-18). Setiap berkas yang tersinkron dari laptop juga
    // memicu muat ulang penuh untuk modul yang bukan komponen React.
    // Dimatikan = halaman hanya berganti kode saat pemakai menyegarkan sendiri.
    // Catatan Vite 8: soket dev server pindah ke server.ws, dan hmr:false SAJA
    // tidak mematikannya (dicek di node_modules: `if (serverConfig.hmr === false
    // || serverConfig.ws === false) return;`). Soket yang masih hidup itu yang
    // memicu muat ulang, jadi keduanya dimatikan bersama.
    ...(process.env.VITE_NO_HMR ? { ws: false as const } : {}),
    hmr: process.env.VITE_NO_HMR
      ? false
      : process.env.VITE_HMR_HOST
        ? {
            protocol: process.env.VITE_HMR_PROTOCOL || 'wss',
            host: process.env.VITE_HMR_HOST,
            clientPort: Number(process.env.VITE_HMR_CLIENT_PORT) || 443,
          }
        : true,
    // Opt-in (VITE_WARMUP=1, set only on the VPS): pre-transform the most used
    // modules at dev-server start so the first browser load is not a cold one.
    ...(process.env.VITE_WARMUP
      ? {
          warmup: {
            clientFiles: [
              './src/main.tsx',
              './src/App.tsx',
              './src/pages/Landing/Landing.tsx',
              './src/pages/Auth/Login.tsx',
              './src/pages/Dashboard/DashboardModules.tsx',
              './src/components/Layout/**/*.tsx',
              './src/components/ui/*.tsx',
            ],
          },
        }
      : {}),
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
