import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { ArrowPathIcon, DocumentTextIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import { useListTools, type ListColumn } from '../../hooks/useListTools';
import { ListToolbar, SortTh } from '../../components/ui/ListTools';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:        { label: 'Draft',        color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200' },
  approved:     { label: 'Disetujui',    color: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' },
  in_progress:  { label: 'Berjalan',     color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  completed:    { label: 'Selesai',      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  cancelled:    { label: 'Dibatalkan',   color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  unplaceable:  { label: 'Belum Terjadwal', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200' },
};

const COLUMNS: ListColumn<any>[] = [
  { key: 'batch_number', label: 'No. Batch', value: (b) => b.batch_number },
  { key: 'wo_number', label: 'No. SPK', value: (b) => b.wo_number },
  { key: 'product_name', label: 'Produk', value: (b) => b.product_name },
  { key: 'scheduled_date', label: 'Tanggal', value: (b) => b.scheduled_date, type: 'date' },
  { key: 'planned_qty', label: 'Rencana', value: (b) => b.planned_qty, type: 'number' },
  { key: 'realized_qty', label: 'Realisasi', value: (b) => b.realized_qty, type: 'number' },
  { key: 'status', label: 'Status', value: (b) => b.status, exportValue: (b) => STATUS_CONFIG[b.status]?.label || b.status },
  { key: 'admin_closed', label: 'Penutupan', value: (b) => (b.admin_closed ? 1 : 0), exportValue: (b) => (b.admin_closed ? 'Sudah ditutup' : 'Belum ditutup') },
];

export default function BatchRecordList() {
  const [data, setData] = useState<any>({ items: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axiosInstance.get('/api/production/batches/records', {
      params: { page: 1, per_page: 1000 },
    })
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  const tools = useListTools<any>(data.items, COLUMNS, { filename: 'Batch_Record', initialSort: { key: 'scheduled_date', dir: 'desc' } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Laporan Batch</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Catatan Pengolahan Bets (GMP) per batch produksi</p>
        </div>
        <Link
          to="/app/production/batches/weekly-report"
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-primary-600 to-primary-700 text-white rounded-lg hover:shadow-lg transition-shadow text-sm font-medium"
        >
          <CalendarDaysIcon className="h-4 w-4" /> Laporan Mingguan
        </Link>
      </div>

      <ListToolbar tools={tools} placeholder="Cari nomor batch, SPK, atau produk" />

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                <SortTh tools={tools} col="batch_number" className="px-4 py-3">No. Batch</SortTh>
                <SortTh tools={tools} col="wo_number" className="px-4 py-3">No. SPK</SortTh>
                <SortTh tools={tools} col="product_name" className="px-4 py-3">Produk</SortTh>
                <SortTh tools={tools} col="scheduled_date" className="px-4 py-3">Tanggal</SortTh>
                <SortTh tools={tools} col="planned_qty" align="right" className="px-4 py-3 text-right">Rencana</SortTh>
                <SortTh tools={tools} col="realized_qty" align="right" className="px-4 py-3 text-right">Realisasi</SortTh>
                <SortTh tools={tools} col="status" className="px-4 py-3">Status</SortTh>
                <SortTh tools={tools} col="admin_closed" className="px-4 py-3">Penutupan</SortTh>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400"><ArrowPathIcon className="h-5 w-5 animate-spin inline mr-2" />Memuat...</td></tr>
              ) : tools.rows.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-gray-500 dark:text-gray-400">{tools.total === 0 ? 'Belum ada batch.' : 'Tidak ada batch yang cocok.'}</td></tr>
              ) : tools.rows.map((b: any) => {
                const cfg = STATUS_CONFIG[b.status] || { label: b.status, color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200' };
                return (
                  <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{b.batch_number}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{b.wo_number || '-'}</td>
                    <td className="px-4 py-3">{b.product_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{b.scheduled_date || '-'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{b.planned_qty.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{b.realized_qty.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>{cfg.label}</span></td>
                    <td className="px-4 py-3">
                      {b.admin_closed ? (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">Sudah ditutup</span>
                      ) : (
                        <span className="text-xs text-gray-400">Belum ditutup</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/app/production/batches/${b.id}/record`}
                        className="inline-flex items-center gap-1 text-primary-600 hover:underline text-xs font-medium dark:text-primary-400"
                      >
                        <DocumentTextIcon className="h-3.5 w-3.5" /> Lihat
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
