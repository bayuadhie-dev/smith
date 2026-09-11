import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import axiosInstance from '../../utils/axiosConfig';
import {
  CalendarIcon as Calendar,
  CheckCircleIcon as CheckCircle,
  CheckIcon as Save,
  CubeIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon as AlertTriangle,
  HashtagIcon as Hash,
  MapPinIcon as MapPin,
  TruckIcon as Truck
,
  UserIcon as User,
  XCircleIcon as XCircle,
  XMarkIcon as X
} from '@heroicons/react/24/outline';
interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_name?: string;
  supplier?: {
    id?: number;
    company_name: string;
  };
  items?: POItem[];
}

interface POItem {
  id: number;
  line_number: number;
  product?: {
    id: number;
    name: string;
    code: string;
  };
  description: string;
  quantity: number;
  uom: string;
  quantity_received?: number;
}

interface Location {
  id: number;
  location_code: string;
  zone: {
    name: string;
  };
}

interface GRNItem {
  po_item_id: number;
  product_id: number | null;
  quantity_ordered: number;
  quantity_received: number;
  quantity_accepted: number;
  quantity_rejected: number;
  uom: string;
  batch_number: string;
  lot_number: string;
  production_date: string;
  expiry_date: string;
  location_id: number | null;
  notes: string;
}

interface GRNFormData {
  po_id: number;
  supplier_id: number | null;
  receipt_date: string;
  delivery_note_number: string;
  vehicle_number: string;
  driver_name: string;
  notes: string;
  items: GRNItem[];
}

