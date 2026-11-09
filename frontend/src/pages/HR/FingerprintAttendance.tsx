import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import { PageHeader, KpiStrip, Panel } from '../../components/ui/PageKit'
import SearchableSelect from '../../components/SearchableSelect'
import { showError, showSuccess, confirmDialog } from '../../components/ui'
import { usePermissions } from '../../contexts/PermissionContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

type DayStatus = 'hadir' | 'tidak_lengkap' | 'tidak_ada_cap' | 'libur' | 'belum' | 'izin'
interface EmpRef { id: number; name: string; employee_number: string }
interface Adjustment {
  id: number | null; type: string; label: string; letter_number: string | null; note: string | null
  corrected_in: string | null; corrected_out: string | null; source: 'manual' | 'sdm'
}
interface Day {
  date: string; weekday: string; device_user_id: string; device_name: string | null; employee: EmpRef | null
  schedule: string | null; sched_start: string | null; sched_end: string | null
  first: string | null; last: string | null; punches: number; times: string[]
  net_minutes: number | null; target_minutes: number; diff_minutes: number | null
  late_minutes: number; early_minutes: number; early_excused: boolean; excused: boolean
  adjustments: Adjustment[]; adjustment_label: string | null; status: DayStatus
}
interface Person {
  device_user_id: string; employee: EmpRef | null; device_name: string | null; schedule: string | null
  work_days: number; present: number; absent: number; incomplete: number; excused_days: number
  net_minutes: number; target_minutes: number; diff_minutes: number; short_excused_minutes: number
  late_count: number; late_minutes: number; early_count: number; early_minutes: number; early_unexcused_count: number
  last_log_at: string | null; id_inactive: boolean
}
interface Rules {
  dedupe_seconds: number; break_if_span_over_minutes: number; fallback_target_minutes: number
  fallback_break_minutes: number; tolerance_minutes: number; holiday_if_total_punches_below: number
}
interface Totals {
  people: number; present: number; absent: number; incomplete: number; excused_days: number
  late_count: number; late_minutes: number; early_unexcused_count: number
  over_minutes: number; short_minutes: number; short_excused_minutes: number
}
interface Data {
  rules: Rules; days: Day[]; people: Person[]; holidays: string[]; special_holidays: Record<string, string>
  totals: Totals; last_log_at: string | null; period: { date_from: string; date_to: string }
}
interface DayDetail {
  row: Day | null
  punches: { time: string; status: number | null; punch: number | null; counted: boolean }[]
  explain: string[]
}

const PAGE = 50
const th = 'px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400'
const inputCls = 'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white'
const btnCls = 'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hm = (m: number | null | undefined) => (m === null || m === undefined ? '-' : `${m < 0 ? '-' : ''}${Math.floor(Math.abs(m) / 60)}:${String(Math.abs(m) % 60).padStart(2, '0')}`)
const hmSigned = (m: number | null | undefined) => (m === null || m === undefined ? '-' : m > 0 ? `+${hm(m)}` : hm(m))
const fmtDate = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtDateLong = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const fmtDateTime = (s: string) => new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const diffCls = (m: number | null | undefined) =>
  m === null || m === undefined || m === 0
    ? 'text-gray-500 dark:text-gray-400'
    : m > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'

