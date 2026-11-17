import React, { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { PlusIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import axiosInstance from '../../utils/axiosConfig'
import LoadingSpinner from '../../components/Common/LoadingSpinner'
import AccessibleModal from '../../components/ui/AccessibleModal'
import SearchableSelect from '../../components/SearchableSelect'
import NumberInput from '../../components/ui/NumberInput'
import { confirmDialog } from '../../components/ui/ConfirmDialog'
import { useListTools, type ListColumn } from '../../hooks/useListTools'
import { ListToolbar, SortTh } from '../../components/ui/ListTools'

interface Roll {
  id: number
  roll_number: number
  display_number: string
  cycle: number
  roll_type: string
  product_id: number
  product_code: string | null
  product_name: string | null
  machine_name: string | null
  work_order_number: string | null
  produced_at: string
  shift: string | null
  gross_weight_kg: number
  net_weight_kg: number
  length_m: number | null
  width_cm: number | null
  grade: string
  status: string
  notes: string | null
  created_by_name: string | null
  batch_number: string | null
  stock_remaining_kg?: number
}

const API = '/api/production/rolls'
const kg = (n: number | null | undefined) => `${Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg`
const tanggal = (s: string) => new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const GRADE_CLASS: Record<string, string> = {
  A: 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  B: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  C: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}
const STATUS_LABEL: Record<string, string> = {
  available: 'Di stok', consumed: 'Terpakai', shipped: 'Terkirim', cancelled: 'Dibatalkan',
}

const COLUMNS: ListColumn<Roll>[] = [
  { key: 'display_number', label: 'No. Roll', value: (r) => r.display_number },
  { key: 'produced_at', label: 'Tanggal', type: 'date', value: (r) => r.produced_at },
  { key: 'product', label: 'Jenis Kain', value: (r) => [r.product_code, r.product_name].filter(Boolean).join(' - ') },
  { key: 'shift', label: 'Shift', value: (r) => r.shift || '' },
  { key: 'gross_weight_kg', label: 'Berat Kotor (kg)', type: 'number', value: (r) => r.gross_weight_kg },
  { key: 'net_weight_kg', label: 'Berat Bersih (kg)', type: 'number', value: (r) => r.net_weight_kg },
  { key: 'length_m', label: 'Panjang (m)', type: 'number', value: (r) => r.length_m ?? '' },
  { key: 'width_cm', label: 'Lebar (cm)', type: 'number', value: (r) => r.width_cm ?? '' },
  { key: 'batch_number', label: 'No. Batch Stok', value: (r) => r.batch_number || '' },
  { key: 'stock_remaining_kg', label: 'Sisa di Stok (kg)', type: 'number', value: (r) => r.stock_remaining_kg ?? '' },
  { key: 'grade', label: 'Grade', value: (r) => r.grade },
  { key: 'status', label: 'Status', value: (r) => r.status, exportValue: (r) => STATUS_LABEL[r.status] || r.status },
  { key: 'notes', label: 'Catatan', value: (r) => r.notes || '' },
]

export default function RollList() {
  const [rows, setRows] = useState<Roll[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Roll | 'new' | null>(null)
  const [ringkas, setRingkas] = useState<any>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      axiosInstance.get(API, { params: { per_page: 1000 } }),
      axiosInstance.get(`${API}/summary`),
    ])
      .then(([a, b]) => { setRows(a.data?.rolls || []); setRingkas(b.data) })
      .catch(() => toast.error('Gagal memuat daftar roll'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const tools = useListTools<Roll>(rows, COLUMNS, {
    filename: 'Roll_Spunlace', initialSort: { key: 'produced_at', dir: 'desc' }, dateColumn: 'produced_at',
  })

  const batalkan = async (r: Roll) => {
    const ok = await confirmDialog(`Batalkan roll ${r.display_number} (${kg(r.net_weight_kg)})? Catatannya tetap tersimpan sebagai dibatalkan.`,
      { title: 'Batalkan roll', confirmText: 'Batalkan' })
    if (!ok) return
    try {
      await axiosInstance.post(`${API}/${r.id}/cancel`, { reason: 'dibatalkan dari daftar' })
      toast.success('Roll dibatalkan')
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Gagal membatalkan roll')
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Roll Spunlace</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Catat roll yang keluar dari mesin spunlace: nomor, berat, dan grade-nya.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={load} className="btn-secondary">
            <ArrowPathIcon className="mr-1.5 h-4 w-4" aria-hidden="true" /> Perbarui
          </button>
          <button type="button" onClick={() => setForm('new')} className="btn-primary">
            <PlusIcon className="mr-1.5 h-5 w-5" aria-hidden="true" /> Catat Roll
          </button>
        </div>
      </div>

      {ringkas && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kartu label="Jumlah roll" nilai={String(ringkas.rolls)} />
          <Kartu label="Berat bersih" nilai={kg(ringkas.net_kg)} />
          <Kartu label="Berat kotor" nilai={kg(ringkas.gross_kg)} />
          <Kartu
            label="Per grade"
            nilai={(ringkas.by_grade || []).map((g: any) => `${g.grade}: ${g.rolls}`).join('  ') || '-'}
          />
        </div>
      )}

      <div className="card space-y-4 p-4 sm:p-6">
        <ListToolbar tools={tools} placeholder="Cari nomor roll, kain, shift" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              <tr>
                <SortTh tools={tools} col="display_number" className="px-3 py-2 text-left">No. Roll</SortTh>
                <SortTh tools={tools} col="produced_at" className="px-3 py-2 text-left">Tanggal</SortTh>
                <SortTh tools={tools} col="product" className="px-3 py-2 text-left">Jenis Kain</SortTh>
                <SortTh tools={tools} col="shift" className="px-3 py-2 text-left">Shift</SortTh>
                <SortTh tools={tools} col="gross_weight_kg" align="right" className="px-3 py-2 text-right">Kotor</SortTh>
                <SortTh tools={tools} col="net_weight_kg" align="right" className="px-3 py-2 text-right">Bersih</SortTh>
                <SortTh tools={tools} col="stock_remaining_kg" align="right" className="px-3 py-2 text-right">Sisa di Stok</SortTh>
                <SortTh tools={tools} col="grade" className="px-3 py-2 text-left">Grade</SortTh>
                <SortTh tools={tools} col="status" className="px-3 py-2 text-left">Status</SortTh>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {tools.rows.map((r) => (
                <tr key={r.id} className={r.status === 'cancelled' ? 'text-gray-400 line-through dark:text-gray-500' : ''}>
                  <td className="px-3 py-2 font-medium">
                    {r.display_number}
                    {r.cycle > 1 && <span className="ml-1 text-[11px] text-gray-400">putaran {r.cycle}</span>}
                  </td>
                  <td className="px-3 py-2">{tanggal(r.produced_at)}</td>
                  <td className="px-3 py-2">{[r.product_code, r.product_name].filter(Boolean).join(' - ')}</td>
                  <td className="px-3 py-2">{r.shift || '-'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{kg(r.gross_weight_kg)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{kg(r.net_weight_kg)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.batch_number ? (
                      <>
                        {kg(r.stock_remaining_kg)}
                        <span className="block text-[11px] text-gray-400">batch {r.batch_number}</span>
                      </>
                    ) : (
                      <span className="text-[11px] text-amber-700 dark:text-amber-300">belum masuk stok</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${GRADE_CLASS[r.grade] || ''}`}>{r.grade}</span>
                  </td>
                  <td className="px-3 py-2">{STATUS_LABEL[r.status] || r.status}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      {r.status === 'available' && (
                        <>
                          <button type="button" onClick={() => setForm(r)} className="text-xs font-medium text-primary-700 hover:underline dark:text-primary-300">Ubah</button>
                          <button type="button" onClick={() => batalkan(r)} className="text-xs font-medium text-red-600 hover:underline dark:text-red-400">Batalkan</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {tools.rows.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-500 dark:text-gray-400">Belum ada roll pada periode ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <RollForm
          roll={form === 'new' ? null : form}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); load() }}
        />
      )}
    </div>
  )
}

const Kartu = ({ label, nilai }: { label: string; nilai: string }) => (
  <div className="card p-4">
    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{nilai}</p>
  </div>
)

function RollForm({ roll, onClose, onSaved }: { roll: Roll | null; onClose: () => void; onSaved: () => void }) {
  const [produk, setProduk] = useState<any[]>([])
  const [meta, setMeta] = useState<any>({ grades: [], machines: [] })
  const [busy, setBusy] = useState(false)
  const [peringatan, setPeringatan] = useState<string | null>(null)
  const [f, setF] = useState({
    roll_number: roll ? String(roll.roll_number) : '',
    product_id: roll?.product_id ?? (null as number | string | null),
    produced_at: roll?.produced_at || ymd(new Date()),
    shift: roll?.shift || '',
    machine_id: '' as string,
    gross_weight_kg: roll ? String(roll.gross_weight_kg) : '',
    net_weight_kg: roll ? String(roll.net_weight_kg) : '',
    length_m: roll?.length_m ? String(roll.length_m) : '',
    width_cm: roll?.width_cm ? String(roll.width_cm) : '',
    grade: roll?.grade || 'A',
    notes: roll?.notes || '',
  })
  const set = (k: keyof typeof f, v: any) => { setPeringatan(null); setF((p) => ({ ...p, [k]: v })) }

  useEffect(() => {
    axiosInstance.get('/api/products?status=active&per_page=2000')
      .then((r) => setProduk(r.data?.products || r.data?.items || []))
      .catch(() => toast.error('Gagal memuat daftar kain'))
    axiosInstance.get(`${API}/meta`).then((r) => {
      setMeta(r.data || {})
      if (!roll && (r.data?.machines || []).length === 1) setF((p) => ({ ...p, machine_id: String(r.data.machines[0].id) }))
    }).catch(() => undefined)
  }, [roll])

  const cone = useMemo(() => produk.find((p: any) => p.id === Number(f.product_id))?.cone_weight_kg, [produk, f.product_id])

  const simpan = async (confirmDuplicate = false) => {
    const body = {
      roll_number: Number(f.roll_number),
      product_id: Number(f.product_id),
      produced_at: f.produced_at,
      shift: f.shift || undefined,
      machine_id: f.machine_id ? Number(f.machine_id) : undefined,
      gross_weight_kg: Number(f.gross_weight_kg),
      net_weight_kg: Number(f.net_weight_kg),
      length_m: f.length_m ? Number(f.length_m) : undefined,
      width_cm: f.width_cm ? Number(f.width_cm) : undefined,
      grade: f.grade,
      notes: f.notes || undefined,
      confirm_duplicate: confirmDuplicate || undefined,
    }
    setBusy(true)
    try {
      if (roll) await axiosInstance.put(`${API}/${roll.id}`, body)
      else await axiosInstance.post(API, body)
      toast.success(roll ? 'Roll diperbarui' : 'Roll tercatat')
      onSaved()
    } catch (e: any) {
      const data = e?.response?.data
      if (data?.needs_confirmation) setPeringatan(data.error)
      else toast.error(data?.error || 'Gagal menyimpan roll')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AccessibleModal isOpen onClose={onClose} title={roll ? `Ubah roll ${roll.display_number}` : 'Catat Roll Spunlace'} size="lg">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Nomor roll *</label>
          <input className="input-field" inputMode="numeric" value={f.roll_number}
                 onChange={(e) => set('roll_number', e.target.value.replace(/\D/g, ''))} placeholder="1 - 10000" />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Ditulis sesuai nomor di roll. Deretnya kembali ke 1 setelah 10000.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Jenis kain *</label>
          <SearchableSelect
            options={produk.map((p: any) => ({ id: p.id, code: p.code, name: p.name }))}
            value={f.product_id}
            onChange={(v) => set('product_id', v)}
            placeholder="Pilih kain"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Tanggal produksi *</label>
          <input type="date" className="input-field" value={f.produced_at} onChange={(e) => set('produced_at', e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Shift</label>
          <select className="input-field" value={f.shift} onChange={(e) => set('shift', e.target.value)}>
            <option value="">- Pilih shift -</option>
            <option value="Pagi">Pagi (07-15)</option>
            <option value="Siang">Siang (15-23)</option>
            <option value="Malam">Malam (23-07)</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Berat kotor (kg) *</label>
          <NumberInput className="input-field text-right" value={f.gross_weight_kg} onChange={(e: any) => set('gross_weight_kg', e.target.value)} />
          {cone ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Berat cone di spesifikasi kain ini {kg(cone)} - sebagai acuan saja.</p> : null}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Berat bersih (kg) *</label>
          <NumberInput className="input-field text-right" value={f.net_weight_kg} onChange={(e: any) => set('net_weight_kg', e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Panjang (m)</label>
          <NumberInput className="input-field text-right" value={f.length_m} onChange={(e: any) => set('length_m', e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Lebar (cm)</label>
          <NumberInput className="input-field text-right" value={f.width_cm} onChange={(e: any) => set('width_cm', e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Grade *</label>
          <select className="input-field" value={f.grade} onChange={(e) => set('grade', e.target.value)}>
            {(meta.grades || []).map((g: any) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
        {(meta.machines || []).length > 1 && (
          <div>
            <label className="mb-1 block text-sm font-medium">Mesin</label>
            <select className="input-field" value={f.machine_id} onChange={(e) => set('machine_id', e.target.value)}>
              <option value="">- Pilih mesin -</option>
              {meta.machines.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium">Catatan</label>
          <textarea className="input-field" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)}
                    placeholder="Misalnya kendala mesin saat roll ini jalan" />
        </div>
      </div>

      {peringatan && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="font-semibold text-amber-800 dark:text-amber-200">Nomor roll bentrok</p>
          <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/90">{peringatan}</p>
          <button type="button" onClick={() => simpan(true)} disabled={busy}
                  className="btn-primary mt-3 disabled:opacity-50">Ya, simpan sebagai roll baru</button>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
        <button type="button" className="btn-primary disabled:opacity-50" disabled={busy} onClick={() => simpan(false)}>
          {busy ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </AccessibleModal>
  )
}
