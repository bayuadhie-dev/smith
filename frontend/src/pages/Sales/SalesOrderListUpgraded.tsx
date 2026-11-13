import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useGetSalesOrdersQuery } from '../../services/api';
import { format } from 'date-fns';
import {
  ArrowPathIcon,
  ClipboardDocumentListIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  PrinterIcon,
  ShoppingCartIcon,
  TruckIcon,
  XMarkIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import axiosInstance from '../../utils/axiosConfig';
import toast from 'react-hot-toast';
import { confirmDialog } from '../../components/ui';
import ConfirmAndStartProductionModal from '../../components/Sales/ConfirmAndStartProductionModal';
import ImportCustomerPOModal from '../../components/Sales/ImportCustomerPOModal';
import { useListTools, type ListColumn } from '../../hooks/useListTools';
import { ListToolbar, SortTh } from '../../components/ui/ListTools';

interface SalesOrder {
  id: number;
  order_number: string;
  customer_id: number;
  customer_name: string;
  order_date: string;
  required_date?: string;
  status: string;
  priority: string;
  total_amount: number;
  item_count: number;
  notes?: string;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', confirmed: 'Dikonfirmasi', in_production: 'Produksi', ready: 'Siap Kirim', shipped: 'Dikirim', delivered: 'Terkirim', cancelled: 'Batal' };
const PRIORITY_LABEL: Record<string, string> = { low: 'Rendah', normal: 'Normal', high: 'Tinggi', urgent: 'Mendesak' };

const COLUMNS: ListColumn<SalesOrder>[] = [
  { key: 'order_number', label: 'No. Pesanan', value: (o) => o.order_number },
  { key: 'customer_name', label: 'Pelanggan', value: (o) => o.customer_name },
  { key: 'order_date', label: 'Tanggal', value: (o) => o.order_date, type: 'date' },
  { key: 'required_date', label: 'Tgl Dibutuhkan', value: (o) => o.required_date, type: 'date' },
  { key: 'status', label: 'Status', value: (o) => o.status, exportValue: (o) => STATUS_LABEL[o.status] || o.status },
  { key: 'priority', label: 'Prioritas', value: (o) => o.priority || 'normal', exportValue: (o) => PRIORITY_LABEL[o.priority || 'normal'] || o.priority },
  { key: 'item_count', label: 'Jumlah Barang', value: (o) => o.item_count || 0, type: 'number' },
  { key: 'total_amount', label: 'Total (Rp)', value: (o) => o.total_amount || 0, type: 'number' },
];

const SalesOrderListUpgraded: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showActions, setShowActions] = useState<number | null>(null);
  const [approvingOrder, setApprovingOrder] = useState<SalesOrder | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Bug kosmetik (2026-08-25): klik di luar action menu tidak menutupnya - tidak ada
  // listener klik-di-luar sama sekali sebelumnya, cuma toggle di tombolnya sendiri.
  useEffect(() => {
    if (showActions === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActions]);

  const [showPoImport, setShowPoImport] = useState(false);
  const { data, isLoading, refetch } = useGetSalesOrdersQuery({
    status: statusFilter,
    priority: priorityFilter,
    per_page: 1000
  });

  const orders = data?.orders || [];
  const tools = useListTools<SalesOrder>(orders, COLUMNS, { filename: 'Pesanan_Penjualan', initialSort: { key: 'order_date', dir: 'desc' } });

  const stats = useMemo(() => {
    return {
      total_orders: orders.length,
      total_amount: orders.reduce((sum: number, o: SalesOrder) => sum + (o.total_amount || 0), 0),
      pending_count: orders.filter((o: SalesOrder) => ['draft', 'confirmed'].includes(o.status)).length,
      in_production_count: orders.filter((o: SalesOrder) => o.status === 'in_production').length,
      ready_count: orders.filter((o: SalesOrder) => o.status === 'ready').length,
      shipped_count: orders.filter((o: SalesOrder) => o.status === 'shipped').length,
      delivered_count: orders.filter((o: SalesOrder) => o.status === 'delivered').length
    };
  }, [orders]);

  const statusOptions = [{ value: '', label: 'Semua status' }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))];
  const priorityOptions = [{ value: '', label: 'Semua prioritas' }, ...Object.entries(PRIORITY_LABEL).map(([value, label]) => ({ value, label }))];

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; bgColor: string; icon: any }> = {
      draft: { color: 'text-gray-600 dark:text-gray-300', bgColor: 'bg-gray-100 border-gray-200 dark:bg-gray-700 dark:border-gray-700', icon: ClipboardDocumentListIcon },
      confirmed: { color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800', icon: CheckCircleIcon },
      in_production: { color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800', icon: ClockIcon },
      ready: { color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 border-green-200 dark:bg-green-900/30 dark:border-green-800', icon: CheckCircleIcon },
      shipped: { color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 border-purple-200 dark:bg-purple-900/30 dark:border-purple-800', icon: TruckIcon },
      delivered: { color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800', icon: CheckCircleIcon },
      cancelled: { color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 border-red-200 dark:bg-red-900/30 dark:border-red-800', icon: XMarkIcon }
    };
    return configs[status] || configs.draft;
  };

  const getPriorityConfig = (priority: string) => {
    const configs: Record<string, { color: string; bgColor: string }> = {
      low: { color: 'text-gray-600 dark:text-gray-300', bgColor: 'bg-gray-100 dark:bg-gray-700' },
      normal: { color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
      high: { color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
      urgent: { color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' }
    };
    return configs[priority] || configs.normal;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const handleCancelOrder = async (id: number, status?: string) => {
    if (status === 'draft') {
      if (!(await confirmDialog('Hapus Sales Order draf ini? Order akan dihapus permanen.'))) return;
      try {
        await axiosInstance.delete(`/api/sales/orders/${id}`);
        toast.success('Order dihapus');
        refetch();
      } catch (e: any) {
        toast.error(e?.response?.data?.error || 'Gagal menghapus order');
      }
      return;
    }
    if (!(await confirmDialog('Batalkan pesanan ini?'))) return;
    try {
      await axiosInstance.put(`/api/sales/orders/${id}`, { status: 'cancelled' });
      toast.success('Pesanan dibatalkan');
      refetch();
    } catch (error) {
      toast.error('Gagal membatalkan pesanan');
    }
  };

  const handlePrintOrder = (id: number) => {
    window.open(`/app/sales/orders/${id}/print`, '_blank');
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <ShoppingCartIcon className="h-8 w-8" />
              Pesanan Penjualan
            </h1>
            <p className="text-primary-100 mt-1">Kelola pesanan pelanggan dan pemenuhannya</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              className="p-2 bg-white/10 hover:bg-white dark:hover:bg-gray-700 dark:bg-gray-800/20 rounded-lg transition-colors"
              title="Muat ulang"
            >
              <ArrowPathIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowPoImport(true)}
              className="inline-flex items-center px-4 py-2 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-colors"
            >
              Impor PO Pelanggan
            </button>
            <Link
              to="/app/imports?kind=sales_order"
              className="inline-flex items-center px-4 py-2 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-colors"
            >
              Impor
            </Link>
            <Link
              to="/app/sales/orders/new"
              className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-800 text-emerald-600 rounded-lg font-medium hover:bg-emerald-50 transition-colors shadow-md dark:text-emerald-400"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Pesanan Baru
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_orders}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total pesanan</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 col-span-2">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.total_amount)}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total nilai</div>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 dark:bg-blue-900/20 dark:border-blue-800">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.pending_count}</div>
          <div className="text-sm text-blue-600 dark:text-blue-400">Menunggu</div>
        </div>
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4 dark:bg-yellow-900/20 dark:border-yellow-800">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.in_production_count}</div>
          <div className="text-sm text-yellow-600 dark:text-yellow-400">Dalam produksi</div>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-4 dark:bg-green-900/20 dark:border-green-800">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.ready_count}</div>
          <div className="text-sm text-green-600 dark:text-green-400">Siap kirim</div>
        </div>
        <div className="bg-purple-50 rounded-lg border border-purple-200 p-4 dark:bg-purple-900/20 dark:border-purple-800">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.shipped_count}</div>
          <div className="text-sm text-purple-600 dark:text-purple-400">Dikirim</div>
        </div>
      </div>

      <ListToolbar tools={tools} placeholder="Cari nomor pesanan atau pelanggan" extra={(
        <>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status" className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} aria-label="Prioritas" className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            {priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </>
      )} />

      {/* Orders Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <SortTh tools={tools} col="order_number" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">No. Pesanan</SortTh>
                <SortTh tools={tools} col="customer_name" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pelanggan</SortTh>
                <SortTh tools={tools} col="order_date" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tanggal</SortTh>
                <SortTh tools={tools} col="required_date" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dibutuhkan</SortTh>
                <SortTh tools={tools} col="status" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</SortTh>
                <SortTh tools={tools} col="priority" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Prioritas</SortTh>
                <SortTh tools={tools} col="item_count" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Barang</SortTh>
                <SortTh tools={tools} col="total_amount" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</SortTh>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {tools.rows.map((order: SalesOrder) => {
                const statusConfig = getStatusConfig(order.status);
                const priorityConfig = getPriorityConfig(order.priority || 'normal');
                const StatusIcon = statusConfig.icon;
                
                return (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors">
                    <td className="px-4 py-4">
                      <div>
                        <Link 
                          to={`/app/sales/orders/${order.id}`}
                          className="font-medium text-primary-700 hover:text-primary-900 dark:text-primary-300"
                        >
                          {order.order_number}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">{order.customer_name}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(order.order_date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {order.required_date ? (
                        <span className={
                          new Date(order.required_date) < new Date() && !['delivered', 'cancelled'].includes(order.status)
                            ? 'text-red-600 font-medium dark:text-red-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }>
                          {format(new Date(order.required_date), 'dd MMM yyyy')}
                          {new Date(order.required_date) < new Date() && !['delivered', 'cancelled'].includes(order.status) && (
                            <ExclamationTriangleIcon className="h-4 w-4 inline ml-1 text-red-500" />
                          )}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusConfig.bgColor} ${statusConfig.color}`}>
                        <StatusIcon className="h-3.5 w-3.5 mr-1" />
                        {STATUS_LABEL[order.status] || order.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityConfig.bgColor} ${priorityConfig.color}`}>
                        {PRIORITY_LABEL[order.priority || 'normal'] || order.priority}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">
                      {order.item_count || 0} barang
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(order.total_amount || 0)}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 relative" ref={order.id === showActions ? actionsRef : undefined}>
                        {order.status === 'draft' && (
                          <button
                            onClick={() => setApprovingOrder(order)}
                            title="Setujui dan mulai produksi"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                            Setujui
                          </button>
                        )}
                        <button
                          onClick={() => setShowActions(showActions === order.id ? null : order.id)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 rounded-lg"
                        >
                          <EllipsisVerticalIcon className="h-5 w-5 text-gray-400" />
                        </button>
                        {showActions === order.id && (
                          <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                            <Link
                              to={`/app/sales/orders/${order.id}`}
                              className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                            >
                              <EyeIcon className="h-4 w-4 mr-2" />
                              Lihat Detail
                            </Link>
                            <Link
                              to={`/app/sales/orders/${order.id}/edit`}
                              className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                            >
                              <PencilIcon className="h-4 w-4 mr-2" />
                              Ubah Pesanan
                            </Link>
                            {order.status !== 'draft' && (
                              <Link
                                to={`/app/sales/orders/${order.id}/workflow`}
                                className="flex items-center px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:text-blue-400"
                              >
                                <ArrowPathIcon className="h-4 w-4 mr-2" />
                                Riwayat Produksi &amp; Pengiriman
                              </Link>
                            )}
                            <button
                              onClick={() => handlePrintOrder(order.id)}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                            >
                              <PrinterIcon className="h-4 w-4 mr-2" />
                              Cetak
                            </button>
                            {!['delivered', 'cancelled'].includes(order.status) && (
                              <button
                                onClick={() => handleCancelOrder(order.id, order.status)}
                                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400"
                              >
                                <XMarkIcon className="h-4 w-4 mr-2" />
                                Batalkan Pesanan
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty State */}
      {tools.rows.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <ShoppingCartIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">{tools.total === 0 ? 'Belum ada pesanan penjualan' : 'Tidak ada pesanan yang cocok'}</h3>
          <div className="mt-6">
            <Link
              to="/app/sales/orders/new"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
              Buat Pesanan
            </Link>
          </div>
        </div>
      )}

      {showPoImport && <ImportCustomerPOModal onClose={() => { setShowPoImport(false); refetch() }} />}

      {approvingOrder && (
        <ConfirmAndStartProductionModal
          orderId={approvingOrder.id}
          orderNumber={approvingOrder.order_number}
          itemCount={approvingOrder.item_count}
          onClose={() => setApprovingOrder(null)}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
};

export default SalesOrderListUpgraded;
