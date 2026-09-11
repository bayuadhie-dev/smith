import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import {
  ScaleIcon,
  PlusIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

interface Adjustment {
  id: number;
  adjustment_number: string;
  product_name: string | null;
  material_name: string | null;
  location_name: string | null;
  adjustment_type: string;
  reason: string;
  is_value_adjustment: boolean;
  system_quantity: number;
  physical_quantity: number;
  adjustment_quantity: number;
  status: string;
  created_at: string;
}

const statusMap: Record<string, { color: string; label: string }> = {
  pending: { color: 'bg-gray-100 text-gray-700', label: 'Draft' },
  pending_approval: { color: 'bg-amber-100 text-amber-700', label: 'Menunggu Persetujuan' },
  applied: { color: 'bg-green-100 text-green-700', label: 'Diterapkan' },
  rejected: { color: 'bg-red-100 text-red-700', label: 'Ditolak' },
};

const reasonLabels: Record<string, string> = {
  damaged: 'Rusak',
  expired: 'Kadaluarsa',
  theft: 'Kehilangan/Pencurian',
  counting_error: 'Kesalahan Hitung',
  system_error: 'Kesalahan Sistem',
  stock_take: 'Stock Take',
  quality_issue: 'Masalah Kualitas',
  other: 'Lainnya',
};

const AdjustmentList: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const res = await axiosInstance.get('/api/wms/adjustments', { params });
      setData(res.data.adjustments || []);
    } catch (err: any) {
      toast.error('Gagal memuat data penyesuaian stok');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ScaleIcon className="h-7 w-7 text-orange-600" />
            Penyesuaian Stok
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Koreksi jumlah atau nilai stok, dengan posting jurnal otomatis setelah disetujui
          </p>
        </div>
        <button
          onClick={() => navigate('/app/warehouse/adjustments/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="h-5 w-5" /> Buat Penyesuaian
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-3">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-900"
          >
            <option value="">Semua Status</option>
            <option value="pending">Draft</option>
            <option value="pending_approval">Menunggu Persetujuan</option>
            <option value="applied">Diterapkan</option>
            <option value="rejected">Ditolak</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ScaleIcon className="h-12 w-12 mx-auto mb-3" />
            <p>Belum ada penyesuaian stok</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. Adjustment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lokasi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Mode</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Alasan</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Selisih</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.map((a) => {
                  const st = statusMap[a.status] || statusMap.pending;
                  return (
                    <tr
                      key={a.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => navigate(`/app/warehouse/adjustments/${a.id}`)}
                    >
                      <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900 dark:text-white">{a.adjustment_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{a.product_name || a.material_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{a.location_name || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        {a.is_value_adjustment ? (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">Value</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Quantity</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{reasonLabels[a.reason] || a.reason}</td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${a.adjustment_quantity > 0 ? 'text-green-600' : a.adjustment_quantity < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        {a.adjustment_quantity > 0 ? '+' : ''}{a.adjustment_quantity}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {a.created_at ? new Date(a.created_at).toLocaleDateString('id-ID') : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdjustmentList;
