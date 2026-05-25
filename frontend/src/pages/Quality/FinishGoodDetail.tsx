import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CogIcon,
  CubeIcon,
  CalendarIcon,
  UserIcon,
  BeakerIcon,
  DocumentTextIcon,
  ArrowRightIcon,
  ChartBarIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';
import LoadingSpinner from '../../components/Common/LoadingSpinner';

interface WorkOrderDetail {
  id: number;
  wo_number: string;
  product_name: string;
  product_code: string;
  batch_number: string | null;
  machine_name: string | null;
  uom: string;
  status: string;
  priority: string;
  quantity: number;
  quantity_produced: number;
  quantity_good: number;
  quantity_scrap: number;
  pack_per_carton: number;
  total_cartons: number;
  scheduled_start_date: string | null;
  scheduled_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  notes: string | null;
}

interface QCTest {
  id: number;
  test_number: string;
  test_date: string;
  result: string;
  notes: string | null;
  defects_found: string | null;
  tested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
}

interface ShiftProduction {
  id: number;
  production_date: string;
  shift: string;
  actual_quantity: number;
  good_quantity: number;
  scrap_quantity: number;
  machine_name: string | null;
  operator_name: string | null;
  downtime_minutes: number;
  notes: string | null;
}

interface Summary {
  shift_count: number;
  progress_pct: number;
  good_pct: number;
  scrap_pct: number;
  total_downtime_minutes: number;
}

const fmtDate = (d: string | null, withTime = false) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
};

const shiftLabel = (s: string) => {
  const map: Record<string, string> = {
    shift_1: 'Shift 1', shift_2: 'Shift 2', shift_3: 'Shift 3',
    morning: 'Pagi', afternoon: 'Siang', night: 'Malam',
  };
  return map[s] || s;
};

const QCResultBadge = ({ result }: { result: string }) => {
  if (result === 'passed')
    return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800"><CheckCircleIcon className="w-4 h-4" />Lulus QC</span>;
  if (result === 'failed')
    return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800"><XCircleIcon className="w-4 h-4" />Ditolak</span>;
  if (result === 'conditional')
    return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800"><ExclamationTriangleIcon className="w-4 h-4" />Bersyarat</span>;
  return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-700"><ClockIcon className="w-4 h-4" />Pending</span>;
};

