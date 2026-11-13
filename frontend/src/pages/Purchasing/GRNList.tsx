import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { PlusIcon, ArrowPathIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import { useListTools, type ListColumn } from '../../hooks/useListTools';
import { ListToolbar, SortTh } from '../../components/ui/ListTools';

import { TableSkeleton } from '../../components/ui/Skeleton';
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pending',    color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200' },
  inspected: { label: 'Inspeksi',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  approved:  { label: 'Disetujui',  color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  rejected:  { label: 'Ditolak',    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

const QC_CONFIG: Record<string, { label: string; color: string }> = {
  passed:   { label: 'Lulus QC',    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  partial:  { label: 'Sebagian',    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  failed:   { label: 'Gagal QC',    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

const COLUMNS: ListColumn<any>[] = [
  { key: 'grn_number', label: 'No. GRN', value: (g) => g.grn_number },
  { key: 'po_number', label: 'No. PO', value: (g) => g.po_number },
  { key: 'supplier_name', label: 'Pemasok', value: (g) => g.supplier_name },
  { key: 'receipt_date', label: 'Tgl Terima', value: (g) => g.receipt_date, type: 'date' },
  { key: 'status', label: 'Status', value: (g) => g.status, exportValue: (g) => STATUS_CONFIG[g.status]?.label || g.status },
  { key: 'quality_status', label: 'QC', value: (g) => g.quality_status, exportValue: (g) => (g.quality_status ? QC_CONFIG[g.quality_status]?.label || g.quality_status : 'Belum inspeksi') },
];

export default function GRNList() {
  const navigate = useNavigate();
  const [grns, setGrns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGRNs = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/purchasing/grn');
      const data: any[] = res.data.grns || [];
      setGrns(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGRNs(); }, []);

  const tools = useListTools<any>(grns, COLUMNS, { filename: 'Penerimaan_Barang_GRN', initialSort: { key: 'receipt_date', dir: 'desc' } });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Penerimaan Barang (GRN)</h1>
          <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">Penerimaan barang + QC Inspection</p>
        </div>
        <Link
          to="/app/purchasing/grn/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <PlusIcon className="h-4 w-4" />
          Buat GRN
        </Link>
      </div>

      <ListToolbar tools={tools} placeholder="Cari nomor GRN, PO, atau pemasok" />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
        {loading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : tools.rows.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ClipboardDocumentCheckIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>{tools.total === 0 ? 'Belum ada GRN' : 'Tidak ada GRN yang cocok'}</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <SortTh tools={tools} col="grn_number" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">No. GRN</SortTh>
                <SortTh tools={tools} col="po_number" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">No. PO</SortTh>
                <SortTh tools={tools} col="supplier_name" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Pemasok</SortTh>
                <SortTh tools={tools} col="receipt_date" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Tgl Terima</SortTh>
                <SortTh tools={tools} col="status" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Status</SortTh>
                <SortTh tools={tools} col="quality_status" className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">QC</SortTh>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {tools.rows.map((grn) => {
                const status = STATUS_CONFIG[grn.status] || { label: grn.status, color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
                const qc = grn.quality_status ? QC_CONFIG[grn.quality_status] : null;
                return (
                  <tr
                    key={grn.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => navigate(`/app/purchasing/grn/${grn.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-primary-700 dark:text-primary-300">{grn.grn_number}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{grn.po_number}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{grn.supplier_name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {grn.receipt_date
                        ? new Date(grn.receipt_date).toLocaleDateString('id-ID')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {qc ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${qc.color}`}>
                          {qc.label}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Belum inspeksi</span>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Link
                        to={`/app/purchasing/grn/${grn.id}`}
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {grn.status === 'pending' ? 'Inspeksi' : 'Detail'}
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
