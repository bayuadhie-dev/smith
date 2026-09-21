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
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { exportToCSV } from '../../utils/exportUtils';

const REFERENCE_TYPE_LABELS: Record<string, string> = {
  purchase_order: 'Purchase Order',
  grn_inspection: 'GRN Inspection',
  work_order: 'Work Order',
  material_issue: 'Material Issue',
  sales_order: 'Sales Order',
  transfer_order: 'Transfer Gudang',
  purchase_return: 'Retur Pembelian',
  stock_opname: 'Stock Opname',
  qc_inspection: 'QC Inspection',
  fg_conversion: 'FG Conversion',
  work_order_revert: 'Pembatalan SPK',
  wo_cancellation_reversal: 'Pembatalan SPK',
  batch_confirmation_cancel: 'Pembatalan Konfirmasi Batch',
  production_buffer: 'Buffer Produksi',
  shift_production: 'Produksi Shift',
  inventory_adjustment: 'Penyesuaian Stok',
  manual_input: 'Input Manual',
  quick_add: 'Tambah Cepat',
  manual_entry: 'Entry Manual',
  production_approval: 'Approval Produksi',
};

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
  movement_type_code: string;
  movement_type_label: string;
  resolved_account: { code: string | null; name: string | null; source: string };
}

const ACCOUNT_SOURCE_LABEL: Record<string, string> = {
  item_override: 'Item',
  category_default: 'Kategori',
  global_default: 'Global',
  unresolved: 'Belum resolve',
};

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
  const [referenceTypeFilter, setReferenceTypeFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<{ total_in: number; total_out: number; net: number } | null>(null);

  const buildParams = () => {
    const params: any = {};
    if (search) params.search = search;
    if (typeFilter) params.type = typeFilter;
    if (directionFilter) params.direction = directionFilter;
    if (referenceTypeFilter) params.reference_type = referenceTypeFilter;
    if (batchFilter) params.batch_number = batchFilter;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return params;
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, typeFilter, directionFilter, referenceTypeFilter, batchFilter, startDate, endDate]);

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, directionFilter, referenceTypeFilter, batchFilter, startDate, endDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = { ...buildParams(), page, per_page: 50 };
      const res = await axiosInstance.get('/api/wms/transactions', { params });
      setData(res.data.transactions);
      setTotalPages(res.data.pagination.pages);
    } catch (err: any) {
      toast.error('Gagal memuat transaksi');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await axiosInstance.get('/api/wms/transactions/summary', { params: buildParams() });
      setSummary(res.data);
    } catch (err: any) {
      // non-critical, ignore
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  const handleExportCSV = () => {
    if (data.length === 0) {
      toast.error('Tidak ada data untuk diekspor pada halaman ini');
      return;
    }
    exportToCSV(
      data.map((txn) => ({
        no_transaksi: txn.transaction_number,
        kode_gerakan: txn.movement_type_code,
        label_gerakan: txn.movement_type_label,
        tipe: typeLabels[txn.transaction_type] || txn.transaction_type,
        arah: txn.direction === 'in' ? 'Masuk' : 'Keluar',
        item_kode: txn.item_code,
        item_nama: txn.item_name,
        qty: txn.quantity,
        uom: txn.uom || '',
        dari_lokasi: txn.from_location || '',
        ke_lokasi: txn.to_location || '',
        akun_coa: txn.resolved_account?.code ? `${txn.resolved_account.code} - ${txn.resolved_account.name}` : '',
        sumber_akun: txn.resolved_account?.source || '',
        referensi_tipe: txn.reference_type || '',
        referensi_nomor: txn.reference_number || '',
        batch: txn.batch_number || '',
        tanggal: txn.transaction_date,
        dibuat_oleh: txn.created_by || '',
      })),
      'transaksi-stok'
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ArrowsRightLeftIcon className="h-7 w-7 text-green-600" />
          Transaksi Stok
        </h1>
        <p className="text-gray-500 mt-1">Log semua pergerakan stok — terintegrasi dengan Produksi, PO, SO, dan Transfer</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Summary strip */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-green-600">
              <ArrowDownIcon className="h-5 w-5" />
              <span className="text-sm font-medium">Total Masuk</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{summary.total_in.toLocaleString('id-ID')}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-red-600">
              <ArrowUpIcon className="h-5 w-5" />
              <span className="text-sm font-medium">Total Keluar</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{summary.total_out.toLocaleString('id-ID')}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-blue-600">
              <FunnelIcon className="h-5 w-5" />
              <span className="text-sm font-medium">Selisih Bersih</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{summary.net.toLocaleString('id-ID')}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
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
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={referenceTypeFilter}
            onChange={(e) => { setReferenceTypeFilter(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Semua Dokumen Sumber</option>
            {Object.entries(REFERENCE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="No. Batch"
            value={batchFilter}
            onChange={(e) => { setBatchFilter(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <span className="text-gray-400 text-sm">s/d</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kode Gerakan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Arah</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">QTY</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lokasi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Akun COA</th>
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
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-gray-100 text-gray-700" title={txn.movement_type_label}>
                        {txn.movement_type_code}
                      </span>
                      <div className="text-xs text-gray-400 mt-0.5">{txn.movement_type_label}</div>
                    </td>
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
                      {txn.resolved_account?.code ? (
                        <>
                          <div className="text-gray-900">{txn.resolved_account.code} - {txn.resolved_account.name}</div>
                          <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            txn.resolved_account.source === 'item_override' ? 'bg-blue-50 text-blue-600' :
                            txn.resolved_account.source === 'category_default' ? 'bg-purple-50 text-purple-600' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {ACCOUNT_SOURCE_LABEL[txn.resolved_account.source] || txn.resolved_account.source}
                          </span>
                        </>
                      ) : (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-600">
                          Belum resolve
                        </span>
                      )}
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
