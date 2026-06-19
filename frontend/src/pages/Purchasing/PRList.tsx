import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import {
  PlusIcon, MagnifyingGlassIcon, FunnelIcon,
  DocumentTextIcon, ClockIcon, CheckCircleIcon,
  XCircleIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',      color: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Diajukan',   color: 'bg-blue-100 text-blue-700' },
  approved:  { label: 'Disetujui',  color: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Ditolak',    color: 'bg-red-100 text-red-700' },
  converted: { label: 'Jadi PO',    color: 'bg-purple-100 text-purple-700' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low:    { label: 'Rendah',  color: 'bg-gray-100 text-gray-600' },
  normal: { label: 'Normal',  color: 'bg-blue-100 text-blue-600' },
  high:   { label: 'Tinggi',  color: 'bg-orange-100 text-orange-600' },
  urgent: { label: 'Urgent',  color: 'bg-red-100 text-red-600' },
};

export default function PRList() {
  const navigate = useNavigate();
  const [prs, setPrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const fetchPRs = async () => {
    setLoading(true);
    try {
      const params: any = { page, per_page: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const res = await axiosInstance.get('/api/purchasing/purchase-requisitions', { params });
      setPrs(res.data.requisitions || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch PRs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPRs(); }, [page, statusFilter, priorityFilter]);
  useEffect(() => {
    const t = setTimeout(fetchPRs, 400);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Purchase Requisition</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Permintaan pembelian dari departemen — {total} total
          </p>
        </div>
        <Link
          to="/app/purchasing/requisitions/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <PlusIcon className="h-4 w-4" />
          Buat PR
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nomor PR..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
        >
          <option value="">Semua Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
        >
          <option value="">Semua Prioritas</option>
          {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <ArrowPathIcon className="h-6 w-6 animate-spin mr-2" />
            Memuat data...
          </div>
        ) : prs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <DocumentTextIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Belum ada Purchase Requisition</p>
            <Link to="/app/purchasing/requisitions/new" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
              Buat PR pertama
            </Link>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">No. PR</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Pemohon</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Departemen</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Tgl Dibutuhkan</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Prioritas</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Est. Total</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {prs.map((pr) => {
                const status = STATUS_CONFIG[pr.status] || { label: pr.status, color: 'bg-gray-100 text-gray-600' };
                const priority = PRIORITY_CONFIG[pr.priority] || { label: pr.priority, color: 'bg-gray-100 text-gray-600' };
                return (
                  <tr
                    key={pr.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => navigate(`/app/purchasing/requisitions/${pr.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400">{pr.pr_number}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{pr.requester_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{pr.department || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {pr.required_date ? new Date(pr.required_date).toLocaleDateString('id-ID') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${priority.color}`}>
                        {priority.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {pr.total_estimated > 0
                        ? `Rp ${Number(pr.total_estimated).toLocaleString('id-ID')}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Link
                        to={`/app/purchasing/requisitions/${pr.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">Hal {page}</span>
          <button
            disabled={prs.length < 20}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