const GRNForm: React.FC = () => {
  const { t } = useLanguage();

  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const prefillPoId = searchParams.get('po_id');
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState<GRNFormData>({
    po_id: prefillPoId ? Number(prefillPoId) : 0,
    supplier_id: null,
    receipt_date: new Date().toISOString().split('T')[0],
    delivery_note_number: '',
    vehicle_number: '',
    driver_name: '',
    notes: '',
    items: []
  });

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPurchaseOrders();
    fetchLocations();
    if (isEdit) {
      fetchGRN();
    }
  }, [id]);

  useEffect(() => {
    if (formData.po_id && !isEdit) {
      fetchPODetail(formData.po_id);
    }
  }, [formData.po_id, isEdit]);

  const fetchPODetail = async (poId: number) => {
    try {
      const response = await axiosInstance.get(`/api/purchasing/purchase-orders/${poId}`);
      const po = response.data;
      setSelectedPO(po);
      // Initialize items from PO
      const grnItems: GRNItem[] = (po.items || []).map((item: any) => ({
        po_item_id: item.id,
        product_id: item.product_id ?? item.product?.id ?? null,
        quantity_ordered: item.quantity,
        quantity_received: 0,
        quantity_accepted: 0,
        quantity_rejected: 0,
        uom: item.uom || 'PCS',
        batch_number: '',
        lot_number: '',
        production_date: '',
        expiry_date: '',
        location_id: null,
        notes: ''
      }));
      setFormData(prev => ({ ...prev, supplier_id: po.supplier?.id ?? null, items: grnItems }));
    } catch (error) {
      console.error('Failed to fetch PO detail:', error);
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      const response = await axiosInstance.get('/api/purchasing/purchase-orders?status=approved,partial');
      setPurchaseOrders(response.data.purchase_orders || []);
    } catch (error) {
      console.error('Failed to fetch purchase orders:', error);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await axiosInstance.get('/api/warehouse/locations');
      setLocations(response.data.locations || []);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  };

  const fetchGRN = async () => {
    try {
      const response = await axiosInstance.get(`/api/purchasing/grn/${id}`);
      const data = response.data;
      setFormData({
        po_id: data.po_id,
        supplier_id: data.supplier_id ?? null,
        receipt_date: data.receipt_date.split('T')[0],
        delivery_note_number: data.delivery_note_number || '',
        vehicle_number: data.vehicle_number || '',
        driver_name: data.driver_name || '',
        notes: data.notes || '',
        items: (data.items || []).map((item: any) => ({
          po_item_id: item.po_item_id,
          product_id: item.product_id ?? null,
          quantity_ordered: item.quantity_ordered,
          quantity_received: item.quantity_received,
          quantity_accepted: item.quantity_accepted,
          quantity_rejected: item.quantity_rejected,
          uom: item.uom,
          batch_number: item.batch_number || '',
          lot_number: item.lot_number || '',
          production_date: item.production_date ? item.production_date.split('T')[0] : '',
          expiry_date: item.expiry_date ? item.expiry_date.split('T')[0] : '',
          location_id: item.location_id ?? null,
          notes: item.notes || ''
        }))
      });
      // Also fetch the PO detail so the items section renders with product names
      if (data.po_id) {
        try {
          const poResponse = await axiosInstance.get(`/api/purchasing/purchase-orders/${data.po_id}`);
          setSelectedPO(poResponse.data);
        } catch (poError) {
          console.error('Failed to fetch PO detail for GRN edit:', poError);
        }
      }
    } catch (error) {
      console.error('Failed to fetch GRN:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (!formData.po_id) {
      setError('Please select a purchase order');
      setLoading(false);
      return;
    }

    const hasInvalidItems = formData.items.some(item => 
      item.quantity_received < 0 || 
      item.quantity_accepted < 0 || 
      item.quantity_rejected < 0 ||
      (item.quantity_accepted + item.quantity_rejected) > item.quantity_received
    );

    if (hasInvalidItems) {
      setError('Invalid quantities. Accepted + Rejected cannot exceed Received quantity');
      setLoading(false);
      return;
    }

    if (!isEdit && !formData.supplier_id) {
      setError('Selected purchase order has no supplier information');
      setLoading(false);
      return;
    }

    try {
      if (isEdit) {
        await axiosInstance.put(`/api/purchasing/grn/${id}`, formData);
      } else {
        await axiosInstance.post('/api/purchasing/grn', formData);
      }
      navigate('/app/purchasing/grn');
    } catch (error: any) {
      setError(error?.response?.data?.error || error?.response?.data?.message || 'Failed to save GRN');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'po_id' ? Number(value) : value
    }));
  };

  const handleItemChange = (index: number, field: keyof GRNItem, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i === index) {
          const updatedItem = {
            ...item,
            [field]: ['quantity_ordered', 'quantity_received', 'quantity_accepted', 'quantity_rejected', 'product_id', 'location_id'].includes(field)
              ? (value === '' ? (field.includes('_id') ? null : 0) : Number(value))
              : value
          };

          // Auto-calculate accepted quantity when received quantity changes
          if (field === 'quantity_received') {
            updatedItem.quantity_accepted = Number(value);
            updatedItem.quantity_rejected = 0;
          }

          return updatedItem;
        }
        return item;
      })
    }));
  };

  const getTotalReceived = () => {
    return formData.items.reduce((sum, item) => sum + (item.quantity_received || 0), 0);
  };

  const getTotalAccepted = () => {
    return formData.items.reduce((sum, item) => sum + (item.quantity_accepted || 0), 0);
  };

  const getTotalRejected = () => {
    return formData.items.reduce((sum, item) => sum + (item.quantity_rejected || 0), 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Goods Receipt Note' : 'New Goods Receipt Note'}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {isEdit ? 'Update GRN details and received quantities' : 'Record receipt of goods from supplier'}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <ExclamationCircleIcon className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}

          {/* GRN Header Information */}
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Receipt Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  <CubeIcon className="inline h-4 w-4 mr-1" />
                  Purchase Order *
                </label>
                <select
                  name="po_id"
                  value={formData.po_id}
                  onChange={handleInputChange}
                  required
                  disabled={isEdit || Boolean(prefillPoId)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:bg-gray-800"
                >
                  <option value="">Select Purchase Order</option>
                  {purchaseOrders.map(po => (
                    <option key={po.id} value={po.id}>
                      {po.po_number} - {po.supplier.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Receipt Date *
                </label>
                <input
                  type="date"
                  name="receipt_date"
                  value={formData.receipt_date}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  <DocumentTextIcon className="inline h-4 w-4 mr-1" />
                  Delivery Note Number
                </label>
                <input
                  type="text"
                  name="delivery_note_number"
                  value={formData.delivery_note_number}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter delivery note number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  <Truck className="inline h-4 w-4 mr-1" />
                  Vehicle Number
                </label>
                <input
                  type="text"
                  name="vehicle_number"
                  value={formData.vehicle_number}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter vehicle number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  <User className="inline h-4 w-4 mr-1" />
                  Driver Name
                </label>
                <input
                  type="text"
                  name="driver_name"
                  value={formData.driver_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter driver name"
                />
              </div>
            </div>
          </div>

          {/* GRN Items */}
          {selectedPO && formData.items.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                Received Items
              </h3>

              <div className="space-y-4">
                {formData.items.map((item, index) => {
                  const poItem = selectedPO.items.find(pi => pi.id === item.po_item_id);
                  const isPartialReceived = item.quantity_received > 0 && item.quantity_received < item.quantity_ordered;
                  const isFullyReceived = item.quantity_received >= item.quantity_ordered;
                  const hasRejected = item.quantity_rejected > 0;

                  return (
                    <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            <Hash className="inline h-4 w-4 mr-1" />
                            Line {poItem?.line_number} - {poItem?.product?.name || poItem?.description}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Ordered: {item.quantity_ordered} {item.uom}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isFullyReceived && <CheckCircle className="h-5 w-5 text-green-500" />}
                          {isPartialReceived && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                          {hasRejected && <XCircle className="h-5 w-5 text-red-500" />}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                            Quantity Received *
                          </label>
                          <input
                            type="number"
                            value={item.quantity_received}
                            onChange={(e) => handleItemChange(index, 'quantity_received', e.target.value)}
                            required
                            min="0"
                            max={item.quantity_ordered}
                            step="0.01"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                            Quantity Accepted
                          </label>
                          <input
                            type="number"
                            value={item.quantity_accepted}
                            onChange={(e) => handleItemChange(index, 'quantity_accepted', e.target.value)}
                            min="0"
                            max={item.quantity_received}
                            step="0.01"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                            Quantity Rejected
                          </label>
                          <input
                            type="number"
                            value={item.quantity_rejected}
                            onChange={(e) => handleItemChange(index, 'quantity_rejected', e.target.value)}
                            min="0"
                            max={item.quantity_received}
                            step="0.01"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                            Batch Number
                          </label>
                          <input
                            type="text"
                            value={item.batch_number}
                            onChange={(e) => handleItemChange(index, 'batch_number', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter batch number"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('production.production_date')}</label>
                          <input
                            type="date"
                            value={item.production_date}
                            onChange={(e) => handleItemChange(index, 'production_date', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                            Expiry Date
                          </label>
                          <input
                            type="date"
                            value={item.expiry_date}
                            onChange={(e) => handleItemChange(index, 'expiry_date', e.target.value)}
                            min={item.production_date || formData.receipt_date}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                            <MapPin className="inline h-4 w-4 mr-1" />
                            Storage Location
                          </label>
                          <select
                            value={item.location_id || ''}
                            onChange={(e) => handleItemChange(index, 'location_id', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Select Location</option>
                            {locations.map(location => (
                              <option key={location.id} value={location.id}>
                                {location.location_code} - {location.zone?.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                            Item Notes
                          </label>
                          <input
                            type="text"
                            value={item.notes}
                            onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter notes for this item"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-medium text-gray-900 dark:text-white">Total Received</div>
                    <div className="text-blue-600">{getTotalReceived().toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-900 dark:text-white">Total Accepted</div>
                    <div className="text-green-600">{getTotalAccepted().toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-900 dark:text-white">Total Rejected</div>
                    <div className="text-red-600">{getTotalRejected().toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* General Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              <DocumentTextIcon className="inline h-4 w-4 mr-1" />
              General Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter any general notes about the receipt..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => navigate('/app/purchasing/grn')}
              className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              <X className="inline h-4 w-4 mr-2" />{t('common.cancel')}</button>
            <button
              type="submit"
              disabled={loading || !selectedPO}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="inline h-4 w-4 mr-2" />
              {loading ? 'Saving...' : isEdit ? 'Update GRN' : 'Create GRN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GRNForm;
