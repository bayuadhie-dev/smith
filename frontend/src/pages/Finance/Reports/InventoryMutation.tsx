import { useMemo, useState } from 'react'
import { CubeIcon } from '@heroicons/react/24/outline'
import { DataTable, ExportButtons, LoadState, Money, PeriodFilter, ReportShell, SearchBox, StatCards, Td, Th, idr, num, periodLabel, useDebounced, useReport, usePeriod } from './reportKit'
import { groupLabel } from './inventoryShared'

export default function InventoryMutation() {
  const p = usePeriod('Bulan ini')
  const [zone, setZone] = useState('')
  const [group, setGroup] = useState('all')
  const [hideZero, setHideZero] = useState(true)
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const params = useMemo(() => ({ date_from: p.from, date_to: p.to, zone_id: zone || undefined, group, q: dq || undefined, hide_zero: hideZero }), [p.from, p.to, zone, group, dq, hideZero])
  const { data, loading, error, reload } = useReport<any>('inventory-mutation', params)
  const t = data?.totals
  const rows: any[] = data?.rows || []
  const checked = !!data?.checked_against_stock

  return (
    <ReportShell title="Nilai Persediaan" subtitle={`Mutasi persediaan per barang: saldo awal, masuk, keluar, dan saldo akhir · ${periodLabel(p.from, p.to)}${data?.zone ? ` · ${data.zone.name}` : ' · Semua gudang'}`}
      icon={<CubeIcon className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />} actions={<ExportButtons report={['inventory-mutation', params]} />}>
      <PeriodFilter from={p.from} to={p.to} onChange={p.setRange} onReload={reload} loading={loading} extra={
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Gudang</label>
            <select className="input" value={zone} onChange={(e) => setZone(e.target.value)}>
              <option value="">Semua gudang</option>
              {(data?.zones || []).map((z: any) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Kelompok barang</label>
            <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="all">Semua kelompok</option>
              {(data?.groups || []).map((g: string) => <option key={g} value={g}>{groupLabel(g)}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} /> Sembunyikan barang tanpa mutasi dan saldo
          </label>
          <SearchBox value={q} onChange={setQ} placeholder="Cari kode / nama barang" />
        </>
      } />
      {t && (
        <StatCards items={[
          { label: 'Saldo Awal (nilai)', value: idr(t.opening_value) },
          { label: 'Masuk (nilai)', value: idr(t.in_value), tone: 'green' },
          { label: 'Keluar (nilai)', value: idr(t.out_value), tone: 'red' },
          { label: 'Saldo Akhir (nilai)', value: idr(t.closing_value), tone: 'blue' },
        ]} />
      )}
      {data && data.unvalued_rows > 0 && (
        <div className="print-hide rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          {num(data.unvalued_rows)} transaksi stok belum punya nilai biaya dan dihitung Rp 0. Kuantitas tetap benar, tetapi nilai persediaan bisa lebih rendah dari sebenarnya.
        </div>
      )}
      {data && checked && data.mismatch_count > 0 && (
        <div className="print-hide rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {num(data.mismatch_count)} barang saldo akhirnya berbeda dengan stok di sistem (ditandai merah pada kolom Stok Sistem). Biasanya karena stok awal atau penyesuaian yang tidak tercatat di buku stok. Periksa di Mutasi Stok sebelum angka ini dipakai.
        </div>
      )}
      <LoadState loading={loading} error={error} empty={!rows.length} emptyText="Tidak ada barang untuk filter ini.">
        <DataTable maxHeight="65vh">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th colSpan={3} className="px-3 py-1.5" />
              {['Saldo Awal', 'Masuk', 'Keluar', 'Saldo Akhir'].map((g) => (
                <th key={g} colSpan={2} className="border-l border-gray-200 px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-gray-700 dark:border-gray-600 dark:text-gray-100">{g}</th>
              ))}
              {checked && <th className="border-l border-gray-200 px-3 py-1.5 dark:border-gray-600" />}
            </tr>
            <tr>
              <Th>Nama Barang</Th><Th className="w-32">Kode</Th><Th>Satuan</Th>
              <Th right>Kuantitas</Th><Th right>Nilai</Th><Th right>Kuantitas</Th><Th right>Nilai</Th>
              <Th right>Kuantitas</Th><Th right>Nilai</Th><Th right>Kuantitas</Th><Th right>Nilai</Th>
              {checked && <Th right>Stok Sistem</Th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.kind}-${r.code}`} className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40">
                <Td className="min-w-[14rem]">{r.name}</Td><Td className="font-mono text-xs">{r.code}</Td><Td>{r.uom}</Td>
                <Td right><Money v={r.opening_qty} /></Td><Td right><Money v={r.opening_value} /></Td>
                <Td right><Money v={r.in_qty} /></Td><Td right><Money v={r.in_value} /></Td>
                <Td right><Money v={r.out_qty} /></Td><Td right><Money v={r.out_value} /></Td>
                <Td right className="font-semibold"><Money v={r.closing_qty} colored /></Td><Td right className="font-semibold"><Money v={r.closing_value} colored /></Td>
                {checked && <Td right className={r.qty_mismatch ? 'font-semibold text-red-600 dark:text-red-400' : ''}><Money v={r.system_qty} /></Td>}
              </tr>
            ))}
          </tbody>
          {t && (
            <tfoot>
              <tr className="sticky bottom-0 bg-emerald-600 text-white">
                <td colSpan={3} className="px-3 py-2.5 text-right font-bold">TOTAL</td>
                {['opening_qty', 'opening_value', 'in_qty', 'in_value', 'out_qty', 'out_value', 'closing_qty', 'closing_value'].map((k) => (
                  <td key={k} className="px-3 py-2.5 text-right font-bold tabular-nums">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(t[k])}</td>
                ))}
                {checked && <td />}
              </tr>
            </tfoot>
          )}
        </DataTable>
        <p className="print-hide text-xs text-gray-500 dark:text-gray-400">
          Angka dari buku stok (semua pergerakan barang). Pemindahan antar gudang dan perubahan status batch tidak dihitung sebagai masuk atau keluar pada tampilan semua gudang.
        </p>
      </LoadState>
    </ReportShell>
  )
}
