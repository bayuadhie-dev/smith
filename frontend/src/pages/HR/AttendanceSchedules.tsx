import { useCallback, useEffect, useMemo, useState } from 'react'
import { useUrlState } from '../../hooks/useUrlState'
import { useBreadcrumbTrail } from '../../components/ui/BreadcrumbTrail'
import { Search } from 'lucide-react'
import axiosInstance from '../../utils/axiosConfig'
import { PageHeader, Panel } from '../../components/ui/PageKit'
import NumberInput from '../../components/ui/NumberInput'
import { confirmDialog, showSuccess, showError } from '../../components/ui'
import { usePermissions } from '../../contexts/PermissionContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

type DayCfg = { start: string; end: string; break: number }
interface Schedule {
  id: number; name: string; days: Record<string, DayCfg>
  late_tolerance_minutes: number; early_tolerance_minutes: number
  is_default: boolean; is_active: boolean; notes: string | null; assigned: number
}
interface Person {
  device_user_id: string; name: string; employee_name: string | null; schedule_id: number | null
  active_days: number; median_first: string | null; median_last: string | null; suggested_schedule_id: number | null
}
type FormDay = { work: boolean; start: string; end: string; break: string }
type Form = { name: string; days: FormDay[]; late: string; early: string; notes: string }

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const inputCls = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white'
const labelCls = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200'
const th = 'px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400'
const PAGE = 50

const toMin = (t: string) => { const [h, m] = (t || '0:0').split(':'); return (Number(h) || 0) * 60 + (Number(m) || 0) }
const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
const netOf = (d: { start: string; end: string; break: number }) => Math.max(0, toMin(d.end) - toMin(d.start) - (d.break || 0))
const weekTotal = (days: Record<string, DayCfg>) => Object.values(days).reduce((a, d) => a + netOf(d), 0)

const emptyDays = (): FormDay[] => DAYS.map((_, i) => ({ work: i < 5, start: '08:00', end: '17:00', break: '60' }))
const emptyForm = (): Form => ({ name: '', days: emptyDays(), late: '10', early: '10', notes: '' })

const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
        <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 dark:text-gray-400">Tutup</button>
      </div>
      {children}
    </div>
  </div>
)

