import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { useListTools, type ListColumn } from '../../hooks/useListTools';
import { ListToolbar, SortTh } from '../../components/ui/ListTools';
import { toast } from 'react-hot-toast';
import { confirmDialog } from '../../components/ui';
import {
  PlusIcon,
  ClipboardDocumentCheckIcon,
  PlayIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  TrashIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

interface StockOpnameOrder {
  id: number;
  opname_number: string;
  zone_name: string;
  opname_type: string;
  scheduled_date: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  assigned_to_name: string | null;
  total_items: number;
  counted_items: number;
  variance_items: number;
  total_variance_value: number;
  created_by_name: string;
  created_at: string;
}

const STATUS_COLORS: { [key: string]: string } = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  scheduled: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const STATUS_LABELS: { [key: string]: string } = {
  draft: 'Draft',
  scheduled: 'Terjadwal',
  in_progress: 'Sedang Berjalan',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const TYPE_LABELS: { [key: string]: string } = {
  full: 'Full Count',
  partial: 'Partial',
  cycle: 'Cycle Count',
};

const COLUMNS: ListColumn<StockOpnameOrder>[] = [
  { key: 'opname_number', label: 'No. Opname', value: (o) => o.opname_number },
  { key: 'created_by_name', label: 'Dibuat Oleh', value: (o) => o.created_by_name },
  { key: 'zone_name', label: 'Zona', value: (o) => o.zone_name },
  { key: 'opname_type', label: 'Tipe', value: (o) => o.opname_type, exportValue: (o) => TYPE_LABELS[o.opname_type] || o.opname_type },
  { key: 'scheduled_date', label: 'Jadwal', value: (o) => o.scheduled_date, type: 'date' },
  { key: 'counted_items', label: 'Item Dihitung', value: (o) => o.counted_items, type: 'number' },
  { key: 'total_items', label: 'Total Item', value: (o) => o.total_items, type: 'number', sortable: false },
  { key: 'variance_items', label: 'Item Selisih', value: (o) => (o.status === 'completed' ? o.variance_items : null), type: 'number' },
  { key: 'total_variance_value', label: 'Nilai Selisih (Rp)', value: (o) => (o.status === 'completed' ? o.total_variance_value : null), type: 'number', sortable: false },
  { key: 'status', label: 'Status', value: (o) => o.status, exportValue: (o) => STATUS_LABELS[o.status] || o.status },
];

interface StockOpnameListProps {
  mode?: 'perintah' | 'hasil';
}

export default function StockOpnameList({ mode = 'perintah' }: StockOpnameListProps) {
  const [orders, setOrders] = useState<StockOpnameOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(mode === 'hasil' ? 'completed' : '');

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const tools = useListTools<StockOpnameOrder>(orders, COLUMNS, { filename: mode === 'hasil' ? 'Hasil_Opname' : 'Stok_Opname', initialSort: { key: 'scheduled_date', dir: 'desc' } });

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: '1',
        per_page: '1000',
      });
      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const response = await axiosInstance.get(`/api/stock-opname/orders?${params}`);
      setOrders(response.data.orders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Gagal memuat data stok opname');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, opnameNumber: string) => {
    if (!(await confirmDialog(`Hapus stok opname ${opnameNumber}?`))) return;

    try {
      await axiosInstance.delete(`/api/stock-opname/orders/${id}`);
      toast.success('Stok opname berhasil dihapus');
      fetchOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal menghapus');
    }
  };

  const handleStart = async (id: number) => {
    try {
      await axiosInstance.put(`/api/stock-opname/orders/${id}/start`);
      toast.success('Stok opname dimulai');
      fetchOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal memulai');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardDocumentCheckIcon className="h-8 w-8 text-primary-600 dark:text-primary-400" />
            {mode === 'hasil' ? 'Hasil Opname' : 'Perintah Stok Opname'}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {mode === 'hasil' ? 'Lihat hasil dan selisih stok opname yang sudah selesai' : 'Kelola penghitungan fisik inventory'}
          </p>
        </div>
        {mode !== 'hasil' && (
          <Link
            to="/app/warehouse/stock-opname/new"
            className="flex items-center gap-2 px-4 py-2 bg-cta-600 text-white rounded-lg hover:bg-cta-700"
          >
            <PlusIcon className="h-5 w-5" />
            Buat Perintah Opname
          </Link>
        )}
      </div>

      <ListToolbar tools={tools} placeholder="Cari nomor opname, zona, pembuat" extra={
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter status"
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-800"
        >
          <option value="">Semua Status</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Terjadwal</option>
          <option value="in_progress">Sedang Berjalan</option>
          <option value="completed">Selesai</option>
        </select>
      } />

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <SortTh tools={tools} col="opname_number" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. Opname</SortTh>
              <SortTh tools={tools} col="zone_name" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Zona</SortTh>
              <SortTh tools={tools} col="opname_type" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipe</SortTh>
              <SortTh tools={tools} col="scheduled_date" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Jadwal</SortTh>
              <SortTh tools={tools} col="counted_items" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Progress</SortTh>
              <SortTh tools={tools} col="variance_items" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Selisih</SortTh>
              <SortTh tools={tools} col="status" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</SortTh>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {tools.rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  <ClipboardDocumentCheckIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p>{tools.total === 0 ? 'Belum ada data stok opname' : 'Tidak ada stok opname yang cocok'}</p>
                  {tools.total === 0 && <Link
                    to="/app/warehouse/stock-opname/new"
                    className="text-primary-600 hover:underline mt-2 inline-block dark:text-primary-400"
                  >
                    Buat perintah opname baru
                  </Link>}
                </td>
              </tr>
            ) : (
              tools.rows.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                  <td className="px-6 py-4">
                    <Link
                      to={`/app/warehouse/stock-opname/${order.id}`}
                      className="text-primary-600 hover:underline font-medium dark:text-primary-400"
                    >
                      {order.opname_number}
                    </Link>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      oleh {order.created_by_name}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {order.zone_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {TYPE_LABELS[order.opname_type] || order.opname_type}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {formatDate(order.scheduled_date)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-600 rounded-full"
                          style={{
                            width: `${order.total_items > 0 ? (order.counted_items / order.total_items) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {order.counted_items}/{order.total_items}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {order.status === 'completed' ? (
                      <div>
                        <span className={`text-sm font-medium ${order.variance_items > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {order.variance_items} item
                        </span>
                        {order.total_variance_value !== 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatCurrency(order.total_variance_value)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {order.status === 'draft' && (
                        <button
                          onClick={() => handleStart(order.id)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded dark:text-green-400"
                          title="Mulai Opname"
                        >
                          <PlayIcon className="h-5 w-5" />
                        </button>
                      )}
                      <Link
                        to={`/app/warehouse/stock-opname/${order.id}`}
                        className="p-2 text-primary-600 hover:bg-primary-50 rounded dark:text-primary-400"
                        title="Lihat Detail"
                      >
                        <EyeIcon className="h-5 w-5" />
                      </Link>
                      {(order.status === 'draft' || order.status === 'cancelled') && (
                        <button
                          onClick={() => handleDelete(order.id, order.opname_number)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded dark:text-red-400"
                          title="Hapus"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

      </div>
    </div>
  );
}
