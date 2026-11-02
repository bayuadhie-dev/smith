import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import { formatRupiah } from '../../utils/currencyUtils'
import { PageHeader, KpiStrip, Panel } from '../../components/ui/PageKit'
import { showError } from '../../components/ui'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

interface Movement {
  id: number
  movement_number: string
  movement_date: string
  movement_type: string
  quantity: number
  unit_cost: number | null
  stock_before: number | null
  stock_after: number | null
  notes: string | null
  performed_by: string | null
}

interface MachineLink {
  link_id: number
  machine_id: number
  machine_code: string
  machine_name: string
  qty_installed: number
  replace_interval_days: number | null
  last_replaced_date: string | null
}

const TYPE_LABEL: Record<string, string> = { in: 'Masuk', out: 'Keluar', adjustment: 'Penyesuaian', return: 'Retur' }
const th = 'px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400'
const fmtNum = (n: number | null | undefined) => (n == null ? '-' : n.toLocaleString('id-ID'))
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-')

const SparePartDetail = () => {
  useDocumentTitle('Detail Sparepart')
  const { id } = useParams()
  const [part, setPart] = useState<any>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [machines, setMachines] = useState<MachineLink[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    axiosInstance.get(`/api/spare-parts/${id}`)
      .then((r) => {
        setPart(r.data.spare_part)
        setMovements(r.data.movements || [])
        setMachines(r.data.machines || [])
      })
      .catch((err) => showError(err.response?.data?.error || 'Sparepart gagal dimuat.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-6 text-sm text-gray-500">Memuat...</div>
  if (!part) return <div className="p-6 text-sm text-gray-500">Sparepart tidak ditemukan. <Link to="/app/maintenance/spare-parts" className="text-emerald-700 hover:underline">Kembali ke daftar</Link></div>

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title={`${part.part_number} · ${part.part_name}`}
        subtitle={[part.category, part.warehouse_location ? `Rak ${part.warehouse_location}` : null].filter(Boolean).join(' · ') || undefined}
        actions={<Link to="/app/maintenance/spare-parts" className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">Kembali ke daftar</Link>}
      />

      <KpiStrip
        items={[
          { label: 'Stok sekarang', value: `${fmtNum(part.current_stock)} ${part.uom}`, tone: part.out_of_stock ? 'bad' : part.needs_reorder ? 'warn' : null, hint: part.out_of_stock ? 'habis' : part.needs_reorder ? 'perlu pesan ulang' : 'aman' },
          { label: 'Stok minimum', value: fmtNum(part.min_stock), hint: part.max_stock != null ? `maksimum ${fmtNum(part.max_stock)}` : undefined },
          { label: 'Harga satuan', value: part.unit_cost != null ? formatRupiah(part.unit_cost) : '-', hint: part.last_purchase_cost != null ? `pembelian terakhir ${formatRupiah(part.last_purchase_cost)}` : undefined },
          { label: 'Nilai stok', value: formatRupiah(part.stock_value), hint: `${part.machines_count || 0} mesin memakai` },
        ]}
      />

      {(part.supplier_name || part.lead_time_days || part.description) && (
        <Panel title="Keterangan">
          <dl className="grid gap-3 p-4 text-sm md:grid-cols-3">
            <div><dt className="text-xs text-gray-500">Pemasok utama</dt><dd className="mt-0.5 text-gray-900 dark:text-white">{part.supplier_name || '-'}</dd></div>
            <div><dt className="text-xs text-gray-500">Lead time</dt><dd className="mt-0.5 text-gray-900 dark:text-white">{part.lead_time_days ? `${part.lead_time_days} hari` : '-'}</dd></div>
            <div className="md:col-span-3"><dt className="text-xs text-gray-500">Deskripsi</dt><dd className="mt-0.5 text-gray-900 dark:text-white">{part.description || '-'}</dd></div>
          </dl>
        </Panel>
      )}

      <Panel title="Mesin yang memakai">
        {machines.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">Belum dihubungkan ke mesin mana pun.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr><th className={th}>Mesin</th><th className={`${th} text-right`}>Jumlah terpasang</th><th className={`${th} text-right`}>Interval ganti</th><th className={th}>Terakhir diganti</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {machines.map((m) => (
                  <tr key={m.link_id}>
                    <td className="px-4 py-2.5 text-sm"><Link to={`/app/production/machines/${m.machine_id}`} className="text-emerald-700 hover:underline dark:text-emerald-400">{m.machine_code}</Link> <span className="text-gray-600 dark:text-gray-300">{m.machine_name}</span></td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums">{fmtNum(m.qty_installed)}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums">{m.replace_interval_days ? `${m.replace_interval_days} hari` : '-'}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{fmtDate(m.last_replaced_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Riwayat mutasi">
        {movements.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">Belum ada mutasi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className={th}>Tanggal</th><th className={th}>No. mutasi</th><th className={th}>Jenis</th>
                  <th className={`${th} text-right`}>Jumlah</th><th className={`${th} text-right`}>Stok sebelum</th><th className={`${th} text-right`}>Stok sesudah</th>
                  <th className={th}>Oleh</th><th className={th}>Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{fmtDate(m.movement_date)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white">{m.movement_number}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200">{TYPE_LABEL[m.movement_type] || m.movement_type}</td>
                    <td className={`whitespace-nowrap px-4 py-2.5 text-right text-sm font-medium tabular-nums ${m.quantity < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{m.quantity > 0 ? '+' : ''}{fmtNum(m.quantity)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-gray-600 dark:text-gray-300">{fmtNum(m.stock_before)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-gray-600 dark:text-gray-300">{fmtNum(m.stock_after)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{m.performed_by || '-'}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{m.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

export default SparePartDetail
