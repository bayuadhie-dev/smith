import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ReceiptPercentIcon } from '@heroicons/react/24/outline'
import { DataTable, ExportButtons, LoadState, Money, ReportShell, StatCards, Td, Th, downloadExcel, idr, useReport } from './reportKit'

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export default function VatReport() {
  const navigate = useNavigate()
  const [year, setYear] = useState(new Date().getFullYear())
  const params = { year }
  const { data, loading, error } = useReport<any>('vat-summary', params)
  const t = data?.totals
  return (
    <ReportShell title="Rekap PPN" subtitle={`PPN Keluaran (penjualan) dan PPN Masukan (pembelian) per bulan · ${year}`}
      icon={<ReceiptPercentIcon className="h-7 w-7 text-emerald-600" />} actions={<ExportButtons onExcel={() => downloadExcel('vat-summary', params)} />}>
      <div className="print-hide flex items-center gap-2">
        <button type="button" className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => setYear(year - 1)}>‹</button>
        <span className="min-w-[4rem] text-center font-semibold">{year}</span>
        <button type="button" className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => setYear(year + 1)}>›</button>
      </div>
      {t && <StatCards items={[
        { label: 'PPN Keluaran', value: idr(t.output_vat), tone: 'blue' }, { label: 'PPN Masukan', value: idr(t.input_vat), tone: 'green' },
        { label: 'Kurang / (Lebih) Bayar', value: idr(t.net_payable), tone: t.net_payable > 0 ? 'amber' : 'green' }, { label: 'DPP Penjualan', value: idr(t.output_base) },
      ]} />}
      <LoadState loading={loading} error={error}>
        {data && (
          <DataTable>
            <thead><tr><Th>Bulan</Th><Th right>DPP Keluaran</Th><Th right>PPN Keluaran</Th><Th right>DPP Masukan</Th><Th right>PPN Masukan</Th><Th right>Kurang / (Lebih) Bayar</Th><Th>Rincian</Th></tr></thead>
            <tbody>
              {data.rows.map((r: any, i: number) => (
                <tr key={r.month} className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40">
                  <Td className="font-medium">{MONTHS[i]}</Td><Td right><Money v={r.output_base} /></Td><Td right><Money v={r.output_vat} /></Td>
                  <Td right><Money v={r.input_base} /></Td><Td right><Money v={r.input_vat} /></Td><Td right className="font-semibold"><Money v={r.net_payable} colored /></Td>
                  <Td>
                    <button type="button" disabled={!r.output_count} className="mr-3 text-emerald-700 hover:underline disabled:text-gray-300" onClick={() => navigate(`/app/finance/reports/vat/${r.month}?kind=output`)}>Keluaran ({r.output_count})</button>
                    <button type="button" disabled={!r.input_count} className="text-emerald-700 hover:underline disabled:text-gray-300" onClick={() => navigate(`/app/finance/reports/vat/${r.month}?kind=input`)}>Masukan ({r.input_count})</button>
                  </Td>
                </tr>
              ))}
            </tbody>
            {t && <tfoot><tr className="bg-emerald-600 text-white"><td className="px-3 py-2.5 font-bold">TOTAL {year}</td>
              {['output_base', 'output_vat', 'input_base', 'input_vat', 'net_payable'].map((k) => <td key={k} className="px-3 py-2.5 text-right font-bold tabular-nums">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(t[k])}</td>)}<td /></tr></tfoot>}
          </DataTable>
        )}
      </LoadState>
    </ReportShell>
  )
}
