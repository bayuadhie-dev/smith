import React from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { DocumentTextIcon } from '@heroicons/react/24/outline'
import { DataTable, DocLink, ExportButtons, LoadState, Money, PeriodFilter, ReportShell, StatCards, Td, Th, fmtDate, idr, periodLabel, useReport, usePeriod } from './reportKit'

const TYPE_LABEL: Record<string, string> = { invoice: 'Faktur', payment: 'Pembayaran', return: 'Retur', refund: 'Pengembalian dana' }
const TYPE_STYLE: Record<string, string> = {
  invoice: 'bg-blue-50 text-blue-700', payment: 'bg-emerald-50 text-emerald-700', return: 'bg-amber-50 text-amber-700', refund: 'bg-purple-50 text-purple-700',
}

export default function PartyStatementDetail() {
  const { type, id } = useParams()
  const [sp] = useSearchParams()
  const p = usePeriod('Tahun ini')
  React.useEffect(() => { if (sp.get('date_from') && sp.get('date_to')) p.setRange(sp.get('date_from')!, sp.get('date_to')!) /* eslint-disable-next-line */ }, [])
  const isCustomer = type === 'customer'
  const params = { date_from: p.from, date_to: p.to }
  const { data, loading, error, reload } = useReport<any>(`party-statement/${type}/${id}`, params)
  const party = data?.party
  return (
    <ReportShell title={isCustomer ? 'Kartu Piutang' : 'Kartu Hutang'} subtitle={party ? `${party.name} · ${periodLabel(p.from, p.to)}` : undefined}
      icon={<DocumentTextIcon className="h-7 w-7 text-emerald-600" />} backTo={`/app/finance/reports/${isCustomer ? 'customer' : 'supplier'}-statements`} backLabel={isCustomer ? 'Kartu Piutang' : 'Kartu Hutang'}
      actions={<ExportButtons report={[`party-statement/${type}/${id}`, params]} />}>
      {party && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-lg font-bold text-gray-900 dark:text-white">{party.name}</p>
          <p className="text-sm text-gray-500">{party.tax_id ? `NPWP ${party.tax_id}` : 'NPWP belum diisi'}{party.address ? ` · ${party.address}` : ''}</p>
        </div>
      )}
      <PeriodFilter from={p.from} to={p.to} onChange={p.setRange} onReload={reload} loading={loading} />
      {data && <StatCards items={[
        { label: 'Saldo Awal', value: idr(data.opening_balance) },
        { label: isCustomer ? 'Tagihan Bertambah' : 'Hutang Bertambah', value: idr(data.total_increase), tone: 'blue' },
        { label: 'Berkurang (bayar/retur)', value: idr(data.total_decrease), tone: 'green' }, { label: 'Saldo Akhir', value: idr(data.closing_balance), tone: data.closing_balance > 0 ? 'amber' : 'default' },
      ]} />}
      <LoadState loading={loading} error={error} empty={!!data && !data.rows.length && !data.opening_balance} emptyText="Tidak ada transaksi pada periode ini.">
        {data && (
          <DataTable maxHeight="65vh">
            <thead><tr><Th>Tanggal</Th><Th>Jenis</Th><Th>No. Dokumen</Th><Th>Keterangan</Th><Th right>Bertambah</Th><Th right>Berkurang</Th><Th right>Saldo</Th></tr></thead>
            <tbody>
              <tr className="bg-gray-50 font-medium dark:bg-gray-700/40"><Td colSpan={6}>Saldo awal per {fmtDate(p.from)}</Td><Td right><Money v={data.opening_balance} zeroDash={false} /></Td></tr>
              {data.rows.map((r: any, i: number) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40">
                  <Td className="whitespace-nowrap">{fmtDate(r.date)}</Td>
                  <Td><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLE[r.type] || ''}`}>{TYPE_LABEL[r.type] || r.type}</span></Td>
                  <Td className="whitespace-nowrap"><DocLink url={r.url}>{r.number}</DocLink></Td><Td>{r.description}</Td>
                  <Td right><Money v={r.increase} /></Td><Td right className="text-emerald-700"><Money v={r.decrease} /></Td><Td right className="font-medium"><Money v={r.balance} zeroDash={false} colored /></Td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="bg-emerald-600 text-white">
              <td colSpan={4} className="px-3 py-2.5 text-right font-bold">TOTAL / SALDO AKHIR</td>
              <td className="px-3 py-2.5 text-right font-bold tabular-nums">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(data.total_increase)}</td>
              <td className="px-3 py-2.5 text-right font-bold tabular-nums">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(data.total_decrease)}</td>
              <td className="px-3 py-2.5 text-right font-bold tabular-nums">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(data.closing_balance)}</td>
            </tr></tfoot>
          </DataTable>
        )}
      </LoadState>
    </ReportShell>
  )
}
