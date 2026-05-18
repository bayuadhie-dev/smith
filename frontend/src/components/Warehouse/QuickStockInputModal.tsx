import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  CubeIcon
} from '@heroicons/react/24/outline';
import SearchableSelect from '../SearchableSelect';
import axiosInstance from '../../utils/axiosConfig';

interface Location {
  id: number;
  location_code: string;
  name: string;
  zone_name: string;
  capacity: number;
  occupied: number;
  available: number;
}

interface Material {
  id: number;
  code: string;
  name: string;
  primary_uom: string;
  category: string;
}

interface QuickStockInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: Material;
  onSuccess: () => void;
}

const QuickStockInputModal: React.FC<QuickStockInputModalProps> = ({
  isOpen,
  onClose,
  material,
  onSuccess
}) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    quantity: '',
    location_id: null as number | null,
    batch_number: '',
    expiry_date: '',
    notes: ''
  });

  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchLocations();
      // Reset form
      setFormData({
        quantity: '',
        location_id: null,
        batch_number: '',
        expiry_date: '',
        notes: ''
      });
      setError(null);
      setSuccess(false);
      setSelectedLocation(null);
    }
  }, [isOpen]);

  const fetchLocations = async () => {
    try {
      setLoadingLocations(true);
      const response = await axiosInstance.get('/api/warehouse/locations', {
        params: {
          available_only: true,
          per_page: 1000
        }
      });
      setLocations(response.data.locations || []);
    } catch (err) {
      console.error('Failed to fetch locations:', err);
      setError('Failed to load locations');
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleLocationChange = (locationId: number | null) => {
    setFormData({ ...formData, location_id: locationId });
    const location = locations.find(loc => loc.id === locationId);
    setSelectedLocation(location || null);
  };

  const validateForm = () => {
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      setError('Quantity must be greater than 0');
      return false;
    }
    if (!formData.location_id) {
      setError('Please select a location');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const payload = {
        material_id: material.id,
        quantity: parseFloat(formData.quantity),
        location_id: formData.location_id,
        batch_number: formData.batch_number || '',
        expiry_date: formData.expiry_date || null,
        notes: formData.notes || `Quick add stock for ${material.name}`
      };

      const response = await axiosInstance.post('/api/warehouse/stock-input/quick-add', payload);

      if (response.status === 201) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      console.error('Failed to add stock:', err);
      setError(err.response?.data?.message || 'Failed to add stock. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        ></div>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <CubeIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Quick Add Stock
                  </h3>
                  <p className="text-sm text-blue-100">
                    {material.name}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="px-6 py-4">
            {/* Material Info */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Code:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">{material.code}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">UOM:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">{material.primary_uom}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600 dark:text-gray-400">Category:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">{material.category}</span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start">
                <ExclamationCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start">
                <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800 dark:text-green-200">Stock added successfully!</p>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter quantity"
                    required
                    disabled={loading || success}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 dark:text-gray-400 text-sm">{material.primary_uom}</span>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Location <span className="text-red-500">*</span>
                </label>
                {loadingLocations ? (
                  <div className="flex items-center justify-center py-2 text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                    Loading locations...
                  </div>
                ) : (
                  <>
                    <SearchableSelect
                      options={locations.map(loc => ({
                        id: loc.id,
                        name: loc.name,
                        code: loc.location_code,
                        label: `${loc.zone_name} - ${loc.name} (${loc.location_code})`
                      }))}
                      value={formData.location_id}
                      onChange={handleLocationChange}
                      placeholder="Select warehouse location"
                      disabled={loading || success}
                    />
                    {selectedLocation && (
                      <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Capacity:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {selectedLocation.occupied.toFixed(2)} / {selectedLocation.capacity.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-gray-600 dark:text-gray-400">Available:</span>
                          <span className="font-medium text-green-600 dark:text-green-400">
                            {selectedLocation.available.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Batch Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Batch Number
                </label>
                <input
                  type="text"
                  value={formData.batch_number}
                  onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Optional batch number"
                  disabled={loading || success}
                />
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Expiry Date
                </label>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={loading || success}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Optional notes..."
                  disabled={loading || success}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={loading || success}
              >
                {success ? 'Close' : 'Cancel'}
              </button>
              {!success && (
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="h-4 w-4" />
                      <span>Add Stock</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default QuickStockInputModal;
