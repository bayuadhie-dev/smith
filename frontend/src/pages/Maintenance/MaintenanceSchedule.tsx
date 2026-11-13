import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import axiosInstance from '../../utils/axiosConfig'
import { PageHeader, KpiStrip } from '../../components/ui/PageKit'
import NumberInput from '../../components/ui/NumberInput'
import SearchableSelect from '../../components/SearchableSelect'
import { confirmDialog, showSuccess, showError } from '../../components/ui'
import { usePermissions } from '../../contexts/PermissionContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { Skeleton } from '../../components/ui/Skeleton'

interface SchedulePart { spare_part_id: number; part_number: string; part_name: string; uom: string; qty: number; current_stock: number }
interface Schedule {
  id: number; schedule_number: string; machine_id: number; machine_code: string; machine_name: string
  maintenance_type: string; frequency: string; frequency_value: number
  last_maintenance_date: string | null; next_maintenance_date: string | null
  days_until_due: number | null; overdue: boolean; estimated_duration_hours: number | null
  notes: string | null; parts: SchedulePart[]
}
interface Summary { total: number; overdue: number; due_7_days: number }
interface Machine { id: number; code: string; name: string }
interface PartOpt { id: number; part_number: string; part_name: string; uom: string }
interface FormPart { spare_part_id: number | null; qty: string }
interface Form {
  machine_ids: number[]; maintenance_type: string; frequency: string; frequency_value: string
  next_maintenance_date: string; estimated_duration_hours: string; notes: string; parts: FormPart[]
}

const TYPES = [
  { value: 'preventive', label: 'Preventive (pencegahan)' },
  { value: 'corrective', label: 'Corrective (perbaikan)' },
  { value: 'predictive', label: 'Predictive (prediksi)' },
]
const TYPE_LABEL: Record<string, string> = { preventive: 'Preventive', corrective: 'Corrective', predictive: 'Predictive' }
const FREQS = [
  { value: 'daily', label: 'Hari', unit: 'hari' },
  { value: 'weekly', label: 'Minggu', unit: 'minggu' },
  { value: 'monthly', label: 'Bulan', unit: 'bulan' },
  { value: 'quarterly', label: 'Triwulan (3 bulan)', unit: '3 bulan' },
  { value: 'yearly', label: 'Tahun', unit: 'tahun' },
]
const freqText = (f: string, v: number) => `tiap ${v} ${FREQS.find((x) => x.value === f)?.unit || f}`
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-')
const today = () => new Date().toISOString().slice(0, 10)

const emptyForm = (): Form => ({
  machine_ids: [], maintenance_type: 'preventive', frequency: 'monthly', frequency_value: '1',
  next_maintenance_date: today(), estimated_duration_hours: '', notes: '', parts: [],
})

const inputCls = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white'
const labelCls = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200'
const th = 'px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400'

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

const DueBadge = ({ s }: { s: Schedule }) => {
  if (s.days_until_due === null) return <span className="text-gray-400">-</span>
  if (s.overdue)
    return <span className="inline-flex rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">Lewat {Math.abs(s.days_until_due)} hari</span>
  if (s.days_until_due <= 7)
    return <span className="inline-flex rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{s.days_until_due === 0 ? 'Hari ini' : `${s.days_until_due} hari lagi`}</span>
  return <span className="text-xs text-gray-500 dark:text-gray-400">{s.days_until_due} hari lagi</span>
}

