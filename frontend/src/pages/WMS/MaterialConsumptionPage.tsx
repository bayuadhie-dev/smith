import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import {
  CubeIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import NumberInput from '../../components/ui/NumberInput'

interface Consumption {
  id: number;
  work_order_id: number;
  material_id: number;
  material_code: string;
  material_name: string;
  material_uom: string;
  quantity_planned: number;
  quantity_actual: number;
  variance: number;
  variance_percentage: number;
  from_batch_number: string | null;
  from_location: string | null;
  status: string;
  issued_by: string | null;
  issued_at: string | null;
  notes: string | null;
}

const statusBadge: Record<string, { bg: string; text: string }> = {
  planned: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-200' },
  partial: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' },
  issued: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  completed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  returned: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
};

const MaterialConsumptionPage: React.FC = () => {
  const [data, setData] = useState<Consumption[]>([]);
  const [loading, setLoading] = useState(true);
  const [woId, setWoId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchData();
  }, [page, statusFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: any = { page, per_page: 50 };
      if (woId) params.work_order_id = woId;
      if (statusFilter) params.status = statusFilter;
      const res = await axiosInstance.get('/api/wms/material-consumption', { params });
      setData(res.data.consumptions);
      setTotalPages(res.data.pagination.pages);
    } catch (err: any) {
      toast.error('Gagal memuat data konsumsi material');
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
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 dark:text-white">
          <CubeIcon className="h-7 w-7 text-purple-600 dark:text-purple-400" />
          Konsumsi Material
        </h1>
        <p className="text-gray-500 mt-1 dark:text-gray-400">Tracking pemakaian bahan baku per SPK — Planned vs Actual</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <NumberInput
              placeholder="SPK ID"
              value={woId}
              onChange={(e) => setWoId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40 dark:border-gray-600"
            />
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              Cari
            </button>
          </form>
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm dark:border-gray-600"
            >
              <option value="">Semua Status</option>
              <option value="planned">Planned</option>
              <option value="partial">Partial</option>
              <option value="issued">Issued</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <CubeIcon className="h-12 w-12 mx-auto mb-3" />
            <p>Belum ada data konsumsi material</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Material</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">WO ID</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Planned</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Actual</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Variance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Batch / Lokasi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Dikeluarkan Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.map((item) => {
                  const badge = statusBadge[item.status] || statusBadge.planned;
                  return (
                    <tr key={`${item.work_order_id}-${item.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{item.material_name}</div>
                        <div className="text-xs text-gray-400">{item.material_code} · {item.material_uom}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">WO-{item.work_order_id}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{item.quantity_planned.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{item.quantity_actual.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <div className="flex items-center justify-end gap-1">
                          {item.variance > 0 ? (
                            <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                          ) : item.variance === 0 && item.status === 'completed' ? (
                            <CheckCircleIcon className="h-4 w-4 text-green-500" />
                          ) : null}
                          <span className={item.variance > 0 ? 'text-red-600 font-medium dark:text-red-400' : item.variance < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}>
                            {item.variance > 0 ? '+' : ''}{item.variance.toFixed(1)}
                          </span>
                          <span className="text-xs text-gray-400">({item.variance_percentage.toFixed(1)}%)</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {item.from_batch_number || '-'}
                        {item.from_location && <span className="text-xs text-gray-400 ml-1">@ {item.from_location}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {item.issued_by || '-'}
                        {item.issued_at && (
                          <div className="text-xs text-gray-400">{new Date(item.issued_at).toLocaleDateString('id-ID')}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">Sebelumnya</button>
            <span className="text-sm text-gray-600 dark:text-gray-300">Halaman {page} dari {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">Selanjutnya</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MaterialConsumptionPage;
