import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BanknotesIcon } from '@heroicons/react/24/outline'
import { DataTable, ExportButtons, LoadState, Money, PeriodFilter, ReportShell, StatCards, Td, Th, downloadExcel, fmtDate, idr, iso, useReport } from './reportKit'

export default function CashPosition() {
  const navigate = useNavigate()
  const [asOf, setAsOf] = useState(iso(new Date()))
  const params = { as_of: asOf }
  const { data, loading, error, reload } = useReport<any>('cash-position', params)
  const max = Math.max(1, ...(data?.rows || []).map((r: any) => Math.abs(r.balance)))
  return (
    <ReportShell title="Posisi Kas & Bank" subtitle={`Saldo seluruh rekening kas dan bank per ${fmtDate(asOf)}`}
      icon={<BanknotesIcon className="h-7 w-7 text-emerald-600" />} actions={<ExportButtons onExcel={() => downloadExcel('cash-position', params)} />}>
      <PeriodFilter single from={asOf} to={asOf} onChange={(_, to) => setAsOf(to)} onReload={reload} loading={loading} />
      {data && <StatCards items={[
        { label: 'Total Kas & Bank', value: idr(data.total), tone: 'blue' }, { label: 'Jumlah Rekening', value: String(data.rows.length) },
        { label: 'Rekening Terbesar', value: data.rows.length ? data.rows.slice().sort((a: any, b: any) => b.balance - a.balance)[0].name : '-' },
      ]} />}
      <LoadState loading={loading} error={error} empty={!!data && !data.rows.length} emptyText="Belum ada akun kas/bank.">
        {data && (
          <DataTable>
            <thead><tr><Th>Kode</Th><Th>Rekening</Th><Th>Proporsi</Th><Th right>Saldo</Th><Th>Transaksi Terakhir</Th></tr></thead>
            <tbody>
              {data.rows.map((r: any) => (
                <tr key={r.account_id} onClick={() => navigate(`/app/finance/reports/bank-mutation?account=${r.account_id}`)}
                  className="cursor-pointer border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40">
                  <Td className="font-mono text-xs">{r.code}</Td><Td className="font-medium">{r.name}</Td>
                  <Td className="w-48"><div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700"><div className={`h-2 rounded-full ${r.balance < 0 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (Math.abs(r.balance) / max) * 100)}%` }} /></div></Td>
                  <Td right className="font-semibold"><Money v={r.balance} zeroDash={false} colored /></Td><Td>{fmtDate(r.last_transaction)}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="bg-emerald-600 text-white"><td colSpan={3} className="px-3 py-2.5 text-right font-bold">TOTAL</td><td className="px-3 py-2.5 text-right font-bold tabular-nums">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(data.total)}</td><td /></tr></tfoot>
          </DataTable>
        )}
      </LoadState>
      <p className="print-hide text-xs text-gray-500">Klik rekening untuk melihat mutasinya.</p>
    </ReportShell>
  )
}
