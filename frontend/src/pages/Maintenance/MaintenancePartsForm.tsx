import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import SearchableSelect from '../../components/SearchableSelect'
import NumberInput from '../../components/ui/NumberInput'
import { PageHeader, Panel } from '../../components/ui/PageKit'
import { showError, showSuccess } from '../../components/ui'

interface PartOption { id: number; code: string; name: string; uom: string; stock: number }
interface MachineOption { id: number; code: string; name: string }
interface Line { spare_part_id: number | null; qty: string; notes: string }

const inputCls = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white'
const labelCls = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200'

const MaintenancePartsForm = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const [parts, setParts] = useState<PartOption[]>([])
  const [machines, setMachines] = useState<MachineOption[]>([])
  const [machineId, setMachineId] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([{ spare_part_id: null, qty: '', notes: '' }])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Permintaan tidak bisa diedit; hanya dibatalkan dari daftar.
    if (id) navigate('/app/maintenance/spare-part-requests', { replace: true })
  }, [id, navigate])

  useEffect(() => {
    axiosInstance.get('/api/spare-parts', { params: { per_page: 200 } })
      .then((res) => setParts((res.data.spare_parts || []).map((p: any) => ({ id: p.id, code: p.part_number, name: p.part_name, uom: p.uom, stock: p.current_stock }))))
      .catch((e) => showError(e.response?.data?.error || 'Daftar sparepart gagal dimuat.'))
    axiosInstance.get('/api/production/machines')
      .then((res) => setMachines((res.data.machines || []).map((m: any) => ({ id: m.id, code: m.code, name: m.name }))))
      .catch(() => setMachines([]))
  }, [])

  const partOf = (pid: number | null) => parts.find((p) => p.id === pid)
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const items = lines.filter((l) => l.spare_part_id || Number(l.qty))
    if (items.length === 0) { showError('Pilih minimal satu sparepart.'); return }
    if (items.some((l) => !l.spare_part_id || !(Number(l.qty) > 0))) { showError('Setiap baris harus punya sparepart dan jumlah lebih dari 0.'); return }
    const ids = items.map((l) => l.spare_part_id)
    if (new Set(ids).size !== ids.length) { showError('Satu sparepart tidak boleh dipilih dua kali.'); return }
    setSaving(true)
    try {
      const res = await axiosInstance.post('/api/spare-parts/requests', {
        machine_id: machineId || undefined,
        notes: notes.trim() || undefined,
        items: items.map((l) => ({ spare_part_id: l.spare_part_id, qty_requested: Number(l.qty), notes: l.notes || undefined })),
      })
      showSuccess(`Permintaan ${res.data.request_number} dibuat.`)
      navigate('/app/maintenance/spare-part-requests')
    } catch (err: any) {
      showError(err.response?.data?.error || 'Gagal menyimpan permintaan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Permintaan Sparepart Baru"
        subtitle="Setelah dikirim, permintaan menunggu persetujuan kepala maintenance. Permintaan tidak bisa diedit, hanya dibatalkan."
        actions={<button type="button" onClick={() => navigate('/app/maintenance/spare-part-requests')} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">Batal</button>}
      />
      <form onSubmit={submit} className="space-y-4">
        <Panel title="Keterangan">
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Mesin (opsional)</label>
              <SearchableSelect options={machines} value={machineId} onChange={(v) => setMachineId(v ? Number(v) : null)} placeholder="Cari kode atau nama mesin" />
            </div>
            <div>
              <label className={labelCls}>Catatan</label>
              <input type="text" className={inputCls} placeholder="Keperluan, nomor SPK, dll (opsional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </Panel>

        <Panel title="Sparepart yang diminta">
          <div className="space-y-3 p-4">
            {lines.map((l, i) => {
              const p = partOf(l.spare_part_id)
              const short = p && Number(l.qty) > p.stock
              return (
                <div key={i} className="grid grid-cols-12 items-start gap-2">
                  <div className="col-span-12 md:col-span-6">
                    <SearchableSelect options={parts} value={l.spare_part_id} onChange={(v) => setLine(i, { spare_part_id: v ? Number(v) : null })} placeholder="Cari kode atau nama sparepart" />
                    {p && <p className={`mt-1 text-xs ${short ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>Stok tersedia {p.stock.toLocaleString('id-ID')} {p.uom}{short ? '. Jumlah melebihi stok.' : ''}</p>}
                  </div>
                  <div className="col-span-5 md:col-span-2">
                    <NumberInput className={`${inputCls} text-right`} placeholder="Jumlah" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
                  </div>
                  <input type="text" className={`${inputCls} col-span-6 md:col-span-3`} placeholder="Keterangan (opsional)" value={l.notes} onChange={(e) => setLine(i, { notes: e.target.value })} />
                  <button type="button" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="col-span-1 pt-2 text-sm text-gray-400 hover:text-red-600 disabled:opacity-30" title="Hapus baris">Hapus</button>
                </div>
              )
            })}
            <button type="button" onClick={() => setLines((ls) => [...ls, { spare_part_id: null, qty: '', notes: '' }])} className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">+ Tambah baris</button>
          </div>
        </Panel>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => navigate('/app/maintenance/spare-part-requests')} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-200">Batal</button>
          <button type="submit" disabled={saving} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">{saving ? 'Mengirim...' : 'Kirim permintaan'}</button>
        </div>
      </form>
    </div>
  )
}

export default MaintenancePartsForm
