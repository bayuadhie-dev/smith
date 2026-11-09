import { PendingAttachments, uploadAttachments } from '../../components/AttachmentsPanel'
import { Fragment, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { TabContext, clearTabDrafts, useDraftState } from '../../workspace/drafts'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeftIcon, ChevronDownIcon, ChevronUpIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { enterMovesDown } from '../../utils/enterNavigation'
import axiosInstance from '../../utils/axiosConfig'
import SearchableSelect from '../../components/SearchableSelect'
import NumberInput from '../../components/ui/NumberInput'
import { showError, showSuccess } from '../../components/ui/Toast'

interface Row {
  key: string
  po_item_id: number | null
  is_service?: boolean
  split?: Record<string, string>
  qty0?: number
  itemId?: number
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
  requireExpiry?: boolean
}

const todayISO = () => new Date().toISOString().slice(0, 10)
const num = (v: unknown) => (v === '' || v === null || v === undefined ? 0 : Number(v))

export default function GRNForm() {
  const navigate = useNavigate()
  const [attFiles, setAttFiles] = useState<File[]>([])
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [params] = useSearchParams()
  const tab = useContext(TabContext)
  const [orders, setOrders] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [po, setPo] = useState<any>(null)
  const [poId, setPoId] = useDraftState<number | null>('poId', params.get('po_id') ? Number(params.get('po_id')) : null, !isEdit)
  const [supplierId, setSupplierId] = useDraftState<number | null>('supplierId', params.get('supplier_id') ? Number(params.get('supplier_id')) : null, !isEdit)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [notesTouched, setNotesTouched] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [grnNumber, setGrnNumber] = useState('')
  const [manualNumber, setManualNumber] = useState('')
  const [nextNumber, setNextNumber] = useState('')
  const [receiptDate, setReceiptDate] = useDraftState('receiptDate', todayISO(), !isEdit)
  const [deliveryNote, setDeliveryNote] = useDraftState('deliveryNote', '', !isEdit)
  const [supInvNo, setSupInvNo] = useDraftState('supInvNo', '', !isEdit)
  const [vehicle, setVehicle] = useDraftState('vehicle', '', !isEdit)
  const [driver, setDriver] = useDraftState('driver', '', !isEdit)
  const [notes, setNotes] = useDraftState('notes', '', !isEdit)
  const [rows, setRows] = useDraftState<Row[]>('rows', [], !isEdit)
  const restoredRows = useRef(rows.length > 0)
  const [bulkLocation, setBulkLocation] = useDraftState<number | null>('bulkLocation', null, !isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    axiosInstance.get('/api/warehouse/locations', { params: { per_page: 1000 } })
      .then((r) => setLocations(r.data.locations || []))
      .catch((e) => {
        if (e?.response?.status === 403) showError('Akun ini belum punya izin melihat gudang. Hubungi admin untuk memberi izin Gudang (lihat).')
        else showError('Gagal memuat daftar lokasi gudang')
      })
    if (!isEdit) {
      axiosInstance.get('/api/purchasing/suppliers', { params: { per_page: 1000 } })
        .then((r) => setSuppliers(r.data.suppliers || []))
        .catch(() => showError('Gagal memuat daftar pemasok'))
      axiosInstance.get('/api/materials/', { params: { per_page: 2000 } })
        .then((r) => setMaterials(r.data.materials || []))
        .catch(() => setMaterials([]))
    }
  }, [isEdit])

  useEffect(() => {
    if (isEdit) return
    axiosInstance.get('/api/purchasing/grn/next-number').then((r) => setNextNumber(r.data?.next_number || '')).catch(() => setNextNumber(''))
  }, [isEdit])

  // PO yang bisa diterima: hanya milik pemasok terpilih dan masih punya sisa penerimaan.
  useEffect(() => {
    if (isEdit) return
    if (!supplierId) { setOrders([]); return }
    setLoadError('')
    axiosInstance.get('/api/purchasing/purchase-orders', { params: { status: 'approved,partial', supplier_id: supplierId, receivable: 1, per_page: 200 } })
      .then((r) => setOrders(r.data.purchase_orders || []))
      .catch((e) => {
        setOrders([])
        const msg = e?.response?.status === 403
          ? 'Akun ini belum punya izin melihat Purchase Order. Hubungi admin untuk memberi izin Pembelian (lihat).'
          : (e?.response?.data?.error || 'Gagal memuat daftar PO')
        setLoadError(msg); showError(msg)
      })
  }, [supplierId, isEdit])

  // Datang dari PO (?po_id=): pemasok ikut terisi otomatis.
  useEffect(() => {
    if (isEdit || !poId || supplierId) return
    axiosInstance.get(`/api/purchasing/purchase-orders/${poId}`)
      .then((r) => { const sid = r.data?.supplier_id ?? r.data?.supplier?.id; if (sid) setSupplierId(sid) })
      .catch(() => undefined)
  }, [poId, isEdit, supplierId])

  const itemName = (it: any) => it.description || it.material_name || it.product_name || '(tanpa nama)'
  const masterName = (it: any) => it.material_name || it.product_name || ''

  const rowsFromPo = (data: any): Row[] => (data.items || []).filter((it: any) => !it.is_non_inventory).map((it: any): Row => {
    const before = Number(it.quantity_received || 0)
    const outstanding = Math.max(0, Number(it.quantity) - before)
    const service = !!it.is_non_inventory
    return {
      key: `po-${it.id}`, po_item_id: it.id, is_service: service, product_id: it.product_id ?? null, material_id: it.material_id ?? null,
      name: itemName(it), code: [it.material_code || it.product_code, masterName(it) && masterName(it) !== itemName(it) ? masterName(it) : ''].filter(Boolean).join(' · '), uom: it.uom || 'PCS',
      ordered: Number(it.quantity), receivedBefore: before, qty: service ? Number(it.quantity) : outstanding, location_id: null,
      batch_number: '', lot_number: '', production_date: '', expiry_date: '', notes: it.notes || '', open: false,
      requireExpiry: !!it.require_expiry,
    }
  })

  // Penerimaan baru dari PO: baris diturunkan dari PO, jumlah awal = sisa yang belum diterima, catatan ikut dari PO.
  useEffect(() => {
    if (isEdit) return
    if (!poId) { setPo(null); if (!restoredRows.current) setRows((rs) => rs.filter((r) => r.po_item_id === null)); return }
    axiosInstance.get(`/api/purchasing/purchase-orders/${poId}`)
      .then((r) => {
        const data = r.data
        setPo(data)
        if (restoredRows.current) restoredRows.current = false
        else setRows((rs) => [...rowsFromPo(data), ...rs.filter((x) => x.po_item_id === null)])
        if (!notesTouched && data.notes) setNotes(data.notes)
      })
      .catch((e) => {
        const msg = e?.response?.status === 403
          ? 'Akun ini belum punya izin melihat Purchase Order. Hubungi admin untuk memberi izin Pembelian (lihat).'
          : (e?.response?.data?.error || 'Gagal memuat PO')
        showError(msg)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poId, isEdit])

  // Koreksi: muat GRN yang ada.
  useEffect(() => {
    if (!isEdit) return
    axiosInstance.get(`/api/purchasing/grn/${id}`)
      .then(async (r) => {
        const g = r.data
        setGrnNumber(g.grn_number)
        setPoId(g.po_id)
        if (g.supplier_id) setSupplierId(g.supplier_id)
        setReceiptDate(String(g.receipt_date || '').split('T')[0] || todayISO())
        setDeliveryNote(g.delivery_note_number || '')
        setSupInvNo(g.supplier_invoice_number || '')
        setVehicle(g.vehicle_number || '')
        setDriver(g.driver_name || '')
        setNotes(g.notes || '')
        let poData: any = null
        try { if (g.po_id) poData = (await axiosInstance.get(`/api/purchasing/purchase-orders/${g.po_id}`)).data } catch { /* nama barang tetap tampil dari GRN */ }
        setPo(poData)
        const byId: Record<number, any> = {}
        ;(poData?.items || []).forEach((it: any) => { byId[it.id] = it })
        setRows((g.items || []).map((it: any): Row => ({
          key: `g-${it.id}`, itemId: it.id, po_item_id: it.po_item_id ?? null, product_id: it.product_id ?? null, material_id: it.material_id ?? null,
          name: it.item_name || (it.po_item_id && byId[it.po_item_id] ? itemName(byId[it.po_item_id]) : (it.material_name || it.product_name || `Item #${it.id}`)),
          code: it.material_code || it.product_code, uom: it.uom, ordered: Number(it.quantity_ordered || 0),
          receivedBefore: 0, qty: Number(it.quantity_received || 0), qty0: Number(it.quantity_received || 0), location_id: it.location_id ?? null,
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
  const supplierName = po?.supplier?.company_name || suppliers.find((x) => x.id === supplierId)?.company_name || orders.find((o) => o.id === poId)?.supplier_name || ''
  const materialOptions = useMemo(() => materials.filter((m) => m.is_active !== false).map((m) => ({ id: m.id, name: `${m.code} - ${m.name}` })), [materials])
  const addManualRow = (matId: number | null) => {
    const m = materials.find((x) => x.id === matId)
    if (!m) return
    setRows((rs) => [...rs, {
      key: `m-${m.id}-${Date.now()}`, po_item_id: null, is_service: m.material_type === 'non_inventory', product_id: null, material_id: m.id,
      name: m.name, code: m.code, uom: m.unit_of_measure || 'PCS', ordered: 0, receivedBefore: 0, qty: 1, location_id: null,
      batch_number: '', lot_number: '', production_date: '', expiry_date: '', notes: '', open: false,
    }])
  }
  const parseBatches = (v: string) => Array.from(new Set(v.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean)))
  const batchQtys = (r: Row): { batch: string; qty: number }[] => {
    const list = parseBatches(r.batch_number)
    const total = num(r.qty)
    const given = list.filter((b) => r.split && r.split[b] !== undefined && r.split[b] !== '')
    const rest = list.filter((b) => !given.includes(b))
    const givenSum = given.reduce((a, b) => a + num(r.split![b]), 0)
    const r3 = (x: number) => Math.round(x * 1000) / 1000
    const left = Math.max(0, total - givenSum)
    const share = rest.length ? r3(left / rest.length) : 0
    return list.map((b) => {
      if (given.includes(b)) return { batch: b, qty: num(r.split![b]) }
      const isLastRest = rest.length > 0 && b === rest[rest.length - 1]
      return { batch: b, qty: isLastRest ? r3(left - share * (rest.length - 1)) : share }
    })
  }
  const [batchEdit, setBatchEdit] = useState<{ i: number; list: { batch: string; qty: string }[] } | null>(null)
  const openBatch = (i: number) => {
    const r = rows[i]
    const cur = batchQtys(r)
    setBatchEdit({ i, list: cur.length ? cur.map((b) => ({ batch: b.batch, qty: String(b.qty) })) : [{ batch: '', qty: String(num(r.qty)) }] })
  }
  const saveBatch = () => {
    if (!batchEdit) return
    const list = batchEdit.list.map((b) => ({ batch: b.batch.trim(), qty: b.qty })).filter((b) => b.batch)
    const names = list.map((b) => b.batch)
    if (new Set(names).size !== names.length) return showError('Ada nomor batch yang sama dua kali')
    if (names.some((b) => b.length > 100)) return showError('Satu nomor batch maksimal 100 karakter')
    const split: Record<string, string> = {}
    if (list.length > 1) list.forEach((b) => { split[b.batch] = b.qty })
    update(batchEdit.i, { batch_number: names.join(', '), split })
    setBatchEdit(null)
  }
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i))
  const needsWarehouse = (r: Row) => !r.is_service && (r.product_id !== null || r.material_id !== null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!isEdit && !supplierId) return setError('Pilih pemasok terlebih dahulu')
    const active = rows.filter((r) => num(r.qty) > 0)
    if (!isEdit) {
      if (active.length === 0) return setError('Isi jumlah diterima minimal satu baris')
      const noLoc = active.find((r) => needsWarehouse(r) && !r.location_id)
      if (noLoc) return setError(`Lokasi gudang wajib diisi untuk "${noLoc.name}" (tanpa lokasi stok tidak bertambah)`)
      if (active.some((r) => num(r.qty) < 0)) return setError('Jumlah diterima tidak boleh negatif')
      const noExp = active.find((r) => r.requireExpiry && !r.expiry_date)
      if (noExp) return setError(`"${noExp.name}" wajib memakai tanggal kedaluwarsa. Buka rincian baris lalu isi Tanggal Kadaluarsa.`)
    }
    if (!isEdit) {
      for (const r of active) {
        const list = parseBatches(r.batch_number)
        if (list.some((b) => b.length > 100)) return setError(`No. batch pada "${r.name}" terlalu panjang (maksimal 100 karakter per batch). Pisahkan beberapa batch dengan koma.`)
        if (list.length > 1) {
          const sum = batchQtys(r).reduce((a, b) => a + b.qty, 0)
          if (Math.abs(sum - num(r.qty)) > 0.01) return setError(`Jumlah per batch pada "${r.name}" (${sum.toLocaleString('id-ID')}) harus sama dengan jumlah diterima (${num(r.qty).toLocaleString('id-ID')}).`)
        }
      }
    }
    setSaving(true)
    try {
      if (isEdit) {
        await axiosInstance.put(`/api/purchasing/grn/${id}`, {
          receipt_date: receiptDate, delivery_note_number: deliveryNote, supplier_invoice_number: supInvNo, vehicle_number: vehicle, driver_name: driver, notes,
          items: rows.map((r) => ({
            id: r.itemId, po_item_id: r.po_item_id, ...(num(r.qty) !== num(r.qty0) ? { quantity_received: num(r.qty) } : {}), lot_number: r.lot_number || null, notes: r.notes || null,
            production_date: r.production_date || null, expiry_date: r.expiry_date || null,
          })),
        })
        await uploadAttachments('grn', id, attFiles)
        showSuccess('GRN diperbarui')
      } else {
        const created = await axiosInstance.post('/api/purchasing/grn', {
          po_id: poId, supplier_id: supplierId, receipt_date: receiptDate, grn_number: manualNumber.trim() || undefined,
          delivery_note_number: deliveryNote || null, supplier_invoice_number: supInvNo.trim() || null, vehicle_number: vehicle || null, driver_name: driver || null, notes: notes || null,
          items: active.flatMap((r) => {
            const base = {
              po_item_id: r.po_item_id, product_id: r.product_id, material_id: r.material_id, quantity_ordered: r.po_item_id ? r.ordered : num(r.qty),
              uom: r.uom, location_id: r.is_service ? null : r.location_id, lot_number: r.lot_number || null,
              production_date: r.production_date || null, expiry_date: r.expiry_date || null, notes: r.notes || null,
            }
            const parts = parseBatches(r.batch_number)
            if (parts.length > 1) return batchQtys(r).filter((b) => b.qty > 0).map((b) => ({ ...base, quantity_received: b.qty, quantity_accepted: b.qty, batch_number: b.batch }))
            return [{ ...base, quantity_received: num(r.qty), quantity_accepted: num(r.qty), batch_number: parts[0] || r.batch_number.trim() || null }]
          }),
        })
        await uploadAttachments('grn', created.data?.grn_id, attFiles)
        showSuccess('Penerimaan barang dicatat dan stok bertambah')
      }
      if (tab) clearTabDrafts(tab.tabId)
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
            {isEdit ? 'Data pengiriman, lot, tanggal, dan catatan bisa diubah (juga setelah disetujui). Jumlah dan gudang terkunci setelah disetujui atau difaktur.' : 'Pilih pemasok, lalu ambil dari PO atau tambahkan barang manual. Stok bertambah saat disimpan; jasa tidak perlu gudang.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={submit} onKeyDown={enterMovesDown} className="space-y-6">
<PendingAttachments files={attFiles} onChange={setAttFiles} entityType="grn" entityId={isEdit ? id : undefined} />
        <div className="card p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Nomor Penerimaan</label>
            {isEdit ? (
              <div className="input-field bg-gray-50 dark:bg-gray-900">{grnNumber || '-'}</div>
            ) : (
              <input className="input-field" value={manualNumber} onChange={(e) => setManualNumber(e.target.value)} placeholder={nextNumber ? `${nextNumber} (otomatis)` : 'Otomatis'} />
            )}
            {!isEdit && <p className="mt-1 text-xs text-gray-500">Kosongkan untuk nomor otomatis (BPB-tahun-bulan-urut), atau isi nomor sendiri.</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Pemasok *</label>
            {isEdit ? (
              <div className="input-field bg-gray-50 dark:bg-gray-900">{supplierName || '-'}</div>
            ) : (
              <SearchableSelect
                options={suppliers.map((x: any) => ({ id: x.id, name: `${x.company_name}${x.supplier_type ? ' [' + x.supplier_type + (x.supplier_subtype ? ' - ' + x.supplier_subtype : '') + ']' : ''}` }))}
                value={supplierId}
                onChange={(v) => { setSupplierId(v ? Number(v) : null); setPoId(null) }}
                placeholder="Pilih pemasok dulu"
                className="w-full"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Ambil dari Purchase Order (opsional)</label>
            {isEdit ? (
              <div className="input-field bg-gray-50 dark:bg-gray-900">{po?.po_number || (poId ? `PO #${poId}` : 'Tanpa PO')}</div>
            ) : (
              <SearchableSelect
                options={orders.map((o) => ({ id: o.id, name: `${o.po_number} (${o.status === 'partial' ? 'sebagian' : 'disetujui'})` }))}
                value={poId}
                onChange={(v) => { setNotesTouched(false); setPoId(v ? Number(v) : null) }}
                placeholder={supplierId ? (orders.length ? 'Pilih PO pemasok ini' : 'Tidak ada PO yang bisa diterima') : 'Pilih pemasok dulu'}
                className="w-full"
              />
            )}
            {!isEdit && <p className="mt-1 text-xs text-gray-500">{loadError || 'Kosongkan bila barang datang tanpa PO, lalu tambahkan barang di bawah.'}</p>}
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">No. Faktur Pemasok</label>
            <input className="input-field" value={supInvNo} onChange={(e) => setSupInvNo(e.target.value)} placeholder="Nomor seri/faktur dari pemasok (ikut ke faktur pembelian)" />
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
            <textarea className="input-field" rows={2} value={notes} onChange={(e) => { setNotesTouched(true); setNotes(e.target.value) }} placeholder="Catatan umum penerimaan" />
          </div>
        </div>

        {(rows.length > 0 || (!isEdit && supplierId)) && (
          <div className="card p-6 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Barang Diterima</h2>
              {!isEdit && (
                <div className="w-full sm:w-80">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Terapkan lokasi gudang ke semua baris barang</label>
                  <SearchableSelect options={locationOptions} value={bulkLocation} onChange={(v) => applyBulk(v ? Number(v) : null)} placeholder="Pilih lokasi" className="w-full" />
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 pr-3">Nama</th>
                    {!isEdit && <th className="pb-2 pr-3 text-right">Dipesan</th>}
                    {!isEdit && <th className="pb-2 pr-3 text-right">Sudah Diterima</th>}
                    <th className="pb-2 pr-3 text-right w-36">{isEdit ? 'Diterima' : 'Diterima Sekarang'}</th>
                    <th className="pb-2 pr-3 w-56">Keterangan</th>
                    <th className="pb-2 pr-3 w-64">Lokasi Gudang</th>
                    <th className="pb-2 pr-3 w-40">Batch</th>
                    <th className="pb-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const outstanding = Math.max(0, r.ordered - r.receivedBefore)
                    const over = !isEdit && r.po_item_id !== null && num(r.qty) > outstanding + 1e-9
                    return (
                      <Fragment key={r.key}>
                        <tr className="border-b border-gray-100 dark:border-gray-700 align-top">
                          <td className="py-2 pr-3">
                            <div className="font-medium text-gray-900 dark:text-white">{r.name}</div>
                            {r.code && <div className="text-xs text-gray-400">{r.code}</div>}
                          </td>
                          {!isEdit && <td className="py-2 pr-3 text-right tabular-nums">{r.po_item_id ? `${r.ordered.toLocaleString('id-ID')} ${r.uom}` : r.uom}</td>}
                          {!isEdit && <td className="py-2 pr-3 text-right tabular-nums">{r.po_item_id ? r.receivedBefore.toLocaleString('id-ID') : '-'}</td>}
                          <td className="py-2 pr-3">
                            {isEdit ? (
                              <>
                                <NumberInput className="input-field text-right" value={r.qty as any} onChange={(e: any) => update(i, { qty: e.target.value })} />
                                <p className="mt-1 text-right text-xs text-gray-500">{r.uom}</p>
                              </>
                            ) : (
                              <>
                                <NumberInput data-col="qty" className="input-field text-right" value={r.qty as any} onChange={(e: any) => update(i, { qty: e.target.value })} />
                                {over && <p className="mt-1 text-xs text-amber-600">Melebihi sisa PO ({outstanding.toLocaleString('id-ID')})</p>}
                              </>
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            <input className="input-field" value={r.notes} onChange={(e) => update(i, { notes: e.target.value })} placeholder="Catatan baris (opsional)" />
                          </td>
                          <td className="py-2 pr-3">
                            {isEdit ? (
                              <div className="text-sm">{locationOptions.find((l) => l.id === r.location_id)?.name || '-'}</div>
                            ) : r.is_service ? (
                              <div className="text-xs text-gray-500">Jasa, tidak masuk gudang</div>
                            ) : (
                              <SearchableSelect options={locationOptions} value={r.location_id} onChange={(v) => update(i, { location_id: v ? Number(v) : null })} placeholder="Pilih lokasi" className="w-full" />
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            {isEdit ? <div className="text-sm">{r.batch_number || '-'}</div>
                              : (
                                <button type="button" data-col="batch" onClick={() => openBatch(i)} className="input-field w-full text-left truncate" title={r.batch_number || 'Isi nomor batch'}>
                                  {parseBatches(r.batch_number).length === 0 ? <span className="text-gray-400">Isi batch</span>
                                    : parseBatches(r.batch_number).length === 1 ? r.batch_number
                                    : `${parseBatches(r.batch_number).length} batch`}
                                </button>
                              )}
                          </td>
                          <td className="py-2 whitespace-nowrap">
                            {!isEdit && r.po_item_id === null && <button type="button" onClick={() => removeRow(i)} className="p-1 text-xs text-red-600 hover:underline" title="Hapus baris">Hapus</button>}
                            <button type="button" onClick={() => update(i, { open: !r.open })} className="p-1 text-gray-500 hover:text-gray-800" title="Lot, tanggal, catatan">
                              {r.open ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                            </button>
                          </td>
                        </tr>
                        {r.open && (
                          <tr key={`${r.key}-d`} className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                            <td colSpan={8} className="p-3">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div><label className="block text-xs text-gray-500 mb-1">No. Lot</label><input data-col="lot" className="input-field" value={r.lot_number} onChange={(e) => update(i, { lot_number: e.target.value })} /></div>
                                <div><label className="block text-xs text-gray-500 mb-1">Tanggal Produksi</label><input type="date" className="input-field" value={r.production_date} onChange={(e) => update(i, { production_date: e.target.value })} /></div>
                                <div><label className="block text-xs text-gray-500 mb-1">Tanggal Kadaluarsa{r.requireExpiry ? ' *' : ''}</label><input type="date" className="input-field" value={r.expiry_date} onChange={(e) => update(i, { expiry_date: e.target.value })} /></div>
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
              <div className="w-full sm:w-96">
                <label className="block text-xs font-medium text-gray-500 mb-1">Tambah barang manual (tanpa PO)</label>
                <SearchableSelect options={materialOptions} value={null} onChange={(v) => addManualRow(v ? Number(v) : null)} placeholder="Cari kode atau nama barang" className="w-full" />
              </div>
            )}
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
          <button type="submit" disabled={saving || (!isEdit && !supplierId)} className="btn-primary disabled:opacity-50">{saving ? 'Menyimpan...' : isEdit ? 'Simpan Koreksi' : 'Simpan Penerimaan'}</button>
        </div>
      </form>
      {batchEdit && (() => {
        const r = rows[batchEdit.i]
        const multi = batchEdit.list.length > 1
        const sum = batchEdit.list.reduce((a, b) => a + num(b.qty), 0)
        const setItem = (k: number, patch: Partial<{ batch: string; qty: string }>) => setBatchEdit({ ...batchEdit, list: batchEdit.list.map((b, idx) => (idx === k ? { ...b, ...patch } : b)) })
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setBatchEdit(null)}>
            <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Nomor batch</h3>
              <p className="mb-3 text-xs text-gray-500">{r.name}. Satu baris per batch. Kalau lebih dari satu, isi jumlah tiap batch; totalnya harus {num(r.qty).toLocaleString('id-ID')} {r.uom}.</p>
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {batchEdit.list.map((b, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <input autoFocus={k === batchEdit.list.length - 1} className="input-field flex-1" value={b.batch} placeholder="No. batch" onChange={(e) => setItem(k, { batch: e.target.value })} />
                    {multi && <NumberInput className="input-field w-32 text-right" value={b.qty as any} onChange={(e: any) => setItem(k, { qty: e.target.value })} />}
                    {multi && <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => setBatchEdit({ ...batchEdit, list: batchEdit.list.filter((_, idx) => idx !== k) })}>Hapus</button>}
                  </div>
                ))}
              </div>
              <button type="button" className="mt-3 text-sm text-blue-600 hover:underline" onClick={() => setBatchEdit({ ...batchEdit, list: [...batchEdit.list, { batch: '', qty: '0' }] })}>+ Tambah batch</button>
              {multi && <p className={`mt-2 text-xs ${Math.abs(sum - num(r.qty)) > 0.01 ? 'text-red-600' : 'text-gray-500'}`}>Total batch: {sum.toLocaleString('id-ID')} dari {num(r.qty).toLocaleString('id-ID')}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setBatchEdit(null)}>Batal</button>
                <button type="button" className="btn-primary" onClick={saveBatch}>Simpan batch</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
