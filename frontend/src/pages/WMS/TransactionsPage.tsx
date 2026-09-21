import React, { useState, useEffect, useMemo } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  ArrowsRightLeftIcon,
  MagnifyingGlassIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  TableCellsIcon,
  XMarkIcon,
  CubeIcon,
  BanknotesIcon,
  DocumentTextIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

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

const ACCOUNT_SOURCE_LABEL: Record<string, string> = {
  item_override: 'Item',
  category_default: 'Kategori',
  global_default: 'Global',
  unresolved: 'Belum resolve',
};

const typeLabels: Record<string, string> = {
  production_output: 'Output Produksi',
  production_receipt: 'Penerimaan Produksi',
  material_issue: 'Pengeluaran Material',
  goods_receipt: 'Penerimaan Barang',
  sales_delivery: 'Pengiriman',
  stock_in: 'Stok Masuk',
  stock_out: 'Stok Keluar',
  transfer: 'Transfer',
  adjustment: 'Penyesuaian',
  fg_conversion: 'Konversi FG',
  wip_in: 'WIP Masuk',
  wip_out: 'WIP Keluar',
  scrap: 'Scrap',
  qc_disposition: 'Disposisi QC',
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
  reference_id: number | null;
  reference_number: string | null;
  wo_number: string | null;
  machine_name: string | null;
  shift: string | null;
  unit_cost: number | null;
  total_cost: number | null;
  status: string;
  created_by: string | null;
  created_at: string;
  movement_type_code: string;
  movement_type_label: string;
  resolved_account: { code: string | null; name: string | null; source: string };
  accounting_entry_number: string | null;
  accounting_entry_status: string | null;
}

interface Account {
  id: number;
  code: string;
  name: string;
}

interface WarehouseLocationOpt {
  id: number;
  location_code: string;
  zone_name?: string;
}

type ColumnLayout = 'standard' | 'audit';

