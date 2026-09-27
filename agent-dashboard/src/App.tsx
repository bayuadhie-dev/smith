import { useEffect, useState } from 'react'
import { api, ErrorRow, ConfigData } from './api'
import './App.css'

const RISK_EMOJI: Record<string, string> = { HIGH: '🔴', MEDIUM: '🟡', LOW: '🟢' }
const STATUS_LABEL: Record<string, string> = { waiting: 'Menunggu', approved: 'Approved', declined: 'Di-skip' }

function ErrorHistoryTab() {
  const [errors, setErrors] = useState<ErrorRow[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [selected, setSelected] = useState<ErrorRow | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api.listErrors(statusFilter || undefined, riskFilter || undefined)
      .then((res) => setErrors(res.errors))
      .catch(() => setErrors([]))
      .finally(() => setLoading(false))
  }

  useEffect(load, [statusFilter, riskFilter])

  return (
    <div className="layout">
      <div className="list-panel">
        <div className="filters">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Semua Status</option>
            <option value="waiting">Menunggu</option>
            <option value="approved">Approved</option>
            <option value="declined">Di-skip</option>
          </select>
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
            <option value="">Semua Risk Level</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
          <button onClick={load}>Refresh</button>
        </div>

        {loading ? (
          <p className="muted">Memuat...</p>
        ) : errors.length === 0 ? (
          <p className="muted">Belum ada error terdeteksi.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Risk</th>
                <th>App</th>
                <th>Terdeteksi</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((e) => (
                <tr key={e.id} className={selected?.id === e.id ? 'row-selected' : ''} onClick={() => setSelected(e)}>
                  <td>{e.id}</td>
                  <td>{RISK_EMOJI[e.risk_level]} {e.risk_level}</td>
                  <td>{e.source_app}</td>
                  <td>{e.detected_at}</td>
                  <td>
                    <span className={`badge badge-${e.status}`}>{STATUS_LABEL[e.status] || e.status}</span>
                    {e.occurrence_count > 1 && <span className="muted"> ({e.occurrence_count}x)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="detail-panel">
        {!selected ? (
          <p className="muted">Klik salah satu error di daftar untuk lihat detail.</p>
        ) : (
          <div>
            <h2>{selected.id}</h2>
            <p>
              {RISK_EMOJI[selected.risk_level]} <strong>{selected.risk_level}</strong> — {selected.risk_reason}
            </p>
            <dl>
              <dt>App</dt><dd>{selected.source_app}</dd>
              <dt>Log file</dt><dd className="mono">{selected.log_file}</dd>
              <dt>Terdeteksi</dt><dd>{selected.detected_at} WIB</dd>
              <dt>Terakhir muncul</dt><dd>{selected.last_seen_at} WIB ({selected.occurrence_count}x)</dd>
              <dt>Status</dt><dd>{STATUS_LABEL[selected.status] || selected.status}</dd>
              {selected.decline_reason && <><dt>Alasan skip</dt><dd>{selected.decline_reason}</dd></>}
            </dl>

            <h3>Diagnosis (Claude API)</h3>
            {selected.diagnosis_cause ? (
              <dl>
                <dt>Penyebab</dt><dd>{selected.diagnosis_cause}</dd>
                <dt>File terduga</dt><dd className="mono">{selected.diagnosis_file || '-'}</dd>
                <dt>Usulan fix</dt><dd className="pre">{selected.diagnosis_fix}</dd>
                <dt>Confidence</dt><dd>{selected.diagnosis_confidence}</dd>
              </dl>
            ) : (
              <p className="muted">Belum ada hasil diagnosis (mungkin API key belum diset saat error ini terdeteksi).</p>
            )}

            <h3>Log mentah + konteks</h3>
            <pre className="log-context">{selected.raw_context}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

function ConfigTab() {
  const [config, setConfig] = useState<ConfigData | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [openwaBaseUrl, setOpenwaBaseUrl] = useState('')
  const [openwaApiKey, setOpenwaApiKey] = useState('')
  const [openwaTargetPhone, setOpenwaTargetPhone] = useState('')
  const [openwaSessionOverride, setOpenwaSessionOverride] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = () => {
    api.getConfig().then((c) => {
      setConfig(c)
      setOpenwaBaseUrl(c.openwa_base_url)
      setOpenwaTargetPhone(c.openwa_target_phone)
      setOpenwaSessionOverride(c.openwa_session_id_override)
    })
  }

  useEffect(load, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      await api.saveConfig({
        anthropic_api_key: apiKey || undefined,
        openwa_base_url: openwaBaseUrl,
        openwa_api_key: openwaApiKey || undefined,
        openwa_target_phone: openwaTargetPhone,
        openwa_session_id_override: openwaSessionOverride,
      })
      setApiKey('')
      setOpenwaApiKey('')
      setMessage('Tersimpan. Agent otomatis coba deteksi sesi OpenWA + daftarkan webhook lagi sekarang (cek agent_activity.log kalau notifikasi belum jalan).')
      load()
    } catch {
      setMessage('Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="config-panel">
      <p className="muted">
        Disimpan di database agent (SQLite), bukan di browser - histori error yang sudah ada TIDAK
        terpengaruh kalau key ini diganti kapan pun.
      </p>

      <label>
        ANTHROPIC_API_KEY {config?.anthropic_api_key_set && <span className="muted">(sekarang: {config.anthropic_api_key_masked})</span>}
      </label>
      <input
        type="password"
        placeholder="sk-ant-..."
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />

      <label>OpenWA Base URL</label>
      <input
        value={openwaBaseUrl}
        onChange={(e) => setOpenwaBaseUrl(e.target.value)}
        placeholder="http://localhost:8000"
      />
      <p className="muted">
        Tanpa /sessions/... - session ID di-auto-detect (pilih sesi yang READY). Isi "Session ID
        Override" di bawah kalau ada lebih dari satu sesi READY sekaligus.
      </p>

      <label>
        OpenWA API Key (X-API-Key) {config?.openwa_api_key_set && <span className="muted">(sekarang: {config.openwa_api_key_masked})</span>}
      </label>
      <input
        type="password"
        placeholder="token X-API-Key"
        value={openwaApiKey}
        onChange={(e) => setOpenwaApiKey(e.target.value)}
      />

      <label>Nomor WA Tujuan Notifikasi (digit saja, boleh diawali 0 atau 62)</label>
      <input value={openwaTargetPhone} onChange={(e) => setOpenwaTargetPhone(e.target.value)} placeholder="0812xxxxxxx" />

      <label>Session ID Override (opsional - isi hanya kalau ada &gt;1 sesi READY)</label>
      <input value={openwaSessionOverride} onChange={(e) => setOpenwaSessionOverride(e.target.value)} placeholder="kosongkan untuk auto-detect" />

      <button onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
      {message && <p className="muted">{message}</p>}

      <p className="muted" style={{ marginTop: '2rem' }}>
        TODO: dashboard ini belum ada autentikasi - aman selama hanya diakses di jaringan
        internal/lokal. Tambahkan proteksi login sebelum diakses dari luar jaringan kantor.
      </p>
    </div>
  )
}

function App() {
  const [tab, setTab] = useState<'history' | 'config'>('history')

  return (
    <div className="app">
      <header>
        <h1>SMITH Agent Monitor</h1>
        <nav>
          <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Histori Error</button>
          <button className={tab === 'config' ? 'active' : ''} onClick={() => setTab('config')}>Konfigurasi</button>
        </nav>
      </header>
      <main>{tab === 'history' ? <ErrorHistoryTab /> : <ConfigTab />}</main>
    </div>
  )
}

export default App
