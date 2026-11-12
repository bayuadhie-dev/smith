import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import axiosInstance from '../../utils/axiosConfig'
import { formatRupiah } from '../../utils/currencyUtils'
import { PageHeader, KpiStrip } from '../../components/ui/PageKit'
import NumberInput from '../../components/ui/NumberInput'
import SearchableSelect from '../../components/SearchableSelect'
import { showSuccess, showError } from '../../components/ui'
import { usePermissions } from '../../contexts/PermissionContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

interface Part {
  id: number
  part_number: string
  part_name: string
  category: string | null
  description: string | null
  uom: string
  current_stock: number
  min_stock: number
  max_stock: number | null
  unit_cost: number | null
  primary_supplier_id: number | null
  warehouse_location: string | null
  needs_reorder: boolean
  out_of_stock: boolean
  stock_value: number
  machines_count: number
}

interface Summary { total: number; low_stock: number; out_of_stock: number; stock_value: number }

type PartForm = {
  part_number: string; part_name: string; category: string; uom: string
  min_stock: string; max_stock: string; unit_cost: string
  primary_supplier_id: number | null; warehouse_location: string; opening_stock: string
}

const emptyForm: PartForm = {
  part_number: '', part_name: '', category: '', uom: 'pcs', min_stock: '', max_stock: '', unit_cost: '',
  primary_supplier_id: null, warehouse_location: '', opening_stock: '',
}

const MOVEMENTS = [
  { value: 'in', label: 'Masuk' },
  { value: 'out', label: 'Keluar' },
  { value: 'adjustment', label: 'Penyesuaian (hitung fisik)' },
  { value: 'return', label: 'Retur' },
]

const inputCls = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white'
const labelCls = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200'
const th = 'px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400'
const fmtNum = (n: number) => n.toLocaleString('id-ID')

const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
        <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 dark:text-gray-400">Tutup</button>
      </div>
      {children}
    </div>
  </div>
)

