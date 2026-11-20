import { useMemo, useState } from 'react'
import { ScaleIcon } from '@heroicons/react/24/outline'
import { DataTable, ExportButtons, LoadState, ReportShell, SearchBox, StatCards, Td, Th, fmtDate, num, useDebounced, useReport } from './reportKit'
import { groupLabel } from './inventoryShared'

/**
 * Dua angka yang seharusnya sama: saldo hasil menjumlahkan mutasi (buku stok)
 * dan isi tabel stok yang dipakai transaksi sehari-hari. Laporan ini menunjuk
 * barang mana yang berbeda, termasuk stok yang sama sekali tidak punya riwayat.
 */
export default function StockVsLedger() {
  const [group, setGroup] = useState('all')
  const [hideZero, setHideZero] = useState(true)
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const params = useMemo(() => ({ group, q: dq || undefined, hide_zero: hideZero }), [group, dq, hideZero])
  const { data, loading, error, reload } = useReport<any>('stock-vs-ledger', params)
  const rows: any[] = data?.rows || []
  const s = data?.summary

  return (
    <ReportShell
      title="Selisih Stok Fisik vs Buku Stok"
      subtitle={`Barang yang saldo mutasinya tidak sama dengan tabel stok${data?.date_to ? ` · per ${fmtDate(data.date_to)}` : ''}`}
      icon={<ScaleIcon className="h-7 w-7 text-amber-600 dark:text-amber-400" />}
      actions={<ExportButtons report={['stock-vs-ledger', params]} />}
    >
      {/* Laporan ini selalu "per hari ini": membandingkan tabel stok yang berlaku
          sekarang dengan seluruh riwayat mutasinya, jadi tidak ada pilihan periode. */}
      <div className="print-hide flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Kelompok barang</label>
            <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="all">Semua kelompok</option>
              {(data?.groups || []).map((g: string) => <option key={g} value={g}>{groupLabel(g)}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} /> Sembunyikan yang sudah cocok
          </label>
          <SearchBox value={q} onChange={setQ} placeholder="Cari kode / nama barang" />
          <button type="button" onClick={reload} disabled={loading} className="btn-secondary">
            {loading ? 'Memuat...' : 'Muat ulang'}
          </button>
      </div>
      {s && (
        <StatCards items={[
          { label: 'Barang diperiksa', value: num(s.items_checked) },
          { label: 'Barang berselisih', value: num(s.items_differ), tone: s.items_differ ? 'red' : undefined },
          { label: 'Stok tanpa riwayat', value: num(s.items_no_history) },
          { label: 'Selisih lebih / kurang', value: `${num(s.diff_plus)} / ${num(s.diff_minus)}` },
        ]} />
      )}
      <LoadState loading={loading} error={error} empty={!rows.length} emptyText="Semua barang cocok antara buku stok dan tabel stok.">
        <DataTable maxHeight="65vh">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <Th>Kode</Th>
              <Th>Nama barang</Th>
              <Th>Satuan</Th>
              <Th right>Buku stok</Th>
              <Th right>Stok fisik</Th>
              <Th right>Selisih</Th>
              <Th>Catatan</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.code}-${i}`} className="border-t border-gray-100 dark:border-gray-700">
                <Td className="font-mono text-xs">{r.code}</Td>
                <Td>{r.name}</Td>
                <Td>{r.uom}</Td>
                <Td right>{num(r.ledger_qty)}</Td>
                <Td right>{num(r.stock_qty)}</Td>
                <Td right>
                  <span className={r.diff > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
                    {r.diff > 0 ? '+' : ''}{num(r.diff)}
                  </span>
                </Td>
                <Td>{r.no_history ? <span className="text-xs text-amber-700 dark:text-amber-400">stok ada, mutasi tidak ada</span> : ''}</Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </LoadState>
    </ReportShell>
  )
}
