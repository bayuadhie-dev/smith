import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import { PageHeader, KpiStrip, Panel } from '../../components/ui/PageKit'
import SearchableSelect from '../../components/SearchableSelect'
import { showError } from '../../components/ui'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

type DayStatus = 'hadir' | 'tidak_lengkap' | 'tidak_ada_cap' | 'libur' | 'belum'
interface EmpRef { id: number; name: string; employee_number: string }
interface Day {
  date: string; weekday: string; device_user_id: string; device_name: string | null; employee: EmpRef | null
  first: string | null; last: string | null; punches: number
  net_minutes: number | null; target_minutes: number; diff_minutes: number | null; status: DayStatus
}
interface Person {
  device_user_id: string; employee: EmpRef | null; device_name: string | null
  work_days: number; present: number; absent: number; incomplete: number
  net_minutes: number; target_minutes: number; diff_minutes: number
  last_log_at: string | null; id_inactive: boolean
}
interface Rules {
  dedupe_seconds: number; break_minutes: number; break_if_span_over_minutes: number
  daily_target_minutes: number; tolerance_minutes: number; holiday_if_total_punches_below: number
}
interface Data {
  rules: Rules; days: Day[]; people: Person[]; holidays: string[]
  totals: { people: number; present: number; absent: number; incomplete: number; over_minutes: number; short_minutes: number }
  last_log_at: string | null; period: { date_from: string; date_to: string }
}

const PAGE = 50
const th = 'px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400'
const inputCls = 'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hm = (m: number | null | undefined) => (m === null || m === undefined ? '-' : `${m < 0 ? '-' : ''}${Math.floor(Math.abs(m) / 60)}:${String(Math.abs(m) % 60).padStart(2, '0')}`)
const hmSigned = (m: number | null | undefined) => (m === null || m === undefined ? '-' : m > 0 ? `+${hm(m)}` : hm(m))
const fmtDate = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtDateTime = (s: string) => new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const diffCls = (m: number | null | undefined) =>
  m === null || m === undefined || m === 0
    ? 'text-gray-500 dark:text-gray-400'
    : m > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'

