import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  CubeIcon,
  BeakerIcon,
  DocumentTextIcon,
  ClipboardDocumentCheckIcon
} from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';
import toast from 'react-hot-toast';

interface FGConversionItem {
  id: number;
  wip_product_id: number;
  wip_product_name: string;
  wip_quantity: number;
  fg_product_id: number;
  fg_product_name: string;
  fg_quantity: number;
  loss_quantity: number;
  loss_percentage: number;
  batch_number: string;
  expiry_date: string | null;
  production_date: string;
  uom: string;
  pack_per_carton: number;
  total_cartons: number;
}

interface FGConversionMaterial {
  id: number;
  material_id: number;
  material_name: string;
  material_code: string;
  quantity_required: number;
  quantity_consumed: number;
  uom: string;
  unit_cost: number;
  total_cost: number;
  deducted_from_inventory: boolean;
  source_batch: string | null;
}

interface FGConversionLossDetail {
  id: number;
  loss_type: string;
  loss_quantity: number;
  uom: string;
  loss_reason: string;
  loss_category: string | null;
  unit_cost: number;
  total_cost_impact: number;
  responsible_dept: string | null;
  pic: string | null;
  corrective_action: string | null;
  preventive_action: string | null;
}

interface FGConversion {
  id: number;
  conversion_number: string;
  work_order_id: number;
  wo_number: string;
  batch_number: string;
  qc_inspection_id: number | null;
  qc_status: string;
  qc_date: string | null;
  conversion_date: string;
  conversion_type: string;
  status: string;
  total_wip_qty: number;
  total_fg_qty: number;
  total_loss_qty: number;
  total_material_cost: number;
  batch_validated: boolean;
  validation_notes: string | null;
  created_by: string | null;
  completed_by: string | null;
  completed_at: string | null;
  notes: string | null;
  items: FGConversionItem[];
  materials: FGConversionMaterial[];
  loss_details: FGConversionLossDetail[];
}

const FGConversionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [conversion, setConversion] = useState<FGConversion | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    fetchConversionDetail();
  }, [id]);

  const fetchConversionDetail = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/api/fg-conversion/${id}`);
      setConversion(response.data.data);
    } catch (error) {
      console.error('Error fetching conversion detail:', error);
      toast.error('Gagal memuat detail konversi');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!confirm('Yakin ingin menyelesaikan konversi ini? Proses ini akan:\n- Mengurangi WIP stock\n- Menambah FG inventory\n- Mengurangi material (packaging, labels)\n\nProses tidak dapat dibatalkan!')) {
      return;
    }

    try {
      setCompleting(true);
      await axiosInstance.put(`/api/fg-conversion/${id}/complete`);
      toast.success('Konversi berhasil diselesaikan!');
      fetchConversionDetail();
    } catch (error: any) {
      console.error('Error completing conversion:', error);
      toast.error(error.response?.data?.message || 'Gagal menyelesaikan konversi');
    } finally {
      setCompleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100">Draft</span>;
      case 'in_progress':
        return <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800">In Progress</span>;
      case 'completed':
        return <span className="px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800">Completed</span>;
      case 'cancelled':
        return <span className="px-3 py-1 text-sm font-medium rounded-full bg-red-100 text-red-800">Cancelled</span>;
      default:
        return <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100">{status}</span>;
    }
  };

  const getQCStatusBadge = (qcStatus: string) => {
    switch (qcStatus) {
      case 'pass':
        return <span className="px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800">Pass</span>;
      case 'fail':
        return <span className="px-3 py-1 text-sm font-medium rounded-full bg-red-100 text-red-800">Fail</span>;
      case 'rework':
        return <span className="px-3 py-1 text-sm font-medium rounded-full bg-yellow-100 text-yellow-800">Rework</span>;
      default:
        return <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100">{qcStatus}</span>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!conversion) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <XCircleIcon className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Konversi tidak ditemukan</p>
          <Link to="/app/production/fg-conversion" className="text-blue-600 hover:underline mt-4 inline-block">
            Kembali ke List
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/app/production/fg-conversion')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{conversion.conversion_number}</h1>
            <p className="text-gray-600 dark:text-gray-300">Detail Konversi WIP ke Finish Good</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(conversion.status)}
          {conversion.status === 'draft' && (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {completing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-5 w-5" />
                  Complete Conversion
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">WIP Consumed</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{conversion.total_wip_qty.toLocaleString()}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">pcs</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">FG Produced</p>
          <p className="text-2xl font-bold text-green-600">{conversion.total_fg_qty.toLocaleString()}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">pcs</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Loss/Reject</p>
          <p className="text-2xl font-bold text-red-600">{conversion.total_loss_qty.toLocaleString()}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {conversion.total_wip_qty > 0 ? `${((conversion.total_loss_qty / conversion.total_wip_qty) * 100).toFixed(2)}%` : '0%'}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Material Cost</p>
          <p className="text-2xl font-bold text-purple-600">{formatCurrency(conversion.total_material_cost)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">packaging, labels, etc</p>
        </div>
      </div>

      {/* Main Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5" />
            Informasi Konversi
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Work Order</label>
              <p className="text-gray-900 dark:text-white font-medium">{conversion.wo_number}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Batch Number</label>
              <div className="flex items-center gap-2">
                <p className="text-gray-900 dark:text-white font-medium">{conversion.batch_number}</p>
                {conversion.batch_validated ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-500" title="Batch validated" />
                ) : (
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" title="Batch not validated" />
                )}
              </div>
              {conversion.validation_notes && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{conversion.validation_notes}</p>
              )}
            </div>
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">QC Status</label>
              <div className="mt-1">{getQCStatusBadge(conversion.qc_status)}</div>
              {conversion.qc_date && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">QC Date: {formatDate(conversion.qc_date)}</p>
              )}
            </div>
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Conversion Type</label>
              <p className="text-gray-900 dark:text-white">{conversion.conversion_type === 'auto' ? 'Auto (After QC)' : 'Manual'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Conversion Date</label>
              <p className="text-gray-900 dark:text-white">{formatDate(conversion.conversion_date)}</p>
            </div>
            {conversion.notes && (
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400">Notes</label>
                <p className="text-gray-900 dark:text-white">{conversion.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardDocumentCheckIcon className="h-5 w-5" />
            Status & Tracking
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-500 dark:text-gray-400">Created By</label>
              <p className="text-gray-900 dark:text-white">{conversion.created_by || '-'}</p>
            </div>
            {conversion.completed_by && (
              <>
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400">Completed By</label>
                  <p className="text-gray-900 dark:text-white">{conversion.completed_by}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 dark:text-gray-400">Completed At</label>
                  <p className="text-gray-900 dark:text-white">{conversion.completed_at ? formatDate(conversion.completed_at) : '-'}</p>
                </div>
              </>
            )}
            {conversion.status === 'draft' && (
              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Perhatian:</strong> Konversi masih dalam status draft. Klik "Complete Conversion" untuk menyelesaikan proses.
                </p>
              </div>
            )}
            {conversion.status === 'completed' && (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <CheckCircleIcon className="h-5 w-5 inline mr-2" />
                  Konversi telah selesai. WIP stock telah dikurangi dan FG inventory telah ditambahkan.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conversion Items */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <CubeIcon className="h-5 w-5" />
            Conversion Items (WIP → FG)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">WIP Product</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">WIP Qty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">FG Product</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">FG Qty</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Loss</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Batch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Expiry Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cartons</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {conversion.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{item.wip_product_name}</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">{item.wip_quantity.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{item.fg_product_name}</td>
                  <td className="px-6 py-4 text-sm text-right text-green-600 font-medium">{item.fg_quantity.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-right text-red-600">
                    {item.loss_quantity.toLocaleString()} ({item.loss_percentage.toFixed(2)}%)
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{item.batch_number}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('id-ID') : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                    {item.total_cartons} ({item.pack_per_carton}/ctn)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Materials Consumed */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BeakerIcon className="h-5 w-5" />
            Materials Consumed (Packaging, Labels, etc)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Material</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Code</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Required</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Consumed</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unit Cost</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Cost</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {conversion.materials.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    No materials consumed
                  </td>
                </tr>
              ) : (
                conversion.materials.map((material) => (
                  <tr key={material.id}>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{material.material_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{material.material_code}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                      {material.quantity_required.toLocaleString()} {material.uom}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                      {material.quantity_consumed.toLocaleString()} {material.uom}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                      {formatCurrency(material.unit_cost)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-gray-900 dark:text-white">
                      {formatCurrency(material.total_cost)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {material.deducted_from_inventory ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Deducted</span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Pending</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Loss Details */}
      {conversion.loss_details.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5" />
              Loss/Reject Details
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cost Impact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Responsible</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {conversion.loss_details.map((loss) => (
                  <tr key={loss.id}>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white capitalize">{loss.loss_type}</td>
                    <td className="px-6 py-4 text-sm text-right text-red-600 font-medium">
                      {loss.loss_quantity.toLocaleString()} {loss.uom}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{loss.loss_reason}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 capitalize">{loss.loss_category || '-'}</td>
                    <td className="px-6 py-4 text-sm text-right text-red-600 font-medium">
                      {formatCurrency(loss.total_cost_impact)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {loss.responsible_dept && <div>{loss.responsible_dept}</div>}
                      {loss.pic && <div className="text-xs text-gray-500 dark:text-gray-400">{loss.pic}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default FGConversionDetail;
