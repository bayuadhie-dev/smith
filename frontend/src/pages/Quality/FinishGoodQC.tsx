import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  BeakerIcon,
  DocumentTextIcon,
  EyeIcon,
  CubeIcon,
  CalendarIcon,
  ArrowPathIcon,
  TruckIcon,
  DocumentCheckIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import { useUrlState } from '../../hooks/useUrlState';
import { useBreadcrumbTrail } from '../../components/ui/BreadcrumbTrail';
import { useListTools, type ListColumn } from '../../hooks/useListTools';
import { ListToolbar, SortTh } from '../../components/ui/ListTools';

interface FinishGoodItem {
  id: number;
  wo_number: string;
  product_id: number;
  product_code: string;
  product_name: string;
  quantity: number;
  quantity_produced: number;
  quantity_good: number;
  quantity_scrap: number;
  uom: string;
  batch_number: string | null;
  machine_name: string | null;
  completed_date: string | null;
  pack_per_carton: number;
  qc_status: 'pending' | 'inspecting' | 'passed' | 'failed' | 'conditional';
  qc_test_id?: number;
  inspector_name?: string;
  inspected_date?: string;
}

const QC_LABEL: Record<string, string> = { pending: 'Menunggu QC', inspecting: 'Sedang inspeksi', passed: 'Lulus QC', failed: 'Ditolak', conditional: 'Bersyarat' };
const COLUMNS: ListColumn<FinishGoodItem>[] = [
  { key: 'wo_number', label: 'No. SPK', value: (w) => w.wo_number },
  { key: 'batch_number', label: 'Batch', value: (w) => w.batch_number },
  { key: 'product_code', label: 'Kode Produk', value: (w) => w.product_code },
  { key: 'product_name', label: 'Nama Produk', value: (w) => w.product_name },
  { key: 'quantity_produced', label: 'Qty Produksi', value: (w) => w.quantity_produced, type: 'number' },
  { key: 'quantity_good', label: 'Qty Baik', value: (w) => w.quantity_good, type: 'number' },
  { key: 'quantity_scrap', label: 'Qty Scrap', value: (w) => w.quantity_scrap, type: 'number' },
  { key: 'uom', label: 'Satuan', value: (w) => w.uom },
  { key: 'machine_name', label: 'Mesin', value: (w) => w.machine_name },
  { key: 'completed_date', label: 'Tanggal Selesai', value: (w) => w.completed_date, type: 'date' },
  { key: 'qc_status', label: 'Status', value: (w) => w.qc_status, exportValue: (w) => QC_LABEL[w.qc_status] || w.qc_status },
  { key: 'inspector_name', label: 'Inspektur', value: (w) => w.inspector_name },
];

