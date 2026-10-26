import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BookOpenIcon, BuildingLibraryIcon } from '@heroicons/react/24/outline'
import axiosInstance from '../../../utils/axiosConfig'
import SearchableSelect from '../../../components/SearchableSelect'
import { DataTable, DocLink, ExportButtons, LoadState, Money, PeriodFilter, ReportShell, StatCards, Td, Th, downloadExcel, fmtDate, idr, periodLabel, useReport, usePeriod } from './reportKit'

/** One component, two entrances: /reports/bank-mutation (pick a cash/bank account) and /reports/ledger/:accountId (any account). */
export default function AccountLedger({ mode }: { mode: 'bank' | 'ledger' }) {
  const navigate = useNavigate()
  const { accountId: routeAccount } = useParams()
  const [sp] = useSearchParams()
  const p = usePeriod('Bulan ini')
  const [accounts, setAccounts] = useState<{ id: number; code: string; name: string }[]>([])
  const [accountId, setAccountId] = useState<string>(routeAccount || sp.get('account') || '')

  useEffect(() => {
    if (sp.get('date_from') && sp.get('date_to')) p.setRange(sp.get('date_from')!, sp.get('date_to')!)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { if (routeAccount) setAccountId(routeAccount) }, [routeAccount])
  useEffect(() => {
    if (mode !== 'bank') return
    axiosInstance.get('/api/finance/reports/cash-accounts').then((r) => {
      setAccounts(r.data.accounts || [])
      if (!accountId && r.data.accounts?.length) setAccountId(String(r.data.accounts[0].id))
    }).catch(() => setAccounts([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const params = { account_id: accountId, date_from: p.from, date_to: p.to }
  const { data, loading, error, reload } = useReport<any>('account-ledger', params, !!accountId)
  const acc = data?.account
  const title = mode === 'bank' ? 'Mutasi Rekening Bank / Kas' : 'Rincian Buku Besar Akun'
  const sign = acc?.normal_balance === 'debit' ? 1 : -1

  return (
    <ReportShell title={title}
      subtitle={acc ? `${acc.code} - ${acc.name} · ${periodLabel(p.from, p.to)}${acc.is_header ? ' · gabungan semua akun di bawahnya' : ''}` : 'Pilih rekening untuk melihat mutasinya'}
      icon={mode === 'bank' ? <BuildingLibraryIcon className="h-7 w-7 text-emerald-600" /> : <BookOpenIcon className="h-7 w-7 text-emerald-600" />}
      backTo={mode === 'ledger' ? '/app/finance/reports/trial-balance' : undefined} backLabel="Neraca Saldo"
      actions={<ExportButtons onExcel={accountId ? () => downloadExcel('account-ledger', params) : undefined} />}>
      <PeriodFilter from={p.from} to={p.to} onChange={p.setRange} onReload={reload} loading={loading} extra={
        mode === 'bank' ? (
          <div className="min-w-[280px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">Rekening</label>
            <SearchableSelect options={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name }))} value={accountId ? Number(accountId) : null}
              onChange={(v) => setAccountId(v ? String(v) : '')} placeholder="Pilih rekening bank / kas" />
          </div>
        ) : undefined
      } />
      {data && (
        <StatCards items={[
          { label: 'Saldo Awal', value: idr(data.opening_balance) },
          { label: 'Total Debit', value: idr(data.total_debit), tone: 'green', hint: sign === 1 ? 'menambah saldo' : 'mengurangi saldo' },
          { label: 'Total Kredit', value: idr(data.total_credit), tone: 'red', hint: sign === 1 ? 'mengurangi saldo' : 'menambah saldo' },
          { label: 'Saldo Akhir', value: idr(data.closing_balance), tone: 'blue', hint: `${data.row_count} baris jurnal` },
        ]} />
      )}
      <LoadState loading={loading && !!accountId} error={error} empty={!!data && !data.rows.length && !data.opening_balance} emptyText="Belum ada transaksi di akun ini untuk periode yang dipilih.">
        {data && (
          <DataTable maxHeight="65vh">
            <thead>
              <tr><Th>Tanggal</Th><Th>No. Jurnal</Th>{acc?.is_header && <Th>Akun</Th>}<Th>Keterangan</Th><Th>Referensi</Th><Th right>Debit</Th><Th right>Kredit</Th><Th right>Saldo</Th></tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50 font-medium dark:bg-gray-700/40">
                <Td colSpan={acc?.is_header ? 5 : 4}>Saldo awal per {fmtDate(p.from)}</Td><Td right /><Td right /><Td right><Money v={data.opening_balance} zeroDash={false} colored /></Td>
              </tr>
              {data.rows.map((r: any) => (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40">
                  <Td className="whitespace-nowrap">{fmtDate(r.entry_date)}</Td>
                  <Td className="whitespace-nowrap font-mono text-xs">{r.entry_number}</Td>
                  {acc?.is_header && <Td className="whitespace-nowrap text-xs">{r.account_code} {r.account_name}</Td>}
                  <Td className="max-w-md">{r.description}</Td>
                  <Td className="whitespace-nowrap"><DocLink url={r.document_url}>{r.reference_number || r.reference_type || '-'}</DocLink></Td>
                  <Td right><Money v={r.debit} /></Td><Td right><Money v={r.credit} /></Td><Td right className="font-medium"><Money v={r.balance} zeroDash={false} colored /></Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="sticky bottom-0 bg-emerald-600 text-white">
                <td colSpan={acc?.is_header ? 5 : 4} className="px-3 py-2.5 text-right font-bold">TOTAL / SALDO AKHIR</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(data.total_debit)}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(data.total_credit)}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(data.closing_balance)}</td>
              </tr>
            </tfoot>
          </DataTable>
        )}
        {data?.truncated && <p className="text-xs text-amber-600">Menampilkan 5.000 baris pertama dari {data.row_count}. Persempit periode untuk melihat sisanya.</p>}
      </LoadState>
      {mode === 'ledger' && acc && (
        <button type="button" className="print-hide text-sm text-emerald-700 hover:underline" onClick={() => navigate('/app/finance/reports/bank-mutation?account=' + acc.id)} hidden={!acc.is_cash_bank}>
          Buka sebagai mutasi bank
        </button>
      )}
    </ReportShell>
  )
}
