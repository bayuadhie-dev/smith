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
  planned: { bg: 'bg-gray-100', text: 'text-gray-700' },
  partial: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  issued: { bg: 'bg-blue-100', text: 'text-blue-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
  returned: { bg: 'bg-orange-100', text: 'text-orange-700' },
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
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CubeIcon className="h-7 w-7 text-purple-600" />
          Konsumsi Material
        </h1>
        <p className="text-gray-500 mt-1">Tracking pemakaian bahan baku per Work Order — Planned vs Actual</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Work Order ID"
              value={woId}
              onChange={(e) => setWoId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40"
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
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">WO ID</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Planned</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actual</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Variance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch / Lokasi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dikeluarkan Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((item) => {
                  const badge = statusBadge[item.status] || statusBadge.planned;
                  return (
                    <tr key={`${item.work_order_id}-${item.id}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{item.material_name}</div>
                        <div className="text-xs text-gray-400">{item.material_code} · {item.material_uom}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">WO-{item.work_order_id}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{item.quantity_planned.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{item.quantity_actual.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <div className="flex items-center justify-end gap-1">
                          {item.variance > 0 ? (
                            <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                          ) : item.variance === 0 && item.status === 'completed' ? (
                            <CheckCircleIcon className="h-4 w-4 text-green-500" />
                          ) : null}
                          <span className={item.variance > 0 ? 'text-red-600 font-medium' : item.variance < 0 ? 'text-green-600' : 'text-gray-500'}>
                            {item.variance > 0 ? '+' : ''}{item.variance.toFixed(1)}
                          </span>
                          <span className="text-xs text-gray-400">({item.variance_percentage.toFixed(1)}%)</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {item.from_batch_number || '-'}
                        {item.from_location && <span className="text-xs text-gray-400 ml-1">@ {item.from_location}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">Sebelumnya</button>
            <span className="text-sm text-gray-600">Halaman {page} dari {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">Selanjutnya</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MaterialConsumptionPage;
