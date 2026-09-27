import { useEffect, useState } from 'react'
import {
  Activity, AlertTriangle, AlertOctagon, Info, CheckCircle2, XCircle,
  Clock, Settings2, ListTree, RefreshCw, Server, FileWarning,
  Repeat, ShieldAlert, Terminal, FolderGit2, LogOut, Lock, Loader2,
} from 'lucide-react'
import { api, getToken, setOnUnauthorized, ErrorRow, ConfigData, Stats, Pm2Process } from './api'
import './App.css'

// detected_at datang dari backend sebagai ISO lengkap dengan milidetik+offset
// WIB (mis. "2026-09-27T19:05:03.269220+07:00") - terlalu panjang untuk
// kolom tabel, dipersingkat ke "27 Sep 19:05" di sini. Detail penuh tetap
// ditampilkan apa adanya di panel detail (dd elemen).
function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

const RISK_META: Record<string, { icon: typeof AlertOctagon; className: string; label: string }> = {
  HIGH: { icon: AlertOctagon, className: 'risk-high', label: 'HIGH' },
  MEDIUM: { icon: AlertTriangle, className: 'risk-medium', label: 'MEDIUM' },
  LOW: { icon: Info, className: 'risk-low', label: 'LOW' },
}
const STATUS_META: Record<string, { icon: typeof Clock; className: string; label: string }> = {
  waiting: { icon: Clock, className: 'status-waiting', label: 'Menunggu' },
  approved: { icon: CheckCircle2, className: 'status-approved', label: 'Approved' },
  declined: { icon: XCircle, className: 'status-declined', label: 'Di-skip' },
}

