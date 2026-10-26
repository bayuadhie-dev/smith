import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDaysIcon } from '@heroicons/react/24/outline'
import axiosInstance from '../../../utils/axiosConfig'
import SearchableSelect from '../../../components/SearchableSelect'
import { DataTable, ExportButtons, LoadState, Money, PeriodFilter, ReportShell, StatCards, Td, Th, fmtDate, idr, periodLabel, useReport, usePeriod } from './reportKit'

export default function CashDaily() {
  const navigate = useNavigate()
  const p = usePeriod('Bulan ini')
  const [accounts, setAccounts] = useState<{ id: number; code: string; name: string }[]>([])
  const [accountId, setAccountId] = useState('')
  useEffect(() => { axiosInstance.get('/api/finance/reports/cash-accounts').then((r) => setAccounts(r.data.accounts || [])).catch(() => setAccounts([])) }, [])
  const params = { date_from: p.from, date_to: p.to, account_id: accountId || undefined }
  const { data, loading, error, reload } = useReport<any>('cash-daily', params)
  const t = data?.totals
  return (
    <ReportShell title="Rekap Kas Harian" subtitle={`Penerimaan dan pengeluaran kas/bank per hari · ${periodLabel(p.from, p.to)}`}
      icon={<CalendarDaysIcon className="h-7 w-7 text-emerald-600" />} actions={<ExportButtons report={['cash-daily', params]} />}>
      <PeriodFilter from={p.from} to={p.to} onChange={p.setRange} onReload={reload} loading={loading} extra={
        <div className="min-w-[260px]">
          <label className="mb-1 block text-xs font-medium text-gray-500">Rekening</label>
          <SearchableSelect options={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name }))} value={accountId ? Number(accountId) : null}
            onChange={(v) => setAccountId(v ? String(v) : '')} placeholder="Semua kas & bank" />
        </div>
      } />
      {t && <StatCards items={[
        { label: 'Saldo Awal', value: idr(t.opening) }, { label: 'Total Penerimaan', value: idr(t.receipts), tone: 'green' },
        { label: 'Total Pengeluaran', value: idr(t.disbursements), tone: 'red' }, { label: 'Saldo Akhir', value: idr(t.closing), tone: 'blue' },
      ]} />}
      <LoadState loading={loading} error={error} empty={!!data && !data.rows.length && !data.accounts.length} emptyText="Tidak ada pergerakan kas/bank pada periode ini.">
        {data && (
          <div className="grid gap-5 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Per hari</h2>
              <DataTable maxHeight="60vh">
                <thead><tr><Th>Tanggal</Th><Th right>Saldo Awal</Th><Th right>Penerimaan</Th><Th right>Pengeluaran</Th><Th right>Saldo Akhir</Th><Th right>Transaksi</Th></tr></thead>
                <tbody>
                  {data.rows.map((r: any) => (
                    <tr key={r.date} onClick={() => navigate(`/app/finance/reports/cash-daily/${r.date}${accountId ? `?account=${accountId}` : ''}`)}
                      className="cursor-pointer border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40">
                      <Td className="whitespace-nowrap font-medium">{fmtDate(r.date)}</Td><Td right><Money v={r.opening} /></Td>
                      <Td right className="text-emerald-700"><Money v={r.receipts} /></Td><Td right className="text-red-600"><Money v={r.disbursements} /></Td>
                      <Td right className="font-medium"><Money v={r.closing} zeroDash={false} colored /></Td><Td right>{r.transactions}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              <p className="print-hide mt-1 text-xs text-gray-500">Klik satu hari untuk melihat rincian transaksinya.</p>
            </div>
            <div>
              <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Per rekening</h2>
              <DataTable>
                <thead><tr><Th>Rekening</Th><Th right>Masuk</Th><Th right>Keluar</Th><Th right>Saldo Akhir</Th></tr></thead>
                <tbody>
                  {data.accounts.map((a: any) => (
                    <tr key={a.account_id} onClick={() => navigate(`/app/finance/reports/ledger/${a.account_id}?date_from=${p.from}&date_to=${p.to}`)}
                      className="cursor-pointer border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40">
                      <Td><div className="font-medium">{a.name}</div><div className="font-mono text-xs text-gray-500">{a.code}</div></Td>
                      <Td right><Money v={a.receipts} /></Td><Td right><Money v={a.disbursements} /></Td><Td right className="font-medium"><Money v={a.closing} zeroDash={false} colored /></Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </div>
          </div>
        )}
      </LoadState>
    </ReportShell>
  )
}
