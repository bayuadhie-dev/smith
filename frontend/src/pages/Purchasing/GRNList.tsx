import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import {
  PlusIcon, MagnifyingGlassIcon, ArrowPathIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pending',    color: 'bg-gray-100 text-gray-700' },
  inspected: { label: 'Inspeksi',   color: 'bg-blue-100 text-blue-700' },
  approved:  { label: 'Disetujui',  color: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Ditolak',    color: 'bg-red-100 text-red-700' },
};

const QC_CONFIG: Record<string, { label: string; color: string }> = {
  passed:   { label: 'Lulus QC',    color: 'bg-green-100 text-green-700' },
  partial:  { label: 'Sebagian',    color: 'bg-yellow-100 text-yellow-700' },
  failed:   { label: 'Gagal QC',    color: 'bg-red-100 text-red-700' },
};

export default function GRNList() {
  const navigate = useNavigate();
  const [grns, setGrns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchGRNs = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/purchasing/grn');
      let data: any[] = res.data.grns || [];
      if (search) {
        const q = search.toLowerCase();
        data = data.filter(
          (g) =>
            g.grn_number?.toLowerCase().includes(q) ||
            g.po_number?.toLowerCase().includes(q) ||
            g.supplier_name?.toLowerCase().includes(q),
        );
      }
      setGrns(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGRNs(); }, []);
  useEffect(() => {
    const t = setTimeout(fetchGRNs, 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Goods Received Note</h1>
          <p className="text-sm text-gray-500 mt-0.5">Penerimaan barang + QC Inspection</p>
        </div>
        <Link
          to="/app/purchasing/grn/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <PlusIcon className="h-4 w-4" />
          Buat GRN
        </Link>
      </div>

      <div className="relative max-w-xs">
        <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Cari nomor GRN / PO / supplier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" /> Memuat...
          </div>
        ) : grns.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ClipboardDocumentCheckIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Belum ada GRN</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">No. GRN</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">No. PO</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Supplier</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Tgl Terima</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">QC</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {grns.map((grn) => {
                const status = STATUS_CONFIG[grn.status] || { label: grn.status, color: 'bg-gray-100 text-gray-600' };
                const qc = grn.quality_status ? QC_CONFIG[grn.quality_status] : null;
                return (
                  <tr
                    key={grn.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => navigate(`/app/purchasing/grn/${grn.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400">{grn.grn_number}</td>
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
                        className="text-xs text-blue-600 hover:underline"
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