function StatCards({ stats }: { stats: Stats | null }) {
  if (!stats) return null
  const cards = [
    { label: 'Total Error', value: stats.total, icon: Activity, tone: 'tone-neutral' },
    { label: 'Menunggu Approval', value: stats.by_status.waiting, icon: Clock, tone: 'tone-waiting' },
    { label: 'Risk HIGH', value: stats.by_risk.HIGH, icon: AlertOctagon, tone: 'tone-high' },
    { label: 'Total Kemunculan', value: stats.total_occurrences, icon: Repeat, tone: 'tone-neutral' },
  ]
  return (
    <div className="stat-cards">
      {cards.map((c) => (
        <div key={c.label} className={`stat-card ${c.tone}`}>
          <c.icon className="stat-icon" size={20} />
          <div>
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ErrorHistoryTab() {
  const [errors, setErrors] = useState<ErrorRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [selected, setSelected] = useState<ErrorRow | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    Promise.all([
      api.listErrors(statusFilter || undefined, riskFilter || undefined),
      api.getStats(),
    ])
      .then(([errRes, statsRes]) => {
        setErrors(errRes.errors)
        setStats(statsRes)
      })
      .catch(() => setErrors([]))
      .finally(() => setLoading(false))
  }

  useEffect(load, [statusFilter, riskFilter])

  return (
    <div className="layout">
      <div className="list-panel">
        <StatCards stats={stats} />

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
          <button className="btn-ghost" onClick={load}><RefreshCw size={14} /> Refresh</button>
        </div>

        {loading ? (
          <p className="muted">Memuat...</p>
        ) : errors.length === 0 ? (
          <div className="empty-state">
            <FileWarning size={28} className="muted" />
            <p className="muted">Belum ada error terdeteksi.</p>
          </div>
        ) : (
          <div className="table-scroll">
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
              {errors.map((e) => {
                const risk = RISK_META[e.risk_level]
                const status = STATUS_META[e.status]
                return (
                  <tr key={e.id} className={selected?.id === e.id ? 'row-selected' : ''} onClick={() => setSelected(e)}>
                    <td className="mono nowrap">{e.id}</td>
                    <td><span className={`pill ${risk.className}`}><risk.icon size={12} /> {risk.label}</span></td>
                    <td>{e.source_app}</td>
                    <td className="muted nowrap">{formatShortDate(e.detected_at)}</td>
                    <td className="nowrap">
                      <span className={`pill ${status.className}`}><status.icon size={12} /> {status.label}</span>
                      {e.occurrence_count > 1 && <span className="muted occ-badge"><Repeat size={11} /> {e.occurrence_count}x</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div className="detail-panel">
        {!selected ? (
          <div className="empty-state">
            <ListTree size={28} className="muted" />
            <p className="muted">Klik salah satu error di daftar untuk lihat detail.</p>
          </div>
        ) : (
          <div>
            <div className="detail-header">
              <h2 className="mono">{selected.id}</h2>
              <span className={`pill ${RISK_META[selected.risk_level].className}`}>
                {(() => { const Icon = RISK_META[selected.risk_level].icon; return <Icon size={13} /> })()} {selected.risk_level}
              </span>
            </div>
            <p className="risk-reason">{selected.risk_reason}</p>

            <dl>
              <dt>App</dt><dd>{selected.source_app}</dd>
              <dt>Log file</dt><dd className="mono small">{selected.log_file}</dd>
              <dt>Terdeteksi</dt><dd>{selected.detected_at} WIB</dd>
              <dt>Terakhir muncul</dt><dd>{selected.last_seen_at} WIB &middot; {selected.occurrence_count}x</dd>
              <dt>Status</dt><dd><span className={`pill ${STATUS_META[selected.status].className}`}>{STATUS_META[selected.status].label}</span></dd>
              {selected.decline_reason && <><dt>Alasan skip</dt><dd>{selected.decline_reason}</dd></>}
            </dl>

            <h3><ShieldAlert size={16} /> Diagnosis (Claude API)</h3>
            {selected.diagnosis_cause ? (
              <dl>
                <dt>Penyebab</dt><dd>{selected.diagnosis_cause}</dd>
                <dt>File terduga</dt><dd className="mono small">{selected.diagnosis_file || '-'}</dd>
                <dt>Usulan fix</dt><dd className="pre">{selected.diagnosis_fix}</dd>
                <dt>Confidence</dt><dd className={`confidence-${selected.diagnosis_confidence}`}>{selected.diagnosis_confidence}</dd>
              </dl>
            ) : (
              <p className="muted">Belum ada hasil diagnosis (mungkin API key belum diset saat error ini terdeteksi).</p>
            )}

            <h3><Terminal size={16} /> Log mentah + konteks</h3>
            <pre className="log-context">{selected.raw_context}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

function Pm2SourcesTab() {
  const [processes, setProcesses] = useState<Pm2Process[]>([])
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = () => {
    setLoading(true)
    api.getPm2Processes()
      .then((res) => {
        setProcesses(res.processes)
        setSelectedNames(new Set(res.processes.filter((p) => p.monitored).map((p) => p.name)))
      })
      .catch(() => setProcesses([]))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const toggle = (name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      await api.savePm2Processes(Array.from(selectedNames))
      setMessage('Tersimpan. Watcher mengambil perubahan ini otomatis dalam beberapa siklus polling berikutnya, tidak perlu restart agent.')
    } catch {
      setMessage('Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  const statusClass = (status: string) => {
    if (status === 'online') return 'pm2-online'
    if (status === 'stopped') return 'pm2-stopped'
    if (status === 'errored') return 'pm2-errored'
    return 'pm2-other'
  }

  return (
    <div className="pm2-panel">
      <div className="pm2-panel-header">
        <div>
          <h2><Server size={18} /> Sumber Log (PM2)</h2>
          <p className="muted">
            Discovery live dari <code>pm2 jlist</code> - centang app mana saja yang mau dipantau. Tidak perlu
            diketik manual, dan tidak dibatasi ke 2 app (backend/frontend) saja.
          </p>
        </div>
        <button className="btn-ghost" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>

      {loading ? (
        <p className="muted">Memuat daftar proses PM2...</p>
      ) : processes.length === 0 ? (
        <div className="empty-state">
          <Server size={28} className="muted" />
          <p className="muted">
            Tidak ada proses PM2 ditemukan. Pastikan <code>pm2</code> ada di PATH dan daemon-nya jalan di mesin
            yang sama dengan agent ini.
          </p>
        </div>
      ) : (
        <div className="pm2-list">
          {processes.map((p) => (
            <label key={p.name} className="pm2-row">
              <input type="checkbox" checked={selectedNames.has(p.name)} onChange={() => toggle(p.name)} />
              <div className="pm2-row-main">
                <div className="pm2-row-title">
                  <span className="mono">{p.name}</span>
                  <span className={`pill ${statusClass(p.status)}`}>{p.status}</span>
                </div>
                <div className="pm2-row-meta muted">
                  <span><FolderGit2 size={12} /> {p.cwd || '-'}</span>
                  {p.pid && <span>pid {p.pid}</span>}
                  {p.restart_time != null && <span>{p.restart_time}x restart</span>}
                </div>
                <div className="pm2-row-logs muted small mono">
                  <div>err: {p.err_log || '-'}</div>
                  <div>out: {p.out_log || '-'}</div>
                </div>
              </div>
            </label>
          ))}
        </div>
      )}

      <button className="btn-primary" onClick={handleSave} disabled={saving || loading}>
        {saving ? 'Menyimpan...' : `Simpan Pilihan (${selectedNames.size})`}
      </button>
      {message && <p className="muted">{message}</p>}
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
      <h2><Settings2 size={18} /> Konfigurasi</h2>
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

      <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
      {message && <p className="muted">{message}</p>}

      <p className="muted todo-note">
        TODO: dashboard ini belum ada autentikasi - aman selama hanya diakses di jaringan
        internal/lokal. Tambahkan proteksi login sebelum diakses dari luar jaringan kantor.
      </p>
    </div>
  )
}

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.login(password)
      onSuccess()
    } catch {
      setError('Password salah.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand login-brand">
          <Activity size={22} />
          <h1>Ops Agent Monitor</h1>
        </div>
        <p className="muted">Masuk untuk melihat histori error dan mengatur agent.</p>
        <label><Lock size={13} /> Password</label>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password dashboard"
        />
        {error && <p className="login-error">{error}</p>}
        <button className="btn-primary" type="submit" disabled={loading || !password}>
          {loading ? <Loader2 size={15} className="spin" /> : null} Masuk
        </button>
      </form>
    </div>
  )
}

function App() {
  const [tab, setTab] = useState<'history' | 'pm2' | 'config'>('history')
  const [authed, setAuthed] = useState(!!getToken())

  useEffect(() => {
    // Dipanggil api.ts saat request manapun kena 401 (token hilang/kedaluwarsa
    // di server) - lempar balik ke layar login daripada membiarkan tab yang
    // sedang dibuka diam-diam gagal fetch terus-menerus.
    setOnUnauthorized(() => setAuthed(false))
  }, [])

  const handleLogout = async () => {
    await api.logout()
    setAuthed(false)
  }

  if (!authed) {
    return <LoginScreen onSuccess={() => setAuthed(true)} />
  }

  return (
    <div className="app">
      <header>
        <div className="brand">
          <Activity size={20} />
          <h1>Ops Agent Monitor</h1>
        </div>
        <nav>
          <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
            <ListTree size={15} /> Histori Error
          </button>
          <button className={tab === 'pm2' ? 'active' : ''} onClick={() => setTab('pm2')}>
            <Server size={15} /> Sumber Log
          </button>
          <button className={tab === 'config' ? 'active' : ''} onClick={() => setTab('config')}>
            <Settings2 size={15} /> Konfigurasi
          </button>
        </nav>
        <button className="btn-ghost logout-btn" onClick={handleLogout}>
          <LogOut size={14} /> Keluar
        </button>
      </header>
      <main>
        {tab === 'history' && <ErrorHistoryTab />}
        {tab === 'pm2' && <Pm2SourcesTab />}
        {tab === 'config' && <ConfigTab />}
      </main>
    </div>
  )
}

export default App
