import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import { ArrowLeftIcon, CheckIcon } from '@heroicons/react/24/outline';

interface FormData {
  asset_name: string;
  asset_type: string;
  category: string;
  subcategory: string;
  description: string;
  status: string;
  purchase_date: string;
  purchase_cost: string;
  supplier_id: string;
  location: string;
  department_id: string;
  depreciation_method: string;
  useful_life_years: string;
  salvage_value: string;
  is_production_machine: boolean;
  machine_code: string;
  capacity: string;
  speed: string;
}

const AssetForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [formData, setFormData] = useState<FormData>({
    asset_name: '',
    asset_type: 'machinery',
    category: '',
    subcategory: '',
    description: '',
    status: 'planning',
    purchase_date: '',
    purchase_cost: '',
    supplier_id: '',
    location: '',
    department_id: '',
    depreciation_method: 'straight_line',
    useful_life_years: '',
    salvage_value: '0',
    is_production_machine: false,
    machine_code: '',
    capacity: '',
    speed: ''
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) {
      fetchAsset();
    }
  }, [id]);

  const fetchAsset = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/api/assets/${id}`);
      const asset = res.data.asset;
      setFormData({
        asset_name: asset.asset_name || '',
        asset_type: asset.asset_type || 'machinery',
        category: asset.category || '',
        subcategory: asset.subcategory || '',
        description: asset.description || '',
        status: asset.status || 'planning',
        purchase_date: asset.purchase_date ? asset.purchase_date.split('T')[0] : '',
        purchase_cost: asset.purchase_cost?.toString() || '',
        supplier_id: asset.supplier_id?.toString() || '',
        location: asset.location || '',
        department_id: asset.department_id?.toString() || '',
        depreciation_method: asset.depreciation_method || 'straight_line',
        useful_life_years: asset.useful_life_years?.toString() || '',
        salvage_value: asset.salvage_value?.toString() || '0',
        is_production_machine: asset.is_production_machine || false,
        machine_code: asset.machine_code || '',
        capacity: asset.capacity?.toString() || '',
        speed: asset.speed?.toString() || ''
      });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      const payload = {
        ...formData,
        purchase_cost: parseFloat(formData.purchase_cost) || 0,
        useful_life_years: parseInt(formData.useful_life_years) || 0,
        salvage_value: parseFloat(formData.salvage_value) || 0,
        capacity: formData.capacity ? parseFloat(formData.capacity) : null,
        speed: formData.speed ? parseInt(formData.speed) : null,
        supplier_id: formData.supplier_id ? parseInt(formData.supplier_id) : null,
        department_id: formData.department_id ? parseInt(formData.department_id) : null
      };

      if (isEdit) {
        await axiosInstance.put(`/api/assets/${id}`, payload);
        toast.success('Aset berhasil diupdate');
      } else {
        const res = await axiosInstance.post('/api/assets', payload);
        toast.success('Aset berhasil dibuat');
        navigate(`/app/assets/${res.data.asset_id}`);
        return;
      }
      
      navigate(`/app/assets/${id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate(isEdit ? `/app/assets/${id}` : '/app/assets/list')}
          className="p-2 hover:bg-slate-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5 text-slate-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">
            {isEdit ? 'Edit Aset' : 'Tambah Aset Baru'}
          </h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1">
            {isEdit ? 'Update informasi aset' : 'Daftarkan aset baru ke sistem'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl">
        {/* Basic Information */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Informasi Dasar</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                Nama Aset <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="asset_name"
                value={formData.asset_name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                Tipe Aset <span className="text-red-500">*</span>
              </label>
              <select
                name="asset_type"
                value={formData.asset_type}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="machinery">Machinery</option>
                <option value="building">Building</option>
                <option value="vehicle">Vehicle</option>
                <option value="IT_equipment">IT Equipment</option>
                <option value="furniture">Furniture</option>
                <option value="land">Land</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="planning">Planning</option>
                <option value="procured">Procured</option>
                <option value="installed">Installed</option>
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="idle">Idle</option>
                <option value="retired">Retired</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                Kategori
              </label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                Lokasi
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                Deskripsi
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Procurement */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Pengadaan</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                Tanggal Pembelian <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="purchase_date"
                value={formData.purchase_date}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                Harga Perolehan <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="purchase_cost"
                value={formData.purchase_cost}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Depreciation */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Penyusutan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                Metode Penyusutan
              </label>
              <select
                name="depreciation_method"
                value={formData.depreciation_method}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="straight_line">Straight Line</option>
                <option value="declining_balance">Declining Balance</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                Masa Manfaat (Tahun) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="useful_life_years"
                value={formData.useful_life_years}
                onChange={handleChange}
                required
                min="1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                Nilai Sisa (Salvage)
              </label>
              <input
                type="number"
                name="salvage_value"
                value={formData.salvage_value}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Production Machine */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              name="is_production_machine"
              checked={formData.is_production_machine}
              onChange={handleChange}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              Mesin Produksi
            </h2>
          </div>
          
          {formData.is_production_machine && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Kode Mesin
                </label>
                <input
                  type="text"
                  name="machine_code"
                  value={formData.machine_code}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Kapasitas
                </label>
                <input
                  type="number"
                  name="capacity"
                  value={formData.capacity}
                  onChange={handleChange}
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Kecepatan (pcs/jam)
                </label>
                <input
                  type="number"
                  name="speed"
                  value={formData.speed}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Menyimpan...
              </>
            ) : (
              <>
                <CheckIcon className="h-5 w-5" />
                {isEdit ? 'Update Aset' : 'Simpan Aset'}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate(isEdit ? `/app/assets/${id}` : '/app/assets/list')}
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
          >
            Batal
          </button>
        </div>
      </form>
    </div>
  );
};

export default AssetForm;
