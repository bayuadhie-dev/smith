import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { ArrowLeftIcon, ArrowPathIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { confirmDialog } from '../../components/ui';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',      color: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Diajukan',   color: 'bg-blue-100 text-blue-700' },
  approved:  { label: 'Disetujui',  color: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Ditolak',    color: 'bg-red-100 text-red-700' },
  completed: { label: 'Selesai',    color: 'bg-emerald-100 text-emerald-700' },
};

const APPROVAL_CONFIG: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Menunggu',  color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Disetujui', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Ditolak',   color: 'bg-red-100 text-red-700' },
};

export default function PurchaseReturnDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [ret, setRet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const fetchReturn = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/api/purchasing/purchase-returns/${id}`);
      setRet(res.data);
    } catch (err) {
      toast.error('Gagal memuat data retur pembelian');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReturn(); }, [id]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

  const handleApprove = async () => {
    if (!(await confirmDialog('Setujui retur pembelian ini? Stok akan dikurangi dan hutang ke supplier akan dikoreksi.'))) return;
    setActing(true);
    try {
      const res = await axiosInstance.post(`/api/purchasing/purchase-returns/${id}/approve`);
      toast.success(res.data.message || 'Retur pembelian disetujui');
      fetchReturn();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Gagal menyetujui retur');
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    setActing(true);
    try {
      const res = await axiosInstance.post(`/api/purchasing/purchase-returns/${id}/reject`, {
        notes: rejectReason,
      });
      toast.success(res.data.message || 'Retur pembelian ditolak');
      setShowRejectForm(false);
      fetchReturn();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Gagal menolak retur');
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <ArrowPathIcon className="h-6 w-6 animate-spin mr-2" /> Memuat...
      </div>
    );
  }

  if (!ret) {
    return <div className="text-center py-24 text-gray-400">Retur pembelian tidak ditemukan</div>;
  }

  const status = STATUS_CONFIG[ret.status] || { label: ret.status, color: 'bg-gray-100 text-gray-600' };
  const approval = APPROVAL_CONFIG[ret.approval_status] || { label: ret.approval_status, color: 'bg-gray-100 text-gray-600' };
  const canAct = ret.approval_status === 'pending';

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/app/purchasing/returns')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{ret.return_number}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Retur pembelian dari invoice {ret.invoice_number || '—'} — {ret.supplier_name || '—'}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-lg text-sm font-medium ${status.color}`}>{status.label}</span>
        <span className={`px-3 py-1 rounded-lg text-sm font-medium ${approval.color}`}>{approval.label}</span>
      </div>

      {canAct && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex items-center gap-3">
          <button
            onClick={handleApprove}
            disabled={acting}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
          >
            <CheckCircleIcon className="h-4 w-4" /> Setujui
          </button>
          <button
            onClick={() => setShowRejectForm((v) => !v)}
            disabled={acting}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 text-sm font-medium disabled:opacity-50"
          >
            <XCircleIcon className="h-4 w-4" /> Tolak
          </button>
          {showRejectForm && (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                placeholder="Alasan penolakan..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-900 dark:text-white"
              />
              <button
                onClick={handleReject}
                disabled={acting}
                className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Konfirmasi Tolak
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Tanggal Retur</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {ret.return_date ? new Date(ret.return_date).toLocaleDateString('id-ID') : '—'}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Jenis Retur</p>
          <p className="font-medium text-gray-900 dark:text-white">{ret.return_type || '—'}</p>
        </div>
        <div>
          <p className="text-gray-500">Alasan</p>
          <p className="font-medium text-gray-900 dark:text-white">{ret.reason || '—'}</p>
        </div>
        <div>
          <p className="text-gray-500">Total</p>
          <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(ret.total_amount)}</p>
        </div>
        {ret.notes && (
          <div className="col-span-2 md:col-span-4">
            <p className="text-gray-500">Catatan</p>
            <p className="text-gray-800 dark:text-gray-200">{ret.notes}</p>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Item</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Qty</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Harga Satuan</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Total</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Alasan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {(ret.items || []).map((item: any) => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-gray-800 dark:text-gray-200">
                  {item.product_name || item.material_name || item.description || '—'}
                </td>
                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                  {item.quantity} {item.uom}
                </td>
                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                  {formatCurrency(item.unit_price)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-800 dark:text-gray-200">
                  {formatCurrency(item.total_price)}
                </td>
                <td className="px-4 py-3 text-gray-500">{item.reason || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
