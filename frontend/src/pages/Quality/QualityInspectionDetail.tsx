import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';

interface InspectionDetailData {
  id: number;
  inspection_number: string;
  inspection_date: string | null;
  inspection_type: string;
  product_id: number | null;
  product_name: string | null;
  product_code: string | null;
  work_order_id: number | null;
  wo_number: string | null;
  batch_number: string | null;
  sample_size: number | null;
  defect_count: number;
  status: string;
  result: string | null;
  notes: string | null;
  total_checklist_items: number;
  passed_checklist_items: number;
  failed_checklist_items: number;
  quantity_inspected: number | null;
  quantity_passed: number | null;
  quantity_failed: number | null;
  disposition: string | null;
  disposition_date: string | null;
  disposition_by_name: string | null;
  disposition_notes: string | null;
  transferred_to_warehouse: boolean;
  warehouse_transfer_date: string | null;
  warehouse_location_name: string | null;
  findings: string | null;
  corrective_actions: string | null;
  inspector_name: string | null;
  created_by_name: string | null;
  created_at: string | null;
}

const resultBadgeClass = (result: string | null) => {
  switch (result) {
    case 'passed':
    case 'accepted':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'rejected':
    case 'critical':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'warning':
    case 'rework':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  }
};

const dispositionBadgeClass = (disposition: string | null) => {
  switch (disposition) {
    case 'released':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'reject':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'quarantine':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  }
};

export default function QualityInspectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inspection, setInspection] = useState<InspectionDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInspection = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get(`/api/quality/inspections/${id}`);
        setInspection(res.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Gagal memuat data inspeksi QC');
      } finally {
        setLoading(false);
      }
    };
    fetchInspection();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !inspection) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-red-600 dark:text-red-400">{error || 'Inspeksi tidak ditemukan'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
          Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{inspection.inspection_number}</h1>
          <p className="text-gray-600 dark:text-gray-300 capitalize">
            Inspeksi {inspection.inspection_type?.replace('_', ' ')}
            {inspection.product_name && ` — ${inspection.product_name}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {inspection.result && (
            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium capitalize ${resultBadgeClass(inspection.result)}`}>
              {inspection.result}
            </span>
          )}
          <button onClick={() => navigate(-1)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
            Kembali
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Produk</p>
            <p className="text-base font-semibold text-gray-900 dark:text-white">{inspection.product_name || '-'}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{inspection.product_code}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Work Order</p>
            {inspection.wo_number ? (
              <a href={`/app/production/work-orders/${inspection.work_order_id}`} className="text-base font-semibold text-blue-600 hover:underline">
                {inspection.wo_number}
              </a>
            ) : <p className="text-base text-gray-900 dark:text-white">-</p>}
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">No. Batch</p>
            <p className="text-base text-gray-900 dark:text-white">{inspection.batch_number || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tanggal Inspeksi</p>
            <p className="text-base text-gray-900 dark:text-white">
              {inspection.inspection_date ? new Date(inspection.inspection_date).toLocaleString('id-ID') : '-'}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
            <p className="text-xs text-blue-600 dark:text-blue-300 font-medium">Sample Size</p>
            <p className="text-xl font-bold text-blue-800 dark:text-blue-200">{inspection.sample_size ?? '-'}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg">
            <p className="text-xs text-red-600 dark:text-red-300 font-medium">Defect Count</p>
            <p className="text-xl font-bold text-red-800 dark:text-red-200">{inspection.defect_count}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg">
            <p className="text-xs text-green-600 dark:text-green-300 font-medium">Checklist Lolos</p>
            <p className="text-xl font-bold text-green-800 dark:text-green-200">
              {inspection.passed_checklist_items}/{inspection.total_checklist_items}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">Qty Diinspeksi</p>
            <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{inspection.quantity_inspected ?? '-'}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">Status</p>
            <p className="text-xl font-bold text-gray-800 dark:text-gray-200 capitalize">{inspection.status}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Disposisi Gudang</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Disposisi</p>
            {inspection.disposition ? (
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium capitalize ${dispositionBadgeClass(inspection.disposition)}`}>
                {inspection.disposition}
              </span>
            ) : <p className="text-base text-gray-900 dark:text-white">-</p>}
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Ditetapkan Oleh</p>
            <p className="text-base text-gray-900 dark:text-white">{inspection.disposition_by_name || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tanggal Disposisi</p>
            <p className="text-base text-gray-900 dark:text-white">
              {inspection.disposition_date ? new Date(inspection.disposition_date).toLocaleString('id-ID') : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Ditransfer ke Gudang</p>
            <p className="text-base text-gray-900 dark:text-white">
              {inspection.transferred_to_warehouse ? `Ya${inspection.warehouse_location_name ? ` (${inspection.warehouse_location_name})` : ''}` : 'Belum'}
            </p>
          </div>
        </div>
        {inspection.disposition_notes && (
          <div className="mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Catatan Disposisi</p>
            <p className="text-base text-gray-900 dark:text-white">{inspection.disposition_notes}</p>
          </div>
        )}
      </div>

      {(inspection.findings || inspection.corrective_actions || inspection.notes) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Temuan &amp; Tindak Lanjut</h2>
          {inspection.findings && (
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Temuan</p>
              <p className="text-base text-gray-900 dark:text-white">{inspection.findings}</p>
            </div>
          )}
          {inspection.corrective_actions && (
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Tindakan Korektif</p>
              <p className="text-base text-gray-900 dark:text-white">{inspection.corrective_actions}</p>
            </div>
          )}
          {inspection.notes && (
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Catatan</p>
              <p className="text-base text-gray-900 dark:text-white">{inspection.notes}</p>
            </div>
          )}
        </div>
      )}

      <div className="text-sm text-gray-500 dark:text-gray-400">
        Diinspeksi oleh {inspection.inspector_name || '-'} · Dibuat oleh {inspection.created_by_name || '-'}
        {inspection.created_at && ` pada ${new Date(inspection.created_at).toLocaleString('id-ID')}`}
      </div>
    </div>
  );
}
