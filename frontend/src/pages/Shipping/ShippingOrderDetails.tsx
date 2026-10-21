import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { confirmDialog, showError } from '../../components/ui';
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  CalendarIcon as Calendar,
  CheckCircleIcon,
  CheckCircleIcon as CheckCircle,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  CubeIcon,
  DocumentTextIcon,
  EnvelopeIcon as Mail,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  MapPinIcon as MapPin,
  PencilIcon as Edit,
  PhoneIcon,
  PlusIcon,
  PrinterIcon,
  QrCodeIcon,
  TruckIcon,
  TruckIcon as Truck,
  UserIcon,
  XCircleIcon,
  XMarkIcon,
  TrashIcon as Trash2
} from '@heroicons/react/24/outline';

interface HandlingUnit {
  id: number;
  hu_number: string;
  shipping_item_id: number;
  quantity: number;
  uom: string;
  product_name: string;
  product_code: string;
  notes: string | null;
  standard_pallet_qty: number | null;
  fill_percent: number | null;
  is_full_pallet: boolean;
  created_at: string;
  shipping_order?: {
    id: number;
    shipping_number: string;
    status: string;
    customer_name: string;
    shipping_date: string;
    vehicle_number: string | null;
  };
}

interface HandlingUnitListResponse {
  shipping_item_id: number;
  item_quantity: number;
  packed_quantity: number;
  remaining_quantity: number;
  handling_units: HandlingUnit[];
}

interface ShippingOrderDetails {
  id: number;
  shipping_number: string;
  customer_id: number;
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  customer_email: string;
  shipping_date: string;
  expected_delivery_date: string;
  actual_delivery_date: string;
  delivery_method: string;
  logistics_provider_name: string;
  tracking_number: string;
  status: string;
  shipping_cost: number;
  total_weight: number;
  total_volume: number;
  notes: string;
  created_by: string;
  created_at: string;
  items: ShippingItem[];
  tracking_history: TrackingEvent[];
}

interface ShippingItem {
  id: number;
  product_code: string;
  product_name: string;
  quantity: number;
  uom: string;
  batch_number: string;
}

interface TrackingEvent {
  id: number;
  event_date: string;
  location: string;
  status: string;
  description: string;
  updated_by: string;
}