const MaintenanceSchedule = () => {
  useDocumentTitle('Jadwal Perawatan')
  const { hasPermission, isSuperAdmin } = usePermissions()
  const canSchedule = isSuperAdmin || hasPermission('maintenance.schedule')

  const [rows, setRows] = useState<Schedule[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [machines, setMachines] = useState<Machine[]>([])
  const [partOpts, setPartOpts] = useState<PartOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [machineFilter, setMachineFilter] = useState<number | null>(null)
  const [onlyOverdue, setOnlyOverdue] = useState(false)

  const [dialog, setDialog] = useState<null | { editId: number | null }>(null)
  const [form, setForm] = useState<Form>(emptyForm())
  const [machineSearch, setMachineSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    axiosInstance
      .get('/api/maintenance/schedules', { params: { machine_id: machineFilter || undefined, overdue: onlyOverdue ? 1 : undefined } })
      .then((r) => { setRows(r.data.schedules || []); setSummary(r.data.summary || null) })
      .catch(() => { setRows([]); showError('Jadwal gagal dimuat.') })
      .finally(() => setLoading(false))
  }, [machineFilter, onlyOverdue])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    axiosInstance.get('/api/production/machines').then((r) => setMachines(r.data.machines || [])).catch(() => setMachines([]))
    axiosInstance.get('/api/spare-parts', { params: { per_page: 200 } }).then((r) => setPartOpts(r.data.spare_parts || [])).catch(() => setPartOpts([]))
  }, [])

  const openNew = () => { setForm(emptyForm()); setMachineSearch(''); setDialog({ editId: null }) }
  const openEdit = (s: Schedule) => {
    setForm({
      machine_ids: [s.machine_id], maintenance_type: s.maintenance_type, frequency: s.frequency,
      frequency_value: String(s.frequency_value), next_maintenance_date: s.next_maintenance_date || today(),
      estimated_duration_hours: s.estimated_duration_hours != null ? String(s.estimated_duration_hours) : '',
      notes: s.notes || '', parts: s.parts.map((p) => ({ spare_part_id: p.spare_part_id, qty: String(p.qty) })),
    })
    setMachineSearch('')
    setDialog({ editId: s.id })
  }

  const filteredMachines = useMemo(() => {
    const q = machineSearch.trim().toLowerCase()
    return q ? machines.filter((m) => `${m.code} ${m.name}`.toLowerCase().includes(q)) : machines
  }, [machines, machineSearch])

  const toggleMachine = (id: number) =>
    setForm((f) => ({ ...f, machine_ids: f.machine_ids.includes(id) ? f.machine_ids.filter((x) => x !== id) : [...f.machine_ids, id] }))

  const setPart = (i: number, patch: Partial<FormPart>) =>
    setForm((f) => ({ ...f, parts: f.parts.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) }))

  const save = async () => {
    if (form.machine_ids.length === 0) { showError('Pilih minimal satu mesin.'); return }
    if (!form.next_maintenance_date) { showError('Tanggal perawatan berikutnya wajib diisi.'); return }
    if (!(Number(form.frequency_value) >= 1)) { showError('Interval minimal 1.'); return }
    if (form.parts.some((p) => !p.spare_part_id || !(Number(p.qty) > 0))) { showError('Setiap baris sparepart harus dipilih dan jumlahnya lebih dari 0.'); return }
    const body: Record<string, unknown> = {
      maintenance_type: form.maintenance_type, frequency: form.frequency, frequency_value: Number(form.frequency_value),
      next_maintenance_date: form.next_maintenance_date,
      estimated_duration_hours: form.estimated_duration_hours === '' ? null : Number(form.estimated_duration_hours),
      notes: form.notes, parts: form.parts.map((p) => ({ spare_part_id: p.spare_part_id, qty: Number(p.qty) })),
    }
    setSaving(true)
    try {
      if (dialog?.editId) {
        await axiosInstance.put(`/api/maintenance/schedules/${dialog.editId}`, body)
        showSuccess('Jadwal diperbarui.')
      } else if (form.machine_ids.length > 1) {
        const r = await axiosInstance.post('/api/maintenance/schedules/bulk', { ...body, machine_ids: form.machine_ids })
        showSuccess(r.data?.message || 'Jadwal dibuat.')
      } else {
        await axiosInstance.post('/api/maintenance/schedules', { ...body, machine_id: form.machine_ids[0] })
        showSuccess('Jadwal dibuat.')
      }
      setDialog(null)
      load()
    } catch (e: any) {
      showError(e.response?.data?.error || 'Jadwal gagal disimpan.')
    } finally {
      setSaving(false)
    }
  }

  const generate = async (s: Schedule) => {
    const ok = await confirmDialog(`Buat perintah kerja perawatan untuk ${s.machine_name} sekarang?\n\nTanggal jadwal berikutnya akan maju sesuai interval, dan permintaan sparepart dibuat otomatis bila jadwal ini punya daftar sparepart.`)
    if (!ok) return
    try {
      await axiosInstance.post(`/api/maintenance/schedules/${s.id}/generate`)
      showSuccess('Perintah kerja dibuat.')
      load()
    } catch (e: any) {
      showError(e.response?.data?.error || 'Perintah kerja gagal dibuat.')
    }
  }

  const deactivate = async (s: Schedule) => {
    const ok = await confirmDialog(`Nonaktifkan jadwal ${s.schedule_number} untuk ${s.machine_name}?\n\nJadwal tidak lagi dihitung, riwayat perawatan tetap ada.`)
    if (!ok) return
    try {
      await axiosInstance.delete(`/api/maintenance/schedules/${s.id}`)
      showSuccess('Jadwal dinonaktifkan.')
      load()
    } catch (e: any) {
      showError(e.response?.data?.error || 'Jadwal gagal dinonaktifkan.')
    }
  }

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Jadwal Perawatan"
        subtitle="Jadwal preventive per mesin beserta sparepart yang dibutuhkan"
        actions={canSchedule ? (
          <button onClick={openNew} className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">Jadwal baru</button>
        ) : undefined}
      />

      <KpiStrip
        items={[
          { label: 'Jadwal aktif', value: (summary?.total || 0).toLocaleString('id-ID') },
          { label: 'Lewat tanggal', value: (summary?.overdue || 0).toLocaleString('id-ID'), tone: summary?.overdue ? 'bad' : null, hint: 'perlu dibuatkan perintah kerja' },
          { label: 'Jatuh tempo 7 hari', value: (summary?.due_7_days || 0).toLocaleString('id-ID'), tone: summary?.due_7_days ? 'warn' : null },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="w-full sm:w-72">
          <SearchableSelect
            options={machines.map((m) => ({ id: m.id, code: m.code, name: m.name }))}
            value={machineFilter}
            onChange={(v) => setMachineFilter(v ? Number(v) : null)}
            placeholder="Semua mesin"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} />
          Hanya yang lewat tanggal
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className={th}>Mesin</th>
              <th className={th}>Jenis</th>
              <th className={th}>Frekuensi</th>
              <th className={th}>Terakhir</th>
              <th className={th}>Berikutnya</th>
              <th className={th}>Sparepart dibutuhkan</th>
              {canSchedule && <th className={`${th} text-right`}>Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-4"><div className="space-y-2" role="status" aria-label="Memuat data">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-5 w-full" />)}</div></td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">{machineFilter || onlyOverdue ? 'Tidak ada jadwal yang cocok.' : 'Belum ada jadwal perawatan.'}</td></tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="align-top hover:bg-gray-50 dark:hover:bg-gray-700/40">
                <td className="px-4 py-2.5 text-sm">
                  <div className="font-medium text-gray-900 dark:text-white">{s.machine_name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{s.machine_code} · {s.schedule_number}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200">{TYPE_LABEL[s.maintenance_type] || s.maintenance_type}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200">{freqText(s.frequency, s.frequency_value)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{fmtDate(s.last_maintenance_date)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm">
                  <div className="text-gray-800 dark:text-gray-200">{fmtDate(s.next_maintenance_date)}</div>
                  <DueBadge s={s} />
                </td>
                <td className="px-4 py-2.5 text-sm">
                  {s.parts.length === 0 ? <span className="text-gray-400">-</span> : (
                    <ul className="space-y-1">
                      {s.parts.map((p) => (
                        <li key={p.spare_part_id} className="flex flex-wrap items-center gap-2 text-gray-700 dark:text-gray-200">
                          <span>{p.part_name} × {p.qty.toLocaleString('id-ID')} {p.uom}</span>
                          {p.current_stock < p.qty && (
                            <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">Stok kurang ({p.current_stock.toLocaleString('id-ID')})</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                {canSchedule && (
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm">
                    <div className="flex justify-end gap-3">
                      <button onClick={() => generate(s)} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">Buat perintah kerja</button>
                      <button onClick={() => openEdit(s)} className="text-gray-700 hover:underline dark:text-gray-200">Ubah</button>
                      <button onClick={() => deactivate(s)} className="text-red-600 hover:underline dark:text-red-400">Nonaktifkan</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialog && (
        <Modal title={dialog.editId ? 'Ubah jadwal' : 'Jadwal baru'} onClose={() => setDialog(null)}>
          <div className="space-y-4 p-4">
            <div>
              <label className={labelCls}>
                {dialog.editId ? 'Mesin' : `Mesin (${form.machine_ids.length} dipilih)`}
              </label>
              {dialog.editId ? (
                <p className="text-sm text-gray-800 dark:text-gray-200">{machines.find((m) => m.id === form.machine_ids[0]) ? `${machines.find((m) => m.id === form.machine_ids[0])!.code} - ${machines.find((m) => m.id === form.machine_ids[0])!.name}` : '-'}</p>
              ) : (
                <>
                  <div className="relative mb-2">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input className={`${inputCls} pl-9`} placeholder="Cari mesin" value={machineSearch} onChange={(e) => setMachineSearch(e.target.value)} />
                  </div>
                  <div className="max-h-44 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700">
                    {filteredMachines.length === 0 && <p className="p-3 text-sm text-gray-500 dark:text-gray-400">Mesin tidak ditemukan.</p>}
                    {filteredMachines.map((m) => (
                      <label key={m.id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/40">
                        <input type="checkbox" checked={form.machine_ids.includes(m.id)} onChange={() => toggleMachine(m.id)} />
                        <span className="text-gray-900 dark:text-white">{m.code}</span>
                        <span className="text-gray-600 dark:text-gray-300">{m.name}</span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Bila memilih lebih dari satu mesin, satu jadwal dibuat untuk tiap mesin dengan pengaturan yang sama.</p>
                </>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Jenis perawatan</label>
                <select className={inputCls} value={form.maintenance_type} onChange={(e) => setForm({ ...form, maintenance_type: e.target.value })}>
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Tanggal berikutnya</label>
                <input type="date" className={inputCls} value={form.next_maintenance_date} onChange={(e) => setForm({ ...form, next_maintenance_date: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Ulangi setiap</label>
                <div className="flex gap-2">
                  <NumberInput className={`${inputCls} !w-24`} value={form.frequency_value} onChange={(e) => setForm({ ...form, frequency_value: e.target.value })} />
                  <select className={inputCls} value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                    {FREQS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Estimasi durasi (jam)</label>
                <NumberInput className={inputCls} value={form.estimated_duration_hours} onChange={(e) => setForm({ ...form, estimated_duration_hours: e.target.value })} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Sparepart yang dibutuhkan</label>
              <div className="space-y-2">
                {form.parts.map((p, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <SearchableSelect
                        options={partOpts.map((o) => ({ id: o.id, code: o.part_number, name: o.part_name }))}
                        value={p.spare_part_id}
                        onChange={(v) => setPart(i, { spare_part_id: v ? Number(v) : null })}
                        placeholder="Pilih sparepart"
                      />
                    </div>
                    <NumberInput className={`${inputCls} !w-24 text-right`} placeholder="Jumlah" value={p.qty} onChange={(e) => setPart(i, { qty: e.target.value })} />
                    <button type="button" className="px-2 py-2 text-sm text-gray-400 hover:text-red-600" onClick={() => setForm({ ...form, parts: form.parts.filter((_, idx) => idx !== i) })}>Hapus</button>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-2 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400" onClick={() => setForm({ ...form, parts: [...form.parts, { spare_part_id: null, qty: '1' }] })}>
                + Tambah sparepart
              </button>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Saat perintah kerja dibuat dari jadwal ini, permintaan sparepart dibuat otomatis untuk disetujui kepala maintenance.</p>
            </div>

            <div>
              <label className={labelCls}>Catatan</label>
              <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
            <button type="button" onClick={() => setDialog(null)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-200">Batal</button>
            <button type="button" disabled={saving} onClick={save} className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
              {saving ? 'Menyimpan...' : dialog.editId ? 'Simpan perubahan' : form.machine_ids.length > 1 ? `Buat ${form.machine_ids.length} jadwal` : 'Buat jadwal'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default MaintenanceSchedule
