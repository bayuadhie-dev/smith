import React from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ReceiptPercentIcon } from '@heroicons/react/24/outline'
import { DataTable, DocLink, ExportButtons, LoadState, Money, ReportShell, StatCards, Td, Th, downloadExcel, fmtDate, idr, useReport } from './reportKit'

export default function VatDetail() {
  const { month } = useParams()
  const [sp] = useSearchParams()
  const navigate = useNavigate()
  const kind = sp.get('kind') === 'input' ? 'input' : 'output'
  const params = { month, kind }
  const { data, loading, error } = useReport<any>('vat-detail', params)
  return (
    <ReportShell title={`PPN ${kind === 'output' ? 'Keluaran' : 'Masukan'} — ${month}`} subtitle={kind === 'output' ? 'Faktur penjualan yang dikenai PPN' : 'Faktur pembelian yang dikenai PPN'}
      icon={<ReceiptPercentIcon className="h-7 w-7 text-emerald-600" />} backTo="/app/finance/reports/vat" backLabel="Rekap PPN"
      actions={<><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => navigate(`/app/finance/reports/vat/${month}?kind=${kind === 'output' ? 'input' : 'output'}`)}>Lihat PPN {kind === 'output' ? 'Masukan' : 'Keluaran'}</button><ExportButtons onExcel={() => downloadExcel('vat-detail', params)} /></>}>
      {data && <StatCards items={[{ label: 'DPP', value: idr(data.totals.base) }, { label: 'PPN', value: idr(data.totals.vat), tone: 'blue' }, { label: 'Jumlah Faktur', value: String(data.rows.length) }]} />}
      <LoadState loading={loading} error={error} empty={!!data && !data.rows.length} emptyText="Tidak ada faktur ber-PPN pada bulan ini.">
        {data && (
          <DataTable>
            <thead><tr><Th>Tanggal</Th><Th>No. Faktur</Th><Th>{kind === 'output' ? 'Customer' : 'Supplier'}</Th><Th>NPWP</Th><Th right>DPP</Th><Th right>PPN</Th></tr></thead>
            <tbody>
              {data.rows.map((r: any) => (
                <tr key={r.invoice_id} className="border-t border-gray-100 dark:border-gray-700">
                  <Td className="whitespace-nowrap">{fmtDate(r.invoice_date)}</Td><Td><DocLink url={r.url}>{r.invoice_number}</DocLink></Td><Td>{r.party_name || '-'}</Td>
                  <Td className={r.tax_id ? 'font-mono text-xs' : 'text-amber-600'}>{r.tax_id || 'NPWP kosong'}</Td><Td right><Money v={r.base} /></Td><Td right className="font-semibold"><Money v={r.vat} /></Td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="bg-gray-50 font-semibold dark:bg-gray-700/40"><Td colSpan={4} right>Total</Td><Td right><Money v={data.totals.base} /></Td><Td right><Money v={data.totals.vat} /></Td></tr></tfoot>
          </DataTable>
        )}
      </LoadState>
    </ReportShell>
  )
}
