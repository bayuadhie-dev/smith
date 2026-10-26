import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScaleIcon } from '@heroicons/react/24/outline'
import { DataTable, ExportButtons, LoadState, Money, PeriodFilter, ReportShell, SearchBox, StatCards, Td, Th, downloadExcel, idr, periodLabel, useReport, usePeriod } from './reportKit'

const GROUPS: [string, string][] = [['asset', 'Aset'], ['liability', 'Liabilitas'], ['equity', 'Ekuitas'], ['revenue', 'Pendapatan'], ['expense', 'Beban']]

export default function TrialBalance() {
  const navigate = useNavigate()
  const p = usePeriod('Bulan ini')
  const [hideZero, setHideZero] = useState(true)
  const [q, setQ] = useState('')
  const params = { date_from: p.from, date_to: p.to, hide_zero: hideZero }
  const { data, loading, error, reload } = useReport<any>('trial-balance', params)

  const rows = useMemo(() => (data?.rows || []).filter((r: any) => !q || `${r.account_code} ${r.account_name}`.toLowerCase().includes(q.toLowerCase())), [data, q])
  const open = (r: any) => navigate(`/app/finance/reports/ledger/${r.account_id}?date_from=${p.from}&date_to=${p.to}`)
  const t = data?.totals

  return (
    <ReportShell title="Neraca Saldo" subtitle={`Saldo awal, mutasi, dan saldo akhir seluruh akun · ${periodLabel(p.from, p.to)}`}
      icon={<ScaleIcon className="h-7 w-7 text-emerald-600" />} actions={<ExportButtons onExcel={() => downloadExcel('trial-balance', params)} />}>
      <PeriodFilter from={p.from} to={p.to} onChange={p.setRange} onReload={reload} loading={loading} extra={
        <>
          <label className="flex items-center gap-2 pb-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} /> Sembunyikan akun tanpa saldo
          </label>
          <SearchBox value={q} onChange={setQ} placeholder="Cari kode / nama akun" />
        </>
      } />
      {t && (
        <StatCards items={[
          { label: 'Total Debit (mutasi)', value: idr(t.period_debit) },
          { label: 'Total Kredit (mutasi)', value: idr(t.period_credit) },
          { label: 'Saldo Akhir Debit', value: idr(t.closing_debit), tone: 'blue' },
          { label: 'Status', value: data.is_balanced ? 'Seimbang' : 'TIDAK SEIMBANG', tone: data.is_balanced ? 'green' : 'red', hint: `Selisih ${idr(Math.abs(t.closing_debit - t.closing_credit))}` },
        ]} />
      )}
      <LoadState loading={loading} error={error} empty={!rows.length}>
        <DataTable maxHeight="65vh">
          <thead>
            <tr>
              <Th className="w-24" >Kode</Th><Th>Nama Akun</Th>
              <Th right>Saldo Awal Debit</Th><Th right>Saldo Awal Kredit</Th>
              <Th right>Mutasi Debit</Th><Th right>Mutasi Kredit</Th>
              <Th right>Saldo Akhir Debit</Th><Th right>Saldo Akhir Kredit</Th>
            </tr>
          </thead>
          <tbody>
            {GROUPS.map(([type, label]) => {
              const items = rows.filter((r: any) => r.account_type === type)
              if (!items.length) return null
              const sum = (k: string) => items.reduce((a: number, r: any) => a + r[k], 0)
              return (
                <React.Fragment key={type}>
                  <tr className="bg-emerald-50/60 dark:bg-emerald-900/10"><Td colSpan={8} className="font-semibold text-emerald-800 dark:text-emerald-300">{label}</Td></tr>
                  {items.map((r: any) => (
                    <tr key={r.account_id} onClick={() => open(r)} className="cursor-pointer border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40">
                      <Td className="font-mono text-xs">{r.account_code}</Td><Td>{r.account_name}</Td>
                      <Td right><Money v={r.opening_debit} /></Td><Td right><Money v={r.opening_credit} /></Td>
                      <Td right><Money v={r.period_debit} /></Td><Td right><Money v={r.period_credit} /></Td>
                      <Td right><Money v={r.closing_debit} /></Td><Td right><Money v={r.closing_credit} /></Td>
                    </tr>
                  ))}
                  <tr className="border-t border-gray-200 bg-gray-50 font-semibold dark:border-gray-600 dark:bg-gray-700/40">
                    <Td colSpan={2} right>Subtotal {label}</Td>
                    {['opening_debit', 'opening_credit', 'period_debit', 'period_credit', 'closing_debit', 'closing_credit'].map((k) => <Td key={k} right><Money v={sum(k)} /></Td>)}
                  </tr>
                </React.Fragment>
              )
            })}
          </tbody>
          {t && (
            <tfoot>
              <tr className="sticky bottom-0 bg-emerald-600 text-white">
                <td colSpan={2} className="px-3 py-2.5 text-right font-bold">TOTAL</td>
                {['opening_debit', 'opening_credit', 'period_debit', 'period_credit', 'closing_debit', 'closing_credit'].map((k) => (
                  <td key={k} className="px-3 py-2.5 text-right font-bold tabular-nums">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(t[k])}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </DataTable>
        <p className="print-hide text-xs text-gray-500">Klik baris akun untuk melihat rincian transaksinya (buku besar).</p>
      </LoadState>
    </ReportShell>
  )
}