const STATUS: Record<DayStatus, [string, string]> = {
  hadir: ['Hadir', 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'],
  tidak_ada_cap: ['Tidak ada cap', 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'],
  tidak_lengkap: ['Cap tidak lengkap', 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'],
  izin: ['Izin sah', 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'],
  libur: ['Libur', 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'],
  belum: ['Belum', 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'],
}
const StatusBadge = ({ d }: { d: Day }) => (
  <span className="inline-flex flex-col items-start gap-0.5">
    <span className={`inline-flex whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${STATUS[d.status][1]}`}>{STATUS[d.status][0]}</span>
    {(d.status === 'izin' || d.status === 'libur') && d.adjustment_label && <span className="text-xs text-gray-500 dark:text-gray-400">{d.adjustment_label}</span>}
  </span>
)
const EarlyBadge = ({ d }: { d: Day }) => (
  d.early_minutes ? (
    <span className={`inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${d.early_excused ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
      {d.early_minutes} mnt · {d.early_excused ? 'izin' : 'tanpa surat'}
    </span>
  ) : <span className="text-gray-400">-</span>
)

const ADJ_TYPES: [string, string][] = [
  ['cuti', 'Cuti'], ['sakit', 'Sakit'], ['izin', 'Izin'], ['dinas', 'Dinas luar'], ['lupa_cap', 'Lupa cap'],
  ['izin_pulang_cepat', 'Izin pulang cepat'], ['izin_terlambat', 'Izin terlambat'],
]
const RANGE_TYPES = ['cuti', 'sakit', 'izin', 'dinas']

const presets = () => {
  const t = new Date()
  const first = new Date(t.getFullYear(), t.getMonth(), 1)
  const prevFirst = new Date(t.getFullYear(), t.getMonth() - 1, 1)
  const prevLast = new Date(t.getFullYear(), t.getMonth(), 0)
  const w = new Date(t); w.setDate(w.getDate() - 6)
  return [
    { label: 'Hari ini', from: iso(t), to: iso(t) },
    { label: '7 hari', from: iso(w), to: iso(t) },
    { label: 'Bulan ini', from: iso(first), to: iso(t) },
    { label: 'Bulan lalu', from: iso(prevFirst), to: iso(prevLast) },
  ]
}

const personName = (e: EmpRef | null, dn: string | null, id: string) => e?.name || dn || `ID ${id}`

/* ------------------------------------------------------------------ rincian hari */
const DayModal = ({ deviceId, date, canEdit, onClose, onChanged }: {
  deviceId: string; date: string; canEdit: boolean; onClose: () => void; onChanged: () => void
}) => {
  const [detail, setDetail] = useState<DayDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ adj_type: 'izin', letter_number: '', date_to: '', corrected_in: '', corrected_out: '', note: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    axiosInstance.get('/api/hr/fingerprint/attendance/day', { params: { date, device_user_id: deviceId } })
      .then((r) => setDetail(r.data))
      .catch((e) => showError(e.response?.data?.error || 'Rincian hari gagal dimuat.'))
      .finally(() => setLoading(false))
  }, [date, deviceId])
  useEffect(() => { load() }, [load])

  const row = detail?.row
  const save = async () => {
    if (form.adj_type === 'izin_pulang_cepat' && !form.letter_number.trim()) { showError('Izin pulang cepat wajib disertai nomor surat izin dari HRD.'); return }
    if (form.adj_type === 'lupa_cap' && !form.corrected_in && !form.corrected_out) { showError('Isi jam masuk atau jam pulang yang dikoreksi.'); return }
    setSaving(true)
    try {
      await axiosInstance.post('/api/hr/fingerprint/adjustments', {
        device_user_id: deviceId,
        employee_id: row?.employee?.id || undefined,
        date_from: date,
        date_to: RANGE_TYPES.includes(form.adj_type) && form.date_to ? form.date_to : date,
        adj_type: form.adj_type,
        letter_number: form.letter_number.trim() || undefined,
        corrected_in: form.adj_type === 'lupa_cap' && form.corrected_in ? form.corrected_in : undefined,
        corrected_out: form.adj_type === 'lupa_cap' && form.corrected_out ? form.corrected_out : undefined,
        note: form.note.trim() || undefined,
      })
      showSuccess('Keterangan disimpan.')
      setForm({ adj_type: 'izin', letter_number: '', date_to: '', corrected_in: '', corrected_out: '', note: '' })
      load(); onChanged()
    } catch (e: any) {
      showError(e.response?.data?.error || 'Keterangan gagal disimpan.')
    } finally { setSaving(false) }
  }
  const remove = async (a: Adjustment) => {
    if (!a.id) return
    if (!(await confirmDialog(`Hapus keterangan "${a.label}" untuk tanggal ini?`))) return
    try {
      await axiosInstance.delete(`/api/hr/fingerprint/adjustments/${a.id}`)
      showSuccess('Keterangan dihapus.')
      load(); onChanged()
    } catch (e: any) { showError(e.response?.data?.error || 'Gagal menghapus.') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="my-6 w-full max-w-2xl rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{row ? personName(row.employee, row.device_name, row.device_user_id) : `ID ${deviceId}`}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{fmtDateLong(date)}</p>
          </div>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400">Tutup</button>
        </div>
        <div className="space-y-5 p-5">
          {loading && <p className="text-sm text-gray-500">Memuat...</p>}
          {!loading && detail && (
            <>
              {row && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Jadwal: <span className="font-medium text-gray-900 dark:text-white">{row.schedule || 'belum ada'}{row.sched_start ? ` (${row.sched_start}-${row.sched_end})` : ''}</span></span>
                  <span className="text-gray-500 dark:text-gray-400">Target: <span className="font-medium text-gray-900 dark:text-white">{hm(row.target_minutes)}</span></span>
                  <span className="text-gray-500 dark:text-gray-400">Jam bersih: <span className="font-medium text-gray-900 dark:text-white">{hm(row.net_minutes)}</span></span>
                  <span className={`font-medium ${diffCls(row.diff_minutes)}`}>Selisih {hmSigned(row.diff_minutes)}</span>
                  <StatusBadge d={row} />
                </div>
              )}

              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Cap dari mesin</h3>
                {detail.punches.length === 0 ? <p className="text-sm text-gray-500">Tidak ada cap pada hari ini.</p> : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                      <tr><th className="px-3 py-2">Jam</th><th className="px-3 py-2">Perlakuan</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {detail.punches.map((p, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 tabular-nums">{p.time}</td>
                          <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300">{p.counted ? 'dihitung' : 'digabung (ketukan ganda)'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {detail.explain.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Cara menghitung</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
                    {detail.explain.map((x, i) => <li key={i}>{x}</li>)}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Keterangan</h3>
                {!row || row.adjustments.length === 0 ? <p className="text-sm text-gray-500">Belum ada keterangan untuk hari ini.</p> : (
                  <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
                    {row.adjustments.map((a, i) => (
                      <li key={i} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">{a.label}</span>
                          {a.letter_number && <span className="ml-2 text-gray-500">surat {a.letter_number}</span>}
                          {(a.corrected_in || a.corrected_out) && <span className="ml-2 text-gray-500">koreksi {a.corrected_in || '-'} / {a.corrected_out || '-'}</span>}
                          {a.note && <div className="text-xs text-gray-500 dark:text-gray-400">{a.note}</div>}
                        </div>
                        {a.source === 'sdm' ? <span className="whitespace-nowrap text-xs text-gray-500">dari modul SDM</span>
                          : canEdit && <button onClick={() => remove(a)} className="text-xs font-medium text-red-600 hover:underline dark:text-red-400">Hapus</button>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {canEdit && (
                <div className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Tambah keterangan</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400">Jenis
                      <select value={form.adj_type} onChange={(e) => setForm({ ...form, adj_type: e.target.value })} className={`${inputCls} mt-1 w-full`}>
                        {ADJ_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Nomor surat{form.adj_type === 'izin_pulang_cepat' ? ' (wajib)' : ' (jika ada)'}
                      <input value={form.letter_number} onChange={(e) => setForm({ ...form, letter_number: e.target.value })} className={`${inputCls} mt-1 w-full`} placeholder="mis. HRD/045/XI/2026" />
                    </label>
                    {RANGE_TYPES.includes(form.adj_type) && (
                      <label className="text-xs text-gray-500 dark:text-gray-400">Sampai tanggal (kosongkan bila hanya hari ini)
                        <input type="date" min={date} value={form.date_to} onChange={(e) => setForm({ ...form, date_to: e.target.value })} className={`${inputCls} mt-1 w-full`} />
                      </label>
                    )}
                    {form.adj_type === 'lupa_cap' && (
                      <>
                        <label className="text-xs text-gray-500 dark:text-gray-400">Jam masuk yang benar
                          <input type="time" value={form.corrected_in} onChange={(e) => setForm({ ...form, corrected_in: e.target.value })} className={`${inputCls} mt-1 w-full`} />
                        </label>
                        <label className="text-xs text-gray-500 dark:text-gray-400">Jam pulang yang benar
                          <input type="time" value={form.corrected_out} onChange={(e) => setForm({ ...form, corrected_out: e.target.value })} className={`${inputCls} mt-1 w-full`} />
                        </label>
                      </>
                    )}
                    <label className="text-xs text-gray-500 dark:text-gray-400 sm:col-span-2">Catatan
                      <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={`${inputCls} mt-1 w-full`} />
                    </label>
                  </div>
                  {form.adj_type === 'izin_pulang_cepat' && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Pulang cepat hanya sah dengan surat izin dari HRD.</p>}
                  <div className="mt-3 flex justify-end">
                    <button onClick={save} disabled={saving} className="rounded-md bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan keterangan'}</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ libur khusus */
const HolidayDialog = ({ defaultDate, onClose, onSaved }: { defaultDate: string; onClose: () => void; onSaved: () => void }) => {
  const [from, setFrom] = useState(defaultDate)
  const [to, setTo] = useState(defaultDate)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!note.trim()) { showError('Isi keterangan libur, mis. Cuti bersama.'); return }
    setSaving(true)
    try {
      await axiosInstance.post('/api/hr/fingerprint/adjustments', { adj_type: 'libur_khusus', date_from: from, date_to: to, note: note.trim() })
      showSuccess('Libur khusus disimpan.')
      onSaved(); onClose()
    } catch (e: any) { showError(e.response?.data?.error || 'Gagal menyimpan.') } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Libur khusus</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Berlaku untuk semua karyawan: tidak dihitung sebagai tidak masuk.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-gray-500 dark:text-gray-400">Dari
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value) }} className={`${inputCls} mt-1 w-full`} />
          </label>
          <label className="text-xs text-gray-500 dark:text-gray-400">Sampai
            <input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} mt-1 w-full`} />
          </label>
          <label className="text-xs text-gray-500 dark:text-gray-400 sm:col-span-2">Keterangan
            <input value={note} onChange={(e) => setNote(e.target.value)} className={`${inputCls} mt-1 w-full`} placeholder="mis. Cuti bersama" />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className={btnCls}>Batal</button>
          <button onClick={save} disabled={saving} className="rounded-md bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ kalender */
const LEGEND: [string, string][] = [
  ['bg-emerald-100 border-emerald-300', 'Hadir'], ['bg-emerald-300 border-emerald-500', 'Lembur'], ['bg-amber-100 border-amber-300', 'Terlambat / pulang cepat / cap tidak lengkap'],
  ['bg-red-100 border-red-300', 'Tidak ada cap'], ['bg-sky-100 border-sky-300', 'Izin sah'], ['bg-gray-100 border-gray-300', 'Libur'],
]
const cellStyle = (d: Day | undefined): string => {
  if (!d) return 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'
  switch (d.status) {
    case 'izin': return 'bg-sky-100 border-sky-300 dark:bg-sky-900/30 dark:border-sky-700'
    case 'tidak_ada_cap': return 'bg-red-100 border-red-300 dark:bg-red-900/30 dark:border-red-700'
    case 'tidak_lengkap': return 'bg-amber-100 border-amber-300 dark:bg-amber-900/30 dark:border-amber-700'
    case 'libur': case 'belum': return 'bg-gray-100 border-gray-300 dark:bg-gray-700/50 dark:border-gray-600'
    default:
      if (d.late_minutes || (d.early_minutes && !d.early_excused)) return 'bg-amber-100 border-amber-300 dark:bg-amber-900/30 dark:border-amber-700'
      if ((d.diff_minutes || 0) > 0) return 'bg-emerald-300 border-emerald-500 dark:bg-emerald-800/50 dark:border-emerald-600'
      return 'bg-emerald-100 border-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-700'
  }
}

const CalendarView = ({ options, tick, onOpenDay }: {
  options: { id: number; name: string }[]; tick: number; onOpenDay: (deviceId: string, date: string) => void
}) => {
  const [sel, setSel] = useState<number | null>(null)
  const [month, setMonth] = useState(() => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), 1) })
  const [cal, setCal] = useState<Data | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sel) { setCal(null); return }
    let alive = true
    setLoading(true)
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    const params: Record<string, string | number> = { date_from: iso(month), date_to: iso(last) }
    if (sel > 0) params.employee_id = sel; else params.include_unmapped = 1
    axiosInstance.get('/api/hr/fingerprint/attendance', { params })
      .then((r) => { if (alive) setCal(r.data) })
      .catch((e) => { if (alive) { setCal(null); showError(e.response?.data?.error || 'Kalender gagal dimuat.') } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [sel, month, tick])

  const devId = sel && sel < 0 ? String(-sel) : null
  const byDate = useMemo(() => {
    const m = new Map<string, Day>()
    ;(cal?.days || []).forEach((d) => { if (!devId || d.device_user_id === devId) m.set(d.date, d) })
    return m
  }, [cal, devId])
  const anyDay = (cal?.days || []).find((d) => !devId || d.device_user_id === devId)
  const deviceForClick = devId || anyDay?.device_user_id || ''

  const offset = (month.getDay() + 6) % 7
  const dim = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-72"><SearchableSelect options={options} value={sel} onChange={(v) => setSel(v ? Number(v) : null)} placeholder="Pilih karyawan" /></div>
        <button className={btnCls} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>Bulan sebelumnya</button>
        <span className="min-w-[8rem] text-center text-sm font-semibold text-gray-900 dark:text-white">{MONTHS[month.getMonth()]} {month.getFullYear()}</span>
        <button className={btnCls} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>Bulan berikutnya</button>
      </div>
      {!sel && <p className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800">Pilih satu karyawan untuk melihat kalender kehadirannya.</p>}
      {sel && (
        <div className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800 sm:p-3">
          {loading && <p className="p-2 text-xs text-gray-500">Memuat...</p>}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-gray-500 dark:text-gray-400 sm:text-xs">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((x) => <div key={x} className="py-1">{x}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((n, i) => {
              if (!n) return <div key={i} />
              const dstr = iso(new Date(month.getFullYear(), month.getMonth(), n))
              const d = byDate.get(dstr)
              const holiday = cal?.special_holidays?.[dstr]
              const clickable = !!deviceForClick
              return (
                <button key={i} disabled={!clickable} onClick={() => clickable && onOpenDay(deviceForClick, dstr)}
                  className={`min-h-[3.4rem] rounded border p-1 text-left align-top sm:min-h-[5rem] sm:p-1.5 ${cellStyle(d)} ${clickable ? 'hover:ring-2 hover:ring-emerald-500' : ''}`}>
                  <div className="text-xs font-semibold text-gray-800 dark:text-gray-100">{n}</div>
                  {d && d.first && <div className="mt-0.5 text-[10px] leading-tight text-gray-700 dark:text-gray-200 sm:text-[11px]">{d.first}{d.punches > 1 ? `-${d.last}` : ''}</div>}
                  {d?.status === 'izin' && <div className="mt-0.5 hidden text-[10px] text-sky-800 dark:text-sky-200 sm:block">{d.adjustment_label}</div>}
                  {d?.status === 'libur' && holiday && <div className="mt-0.5 hidden text-[10px] text-gray-600 dark:text-gray-300 sm:block">{holiday}</div>}
                  {d?.status === 'hadir' && d.late_minutes > 0 && <div className="mt-0.5 hidden text-[10px] text-amber-800 dark:text-amber-200 sm:block">telat {d.late_minutes} mnt</div>}
                  {d?.status === 'hadir' && d.early_minutes > 0 && <div className="hidden text-[10px] text-amber-800 dark:text-amber-200 sm:block">{d.early_excused ? 'pulang cepat (izin)' : 'pulang cepat'}</div>}
                  {d?.status === 'tidak_ada_cap' && <div className="mt-0.5 hidden text-[10px] text-red-800 dark:text-red-200 sm:block">tidak ada cap</div>}
                  {d?.status === 'tidak_lengkap' && <div className="mt-0.5 hidden text-[10px] text-amber-800 dark:text-amber-200 sm:block">cap tidak lengkap</div>}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 pt-2 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
            {LEGEND.map(([c, l]) => <span key={l} className="inline-flex items-center gap-1.5"><span className={`h-3 w-3 rounded-sm border ${c}`} />{l}</span>)}
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ halaman */
const FingerprintAttendance = () => {
  useDocumentTitle('Log Absensi')
  const { hasPermission, isSuperAdmin } = usePermissions()
  const canEdit = isSuperAdmin || hasPermission('hr.edit')
  const initial = presets()[1]
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [employeeId, setEmployeeId] = useState<number | null>(null)
  const [includeUnmapped, setIncludeUnmapped] = useState(true)
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'people' | 'days' | 'calendar'>('people')
  const [statusFilter, setStatusFilter] = useState('')
  const [showHoliday, setShowHoliday] = useState(false)
  const [page, setPage] = useState(1)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [empOptions, setEmpOptions] = useState<{ id: number; name: string }[]>([])
  const [calOptions, setCalOptions] = useState<{ id: number; name: string }[]>([])
  const [exporting, setExporting] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [tick, setTick] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [lastPunch, setLastPunch] = useState<string | null>(null)

  const loadSyncInfo = useCallback(() => {
    axiosInstance.get('/api/hr/fingerprint/refresh/status').then((r) => setLastPunch(r.data.last_punch || null)).catch(() => {})
  }, [])
  useEffect(() => { loadSyncInfo() }, [loadSyncInfo])

  // Tombol Perbarui data: minta server menarik data terbaru dari mesin, tunggu selesai, lalu muat ulang tampilan.
  const refreshFromDevice = async () => {
    if (syncing) return
    setSyncing(true); setSyncMsg('Meminta data terbaru dari mesin...')
    try {
      let st = (await axiosInstance.post('/api/hr/fingerprint/refresh')).data
      const started = Date.now()
      while ((st.status === 'pending' || st.status === 'running') && Date.now() - started < 6 * 60 * 1000) {
        setSyncMsg(st.status === 'pending' ? 'Menunggu server kantor...' : 'Menarik data dari mesin (sekitar 2 menit)...')
        await new Promise((res) => setTimeout(res, 3000))
        st = (await axiosInstance.get('/api/hr/fingerprint/refresh/status')).data
      }
      if (st.status === 'done') {
        showSuccess(st.new_logs != null ? `Data diperbarui: ${st.new_logs} log baru.` : (st.message || 'Data diperbarui.'))
      } else if (st.status === 'failed') {
        showError(st.message || 'Penarikan dari mesin gagal. Tampilan dimuat ulang dari data yang sudah ada.')
      } else {
        showError('Penarikan belum selesai. Tampilan dimuat ulang dari data yang sudah ada.')
      }
    } catch (e: any) {
      showError(e?.response?.data?.error || 'Gagal meminta pembaruan data.')
    } finally {
      setSyncing(false); setSyncMsg('')
      setTick((x) => x + 1)
      loadSyncInfo()
    }
  }
  const [dayModal, setDayModal] = useState<{ deviceId: string; date: string } | null>(null)
  const [holidayOpen, setHolidayOpen] = useState(false)

  const params = useCallback(() => ({
    date_from: from, date_to: to,
    employee_id: employeeId || undefined,
    include_unmapped: includeUnmapped ? 1 : undefined,
  }), [from, to, employeeId, includeUnmapped])

  useEffect(() => {
    let alive = true
    setLoading(true)
    axiosInstance.get('/api/hr/fingerprint/attendance', { params: params() })
      .then((r) => { if (alive) { setData(r.data); setPage(1) } })
      .catch((e) => { if (alive) { setData(null); showError(e.response?.data?.error || 'Data absensi gagal dimuat.') } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [params, tick])

  useEffect(() => {
    const t = new Date(); const s = new Date(); s.setDate(s.getDate() - 59)
    axiosInstance.get('/api/hr/fingerprint/attendance', { params: { date_from: iso(s), date_to: iso(t), include_unmapped: 1 } })
      .then((r) => {
        const ppl: Person[] = r.data.people || []
        setEmpOptions(ppl.filter((p) => p.employee).map((p) => ({ id: p.employee!.id, name: p.employee!.name })))
        setCalOptions(ppl.map((p) => ({ id: p.employee ? p.employee.id : -Number(p.device_user_id), name: personName(p.employee, p.device_name, p.device_user_id) })))
      })
      .catch(() => { setEmpOptions([]); setCalOptions([]) })
  }, [])

  const download = async (extra: Record<string, unknown>, filename: string) => {
    setExporting(true)
    try {
      const res = await axiosInstance.get('/api/hr/fingerprint/attendance/export', { params: { ...params(), ...extra }, responseType: 'blob' })
      const url = window.URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch { showError('Ekspor gagal.') } finally { setExporting(false) }
  }
  const exportExcel = () => download({}, `absensi-fingerprint-${from}-${to}.xlsx`)

  const printPdf = async (detail: boolean) => {
    setPrintOpen(false)
    const w = window.open('', '_blank')
    setExporting(true)
    try {
      const res = await axiosInstance.get('/api/hr/fingerprint/attendance/export', {
        params: { ...params(), format: 'pdf', detail: detail ? 1 : undefined }, responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      if (w) w.location.href = url; else window.open(url, '_blank')
    } catch { if (w) w.close(); showError('PDF gagal dibuat.') } finally { setExporting(false) }
  }

  const goDaily = (p: Person) => {
    if (p.employee) setEmployeeId(p.employee.id)
    setTab('days')
  }
  const reload = () => setTick((x) => x + 1)

  const days = useMemo(() => {
    let rows = data?.days || []
    if (!showHoliday) rows = rows.filter((d) => d.status !== 'libur' && d.status !== 'belum')
    if (statusFilter) rows = rows.filter((d) => d.status === statusFilter)
    return rows
  }, [data, showHoliday, statusFilter])
  const pages = Math.max(1, Math.ceil(days.length / PAGE))
  const pageRows = days.slice((page - 1) * PAGE, page * PAGE)

  const t = data?.totals
  const r = data?.rules
  const holidays = Object.entries(data?.special_holidays || {})

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Log Absensi"
        subtitle="Kehadiran dari mesin fingerprint: masuk, pulang, terlambat, dan selisih jam kerja"
        actions={
          <>
            <button onClick={refreshFromDevice} disabled={syncing} className={btnCls} title="Tarik data terbaru dari mesin fingerprint, lalu muat ulang">{syncing ? 'Memperbarui...' : 'Perbarui data'}</button>
            {canEdit && <button onClick={() => setHolidayOpen(true)} className={btnCls}>Libur khusus</button>}
            <div className="relative">
              <button onClick={() => setPrintOpen(!printOpen)} disabled={exporting || !data} className={btnCls}>Cetak PDF</button>
              {printOpen && (
                <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  <button onClick={() => printPdf(false)} className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700">Rekap periode</button>
                  <button onClick={() => printPdf(true)} disabled={!employeeId} className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700">
                    Rincian karyawan terpilih{!employeeId ? ' (pilih karyawan dulu)' : ''}
                  </button>
                </div>
              )}
            </div>
            <button onClick={exportExcel} disabled={exporting || !data} className={btnCls}>{exporting ? 'Menyiapkan...' : 'Ekspor Excel'}</button>
          </>
        }
      />

      {(syncMsg || lastPunch) && (
        <p className={`text-xs ${syncing ? 'text-emerald-700' : (lastPunch && Date.now() - new Date(lastPunch).getTime() > 36 * 3600 * 1000 ? 'text-amber-600' : 'text-gray-500')}`}>
          {syncing ? syncMsg : `Data terakhir dari mesin: ${new Date(lastPunch as string).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}${Date.now() - new Date(lastPunch as string).getTime() > 36 * 3600 * 1000 ? ' (sudah lama, klik Perbarui data)' : ''}`}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {presets().map((p) => (
          <button key={p.label} onClick={() => { setFrom(p.from); setTo(p.to) }}
            className={`rounded-md border px-3 py-1.5 text-sm ${from === p.from && to === p.to ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'}`}>
            {p.label}
          </button>
        ))}
        <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        <span className="text-sm text-gray-500">sampai</span>
        <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        <div className="w-60">
          <SearchableSelect options={empOptions} value={employeeId} onChange={(v) => setEmployeeId(v ? Number(v) : null)} placeholder="Semua karyawan" />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={includeUnmapped} onChange={(e) => setIncludeUnmapped(e.target.checked)} />
          Tampilkan juga ID yang belum dipetakan ke karyawan
        </label>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Data terakhir dari mesin: {data?.last_log_at ? fmtDateTime(data.last_log_at) : '-'}
      </p>

      <KpiStrip items={[
        { label: 'Hadir', value: (t?.present ?? 0).toLocaleString('id-ID'), hint: 'hari-orang' },
        { label: 'Izin sah', value: (t?.excused_days ?? 0).toLocaleString('id-ID'), hint: 'cuti, sakit, izin, dinas' },
        { label: 'Tidak ada cap', value: (t?.absent ?? 0).toLocaleString('id-ID'), tone: t && t.absent > 0 ? 'bad' : null, hint: 'hari kerja tanpa cap' },
        { label: 'Cap tidak lengkap', value: (t?.incomplete ?? 0).toLocaleString('id-ID'), tone: t && t.incomplete > 0 ? 'warn' : null, hint: 'hanya satu cap' },
        { label: 'Terlambat', value: (t?.late_count ?? 0).toLocaleString('id-ID'), tone: t && t.late_count > 0 ? 'warn' : null, hint: `total ${hm(t?.late_minutes ?? 0)} jam` },
        { label: 'Pulang cepat tanpa surat', value: (t?.early_unexcused_count ?? 0).toLocaleString('id-ID'), tone: t && t.early_unexcused_count > 0 ? 'warn' : null, hint: 'perlu surat izin HRD' },
      ]} />
      <p className="text-xs text-gray-600 dark:text-gray-300">
        Lembur {hm(t?.over_minutes ?? 0)} · Kurang {hm(t?.short_minutes ?? 0)} · Kurang yang sudah diizinkan {hm(t?.short_excused_minutes ?? 0)}
      </p>

      <Panel title="Aturan perhitungan" action={
        <button onClick={() => setRulesOpen(!rulesOpen)} className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">{rulesOpen ? 'Sembunyikan' : 'Tampilkan'}</button>
      }>
        {rulesOpen && r && (
          <div className="space-y-2 p-4 text-sm text-gray-700 dark:text-gray-300">
            <ul className="list-disc space-y-1 pl-5">
              <li>Cap yang berjarak kurang dari {Math.round(r.dedupe_seconds / 60)} menit digabung menjadi satu (ketukan ganda). Cap pertama dihitung masuk dan cap terakhir dihitung pulang. Satu cap saja berarti "Cap tidak lengkap".</li>
              <li>Target harian, jam masuk, jam pulang, dan istirahat diambil dari <Link to="/app/hr/attendance-schedules" className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">Jadwal Kerja</Link> masing-masing orang. Istirahat dipotong bila rentang masuk sampai pulang lebih dari {Math.round(r.break_if_span_over_minutes / 60)} jam. Tanpa jadwal dipakai aturan umum {hm(r.fallback_target_minutes)} jam, Senin sampai Jumat.</li>
              <li>Terlambat berarti masuk setelah jam mulai ditambah toleransi jadwal. Pulang cepat hanya sah bila ada surat izin dari HRD; tanpa surat ditandai "tanpa surat".</li>
              <li>Keterangan manual (cuti, sakit, izin, dinas, lupa cap, libur khusus) mengubah status hari itu. Pengajuan yang sudah disetujui di modul SDM ikut terbaca.</li>
              <li>Selisih sampai {r.tolerance_minutes} menit dianggap pas. Hari di luar jadwal (mis. Minggu) bertarget 0, sehingga cap di hari itu dihitung lembur.</li>
              <li>Hari kerja tanpa cap dari siapa pun (kurang dari {r.holiday_if_total_punches_below} cap di seluruh mesin) dianggap libur, bukan tidak masuk.</li>
            </ul>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Libur terdeteksi pada periode ini: {data && data.holidays.length ? data.holidays.map(fmtDate).join(', ') : 'tidak ada'}.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Libur khusus: {holidays.length ? holidays.map(([d, n]) => `${fmtDate(d)} (${n})`).join(', ') : 'tidak ada'}.
            </p>
          </div>
        )}
      </Panel>

      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
        {([['people', 'Per karyawan'], ['days', 'Harian'], ['calendar', 'Kalender']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>{l}</button>
        ))}
      </div>

      {tab === 'days' && (
        <div className="flex flex-wrap items-center gap-3">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className={inputCls}>
            <option value="">Semua status</option>
            <option value="hadir">Hadir</option>
            <option value="izin">Izin sah</option>
            <option value="tidak_ada_cap">Tidak ada cap</option>
            <option value="tidak_lengkap">Cap tidak lengkap</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={showHoliday} onChange={(e) => { setShowHoliday(e.target.checked); setPage(1) }} />
            Tampilkan hari libur
          </label>
          {employeeId && <button onClick={() => setEmployeeId(null)} className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">Hapus filter karyawan</button>}
        </div>
      )}

      {tab === 'people' && (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 md:block">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className={th}>Karyawan</th>
                  <th className={th}>Jadwal</th>
                  <th className={`${th} text-right`}>Hari kerja</th>
                  <th className={`${th} text-right`}>Hadir</th>
                  <th className={`${th} text-right`}>Izin sah</th>
                  <th className={`${th} text-right`}>Tidak ada cap</th>
                  <th className={`${th} text-right`}>Tidak lengkap</th>
                  <th className={th}>Terlambat</th>
                  <th className={th}>Pulang cepat</th>
                  <th className={`${th} text-right`}>Jam bersih</th>
                  <th className={`${th} text-right`}>Target</th>
                  <th className={`${th} text-right`}>Selisih</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading && <tr><td colSpan={13} className="px-4 py-8 text-center text-sm text-gray-500">Memuat...</td></tr>}
                {!loading && (data?.people.length ?? 0) === 0 && <tr><td colSpan={13} className="px-4 py-10 text-center text-sm text-gray-500">Belum ada data pada periode ini.</td></tr>}
                {data?.people.map((p) => (
                  <tr key={p.device_user_id} onClick={() => goDaily(p)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-4 py-2.5 text-sm">
                      <div className="font-medium text-gray-900 dark:text-white">{personName(p.employee, p.device_name, p.device_user_id)}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {p.employee ? `${p.employee.employee_number} · ID alat ${p.device_user_id}${p.device_name && p.device_name !== p.employee.name ? ` · di alat: ${p.device_name}` : ''}` : (
                          <>ID alat {p.device_user_id} · <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">belum dipetakan</span></>
                        )}
                      </div>
                      {p.id_inactive && (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span title="ID alat mungkin salah atau karyawan berhenti — cek di Pemetaan Fingerprint" className="inline-flex rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            Tidak cap sejak {p.last_log_at ? fmtDate(p.last_log_at.slice(0, 10)) : 'awal'}
                          </span>
                          <Link to="/app/hr/fingerprint-mapping" onClick={(e) => e.stopPropagation()} className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">Cek pemetaan</Link>
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{p.schedule || <span className="text-gray-400">belum ada</span>}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums">{p.work_days}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums">{p.present}</td>
                    <td className={`px-4 py-2.5 text-right text-sm tabular-nums ${p.excused_days ? 'text-sky-700 dark:text-sky-300' : ''}`}>{p.excused_days}</td>
                    <td className={`px-4 py-2.5 text-right text-sm tabular-nums ${p.absent ? 'text-red-600 dark:text-red-400' : ''}`}>{p.absent}</td>
                    <td className={`px-4 py-2.5 text-right text-sm tabular-nums ${p.incomplete ? 'text-amber-600 dark:text-amber-400' : ''}`}>{p.incomplete}</td>
                    <td className={`whitespace-nowrap px-4 py-2.5 text-sm tabular-nums ${p.late_count ? 'text-amber-700 dark:text-amber-300' : 'text-gray-400'}`}>{p.late_count ? `${p.late_count}x · ${hm(p.late_minutes)}` : '-'}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm">
                      {p.early_count ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="tabular-nums">{p.early_count}x</span>
                          {p.early_unexcused_count > 0 && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{p.early_unexcused_count} tanpa surat</span>}
                        </span>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums">{hm(p.net_minutes)}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums">{hm(p.target_minutes)}</td>
                    <td className={`px-4 py-2.5 text-right text-sm font-medium tabular-nums ${diffCls(p.diff_minutes)}`}>{hmSigned(p.diff_minutes)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={(e) => { e.stopPropagation(); setTab('calendar') }} className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">Kalender</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {data?.people.map((p) => (
              <button key={p.device_user_id} onClick={() => goDaily(p)} className="block w-full rounded-lg border border-gray-200 bg-white p-3 text-left dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{personName(p.employee, p.device_name, p.device_user_id)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{p.employee?.employee_number || `ID alat ${p.device_user_id}`}{p.schedule ? ` · ${p.schedule}` : ''}</div>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${diffCls(p.diff_minutes)}`}>{hmSigned(p.diff_minutes)}</span>
                </div>
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">Hadir {p.present} dari {p.work_days} hari, izin sah {p.excused_days}, tidak ada cap {p.absent}, tidak lengkap {p.incomplete}</div>
                {(p.late_count > 0 || p.early_count > 0) && (
                  <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    {p.late_count > 0 && <>Terlambat {p.late_count}x ({hm(p.late_minutes)}) </>}
                    {p.early_count > 0 && <>Pulang cepat {p.early_count}x{p.early_unexcused_count ? ` (${p.early_unexcused_count} tanpa surat)` : ''}</>}
                  </div>
                )}
                {p.id_inactive && <div className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">Tidak cap sejak {p.last_log_at ? fmtDate(p.last_log_at.slice(0, 10)) : 'awal'}</div>}
              </button>
            ))}
          </div>
        </>
      )}

      {tab === 'days' && (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 md:block">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className={th}>Tanggal</th>
                  <th className={th}>Karyawan</th>
                  <th className={th}>Masuk</th>
                  <th className={th}>Pulang</th>
                  <th className={`${th} text-right`}>Cap</th>
                  <th className={`${th} text-right`}>Jam bersih</th>
                  <th className={`${th} text-right`}>Target</th>
                  <th className={`${th} text-right`}>Selisih</th>
                  <th className={`${th} text-right`}>Terlambat</th>
                  <th className={th}>Pulang cepat</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading && <tr><td colSpan={11} className="px-4 py-8 text-center text-sm text-gray-500">Memuat...</td></tr>}
                {!loading && pageRows.length === 0 && <tr><td colSpan={11} className="px-4 py-10 text-center text-sm text-gray-500">Tidak ada baris yang cocok.</td></tr>}
                {pageRows.map((d) => (
                  <tr key={`${d.device_user_id}-${d.date}`} onClick={() => setDayModal({ deviceId: d.device_user_id, date: d.date })} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm"><span className="text-gray-900 dark:text-white">{fmtDate(d.date)}</span> <span className="text-xs text-gray-500">{d.weekday}</span></td>
                    <td className="px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200">{personName(d.employee, d.device_name, d.device_user_id)}{!d.employee && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">belum dipetakan</span>}</td>
                    <td className="px-4 py-2.5 text-sm tabular-nums">{d.first || '-'}</td>
                    <td className="px-4 py-2.5 text-sm tabular-nums">{d.last && d.punches > 1 ? d.last : '-'}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums">{d.punches || '-'}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums">{hm(d.net_minutes)}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums">{hm(d.target_minutes)}</td>
                    <td className={`px-4 py-2.5 text-right text-sm font-medium tabular-nums ${diffCls(d.diff_minutes)}`}>{hmSigned(d.diff_minutes)}</td>
                    <td className={`px-4 py-2.5 text-right text-sm tabular-nums ${d.late_minutes ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-gray-400'}`}>{d.late_minutes ? `${d.late_minutes} mnt` : '-'}</td>
                    <td className="px-4 py-2.5 text-sm"><EarlyBadge d={d} /></td>
                    <td className="px-4 py-2.5"><StatusBadge d={d} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {pageRows.map((d) => (
              <button key={`${d.device_user_id}-${d.date}`} onClick={() => setDayModal({ deviceId: d.device_user_id, date: d.date })} className="block w-full rounded-lg border border-gray-200 bg-white p-3 text-left dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{personName(d.employee, d.device_name, d.device_user_id)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{fmtDate(d.date)} {d.weekday}</div>
                  </div>
                  <StatusBadge d={d} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                  <span>Masuk {d.first || '-'} · Pulang {d.last && d.punches > 1 ? d.last : '-'}</span>
                  <span className={`text-sm font-semibold tabular-nums ${diffCls(d.diff_minutes)}`}>{hmSigned(d.diff_minutes)}</span>
                </div>
                {(d.late_minutes > 0 || d.early_minutes > 0) && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                    {d.late_minutes > 0 && <span>Terlambat {d.late_minutes} mnt</span>}
                    {d.early_minutes > 0 && <EarlyBadge d={d} />}
                  </div>
                )}
              </button>
            ))}
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
              <span>Halaman {page} dari {pages} ({days.length.toLocaleString('id-ID')} baris)</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50 dark:border-gray-600">Sebelumnya</button>
                <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50 dark:border-gray-600">Berikutnya</button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'calendar' && (
        <CalendarView options={calOptions} tick={tick} onOpenDay={(deviceId, date) => setDayModal({ deviceId, date })} />
      )}

      {dayModal && (
        <DayModal deviceId={dayModal.deviceId} date={dayModal.date} canEdit={canEdit} onClose={() => setDayModal(null)} onChanged={reload} />
      )}
      {holidayOpen && <HolidayDialog defaultDate={to} onClose={() => setHolidayOpen(false)} onSaved={reload} />}
    </div>
  )
}

export default FingerprintAttendance
