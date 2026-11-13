import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import axiosInstance from '../../utils/axiosConfig'
import { PageHeader, KpiStrip } from '../../components/ui/PageKit'
import SearchableSelect from '../../components/SearchableSelect'
import { confirmDialog, showSuccess, showError } from '../../components/ui'
import { usePermissions } from '../../contexts/PermissionContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { Skeleton } from '../../components/ui/Skeleton'

type Status = 'mapped' | 'exact' | 'similar' | 'none'
type Conf = 'tinggi' | 'sedang' | 'rendah'
interface EmpRef { id: number; name: string; employee_number: string }
interface EmpCand extends EmpRef { score: number; reason: string; confidence: Conf }
interface DevCand { device_user_id: string; user_row_id: number; name: string; score: number; reason: string; confidence: Conf; log_count: number; last_log_at: string | null }
interface FreeEmp extends EmpRef { candidates: DevCand[] }
interface Row {
  id: number
  device_user_id: string
  name: string
  log_count: number
  last_log_at: string | null
  status: Status
  employee: EmpRef | null
  suggestion: (EmpRef & { kind: 'exact' | 'similar'; score: number; reason: string; confidence: Conf; unique: boolean }) | null
  candidates: EmpCand[]
}
interface Summary { device_users: number; mapped: number; active_employees: number; employees_without_id: number; confident_pending: number }

const EMP_TAB = '__emps'
const TABS: { key: string; label: string }[] = [
  { key: '', label: 'Semua' },
  { key: EMP_TAB, label: 'Karyawan belum punya ID' },
  { key: 'unmapped', label: 'Belum dipetakan' },
  { key: 'exact', label: 'Usulan nama sama' },
  { key: 'similar', label: 'Usulan mirip' },
  { key: 'none', label: 'Tanpa usulan' },
  { key: 'mapped', label: 'Sudah dipetakan' },
]
const PAGE = 50
const th = 'px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400'

