import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import {
  BeakerIcon,
  CheckCircleIcon,
  ClockIcon,
  CogIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  TruckIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

interface WorkOrder {
  id: number;
  wo_number: string;
  status: string;
  product_name: string;
  quantity_to_produce: number;
  actual_quantity?: number;
}

interface QualityInspection {
  id: number;
  inspection_number: string;
  status: string;
  inspection_date?: string;
}

interface ShippingOrder {
  id: number;
  shipping_number: string;
  status: string;
  tracking_number?: string;
  shipping_date?: string;
}

interface Invoice {
  id: number;
  invoice_number: string;
  status: string;
  total_amount: number;
  invoice_date?: string;
}

interface WorkflowData {
  sales_order: {
    id: number;
    order_number: string;
    status: string;
    customer_name: string;
  };
  work_orders: WorkOrder[];
  quality_inspections: QualityInspection[];
  shipping_orders: ShippingOrder[];
  invoices: Invoice[];
}

// Rebuilt 2026-08-24 (Rombak SO): halaman ini dulunya punya tombol "Confirm Sales
// Order" dan "Trigger Complete Workflow" sendiri - duplikat 2-langkah dari modal
// "Confirm & Mulai Produksi" yang sudah dibuat di SalesOrderDetails.tsx
// (POST /confirm-and-start-production, 1 aksi atomik). Timeline "Workflow Progress"
// juga dihapus - itu baca dari tabel WorkflowStep yang sudah tidak pernah diisi lagi
// sejak trigger_mrp_from_sales_order() dilepas dari confirm_order() (lihat
// SO_APPROVE_FLOW_TRACE.md) - makanya selalu tampil kosong ("cacat, tidak ada
// detail"). Halaman ini sekarang MURNI read-only: riwayat WO/QC/Shipping/Invoice
// per SO. Aksi approve SO sepenuhnya ada di SalesOrderDetails.tsx / List.
//
// 2026-09-12: removed a leftover "Complete Production" button/handler that
// contradicted the read-only intent above - it set a WorkOrder straight to
// 'completed' with zero gate (no batch/packing-list check like the real
// Tutup SPK flow requires), confirmed via real data to have actually been
// used at least twice (2 completed WOs with zero ShiftProduction ever
// recorded). Its backend endpoint (workflow-complete/production/.../complete)
// was also removed - it wrote to two more dead models (QualityInspection,
// WorkflowStep) on top of the missing gate. See project_sap_alignment_survey
// memory ("status lifecycle validation" finding).
const WorkflowStatus: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [workflowData, setWorkflowData] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkflowStatus();
  }, [id]);

  const fetchWorkflowStatus = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/api/workflow-complete/status/${id}`);
      setWorkflowData(response.data);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to fetch workflow status');
    } finally {
      setLoading(false);
    }
  };

  const approveQuality = async (inspectionId: number) => {
    try {
      const approved = confirm('Approve this quality inspection?');
      const notes = prompt('Enter inspection notes (optional):') || '';

      await axiosInstance.post(`/api/workflow-complete/quality/${inspectionId}/approve`, {
        approved,
        notes
      });
      alert('Quality inspection updated successfully!');
      fetchWorkflowStatus();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update quality inspection');
    }
  };

  const shipOrder = async (shippingId: number) => {
    try {
      const trackingNumber = prompt('Enter tracking number:') || '';
      const carrier = prompt('Enter carrier name:') || '';

      await axiosInstance.post(`/api/workflow-complete/shipping/${shippingId}/ship`, {
        tracking_number: trackingNumber,
        carrier
      });
      alert('Order shipped successfully!');
      fetchWorkflowStatus();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to ship order');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3">Memuat riwayat...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <ExclamationTriangleIcon className="h-12 w-12 mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Gagal Memuat Riwayat</h3>
        <p className="text-gray-500 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  if (!workflowData) {
    return <div>Data tidak ditemukan</div>;
  }

  const hasNoDownstreamData =
    workflowData.work_orders.length === 0 &&
    workflowData.quality_inspections.length === 0 &&
    workflowData.shipping_orders.length === 0 &&
    workflowData.invoices.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <Link
          to={`/app/sales/orders/${id}`}
          className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-3"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Kembali ke Sales Order
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Riwayat Produksi &amp; Pengiriman: {workflowData.sales_order.order_number}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">Customer: {workflowData.sales_order.customer_name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Status SO:
              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                workflowData.sales_order.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                workflowData.sales_order.status === 'in_production' ? 'bg-yellow-100 text-yellow-800' :
                workflowData.sales_order.status === 'ready' ? 'bg-green-100 text-green-800' :
                workflowData.sales_order.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {workflowData.sales_order.status}
              </span>
            </p>
          </div>
        </div>
      </div>

      {hasNoDownstreamData && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 text-center text-gray-500 dark:text-gray-400">
          Belum ada SPK/QC/Pengiriman/Invoice untuk SO ini.
          {workflowData.sales_order.status === 'draft' && (
            <> SO ini masih draft — buka <Link to={`/app/sales/orders/${id}`} className="text-blue-600 dark:text-blue-400 underline">halaman Sales Order</Link> untuk Confirm &amp; Mulai Produksi.</>
          )}
        </div>
      )}

      {/* SPK */}
      {workflowData.work_orders.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <CogIcon className="h-5 w-5" /> Production Orders
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflowData.work_orders.map((wo) => (
              <div key={wo.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{wo.wo_number}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    wo.status === 'completed' ? 'bg-green-100 text-green-800' :
                    wo.status === 'planned' ? 'bg-blue-100 text-blue-800' :
                    wo.status === 'quality_approved' ? 'bg-purple-100 text-purple-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {wo.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{wo.product_name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Quantity: {wo.quantity_to_produce}
                  {wo.actual_quantity && ` / Actual: ${wo.actual_quantity}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quality Inspections */}
      {workflowData.quality_inspections.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BeakerIcon className="h-5 w-5" /> Quality Inspections
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflowData.quality_inspections.map((qi) => (
              <div key={qi.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{qi.inspection_number}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    qi.status === 'passed' ? 'bg-green-100 text-green-800' :
                    qi.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {qi.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {qi.inspection_date ?
                    `Inspected: ${new Date(qi.inspection_date).toLocaleDateString()}` :
                    'Pending inspection'
                  }
                </p>
                {qi.status === 'pending' && (
                  <button
                    onClick={() => approveQuality(qi.id)}
                    className="mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    Inspect Quality
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shipping Orders */}
      {workflowData.shipping_orders.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TruckIcon className="h-5 w-5" /> Shipping Orders
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflowData.shipping_orders.map((so) => (
              <div key={so.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{so.shipping_number}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    so.status === 'shipped' ? 'bg-green-100 text-green-800' :
                    so.status === 'preparing' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {so.status}
                  </span>
                </div>
                {so.tracking_number && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Tracking: {so.tracking_number}</p>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {so.shipping_date ?
                    `Shipped: ${new Date(so.shipping_date).toLocaleDateString()}` :
                    'Not shipped yet'
                  }
                </p>
                {so.status === 'preparing' && (
                  <button
                    onClick={() => shipOrder(so.id)}
                    className="mt-2 px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                  >
                    Ship Order
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoices */}
      {workflowData.invoices.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5" /> Invoices
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflowData.invoices.map((inv) => (
              <div key={inv.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{inv.invoice_number}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    inv.status === 'paid' ? 'bg-green-100 text-green-800' :
                    inv.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {inv.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                  Amount: Rp {inv.total_amount.toLocaleString('id-ID')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {inv.invoice_date ?
                    `Date: ${new Date(inv.invoice_date).toLocaleDateString()}` :
                    'No date'
                  }
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowStatus;
