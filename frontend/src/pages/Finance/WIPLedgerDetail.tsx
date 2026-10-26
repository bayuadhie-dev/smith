import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  CubeIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightCircleIcon
} from '@heroicons/react/24/outline';
import NumberInput from '../../components/ui/NumberInput'

interface LedgerDetail {
  id: number;
  work_order_id: number;
  work_order_number: string;
  product_name: string;
  planned_quantity: number;
  actual_quantity: number;
  completed_quantity: number;
  standard_material_cost: number;
  standard_labor_cost: number;
  standard_overhead_cost: number;
  standard_total_cost: number;
  actual_material_cost: number;
  actual_labor_cost: number;
  actual_overhead_cost: number;
  actual_total_cost: number;
  material_variance: number;
  labor_variance: number;
  overhead_variance: number;
  yield_variance: number;
  total_variance: number;
  status: string;
  is_posted_to_gl: boolean;
  cogm_amount: number;
  cogm_posted: boolean;
}

interface Transaction {
  id: number;
  transaction_date: string;
  transaction_type: string;
  cost_category: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  description: string;
  is_posted_to_gl: boolean;
}

interface Variance {
  id: number;
  variance_type: string;
  standard_amount: number;
  actual_amount: number;
  variance_amount: number;
  variance_percent: number;
  is_favorable: boolean;
  is_significant: boolean;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount || 0);
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'open':
      return 'bg-blue-100 text-blue-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'closed':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default function WIPLedgerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [ledger, setLedger] = useState<LedgerDetail | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [variances, setVariances] = useState<Variance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferQty, setTransferQty] = useState('');
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axiosInstance.get(`/api/wip-accounting/ledger/${id}`);
      setLedger(res.data.ledger);
      setTransactions(res.data.transactions || []);
      setVariances(res.data.variances || []);
    } catch (err: any) {
      console.error('Error loading WIP ledger detail:', err);
      setError(err?.response?.data?.error || 'Gagal memuat detail WIP Ledger');
    } finally {
      setLoading(false);
    }
  };

  const openTransferModal = () => {
    setTransferQty(ledger ? String(ledger.actual_quantity || ledger.planned_quantity || '') : '');
    setShowTransferModal(true);
  };

  const handleTransfer = async () => {
    const qty = parseFloat(transferQty);
    if (!qty || qty <= 0) {
      toast.error('Masukkan quantity yang valid');
      return;
    }
    try {
      setTransferring(true);
      const res = await axiosInstance.post('/api/wip-accounting/cogm/transfer', {
        wip_ledger_id: Number(id),
        quantity_transferred: qty,
      });
      toast.success(`Berhasil transfer ke FG — ${res.data.transfer_number}`);
      setShowTransferModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Gagal transfer ke FG');
    } finally {
      setTransferring(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !ledger) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate('/app/finance/wip-ledger')}
          className="flex items-center text-gray-600 hover:text-gray-900 dark:text-white mb-4"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          Kembali ke WIP Ledger
        </button>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center text-red-700 dark:text-red-300">
          {error || 'WIP Ledger tidak ditemukan'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/app/finance/wip-ledger')}
            className="flex items-center text-gray-600 hover:text-gray-900 dark:text-white"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Kembali
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {ledger.work_order_number}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">{ledger.product_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ledger.status)}`}>
            {ledger.status.toUpperCase()}
          </span>
          <Link
            to={`/app/production/work-orders/${ledger.work_order_id}`}
            className="text-sm text-blue-600 hover:text-blue-900"
          >
            Lihat Work Order →
          </Link>
        </div>
      </div>

      {/* GL / COGM status badges */}
      <div className="flex gap-3">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${ledger.is_posted_to_gl ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
          {ledger.is_posted_to_gl ? <CheckCircleIcon className="h-5 w-5" /> : <XCircleIcon className="h-5 w-5" />}
          {ledger.is_posted_to_gl ? 'Sudah Posted ke GL' : 'Belum Posted ke GL'}
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${ledger.cogm_posted ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
          {ledger.cogm_posted ? <CheckCircleIcon className="h-5 w-5" /> : <XCircleIcon className="h-5 w-5" />}
          {ledger.cogm_posted ? `COGM Posted (${formatCurrency(ledger.cogm_amount)})` : 'COGM Belum Ditransfer'}
        </div>
        {!ledger.cogm_posted && (
          <button
            onClick={openTransferModal}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700"
          >
            <ArrowRightCircleIcon className="h-5 w-5" />
            Transfer ke Finished Goods
          </button>
        )}
      </div>

      {/* Quantity + Cost summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 dark:text-gray-400 text-sm">Quantity (Plan / Actual / Completed)</p>
            <CubeIcon className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {ledger.planned_quantity.toLocaleString()} / {ledger.actual_quantity.toLocaleString()} / {ledger.completed_quantity.toLocaleString()}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">Standard Total Cost</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(ledger.standard_total_cost)}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">Actual Total Cost</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(ledger.actual_total_cost)}</p>
        </div>
      </div>

      {/* Cost breakdown: standard vs actual per category */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Breakdown Biaya: Standard vs Actual</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kategori</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Standard</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actual</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Variance</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {[
                { label: 'Material', std: ledger.standard_material_cost, act: ledger.actual_material_cost, variance: ledger.material_variance },
                { label: 'Labor', std: ledger.standard_labor_cost, act: ledger.actual_labor_cost, variance: ledger.labor_variance },
                { label: 'Overhead', std: ledger.standard_overhead_cost, act: ledger.actual_overhead_cost, variance: ledger.overhead_variance },
              ].map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{row.label}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">{formatCurrency(row.std)}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">{formatCurrency(row.act)}</td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${row.variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(Math.abs(row.variance))} {row.variance > 0 ? '(Unfavorable)' : '(Favorable)'}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 dark:bg-gray-900">
                <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">Yield Variance</td>
                <td className="px-4 py-3 text-sm text-right text-gray-500 dark:text-gray-400">—</td>
                <td className="px-4 py-3 text-sm text-right text-gray-500 dark:text-gray-400">—</td>
                <td className={`px-4 py-3 text-sm text-right font-bold ${ledger.yield_variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(Math.abs(ledger.yield_variance))}
                </td>
              </tr>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">Total Variance</td>
                <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white font-bold">{formatCurrency(ledger.standard_total_cost)}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white font-bold">{formatCurrency(ledger.actual_total_cost)}</td>
                <td className={`px-4 py-3 text-sm text-right font-bold flex items-center justify-end gap-1 ${ledger.total_variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {ledger.total_variance > 0 ? <ArrowTrendingUpIcon className="h-4 w-4" /> : <ArrowTrendingDownIcon className="h-4 w-4" />}
                  {formatCurrency(Math.abs(ledger.total_variance))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Variance analysis detail (if analyzed) */}
      {variances.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Analisis Variance</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipe</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Standard</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actual</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Variance</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">%</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Signifikan?</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {variances.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white capitalize">{v.variance_type}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">{formatCurrency(v.standard_amount)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">{formatCurrency(v.actual_amount)}</td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${v.is_favorable ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(Math.abs(v.variance_amount))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">{v.variance_percent.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-center">
                      {v.is_significant ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Ya</span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">Tidak</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction log */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Riwayat Transaksi WIP</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tanggal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipe</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kategori</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unit Cost</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Cost</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Deskripsi</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">GL</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    Belum ada transaksi WIP tercatat untuk SPK ini
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                      {new Date(t.transaction_date).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white capitalize">{t.transaction_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white capitalize">{t.cost_category}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">{t.quantity.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">{formatCurrency(t.unit_cost)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">{formatCurrency(t.total_cost)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{t.description}</td>
                    <td className="px-4 py-3 text-center">
                      {t.is_posted_to_gl ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-gray-300 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showTransferModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Transfer ke Finished Goods</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Memindahkan biaya WIP {ledger.work_order_number} ke persediaan barang jadi (COGM) dan posting jurnal otomatis. Tindakan ini tidak bisa dibatalkan.
            </p>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Quantity Ditransfer</label>
            <NumberInput
              value={transferQty}
              onChange={(e) => setTransferQty(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mb-4 bg-white dark:bg-gray-900"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowTransferModal(false)}
                disabled={transferring}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleTransfer}
                disabled={transferring}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {transferring ? 'Memproses...' : 'Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
