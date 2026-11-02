import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import axiosInstance from '../../utils/axiosConfig'
import { PageHeader, KpiStrip } from '../../components/ui/PageKit'
import SearchableSelect from '../../components/SearchableSelect'
import { confirmDialog, showSuccess, showError } from '../../components/ui'
import { usePermissions } from '../../contexts/PermissionContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

type Status = 'mapped' | 'exact' | 'similar' | 'none'
interface EmpRef { id: number; name: string; employee_number: string }
interface Row {
  id: number
  device_user_id: string
  name: string
  log_count: number
  last_log_at: string | null
  status: Status
  employee: EmpRef | null
  suggestion: (EmpRef & { kind: 'exact' | 'similar' }) | null
}
interface Summary { device_users: number; mapped: number; active_employees: number; employees_without_id: number }

const TABS: { key: string; label: string }[] = [
  { key: '', label: 'Semua' },
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

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-')

const FingerprintMapping = () => {
  useDocumentTitle('Pemetaan Fingerprint')
  const { hasPermission, isSuperAdmin } = usePermissions()
  const canEdit = isSuperAdmin || hasPermission('hr.edit')

  const [rows, setRows] = useState<Row[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [freeEmps, setFreeEmps] = useState<EmpRef[]>([])
  const [exactWaiting, setExactWaiting] = useState(0)
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
      const r = await axiosInstance.get('/api/hr/fingerprint/users', { params: { search: debounced || undefined, filter: filter || undefined } })
      setRows(r.data.users || [])
      setSummary(r.data.summary || null)
      setFreeEmps(r.data.employees_without_id || [])
      const ex = await axiosInstance.get('/api/hr/fingerprint/users', { params: { filter: 'exact' } })
      setExactWaiting((ex.data.users || []).length)
    } catch (e: any) {
      showError(e.response?.data?.error || 'Data gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }, [debounced, filter])

  useEffect(() => { load() }, [load])

  const map = async (row: Row, employeeId: number | null) => {
    setBusy(true)
    try {
      await axiosInstance.put(`/api/hr/fingerprint/users/${row.id}/map`, { employee_id: employeeId })
      showSuccess(employeeId ? 'Pemetaan disimpan.' : 'Pemetaan dilepas.')
      await load()
    } catch (e: any) {
      showError(e.response?.data?.error || 'Pemetaan gagal disimpan.')
    } finally {
      setBusy(false)
    }
  }

  const release = async (row: Row) => {
    if (!(await confirmDialog(`Lepas pemetaan ID alat ${row.device_user_id} (${row.name}) dari ${row.employee?.name}?`))) return
    await map(row, null)
  }

  const acceptAll = async () => {
    const ok = await confirmDialog(
      `Petakan ${exactWaiting} pengguna alat yang namanya sama persis dengan satu karyawan aktif? Nama yang hanya mirip tidak ikut dipetakan, dan setiap pemetaan bisa dilepas lagi per baris.`
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

  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const visible = useMemo(() => rows.slice((page - 1) * PAGE, page * PAGE), [rows, page])
  const empOptions = useMemo(() => freeEmps.map((e) => ({ id: e.id, code: e.employee_number, name: e.name })), [freeEmps])

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Pemetaan Fingerprint"
        subtitle="Cocokkan ID di mesin absensi dengan karyawan. Pemetaan ini dipakai untuk menarik absensi ke gaji."
        actions={canEdit ? (
          <button onClick={acceptAll} disabled={busy || exactWaiting === 0} className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
            Terima semua yang namanya sama persis
          </button>
        ) : undefined}
      />

      <KpiStrip
        items={[
          { label: 'Pengguna di alat', value: (summary?.device_users ?? 0).toLocaleString('id-ID') },
          { label: 'Sudah dipetakan', value: (summary?.mapped ?? 0).toLocaleString('id-ID'), tone: 'good' },
          { label: 'Karyawan aktif belum punya ID', value: (summary?.employees_without_id ?? 0).toLocaleString('id-ID'), tone: summary?.employees_without_id ? 'warn' : null, hint: `dari ${summary?.active_employees ?? 0} karyawan aktif` },
          { label: 'Usulan nama sama menunggu', value: exactWaiting.toLocaleString('id-ID') },
        ]}
      />

      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setFilter(t.key); setPage(1) }}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${filter === t.key ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

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
            {loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">Memuat...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">{debounced || filter ? 'Tidak ada data yang cocok.' : 'Belum ada pengguna alat. Daftar diisi dari hasil pembacaan mesin.'}</td></tr>}
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
                  ) : canEdit ? (
                    <div className="space-y-1">
                      {r.suggestion && (
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                          <span>Usulan: <span className="font-medium">{r.suggestion.name}</span></span>
                          <button disabled={busy} onClick={() => map(r, r.suggestion!.id)} className="font-medium text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-400">Terima</button>
                        </div>
                      )}
                      <SearchableSelect options={empOptions} value={null} onChange={(v) => v && map(r, Number(v))} placeholder="Pilih karyawan" />
                    </div>
                  ) : (
                    <span className="text-gray-400">{r.suggestion ? `Usulan: ${r.suggestion.name}` : '-'}</span>
                  )}
                </td>
                {canEdit && (
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm">
                    {r.employee && <button disabled={busy} onClick={() => release(r)} className="font-medium text-red-600 hover:underline disabled:opacity-50">Lepas</button>}
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
    </div>
  )
}

export default FingerprintMapping
