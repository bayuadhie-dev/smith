import React from 'react'
import { ChartBarSquareIcon } from '@heroicons/react/24/outline'
import { DataTable, ExportButtons, LoadState, Money, PeriodFilter, ReportShell, StatCards, Td, Th, downloadExcel, idr, periodLabel, useReport, usePeriod } from './reportKit'

export default function EquityChanges() {
  const p = usePeriod('Tahun ini')
  const params = { date_from: p.from, date_to: p.to }
  const { data, loading, error, reload } = useReport<any>('equity-changes', params)
  return (
    <ReportShell title="Laporan Perubahan Ekuitas" subtitle={`Modal, saldo awal, laba ditahan, dan laba periode berjalan · ${periodLabel(p.from, p.to)}`}
      icon={<ChartBarSquareIcon className="h-7 w-7 text-emerald-600" />} actions={<ExportButtons onExcel={() => downloadExcel('equity-changes', params)} />}>
      <PeriodFilter from={p.from} to={p.to} onChange={p.setRange} onReload={reload} loading={loading} />
      {data && <StatCards items={[
        { label: 'Ekuitas Awal', value: idr(data.total_opening) }, { label: 'Laba (Rugi) Periode', value: idr(data.period_profit), tone: data.period_profit >= 0 ? 'green' : 'red' },
        { label: 'Ekuitas Akhir', value: idr(data.total_closing), tone: 'blue' },
      ]} />}
      <LoadState loading={loading} error={error}>
        {data && (
          <DataTable>
            <thead><tr><Th>Kode</Th><Th>Akun</Th><Th right>Saldo Awal</Th><Th right>Penambahan</Th><Th right>Pengurangan</Th><Th right>Saldo Akhir</Th></tr></thead>
            <tbody>
              {data.rows.map((r: any) => (
                <tr key={r.account_id} className="border-t border-gray-100 dark:border-gray-700">
                  <Td className="font-mono text-xs">{r.code}</Td><Td>{r.name}</Td><Td right><Money v={r.opening} /></Td><Td right className="text-emerald-700"><Money v={r.additions} /></Td>
                  <Td right className="text-red-600"><Money v={r.deductions} /></Td><Td right className="font-semibold"><Money v={r.closing} zeroDash={false} colored /></Td>
                </tr>
              ))}
              <tr className="border-t border-gray-100 dark:border-gray-700"><Td /><Td>Laba ditahan berjalan (periode sebelumnya)</Td><Td right><Money v={data.prior_profit} /></Td><Td right /><Td right /><Td right className="font-semibold"><Money v={data.prior_profit} /></Td></tr>
              <tr className="border-t border-gray-100 dark:border-gray-700"><Td /><Td>Laba (rugi) periode ini</Td><Td right /><Td right className="text-emerald-700"><Money v={data.period_profit} /></Td><Td right /><Td right className="font-semibold"><Money v={data.period_profit} /></Td></tr>
            </tbody>
            <tfoot><tr className="bg-emerald-600 text-white"><td colSpan={2} className="px-3 py-2.5 text-right font-bold">TOTAL EKUITAS</td>
              <td className="px-3 py-2.5 text-right font-bold tabular-nums">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(data.total_opening)}</td><td /><td />
              <td className="px-3 py-2.5 text-right font-bold tabular-nums">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(data.total_closing)}</td></tr></tfoot>
          </DataTable>
        )}
      </LoadState>
    </ReportShell>
  )
}
