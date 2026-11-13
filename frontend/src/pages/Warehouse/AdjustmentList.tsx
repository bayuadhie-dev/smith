import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import {
  ScaleIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { useListTools, type ListColumn } from '../../hooks/useListTools';
import { ListToolbar, SortTh } from '../../components/ui/ListTools';

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
  pending: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200', label: 'Draft' },
  pending_approval: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', label: 'Menunggu Persetujuan' },
  applied: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', label: 'Diterapkan' },
  rejected: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', label: 'Ditolak' },
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

const COLUMNS: ListColumn<Adjustment>[] = [
  { key: 'adjustment_number', label: 'No. Penyesuaian', value: (a) => a.adjustment_number },
  { key: 'item', label: 'Item', value: (a) => a.product_name || a.material_name },
  { key: 'location_name', label: 'Lokasi', value: (a) => a.location_name },
  { key: 'mode', label: 'Mode', value: (a) => (a.is_value_adjustment ? 'Nilai' : 'Jumlah') },
  { key: 'reason', label: 'Alasan', value: (a) => a.reason, exportValue: (a) => reasonLabels[a.reason] || a.reason },
  { key: 'adjustment_quantity', label: 'Selisih', value: (a) => a.adjustment_quantity, type: 'number' },
  { key: 'status', label: 'Status', value: (a) => a.status, exportValue: (a) => (statusMap[a.status] || statusMap.pending).label },
  { key: 'created_at', label: 'Tanggal', value: (a) => a.created_at, type: 'date' },
];

const AdjustmentList: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const tools = useListTools<Adjustment>(data, COLUMNS, { filename: 'Penyesuaian_Stok', initialSort: { key: 'created_at', dir: 'desc' } });

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
            <ScaleIcon className="h-7 w-7 text-orange-600 dark:text-orange-400" />
            Penyesuaian Stok
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Koreksi jumlah atau nilai stok, dengan posting jurnal otomatis setelah disetujui
          </p>
        </div>
        <button
          onClick={() => navigate('/app/warehouse/adjustments/new')}
          className="flex items-center gap-2 px-4 py-2 bg-cta-600 text-white rounded-lg hover:bg-cta-700"
        >
          <PlusIcon className="h-5 w-5" /> Buat Penyesuaian
        </button>
      </div>

      <ListToolbar tools={tools} placeholder="Cari nomor, item, lokasi, alasan" extra={
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter status"
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-900"
        >
          <option value="">Semua Status</option>
          <option value="pending">Draft</option>
          <option value="pending_approval">Menunggu Persetujuan</option>
          <option value="applied">Diterapkan</option>
          <option value="rejected">Ditolak</option>
        </select>
      } />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : tools.rows.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ScaleIcon className="h-12 w-12 mx-auto mb-3" />
            <p>{tools.total === 0 ? 'Belum ada penyesuaian stok' : 'Tidak ada penyesuaian yang cocok'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <SortTh tools={tools} col="adjustment_number" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. Penyesuaian</SortTh>
                  <SortTh tools={tools} col="item" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Item</SortTh>
                  <SortTh tools={tools} col="location_name" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lokasi</SortTh>
                  <SortTh tools={tools} col="mode" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Mode</SortTh>
                  <SortTh tools={tools} col="reason" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Alasan</SortTh>
                  <SortTh tools={tools} col="adjustment_quantity" align="right" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Selisih</SortTh>
                  <SortTh tools={tools} col="status" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</SortTh>
                  <SortTh tools={tools} col="created_at" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal</SortTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {tools.rows.map((a) => {
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
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">Nilai</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">Jumlah</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{reasonLabels[a.reason] || a.reason}</td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${a.adjustment_quantity > 0 ? 'text-green-600 dark:text-green-400' : a.adjustment_quantity < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
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
