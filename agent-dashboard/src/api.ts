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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`Request gagal (${res.status}): ${path}`)
  return res.json()
}

export const api = {
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
}