const STATUS: Record<DayStatus, [string, string]> = {
  hadir: ['Hadir', 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'],
  tidak_ada_cap: ['Tidak ada cap', 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'],
  tidak_lengkap: ['Cap tidak lengkap', 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'],
  libur: ['Libur', 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'],
  belum: ['Belum', 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'],
}
const StatusBadge = ({ s }: { s: DayStatus }) => (
  <span className={`inline-flex whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${STATUS[s][1]}`}>{STATUS[s][0]}</span>
)

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

const FingerprintAttendance = () => {
  useDocumentTitle('Log Absensi')
  const initial = presets()[1]
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [employeeId, setEmployeeId] = useState<number | null>(null)
  const [includeUnmapped, setIncludeUnmapped] = useState(false)
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'people' | 'days'>('people')
  const [statusFilter, setStatusFilter] = useState('')
  const [showHoliday, setShowHoliday] = useState(false)
  const [page, setPage] = useState(1)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [empOptions, setEmpOptions] = useState<{ id: number; name: string }[]>([])
  const [exporting, setExporting] = useState(false)

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
  }, [params])

  useEffect(() => {
    axiosInstance.get('/api/hr/fingerprint/attendance', { params: { date_from: iso(new Date()), date_to: iso(new Date()) } })
      .then((r) => setEmpOptions((r.data.people || []).filter((p: Person) => p.employee).map((p: Person) => ({ id: p.employee!.id, name: p.employee!.name }))))
      .catch(() => setEmpOptions([]))
  }, [])

  const exportExcel = async () => {
    setExporting(true)
    try {
      const res = await axiosInstance.get('/api/hr/fingerprint/attendance/export', { params: params(), responseType: 'blob' })
      const url = window.URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `absensi-fingerprint-${from}-${to}.xlsx`
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      showError('Ekspor gagal.')
    } finally {
      setExporting(false)
    }
  }

  const goDaily = (p: Person) => {
    if (p.employee) setEmployeeId(p.employee.id)
    setTab('days')
  }

  const days = useMemo(() => {
    let rows = data?.days || []
    if (!showHoliday) rows = rows.filter((d) => d.status !== 'libur' && d.status !== 'belum')
    if (statusFilter) rows = rows.filter((d) => d.status === statusFilter)
    return rows
  }, [data, showHoliday, statusFilter])
  const pages = Math.max(1, Math.ceil(days.length / PAGE))
  const pageRows = days.slice((page - 1) * PAGE, page * PAGE)
  const name = (e: EmpRef | null, dn: string | null, id: string) => e?.name || dn || `ID ${id}`

  const t = data?.totals
  const r = data?.rules

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Log Absensi"
        subtitle="Kehadiran dari mesin fingerprint: masuk, pulang, dan selisih jam kerja"
        actions={
          <button onClick={exportExcel} disabled={exporting || !data} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
            {exporting ? 'Menyiapkan...' : 'Ekspor Excel'}
          </button>
        }
      />

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
          Sertakan ID yang belum dipetakan
        </label>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Data terakhir dari mesin: {data?.last_log_at ? fmtDateTime(data.last_log_at) : '-'}
      </p>

      <KpiStrip items={[
        { label: 'Hadir', value: (t?.present ?? 0).toLocaleString('id-ID'), hint: 'hari-orang' },
        { label: 'Tidak ada cap', value: (t?.absent ?? 0).toLocaleString('id-ID'), tone: t && t.absent > 0 ? 'bad' : null, hint: 'hari kerja tanpa cap' },
        { label: 'Cap tidak lengkap', value: (t?.incomplete ?? 0).toLocaleString('id-ID'), tone: t && t.incomplete > 0 ? 'warn' : null, hint: 'hanya satu cap' },
        { label: 'Lembur total', value: `${hm(t?.over_minutes ?? 0)} jam`, tone: t && t.over_minutes > 0 ? 'good' : null },
        { label: 'Kurang total', value: `${hm(t?.short_minutes ?? 0)} jam`, tone: t && t.short_minutes > 0 ? 'bad' : null },
      ]} />

      <Panel title="Aturan perhitungan" action={
        <button onClick={() => setRulesOpen(!rulesOpen)} className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">{rulesOpen ? 'Sembunyikan' : 'Tampilkan'}</button>
      }>
        {rulesOpen && r && (
          <div className="space-y-2 p-4 text-sm text-gray-700 dark:text-gray-300">
            <ul className="list-disc space-y-1 pl-5">
              <li>Cap yang berjarak kurang dari {Math.round(r.dedupe_seconds / 60)} menit digabung menjadi satu (ketukan ganda).</li>
              <li>Cap pertama dihitung masuk dan cap terakhir dihitung pulang. Satu cap saja berarti "Cap tidak lengkap".</li>
              <li>Istirahat {r.break_minutes} menit dipotong bila rentang masuk sampai pulang lebih dari {Math.round(r.break_if_span_over_minutes / 60)} jam.</li>
              <li>Target {hm(r.daily_target_minutes)} jam per hari, Senin sampai Jumat. Sabtu dan Minggu targetnya 0, jadi cap di hari itu dihitung lembur.</li>
              <li>Selisih sampai {r.tolerance_minutes} menit dianggap pas.</li>
              <li>Hari kerja tanpa cap dari siapa pun (kurang dari {r.holiday_if_total_punches_below} cap di seluruh mesin) dianggap libur, bukan tidak masuk.</li>
            </ul>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Libur terdeteksi pada periode ini: {data && data.holidays.length ? data.holidays.map(fmtDate).join(', ') : 'tidak ada'}.
            </p>
          </div>
        )}
      </Panel>

      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
        {([['people', 'Per karyawan'], ['days', 'Harian']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>{l}</button>
        ))}
      </div>

      {tab === 'days' && (
        <div className="flex flex-wrap items-center gap-3">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className={inputCls}>
            <option value="">Semua status</option>
            <option value="hadir">Hadir</option>
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
                  <th className={`${th} text-right`}>Hari kerja</th>
                  <th className={`${th} text-right`}>Hadir</th>
                  <th className={`${th} text-right`}>Tidak ada cap</th>
                  <th className={`${th} text-right`}>Tidak lengkap</th>
                  <th className={`${th} text-right`}>Jam bersih</th>
                  <th className={`${th} text-right`}>Target</th>
                  <th className={`${th} text-right`}>Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading && <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">Memuat...</td></tr>}
                {!loading && (data?.people.length ?? 0) === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">Belum ada data pada periode ini.</td></tr>}
                {data?.people.map((p) => (
                  <tr key={p.device_user_id} onClick={() => goDaily(p)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-4 py-2.5 text-sm">
                      <div className="font-medium text-gray-900 dark:text-white">{name(p.employee, p.device_name, p.device_user_id)}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{p.employee?.employee_number || `ID alat ${p.device_user_id}`}</div>
                      {p.id_inactive && (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span title="ID alat mungkin salah atau karyawan berhenti — cek di Pemetaan Fingerprint" className="inline-flex rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            Tidak cap sejak {p.last_log_at ? fmtDate(p.last_log_at.slice(0, 10)) : 'awal'}
                          </span>
                          <Link to="/app/hr/fingerprint-mapping" onClick={(e) => e.stopPropagation()} className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">Cek pemetaan</Link>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums">{p.work_days}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums">{p.present}</td>
                    <td className={`px-4 py-2.5 text-right text-sm tabular-nums ${p.absent ? 'text-red-600 dark:text-red-400' : ''}`}>{p.absent}</td>
                    <td className={`px-4 py-2.5 text-right text-sm tabular-nums ${p.incomplete ? 'text-amber-600 dark:text-amber-400' : ''}`}>{p.incomplete}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums">{hm(p.net_minutes)}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums">{hm(p.target_minutes)}</td>
                    <td className={`px-4 py-2.5 text-right text-sm font-medium tabular-nums ${diffCls(p.diff_minutes)}`}>{hmSigned(p.diff_minutes)}</td>
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
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{name(p.employee, p.device_name, p.device_user_id)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{p.employee?.employee_number || `ID alat ${p.device_user_id}`}</div>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${diffCls(p.diff_minutes)}`}>{hmSigned(p.diff_minutes)}</span>
                </div>
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">Hadir {p.present} dari {p.work_days} hari, tidak ada cap {p.absent}, tidak lengkap {p.incomplete}</div>
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
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {loading && <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">Memuat...</td></tr>}
                {!loading && pageRows.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-500">Tidak ada baris yang cocok.</td></tr>}
                {pageRows.map((d) => (
                  <tr key={`${d.device_user_id}-${d.date}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm"><span className="text-gray-900 dark:text-white">{fmtDate(d.date)}</span> <span className="text-xs text-gray-500">{d.weekday}</span></td>
                    <td className="px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200">{name(d.employee, d.device_name, d.device_user_id)}</td>
                    <td className="px-4 py-2.5 text-sm tabular-nums">{d.first || '-'}</td>
                    <td className="px-4 py-2.5 text-sm tabular-nums">{d.last && d.punches > 1 ? d.last : '-'}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums">{d.punches || '-'}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums">{hm(d.net_minutes)}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums">{hm(d.target_minutes)}</td>
                    <td className={`px-4 py-2.5 text-right text-sm font-medium tabular-nums ${diffCls(d.diff_minutes)}`}>{hmSigned(d.diff_minutes)}</td>
                    <td className="px-4 py-2.5"><StatusBadge s={d.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {pageRows.map((d) => (
              <div key={`${d.device_user_id}-${d.date}`} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{name(d.employee, d.device_name, d.device_user_id)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{fmtDate(d.date)} {d.weekday}</div>
                  </div>
                  <StatusBadge s={d.status} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                  <span>Masuk {d.first || '-'} · Pulang {d.last && d.punches > 1 ? d.last : '-'}</span>
                  <span className={`text-sm font-semibold tabular-nums ${diffCls(d.diff_minutes)}`}>{hmSigned(d.diff_minutes)}</span>
                </div>
              </div>
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
    </div>
  )
}

export default FingerprintAttendance
