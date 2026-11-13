import { useMemo, useState } from 'react'
import { BuildingStorefrontIcon } from '@heroicons/react/24/outline'
import { DataTable, ExportButtons, LoadState, Money, PeriodFilter, ReportShell, SearchBox, StatCards, Td, Th, fmtDate, idr, iso, num, useDebounced, useReport, usePeriod } from './reportKit'
import { groupLabel } from './inventoryShared'

export default function InventoryByWarehouse() {
  const p = usePeriod('Hari ini')
  const [source, setSource] = useState<'stock' | 'ledger'>('stock')
  const [group, setGroup] = useState('all')
  const [hideZero, setHideZero] = useState(true)
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const isToday = p.to >= iso(new Date())
  const effectiveSource = isToday ? source : 'ledger'
  const params = useMemo(() => ({ date_to: p.to, source: effectiveSource, group, q: dq || undefined, hide_zero: hideZero }), [p.to, effectiveSource, group, dq, hideZero])
  const { data, loading, error, reload } = useReport<any>('inventory-by-warehouse', params)
  const zones: any[] = data?.zones || []
  const rows: any[] = data?.rows || []
  const t = data?.totals

  return (
    <ReportShell title="Kuantitas Barang per Gudang" subtitle={`Kuantitas dan total biaya tiap barang di tiap gudang · per ${fmtDate(p.to)}`}
      icon={<BuildingStorefrontIcon className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />} actions={<ExportButtons report={['inventory-by-warehouse', params]} />}>
      <PeriodFilter single from={p.to} to={p.to} onChange={p.setRange} onReload={reload} loading={loading} extra={
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Sumber data</label>
            <select className="input" value={effectiveSource} disabled={!isToday} onChange={(e) => setSource(e.target.value as 'stock' | 'ledger')}>
              <option value="stock">Stok saat ini (fisik)</option>
              <option value="ledger">Mutasi buku stok</option>
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
            <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} /> Sembunyikan barang tanpa stok
          </label>
          <SearchBox value={q} onChange={setQ} placeholder="Cari kode / nama barang" />
        </>
      } />
      {t && (
        <StatCards items={[
          { label: 'Jumlah barang', value: num(rows.length) },
          { label: 'Gudang', value: num(zones.length) },
          { label: 'Total kuantitas', value: num(t.qty) },
          { label: 'Total biaya', value: idr(t.value), tone: 'blue' },
        ]} />
      )}
      <LoadState loading={loading} error={error} empty={!rows.length} emptyText="Tidak ada barang untuk filter ini.">
        <DataTable maxHeight="65vh">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th colSpan={3} className="px-3 py-1.5" />
              {zones.map((z) => <th key={z.id} colSpan={2} className="border-l border-gray-200 px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-gray-700 dark:border-gray-600 dark:text-gray-100">{z.name}</th>)}
              <th colSpan={2} className="border-l border-gray-200 px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-emerald-700 dark:border-gray-600 dark:text-emerald-300">Total</th>
            </tr>
            <tr>
              <Th>Nama Barang</Th><Th className="w-32">Kode</Th><Th>Satuan</Th>
              {zones.map((z) => <><Th key={`${z.id}q`} right>Kuantitas</Th><Th key={`${z.id}v`} right>Total Biaya</Th></>)}
              <Th right>Kuantitas</Th><Th right>Total Biaya</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.kind}-${r.code}`} className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40">
                <Td className="min-w-[14rem]">{r.name}</Td><Td className="font-mono text-xs">{r.code}</Td><Td>{r.uom}</Td>
                {zones.map((z) => <><Td key={`${z.id}q`} right><Money v={r.by_zone[String(z.id)]?.qty} colored /></Td><Td key={`${z.id}v`} right><Money v={r.by_zone[String(z.id)]?.value} colored /></Td></>)}
                <Td right className="font-semibold"><Money v={r.total_qty} colored /></Td><Td right className="font-semibold"><Money v={r.total_value} colored /></Td>
              </tr>
            ))}
          </tbody>
          {t && (
            <tfoot>
              <tr className="sticky bottom-0 bg-emerald-600 text-white">
                <td colSpan={3} className="px-3 py-2.5 text-right font-bold">TOTAL</td>
                {zones.map((z) => (
                  <><td key={`${z.id}q`} className="px-3 py-2.5 text-right font-bold tabular-nums">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(data.zone_totals[String(z.id)].qty)}</td>
                    <td key={`${z.id}v`} className="px-3 py-2.5 text-right font-bold tabular-nums">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(data.zone_totals[String(z.id)].value)}</td></>
                ))}
                <td className="px-3 py-2.5 text-right font-bold tabular-nums">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(t.qty)}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(t.value)}</td>
              </tr>
            </tfoot>
          )}
        </DataTable>
        <p className="print-hide text-xs text-gray-500 dark:text-gray-400">
          {effectiveSource === 'stock'
            ? 'Kuantitas dari stok fisik per lokasi. Total biaya = kuantitas x biaya rata-rata penerimaan.'
            : 'Dihitung ulang dari buku stok sampai tanggal yang dipilih; tanggal lampau hanya bisa memakai sumber ini.'}
        </p>
      </LoadState>
    </ReportShell>
  )
}
