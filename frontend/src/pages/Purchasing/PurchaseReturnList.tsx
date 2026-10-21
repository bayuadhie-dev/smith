import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import {
  PlusIcon, MagnifyingGlassIcon, ArrowPathIcon,
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',      color: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Diajukan',   color: 'bg-blue-100 text-blue-700' },
  approved:  { label: 'Disetujui',  color: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Ditolak',    color: 'bg-red-100 text-red-700' },
  completed: { label: 'Selesai',    color: 'bg-emerald-100 text-emerald-700' },
};

const APPROVAL_CONFIG: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Menunggu',  color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Disetujui', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Ditolak',   color: 'bg-red-100 text-red-700' },
};

export default function PurchaseReturnList() {
  const navigate = useNavigate();
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await axiosInstance.get('/api/purchasing/purchase-returns', { params });
      let data: any[] = res.data.returns || [];
      if (search) {
        const q = search.toLowerCase();
        data = data.filter(
          (r) =>
            r.return_number?.toLowerCase().includes(q) ||
            r.invoice_number?.toLowerCase().includes(q) ||
            r.supplier_name?.toLowerCase().includes(q),
        );
      }
      setReturns(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReturns(); }, [statusFilter]);
  useEffect(() => {
    const t = setTimeout(fetchReturns, 300);
    return () => clearTimeout(t);
  }, [search]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Retur Pembelian</h1>
          <p className="text-sm text-gray-500 mt-0.5">Retur barang ke supplier dari Purchase Invoice</p>
        </div>
        <Link
          to="/app/purchasing/returns/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <PlusIcon className="h-4 w-4" />
          Buat Retur
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nomor retur / invoice / supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
        >
          <option value="">Semua Status</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" /> Memuat...
          </div>
        ) : returns.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ArrowUturnLeftIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Belum ada retur pembelian</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">No. Retur</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">No. Invoice</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Supplier</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Tgl Retur</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Total</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Persetujuan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {returns.map((ret) => {
                const status = STATUS_CONFIG[ret.status] || { label: ret.status, color: 'bg-gray-100 text-gray-600' };
                const approval = APPROVAL_CONFIG[ret.approval_status] || { label: ret.approval_status, color: 'bg-gray-100 text-gray-600' };
                return (
                  <tr
                    key={ret.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => navigate(`/app/purchasing/returns/${ret.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400">{ret.return_number}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{ret.invoice_number || '—'}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{ret.supplier_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {ret.return_date ? new Date(ret.return_date).toLocaleDateString('id-ID') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {formatCurrency(ret.total_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${approval.color}`}>
                        {approval.label}
                      </span>
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
