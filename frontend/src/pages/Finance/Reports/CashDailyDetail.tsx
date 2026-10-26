import React from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CalendarDaysIcon } from '@heroicons/react/24/outline'
import { DataTable, DocLink, ExportButtons, LoadState, Money, ReportShell, StatCards, Td, Th, downloadExcel, fmtDate, idr, useReport } from './reportKit'

export default function CashDailyDetail() {
  const { date } = useParams()
  const [sp] = useSearchParams()
  const params = { date, account_id: sp.get('account') || undefined }
  const { data, loading, error } = useReport<any>('cash-daily-detail', params)
  return (
    <ReportShell title={`Kas & Bank — ${fmtDate(date)}`} subtitle="Semua transaksi kas/bank pada hari ini beserta akun lawannya"
      icon={<CalendarDaysIcon className="h-7 w-7 text-emerald-600" />} backTo="/app/finance/reports/cash-daily" backLabel="Rekap Kas Harian"
      actions={<ExportButtons onExcel={() => downloadExcel('cash-daily-detail', params)} />}>
      {data && <StatCards items={[
        { label: 'Penerimaan', value: idr(data.totals.receipts), tone: 'green' }, { label: 'Pengeluaran', value: idr(data.totals.disbursements), tone: 'red' },
        { label: 'Mutasi Bersih', value: idr(data.totals.receipts - data.totals.disbursements), tone: 'blue' }, { label: 'Jumlah Baris', value: String(data.rows.length) },
      ]} />}
      <LoadState loading={loading} error={error} empty={!!data && !data.rows.length}>
        {data && (
          <DataTable>
            <thead><tr><Th>No. Jurnal</Th><Th>Rekening</Th><Th>Keterangan</Th><Th>Akun Lawan</Th><Th>Referensi</Th><Th right>Penerimaan</Th><Th right>Pengeluaran</Th></tr></thead>
            <tbody>
              {data.rows.map((r: any) => (
                <tr key={r.id} className="border-t border-gray-100 dark:border-gray-700">
                  <Td className="whitespace-nowrap font-mono text-xs">{r.entry_number}</Td><Td className="whitespace-nowrap">{r.account_code} {r.account_name}</Td>
                  <Td className="max-w-sm">{r.description}</Td><Td className="max-w-xs text-xs text-gray-600">{r.counter_accounts || '-'}</Td>
                  <Td><DocLink url={r.document_url}>{r.reference_number || r.reference_type || '-'}</DocLink></Td>
                  <Td right className="text-emerald-700"><Money v={r.receipt} /></Td><Td right className="text-red-600"><Money v={r.disbursement} /></Td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="bg-gray-50 font-semibold dark:bg-gray-700/40"><Td colSpan={5} right>Total</Td><Td right><Money v={data.totals.receipts} /></Td><Td right><Money v={data.totals.disbursements} /></Td></tr></tfoot>
          </DataTable>
        )}
      </LoadState>
    </ReportShell>
  )
}
