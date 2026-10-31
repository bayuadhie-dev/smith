import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeftIcon, ChevronDownIcon, ChevronUpIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import axiosInstance from '../../utils/axiosConfig'
import SearchableSelect from '../../components/SearchableSelect'
import NumberInput from '../../components/ui/NumberInput'
import { showError, showSuccess } from '../../components/ui/Toast'

interface Row {
  po_item_id: number
  product_id: number | null
  material_id: number | null
  name: string
  code?: string
  uom: string
  ordered: number
  receivedBefore: number
  qty: number | string
  location_id: number | null
  batch_number: string
  lot_number: string
  production_date: string
  expiry_date: string
  notes: string
  open: boolean
  requireBatch?: boolean
  requireExpiry?: boolean
}

const todayISO = () => new Date().toISOString().slice(0, 10)
const num = (v: unknown) => (v === '' || v === null || v === undefined ? 0 : Number(v))

export default function GRNForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [params] = useSearchParams()
  const [orders, setOrders] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [po, setPo] = useState<any>(null)
  const [poId, setPoId] = useState<number | null>(params.get('po_id') ? Number(params.get('po_id')) : null)
  const [grnNumber, setGrnNumber] = useState('')
  const [receiptDate, setReceiptDate] = useState(todayISO())
  const [deliveryNote, setDeliveryNote] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [driver, setDriver] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [bulkLocation, setBulkLocation] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    axiosInstance.get('/api/warehouse/locations', { params: { per_page: 1000 } })
      .then((r) => setLocations(r.data.locations || []))
      .catch(() => showError('Gagal memuat daftar lokasi gudang'))
    if (!isEdit) {
      axiosInstance.get('/api/purchasing/purchase-orders', { params: { status: 'approved,partial', per_page: 200 } })
        .then((r) => setOrders(r.data.purchase_orders || []))
        .catch(() => showError('Gagal memuat daftar PO'))
    }
  }, [isEdit])

  const itemName = (it: any) => it.material_name || it.product_name || it.description || '(tanpa nama)'

  // Penerimaan baru: baris diturunkan dari PO, jumlah awal = sisa yang belum diterima.
  useEffect(() => {
    if (isEdit || !poId) { if (!isEdit) { setPo(null); setRows([]) } return }
    axiosInstance.get(`/api/purchasing/purchase-orders/${poId}`)
      .then((r) => {
        const data = r.data
        setPo(data)
        setRows((data.items || []).map((it: any): Row => {
          const before = Number(it.quantity_received || 0)
          const outstanding = Math.max(0, Number(it.quantity) - before)
          return {
            po_item_id: it.id, product_id: it.product_id ?? null, material_id: it.material_id ?? null,
            name: itemName(it), code: it.material_code || it.product_code, uom: it.uom || 'PCS',
            ordered: Number(it.quantity), receivedBefore: before, qty: outstanding, location_id: null,
            batch_number: '', lot_number: '', production_date: '', expiry_date: '', notes: '', open: false,
            requireBatch: !!it.require_batch, requireExpiry: !!it.require_expiry,
          }
        }))
      })
      .catch(() => showError('Gagal memuat PO'))
  }, [poId, isEdit])

  // Koreksi: muat GRN yang ada.
  useEffect(() => {
    if (!isEdit) return
    axiosInstance.get(`/api/purchasing/grn/${id}`)
      .then(async (r) => {
        const g = r.data
        setGrnNumber(g.grn_number)
        setPoId(g.po_id)
        setReceiptDate(String(g.receipt_date || '').split('T')[0] || todayISO())
        setDeliveryNote(g.delivery_note_number || '')
        setVehicle(g.vehicle_number || '')
        setDriver(g.driver_name || '')
        setNotes(g.notes || '')
        let poData: any = null
        try { poData = (await axiosInstance.get(`/api/purchasing/purchase-orders/${g.po_id}`)).data } catch { /* nama barang tetap tampil dari GRN */ }
        setPo(poData)
        const byId: Record<number, any> = {}
        ;(poData?.items || []).forEach((it: any) => { byId[it.id] = it })
        setRows((g.items || []).map((it: any): Row => ({
          po_item_id: it.po_item_id, product_id: it.product_id ?? null, material_id: it.material_id ?? null,
          name: it.material_name || it.product_name || (byId[it.po_item_id] ? itemName(byId[it.po_item_id]) : `Item #${it.po_item_id}`),
          code: it.material_code || it.product_code, uom: it.uom, ordered: Number(it.quantity_ordered || 0),
          receivedBefore: 0, qty: Number(it.quantity_received || 0), location_id: it.location_id ?? null,
          batch_number: it.batch_number || '', lot_number: it.lot_number || '',
          production_date: it.production_date ? String(it.production_date).split('T')[0] : '',
          expiry_date: it.expiry_date ? String(it.expiry_date).split('T')[0] : '', notes: it.notes || '', open: false,
        })))
      })
      .catch(() => showError('Gagal memuat GRN'))
  }, [id, isEdit])

  const locationOptions = useMemo(
    () => locations.map((l) => ({ id: l.id, name: `${l.location_code}${l.zone_name ? ' - ' + l.zone_name : ''}` })),
    [locations],
  )

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const applyBulk = (loc: number | null) => { setBulkLocation(loc); if (loc) setRows((rs) => rs.map((r) => (num(r.qty) > 0 ? { ...r, location_id: loc } : r))) }

  const totalQty = rows.reduce((s, r) => s + num(r.qty), 0)
  const supplierName = po?.supplier?.company_name || orders.find((o) => o.id === poId)?.supplier_name || ''

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!poId) return setError('Pilih Purchase Order terlebih dahulu')
    const active = rows.filter((r) => num(r.qty) > 0)
    if (!isEdit) {
      if (active.length === 0) return setError('Isi jumlah diterima minimal satu baris')
      const noLoc = active.find((r) => !r.location_id)
      if (noLoc) return setError(`Lokasi gudang wajib diisi untuk "${noLoc.name}" (tanpa lokasi stok tidak bertambah)`)
      if (active.some((r) => num(r.qty) < 0)) return setError('Jumlah diterima tidak boleh negatif')
      const noBatch = active.find((r) => r.requireBatch && !r.batch_number.trim() && !r.lot_number.trim())
      if (noBatch) return setError(`"${noBatch.name}" wajib memakai nomor batch/lot. Isi No. Batch.`)
      const noExp = active.find((r) => r.requireExpiry && !r.expiry_date)
      if (noExp) return setError(`"${noExp.name}" wajib memakai tanggal kedaluwarsa. Buka rincian baris lalu isi Tanggal Kadaluarsa.`)
    }
    setSaving(true)
    try {
      if (isEdit) {
        await axiosInstance.put(`/api/purchasing/grn/${id}`, {
          receipt_date: receiptDate, delivery_note_number: deliveryNote, vehicle_number: vehicle, driver_name: driver, notes,
          items: rows.map((r) => ({
            po_item_id: r.po_item_id, lot_number: r.lot_number || null, notes: r.notes || null,
            production_date: r.production_date || null, expiry_date: r.expiry_date || null,
          })),
        })
        showSuccess('GRN diperbarui')
      } else {
        await axiosInstance.post('/api/purchasing/grn', {
          po_id: poId, supplier_id: po?.supplier_id ?? po?.supplier?.id, receipt_date: receiptDate,
          delivery_note_number: deliveryNote || null, vehicle_number: vehicle || null, driver_name: driver || null, notes: notes || null,
          items: active.map((r) => ({
            po_item_id: r.po_item_id, product_id: r.product_id, material_id: r.material_id, quantity_ordered: r.ordered,
            quantity_received: num(r.qty), quantity_accepted: num(r.qty), uom: r.uom, location_id: r.location_id,
            batch_number: r.batch_number || null, lot_number: r.lot_number || null,
            production_date: r.production_date || null, expiry_date: r.expiry_date || null, notes: r.notes || null,
          })),
        })
        showSuccess('Penerimaan barang dicatat dan stok bertambah')
      }
      navigate('/app/purchasing/grn')
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.response?.data?.message || 'Gagal menyimpan GRN')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/app/purchasing/grn" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><ArrowLeftIcon className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isEdit ? `Koreksi GRN ${grnNumber}` : 'Penerimaan Barang (GRN)'}</h1>
          <p className="text-sm text-gray-500">
            {isEdit ? 'Hanya data pengiriman, lot, tanggal, dan catatan yang bisa dikoreksi. Jumlah dikoreksi lewat Inspeksi.' : 'Catat barang yang datang berdasarkan PO. Stok bertambah saat disimpan dan jurnal GR/IR diposting.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-6">
        <div className="card p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Purchase Order *</label>
            {isEdit ? (
              <div className="input-field bg-gray-50 dark:bg-gray-900">{po?.po_number || `PO #${poId}`}</div>
            ) : (
              <SearchableSelect
                options={orders.map((o) => ({ id: o.id, name: `${o.po_number} - ${o.supplier_name} (${o.status})` }))}
                value={poId}
                onChange={(v) => setPoId(v ? Number(v) : null)}
                placeholder="Cari nomor PO atau pemasok"
                className="w-full"
              />
            )}
            {!isEdit && <p className="mt-1 text-xs text-gray-500">Hanya PO yang sudah disetujui atau diterima sebagian.</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Pemasok</label>
            <div className="input-field bg-gray-50 dark:bg-gray-900">{supplierName || '-'}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Tanggal Terima *</label>
            <input type="date" className="input-field" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">No. Surat Jalan</label>
            <input className="input-field" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} placeholder="Nomor surat jalan pemasok" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">No. Kendaraan</label>
            <input className="input-field" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Contoh: B 1234 XYZ" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Nama Sopir</label>
            <input className="input-field" value={driver} onChange={(e) => setDriver(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Catatan</label>
            <textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan umum penerimaan" />
          </div>
        </div>

        {rows.length > 0 && (
          <div className="card p-6 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Barang Diterima</h2>
              {!isEdit && (
                <div className="w-full sm:w-80">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Terapkan lokasi gudang ke semua baris</label>
                  <SearchableSelect options={locationOptions} value={bulkLocation} onChange={(v) => applyBulk(v ? Number(v) : null)} placeholder="Pilih lokasi" className="w-full" />
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 pr-3">Item</th>
                    {!isEdit && <th className="pb-2 pr-3 text-right">Dipesan</th>}
                    {!isEdit && <th className="pb-2 pr-3 text-right">Sudah Diterima</th>}
                    <th className="pb-2 pr-3 text-right w-36">{isEdit ? 'Diterima' : 'Diterima Sekarang'}</th>
                    <th className="pb-2 pr-3 w-64">Lokasi Gudang *</th>
                    <th className="pb-2 pr-3 w-40">Batch</th>
                    <th className="pb-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const outstanding = Math.max(0, r.ordered - r.receivedBefore)
                    const over = !isEdit && num(r.qty) > outstanding + 1e-9
                    return (
                      <Fragment key={r.po_item_id}>
                        <tr className="border-b border-gray-100 dark:border-gray-700 align-top">
                          <td className="py-2 pr-3">
                            <div className="font-medium text-gray-900 dark:text-white">{r.name}</div>
                            {r.code && <div className="text-xs text-gray-400">{r.code}</div>}
                          </td>
                          {!isEdit && <td className="py-2 pr-3 text-right tabular-nums">{r.ordered.toLocaleString('id-ID')} {r.uom}</td>}
                          {!isEdit && <td className="py-2 pr-3 text-right tabular-nums">{r.receivedBefore.toLocaleString('id-ID')}</td>}
                          <td className="py-2 pr-3">
                            {isEdit ? (
                              <div className="text-right tabular-nums">{num(r.qty).toLocaleString('id-ID')} {r.uom}</div>
                            ) : (
                              <>
                                <NumberInput className="input-field text-right" value={r.qty as any} onChange={(e: any) => update(i, { qty: e.target.value })} />
                                {over && <p className="mt-1 text-xs text-amber-600">Melebihi sisa PO ({outstanding.toLocaleString('id-ID')})</p>}
                              </>
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            {isEdit ? (
                              <div className="text-sm">{locationOptions.find((l) => l.id === r.location_id)?.name || '-'}</div>
                            ) : (
                              <SearchableSelect options={locationOptions} value={r.location_id} onChange={(v) => update(i, { location_id: v ? Number(v) : null })} placeholder="Pilih lokasi" className="w-full" />
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            {isEdit ? <div className="text-sm">{r.batch_number || '-'}</div>
                              : <input className="input-field" value={r.batch_number} onChange={(e) => update(i, { batch_number: e.target.value })} placeholder={r.requireBatch ? 'No. batch (wajib)' : 'No. batch'} />}
                          </td>
                          <td className="py-2">
                            <button type="button" onClick={() => update(i, { open: !r.open })} className="p-1 text-gray-500 hover:text-gray-800" title="Lot, tanggal, catatan">
                              {r.open ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                            </button>
                          </td>
                        </tr>
                        {r.open && (
                          <tr key={`${r.po_item_id}-d`} className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                            <td colSpan={7} className="p-3">
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div><label className="block text-xs text-gray-500 mb-1">No. Lot</label><input className="input-field" value={r.lot_number} onChange={(e) => update(i, { lot_number: e.target.value })} /></div>
                                <div><label className="block text-xs text-gray-500 mb-1">Tanggal Produksi</label><input type="date" className="input-field" value={r.production_date} onChange={(e) => update(i, { production_date: e.target.value })} /></div>
                                <div><label className="block text-xs text-gray-500 mb-1">Tanggal Kadaluarsa{r.requireExpiry ? ' *' : ''}</label><input type="date" className="input-field" value={r.expiry_date} onChange={(e) => update(i, { expiry_date: e.target.value })} /></div>
                                <div><label className="block text-xs text-gray-500 mb-1">Catatan Baris</label><input className="input-field" value={r.notes} onChange={(e) => update(i, { notes: e.target.value })} /></div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {!isEdit && (
              <p className="text-xs text-gray-500">
                Jumlah terisi otomatis sesuai sisa PO. Kosongkan (0) untuk baris yang belum datang. Barang yang ternyata cacat ditolak lewat Inspeksi setelah GRN disimpan.
              </p>
            )}
            <div className="flex justify-end text-sm text-gray-600 dark:text-gray-300">
              Total diterima: <span className="ml-2 font-semibold">{totalQty.toLocaleString('id-ID')}</span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link to="/app/purchasing/grn" className="btn-secondary">Batal</Link>
          <button type="submit" disabled={saving || !poId} className="btn-primary disabled:opacity-50">{saving ? 'Menyimpan...' : isEdit ? 'Simpan Koreksi' : 'Simpan Penerimaan'}</button>
        </div>
      </form>
    </div>
  )
}
