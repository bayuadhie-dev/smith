import { useMemo, useState } from 'react'
import { ClockIcon } from '@heroicons/react/24/outline'
import { DataTable, ExportButtons, LoadState, ReportShell, SearchBox, StatCards, Td, Th, fmtDate, num, useDebounced, useReport } from './reportKit'
import { groupLabel } from './inventoryShared'
import { useUrlFilter } from '../../../hooks/useUrlState'

/** Padanan "Nomor Produksi Segera Kadaluarsa" di Accurate: sistem tidak memilihkan
 *  batch mana yang keluar, jadi laporan inilah yang menjaga barang lama tidak tertinggal. */
export default function NearExpiry() {
  const [days, setDays] = useUrlFilter<string>('hari', '90')
  const [group, setGroup] = useState('all')
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const params = useMemo(() => ({ days: Number(days) || 90, group, q: dq || undefined }), [days, group, dq])
  const { data, loading, error, reload } = useReport<any>('near-expiry', params)
  const rows: any[] = data?.rows || []
  const s = data?.summary

  const warna = (b: string) =>
    b === 'kedaluwarsa' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
      : b === '30' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'

  return (
    <ReportShell
      title="Batch Segera Kedaluwarsa"
      subtitle={`Batch yang sudah lewat atau mendekati tanggal kedaluwarsa${data?.date ? ` · per ${fmtDate(data.date)}` : ''}`}
      icon={<ClockIcon className="h-7 w-7 text-amber-600 dark:text-amber-400" />}
      actions={<ExportButtons report={['near-expiry', params]} />}
    >
      <div className="print-hide flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Sampai berapa hari ke depan</label>
          <select className="input" value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="0">Sudah lewat saja</option>
            <option value="30">30 hari</option>
            <option value="90">90 hari</option>
            <option value="180">180 hari</option>
            <option value="365">1 tahun</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Kelompok barang</label>
          <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="all">Semua kelompok</option>
            {(data?.groups || []).map((g: string) => <option key={g} value={g}>{groupLabel(g)}</option>)}
          </select>
        </div>
        <SearchBox value={q} onChange={setQ} placeholder="Cari kode / nama barang" />
        <button type="button" onClick={reload} disabled={loading} className="btn-secondary">
          {loading ? 'Memuat...' : 'Muat ulang'}
        </button>
      </div>
      {s && (
        <StatCards items={[
          { label: 'Batch terdaftar', value: num(s.batches) },
          { label: 'Sudah kedaluwarsa', value: num(s.expired), tone: s.expired ? 'red' : undefined },
          { label: 'Kurang dari 30 hari', value: num(s.within_30), tone: s.within_30 ? 'amber' : undefined },
          { label: 'Kuantitas kedaluwarsa', value: num(s.qty_expired) },
        ]} />
      )}
      <LoadState loading={loading} error={error} empty={!rows.length} emptyText="Tidak ada batch yang mendekati kedaluwarsa pada rentang ini.">
        <DataTable maxHeight="65vh">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <Th>Kode</Th>
              <Th>Nama barang</Th>
              <Th>Batch</Th>
              <Th>Gudang</Th>
              <Th>Kedaluwarsa</Th>
              <Th right>Sisa hari</Th>
              <Th right>Kuantitas</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.code}-${r.batch_number}-${r.zone_id}-${i}`} className="border-t border-gray-100 dark:border-gray-700">
                <Td className="font-mono text-xs">{r.code}</Td>
                <Td>{r.name}</Td>
                <Td className="font-mono text-xs">{r.batch_number}</Td>
                <Td>{r.zone_name}</Td>
                <Td>{fmtDate(r.expiry_date)}</Td>
                <Td right>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${warna(r.bucket)}`}>
                    {r.days_left < 0 ? `lewat ${Math.abs(r.days_left)} hari` : `${r.days_left} hari`}
                  </span>
                </Td>
                <Td right>{num(r.qty)} {r.uom}</Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </LoadState>
    </ReportShell>
  )
}