const ShippingOrderDetails: React.FC = () => {
  const { t } = useLanguage();

  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<ShippingOrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Handling Unit drill-down state - keyed by shipping_item_id
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [huByItem, setHuByItem] = useState<Record<number, HandlingUnitListResponse>>({});
  const [huLoading, setHuLoading] = useState<Record<number, boolean>>({});
  const [newHuQty, setNewHuQty] = useState<Record<number, string>>({});
  const [newHuNotes, setNewHuNotes] = useState<Record<number, string>>({});
  const [huError, setHuError] = useState<Record<number, string>>({});
  const [huSubmitting, setHuSubmitting] = useState<Record<number, boolean>>({});
  const [confirmDeleteHuId, setConfirmDeleteHuId] = useState<number | null>(null);

  // Scan/lookup widget state
  const [scanInput, setScanInput] = useState('');
  const [scanResult, setScanResult] = useState<HandlingUnit | null>(null);
  const [scanError, setScanError] = useState('');
  const [scanLoading, setScanLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchOrderDetails();
    }
  }, [id]);

  const authHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });

  const fetchHandlingUnits = async (itemId: number) => {
    setHuLoading(prev => ({ ...prev, [itemId]: true }));
    try {
      const res = await fetch(`/api/shipping/shipping-items/${itemId}/handling-units`, {
        headers: authHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setHuByItem(prev => ({ ...prev, [itemId]: data }));
      }
    } catch {
      // swallow - panel will just show empty state
    } finally {
      setHuLoading(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const toggleItemExpand = (itemId: number) => {
    const next = expandedItemId === itemId ? null : itemId;
    setExpandedItemId(next);
    if (next !== null && !huByItem[next]) {
      fetchHandlingUnits(next);
    }
  };

  const submitNewHu = async (itemId: number) => {
    const qtyStr = newHuQty[itemId];
    const qty = parseFloat(qtyStr);
    if (!qtyStr || isNaN(qty) || qty <= 0) {
      setHuError(prev => ({ ...prev, [itemId]: 'Quantity harus diisi dan lebih besar dari 0' }));
      return;
    }
    setHuSubmitting(prev => ({ ...prev, [itemId]: true }));
    setHuError(prev => ({ ...prev, [itemId]: '' }));
    try {
      const res = await fetch(`/api/shipping/shipping-items/${itemId}/handling-units`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ quantity: qty, notes: newHuNotes[itemId] || undefined })
      });
      const data = await res.json();
      if (res.ok) {
        setNewHuQty(prev => ({ ...prev, [itemId]: '' }));
        setNewHuNotes(prev => ({ ...prev, [itemId]: '' }));
        fetchHandlingUnits(itemId);
      } else {
        setHuError(prev => ({ ...prev, [itemId]: data.error || 'Gagal membuat Handling Unit' }));
      }
    } catch {
      setHuError(prev => ({ ...prev, [itemId]: 'Network error' }));
    } finally {
      setHuSubmitting(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const deleteHu = async (itemId: number, huId: number) => {
    setConfirmDeleteHuId(null);
    try {
      const res = await fetch(`/api/shipping/handling-units/${huId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (res.ok) {
        fetchHandlingUnits(itemId);
      } else {
        setHuError(prev => ({ ...prev, [itemId]: 'Gagal menghapus Handling Unit' }));
      }
    } catch {
      setHuError(prev => ({ ...prev, [itemId]: 'Network error saat menghapus Handling Unit' }));
    }
  };

  const runScan = async () => {
    const hu = scanInput.trim();
    if (!hu) return;
    setScanLoading(true);
    setScanError('');
    setScanResult(null);
    try {
      const res = await fetch(`/api/shipping/handling-units/scan/${encodeURIComponent(hu)}`, {
        headers: authHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setScanResult(data);
      } else {
        setScanError(data.error || 'Handling Unit tidak ditemukan');
      }
    } catch {
      setScanError('Network error saat mencari Handling Unit');
    } finally {
      setScanLoading(false);
    }
  };

  const fetchOrderDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/shipping/orders/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOrder(data.shipping_order);
      } else {
        setError('Failed to fetch shipping order details');
      }
    } catch (error) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/shipping/orders/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        fetchOrderDetails();
      } else {
        showError('Failed to update order status');
      }
    } catch (error) {
      showError('Error updating order status');
    }
  };

  const deleteOrder = async () => {
    if (!(await confirmDialog('Are you sure you want to delete this shipping order?'))) return;

    try {
      const response = await fetch(`/api/shipping/orders/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        navigate('/app/shipping/orders');
      } else {
        showError('Failed to delete shipping order');
      }
    } catch (error) {
      showError('Error deleting shipping order');
    }
  };

  const printShippingLabel = () => {
    window.print();
  };

  const downloadPOD = async () => {
    try {
      const response = await fetch(`/api/shipping/orders/${id}/pod`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `POD_${order?.shipping_number}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      showError('Error downloading POD');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'in_transit': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'returned': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <ClockIcon className="h-4 w-4" />;
      case 'confirmed': return <CheckCircleIcon className="h-4 w-4" />;
      case 'in_transit': return <TruckIcon className="h-4 w-4" />;
      case 'delivered': return <CheckCircleIcon className="h-4 w-4" />;
      case 'cancelled': return <XCircleIcon className="h-4 w-4" />;
      case 'returned': return <ExclamationTriangleIcon className="h-4 w-4" />;
      default: return <CubeIcon className="h-4 w-4" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error Loading Order</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error || 'Shipping order not found'}</p>
          <Link
            to="/app/shipping/orders"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/app/shipping/orders"
            className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-300 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Shipping Order {order.shipping_number}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Created on {new Date(order.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
            {getStatusIcon(order.status)}
            {order.status.replace('_', ' ').toUpperCase()}
          </span>
          
          <div className="flex items-center gap-2">
            <button
              onClick={printShippingLabel}
              className="px-3 py-2 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              <PrinterIcon className="h-4 w-4" />
            </button>
            <button
              onClick={downloadPOD}
              className="px-3 py-2 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
            </button>
            <Link
              to={`/app/shipping/orders/${id}/edit`}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <Edit className="h-4 w-4" />
            </Link>
            <button
              onClick={deleteOrder}
              className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Order Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Shipping Date
                  </label>
                  <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    {new Date(order.shipping_date).toLocaleDateString()}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Expected Delivery
                  </label>
                  <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <ClockIcon className="h-4 w-4 text-gray-400" />
                    {order.expected_delivery_date 
                      ? new Date(order.expected_delivery_date).toLocaleDateString()
                      : 'Not specified'
                    }
                  </div>
                </div>
                
                {order.actual_delivery_date && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Actual Delivery
                    </label>
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      {new Date(order.actual_delivery_date).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Delivery Method
                  </label>
                  <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                    <Truck className="h-4 w-4 text-gray-400" />
                    {order.delivery_method}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  </label>
                  <div className="text-gray-900 dark:text-white">{order.logistics_provider_name || 'Not specified'}</div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Tracking Number
                  </label>
                  <div className="text-gray-900 dark:text-white font-mono">
                    {order.tracking_number || 'Not assigned'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Shipping Items + Handling Unit drill-down */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Shipping Items</h3>

            <div className="space-y-2">
              {order.items?.map((item) => {
                const isExpanded = expandedItemId === item.id;
                const huData = huByItem[item.id];
                const isHuLoading = huLoading[item.id];
                const packed = huData?.packed_quantity ?? 0;
                const total = huData?.item_quantity ?? item.quantity;
                const pct = total > 0 ? Math.min(100, Math.round((packed / total) * 100)) : 0;

                return (
                  <div key={item.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleItemExpand(item.id)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        )}
                        <CubeIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {item.product_code} - {item.product_name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Batch: {item.batch_number || '-'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {huData && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
                            {huData.handling_units.length} HU · {packed}/{total} {item.uom} dipacking
                          </span>
                        )}
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.quantity} {item.uom}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-4 space-y-4">
                        <div>
                          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                            <span>Progress packing</span>
                            <span>{packed}/{total} {item.uom} ({pct}%)</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                            <div
                              className={`h-2 rounded-full ${pct >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {isHuLoading ? (
                          <div className="text-sm text-gray-500 dark:text-gray-400 py-2">Memuat Handling Unit...</div>
                        ) : (
                          <div className="space-y-2">
                            {(huData?.handling_units.length ?? 0) === 0 && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                                Belum ada Handling Unit (pallet/kemasan) untuk item ini.
                              </div>
                            )}
                            {huData?.handling_units.map((hu) => (
                              <div
                                key={hu.id}
                                className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <QrCodeIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-sm font-mono font-medium text-gray-900 dark:text-white truncate">
                                      {hu.hu_number}
                                    </div>
                                    {hu.notes && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{hu.notes}</div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {confirmDeleteHuId === hu.id ? (
                                    <>
                                      <span className="text-xs text-gray-600 dark:text-gray-300">Hapus?</span>
                                      <button
                                        type="button"
                                        onClick={() => deleteHu(item.id, hu.id)}
                                        className="px-2 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700"
                                      >
                                        Ya, hapus
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteHuId(null)}
                                        className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                                      >
                                        Batal
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-sm text-gray-900 dark:text-white">{hu.quantity} {hu.uom}</span>
                                      {hu.fill_percent !== null && (
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                          hu.is_full_pallet
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                        }`}>
                                          {hu.is_full_pallet ? 'Full' : `${hu.fill_percent}%`}
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteHuId(hu.id)}
                                        className="p-1 text-gray-400 hover:text-red-600"
                                        title="Hapus Handling Unit"
                                      >
                                        <XMarkIcon className="h-4 w-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add new HU form */}
                        <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex-1 min-w-[120px]">
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                              Quantity ({item.uom})
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={newHuQty[item.id] || ''}
                              onChange={(e) => setNewHuQty(prev => ({ ...prev, [item.id]: e.target.value }))}
                              placeholder={`sisa ${huData ? huData.remaining_quantity : item.quantity}`}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div className="flex-1 min-w-[160px]">
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Catatan (opsional)</label>
                            <input
                              type="text"
                              value={newHuNotes[item.id] || ''}
                              onChange={(e) => setNewHuNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                              placeholder="misal: pallet 1"
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => submitNewHu(item.id)}
                            disabled={huSubmitting[item.id]}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center gap-1"
                          >
                            <PlusIcon className="h-4 w-4" />
                            Tambah HU
                          </button>
                        </div>
                        {huError[item.id] && (
                          <div className="text-sm text-red-600 dark:text-red-400">{huError[item.id]}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Handling Unit - scan/lookup */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Cari Handling Unit</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Scan atau ketik nomor HU untuk cek isi, qty, dan status pengirimannya - bukan untuk konfirmasi loading.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runScan()}
                placeholder="HU-202610-00001"
                className="flex-1 px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={runScan}
                disabled={scanLoading}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
              >
                <MagnifyingGlassIcon className="h-4 w-4" />
                {scanLoading ? 'Mencari...' : 'Cari'}
              </button>
            </div>

            {scanError && <div className="text-sm text-red-600 dark:text-red-400 mt-3">{scanError}</div>}

            {scanResult && (
              <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-medium text-gray-900 dark:text-white">{scanResult.hu_number}</span>
                  {scanResult.fill_percent !== null && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      scanResult.is_full_pallet
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    }`}>
                      {scanResult.is_full_pallet ? 'Full Pallet' : `${scanResult.fill_percent}% dari pallet standar`}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-900 dark:text-white">
                  {scanResult.product_code} - {scanResult.product_name}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Quantity: {scanResult.quantity} {scanResult.uom}
                </div>
                {scanResult.notes && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Catatan: {scanResult.notes}</div>
                )}
                {scanResult.shipping_order && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300">
                    <div>
                      Surat Jalan:{' '}
                      <Link
                        to={`/app/shipping/orders/${scanResult.shipping_order.id}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        {scanResult.shipping_order.shipping_number}
                      </Link>
                      {' '}({scanResult.shipping_order.status})
                    </div>
                    <div>Customer: {scanResult.shipping_order.customer_name}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tracking History */}
          {order.tracking_history && order.tracking_history.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Tracking History</h3>
              
              <div className="space-y-4">
                {order.tracking_history.map((event, index) => (
                  <div key={event.id} className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className={`w-3 h-3 rounded-full ${
                        index === 0 ? 'bg-blue-500' : 'bg-gray-300'
                      }`}></div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          {event.status.replace('_', ' ').toUpperCase()}
                        </h4>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(event.event_date).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {event.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </span>
                        <span>Updated by {event.updated_by}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Customer Information</h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-gray-400" />
                <span className="text-gray-900 dark:text-white">{order.customer_name}</span>
              </div>
              
            </div>
          </div>

          {/* Shipping Costs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Shipping Costs</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Shipping Cost</span>
                <span className="text-gray-900 dark:text-white">{formatCurrency(order.shipping_cost)}</span>
              </div>
              
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="flex justify-between font-medium">
                  <span className="text-gray-900 dark:text-white">{t('products.bom.total_cost')}</span>
                  <span className="text-gray-900 dark:text-white">
                    {formatCurrency(order.shipping_cost)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CubeIcon Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">CubeIcon Information</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Total Weight</span>
                <span className="text-gray-900 dark:text-white">{order.total_weight} kg</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Total Volume</span>
                <span className="text-gray-900 dark:text-white">{order.total_volume} m³</span>
              </div>
            </div>
            
            {order.notes && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Notes</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Quick Actions</h3>
            
            <div className="space-y-2">
              {order.status === 'pending' && (
                <button
                  onClick={() => updateOrderStatus('confirmed')}
                  className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Confirm Order
                </button>
              )}
              
              {order.status === 'confirmed' && (
                <button
                  onClick={() => updateOrderStatus('in_transit')}
                  className="w-full px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                >
                  Mark In Transit
                </button>
              )}
              
              {order.status === 'in_transit' && (
                <button
                  onClick={() => updateOrderStatus('delivered')}
                  className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  Mark Delivered
                </button>
              )}
              
              {['pending', 'confirmed'].includes(order.status) && (
                <button
                  onClick={() => updateOrderStatus('cancelled')}
                  className="w-full px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Cancel Order
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShippingOrderDetails;