export default function FinishGoodQC() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workOrders, setWorkOrders] = useState<FinishGoodItem[]>([]);
  const [completedQC, setCompletedQC] = useState<FinishGoodItem[]>([]);
  const [activeTab, setActiveTab] = useUrlState<'pending' | 'completed'>('tab', 'pending', ['pending', 'completed']);
  useBreadcrumbTrail(activeTab === 'pending' ? [] : [{ label: ({ completed: 'Sudah QC' } as Record<string, string>)[activeTab] }]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/quality/pending-qc`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setWorkOrders(data.pending_qc || []);
        setCompletedQC(data.completed_qc || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    toast.success('Data diperbarui');
  };

  const handleInputQC = (wo: FinishGoodItem) => {
    navigate(`/app/quality/finish-good/${wo.id}/input`);
  };

  const handleViewDetail = (wo: FinishGoodItem) => {
    navigate(`/app/quality/finish-good/${wo.id}/detail`);
  };

  const handlePrintCoA = (wo: FinishGoodItem) => {
    toast.success('Mencetak Certificate of Analysis...');
    // Implement print functionality
  };

  const handleSendToWarehouse = (wo: FinishGoodItem) => {
    navigate(`/app/quality/finish-good/${wo.id}/to-warehouse`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'passed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            <CheckCircleIcon className="w-3.5 h-3.5" />
            Lulus QC
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
            <XCircleIcon className="w-3.5 h-3.5" />
            Ditolak
          </span>
        );
      case 'conditional':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            <ExclamationTriangleIcon className="w-3.5 h-3.5" />
            Bersyarat
          </span>
        );
      case 'inspecting':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            <BeakerIcon className="w-3.5 h-3.5" />
            Sedang Inspeksi
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:text-gray-100 dark:bg-gray-700">
            <ClipboardDocumentCheckIcon className="w-3.5 h-3.5" />
            Menunggu QC
          </span>
        );
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const currentList = activeTab === 'pending' ? workOrders : completedQC;
  const tools = useListTools<FinishGoodItem>(currentList, COLUMNS, { filename: activeTab === 'pending' ? 'QC_Barang_Jadi_Menunggu' : 'QC_Barang_Jadi_Selesai', initialSort: { key: 'completed_date', dir: 'desc' } });
  const filteredList = tools.rows;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardDocumentCheckIcon className="w-7 h-7 text-green-600 dark:text-green-400" />
            QC Barang Jadi
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Inspeksi kualitas akhir produk sebelum dikirim ke gudang
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700"
        >
          <ArrowPathIcon className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <ClipboardDocumentCheckIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {workOrders.length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Menunggu QC</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {completedQC.filter(w => w.qc_status === 'passed').length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Lulus QC</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <XCircleIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {completedQC.filter(w => w.qc_status === 'failed').length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Ditolak</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <TruckIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {workOrders.length + completedQC.length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total WO Selesai</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'pending'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Menunggu QC ({workOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'completed'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Sudah QC ({completedQC.length})
            </button>
          </div>
        </div>
        <div className="mt-4">
          <ListToolbar tools={tools} placeholder="Cari nomor SPK, produk, mesin, atau batch" />
        </div>
      </div>

      {/* SPK List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : tools.total === 0 ? (
          <div className="text-center py-12">
            <CubeIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {activeTab === 'pending' 
                ? 'Tidak ada SPK yang menunggu QC' 
                : 'Belum ada SPK yang sudah di-QC'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 dark:bg-gray-700">
              <tr>
                <SortTh tools={tools} col="wo_number" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">SPK</SortTh>
                <SortTh tools={tools} col="product_name" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Produk</SortTh>
                <SortTh tools={tools} col="quantity_produced" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Qty Produksi</SortTh>
                <SortTh tools={tools} col="machine_name" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Mesin</SortTh>
                <SortTh tools={tools} col="completed_date" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Selesai</SortTh>
                <SortTh tools={tools} col="qc_status" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Status</SortTh>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredList.map(wo => (
                <tr key={wo.id} className="hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-4">
                    <p className="font-medium text-blue-600 dark:text-blue-400">{wo.wo_number}</p>
                    {wo.batch_number && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">Batch: {wo.batch_number}</p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{wo.product_code}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{wo.product_name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">
                        {wo.quantity_produced.toLocaleString()} {wo.uom}
                      </p>
                      <div className="flex gap-2 text-xs mt-1">
                        <span className="text-green-600 dark:text-green-400">Baik: {wo.quantity_good.toLocaleString()}</span>
                        {wo.quantity_scrap > 0 && (
                          <span className="text-red-600 dark:text-red-400">Scrap: {wo.quantity_scrap}</span>
                        )}
                      </div>
                      {wo.pack_per_carton > 0 && (
                        <p className="text-xs text-blue-500">
                          = {Math.floor(wo.quantity_good / wo.pack_per_carton)} Karton
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-gray-900 dark:text-white">{wo.machine_name || '-'}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-500 flex items-center gap-1 dark:text-gray-400">
                      <CalendarIcon className="w-4 h-4" />
                      {formatDate(wo.completed_date)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {getStatusBadge(wo.qc_status)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                      {wo.qc_status === 'pending' ? (
                        <button
                          onClick={() => handleInputQC(wo)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          <BeakerIcon className="w-4 h-4" />
                          Input QC
                        </button>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleViewDetail(wo)}
                            className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                            title="Lihat Detail"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          {wo.qc_status === 'passed' && (
                            <>
                              <button
                                onClick={() => handlePrintCoA(wo)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg dark:text-blue-400"
                                title="Cetak CoA"
                              >
                                <PrinterIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleSendToWarehouse(wo)}
                                className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg dark:text-green-400"
                                title="Kirim ke Gudang"
                              >
                                <TruckIcon className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
            <BeakerIcon className="w-5 h-5" />
            Inspeksi Akhir
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Pemeriksaan menyeluruh terhadap produk akhir meliputi fungsi, tampilan, kelengkapan komponen, dan keamanan.
          </p>
        </div>
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800 p-4">
          <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2 flex items-center gap-2">
            <DocumentCheckIcon className="w-5 h-5" />
            Certificate of Analysis
          </h3>
          <p className="text-sm text-green-700 dark:text-green-300">
            Dokumen persetujuan rilis produk (CoA/CoC) yang menyatakan batch siap dikirim ke pelanggan.
          </p>
        </div>
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-4">
          <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
            <CubeIcon className="w-5 h-5" />
            Sampel Retensi
          </h3>
          <p className="text-sm text-purple-700 dark:text-purple-300">
            Pengambilan sampel dari batch produksi akhir untuk pengujian konfirmasi dan penyimpanan referensi.
          </p>
        </div>
      </div>
    </div>
  );
}
