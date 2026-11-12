import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import { PageHeader } from '../../components/ui/PageKit'
import { showError, showSuccess } from '../../components/ui'
import NumberInput from '../../components/ui/NumberInput'

interface SrcLine { material_id: number | null; product_id: number | null; item_code: string | null; item_name: string; uom: string | null; quantity: number; batch_number: string | null }
interface Source { source_type: string; source_id: number; source_number: string; from_location_id: number | null; lines: SrcLine[] }
interface Loc { id: number; location_code: string; zone_name?: string }

export default function StockTransferForm() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [sources, setSources] = useState<Source[]>([])
  const [locs, setLocs] = useState<Loc[]>([])
  const [srcKind, setSrcKind] = useState<'material_issue' | 'grn' | 'packing_list'>(params.get('grn') ? 'grn' : 'material_issue')
  const [srcKey, setSrcKey] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [notes, setNotes] = useState('')
  const [qty, setQty] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    axiosInstance.get('/api/stock-transfers/sources').then((r) => setSources(r.data.sources || [])).catch(() => showError('Sumber pemindahan gagal dimuat'))
    axiosInstance.get('/api/warehouse/locations', { params: { per_page: 1000 } }).then((r) => setLocs(r.data.locations || [])).catch(() => showError('Daftar lokasi gagal dimuat'))
  }, [])

  useEffect(() => {
    const g = params.get('grn')
    if (g && sources.some((x) => x.source_type === 'grn' && String(x.source_id) === g)) { setSrcKind('grn'); setSrcKey(`grn:${g}`) }
  }, [sources]) // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => sources.filter((s) => s.source_type === srcKind), [sources, srcKind])
  const src = useMemo(() => list.find((s) => `${s.source_type}:${s.source_id}` === srcKey) || null, [list, srcKey])

  useEffect(() => {
    if (!src) { setQty({}); return }
    setQty(Object.fromEntries(src.lines.map((l, i) => [i, String(l.quantity)])))
    if (src.from_location_id) setFrom(String(src.from_location_id))
  }, [src])

  const locLabel = (l: Loc) => `${l.zone_name ? l.zone_name + ' / ' : ''}${l.location_code}`

  const submit = async () => {
    if (!src) return showError('Pilih sumber pemindahan')
    if (!from || !to) return showError('Pilih gudang/lokasi asal dan tujuan')
    const lines = src.lines.map((l, i) => ({ ...l, quantity: Number(qty[i]) || 0 })).filter((l) => l.quantity > 0)
    if (!lines.length) return showError('Isi qty minimal satu barang')
    setBusy(true)
    try {
      const r = await axiosInstance.post('/api/stock-transfers', { source_type: src.source_type, source_id: src.source_id, from_location_id: Number(from), to_location_id: Number(to), notes, lines })
      showSuccess(`Pemindahan ${r.data.transfer_number} dibuat`)
      navigate(`/app/warehouse/transfers/${r.data.id}`)
    } catch (e: any) {
      showError(e?.response?.data?.error || 'Gagal membuat pemindahan')
    } finally { setBusy(false) }
  }

  const sel = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white'
  const lbl = 'mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400'
  return (
    <div className="space-y-4 p-6">
      <PageHeader title="Pemindahan Barang Baru" subtitle="Pilih sumbernya dulu. Barang jadi (FG) wajib dari Packing List sebagai dokumen serah terima produksi ke gudang" />
      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={lbl}>Ambil dari</label>
            <div className="flex gap-2">
              {([['material_issue', 'Permintaan Barang'], ['grn', 'Penerimaan Barang'], ['packing_list', 'Packing List (FG)']] as const).map(([k, t]) => (
                <button key={k} type="button" onClick={() => { setSrcKind(k); setSrcKey('') }}
                  className={`rounded-md border px-3 py-2 text-sm ${srcKind === k ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200' : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300'}`}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className={lbl}>{srcKind === 'grn' ? 'No. Penerimaan Barang' : srcKind === 'packing_list' ? 'Packing List (No. SPK)' : 'No. Permintaan Barang'}</label>
            <select className={sel} value={srcKey} onChange={(e) => setSrcKey(e.target.value)}>
              <option value="">Pilih...</option>
              {list.map((s) => <option key={`${s.source_type}:${s.source_id}`} value={`${s.source_type}:${s.source_id}`}>{s.source_number} ({s.lines.length} barang)</option>)}
            </select>
            {list.length === 0 && <p className="mt-1 text-xs text-gray-500">Tidak ada {srcKind === 'grn' ? 'penerimaan' : srcKind === 'packing_list' ? 'Packing List' : 'permintaan'} yang masih punya qty belum dipindahkan.</p>}
          </div>
          <div>
            <label className={lbl}>Gudang/lokasi asal</label>
            <select className={sel} value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="">Pilih...</option>
              {locs.map((l) => <option key={l.id} value={l.id}>{locLabel(l)}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Gudang/lokasi tujuan</label>
            <select className={sel} value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">Pilih...</option>
              {locs.filter((l) => String(l.id) !== from).map((l) => <option key={l.id} value={l.id}>{locLabel(l)}</option>)}
            </select>
          </div>
        </div>

        {src && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900"><tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Barang</th><th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Batch</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Diminta</th><th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Dipindahkan</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {src.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{l.item_code ? `${l.item_code} - ` : ''}{l.item_name}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{l.batch_number || '-'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.quantity.toLocaleString('id-ID', { maximumFractionDigits: 4 })} {l.uom}</td>
                    <td className="w-40 px-3 py-2"><NumberInput className="w-full rounded-md border border-gray-300 px-2 py-1 text-right dark:border-gray-600 dark:bg-gray-800" value={qty[i] ?? ''} onChange={(e: any) => setQty((q) => ({ ...q, [i]: e.target.value }))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <label className={lbl}>Catatan</label>
          <textarea className={sel} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => navigate('/app/warehouse/transfers')} className="rounded-md border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 dark:text-gray-200">Batal</button>
          <button type="button" disabled={busy} onClick={submit} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">Simpan draft</button>
        </div>
      </div>
    </div>
  )
}
