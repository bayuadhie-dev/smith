import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { ArrowPathIcon, MagnifyingGlassIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { useDebounce } from '../../hooks/useDebounce';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:        { label: 'Draft',        color: 'bg-gray-100 text-gray-700' },
  approved:     { label: 'Disetujui',    color: 'bg-blue-100 text-blue-700' },
  in_progress:  { label: 'Berjalan',     color: 'bg-amber-100 text-amber-700' },
  completed:    { label: 'Selesai',      color: 'bg-emerald-100 text-emerald-700' },
  cancelled:    { label: 'Dibatalkan',   color: 'bg-red-100 text-red-700' },
  unplaceable:  { label: 'Belum Terjadwal', color: 'bg-gray-100 text-gray-700' },
};

export default function BatchRecordList() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>({ items: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axiosInstance.get('/api/production/batches/records', {
      params: { page, per_page: 50, search: debouncedSearch || undefined },
    })
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [page, debouncedSearch]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Batch Record</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Catatan Pengolahan Bets (GMP) per batch produksi</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Cari nomor batch, SPK, atau produk..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                <th className="px-4 py-3">No. Batch</th>
                <th className="px-4 py-3">No. SPK</th>
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3 text-right">Rencana</th>
                <th className="px-4 py-3 text-right">Realisasi</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Penutupan</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400"><ArrowPathIcon className="h-5 w-5 animate-spin inline mr-2" />Memuat...</td></tr>
              ) : data.items.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-gray-500">Tidak ada batch ditemukan.</td></tr>
              ) : data.items.map((b: any) => {
                const cfg = STATUS_CONFIG[b.status] || { label: b.status, color: 'bg-gray-100 text-gray-700' };
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
                        <span className="text-xs text-emerald-600">Sudah ditutup</span>
                      ) : (
                        <span className="text-xs text-gray-400">Belum ditutup</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/app/production/batches/${b.id}/record`}
                        className="inline-flex items-center gap-1 text-[#059669] hover:underline text-xs font-medium"
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

        {data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-sm">
            <p className="text-gray-500 dark:text-gray-400">Total {data.total} batch</p>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <span className="text-gray-500 dark:text-gray-400">Halaman {page} / {data.pages}</span>
              <button
                disabled={page >= data.pages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-40"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
