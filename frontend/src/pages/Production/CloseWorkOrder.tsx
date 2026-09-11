import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeftIcon, CheckCircleIcon, ExclamationTriangleIcon, PlusIcon, LockClosedIcon, LockOpenIcon } from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import PackingListTab from '../../components/Production/PackingListTab';

interface WasteRecord {
  id: number;
  record_number: string;
  category_name: string;
  quantity: number;
  uom: string;
  waste_date: string;
  batch_number: string | null;
}

interface WasteCategory {
  id: number;
  name: string;
}

interface ProductionBatchOption {
  id: number;
  batch_number: string;
  status: string;
  planned_qty: number;
  realized_qty: number;
  admin_closed?: boolean;
}

interface MaterialIssueRow {
  id: number;
  issue_number: string;
  status: string;
  total_items: number;
  issue_date: string;
}

export default function CloseWorkOrder() {
  const { id: workOrderId } = useParams();
  const navigate = useNavigate();

  const [workOrder, setWorkOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [batches, setBatches] = useState<ProductionBatchOption[]>([]);
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [wasteCategories, setWasteCategories] = useState<WasteCategory[]>([]);
  const [wasteForm, setWasteForm] = useState({ category_id: '', production_batch_id: '', quantity: '', uom: 'KG', reason: '' });
  const [savingWaste, setSavingWaste] = useState(false);

  const [materialIssues, setMaterialIssues] = useState<MaterialIssueRow[]>([]);

  const [completing, setCompleting] = useState(false);
  const [missingRequirements, setMissingRequirements] = useState<string[]>([]);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const woRes = await axiosInstance.get(`/api/production/work-orders/${workOrderId}`);
      setWorkOrder(woRes.data.work_order);

      await Promise.all([fetchWaste(), fetchWasteCategories(), fetchBatches(), fetchMaterialIssues()]);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat data SPK');
    } finally {
      setLoading(false);
    }
  };

  const fetchWaste = async () => {
    const res = await axiosInstance.get('/api/waste/records?days=365');
    const all = res.data.records || [];
    setWasteRecords(all.filter((r: any) => String(r.work_order_id) === String(workOrderId)));
  };

  const fetchWasteCategories = async () => {
    const res = await axiosInstance.get('/api/waste/categories');
    setWasteCategories(res.data.categories || res.data || []);
  };

  const fetchBatches = async () => {
    const res = await axiosInstance.get(`/api/batch-scheduling/batches?work_order_id=${workOrderId}`);
    setBatches(res.data.batches || res.data || []);
  };

  const fetchMaterialIssues = async () => {
    const res = await axiosInstance.get('/api/production/material-issues', { params: { work_order_id: workOrderId, per_page: 100 } });
    setMaterialIssues(res.data.material_issues || []);
  };

  const handleAddWaste = async () => {
    if (!wasteForm.category_id || !wasteForm.quantity) {
      toast.error('Kategori dan quantity waste wajib diisi');
      return;
    }
    setSavingWaste(true);
    try {
      await axiosInstance.post('/api/waste/records', {
        category_id: Number(wasteForm.category_id),
        waste_date: new Date().toISOString(),
        work_order_id: Number(workOrderId),
        production_batch_id: wasteForm.production_batch_id ? Number(wasteForm.production_batch_id) : undefined,
        quantity: Number(wasteForm.quantity),
        uom: wasteForm.uom,
        reason: wasteForm.reason || undefined,
      });
      toast.success('Waste tercatat');
      setWasteForm({ category_id: '', production_batch_id: '', quantity: '', uom: 'KG', reason: '' });
      await fetchWaste();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Gagal mencatat waste');
    } finally {
      setSavingWaste(false);
    }
  };

  const handleCompleteSpk = async () => {
    setCompleting(true);
    setMissingRequirements([]);
    try {
      await axiosInstance.put(`/api/production/work-orders/${workOrderId}/complete`, {});
      toast.success('SPK berhasil diselesaikan');
      navigate(`/app/production/work-orders/${workOrderId}`);
    } catch (error: any) {
      const missing = error?.response?.data?.missing;
      if (missing) {
        setMissingRequirements(missing);
        toast.error('Syarat penutupan SPK belum lengkap');
      } else {
        toast.error(error?.response?.data?.error || 'Gagal menyelesaikan SPK');
      }
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Memuat...</div>;
  }

  if (!workOrder) {
    return <div className="text-center py-12 text-red-500">SPK tidak ditemukan</div>;
  }

  const packPerCarton = workOrder.pack_per_carton || 1;
  const totalAktualKarton = packPerCarton > 0 ? Math.floor((workOrder.quantity_good || 0) / packPerCarton) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/app/production/work-orders/${workOrderId}`} className="text-gray-500 hover:text-gray-700">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tutup SPK — {workOrder.wo_number}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {workOrder.product_name} · Penyelesaian barang jadi: bahan aktual, waste, packing list
          </p>
        </div>
      </div>

      {missingRequirements.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium mb-2">
            <ExclamationTriangleIcon className="h-5 w-5" />
            Syarat penutupan SPK belum lengkap
          </div>
          <ul className="list-disc pl-6 text-sm text-red-600 dark:text-red-400">
            {missingRequirements.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}

      {/* Section 1: Tutup Batch - partial/bertahap, satu baris = satu event produksi fisik */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-1">1. Tutup Batch (Bahan Aktual per Batch)</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Setiap batch ditutup satu-satu begitu produksinya selesai — tidak perlu menunggu semua batch SPK ini kelar.
        </p>
        {batches.length === 0 ? (
          <div className="text-sm text-gray-400">Belum ada batch produksi untuk SPK ini.</div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Target</th>
                  <th>Realisasi</th>
                  <th>Status Produksi</th>
                  <th>Status Tutup</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="font-medium">{b.batch_number}</td>
                    <td>{b.planned_qty}</td>
                    <td>{b.realized_qty}</td>
                    <td><span className="badge badge-info">{b.status}</span></td>
                    <td>
                      {b.admin_closed ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-sm"><LockClosedIcon className="h-4 w-4" /> Tertutup</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 text-sm"><LockOpenIcon className="h-4 w-4" /> Belum ditutup</span>
                      )}
                    </td>
                    <td>
                      <Link to={`/app/production/batches/${b.id}/close`} className="text-primary-600 hover:underline text-sm">
                        {b.admin_closed ? 'Lihat' : 'Tutup Batch'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Material Issue (review) */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">2. Material Issue (Bahan Pembantu)</h2>
          <Link to="/app/production/material-issues/new" className="btn-secondary text-sm inline-flex items-center gap-1">
            <PlusIcon className="h-4 w-4" /> Buat Material Issue
          </Link>
        </div>
        {materialIssues.length === 0 ? (
          <div className="text-sm text-gray-400">Belum ada Material Issue (selotip, lem, dll) tercatat untuk SPK ini.</div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>No. Issue</th>
                  <th>Status</th>
                  <th>Jumlah Item</th>
                  <th>Tanggal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {materialIssues.map((mi) => (
                  <tr key={mi.id}>
                    <td className="font-medium">{mi.issue_number}</td>
                    <td><span className="badge badge-info">{mi.status}</span></td>
                    <td>{mi.total_items}</td>
                    <td>{mi.issue_date}</td>
                    <td>
                      <Link to={`/app/production/material-issues/${mi.id}`} className="text-primary-600 hover:underline text-sm">
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3: Waste */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">3. Waste / Reject</h2>
        <div className="grid grid-cols-5 gap-3 mb-4">
          <select
            className="input-field"
            value={wasteForm.category_id}
            onChange={(e) => setWasteForm({ ...wasteForm, category_id: e.target.value })}
          >
            <option value="">Kategori waste...</option>
            {wasteCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            className="input-field"
            value={wasteForm.production_batch_id}
            onChange={(e) => setWasteForm({ ...wasteForm, production_batch_id: e.target.value })}
          >
            <option value="">Batch (opsional)...</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.batch_number}</option>
            ))}
          </select>
          <input
            type="number"
            step="any"
            placeholder="Quantity"
            className="input-field"
            value={wasteForm.quantity}
            onChange={(e) => setWasteForm({ ...wasteForm, quantity: e.target.value })}
          />
          <input
            type="text"
            placeholder="UOM"
            className="input-field"
            value={wasteForm.uom}
            onChange={(e) => setWasteForm({ ...wasteForm, uom: e.target.value })}
          />
          <input
            type="text"
            placeholder="Alasan (opsional)"
            className="input-field"
            value={wasteForm.reason}
            onChange={(e) => setWasteForm({ ...wasteForm, reason: e.target.value })}
          />
        </div>
        <button className="btn-secondary" disabled={savingWaste} onClick={handleAddWaste}>
          {savingWaste ? 'Menyimpan...' : 'Tambah Waste'}
        </button>

        {wasteRecords.length > 0 && (
          <div className="mt-4 table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>No. Record</th>
                  <th>Kategori</th>
                  <th>Batch</th>
                  <th>Quantity</th>
                  <th>Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {wasteRecords.map((w) => (
                  <tr key={w.id}>
                    <td>{w.record_number}</td>
                    <td>{w.category_name}</td>
                    <td>{w.batch_number || '-'}</td>
                    <td>{w.quantity} {w.uom}</td>
                    <td>{new Date(w.waste_date).toLocaleDateString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 4: Packing List */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">4. Packing List</h2>
        {packPerCarton > 0 ? (
          <PackingListTab
            workOrderId={Number(workOrderId)}
            productName={workOrder.product_name}
            totalAktualKarton={totalAktualKarton}
            packPerCarton={packPerCarton}
          />
        ) : (
          <div className="text-sm text-gray-400">Pack per carton belum diatur untuk produk ini.</div>
        )}
      </div>

      {/* Complete button */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <button
          className="btn-primary inline-flex items-center gap-2"
          disabled={completing}
          onClick={handleCompleteSpk}
        >
          <CheckCircleIcon className="h-5 w-5" />
          {completing ? 'Menyelesaikan...' : 'Selesaikan SPK'}
        </button>
      </div>
    </div>
  );
}
