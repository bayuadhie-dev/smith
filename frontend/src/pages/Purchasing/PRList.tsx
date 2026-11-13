import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { PlusIcon, DocumentTextIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useListTools, type ListColumn } from '../../hooks/useListTools';
import { ListToolbar, SortTh } from '../../components/ui/ListTools';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',      color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200' },
  submitted: { label: 'Diajukan',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  approved:  { label: 'Disetujui',  color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  rejected:  { label: 'Ditolak',    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  converted: { label: 'Jadi PO',    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low:    { label: 'Rendah',  color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  normal: { label: 'Normal',  color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  high:   { label: 'Tinggi',  color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
  urgent: { label: 'Urgent',  color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
};

const COLUMNS: ListColumn<any>[] = [
  { key: 'pr_number', label: 'No. PR', value: (p) => p.pr_number },
  { key: 'requester_name', label: 'Pemohon', value: (p) => p.requester_name },
  { key: 'department', label: 'Departemen', value: (p) => p.department },
  { key: 'required_date', label: 'Tgl Dibutuhkan', value: (p) => p.required_date, type: 'date' },
  { key: 'priority', label: 'Prioritas', value: (p) => p.priority, exportValue: (p) => PRIORITY_CONFIG[p.priority]?.label || p.priority },
  { key: 'status', label: 'Status', value: (p) => p.status, exportValue: (p) => STATUS_CONFIG[p.status]?.label || p.status },
  { key: 'total_estimated', label: 'Est. Total (Rp)', value: (p) => p.total_estimated, type: 'number' },
];

export default function PRList() {
  const navigate = useNavigate();
  const [prs, setPrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const fetchPRs = async () => {
    setLoading(true);
    try {
      const params: any = { page: 1, per_page: 1000 };
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const res = await axiosInstance.get('/api/purchasing/purchase-requisitions', { params });
      setPrs(res.data.requisitions || []);
    } catch (err) {
      console.error('Failed to fetch PRs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPRs(); }, [statusFilter, priorityFilter]);

  const tools = useListTools<any>(prs, COLUMNS, { filename: 'Permintaan_Pembelian', initialSort: { key: 'pr_number', dir: 'desc' } });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Permintaan Pembelian (PR)</h1>
          <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">
            Permintaan pembelian dari departemen, {tools.total} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/app/imports?kind=purchase_requisition" className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium dark:hover:bg-gray-700 dark:border-gray-600">Import</Link>
          <Link to="/app/imports?kind=purchase_requisition&mode=export" className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium dark:hover:bg-gray-700 dark:border-gray-600">Ekspor</Link>
        <Link
          to="/app/purchasing/requisitions/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <PlusIcon className="h-4 w-4" />
          Buat PR
        </Link>
        </div>
      </div>

      <ListToolbar tools={tools} placeholder="Cari nomor PR, pemohon, departemen" />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
        >
          <option value="">Semua Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
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
        ) : tools.rows.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <DocumentTextIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>{tools.total === 0 ? 'Belum ada permintaan pembelian' : 'Tidak ada PR yang cocok'}</p>
            {tools.total === 0 && (
              <Link to="/app/purchasing/requisitions/new" className="mt-2 inline-block text-sm text-primary-700 hover:underline dark:text-primary-300">
                Buat PR pertama
              </Link>
            )}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <SortTh tools={tools} col="pr_number" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">No. PR</SortTh>
                <SortTh tools={tools} col="requester_name" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Pemohon</SortTh>
                <SortTh tools={tools} col="department" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Departemen</SortTh>
                <SortTh tools={tools} col="required_date" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Tgl Dibutuhkan</SortTh>
                <SortTh tools={tools} col="priority" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Prioritas</SortTh>
                <SortTh tools={tools} col="status" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Status</SortTh>
                <SortTh tools={tools} col="total_estimated" align="right" className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Est. Total</SortTh>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {tools.rows.map((pr) => {
                const status = STATUS_CONFIG[pr.status] || { label: pr.status, color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
                const priority = PRIORITY_CONFIG[pr.priority] || { label: pr.priority, color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
                return (
                  <tr
                    key={pr.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => navigate(`/app/purchasing/requisitions/${pr.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-primary-700 dark:text-primary-300">{pr.pr_number}</td>
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
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
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

    </div>
  );
}