const formatRupiah = (n: number | null | undefined) => {
  if (n === null || n === undefined) return '-';
  return `Rp ${n.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
};

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

const TransactionsPage: React.FC = () => {
  const [data, setData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- Selection screen (MB51-style search criteria) ----
  const [itemSearch, setItemSearch] = useState('');
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [accountFilter, setAccountFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [batchFilter, setBatchFilter] = useState('');

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [locations, setLocations] = useState<WarehouseLocationOpt[]>([]);

  // ---- Toolbar ----
  const [resultSearch, setResultSearch] = useState('');
  const [columnLayout, setColumnLayout] = useState<ColumnLayout>('standard');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<{
    total_in: number; total_out: number; net: number;
    total_amount_in: number; total_amount_out: number; net_amount: number;
  } | null>(null);

  // ---- Slide-over drawer ----
  const [drawerTxnId, setDrawerTxnId] = useState<number | null>(null);
  const [drawerData, setDrawerData] = useState<any>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'fisik' | 'jurnal' | 'flow'>('fisik');

  const buildParams = () => {
    const params: any = {};
    if (itemSearch) params.search = itemSearch;
    if (typeFilters.length > 0) params.type = typeFilters.join(',');
    if (accountFilter) params.account_code = accountFilter;
    if (locationFilter) params.location_id = locationFilter;
    if (batchFilter) params.batch_number = batchFilter;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return params;
  };

  useEffect(() => {
    axiosInstance.get('/api/finance/accounts').then((res) => {
      const list = (res.data?.accounts || []).filter((a: any) => !a.is_header);
      setAccounts(list.map((a: any) => ({ id: a.id, code: a.code, name: a.name })));
    }).catch(() => {});
    axiosInstance.get('/api/warehouse/locations', { params: { per_page: 200 } }).then((res) => {
      setLocations(res.data?.locations || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = { ...buildParams(), page, per_page: 50 };
      const res = await axiosInstance.get('/api/wms/transactions', { params });
      setData(res.data.transactions);
      setTotalPages(res.data.pagination.pages);
      setTotal(res.data.pagination.total);
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

  const runSearch = () => {
    setPage(1);
    fetchData();
    fetchSummary();
  };

  useEffect(() => {
    fetchSummary();
    // load once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyDateShortcut = (shortcut: 'today' | '7days' | 'month') => {
    const now = new Date();
    if (shortcut === 'today') {
      setStartDate(toISODate(now));
      setEndDate(toISODate(now));
    } else if (shortcut === '7days') {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      setStartDate(toISODate(from));
      setEndDate(toISODate(now));
    } else {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toISODate(from));
      setEndDate(toISODate(now));
    }
  };

  const resetFilters = () => {
    setItemSearch('');
    setTypeFilters([]);
    setAccountFilter('');
    setLocationFilter('');
    setStartDate('');
    setEndDate('');
    setBatchFilter('');
    setPage(1);
    setTimeout(() => { fetchData(); fetchSummary(); }, 0);
  };

  const toggleTypeFilter = (t: string) => {
    setTypeFilters((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };

  // Client-side "cari di hasil" - filters the currently loaded page without a new request
  const visibleRows = useMemo(() => {
    if (!resultSearch.trim()) return data;
    const q = resultSearch.trim().toLowerCase();
    return data.filter((t) =>
      t.transaction_number.toLowerCase().includes(q) ||
      (t.item_name || '').toLowerCase().includes(q) ||
      (t.item_code || '').toLowerCase().includes(q) ||
      (t.reference_number || '').toLowerCase().includes(q) ||
      (t.batch_number || '').toLowerCase().includes(q)
    );
  }, [data, resultSearch]);

  const buildExportRows = () => visibleRows.map((txn) => ({
    'No. Dokumen': txn.transaction_number,
    'Tgl Posting': txn.transaction_date ? new Date(txn.transaction_date).toLocaleString('id-ID') : '',
    'Kode Gerakan': txn.movement_type_code,
    'Nama Gerakan': txn.movement_type_label,
    'Arah': txn.direction === 'in' ? 'Masuk' : 'Keluar',
    'Kode Barang': txn.item_code,
    'Nama Barang': txn.item_name,
    'Qty': txn.quantity,
    'UOM': txn.uom || '',
    'Nilai (Rp)': txn.total_cost || 0,
    'Dari Lokasi': txn.from_location || '',
    'Ke Lokasi': txn.to_location || '',
    'Akun COA': txn.resolved_account?.code ? `${txn.resolved_account.code} - ${txn.resolved_account.name}` : '',
    'Sumber Akun': txn.resolved_account?.source ? (ACCOUNT_SOURCE_LABEL[txn.resolved_account.source] || txn.resolved_account.source) : '',
    'No. Jurnal': txn.accounting_entry_number || '',
    'Tipe Dokumen Sumber': txn.reference_type ? (REFERENCE_TYPE_LABELS[txn.reference_type] || txn.reference_type) : '',
    'No. Dokumen Sumber': txn.reference_number || '',
    'No. Batch': txn.batch_number || '',
    'Dibuat Oleh': txn.created_by || '',
  }));

  const handleExportExcel = () => {
    if (visibleRows.length === 0) {
      toast.error('Tidak ada data untuk diekspor pada halaman ini');
      return;
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(buildExportRows());
    XLSX.utils.book_append_sheet(wb, ws, 'Transaksi Stok');
    XLSX.writeFile(wb, `transaksi-stok-${toISODate(new Date())}.xlsx`);
  };

  const handleExportCSV = () => {
    if (visibleRows.length === 0) {
      toast.error('Tidak ada data untuk diekspor pada halaman ini');
      return;
    }
    const rows = buildExportRows();
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map((r: any) => headers.map((h) => {
        const v = r[h];
        return typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
      }).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transaksi-stok-${toISODate(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openDrawer = async (id: number) => {
    setDrawerTxnId(id);
    setDrawerTab('fisik');
    setDrawerLoading(true);
    try {
      const res = await axiosInstance.get(`/api/wms/transactions/${id}`);
      setDrawerData(res.data.transaction);
    } catch (err) {
      toast.error('Gagal memuat detail transaksi');
    } finally {
      setDrawerLoading(false);
    }
  };

  const closeDrawer = () => {
    setDrawerTxnId(null);
    setDrawerData(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ArrowsRightLeftIcon className="h-7 w-7 text-green-600" />
          Transaksi Stok
        </h1>
        <p className="text-gray-500 mt-1">Log pergerakan fisik material, nilai valuasi finansial, dan buku besar akuntansi (COA) — terintegrasi dengan Produksi, PO, SO, dan Transfer</p>
      </div>

      {/* Kartu Ringkasan Finansial & Fisik */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-green-600">
              <ArrowDownIcon className="h-5 w-5" />
              <span className="text-sm font-medium">Total Masuk</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{summary.total_in.toLocaleString('id-ID')}</div>
            <div className="text-sm text-green-700 mt-0.5">{formatRupiah(summary.total_amount_in)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-red-600">
              <ArrowUpIcon className="h-5 w-5" />
              <span className="text-sm font-medium">Total Keluar</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{summary.total_out.toLocaleString('id-ID')}</div>
            <div className="text-sm text-red-700 mt-0.5">{formatRupiah(summary.total_amount_out)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-blue-600">
              <FunnelIcon className="h-5 w-5" />
              <span className="text-sm font-medium">Mutasi Bersih (Net)</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{summary.net >= 0 ? '+' : ''}{summary.net.toLocaleString('id-ID')}</div>
            <div className={`text-sm mt-0.5 ${summary.net_amount >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
              {summary.net_amount >= 0 ? '+' : ''}{formatRupiah(summary.net_amount)}
            </div>
          </div>
        </div>
      )}

      {/* Panel Kriteria Seleksi (Selection Screen) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Kriteria Seleksi</div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Rentang tanggal + shortcut */}
          <div className="lg:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Rentang Tanggal</label>
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
              <span className="text-gray-400 text-sm">s/d</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
              <button onClick={() => applyDateShortcut('today')} className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600">Hari Ini</button>
              <button onClick={() => applyDateShortcut('7days')} className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600">7 Hari</button>
              <button onClick={() => applyDateShortcut('month')} className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md text-gray-600">Bulan Ini</button>
            </div>
          </div>

          {/* Movement type multi-select */}
          <div className="relative">
            <label className="block text-xs text-gray-500 mb-1">Kode Gerakan / Tipe</label>
            <button
              onClick={() => setTypeDropdownOpen((v) => !v)}
              className="w-full flex items-center justify-between border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
            >
              <span className="truncate text-left">
                {typeFilters.length === 0 ? 'Semua Tipe' : `${typeFilters.length} tipe dipilih`}
              </span>
              <ChevronDownIcon className="h-4 w-4 text-gray-400 shrink-0" />
            </button>
            {typeDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto p-2">
                {Object.entries(typeLabels).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-50 rounded cursor-pointer">
                    <input type="checkbox" checked={typeFilters.includes(k)} onChange={() => toggleTypeFilter(k)} />
                    {v}
                  </label>
                ))}
                <button onClick={() => setTypeDropdownOpen(false)} className="w-full mt-1 text-xs text-blue-600 py-1">Tutup</button>
              </div>
            )}
          </div>

          {/* Akun COA */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Akun COA</label>
            <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
              <option value="">Semua Akun</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Barang / Item</label>
            <input type="text" placeholder="Cari nama/kode barang..." value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Gudang / Lokasi</label>
            <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
              <option value="">Semua Gudang / Lokasi</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.location_code}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">No. Batch</label>
            <input type="text" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div className="flex items-end gap-2">
            <button onClick={runSearch} className="flex-1 px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
              Jalankan Pencarian
            </button>
            <button onClick={resetFilters} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg">
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar tabel */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari di hasil..."
            value={resultSearch}
            onChange={(e) => setResultSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setColumnLayout('standard')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium ${columnLayout === 'standard' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
          >
            <TableCellsIcon className="h-3.5 w-3.5" /> Mode Standar
          </button>
          <button
            onClick={() => setColumnLayout('audit')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium ${columnLayout === 'audit' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
          >
            <TableCellsIcon className="h-3.5 w-3.5" /> Mode Audit Lengkap
          </button>
        </div>
        <button onClick={handleExportExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50">
          <ArrowDownTrayIcon className="h-3.5 w-3.5" /> Export Excel
        </button>
        <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50">
          <ArrowDownTrayIcon className="h-3.5 w-3.5" /> Export CSV
        </button>
        <span className="text-xs text-gray-400 ml-auto">{total.toLocaleString('id-ID')} dokumen</span>
      </div>

      {/* Tabel Data Audit (Dense Enterprise View) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">No. Dokumen</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Kode Gerakan</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase">Arah</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Barang</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase">Qty</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase">Nilai (Rp)</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Akun COA</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">No. Jurnal</th>
                  {columnLayout === 'audit' && (
                    <>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Batch</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Lokasi Asal/Tujuan</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase">Unit Cost</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Dokumen Sumber</th>
                    </>
                  )}
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Tgl Posting</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono text-[13px]">
                {visibleRows.map((txn) => (
                  <tr key={txn.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openDrawer(txn.id)}>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{txn.transaction_number}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700" title={txn.movement_type_label}>
                        {txn.movement_type_code}
                      </span>
                      <span className="ml-1 font-sans text-[11px] text-gray-400">{txn.movement_type_label}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {txn.direction === 'in' ? (
                        <ArrowDownIcon className="h-4 w-4 text-green-600 inline" />
                      ) : (
                        <ArrowUpIcon className="h-4 w-4 text-red-600 inline" />
                      )}
                    </td>
                    <td className="px-3 py-2 font-sans">
                      <div className="font-medium text-gray-900">{txn.item_name}</div>
                      <div className="text-[11px] text-gray-400">{txn.item_code}</div>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{txn.quantity.toLocaleString('id-ID')} <span className="text-gray-400 text-[11px]">{txn.uom}</span></td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{txn.total_cost ? formatRupiah(txn.total_cost) : <span className="text-gray-300">-</span>}</td>
                    <td className="px-3 py-2 font-sans">
                      {txn.resolved_account?.code ? (
                        <>
                          <div className="text-gray-900 text-xs">{txn.resolved_account.code}</div>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            txn.resolved_account.source === 'item_override' ? 'bg-blue-50 text-blue-600' :
                            txn.resolved_account.source === 'category_default' ? 'bg-purple-50 text-purple-600' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {ACCOUNT_SOURCE_LABEL[txn.resolved_account.source] || txn.resolved_account.source}
                          </span>
                        </>
                      ) : (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-600 font-sans">Belum resolve</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {txn.accounting_entry_number ? (
                        <span className="text-green-700">{txn.accounting_entry_number}</span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    {columnLayout === 'audit' && (
                      <>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-600">{txn.batch_number || '-'}</td>
                        <td className="px-3 py-2 font-sans text-xs text-gray-600 whitespace-nowrap">
                          {txn.from_location || '-'} {txn.to_location ? `→ ${txn.to_location}` : ''}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{txn.unit_cost ? formatRupiah(txn.unit_cost) : '-'}</td>
                        <td className="px-3 py-2 font-sans text-xs">
                          {txn.reference_type && <div className="text-gray-700">{REFERENCE_TYPE_LABELS[txn.reference_type] || txn.reference_type}</div>}
                          {txn.reference_number && <div className="text-gray-400">{txn.reference_number}</div>}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2 font-sans text-xs text-gray-500 whitespace-nowrap">
                      {txn.transaction_date ? new Date(txn.transaction_date).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleRows.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">Tidak ada data yang cocok</div>
            )}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">Sebelumnya</button>
            <span className="text-sm text-gray-600">Halaman {page} dari {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">Selanjutnya</button>
          </div>
        )}
      </div>

      {/* Slide-over Drawer */}
      {drawerTxnId !== null && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/30" onClick={closeDrawer} />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Detail Transaksi</h2>
                <p className="text-xs text-gray-400 font-mono">{drawerData?.transaction_number || '...'}</p>
              </div>
              <button onClick={closeDrawer} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="flex border-b border-gray-200">
              {[
                { key: 'fisik', label: 'Fisik Material', icon: CubeIcon },
                { key: 'jurnal', label: 'Jurnal Akuntansi', icon: BanknotesIcon },
                { key: 'flow', label: 'Document Flow', icon: DocumentTextIcon },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setDrawerTab(tab.key as any)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium border-b-2 ${
                    drawerTab === tab.key ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="h-4 w-4" /> {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {drawerLoading || !drawerData ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                </div>
              ) : (
                <>
                  {drawerTab === 'fisik' && (
                    <div className="space-y-1">
                      <DrawerRow label="Kode Gerakan" value={`${drawerData.movement_type_code} - ${drawerData.movement_type_label}`} />
                      <DrawerRow label="Tipe" value={typeLabels[drawerData.transaction_type] || drawerData.transaction_type} />
                      <DrawerRow label="Arah" value={drawerData.direction === 'in' ? 'Masuk (IN)' : 'Keluar (OUT)'} />
                      <DrawerRow label="Barang" value={`${drawerData.item_code} - ${drawerData.item_name}`} />
                      <DrawerRow label="Kuantitas" value={`${Number(drawerData.quantity).toLocaleString('id-ID')} ${drawerData.uom || ''}`} />
                      <DrawerRow label="Dari Lokasi" value={drawerData.from_location} />
                      <DrawerRow label="Ke Lokasi" value={drawerData.to_location} />
                      <DrawerRow label="No. Batch" value={drawerData.batch_number} />
                      <DrawerRow label="No. Lot" value={drawerData.lot_number} />
                      <DrawerRow label="Status" value={drawerData.status} />
                      <DrawerRow label="Tanggal" value={drawerData.transaction_date ? new Date(drawerData.transaction_date).toLocaleString('id-ID') : '-'} />
                      <DrawerRow label="Dibuat Oleh" value={drawerData.created_by} />
                      {drawerData.notes && <DrawerRow label="Catatan" value={drawerData.notes} />}
                    </div>
                  )}

                  {drawerTab === 'jurnal' && (
                    <div className="space-y-4">
                      <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                        <DrawerRow label="Unit Cost" value={formatRupiah(drawerData.unit_cost)} />
                        <DrawerRow label="Total Nilai" value={formatRupiah(drawerData.total_cost)} />
                      </div>
                      {drawerData.accounting_entry_number ? (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">Jurnal Aktual</span>
                            <span className="font-mono text-sm text-gray-700">{drawerData.accounting_entry_number}</span>
                          </div>
                          <p className="text-xs text-gray-400">
                            Nomor jurnal ini sudah benar-benar diposting saat transaksi ini terjadi — lihat rincian
                            baris debit/kredit di modul Accounting &gt; Journal Entry.
                          </p>
                        </div>
                      ) : (
                        <div>
                          <div className="mb-2">
                            <span className="text-xs text-gray-400 uppercase tracking-wide">Akun COA (hasil resolve)</span>
                            {drawerData.resolved_account?.code ? (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm text-gray-900">{drawerData.resolved_account.code} - {drawerData.resolved_account.name}</span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                                  {ACCOUNT_SOURCE_LABEL[drawerData.resolved_account.source] || drawerData.resolved_account.source}
                                </span>
                              </div>
                            ) : (
                              <div className="text-amber-600 text-sm mt-1">Belum resolve</div>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">
                            Belum ada nomor jurnal aktual untuk transaksi ini — akun di atas hasil resolve otomatis
                            (item → kategori → global), bukan link ke jurnal yang sudah diposting. Lihat Settings &gt;
                            Preferensi Akun &gt; Default Akhir (Global) untuk konfigurasinya.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {drawerTab === 'flow' && (
                    <div className="space-y-3">
                      {drawerData.document_flow ? (
                        <>
                          <DrawerRow label="Tipe Dokumen Sumber" value={drawerData.document_flow.reference_type ? (REFERENCE_TYPE_LABELS[drawerData.document_flow.reference_type] || drawerData.document_flow.reference_type) : null} />
                          <DrawerRow label="No. Dokumen" value={drawerData.document_flow.reference_number} />
                          {drawerData.document_flow.resolved ? (
                            <DrawerRow label="Status Dokumen" value={`${drawerData.document_flow.label}${drawerData.document_flow.status ? ` (${drawerData.document_flow.status})` : ''}`} />
                          ) : (
                            <p className="text-xs text-gray-400 mt-2">
                              Dokumen sumber tercatat tapi belum bisa ditautkan otomatis ke halaman detailnya dari sini.
                            </p>
                          )}
                          <div className="pt-3 border-t border-gray-100">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 font-mono text-xs">
                                {drawerData.document_flow.reference_number || drawerData.document_flow.reference_type || 'Dokumen Sumber'}
                              </span>
                              <span className="text-gray-300">→</span>
                              <span className="px-2 py-1 rounded bg-green-50 text-green-700 font-mono text-xs">
                                {drawerData.transaction_number}
                              </span>
                              {drawerData.accounting_entry_number && (
                                <>
                                  <span className="text-gray-300">→</span>
                                  <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-mono text-xs">
                                    {drawerData.accounting_entry_number}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400">Tidak ada alur dokumen untuk transaksi ini.</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DrawerRow: React.FC<{ label: string; value: any }> = ({ label, value }) => (
  <div className="flex justify-between py-2 border-b border-gray-100 last:border-0 text-sm">
    <span className="text-gray-500">{label}</span>
    <span className="font-medium text-gray-900 text-right">{value || '-'}</span>
  </div>
);

export default TransactionsPage;
