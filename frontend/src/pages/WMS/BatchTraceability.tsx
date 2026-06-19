import React, { useState } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  DocumentMagnifyingGlassIcon,
  CubeIcon,
  ArrowsRightLeftIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline';

interface TraceResult {
  batch_number: string;
  inventory: Array<{
    id: number; item_type: string; item_name: string;
    location: string | null; quantity: number; stock_status: string;
  }>;
  transactions: Array<{
    id: number; transaction_number: string; transaction_type: string;
    transaction_date: string; item_name: string; quantity: number;
    direction: string; from_location: string | null; to_location: string | null;
  }>;
  material_consumptions: Array<{
    id: number; material_name: string; quantity_planned: number;
    quantity_actual: number; variance: number; status: string;
  }>;
  wip_movements: Array<any>;
  total_records: number;
}

const BatchTraceability: React.FC = () => {
  const [batchNumber, setBatchNumber] = useState('');
  const [result, setResult] = useState<TraceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchNumber.trim()) {
      toast.error('Masukkan nomor batch');
      return;
    }
    try {
      setLoading(true);
      setSearched(true);
      const res = await axiosInstance.get(`/api/wms/reports/batch-traceability/${encodeURIComponent(batchNumber.trim())}`);
      setResult(res.data);
    } catch (err: any) {
      toast.error('Gagal mencari batch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <DocumentMagnifyingGlassIcon className="h-7 w-7 text-cyan-600" />
          Batch Traceability
        </h1>
        <p className="text-gray-500 mt-1">Lacak nomor batch di seluruh sistem — inventori, transaksi, konsumsi material, dan WIP</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSearch} className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Masukkan nomor batch..."
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Mencari...' : 'Lacak'}
          </button>
        </form>
      </div>

      {/* Results */}
      {searched && result && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Batch: <span className="font-mono text-blue-600">{result.batch_number}</span>
            </h3>
            <p className="text-gray-500">{result.total_records} total record ditemukan</p>
          </div>

          {/* Current Inventory */}
          {result.inventory.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CubeIcon className="h-5 w-5 text-blue-600" />
                Posisi Stok Saat Ini ({result.inventory.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Lokasi</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">QTY</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.inventory.map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-4 py-2 text-sm font-medium">{inv.item_name}</td>
                        <td className="px-4 py-2 text-sm text-gray-500 capitalize">{inv.item_type}</td>
                        <td className="px-4 py-2 text-sm">{inv.location || '-'}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">{inv.quantity.toLocaleString()}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            inv.stock_status === 'released' || inv.stock_status === 'available' ? 'bg-green-100 text-green-700' :
                            inv.stock_status === 'quarantine' || inv.stock_status === 'on_hold' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>{inv.stock_status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Transactions */}
          {result.transactions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ArrowsRightLeftIcon className="h-5 w-5 text-green-600" />
                Riwayat Transaksi ({result.transactions.length})
              </h3>
              <div className="space-y-2">
                {result.transactions.map((txn: any) => (
                  <div key={txn.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      txn.direction === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {txn.direction === 'in' ? 'IN' : 'OUT'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{txn.transaction_number}</span>
                        <span className="text-xs text-gray-400">{txn.transaction_type}</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {txn.item_name} · <strong>{txn.quantity}</strong> unit
                        {txn.from_location && <span> dari {txn.from_location}</span>}
                        {txn.to_location && <span> ke {txn.to_location}</span>}
                      </div>
                    </div>
                    <div className="text-sm text-gray-400">{new Date(txn.transaction_date).toLocaleDateString('id-ID')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Material Consumptions */}
          {result.material_consumptions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ArchiveBoxIcon className="h-5 w-5 text-purple-600" />
                Konsumsi Material ({result.material_consumptions.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Planned</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actual</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Variance</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.material_consumptions.map((mc: any) => (
                      <tr key={mc.id}>
                        <td className="px-4 py-2 text-sm font-medium">{mc.material_name}</td>
                        <td className="px-4 py-2 text-sm text-right">{mc.quantity_planned.toLocaleString()}</td>
                        <td className="px-4 py-2 text-sm text-right">{mc.quantity_actual.toLocaleString()}</td>
                        <td className="px-4 py-2 text-sm text-right">
                          <span className={mc.variance > 0 ? 'text-red-600' : mc.variance < 0 ? 'text-green-600' : ''}>
                            {mc.variance > 0 ? '+' : ''}{mc.variance.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm">{mc.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.total_records === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">
              <DocumentMagnifyingGlassIcon className="h-12 w-12 mx-auto mb-3" />
              <p>Batch <strong>{result.batch_number}</strong> tidak ditemukan</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BatchTraceability;
