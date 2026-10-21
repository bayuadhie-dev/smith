import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import axiosInstance from '../../utils/axiosConfig';
import { CalculatorIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface PlannedOrder {
  entity_kind: 'material' | 'product';
  material_id: number;
  material_code: string | null;
  material_name: string;
  uom: string | null;
  quantity: number;
  need_date: string;
  order_date: string;
  week_index: number;
  lead_time_days: number;
  covered_by_moq: boolean;
  is_overdue: boolean;
  procurement_type: 'buy' | 'make';
}

interface BucketDef {
  index: number;
  start_date: string;
  end_date: string;
}

interface MaterialBucket {
  index: number;
  gross_requirement: number;
  scheduled_receipt: number;
  projected_balance: number;
  net_requirement: number;
}

interface MaterialDetail {
  entity_kind: 'material' | 'product';
  material_id: number;
  material_code: string | null;
  material_name: string;
  uom: string | null;
  procurement_type: 'buy' | 'make';
  buckets: MaterialBucket[];
}

interface ExceptionItem {
  type: 'reschedule_in' | 'reschedule_out' | 'cancel';
  source: 'purchase_order' | 'work_order';
  source_id: number;
  source_number: string;
  material_id: number;
  material_code: string | null;
  material_name: string;
  quantity: number;
  scheduled_date: string;
  scheduled_week_index: number;
  needed_week_index: number | null;
  message: string;
}

const EXCEPTION_CONFIG: Record<string, { label: string; color: string }> = {
  reschedule_in: { label: 'Percepat (Reschedule In)', color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
  reschedule_out: { label: 'Bisa Ditunda (Reschedule Out)', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
  cancel: { label: 'Pertimbangkan Batal', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
};

export default function MRPRun() {
  const [horizonWeeks, setHorizonWeeks] = useState(12);
  const [loading, setLoading] = useState(false);
  const [plannedOrders, setPlannedOrders] = useState<PlannedOrder[]>([]);
  const [buckets, setBuckets] = useState<BucketDef[]>([]);
  const [materials, setMaterials] = useState<MaterialDetail[]>([]);
  const [detailMaterial, setDetailMaterial] = useState<MaterialDetail | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [converting, setConverting] = useState(false);
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [detailException, setDetailException] = useState<ExceptionItem | null>(null);

  const runMrp = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/mrp/run', { params: { horizon_weeks: horizonWeeks } });
      setPlannedOrders(res.data.planned_orders || []);
      setBuckets(res.data.buckets || []);
      setMaterials(res.data.materials || []);
      setExceptions(res.data.exceptions || []);
      setSelected({});
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Gagal menjalankan MRP run');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runMrp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleAll = (checked: boolean) => {
    const next: Record<number, boolean> = {};
    plannedOrders.forEach((po, idx) => { if (po.procurement_type === 'buy') next[idx] = checked; });
    setSelected(next);
  };

  const selectedOrders = plannedOrders.filter((po, idx) => selected[idx] && po.procurement_type === 'buy');
  const buyOrders = plannedOrders.filter((po) => po.procurement_type === 'buy');

  const [creatingWoIdx, setCreatingWoIdx] = useState<number | null>(null);

  const handleCreateWO = async (po: PlannedOrder, idx: number) => {
    setCreatingWoIdx(idx);
    try {
      const res = await axiosInstance.post('/api/production/work-orders', {
        product_id: po.material_id,
        quantity: po.quantity,
        uom: po.uom,
        scheduled_end_date: po.need_date,
        source_type: 'from_mrp',
        notes: `Auto-generated dari MRP Run: butuh ${po.need_date}, pesan/mulai ${po.order_date}`,
      });
      toast.success(`WO ${res.data.wo_number || ''} berhasil dibuat`.trim());
      runMrp();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Gagal membuat Work Order');
    } finally {
      setCreatingWoIdx(null);
    }
  };

  const handleConvertToPR = async () => {
    if (selectedOrders.length === 0) {
      toast.error('Pilih minimal satu planned order');
      return;
    }
    setConverting(true);
    try {
      const res = await axiosInstance.post('/api/mrp/run/convert-to-pr', {
        orders: selectedOrders.map((o) => ({
          entity_kind: o.entity_kind,
          material_id: o.material_id,
          material_name: o.material_name,
          material_code: o.material_code,
          quantity: o.quantity,
          uom: o.uom,
          need_date: o.need_date,
          order_date: o.order_date,
          procurement_type: o.procurement_type,
        })),
      });
      toast.success(res.data.message || 'PR berhasil dibuat');
      runMrp();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Gagal membuat PR');
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <CalculatorIcon className="h-6 w-6" />
          MRP Run (Time-Phased)
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Perhitungan kebutuhan material per periode mingguan dengan lead time offset — hasilnya berupa Planned Order (bahan, jumlah, kapan harus dipesan), bukan sekadar laporan shortage.
        </p>
      </div>

      <div className="card p-4 flex flex-wrap gap-4 items-center">
        <label className="text-sm text-gray-600 dark:text-gray-300">Horizon (minggu):</label>
        <input
          type="number"
          min={1}
          max={52}
          className="input-field w-24"
          value={horizonWeeks}
          onChange={(e) => setHorizonWeeks(Number(e.target.value) || 12)}
        />
        <button className="btn-primary" disabled={loading} onClick={runMrp}>
          {loading ? 'Menghitung...' : 'Jalankan MRP'}
        </button>
        <button
          className="btn-secondary ml-auto"
          disabled={converting || selectedOrders.length === 0}
          onClick={handleConvertToPR}
        >
          {converting ? 'Membuat PR...' : `Buat PR dari ${selectedOrders.length} Planned Order (Beli)`}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">Menghitung MRP run...</div>
      ) : plannedOrders.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          Tidak ada planned order — semua kebutuhan tercukupi dalam horizon {horizonWeeks} minggu ini.
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      onChange={(e) => toggleAll(e.target.checked)}
                      checked={buyOrders.length > 0 && selectedOrders.length === buyOrders.length}
                    />
                  </th>
                  <th>Bahan</th>
                  <th>Tipe</th>
                  <th>Qty</th>
                  <th>Tanggal Butuh</th>
                  <th>Tanggal Harus Pesan</th>
                  <th>Lead Time</th>
                  <th>Catatan</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {plannedOrders.map((po, idx) => (
                  <tr key={idx} className={po.is_overdue ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                    <td>
                      {po.procurement_type === 'buy' ? (
                        <input
                          type="checkbox"
                          checked={!!selected[idx]}
                          onChange={(e) => setSelected({ ...selected, [idx]: e.target.checked })}
                        />
                      ) : null}
                    </td>
                    <td className="font-medium">{po.material_code} - {po.material_name}</td>
                    <td>
                      {po.procurement_type === 'make' ? (
                        <span className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">Buat (WIP)</span>
                      ) : (
                        <span className="text-xs font-medium text-gray-500">Beli</span>
                      )}
                    </td>
                    <td>{po.quantity.toLocaleString()} {po.uom}</td>
                    <td>{po.need_date}</td>
                    <td>{po.order_date}</td>
                    <td>{po.lead_time_days} hari</td>
                    <td>
                      {po.is_overdue && (
                        <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium">
                          <ExclamationTriangleIcon className="h-4 w-4" /> Terlambat pesan
                        </span>
                      )}
                      {po.covered_by_moq && (
                        <span className="text-xs text-blue-600 block">Dibulatkan ke MOQ kontrak</span>
                      )}
                      {po.procurement_type === 'make' && (
                        <span className="text-xs text-amber-600 block">Butuh Work Order, bukan PR</span>
                      )}
                    </td>
                    <td className="space-x-2 whitespace-nowrap">
                      <button
                        className="text-primary-600 hover:text-primary-800 text-xs font-medium"
                        onClick={() => setDetailMaterial(materials.find((m) => m.material_id === po.material_id && m.entity_kind === po.entity_kind) || null)}
                      >
                        Detail Mingguan
                      </button>
                      {po.procurement_type === 'make' && (
                        <button
                          className="text-amber-600 hover:text-amber-800 text-xs font-medium disabled:opacity-50"
                          disabled={creatingWoIdx === idx}
                          onClick={() => handleCreateWO(po, idx)}
                        >
                          {creatingWoIdx === idx ? 'Membuat...' : 'Buat WO'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Exception List (MD05-equivalent): PO/WO yang sudah ada tapi
          jadwalnya tidak sesuai kebutuhan terkini hasil run ini. */}
      <div className="card">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Exception List</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            PO/SPK yang sudah ada tapi jadwalnya tidak sesuai kebutuhan terkini - percepat, tunda, atau pertimbangkan batal.
          </p>
        </div>
        {exceptions.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            Tidak ada exception - semua PO/SPK yang sudah berjalan sesuai dengan kebutuhan terkini.
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tipe</th>
                  <th>Sumber</th>
                  <th>Bahan/Produk</th>
                  <th>Qty</th>
                  <th>Dijadwalkan</th>
                  <th>Dibutuhkan</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {exceptions.map((exc, idx) => {
                  const cfg = EXCEPTION_CONFIG[exc.type];
                  return (
                    <tr key={idx}>
                      <td>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${cfg.color}`}>{cfg.label}</span>
                      </td>
                      <td className="text-sm">
                        {exc.source === 'purchase_order' ? 'PO' : 'SPK'} {exc.source_number}
                      </td>
                      <td className="font-medium">{exc.material_code} - {exc.material_name}</td>
                      <td>{exc.quantity.toLocaleString()}</td>
                      <td>Minggu {exc.scheduled_week_index + 1}</td>
                      <td>{exc.needed_week_index !== null ? `Minggu ${exc.needed_week_index + 1}` : '-'}</td>
                      <td>
                        <button
                          className="text-primary-600 hover:text-primary-800 text-xs font-medium"
                          onClick={() => setDetailException(exc)}
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailException && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Detail Exception</h3>
                <button
                  onClick={() => setDetailException(null)}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-2xl"
                >
                  &times;
                </button>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-200 mb-4">{detailException.message}</p>
              <dl className="text-sm space-y-2">
                <div className="flex justify-between"><dt className="text-gray-400">Tipe</dt><dd>{EXCEPTION_CONFIG[detailException.type].label}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-400">Sumber</dt><dd>{detailException.source === 'purchase_order' ? 'Purchase Order' : 'Surat Perintah Kerja'} {detailException.source_number}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-400">Bahan/Produk</dt><dd>{detailException.material_code} - {detailException.material_name}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-400">Kuantitas</dt><dd>{detailException.quantity.toLocaleString()}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-400">Tanggal Dijadwalkan</dt><dd>{detailException.scheduled_date}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-400">Minggu Dijadwalkan</dt><dd>Minggu {detailException.scheduled_week_index + 1}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-400">Minggu Dibutuhkan</dt><dd>{detailException.needed_week_index !== null ? `Minggu ${detailException.needed_week_index + 1}` : 'Tidak ada kebutuhan dalam horizon'}</dd></div>
              </dl>
            </div>
          </div>
        </div>
      )}

      {detailMaterial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-6xl w-full max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Detail Mingguan: {detailMaterial.material_code} - {detailMaterial.material_name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Kebutuhan kotor, penerimaan terjadwal, dan saldo proyeksi per minggu ({detailMaterial.uom})
                  </p>
                </div>
                <button
                  onClick={() => setDetailMaterial(null)}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-2xl"
                >
                  &times;
                </button>
              </div>

              <div className="table-container">
                <table className="table text-sm">
                  <thead>
                    <tr>
                      <th className="text-left">Baris</th>
                      {buckets.map((b) => (
                        <th key={b.index} className="text-right whitespace-nowrap">
                          Minggu {b.index + 1}<br />
                          <span className="font-normal text-xs text-gray-400">{b.start_date}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    <tr>
                      <td className="font-medium">Kebutuhan Kotor</td>
                      {detailMaterial.buckets.map((b) => (
                        <td key={b.index} className="text-right">{b.gross_requirement > 0 ? b.gross_requirement.toLocaleString() : '-'}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="font-medium">Penerimaan Terjadwal</td>
                      {detailMaterial.buckets.map((b) => (
                        <td key={b.index} className="text-right text-green-600">{b.scheduled_receipt > 0 ? b.scheduled_receipt.toLocaleString() : '-'}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="font-medium">Saldo Proyeksi</td>
                      {detailMaterial.buckets.map((b) => (
                        <td key={b.index} className={`text-right ${b.projected_balance < 0 ? 'text-red-600 font-semibold' : ''}`}>
                          {b.projected_balance.toLocaleString()}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="font-medium">Net Requirement</td>
                      {detailMaterial.buckets.map((b) => (
                        <td key={b.index} className="text-right">{b.net_requirement > 0 ? <span className="text-red-600 font-semibold">{b.net_requirement.toLocaleString()}</span> : '-'}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
