import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import {
  ArrowLeftIcon,
  CubeIcon,
  DocumentTextIcon,
  BeakerIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';

interface WODetail {
  id: number;
  wo_number: string;
  status: string;
  product_name: string;
  product_code: string;
  quantity: number;
  machine: string | null;
}

interface FGItem {
  id: number;
  location: string | null;
  quantity: number;
  batch_number: string | null;
  stock_status: string;
  production_date: string | null;
}

interface MaterialConsumption {
  id: number;
  material_name: string;
  material_code: string;
  quantity_planned: number;
  quantity_actual: number;
  variance: number;
  variance_percentage: number;
  status: string;
  from_batch_number: string | null;
}

interface ProductionRec {
  id: number;
  production_date: string;
  shift: string;
  quantity_good: number;
  quantity_reject: number;
  machine: string | null;
}

interface Transaction {
  id: number;
  transaction_number: string;
  transaction_type: string;
  transaction_date: string;
  item_name: string;
  quantity: number;
  direction: string;
  reference_number: string | null;
}

const statusColors: Record<string, string> = {
  planned: 'bg-gray-100 text-gray-700',
  released: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const StockByWODetail: React.FC = () => {
  const { woId } = useParams<{ woId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [wo, setWO] = useState<WODetail | null>(null);
  const [fgItems, setFGItems] = useState<FGItem[]>([]);
  const [consumptions, setConsumptions] = useState<MaterialConsumption[]>([]);
  const [records, setRecords] = useState<ProductionRec[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (woId) fetchDetail();
  }, [woId]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/api/wms/stock-by-wo/${woId}`);
      setWO(res.data.work_order);
      setFGItems(res.data.fg_inventory || []);
      setConsumptions(res.data.material_consumption || []);
      setRecords(res.data.production_records || []);
      setTransactions(res.data.transactions || []);
    } catch (err: any) {
      toast.error('Gagal memuat detail Work Order');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!wo) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Work Order tidak ditemukan</p>
        <button onClick={() => navigate('/app/wms/stock-by-wo')} className="mt-3 text-blue-600 hover:underline">
          Kembali
        </button>
      </div>
    );
  }

  const totalFG = fgItems.reduce((s, i) => s + i.quantity, 0);
  const totalGood = records.reduce((s, r) => s + r.quantity_good, 0);
  const totalReject = records.reduce((s, r) => s + r.quantity_reject, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/app/wms/stock-by-wo')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{wo.wo_number}</h1>
          <p className="text-gray-500">{wo.product_name} ({wo.product_code})</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[wo.status] || 'bg-gray-100'}`}>
          {wo.status?.replace('_', ' ')}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 uppercase">QTY Order</p>
          <p className="text-2xl font-bold text-gray-900">{wo.quantity.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 uppercase">FG Stock</p>
          <p className="text-2xl font-bold text-green-600">{totalFG.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 uppercase">Produksi Good</p>
          <p className="text-2xl font-bold text-blue-600">{totalGood.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 uppercase">Reject</p>
          <p className="text-2xl font-bold text-red-600">{totalReject.toLocaleString()}</p>
        </div>
      </div>

      {/* FG Inventory */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <CubeIcon className="h-5 w-5 text-green-600" />
          <h2 className="font-semibold text-gray-900">Finished Goods Inventory</h2>
        </div>
        {fgItems.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">Belum ada FG inventory</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Lokasi</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tgl Produksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {fgItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2 text-sm">{item.location || '-'}</td>
                  <td className="px-4 py-2 text-sm text-right font-medium">{item.quantity.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{item.batch_number || '-'}</td>
                  <td className="px-4 py-2 text-sm">{item.stock_status || '-'}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">{item.production_date || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Material Consumption */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <BeakerIcon className="h-5 w-5 text-orange-600" />
          <h2 className="font-semibold text-gray-900">Konsumsi Material</h2>
        </div>
        {consumptions.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">Belum ada data konsumsi material</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Planned</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actual</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Variance</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {consumptions.map((mc) => (
                <tr key={mc.id}>
                  <td className="px-4 py-2 text-sm">
                    <div className="font-medium">{mc.material_name}</div>
                    <div className="text-xs text-gray-400">{mc.material_code}</div>
                  </td>
                  <td className="px-4 py-2 text-sm text-right">{mc.quantity_planned.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm text-right font-medium">{mc.quantity_actual.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm text-right">
                    <span className={mc.variance > 0 ? 'text-red-600' : mc.variance < 0 ? 'text-green-600' : 'text-gray-500'}>
                      {mc.variance > 0 ? '+' : ''}{mc.variance.toFixed(1)} ({mc.variance_percentage.toFixed(1)}%)
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      mc.status === 'completed' ? 'bg-green-100 text-green-700' :
                      mc.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{mc.status}</span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">{mc.from_batch_number || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Production Records */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <DocumentTextIcon className="h-5 w-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Production Records</h2>
        </div>
        {records.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">Belum ada production record</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Shift</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mesin</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Good</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Reject</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {records.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-sm">{r.production_date ? new Date(r.production_date).toLocaleDateString('id-ID') : '-'}</td>
                  <td className="px-4 py-2 text-sm">{r.shift || '-'}</td>
                  <td className="px-4 py-2 text-sm">{r.machine || '-'}</td>
                  <td className="px-4 py-2 text-sm text-right font-medium text-green-600">{r.quantity_good.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm text-right text-red-500">{r.quantity_reject.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <ArrowsRightLeftIcon className="h-5 w-5 text-purple-600" />
          <h2 className="font-semibold text-gray-900">Transaksi Terkait</h2>
        </div>
        {transactions.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">Belum ada transaksi</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">No. Transaksi</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Arah</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2 text-sm font-mono text-xs">{t.transaction_number}</td>
                  <td className="px-4 py-2 text-sm">{t.transaction_type?.replace('_', ' ')}</td>
                  <td className="px-4 py-2 text-sm">{t.item_name || '-'}</td>
                  <td className="px-4 py-2 text-sm text-right font-medium">{t.quantity.toLocaleString()}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      t.direction === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>{t.direction.toUpperCase()}</span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('id-ID') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default StockByWODetail;
