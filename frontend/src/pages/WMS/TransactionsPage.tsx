import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import {
  ArrowsRightLeftIcon,
  MagnifyingGlassIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

interface Transaction {
  id: number;
  transaction_number: string;
  transaction_type: string;
  transaction_date: string;
  item_type: string;
  item_code: string;
  item_name: string;
  quantity: number;
  uom: string;
  direction: string;
  from_location: string | null;
  to_location: string | null;
  batch_number: string | null;
  reference_type: string | null;
  reference_number: string | null;
  wo_number: string | null;
  machine_name: string | null;
  shift: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
}

const typeLabels: Record<string, string> = {
  production_output: 'Output Produksi',
  material_issue: 'Pengeluaran Material',
  goods_receipt: 'Penerimaan Barang',
  sales_delivery: 'Pengiriman',
  transfer: 'Transfer',
  adjustment: 'Penyesuaian',
  fg_conversion: 'Konversi FG',
  wip_in: 'WIP Masuk',
  wip_out: 'WIP Keluar',
  scrap: 'Scrap',
};

const TransactionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchData();
  }, [page, typeFilter, directionFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: any = { page, per_page: 50 };
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      if (directionFilter) params.direction = directionFilter;
      const res = await axiosInstance.get('/api/wms/transactions', { params });
      setData(res.data.transactions);
      setTotalPages(res.data.pagination.pages);
    } catch (err: any) {
      toast.error('Gagal memuat transaksi');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ArrowsRightLeftIcon className="h-7 w-7 text-green-600" />
          Transaksi Inventori
        </h1>
        <p className="text-gray-500 mt-1">Log semua pergerakan stok — terintegrasi dengan Produksi, PO, SO, dan Transfer</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari no. transaksi, referensi, batch..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </form>
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Semua Tipe</option>
              {Object.entries(typeLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={directionFilter}
              onChange={(e) => { setDirectionFilter(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">In & Out</option>
              <option value="in">Masuk</option>
              <option value="out">Keluar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. Transaksi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Arah</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">QTY</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lokasi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referensi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((txn) => (
                  <tr key={txn.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/app/wms/transactions/${txn.id}`)}>
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">{txn.transaction_number}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{typeLabels[txn.transaction_type] || txn.transaction_type}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {txn.direction === 'in' ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium">
                          <ArrowDownIcon className="h-4 w-4" /> IN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 text-sm font-medium">
                          <ArrowUpIcon className="h-4 w-4" /> OUT
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{txn.item_name}</div>
                      <div className="text-xs text-gray-400">{txn.item_code} · {txn.item_type}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">{txn.quantity.toLocaleString()} {txn.uom}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {txn.from_location && <div>Dari: {txn.from_location}</div>}
                      {txn.to_location && <div>Ke: {txn.to_location}</div>}
                      {!txn.from_location && !txn.to_location && '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {txn.wo_number && <div className="text-blue-600">{txn.wo_number}</div>}
                      {txn.reference_number && <div className="text-gray-500 text-xs">{txn.reference_number}</div>}
                      {txn.batch_number && <div className="text-gray-400 text-xs">Batch: {txn.batch_number}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {txn.transaction_date ? new Date(txn.transaction_date).toLocaleDateString('id-ID') : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{txn.created_by || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">Sebelumnya</button>
            <span className="text-sm text-gray-600">Halaman {page} dari {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">Selanjutnya</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionsPage;