const SparePartStock = () => {
  useDocumentTitle('Gudang Sparepart')
  const { hasPermission, isSuperAdmin } = usePermissions()
  const canCreate = isSuperAdmin || hasPermission('maintenance.create')
  const canEdit = isSuperAdmin || hasPermission('maintenance.edit')

  const [parts, setParts] = useState<Part[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [category, setCategory] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([])

  const [editing, setEditing] = useState<Part | 'new' | null>(null)
  const [form, setForm] = useState<PartForm>(emptyForm)
  const [moving, setMoving] = useState<Part | null>(null)
  const [mv, setMv] = useState({ movement_type: 'in', quantity: '', unit_cost: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(() => {
    setLoading(true)
    axiosInstance
      .get('/api/spare-parts', { params: { page, per_page: 20, search: debounced || undefined, category: category || undefined, low_stock: lowOnly ? 1 : undefined } })
      .then((r) => {
        setParts(r.data.spare_parts || [])
        setPages(r.data.pages || 1)
        setSummary(r.data.summary || null)
        setCategories(r.data.categories || [])
      })
      .catch(() => { setParts([]); showError('Data sparepart gagal dimuat.') })
      .finally(() => setLoading(false))
  }, [page, debounced, category, lowOnly])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    axiosInstance.get('/api/purchasing/suppliers').then((res) => {
      const list = res.data.suppliers || res.data || []
      setSuppliers(list.map((p: any) => ({ id: p.id, name: p.company_name || p.name || `#${p.id}` })))
    }).catch(() => setSuppliers([]))
  }, [])

  const openNew = () => { setForm(emptyForm); setEditing('new') }
  const openEdit = (p: Part) => {
    setForm({
      part_number: p.part_number, part_name: p.part_name, category: p.category || '', uom: p.uom,
      min_stock: String(p.min_stock ?? ''), max_stock: p.max_stock == null ? '' : String(p.max_stock),
      unit_cost: p.unit_cost == null ? '' : String(p.unit_cost), primary_supplier_id: p.primary_supplier_id,
      warehouse_location: p.warehouse_location || '', opening_stock: '',
    })
    setEditing(p)
  }

  const savePart = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const body: Record<string, any> = {
      part_number: form.part_number.trim(), part_name: form.part_name.trim(), category: form.category.trim(), uom: form.uom.trim(),
      min_stock: form.min_stock || 0, max_stock: form.max_stock || null, unit_cost: form.unit_cost || null,
      primary_supplier_id: form.primary_supplier_id, warehouse_location: form.warehouse_location.trim(),
    }
    try {
      if (editing === 'new') {
        if (form.opening_stock) body.opening_stock = form.opening_stock
        await axiosInstance.post('/api/spare-parts', body)
        showSuccess('Sparepart dibuat.')
      } else if (editing) {
        await axiosInstance.put(`/api/spare-parts/${editing.id}`, body)
        showSuccess('Sparepart diperbarui.')
      }
      setEditing(null)
      load()
    } catch (err: any) {
      showError(err.response?.data?.error || 'Gagal menyimpan sparepart.')
    } finally {
      setSaving(false)
    }
  }

  const openMove = (p: Part) => { setMv({ movement_type: 'in', quantity: '', unit_cost: '', notes: '' }); setMoving(p) }

  const saveMove = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!moving) return
    setSaving(true)
    try {
      await axiosInstance.post(`/api/spare-parts/${moving.id}/movements`, {
        movement_type: mv.movement_type, quantity: mv.quantity, unit_cost: mv.unit_cost || undefined, notes: mv.notes.trim() || undefined,
      })
      showSuccess('Mutasi dicatat.')
      setMoving(null)
      load()
    } catch (err: any) {
      showError(err.response?.data?.error || 'Gagal mencatat mutasi.')
    } finally {
      setSaving(false)
    }
  }

  const set = (k: keyof PartForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Gudang Sparepart"
        subtitle="Stok sparepart perawatan mesin, terpisah dari gudang utama"
        actions={canCreate ? <button onClick={openNew} className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">Sparepart baru</button> : undefined}
      />

      <KpiStrip
        items={[
          { label: 'Jenis sparepart', value: fmtNum(summary?.total || 0) },
          { label: 'Stok menipis', value: fmtNum(summary?.low_stock || 0), tone: summary?.low_stock ? 'warn' : null, hint: 'di bawah atau sama dengan minimum' },
          { label: 'Stok habis', value: fmtNum(summary?.out_of_stock || 0), tone: summary?.out_of_stock ? 'bad' : null },
          { label: 'Nilai stok', value: formatRupiah(summary?.stock_value || 0), hint: 'stok × harga satuan' },
        ]}
      />

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kode atau nama sparepart" className={`${inputCls} pl-9`} />
        </div>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} className={`${inputCls} md:w-48`}>
          <option value="">Semua kategori</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <input type="checkbox" checked={lowOnly} onChange={(e) => { setLowOnly(e.target.checked); setPage(1) }} />
          Hanya stok menipis
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className={th}>Kode</th>
              <th className={th}>Nama</th>
              <th className={th}>Kategori</th>
              <th className={`${th} text-right`}>Stok</th>
              <th className={`${th} text-right`}>Minimum</th>
              <th className={`${th} text-right`}>Nilai</th>
              <th className={`${th} text-right`}>Mesin</th>
              <th className={th}>Status</th>
              <th className={`${th} text-right`}>Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && parts.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Memuat...</td></tr>}
            {!loading && parts.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">{search || category || lowOnly ? 'Tidak ada sparepart yang cocok.' : 'Belum ada sparepart.'}</td></tr>
            )}
            {parts.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium">
                  <Link to={`/app/maintenance/spare-parts/${p.id}`} className="text-emerald-700 hover:underline dark:text-emerald-400">{p.part_number}</Link>
                </td>
                <td className="px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200">{p.part_name}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{p.category || '-'}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-medium tabular-nums text-gray-900 dark:text-white">{fmtNum(p.current_stock)} {p.uom}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-gray-600 dark:text-gray-300">{fmtNum(p.min_stock)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-gray-800 dark:text-gray-200">{formatRupiah(p.stock_value)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-gray-600 dark:text-gray-300">{p.machines_count}</td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  {p.out_of_stock ? (
                    <span className="inline-flex rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">Habis</span>
                  ) : p.needs_reorder ? (
                    <span className="inline-flex rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Perlu pesan ulang</span>
                  ) : (
                    <span className="text-xs text-gray-400">Aman</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm">
                  <div className="flex justify-end gap-3">
                    {canEdit && <button onClick={() => openMove(p)} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">Mutasi</button>}
                    {canEdit && <button onClick={() => openEdit(p)} className="text-gray-600 hover:underline dark:text-gray-300">Ubah</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
          <span>Halaman {page} dari {pages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50 dark:border-gray-600">Sebelumnya</button>
            <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-50 dark:border-gray-600">Berikutnya</button>
          </div>
        </div>
      )}

      {editing && (
        <Modal title={editing === 'new' ? 'Sparepart baru' : 'Ubah sparepart'} onClose={() => setEditing(null)}>
          <form onSubmit={savePart} className="space-y-4 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className={labelCls}>Kode</label><input className={inputCls} value={form.part_number} onChange={set('part_number')} required /></div>
              <div><label className={labelCls}>Satuan</label><input className={inputCls} value={form.uom} onChange={set('uom')} placeholder="pcs, set, meter" required /></div>
              <div className="md:col-span-2"><label className={labelCls}>Nama</label><input className={inputCls} value={form.part_name} onChange={set('part_name')} required /></div>
              <div><label className={labelCls}>Kategori</label><input className={inputCls} value={form.category} onChange={set('category')} placeholder="mekanik, elektrik, hidrolik" list="sp-categories" /><datalist id="sp-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist></div>
              <div><label className={labelCls}>Lokasi rak</label><input className={inputCls} value={form.warehouse_location} onChange={set('warehouse_location')} /></div>
              <div><label className={labelCls}>Stok minimum</label><NumberInput className={`${inputCls} text-right`} value={form.min_stock} onChange={set('min_stock')} /></div>
              <div><label className={labelCls}>Stok maksimum</label><NumberInput className={`${inputCls} text-right`} value={form.max_stock} onChange={set('max_stock')} /></div>
              <div><label className={labelCls}>Harga satuan</label><NumberInput currency className={`${inputCls} text-right`} value={form.unit_cost} onChange={set('unit_cost')} /></div>
              {editing === 'new' && (
                <div><label className={labelCls}>Stok awal</label><NumberInput className={`${inputCls} text-right`} value={form.opening_stock} onChange={set('opening_stock')} /></div>
              )}
              <div className="md:col-span-2">
                <label className={labelCls}>Pemasok utama (opsional)</label>
                <SearchableSelect options={suppliers} value={form.primary_supplier_id} onChange={(v) => setForm((f) => ({ ...f, primary_supplier_id: v ? Number(v) : null }))} placeholder="Pilih pemasok" />
              </div>
            </div>
            {editing !== 'new' && <p className="text-xs text-gray-500 dark:text-gray-400">Stok tidak diubah dari sini. Gunakan tombol Mutasi.</p>}
            <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
              <button type="button" onClick={() => setEditing(null)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-200">Batal</button>
              <button type="submit" disabled={saving} className="rounded-md bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </form>
        </Modal>
      )}

      {moving && (
        <Modal title={`Mutasi stok: ${moving.part_number}`} onClose={() => setMoving(null)}>
          <form onSubmit={saveMove} className="space-y-4 p-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">{moving.part_name}. Stok sekarang <span className="font-semibold">{fmtNum(moving.current_stock)} {moving.uom}</span>.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Jenis mutasi</label>
                <select className={inputCls} value={mv.movement_type} onChange={(e) => setMv((m) => ({ ...m, movement_type: e.target.value }))}>
                  {MOVEMENTS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>{mv.movement_type === 'adjustment' ? 'Hasil hitung fisik' : 'Jumlah'}</label>
                <NumberInput className={`${inputCls} text-right`} value={mv.quantity} onChange={(e) => setMv((m) => ({ ...m, quantity: e.target.value }))} required />
              </div>
              {mv.movement_type === 'in' && (
                <div><label className={labelCls}>Harga satuan (opsional)</label><NumberInput currency className={`${inputCls} text-right`} value={mv.unit_cost} onChange={(e) => setMv((m) => ({ ...m, unit_cost: e.target.value }))} /></div>
              )}
              <div className="md:col-span-2"><label className={labelCls}>Catatan</label><input className={inputCls} value={mv.notes} onChange={(e) => setMv((m) => ({ ...m, notes: e.target.value }))} placeholder="mis. nomor faktur pembelian atau alasan penyesuaian" /></div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
              <button type="button" onClick={() => setMoving(null)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-200">Batal</button>
              <button type="submit" disabled={saving} className="rounded-md bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">{saving ? 'Menyimpan...' : 'Catat mutasi'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default SparePartStock