const badge = (s: Status) => {
  const m: Record<Status, [string, string]> = {
    mapped: ['Dipetakan', 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'],
    exact: ['Nama sama', 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'],
    similar: ['Nama mirip', 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'],
    none: ['Tanpa usulan', 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'],
  }
  return <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${m[s][1]}`}>{m[s][0]}</span>
}

const confBadge = (c: Conf) => {
  const m: Record<Conf, [string, string]> = {
    tinggi: ['Tinggi', 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'],
    sedang: ['Sedang', 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'],
    rendah: ['Rendah', 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'],
  }
  return <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${m[c][1]}`}>{m[c][0]}</span>
}

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-')

const FingerprintMapping = () => {
  useDocumentTitle('Pemetaan Fingerprint')
  const { hasPermission, isSuperAdmin } = usePermissions()
  const canEdit = isSuperAdmin || hasPermission('hr.edit')

  const [rows, setRows] = useState<Row[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [freeEmps, setFreeEmps] = useState<FreeEmp[]>([])
  const [empSearch, setEmpSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await axiosInstance.get('/api/hr/fingerprint/users', { params: { search: filter === EMP_TAB ? undefined : (debounced || undefined), filter: filter && filter !== EMP_TAB ? filter : undefined } })
      setRows(r.data.users || [])
      setSummary(r.data.summary || null)
      setFreeEmps(r.data.employees_without_id || [])
    } catch (e: any) {
      showError(e.response?.data?.error || 'Data gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }, [debounced, filter])

  useEffect(() => { load() }, [load])

  const mapById = async (userRowId: number, employeeId: number | null) => {
    setBusy(true)
    try {
      await axiosInstance.put(`/api/hr/fingerprint/users/${userRowId}/map`, { employee_id: employeeId })
      showSuccess(employeeId ? 'Pemetaan disimpan.' : 'Pemetaan dilepas.')
      await load()
    } catch (e: any) {
      showError(e.response?.data?.error || 'Pemetaan gagal disimpan.')
    } finally {
      setBusy(false)
    }
  }

  const map = (row: Row, employeeId: number | null) => mapById(row.id, employeeId)

  const release = async (row: Row) => {
    if (!(await confirmDialog(`Lepas pemetaan ID alat ${row.device_user_id} (${row.name}) dari ${row.employee?.name}?`))) return
    await map(row, null)
  }

  const acceptAll = async () => {
    const ok = await confirmDialog(
      `Petakan ${pending} pengguna alat yang usulannya berkeyakinan tinggi dan tidak bersaing dengan kandidat lain? Usulan berkeyakinan sedang atau rendah, serta yang bersaing, tidak ikut dipetakan. Setiap pemetaan bisa dilepas lagi per baris.`
    )
    if (!ok) return
    setBusy(true)
    try {
      const r = await axiosInstance.post('/api/hr/fingerprint/users/accept-exact')
      showSuccess(r.data?.message || 'Selesai.')
      await load()
    } catch (e: any) {
      showError(e.response?.data?.error || 'Gagal memetakan.')
    } finally {
      setBusy(false)
    }
  }

  const pending = summary?.confident_pending ?? 0
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const visible = useMemo(() => rows.slice((page - 1) * PAGE, page * PAGE), [rows, page])
  const empOptions = useMemo(() => freeEmps.map((e) => ({ id: e.id, code: e.employee_number, name: e.name })), [freeEmps])
  const shownEmps = useMemo(() => {
    const q = empSearch.trim().toLowerCase()
    return q ? freeEmps.filter((e) => `${e.name} ${e.employee_number}`.toLowerCase().includes(q)) : freeEmps
  }, [freeEmps, empSearch])
  const empMode = filter === EMP_TAB

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Pemetaan Fingerprint"
        subtitle="Cocokkan ID di mesin absensi dengan karyawan. Pemetaan ini dipakai untuk menarik absensi ke gaji."
        actions={canEdit ? (
          <button onClick={acceptAll} disabled={busy || pending === 0} className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
            Terima semua yang yakin ({pending})
          </button>
        ) : undefined}
      />

      <KpiStrip
        items={[
          { label: 'Pengguna di alat', value: (summary?.device_users ?? 0).toLocaleString('id-ID') },
          { label: 'Sudah dipetakan', value: (summary?.mapped ?? 0).toLocaleString('id-ID'), tone: 'good' },
          { label: 'Karyawan aktif belum punya ID', value: (summary?.employees_without_id ?? 0).toLocaleString('id-ID'), tone: summary?.employees_without_id ? 'warn' : null, hint: `dari ${summary?.active_employees ?? 0} karyawan aktif` },
          { label: 'Usulan yakin menunggu', value: pending.toLocaleString('id-ID'), hint: 'skor tinggi, tanpa pesaing' },
        ]}
      />

      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setFilter(t.key); setPage(1) }}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${filter === t.key ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {empMode ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Karyawan aktif yang belum punya ID alat, dengan nama di mesin yang paling mirip. Nama di mesin maksimal 24 huruf dan sering disingkat, jadi cek jumlah cap dan cap terakhir sebelum memilih.
          </p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} placeholder="Cari nama atau nomor karyawan"
              className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
          </div>
          {loading && freeEmps.length === 0 && <div className="space-y-2" role="status" aria-label="Memuat data">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-4 w-full" />)}</div>}
          {!loading && shownEmps.length === 0 && <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">{empSearch ? 'Tidak ada karyawan yang cocok.' : 'Semua karyawan aktif sudah punya ID alat.'}</p>}
          <div className="grid gap-3 lg:grid-cols-2">
            {shownEmps.map((e) => (
              <div key={e.id} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium text-gray-900 dark:text-white">{e.name}</p>
                  <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{e.employee_number}</span>
                </div>
                {(e.candidates || []).length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Tidak ada nama yang mirip di mesin. Mungkin belum didaftarkan fingerprint, atau pakai pencarian di tab Semua.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-700">
                    {(e.candidates || []).map((c) => (
                      <li key={c.device_user_id} className="flex items-start justify-between gap-3 py-2">
                        <div className="min-w-0 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium tabular-nums text-gray-900 dark:text-white">ID {c.device_user_id}</span>
                            <span className="text-gray-800 dark:text-gray-200">{c.name}</span>
                            {confBadge(c.confidence)}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {c.reason} · {c.log_count.toLocaleString('id-ID')} cap · terakhir {fmtDate(c.last_log_at)}
                          </p>
                        </div>
                        {canEdit && (
                          <button disabled={busy} onClick={() => mapById(c.user_row_id, e.id)} className="shrink-0 rounded-md border border-emerald-600 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20">
                            Pilih ini
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
      <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari ID alat, nama di alat, atau nama karyawan"
          className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className={th}>ID alat</th>
              <th className={th}>Nama di alat</th>
              <th className={`${th} text-right`}>Jumlah cap</th>
              <th className={th}>Cap terakhir</th>
              <th className={th}>Status</th>
              <th className={th}>Karyawan</th>
              {canEdit && <th className={`${th} text-right`}>Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-4"><div className="space-y-2" role="status" aria-label="Memuat data">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-5 w-full" />)}</div></td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">{debounced || filter ? 'Tidak ada data yang cocok.' : 'Belum ada pengguna alat. Daftar diisi dari hasil pembacaan mesin.'}</td></tr>}
            {visible.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium tabular-nums text-gray-900 dark:text-white">{r.device_user_id}</td>
                <td className="px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200">{r.name}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-gray-600 dark:text-gray-300">{r.log_count.toLocaleString('id-ID')}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{fmtDate(r.last_log_at)}</td>
                <td className="whitespace-nowrap px-4 py-2.5">{badge(r.status)}</td>
                <td className="min-w-[16rem] px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200">
                  {r.employee ? (
                    <span>{r.employee.name} <span className="text-xs text-gray-400">{r.employee.employee_number}</span></span>
                  ) : (
                    <div className="space-y-1.5">
                      {r.suggestion && (
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>Usulan: <span className="font-medium text-gray-900 dark:text-white">{r.suggestion.name}</span></span>
                            {confBadge(r.suggestion.confidence)}
                            {!r.suggestion.unique && <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" title="Ada kandidat lain dengan skor hampir sama">bersaing</span>}
                            {canEdit && <button disabled={busy} onClick={() => map(r, r.suggestion!.id)} className="font-medium text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-400">Terima</button>}
                          </div>
                          <p className="text-gray-500 dark:text-gray-400">{r.suggestion.reason}</p>
                        </div>
                      )}
                      {canEdit && (r.candidates || []).filter((c) => !r.suggestion || c.id !== r.suggestion.id).length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                          <span>Alternatif:</span>
                          {(r.candidates || []).filter((c) => !r.suggestion || c.id !== r.suggestion.id).map((c) => (
                            <button key={c.id} disabled={busy} onClick={() => map(r, c.id)} title={`${c.reason} (skor ${Math.round(c.score * 100)})`} className="rounded border border-gray-300 px-1.5 py-0.5 text-gray-700 hover:border-emerald-600 hover:text-emerald-700 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200">
                              {c.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {canEdit ? (
                        <SearchableSelect options={empOptions} value={null} onChange={(v) => v && map(r, Number(v))} placeholder="Pilih karyawan" />
                      ) : !r.suggestion ? <span className="text-gray-400">-</span> : null}
                    </div>
                  )}
                </td>
                {canEdit && (
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm">
                    {r.employee && <button disabled={busy} onClick={() => release(r)} className="font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400">Lepas</button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
          <span>Halaman {page} dari {pages} ({rows.length.toLocaleString('id-ID')} baris)</span>
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

export default FingerprintMapping