const AttendanceSchedules = () => {
  useDocumentTitle('Jadwal Kerja Absensi')
  const { hasPermission, isSuperAdmin } = usePermissions()
  const canEdit = isSuperAdmin || hasPermission('hr.edit')

  const [tab, setTab] = useUrlState<'jadwal' | 'penetapan'>('tab', 'jadwal', ['jadwal', 'penetapan'])
  useBreadcrumbTrail(tab === 'jadwal' ? [] : [{ label: ({ penetapan: 'Penetapan' } as Record<string, string>)[tab] }])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)

  const [modal, setModal] = useState<{ id: number | null } | null>(null)
  const [form, setForm] = useState<Form>(emptyForm())
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkSchedule, setBulkSchedule] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, p] = await Promise.all([
        axiosInstance.get('/api/hr/fingerprint/schedules'),
        axiosInstance.get('/api/hr/fingerprint/schedules/people'),
      ])
      setSchedules(s.data.schedules || [])
      setPeople(p.data.people || [])
    } catch {
      showError('Data gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const byId = useMemo(() => Object.fromEntries(schedules.map((s) => [s.id, s])), [schedules])
  const activeSchedules = schedules.filter((s) => s.is_active)
  const hasUnconfirmed = schedules.some((s) => (s.notes || '').toLowerCase().includes('dikonfirmasi'))

  const openNew = () => { setForm(emptyForm()); setModal({ id: null }) }
  const openEdit = (s: Schedule) => {
    setForm({
      name: s.name,
      days: DAYS.map((_, i) => {
        const d = s.days[String(i)]
        return d ? { work: true, start: d.start, end: d.end, break: String(d.break ?? 0) } : { work: false, start: '08:00', end: '17:00', break: '0' }
      }),
      late: String(s.late_tolerance_minutes), early: String(s.early_tolerance_minutes), notes: s.notes || '',
    })
    setModal({ id: s.id })
  }

  const setDay = (i: number, patch: Partial<FormDay>) => setForm((f) => ({ ...f, days: f.days.map((d, k) => (k === i ? { ...d, ...patch } : d)) }))
  const copyMonday = () => setForm((f) => ({ ...f, days: f.days.map((d, k) => (k > 0 && k < 5 ? { ...f.days[0], work: true } : d)) }))
  const formWeek = form.days.reduce((a, d) => a + (d.work ? netOf({ start: d.start, end: d.end, break: Number(d.break) || 0 }) : 0), 0)

  const save = async () => {
    if (!form.name.trim()) { showError('Nama jadwal wajib diisi.'); return }
    const days: Record<string, DayCfg> = {}
    for (let i = 0; i < 7; i++) {
      const d = form.days[i]
      if (!d.work) continue
      if (!d.start || !d.end) { showError(`${DAYS[i]}: jam masuk dan pulang wajib diisi.`); return }
      if (toMin(d.end) <= toMin(d.start)) { showError(`${DAYS[i]}: jam pulang harus setelah jam masuk.`); return }
      days[String(i)] = { start: d.start, end: d.end, break: Number(d.break) || 0 }
    }
    if (Object.keys(days).length === 0) { showError('Pilih minimal satu hari kerja.'); return }
    const body = {
      name: form.name.trim(), days, notes: form.notes || null,
      late_tolerance_minutes: Number(form.late) || 0, early_tolerance_minutes: Number(form.early) || 0,
    }
    setSaving(true)
    try {
      if (modal?.id) await axiosInstance.put(`/api/hr/fingerprint/schedules/${modal.id}`, body)
      else await axiosInstance.post('/api/hr/fingerprint/schedules', body)
      showSuccess('Jadwal disimpan.')
      setModal(null)
      await load()
    } catch (e: any) {
      showError(e.response?.data?.error || 'Jadwal gagal disimpan.')
    } finally {
      setSaving(false)
    }
  }

  const makeDefault = async (s: Schedule) => {
    if (!(await confirmDialog(`Jadikan "${s.name}" jadwal bawaan? Orang yang belum punya jadwal akan memakainya.`))) return
    try { await axiosInstance.put(`/api/hr/fingerprint/schedules/${s.id}`, { is_default: true }); showSuccess('Jadwal bawaan diubah.'); load() }
    catch (e: any) { showError(e.response?.data?.error || 'Gagal mengubah jadwal bawaan.') }
  }
  const toggleActive = async (s: Schedule) => {
    const msg = s.is_active
      ? `Nonaktifkan "${s.name}"? ${s.assigned} orang yang memakainya akan jatuh ke jadwal bawaan.`
      : `Aktifkan kembali "${s.name}"?`
    if (!(await confirmDialog(msg))) return
    try { await axiosInstance.put(`/api/hr/fingerprint/schedules/${s.id}`, { is_active: !s.is_active }); showSuccess('Jadwal diperbarui.'); load() }
    catch (e: any) { showError(e.response?.data?.error || 'Gagal memperbarui jadwal.') }
  }

  const assign = async (scheduleId: number | null, ids: string[]) => {
    try {
      await axiosInstance.post('/api/hr/fingerprint/schedules/assign', { schedule_id: scheduleId, device_user_ids: ids })
      showSuccess(`${ids.length} orang diatur.`)
      setSelected(new Set())
      await load()
    } catch (e: any) { showError(e.response?.data?.error || 'Gagal mengatur jadwal.') }
  }

  const applyBulk = async () => {
    if (!bulkSchedule || selected.size === 0) { showError('Pilih jadwal dan minimal satu orang.'); return }
    await assign(bulkSchedule === 'none' ? null : Number(bulkSchedule), Array.from(selected))
  }
  const applyAllSuggestions = async () => {
    const todo = people.filter((p) => p.suggested_schedule_id && p.suggested_schedule_id !== p.schedule_id)
    if (todo.length === 0) { showError('Tidak ada saran yang perlu diterapkan.'); return }
    if (!(await confirmDialog(`Terapkan saran jadwal untuk ${todo.length} orang? Hanya orang yang belum punya jadwal atau jadwalnya berbeda dari saran yang diubah.`))) return
    try {
      const groups = new Map<number, string[]>()
      todo.forEach((p) => { const k = p.suggested_schedule_id as number; groups.set(k, [...(groups.get(k) || []), p.device_user_id]) })
      for (const [sid, ids] of groups) await axiosInstance.post('/api/hr/fingerprint/schedules/assign', { schedule_id: sid, device_user_ids: ids })
      showSuccess(`${todo.length} orang diatur.`)
      await load()
    } catch (e: any) { showError(e.response?.data?.error || 'Gagal menerapkan saran.') }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return people.filter((p) => !q || `${p.employee_name || ''} ${p.name} ${p.device_user_id}`.toLowerCase().includes(q))
  }, [people, search])
  useEffect(() => { setPage(1) }, [search])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const slice = filtered.slice((page - 1) * PAGE, page * PAGE)
  const allOnPage = slice.length > 0 && slice.every((p) => selected.has(p.device_user_id))
  const togglePage = () => setSelected((prev) => {
    const n = new Set(prev)
    if (allOnPage) slice.forEach((p) => n.delete(p.device_user_id)); else slice.forEach((p) => n.add(p.device_user_id))
    return n
  })
  const toggleOne = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const scheduleSelect = (value: number | null, onChange: (v: number | null) => void) => (
    <select className={inputCls} value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">Jadwal bawaan</option>
      {activeSchedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  )

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Jadwal Kerja Absensi"
        subtitle="Jam kerja per kelompok. Dipakai untuk menghitung target jam, terlambat, dan pulang cepat dari fingerprint."
        actions={canEdit ? <button onClick={openNew} className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">Jadwal baru</button> : undefined}
      />

      <div className="flex gap-6 border-b border-gray-200 dark:border-gray-700">
        {([['jadwal', 'Jadwal'], ['penetapan', 'Penetapan']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-1 py-2 text-sm font-medium ${tab === k ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white'}`}>{l}</button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Memuat...</p>}

      {!loading && tab === 'jadwal' && (
        <div className="space-y-4">
          {hasUnconfirmed && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              Beberapa jam bawaan masih perkiraan (mis. Sabtu). Sesuaikan dengan jam kerja sebenarnya.
            </div>
          )}
          {schedules.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada jadwal.</p>}
          {schedules.map((s) => (
            <Panel
              key={s.id}
              title={s.name}
              action={
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {s.is_default && <span className="rounded bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Bawaan</span>}
                  {!s.is_active && <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">Nonaktif</span>}
                  <span className="text-gray-500 dark:text-gray-400">{s.assigned} orang</span>
                  {canEdit && <button onClick={() => openEdit(s)} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">Ubah</button>}
                  {canEdit && s.is_active && !s.is_default && <button onClick={() => makeDefault(s)} className="text-gray-600 hover:underline dark:text-gray-300">Jadikan bawaan</button>}
                  {canEdit && !s.is_default && <button onClick={() => toggleActive(s)} className="text-red-600 hover:underline dark:text-red-400">{s.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>}
                </div>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr><th className={th}>Hari</th><th className={th}>Masuk</th><th className={th}>Pulang</th><th className={`${th} text-right`}>Istirahat</th><th className={`${th} text-right`}>Jam bersih</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {DAYS.map((name, i) => {
                      const d = s.days[String(i)]
                      return d ? (
                        <tr key={i}>
                          <td className="px-3 py-1.5 font-medium text-gray-900 dark:text-white">{name}</td>
                          <td className="px-3 py-1.5 tabular-nums">{d.start}</td>
                          <td className="px-3 py-1.5 tabular-nums">{d.end}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{d.break} mnt</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{hm(netOf(d))}</td>
                        </tr>
                      ) : (
                        <tr key={i}><td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">{name}</td><td colSpan={4} className="px-3 py-1.5 text-gray-400">Libur</td></tr>
                      )
                    })}
                    <tr className="bg-gray-50 font-medium dark:bg-gray-900">
                      <td className="px-3 py-1.5" colSpan={4}>Total per minggu</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{hm(weekTotal(s.days))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <span>Toleransi terlambat: {s.late_tolerance_minutes} menit</span>
                <span>Toleransi pulang cepat: {s.early_tolerance_minutes} menit</span>
              </div>
              {s.notes && <p className="px-4 pb-3 text-xs text-gray-500 dark:text-gray-400">{s.notes}</p>}
            </Panel>
          ))}
        </div>
      )}

      {!loading && tab === 'penetapan' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Orang tanpa jadwal memakai jadwal bawaan. Daftar ini berisi orang yang cap dalam 60 hari terakhir.</p>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama atau ID alat" className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
            </div>
            {canEdit && (
              <div className="flex flex-wrap items-center gap-2">
                <select className={`${inputCls} !w-52`} value={bulkSchedule} onChange={(e) => setBulkSchedule(e.target.value)}>
                  <option value="">Pilih jadwal</option>
                  <option value="none">Jadwal bawaan (lepas)</option>
                  {activeSchedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button onClick={applyBulk} disabled={selected.size === 0} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                  Terapkan jadwal ke yang dipilih ({selected.size})
                </button>
                <button onClick={applyAllSuggestions} className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800">Terapkan semua saran</button>
              </div>
            )}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 md:block">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  {canEdit && <th className="w-10 px-3 py-2"><input type="checkbox" checked={allOnPage} onChange={togglePage} /></th>}
                  <th className={th}>Nama</th><th className={th}>ID alat</th><th className={th}>Rata-rata masuk - pulang</th>
                  <th className={`${th} text-right`}>Hari aktif</th><th className={th}>Jadwal</th><th className={th}>Saran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {slice.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">Tidak ada orang yang cocok.</td></tr>}
                {slice.map((p) => {
                  const sug = p.suggested_schedule_id && p.suggested_schedule_id !== p.schedule_id ? byId[p.suggested_schedule_id] : null
                  return (
                    <tr key={p.device_user_id}>
                      {canEdit && <td className="px-3 py-2"><input type="checkbox" checked={selected.has(p.device_user_id)} onChange={() => toggleOne(p.device_user_id)} /></td>}
                      <td className="px-3 py-2"><div className="font-medium text-gray-900 dark:text-white">{p.employee_name || p.name}</div>{p.employee_name && p.employee_name !== p.name && <div className="text-xs text-gray-500 dark:text-gray-400">di alat: {p.name}</div>}</td>
                      <td className="px-3 py-2 tabular-nums">{p.device_user_id}</td>
                      <td className="px-3 py-2 tabular-nums">{p.median_first || '-'} - {p.median_last || '-'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.active_days}</td>
                      <td className="min-w-[11rem] px-3 py-2">
                        {canEdit ? scheduleSelect(p.schedule_id, (v) => assign(v, [p.device_user_id])) : (p.schedule_id ? byId[p.schedule_id]?.name : 'Jadwal bawaan')}
                      </td>
                      <td className="px-3 py-2">
                        {sug && (
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Saran: {sug.name}</span>
                            {canEdit && <button onClick={() => assign(sug.id, [p.device_user_id])} className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">Pakai saran</button>}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 md:hidden">
            {slice.map((p) => {
              const sug = p.suggested_schedule_id && p.suggested_schedule_id !== p.schedule_id ? byId[p.suggested_schedule_id] : null
              return (
                <div key={p.device_user_id} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{p.employee_name || p.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">ID alat {p.device_user_id} · {p.median_first || '-'} - {p.median_last || '-'} · {p.active_days} hari</div>
                    </div>
                    {canEdit && <input type="checkbox" checked={selected.has(p.device_user_id)} onChange={() => toggleOne(p.device_user_id)} />}
                  </div>
                  <div className="mt-2">{canEdit ? scheduleSelect(p.schedule_id, (v) => assign(v, [p.device_user_id])) : (p.schedule_id ? byId[p.schedule_id]?.name : 'Jadwal bawaan')}</div>
                  {sug && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Saran: {sug.name}</span>
                      {canEdit && <button onClick={() => assign(sug.id, [p.device_user_id])} className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">Pakai saran</button>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
              <span>Halaman {page} dari {pages} ({filtered.length} orang)</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50 dark:border-gray-600">Sebelumnya</button>
                <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50 dark:border-gray-600">Berikutnya</button>
              </div>
            </div>
          )}
        </div>
      )}

      {modal && (
        <Modal title={modal.id ? 'Ubah jadwal' : 'Jadwal baru'} onClose={() => setModal(null)}>
          <div className="space-y-4 p-4">
            <div>
              <label className={labelCls}>Nama jadwal</label>
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. Produksi Shift 1" />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Hari kerja</span>
                <button type="button" onClick={copyMonday} className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">Salin Senin ke Senin-Jumat</button>
              </div>
              <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr><th className={th}>Kerja</th><th className={th}>Hari</th><th className={th}>Masuk</th><th className={th}>Pulang</th><th className={th}>Istirahat (mnt)</th><th className={`${th} text-right`}>Jam bersih</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {form.days.map((d, i) => (
                      <tr key={i} className={d.work ? '' : 'opacity-60'}>
                        <td className="px-3 py-1.5"><input type="checkbox" checked={d.work} onChange={(e) => setDay(i, { work: e.target.checked })} /></td>
                        <td className="px-3 py-1.5 font-medium text-gray-900 dark:text-white">{DAYS[i]}</td>
                        <td className="px-2 py-1.5"><input type="time" disabled={!d.work} className={inputCls} value={d.start} onChange={(e) => setDay(i, { start: e.target.value })} /></td>
                        <td className="px-2 py-1.5"><input type="time" disabled={!d.work} className={inputCls} value={d.end} onChange={(e) => setDay(i, { end: e.target.value })} /></td>
                        <td className="w-28 px-2 py-1.5"><NumberInput disabled={!d.work} decimals={0} min="0" className={`${inputCls} text-right`} value={d.break} onChange={(e) => setDay(i, { break: e.target.value })} /></td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{d.work ? hm(netOf({ start: d.start, end: d.end, break: Number(d.break) || 0 })) : '-'}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-medium dark:bg-gray-900">
                      <td className="px-3 py-1.5" colSpan={5}>Total per minggu</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{hm(formWeek)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Toleransi terlambat (menit)</label>
                <NumberInput decimals={0} min="0" className={`${inputCls} text-right`} value={form.late} onChange={(e) => setForm({ ...form, late: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Toleransi pulang cepat (menit)</label>
                <NumberInput decimals={0} min="0" className={`${inputCls} text-right`} value={form.early} onChange={(e) => setForm({ ...form, early: e.target.value })} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Catatan</label>
              <textarea rows={2} className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
              <button type="button" onClick={() => setModal(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-200">Batal</button>
              <button type="button" onClick={save} disabled={saving} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60">{saving ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default AttendanceSchedules
