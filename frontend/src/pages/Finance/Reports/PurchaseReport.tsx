import React, { useMemo, useState } from 'react'
import { ShoppingBagIcon } from '@heroicons/react/24/outline'
import { DataTable, DocLink, ExportButtons, LoadState, Money, PeriodFilter, ReportShell, SearchBox, StatCards, Td, Th, downloadExcel, fmtDate, idr, periodLabel, useReport, usePeriod } from './reportKit'

const STATUS: Record<string, string> = { paid: 'bg-emerald-50 text-emerald-700', partial: 'bg-amber-50 text-amber-700', draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-50 text-blue-700' }

export default function PurchaseReport() {
  const p = usePeriod('Bulan ini')
  const [view, setView] = useState<'invoice' | 'supplier'>('invoice')
  const [supplier, setSupplier] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const params = { date_from: p.from, date_to: p.to }
  const { data, loading, error, reload } = useReport<any>('purchase-report', params)
  const rows = useMemo(() => (data?.rows || []).filter((r: any) => (!supplier || r.supplier_id === supplier) &&
    (!q || `${r.invoice_number} ${r.supplier_name} ${r.po_number} ${r.supplier_invoice_number}`.toLowerCase().includes(q.toLowerCase()))), [data, supplier, q])
  const t = data?.totals
  return (
    <ReportShell title="Laporan Pembelian" subtitle={`Faktur pembelian per faktur dan per supplier · ${periodLabel(p.from, p.to)}`}
      icon={<ShoppingBagIcon className="h-7 w-7 text-emerald-600" />}
      actions={<ExportButtons onExcel={() => downloadExcel('purchase-report', { ...params, group: view })} />}>
      <PeriodFilter from={p.from} to={p.to} onChange={p.setRange} onReload={reload} loading={loading} extra={<SearchBox value={q} onChange={setQ} placeholder="Cari faktur / supplier / PO" />} />
      {t && <StatCards items={[
        { label: 'DPP', value: idr(t.subtotal) }, { label: 'PPN Masukan', value: idr(t.tax) },
        { label: 'Total Pembelian', value: idr(t.total), tone: 'blue' }, { label: 'Belum Dibayar', value: idr(t.balance), tone: t.balance > 0 ? 'amber' : 'green' },
      ]} />}
      <div className="print-hide flex gap-1 rounded-lg bg-gray-100 p-1 w-fit dark:bg-gray-700">
        {([['invoice', 'Per Faktur'], ['supplier', 'Per Supplier']] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => { setView(k); if (k === 'supplier') setSupplier(null) }}
            className={`rounded-md px-4 py-1.5 text-sm ${view === k ? 'bg-white font-semibold shadow dark:bg-gray-900' : 'text-gray-500'}`}>{label}</button>
        ))}
      </div>
      <LoadState loading={loading} error={error} empty={!!data && !data.rows.length} emptyText="Tidak ada faktur pembelian pada periode ini.">
        {data && view === 'supplier' && (
          <DataTable>
            <thead><tr><Th>Supplier</Th><Th right>Jml Faktur</Th><Th right>DPP</Th><Th right>PPN</Th><Th right>Total</Th><Th right>Dibayar</Th><Th right>Sisa</Th></tr></thead>
            <tbody>
              {data.by_supplier.map((s: any) => (
                <tr key={s.supplier_id} onClick={() => { setSupplier(s.supplier_id); setView('invoice') }} className="cursor-pointer border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40">
                  <Td className="font-medium">{s.supplier_name || '-'}</Td><Td right>{s.invoice_count}</Td><Td right><Money v={s.subtotal} /></Td><Td right><Money v={s.tax} /></Td>
                  <Td right className="font-semibold"><Money v={s.total} /></Td><Td right><Money v={s.paid} /></Td><Td right><Money v={s.balance} colored /></Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
        {data && view === 'invoice' && (
          <>
            {supplier && <p className="print-hide mb-2 text-sm text-gray-600">Menampilkan satu supplier. <button type="button" className="text-emerald-700 hover:underline" onClick={() => setSupplier(null)}>Tampilkan semua</button></p>}
            <DataTable maxHeight="62vh">
              <thead><tr><Th>Tanggal</Th><Th>No. Faktur</Th><Th>Faktur Supplier</Th><Th>Supplier</Th><Th>PO</Th><Th right>DPP</Th><Th right>PPN</Th><Th right>Total</Th><Th right>Sisa</Th><Th>Status</Th></tr></thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.invoice_id} className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40">
                    <Td className="whitespace-nowrap">{fmtDate(r.invoice_date)}</Td><Td className="whitespace-nowrap"><DocLink url={r.url}>{r.invoice_number}</DocLink></Td>
                    <Td>{r.supplier_invoice_number || '-'}</Td><Td>{r.supplier_name || '-'}{r.currency !== 'IDR' && <span className="ml-1 text-xs text-gray-500">({r.currency} @ {r.rate})</span>}</Td><Td>{r.po_number || '-'}</Td>
                    <Td right><Money v={r.subtotal} /></Td><Td right><Money v={r.tax} /></Td><Td right className="font-semibold"><Money v={r.total} /></Td><Td right><Money v={r.balance} colored /></Td>
                    <Td><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[r.status] || 'bg-gray-100 text-gray-600'}`}>{r.status}</span></Td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="bg-emerald-600 text-white">
                <td colSpan={5} className="px-3 py-2.5 text-right font-bold">TOTAL ({rows.length} faktur)</td>
                {['subtotal', 'tax', 'total'].map((k) => <td key={k} className="px-3 py-2.5 text-right font-bold tabular-nums">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(rows.reduce((a: number, r: any) => a + r[k], 0))}</td>)}
                <td className="px-3 py-2.5 text-right font-bold tabular-nums">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(rows.reduce((a: number, r: any) => a + r.balance, 0))}</td><td />
              </tr></tfoot>
            </DataTable>
          </>
        )}
      </LoadState>
    </ReportShell>
  )
}
