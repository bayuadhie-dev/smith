import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import {
  ClipboardDocumentListIcon,
  CheckCircleIcon,
  ClockIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { useListTools, type ListColumn } from '../../hooks/useListTools';
import { ListToolbar, SortTh } from '../../components/ui/ListTools';

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
  draft: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200', icon: ClipboardDocumentListIcon },
  assigned: { color: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300', icon: ClockIcon },
  in_progress: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300', icon: PlayIcon },
  completed: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircleIcon },
  cancelled: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: ClipboardDocumentListIcon },
};

const priorityColors: Record<string, string> = {
  low: 'text-gray-500 dark:text-gray-400',
  normal: 'text-primary-700 dark:text-primary-300',
  high: 'text-orange-600 font-bold dark:text-orange-400',
  urgent: 'text-red-600 font-bold dark:text-red-400',
};

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', assigned: 'Ditugaskan', in_progress: 'Berjalan', completed: 'Selesai', cancelled: 'Dibatalkan' };
const PRIORITY_LABEL: Record<string, string> = { low: 'Rendah', normal: 'Normal', high: 'Tinggi', urgent: 'Mendesak' };
const TYPE_LABEL = (t: string) => (t || '').replace(/_/g, ' ');
const COLUMNS: ListColumn<PickListData>[] = [
  { key: 'pick_number', label: 'No. Pick List', value: (p) => p.pick_number },
  { key: 'pick_type', label: 'Tipe', value: (p) => TYPE_LABEL(p.pick_type) },
  { key: 'reference_number', label: 'Referensi', value: (p) => p.reference_number },
  { key: 'assigned_to', label: 'Ditugaskan Kepada', value: (p) => p.assigned_to },
  { key: 'priority', label: 'Prioritas', value: (p) => p.priority, exportValue: (p) => PRIORITY_LABEL[p.priority] || p.priority },
  { key: 'pick_date', label: 'Tanggal', value: (p) => p.pick_date, type: 'date' },
  { key: 'picked_items', label: 'Item Terambil', value: (p) => p.picked_items, type: 'number' },
  { key: 'total_items', label: 'Total Item', value: (p) => p.total_items, type: 'number', sortable: false },
  { key: 'status', label: 'Status', value: (p) => p.status, exportValue: (p) => STATUS_LABEL[p.status] || p.status },
];

const PickListPage: React.FC = () => {
  const [data, setData] = useState<PickListData[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const tools = useListTools<PickListData>(data, COLUMNS, { filename: 'Pick_List', initialSort: { key: 'pick_date', dir: 'desc' } });

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: any = { page: 1, per_page: 1000 };
      if (statusFilter) params.status = statusFilter;
      const res = await axiosInstance.get('/api/wms/pick-lists', { params });
      setData(res.data.pick_lists || []);
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
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 dark:text-white">
            <ClipboardDocumentListIcon className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            Pick List
          </h1>
          <p className="text-gray-500 mt-1 dark:text-gray-400">Daftar pengambilan barang untuk produksi, pengiriman, dan transfer</p>
        </div>
      </div>

      <ListToolbar tools={tools} placeholder="Cari nomor, tipe, referensi, petugas" extra={
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter status"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
        >
          <option value="">Semua Status</option>
          <option value="draft">Draft</option>
          <option value="assigned">Ditugaskan</option>
          <option value="in_progress">Berjalan</option>
          <option value="completed">Selesai</option>
        </select>
      } />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : tools.rows.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <ClipboardDocumentListIcon className="h-12 w-12 mx-auto mb-3" />
            <p>{tools.total === 0 ? 'Belum ada pick list' : 'Tidak ada pick list yang cocok'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <SortTh tools={tools} col="pick_number" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. Pick List</SortTh>
                  <SortTh tools={tools} col="pick_type" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipe</SortTh>
                  <SortTh tools={tools} col="reference_number" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Referensi</SortTh>
                  <SortTh tools={tools} col="assigned_to" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ditugaskan</SortTh>
                  <SortTh tools={tools} col="pick_date" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal</SortTh>
                  <SortTh tools={tools} col="priority" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Prioritas</SortTh>
                  <SortTh tools={tools} col="picked_items" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Progres</SortTh>
                  <SortTh tools={tools} col="status" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</SortTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {tools.rows.map((pl) => {
                  const cfg = statusConfig[pl.status] || statusConfig.draft;
                  const progress = pl.total_items > 0 ? Math.round(pl.picked_items / pl.total_items * 100) : 0;
                  return (
                    <tr key={pl.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                      <td className="px-4 py-3 font-mono text-sm font-bold text-gray-900 dark:text-white">{pl.pick_number}</td>
                      <td className="px-4 py-3 text-sm capitalize">{TYPE_LABEL(pl.pick_type)}</td>
                      <td className="px-4 py-3 text-sm">{pl.reference_number || '-'}</td>
                      <td className="px-4 py-3 text-sm">{pl.assigned_to || '-'}</td>
                      <td className="px-4 py-3 text-sm">{pl.pick_date ? new Date(pl.pick_date).toLocaleDateString('id-ID') : '-'}</td>
                      <td className={`px-4 py-3 text-xs uppercase ${priorityColors[pl.priority] || 'text-gray-500 dark:text-gray-400'}`}>{PRIORITY_LABEL[pl.priority] || pl.priority}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 rounded-full bg-gray-200 dark:bg-gray-700">
                            <div className={`h-2 rounded-full ${progress >= 100 ? 'bg-green-500' : 'bg-primary-500'}`} style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 dark:text-gray-300">{pl.picked_items}/{pl.total_items}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>{STATUS_LABEL[pl.status] || pl.status}</span></td>
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

export default PickListPage;
