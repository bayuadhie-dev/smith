import { useCallback, useEffect, useState } from 'react'
import axiosInstance from '../../utils/axiosConfig'
import SearchableSelect from '../SearchableSelect'
import AccessibleModal from '../ui/AccessibleModal'
import { confirmDialog, showError, showSuccess } from '../ui'
import { Panel } from '../ui/PageKit'

interface MachinePart {
  link_id: number
  spare_part_id: number
  part_number: string
  part_name: string
  uom: string
  qty_installed: number
  replace_interval_days: number | null
  last_replaced_date: string | null
  notes: string | null
  current_stock: number
  needs_reorder: boolean
}

interface PartOption { id: number; code: string; name: string }

interface FormState { spare_part_id: number | null; qty_installed: string; replace_interval_days: string; last_replaced_date: string; notes: string }

const emptyForm: FormState = { spare_part_id: null, qty_installed: '1', replace_interval_days: '', last_replaced_date: '', notes: '' }

const inputCls = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white'
const labelCls = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200'
const th = 'px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400'

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-')
const fmtNum = (n: number) => n.toLocaleString('id-ID')

const MachinePartsPanel = ({ machineId }: { machineId: number | string }) => {
  const [parts, setParts] = useState<MachinePart[]>([])
  const [loading, setLoading] = useState(true)
  const [options, setOptions] = useState<PartOption[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MachinePart | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await axiosInstance.get(`/api/spare-parts/machines/${machineId}`)
      setParts(res.data.parts || [])
    } catch (e: any) {
      setParts([])
      showError(e.response?.data?.error || 'Daftar sparepart gagal dimuat.')
    } finally {
      setLoading(false)
    }
  }, [machineId])

  useEffect(() => { load() }, [load])

  const openAdd = async () => {
    setEditing(null)
    setForm(emptyForm)
    setOpen(true)
    if (options.length === 0) {
      try {
        const res = await axiosInstance.get('/api/spare-parts', { params: { per_page: 200 } })
        setOptions((res.data.spare_parts || []).map((p: any) => ({ id: p.id, code: p.part_number, name: p.part_name })))
      } catch (e: any) {
        showError(e.response?.data?.error || 'Daftar sparepart gagal dimuat.')
      }
    }
  }

  const openEdit = (p: MachinePart) => {
    setEditing(p)
    setForm({
      spare_part_id: p.spare_part_id,
      qty_installed: String(p.qty_installed),
      replace_interval_days: p.replace_interval_days ? String(p.replace_interval_days) : '',
      last_replaced_date: p.last_replaced_date || '',
      notes: p.notes || '',
    })
    setOpen(true)
  }

  const save = async () => {
    if (!editing && !form.spare_part_id) { showError('Pilih sparepart dulu.'); return }
    if (!(Number(form.qty_installed) > 0)) { showError('Jumlah terpasang harus lebih dari 0.'); return }
    setSaving(true)
    try {
      if (editing) {
        await axiosInstance.put(`/api/spare-parts/machine-links/${editing.link_id}`, {
          qty_installed: form.qty_installed,
          replace_interval_days: form.replace_interval_days || null,
          last_replaced_date: form.last_replaced_date || null,
          notes: form.notes,
        })
        showSuccess('Sparepart diperbarui.')
      } else {
        await axiosInstance.post(`/api/spare-parts/machines/${machineId}`, {
          spare_part_id: form.spare_part_id,
          qty_installed: form.qty_installed,
          replace_interval_days: form.replace_interval_days || null,
          notes: form.notes,
        })
        showSuccess('Sparepart ditambahkan ke mesin.')
      }
      setOpen(false)
      load()
    } catch (e: any) {
      showError(e.response?.data?.error || 'Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (p: MachinePart) => {
    if (!(await confirmDialog(`Hapus ${p.part_number} - ${p.part_name} dari daftar mesin ini? Stok sparepart tidak berubah.`))) return
    try {
      await axiosInstance.delete(`/api/spare-parts/machine-links/${p.link_id}`)
      showSuccess('Dihapus dari daftar mesin.')
      load()
    } catch (e: any) {
      showError(e.response?.data?.error || 'Gagal menghapus.')
    }
  }

  const chosen = options.filter((o) => !parts.some((p) => p.spare_part_id === o.id))

  return (
    <>
      <Panel
        title="Sparepart mesin ini"
        action={
          <button type="button" onClick={openAdd} className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800">
            Tambah sparepart
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className={th}>Kode</th>
                <th className={th}>Nama</th>
                <th className={`${th} text-right`}>Terpasang</th>
                <th className={`${th} text-right`}>Interval ganti</th>
                <th className={th}>Terakhir diganti</th>
                <th className={`${th} text-right`}>Stok</th>
                <th className={`${th} text-right`}>Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">Memuat...</td></tr>}
              {!loading && parts.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">Belum ada sparepart yang didaftarkan untuk mesin ini.</td></tr>
              )}
              {parts.map((p) => (
                <tr key={p.link_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white">{p.part_number}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200">{p.part_name}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">{fmtNum(p.qty_installed)} {p.uom}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-gray-600 dark:text-gray-300">{p.replace_interval_days ? `${fmtNum(p.replace_interval_days)} hari` : '-'}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{fmtDate(p.last_replaced_date)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums">
                    <span className={p.needs_reorder ? 'font-medium text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}>{fmtNum(p.current_stock)} {p.uom}</span>
                    {p.needs_reorder && <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">Perlu dipesan</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm">
                    <button type="button" onClick={() => openEdit(p)} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">Ubah</button>
                    <button type="button" onClick={() => remove(p)} className="ml-4 font-medium text-red-600 hover:underline dark:text-red-400">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <AccessibleModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Ubah sparepart mesin' : 'Tambah sparepart ke mesin'}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-200">Batal</button>
            <button type="button" onClick={save} disabled={saving} className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Sparepart</label>
            {editing ? (
              <p className="text-sm text-gray-800 dark:text-gray-200">{editing.part_number} - {editing.part_name}</p>
            ) : (
              <SearchableSelect
                options={chosen}
                value={form.spare_part_id}
                onChange={(v) => setForm({ ...form, spare_part_id: v ? Number(v) : null })}
                placeholder="Cari kode atau nama sparepart"
              />
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Jumlah terpasang</label>
              <input type="number" min="0" step="any" className={inputCls} value={form.qty_installed} onChange={(e) => setForm({ ...form, qty_installed: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Interval ganti (hari)</label>
              <input type="number" min="0" className={inputCls} placeholder="Opsional" value={form.replace_interval_days} onChange={(e) => setForm({ ...form, replace_interval_days: e.target.value })} />
            </div>
          </div>
          {editing && (
            <div>
              <label className={labelCls}>Terakhir diganti</label>
              <input type="date" className={inputCls} value={form.last_replaced_date} onChange={(e) => setForm({ ...form, last_replaced_date: e.target.value })} />
            </div>
          )}
          <div>
            <label className={labelCls}>Catatan</label>
            <textarea rows={2} className={inputCls} placeholder="Opsional" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </AccessibleModal>
    </>
  )
}

export default MachinePartsPanel
