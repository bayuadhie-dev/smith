import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import {
  ClipboardDocumentListIcon,
  CheckCircleIcon,
  ClockIcon,
  PlayIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

interface PickListData {
  id: number;
  pick_number: string;
  pick_type: string;
  reference_type: string | null;
  reference_number: string | null;
  assigned_to: string | null;
  priority: string;
  status: string;
  pick_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_items: number;
  picked_items: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

const statusConfig: Record<string, { color: string; icon: any }> = {
  draft: { color: 'bg-gray-100 text-gray-700', icon: ClipboardDocumentListIcon },
  assigned: { color: 'bg-blue-100 text-blue-700', icon: ClockIcon },
  in_progress: { color: 'bg-yellow-100 text-yellow-700', icon: PlayIcon },
  completed: { color: 'bg-green-100 text-green-700', icon: CheckCircleIcon },
  cancelled: { color: 'bg-red-100 text-red-700', icon: ClipboardDocumentListIcon },
};

const priorityColors: Record<string, string> = {
  low: 'text-gray-500',
  normal: 'text-blue-600',
  high: 'text-orange-600 font-bold',
  urgent: 'text-red-600 font-bold',
};

const PickListPage: React.FC = () => {
  const [data, setData] = useState<PickListData[]>([]);
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
      const res = await axiosInstance.get('/api/wms/pick-lists', { params });
      setData(res.data.pick_lists);
      setTotalPages(res.data.pagination.pages);
    } catch (err: any) {
      toast.error('Gagal memuat pick list');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardDocumentListIcon className="h-7 w-7 text-indigo-600" />
            Pick List
          </h1>
          <p className="text-gray-500 mt-1">Daftar pengambilan barang untuk produksi, pengiriman, dan transfer</p>
        </div>
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
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">
            <ClipboardDocumentListIcon className="h-12 w-12 mx-auto mb-3" />
            <p>Belum ada pick list</p>
          </div>
        ) : (
          data.map((pl) => {
            const cfg = statusConfig[pl.status] || statusConfig.draft;
            const progress = pl.total_items > 0 ? Math.round(pl.picked_items / pl.total_items * 100) : 0;
            return (
              <div key={pl.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono font-bold text-gray-900">{pl.pick_number}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>{pl.status.replace('_', ' ')}</span>
                      <span className={`text-xs uppercase ${priorityColors[pl.priority] || 'text-gray-500'}`}>{pl.priority}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Tipe:</span>
                        <span className="ml-1 capitalize">{pl.pick_type.replace('_', ' ')}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Referensi:</span>
                        <span className="ml-1">{pl.reference_number || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Ditugaskan:</span>
                        <span className="ml-1">{pl.assigned_to || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Tanggal:</span>
                        <span className="ml-1">{pl.pick_date ? new Date(pl.pick_date).toLocaleDateString('id-ID') : '-'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-2xl font-bold text-gray-900">{pl.picked_items}/{pl.total_items}</p>
                    <p className="text-xs text-gray-400">items picked</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{progress}% selesai</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">Sebelumnya</button>
          <span className="text-sm text-gray-600">Halaman {page} dari {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">Selanjutnya</button>
        </div>
      )}
    </div>
  );
};

export default PickListPage;
