import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  CubeIcon,
  DocumentTextIcon,
  ChevronRightIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

interface WOStock {
  wo_id: number;
  wo_number: string;
  status: string;
  product_name: string;
  product_code: string;
  wo_quantity: number;
  fg_stock: number;
  wip_cartons: number;
  wip_pcs: number;
  machine_name: string | null;
  materials_count: number;
  material_planned: number;
  material_actual: number;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  confirmed: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const StockByWorkOrder: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<WOStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchData();
  }, [page, statusFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: any = { page, per_page: 20 };
      if (search) params.wo_number = search;
      if (statusFilter) params.status = statusFilter;
      const res = await axiosInstance.get('/api/wms/stock-by-wo', { params });
      setData(res.data.work_orders);
      setTotalPages(res.data.pagination.pages);
    } catch (err: any) {
      toast.error('Gagal memuat data stok WO');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <DocumentTextIcon className="h-7 w-7 text-blue-600" />
          Stok per Work Order
        </h1>
        <p className="text-gray-500 mt-1">Lihat inventori, WIP, dan konsumsi material per Work Order</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari WO number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </form>
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Semua Status</option>
              <option value="draft">Draft</option>
              <option value="confirmed">Confirmed</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <CubeIcon className="h-12 w-12 mx-auto mb-3" />
            <p>Tidak ada data Work Order ditemukan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">WO Number</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">QTY WO</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">FG Stock</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">WIP (Carton)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mesin</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Material</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((wo) => {
                  const variance = wo.material_actual - wo.material_planned;
                  return (
                    <tr key={wo.wo_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-blue-600">{wo.wo_number}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{wo.product_name}</div>
                        <div className="text-xs text-gray-400">{wo.product_code}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[wo.status] || 'bg-gray-100 text-gray-600'}`}>
                          {wo.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{wo.wo_quantity.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right">{wo.fg_stock.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className="font-medium">{wo.wip_cartons.toLocaleString()}</span>
                        <span className="text-xs text-gray-400 ml-1">({wo.wip_pcs.toLocaleString()} pcs)</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{wo.machine_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className="text-gray-600">{wo.materials_count} items</span>
                        {variance !== 0 && (
                          <span className={`ml-1 text-xs ${variance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            ({variance > 0 ? '+' : ''}{variance.toFixed(1)})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => navigate(`/app/wms/stock-by-wo/${wo.wo_id}`)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <ChevronRightIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <span className="text-sm text-gray-600">Halaman {page} dari {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
            >
              Selanjutnya
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockByWorkOrder;