export default function FinishGoodDetail() {
  const { woId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [wo, setWo] = useState<WorkOrderDetail | null>(null);
  const [qcTest, setQcTest] = useState<QCTest | null>(null);
  const [shifts, setShifts] = useState<ShiftProduction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    fetchDetail();
  }, [woId]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/api/quality/work-order/${woId}/detail`);
      setWo(res.data.work_order);
      setQcTest(res.data.qc_test);
      setShifts(res.data.shift_productions || []);
      setSummary(res.data.summary);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!wo) return <div className="p-6 text-gray-500">Work Order tidak ditemukan.</div>;

  const progressColor = summary && summary.progress_pct >= 100
    ? 'bg-green-500' : summary && summary.progress_pct >= 60
    ? 'bg-yellow-400' : 'bg-red-500';

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/app/quality/finish-good')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ClipboardDocumentCheckIcon className="w-7 h-7 text-green-600" />
              Detail QC — {wo.wo_number}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{wo.product_name} · {wo.product_code}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!qcTest ? (
            <Link
              to={`/app/quality/finish-good/${wo.id}/input`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              <BeakerIcon className="w-4 h-4" />Input QC
            </Link>
          ) : (
            <Link
              to={`/app/quality/finish-good/${wo.id}/input`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium"
            >
              <PencilIcon className="w-4 h-4" />Edit QC
            </Link>
          )}
          {qcTest?.result === 'passed' && (
            <Link
              to={`/app/quality/finish-good/${wo.id}/to-warehouse`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <ArrowRightIcon className="w-4 h-4" />Kirim ke Gudang
            </Link>
          )}
        </div>
      </div>

      {/* WO Info + Production Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* WO Info Card */}
        <div className="lg:col-span-1 card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Informasi Work Order</h2>
          <div className="space-y-2.5">
            <InfoRow icon={<CubeIcon className="w-4 h-4" />} label="Produk" value={wo.product_name} />
            <InfoRow icon={<CogIcon className="w-4 h-4" />} label="Mesin" value={wo.machine_name || '—'} />
            <InfoRow icon={<DocumentTextIcon className="w-4 h-4" />} label="Batch" value={wo.batch_number || '—'} />
            <InfoRow icon={<CalendarIcon className="w-4 h-4" />} label="Jadwal Mulai" value={fmtDate(wo.scheduled_start_date)} />
            <InfoRow icon={<CalendarIcon className="w-4 h-4" />} label="Jadwal Selesai" value={fmtDate(wo.scheduled_end_date)} />
            <InfoRow icon={<CalendarIcon className="w-4 h-4" />} label="Aktual Mulai" value={fmtDate(wo.actual_start_date, true)} />
            <InfoRow icon={<CalendarIcon className="w-4 h-4" />} label="Aktual Selesai" value={fmtDate(wo.actual_end_date, true)} />
            {wo.pack_per_carton > 0 && (
              <InfoRow icon={<ChartBarIcon className="w-4 h-4" />} label="Pack/Karton" value={`${wo.pack_per_carton} pcs`} />
            )}
            {wo.notes && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 mb-1">Catatan WO</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{wo.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Production Summary */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quantity Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Target" value={wo.quantity.toLocaleString()} sub={wo.uom} color="blue" />
            <MetricCard label="Diproduksi" value={wo.quantity_produced.toLocaleString()} sub={`${summary?.progress_pct ?? 0}% dari target`} color={summary && summary.progress_pct >= 100 ? 'green' : summary && summary.progress_pct >= 60 ? 'yellow' : 'red'} />
            <MetricCard label="Good" value={wo.quantity_good.toLocaleString()} sub={`${summary?.good_pct ?? 0}% yield`} color="green" />
            <MetricCard label="Scrap" value={wo.quantity_scrap.toLocaleString()} sub={`${summary?.scrap_pct ?? 0}% reject`} color="red" />
          </div>

          {/* Progress Bar */}
          <div className="card p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Progress Produksi</span>
              <span className={`text-sm font-bold ${summary && summary.progress_pct >= 100 ? 'text-green-600' : summary && summary.progress_pct >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                {summary?.progress_pct ?? 0}%
              </span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
              <div className={`h-3 rounded-full transition-all ${progressColor}`} style={{ width: `${Math.min(summary?.progress_pct ?? 0, 100)}%` }} />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{wo.quantity_produced.toLocaleString()} diproduksi</span>
              <span>{wo.quantity.toLocaleString()} target</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{summary?.shift_count ?? 0}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total Shift</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold text-purple-600">{wo.total_cartons > 0 ? wo.total_cartons.toLocaleString() : '—'}</p>
              <p className="text-xs text-gray-500 mt-0.5">Karton {wo.pack_per_carton > 0 ? `(${wo.pack_per_carton}/ctn)` : ''}</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-bold text-orange-500">{summary ? Math.floor(summary.total_downtime_minutes / 60) + 'j ' + (summary.total_downtime_minutes % 60) + 'm' : '—'}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total Downtime</p>
            </div>
          </div>
        </div>
      </div>

      {/* QC Test Result */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Hasil Inspeksi QC</h2>
        {qcTest ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <QCResultBadge result={qcTest.result} />
              <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                <DocumentTextIcon className="w-4 h-4 text-gray-400" />
                <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{qcTest.test_number}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                <CalendarIcon className="w-4 h-4 text-gray-400" />
                {fmtDate(qcTest.test_date, true)}
              </div>
              {qcTest.tested_by && (
                <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                  <UserIcon className="w-4 h-4 text-gray-400" />
                  {qcTest.tested_by}
                </div>
              )}
              {qcTest.approved_by && (
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <CheckCircleIcon className="w-4 h-4 text-green-500" />
                  Disetujui oleh <strong>{qcTest.approved_by}</strong> · {fmtDate(qcTest.approved_at, true)}
                </div>
              )}
            </div>
            {qcTest.defects_found && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Defect Ditemukan</p>
                <p className="text-sm text-red-800 dark:text-red-300">{qcTest.defects_found}</p>
              </div>
            )}
            {qcTest.notes && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 mb-1">Catatan QC</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{qcTest.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <BeakerIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Belum ada inspeksi QC untuk Work Order ini.</p>
            <Link
              to={`/app/quality/finish-good/${wo.id}/input`}
              className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
            >
              <BeakerIcon className="w-4 h-4" />Mulai Inspeksi QC
            </Link>
          </div>
        )}
      </div>

      {/* Shift Production Table */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-white">Riwayat Produksi per Shift</h2>
          <span className="text-xs text-gray-400">{shifts.length} shift tercatat</span>
        </div>
        {shifts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  {['Tanggal', 'Shift', 'Mesin', 'Operator', 'Aktual', 'Good', 'Scrap', 'Yield', 'Downtime', 'Catatan'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                {shifts.map((sp) => {
                  const yieldPct = sp.actual_quantity > 0 ? (sp.good_quantity / sp.actual_quantity * 100).toFixed(1) : '—';
                  return (
                    <tr key={sp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtDate(sp.production_date)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-medium">{shiftLabel(sp.shift)}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">{sp.machine_name || '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">{sp.operator_name || '—'}</td>
                      <td className="px-3 py-2 text-xs font-medium text-gray-900 dark:text-white whitespace-nowrap">{sp.actual_quantity.toLocaleString()}</td>
                      <td className="px-3 py-2 text-xs font-medium text-green-700 dark:text-green-400 whitespace-nowrap">{sp.good_quantity.toLocaleString()}</td>
                      <td className="px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 whitespace-nowrap">{sp.scrap_quantity > 0 ? sp.scrap_quantity.toLocaleString() : '—'}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        <span className={`font-semibold ${parseFloat(yieldPct) >= 95 ? 'text-green-600' : parseFloat(yieldPct) >= 80 ? 'text-yellow-600' : 'text-red-500'}`}>
                          {yieldPct}{yieldPct !== '—' ? '%' : ''}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                        {sp.downtime_minutes > 0 ? `${sp.downtime_minutes} mnt` : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 max-w-[160px] truncate">{sp.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-900 border-t-2 border-gray-200 dark:border-gray-600">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Total</td>
                  <td className="px-3 py-2 text-xs font-bold text-gray-900 dark:text-white">{wo.quantity_produced.toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs font-bold text-green-700 dark:text-green-400">{wo.quantity_good.toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400">{wo.quantity_scrap > 0 ? wo.quantity_scrap.toLocaleString() : '—'}</td>
                  <td className="px-3 py-2 text-xs font-bold">{summary ? `${summary.good_pct}%` : '—'}</td>
                  <td className="px-3 py-2 text-xs font-bold text-orange-500">{summary && summary.total_downtime_minutes > 0 ? `${summary.total_downtime_minutes} mnt` : '—'}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="text-center py-10">
            <ChartBarIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Belum ada data produksi shift untuk WO ini.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{value}</p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    red: 'text-red-500',
  };
  return (
    <div className="card p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${colorMap[color] || 'text-gray-800'}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}
