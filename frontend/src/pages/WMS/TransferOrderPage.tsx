import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import {
  TruckIcon,
  CheckBadgeIcon,
  ClockIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

interface TransferOrder {
  id: number;
  transfer_number: string;
  from_zone: string;
  to_zone: string;
  from_location: string | null;
  to_location: string | null;
  reason: string;
  status: string;
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
  transferred_by: string | null;
  transferred_at: string | null;
  total_items: number;
  priority: string;
  notes: string | null;
  created_at: string;
}

const statusMap: Record<string, { color: string; label: string }> = {
  draft: { color: 'bg-gray-100 text-gray-700', label: 'Draft' },
  approved: { color: 'bg-blue-100 text-blue-700', label: 'Approved' },
  in_transit: { color: 'bg-yellow-100 text-yellow-700', label: 'In Transit' },
  completed: { color: 'bg-green-100 text-green-700', label: 'Completed' },
  cancelled: { color: 'bg-red-100 text-red-700', label: 'Cancelled' },
};

const reasonLabels: Record<string, string> = {
  replenishment: 'Pengisian Ulang',
  relocation: 'Relokasi',
  consolidation: 'Konsolidasi',
  production_staging: 'Staging Produksi',
  quality_hold: 'Quality Hold',
};

const TransferOrderPage: React.FC = () => {
  const [data, setData] = useState<TransferOrder[]>([]);
  const [loading, setLoading] = useState(true);
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
      if (statusFilter) params.status = statusFilter;
      const res = await axiosInstance.get('/api/wms/transfers', { params });
      setData(res.data.transfers);
      setTotalPages(res.data.pagination.pages);
    } catch (err: any) {
      toast.error('Gagal memuat data transfer');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await axiosInstance.post(`/api/wms/transfers/${id}/approve`);
      toast.success('Transfer disetujui');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal menyetujui');
    }
  };

  const handleExecute = async (id: number) => {
    try {
      await axiosInstance.post(`/api/wms/transfers/${id}/execute`);
      toast.success('Transfer berhasil dieksekusi');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal mengeksekusi');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TruckIcon className="h-7 w-7 text-orange-600" />
          Transfer Stok
        </h1>
        <p className="text-gray-500 mt-1">Pemindahan barang antar zona dan lokasi gudang</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Semua Status</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="completed">Completed</option>
          </select>
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
            <TruckIcon className="h-12 w-12 mx-auto mb-3" />
            <p>Belum ada transfer order</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. Transfer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dari → Ke</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alasan</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Items</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diminta Oleh</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((t) => {
                  const st = statusMap[t.status] || statusMap.draft;
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">{t.transfer_number}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{t.from_zone}</span>
                          <span className="text-gray-400">→</span>
                          <span className="font-medium">{t.to_zone}</span>
                        </div>
                        {(t.from_location || t.to_location) && (
                          <div className="text-xs text-gray-400">{t.from_location || '?'} → {t.to_location || '?'}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{reasonLabels[t.reason] || t.reason}</td>
                      <td className="px-4 py-3 text-sm text-center font-medium">{t.total_items}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{t.requested_by}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {t.created_at ? new Date(t.created_at).toLocaleDateString('id-ID') : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {t.status === 'draft' && (
                          <button onClick={() => handleApprove(t.id)} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700">
                            <CheckBadgeIcon className="h-4 w-4" /> Approve
                          </button>
                        )}
                        {t.status === 'approved' && (
                          <button onClick={() => handleExecute(t.id)} className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700">
                            <TruckIcon className="h-4 w-4" /> Eksekusi
                          </button>
                        )}
                        {t.status === 'completed' && (
                          <span className="text-xs text-green-600 flex items-center justify-center gap-1">
                            <CheckBadgeIcon className="h-4 w-4" /> Selesai
                          </span>
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

export default TransferOrderPage;
