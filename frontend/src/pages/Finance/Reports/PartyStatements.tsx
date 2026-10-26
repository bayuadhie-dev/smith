import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UsersIcon, TruckIcon } from '@heroicons/react/24/outline'
import { DataTable, ExportButtons, LoadState, Money, PeriodFilter, ReportShell, SearchBox, StatCards, Td, Th, downloadExcel, fmtDate, idr, periodLabel, useReport, usePeriod } from './reportKit'

export default function PartyStatements({ kind }: { kind: 'customer' | 'supplier' }) {
  const navigate = useNavigate()
  const isCustomer = kind === 'customer'
  const p = usePeriod('Bulan ini')
  const [q, setQ] = useState('')
  const params = { type: kind, date_from: p.from, date_to: p.to }
  const { data, loading, error, reload } = useReport<any>('party-statements', params)
  const rows = useMemo(() => (data?.rows || []).filter((r: any) => !q || r.party_name.toLowerCase().includes(q.toLowerCase())), [data, q])
  const t = data?.totals
  const label = isCustomer ? 'Customer' : 'Supplier'
  const open = (r: any) => navigate(`/app/finance/reports/statement/${kind}/${r.party_id}?date_from=${p.from}&date_to=${p.to}`)
  return (
    <ReportShell title={isCustomer ? 'Kartu Piutang per Customer' : 'Kartu Hutang per Supplier'}
      subtitle={`${isCustomer ? 'Saldo piutang, faktur, retur, dan pembayaran' : 'Saldo hutang, faktur, dan pembayaran'} tiap ${label.toLowerCase()} · ${periodLabel(p.from, p.to)}`}
      icon={isCustomer ? <UsersIcon className="h-7 w-7 text-emerald-600" /> : <TruckIcon className="h-7 w-7 text-emerald-600" />}
      actions={<ExportButtons onExcel={() => downloadExcel('party-statements', params)} />}>
      <PeriodFilter from={p.from} to={p.to} onChange={p.setRange} onReload={reload} loading={loading} extra={<SearchBox value={q} onChange={setQ} placeholder={`Cari ${label.toLowerCase()}`} />} />
      {t && <StatCards items={[
        { label: 'Saldo Awal', value: idr(t.opening) }, { label: isCustomer ? 'Faktur Penjualan' : 'Faktur Pembelian', value: idr(t.invoiced) },
        { label: isCustomer ? 'Diterima / Retur' : 'Dibayar', value: idr(t.payments + t.returns), tone: 'green' }, { label: 'Saldo Akhir', value: idr(t.closing), tone: 'blue', hint: `${rows.length} ${label.toLowerCase()}` },
      ]} />}
      <LoadState loading={loading} error={error} empty={!rows.length} emptyText={`Tidak ada ${label.toLowerCase()} dengan transaksi atau saldo pada periode ini.`}>
        <DataTable maxHeight="65vh">
          <thead><tr>
            <Th>{label}</Th><Th right>Saldo Awal</Th><Th right>Faktur</Th>{isCustomer && <Th right>Retur</Th>}<Th right>{isCustomer ? 'Penerimaan' : 'Pembayaran'}</Th>
            {isCustomer && <Th right>Pengembalian Dana</Th>}<Th right>Saldo Akhir</Th><Th>Aktivitas Terakhir</Th>
          </tr></thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.party_id} onClick={() => open(r)} className="cursor-pointer border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40">
                <Td><div className="font-medium">{r.party_name}</div>{r.tax_id && <div className="text-xs text-gray-500">NPWP {r.tax_id}</div>}</Td>
                <Td right><Money v={r.opening} colored /></Td><Td right><Money v={r.invoiced} /></Td>{isCustomer && <Td right><Money v={r.returns} /></Td>}
                <Td right className="text-emerald-700"><Money v={r.payments} /></Td>{isCustomer && <Td right><Money v={r.refunds} /></Td>}
                <Td right className="font-semibold"><Money v={r.closing} zeroDash={false} colored /></Td><Td>{fmtDate(r.last_activity)}</Td>
              </tr>
            ))}
          </tbody>
          {t && <tfoot><tr className="bg-emerald-600 text-white">
            <td className="px-3 py-2.5 text-right font-bold">TOTAL</td>
            {['opening', 'invoiced', ...(isCustomer ? ['returns'] : []), 'payments', ...(isCustomer ? ['refunds'] : []), 'closing'].map((k) => (
              <td key={k} className="px-3 py-2.5 text-right font-bold tabular-nums">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(t[k])}</td>))}
            <td />
          </tr></tfoot>}
        </DataTable>
        <p className="print-hide text-xs text-gray-500">Klik satu {label.toLowerCase()} untuk melihat kartu lengkapnya (setiap faktur, pembayaran, dan saldo berjalan).</p>
      </LoadState>
    </ReportShell>
  )
}
