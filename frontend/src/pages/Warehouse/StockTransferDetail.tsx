import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import { PageHeader, Panel } from '../../components/ui/PageKit'
import { confirmDialog, showError, showSuccess } from '../../components/ui'
import NumberInput from '../../components/ui/NumberInput'
import { TRANSFER_STATUS } from './StockTransferList'

export default function StockTransferDetail() {
  const { id } = useParams()
  const [t, setT] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [recv, setRecv] = useState<Record<number, string>>({})
  const [notes, setNotes] = useState('')

  const load = async () => {
    try {
      const r = await axiosInstance.get(`/api/stock-transfers/${id}`)
      setT(r.data)
      setRecv(Object.fromEntries((r.data.lines || []).map((l: any) => [l.id, String(l.outstanding)])))
    } catch { showError('Pemindahan gagal dimuat') }
  }
  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (path: string, body: any, ok: string) => {
    setBusy(true)
    try { const r = await axiosInstance.post(`/api/stock-transfers/${id}/${path}`, body); showSuccess(r.data.message || ok); await load() }
    catch (e: any) { showError(e?.response?.data?.error || 'Proses gagal') }
    finally { setBusy(false) }
  }

  if (!t) return <div className="p-6 text-sm text-gray-500">Memuat...</div>
  const st = TRANSFER_STATUS[t.status] || { label: t.status, cls: '' }
  const canReceive = t.status === 'shipped' || t.status === 'partial'
  const th = 'px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400'
  const n = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 4 })
  return (
    <div className="space-y-4 p-6">
      <PageHeader title={t.transfer_number} subtitle={`${t.from_label} ke ${t.to_label}${t.source_number ? ` · dari ${t.source_number}` : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
            {t.status === 'draft' && <>
              <button disabled={busy} onClick={async () => { if (await confirmDialog('Kirim barang? Stok langsung keluar dari gudang asal dan menunggu diterima di tujuan.')) act('ship', {}, 'Dikirim') }} className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">Kirim barang</button>
              <button disabled={busy} onClick={async () => { if (await confirmDialog('Batalkan draft pemindahan ini?')) act('cancel', {}, 'Dibatalkan') }} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:text-gray-200">Batalkan</button>
            </>}
          </div>
        } />
      <Panel title="Barang">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
            <thead><tr><th className={th}>Barang</th><th className={th}>Batch</th><th className={`${th} text-right`}>Dipindahkan</th><th className={`${th} text-right`}>Diterima</th><th className={`${th} text-right`}>Sisa</th>{canReceive && <th className={`${th} text-right`}>Terima sekarang</th>}</tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {t.lines.map((l: any) => (
                <tr key={l.id}>
                  <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{l.item_code ? `${l.item_code} - ` : ''}{l.item_name}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{l.batch_number || '-'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(l.quantity)} {l.uom}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(l.received_quantity)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(l.outstanding)}</td>
                  {canReceive && <td className="w-40 px-3 py-2">{l.outstanding > 0 ? <NumberInput className="w-full rounded-md border border-gray-300 px-2 py-1 text-right dark:border-gray-600 dark:bg-gray-800" value={recv[l.id] ?? ''} onChange={(e: any) => setRecv((r) => ({ ...r, [l.id]: e.target.value }))} /> : <span className="text-xs text-gray-400">selesai</span>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canReceive && (
          <div className="mt-3 space-y-2">
            <textarea className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" rows={2} placeholder="Catatan penerimaan (opsional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="flex justify-end">
              <button disabled={busy} onClick={() => act('receive', { notes, lines: t.lines.map((l: any) => ({ line_id: l.id, quantity: Number(recv[l.id]) || 0 })).filter((x: any) => x.quantity > 0) }, 'Diterima')}
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">Terima barang ({t.transfer_number}-{t.receipts.length + 1})</button>
            </div>
          </div>
        )}
      </Panel>
      {t.receipts.length > 0 && (
        <Panel title="Riwayat penerimaan">
          <ul className="divide-y divide-gray-100 text-sm dark:divide-gray-700">
            {t.receipts.map((r: any) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium text-gray-900 dark:text-white">{r.receipt_number}</span>
                <span className="text-gray-600 dark:text-gray-300">{new Date(r.received_at).toLocaleString('id-ID')} · ke {r.to_label}</span>
                <span className="tabular-nums text-gray-700 dark:text-gray-200">{n(r.lines.reduce((s: number, x: any) => s + x.quantity, 0))}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {t.notes && <p className="text-sm text-gray-600 dark:text-gray-300">Catatan: {t.notes}</p>}
      <Link to="/app/warehouse/transfers" className="text-sm text-emerald-700 hover:underline">Kembali ke daftar</Link>
    </div>
  )
}
