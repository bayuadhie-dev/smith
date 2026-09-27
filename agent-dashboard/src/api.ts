// Base URL backend agent (Flask, agent/main.py) - default port 4500 sesuai
// config.AGENT_WEBHOOK_PORT. Override lewat VITE_AGENT_API_URL kalau agent
// backend jalan di host/port berbeda.
const BASE_URL = import.meta.env.VITE_AGENT_API_URL || 'http://localhost:4500'

export interface ErrorRow {
  id: string
  signature: string
  source_app: string
  log_file: string
  detected_at: string
  last_seen_at: string
  occurrence_count: number
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW'
  risk_reason: string
  raw_context: string
  diagnosis_cause: string | null
  diagnosis_file: string | null
  diagnosis_fix: string | null
  diagnosis_confidence: string | null
  status: 'waiting' | 'approved' | 'declined'
  wa_message_id: string | null
  decline_reason: string | null
  resolved_at: string | null
}

export interface ConfigData {
  anthropic_api_key_masked: string
  anthropic_api_key_set: boolean
  openwa_base_url: string
  openwa_api_key_masked: string
  openwa_api_key_set: boolean
  openwa_target_phone: string
  openwa_session_id_override: string
}

export interface Stats {
  total: number
  by_status: { waiting: number; approved: number; declined: number }
  by_risk: { HIGH: number; MEDIUM: number; LOW: number }
  total_occurrences: number
}

export interface Pm2Process {
  name: string
  pm_id: number
  status: string
  out_log: string | null
  err_log: string | null
  pid: number | null
  uptime_ms: number | null
  restart_time: number | null
  cwd: string | null
  monitored: boolean
}

// Token login disimpan di localStorage (bukan cookie - lihat catatan CORS
// di agent/main.py untuk kenapa itu aman walau CORS server-side longgar) dan
// dilampirkan manual ke tiap request sebagai `Authorization: Bearer <token>`.
const TOKEN_KEY = 'agent_auth_token'
export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

// Dipanggil dari App.tsx saat sebuah request kena 401 - artinya token hilang/
// kedaluwarsa, jadi bersihkan token yang tersimpan dan tampilkan layar login
// lagi. Diisi App.tsx saat mount supaya request.ts tidak perlu impor React.
let onUnauthorized: (() => void) | null = null
export const setOnUnauthorized = (fn: () => void) => { onUnauthorized = fn }

class UnauthorizedError extends Error {}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  })
  if (res.status === 401) {
    clearToken()
    onUnauthorized?.()
    throw new UnauthorizedError('Sesi berakhir, silakan login ulang')
  }
  if (!res.ok) throw new Error(`Request gagal (${res.status}): ${path}`)
  return res.json()
}

export const api = {
  login: async (password: string) => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (!res.ok) throw new Error('Password salah')
    const data: { token: string } = await res.json()
    setToken(data.token)
    return data.token
  },
  logout: async () => {
    try { await request('/api/auth/logout', { method: 'POST' }) } catch { /* token mungkin sudah invalid, tetap lanjut bersihkan lokal */ }
    clearToken()
  },
  listErrors: (status?: string, riskLevel?: string) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (riskLevel) params.set('risk_level', riskLevel)
    const qs = params.toString()
    return request<{ errors: ErrorRow[] }>(`/api/errors${qs ? `?${qs}` : ''}`)
  },
  getError: (id: string) => request<{ error: ErrorRow }>(`/api/errors/${id}`),
  getConfig: () => request<ConfigData>('/api/config'),
  saveConfig: (data: { anthropic_api_key?: string; openwa_base_url?: string; openwa_api_key?: string; openwa_target_phone?: string; openwa_session_id_override?: string }) =>
    request<{ status: string }>('/api/config', { method: 'POST', body: JSON.stringify(data) }),
  getStats: () => request<Stats>('/api/stats'),
  getPm2Processes: () => request<{ processes: Pm2Process[] }>('/api/pm2/processes'),
  savePm2Processes: (appNames: string[]) =>
    request<{ status: string }>('/api/pm2/processes', { method: 'POST', body: JSON.stringify({ app_names: appNames }) }),
}
