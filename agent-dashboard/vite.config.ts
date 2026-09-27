import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dashboard kecil terpisah dari frontend SMITH ERP utama (folder sendiri,
// port sendiri) - hanya untuk memantau agent monitoring, bukan bagian dari
// aplikasi produksi. Base URL backend agent (Flask, main.py) di-set lewat
// VITE_AGENT_API_URL, default localhost:4500 - lihat src/api.ts.
export default defineConfig({
  plugins: [react()],
  server: { port: 4501 },
})
