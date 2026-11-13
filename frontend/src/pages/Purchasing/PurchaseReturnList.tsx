import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { PlusIcon, ArrowPathIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { useListTools, type ListColumn } from '../../hooks/useListTools';
import { ListToolbar, SortTh } from '../../components/ui/ListTools';

import { TableSkeleton } from '../../components/ui/Skeleton';
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',      color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200' },
  submitted: { label: 'Diajukan',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  approved:  { label: 'Disetujui',  color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  rejected:  { label: 'Ditolak',    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  completed: { label: 'Selesai',    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
};

const APPROVAL_CONFIG: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Menunggu',  color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  approved: { label: 'Disetujui', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  rejected: { label: 'Ditolak',   color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

const COLUMNS: ListColumn<any>[] = [
  { key: 'return_number', label: 'No. Retur', value: (r) => r.return_number },
  { key: 'invoice_number', label: 'No. Faktur', value: (r) => r.invoice_number },
  { key: 'supplier_name', label: 'Pemasok', value: (r) => r.supplier_name },
  { key: 'return_date', label: 'Tgl Retur', value: (r) => r.return_date, type: 'date' },
  { key: 'total_amount', label: 'Total (Rp)', value: (r) => r.total_amount, type: 'number' },
  { key: 'status', label: 'Status', value: (r) => r.status, exportValue: (r) => STATUS_CONFIG[r.status]?.label || r.status },
  { key: 'approval_status', label: 'Persetujuan', value: (r) => r.approval_status, exportValue: (r) => APPROVAL_CONFIG[r.approval_status]?.label || r.approval_status },
];

export default function PurchaseReturnList() {
  const navigate = useNavigate();
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { per_page: 1000 };
      if (statusFilter) params.status = statusFilter;
      const res = await axiosInstance.get('/api/purchasing/purchase-returns', { params });
      const data: any[] = res.data.returns || [];
      setReturns(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReturns(); }, [statusFilter]);

  const tools = useListTools<any>(returns, COLUMNS, { filename: 'Retur_Pembelian', initialSort: { key: 'return_date', dir: 'desc' } });

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Retur Pembelian</h1>
          <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">Retur barang ke pemasok dari faktur pembelian</p>
        </div>
        <Link
          to="/app/purchasing/returns/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <PlusIcon className="h-4 w-4" />
          Buat Retur
        </Link>
      </div>

      <ListToolbar tools={tools} placeholder="Cari nomor retur, faktur, atau pemasok" />

      <div className="flex items-center gap-3">
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
          <TableSkeleton rows={8} cols={7} />
        ) : tools.rows.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ArrowUturnLeftIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>{tools.total === 0 ? 'Belum ada retur pembelian' : 'Tidak ada retur yang cocok'}</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <SortTh tools={tools} col="return_number" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">No. Retur</SortTh>
                <SortTh tools={tools} col="invoice_number" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">No. Faktur</SortTh>
                <SortTh tools={tools} col="supplier_name" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Pemasok</SortTh>
                <SortTh tools={tools} col="return_date" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Tgl Retur</SortTh>
                <SortTh tools={tools} col="total_amount" align="right" className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Total</SortTh>
                <SortTh tools={tools} col="status" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Status</SortTh>
                <SortTh tools={tools} col="approval_status" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Persetujuan</SortTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {tools.rows.map((ret) => {
                const status = STATUS_CONFIG[ret.status] || { label: ret.status, color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
                const approval = APPROVAL_CONFIG[ret.approval_status] || { label: ret.approval_status, color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
                return (
                  <tr
                    key={ret.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => navigate(`/app/purchasing/returns/${ret.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-primary-700 dark:text-primary-300">{ret.return_number}</td>
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
