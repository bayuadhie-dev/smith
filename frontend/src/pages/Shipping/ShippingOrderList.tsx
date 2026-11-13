import { Link } from 'react-router-dom'
import { PlusIcon } from '@heroicons/react/24/outline'
import { useGetShippingOrdersQuery } from '../../services/shippingApi'
import { format } from 'date-fns'
import { useListTools, type ListColumn } from '../../hooks/useListTools'
import { ListToolbar, SortTh } from '../../components/ui/ListTools'

import { TableSkeleton } from '../../components/ui/Skeleton'
const STATUS_LABEL: Record<string, string> = {
  preparing: 'Disiapkan', packed: 'Dikemas', shipped: 'Dikirim', in_transit: 'Dalam perjalanan', delivered: 'Terkirim', cancelled: 'Batal',
}
const STATUS_BADGE: Record<string, string> = {
  preparing: 'badge-warning', packed: 'badge-info', shipped: 'badge-info', in_transit: 'badge-info', delivered: 'badge-success', cancelled: 'badge-danger',
}
const fmtDate = (v?: string | null) => (v ? format(new Date(v), 'dd MMM yyyy') : '-')

const COLUMNS: ListColumn<any>[] = [
  { key: 'shipping_number', label: 'No. Surat Jalan', value: (o) => o.shipping_number },
  { key: 'customer_name', label: 'Pelanggan', value: (o) => o.customer_name },
  { key: 'shipping_date', label: 'Tanggal Kirim', value: (o) => o.shipping_date, type: 'date' },
  { key: 'expected_delivery_date', label: 'Perkiraan Tiba', value: (o) => o.expected_delivery_date, type: 'date' },
  { key: 'status', label: 'Status', value: (o) => o.status, exportValue: (o) => STATUS_LABEL[o.status] || o.status },
  { key: 'tracking_number', label: 'No. Resi', value: (o) => o.tracking_number },
  { key: 'driver_name', label: 'Sopir', value: (o) => o.driver_name },
  { key: 'vehicle_number', label: 'No. Kendaraan', value: (o) => o.vehicle_number },
]

export default function ShippingOrderList() {
  const { data, isLoading } = useGetShippingOrdersQuery({ per_page: 1000 })
  const tools = useListTools<any>(data?.shipping_orders, COLUMNS, { filename: 'Surat_Jalan', initialSort: { key: 'shipping_date', dir: 'desc' } })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Surat Jalan</h1>
        <div className="flex items-center gap-2">
          <Link to="/app/imports?kind=shipping_order" className="btn-secondary">Impor</Link>
          <Link to="/app/shipping/orders/new" className="btn-primary">
            <PlusIcon className="mr-1.5 h-5 w-5" />
            Buat Surat Jalan
          </Link>
        </div>
      </div>

      <ListToolbar tools={tools} placeholder="Cari nomor, pelanggan, sopir, kendaraan" />

      {isLoading ? (
        <TableSkeleton rows={8} cols={9} />
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <SortTh tools={tools} col="shipping_number">No. Surat Jalan</SortTh>
                  <SortTh tools={tools} col="customer_name">Pelanggan</SortTh>
                  <SortTh tools={tools} col="shipping_date">Tanggal Kirim</SortTh>
                  <SortTh tools={tools} col="expected_delivery_date">Perkiraan Tiba</SortTh>
                  <SortTh tools={tools} col="status">Status</SortTh>
                  <SortTh tools={tools} col="tracking_number">No. Resi</SortTh>
                  <SortTh tools={tools} col="driver_name">Sopir</SortTh>
                  <SortTh tools={tools} col="vehicle_number">No. Kendaraan</SortTh>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {tools.rows.map((order: any) => (
                  <tr key={order.id}>
                    <td className="font-medium">{order.shipping_number}</td>
                    <td>{order.customer_name}</td>
                    <td>{fmtDate(order.shipping_date)}</td>
                    <td>{fmtDate(order.expected_delivery_date)}</td>
                    <td><span className={`badge ${STATUS_BADGE[order.status] || 'badge-info'}`}>{STATUS_LABEL[order.status] || order.status}</span></td>
                    <td>{order.tracking_number || '-'}</td>
                    <td>{order.driver_name || '-'}</td>
                    <td>{order.vehicle_number || '-'}</td>
                    <td>
                      <Link to={`/app/shipping/orders/${order.id}`} className="text-sm text-primary-700 hover:underline dark:text-primary-300">Lihat</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && tools.rows.length === 0 && (
        <div className="py-12 text-center">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">{tools.total === 0 ? 'Belum ada surat jalan' : 'Tidak ada surat jalan yang cocok'}</h3>
          {tools.total === 0 && (
            <div className="mt-6">
              <Link to="/app/shipping/orders/new" className="btn-primary">
                <PlusIcon className="mr-1.5 h-5 w-5" />
                Buat Surat Jalan
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
