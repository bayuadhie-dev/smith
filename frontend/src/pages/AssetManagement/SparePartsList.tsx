import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  WrenchScrewdriverIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface SparePart {
  id: number;
  part_number: string;
  part_name: string;
  category: string;
  current_stock: number;
  min_stock: number;
  reorder_point: number;
  uom: string;
  unit_cost: number;
  needs_reorder: boolean;
}

const SparePartsList: React.FC = () => {
  const [parts, setParts] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchParts();
  }, [showLowStockOnly]);

  const fetchParts = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (showLowStockOnly) params.low_stock = 'true';
      
      const res = await axiosInstance.get('/api/assets/spare-parts', { params });
      setParts(res.data.spare_parts || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const filteredParts = parts.filter(part =>
    part.part_number.toLowerCase().includes(search.toLowerCase()) ||
    part.part_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
          <WrenchScrewdriverIcon className="h-8 w-8 text-orange-600" />
          Inventaris Suku Cadang (MRO)
        </h1>
        <p className="text-slate-500 dark:text-gray-400 mt-1">
          Maintenance, Repair, and Operations Parts
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari part number atau nama..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors">
            <input
              type="checkbox"
              checked={showLowStockOnly}
              onChange={(e) => setShowLowStockOnly(e.target.checked)}
              className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
            />
            <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />
            <span className="text-sm font-medium text-slate-700 dark:text-gray-300">
              Stok Rendah Saja
            </span>
          </label>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400">Total Items</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{parts.length}</p>
            </div>
            <WrenchScrewdriverIcon className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400">Perlu Reorder</p>
              <p className="text-2xl font-bold text-orange-600">
                {parts.filter(p => p.needs_reorder).length}
              </p>
            </div>
            <ExclamationTriangleIcon className="h-8 w-8 text-orange-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400">Stok Aman</p>
              <p className="text-2xl font-bold text-green-600">
                {parts.filter(p => !p.needs_reorder).length}
              </p>
            </div>
            <CheckCircleIcon className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredParts.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-gray-400">
            Tidak ada data spare parts
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-gray-700/50 border-b border-slate-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Part Number</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Nama Part</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Kategori</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Stok</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Min/Reorder</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Harga Satuan</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
                {filteredParts.map((part) => (
                  <tr 
                    key={part.id} 
                    className={`hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors ${
                      part.needs_reorder ? 'bg-orange-50 dark:bg-orange-900/10' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 dark:text-white">{part.part_number}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 dark:text-white">{part.part_name}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-gray-300">
                      {part.category || '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${
                        part.needs_reorder 
                          ? 'text-orange-600 dark:text-orange-400' 
                          : 'text-slate-800 dark:text-white'
                      }`}>
                        {part.current_stock} {part.uom}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-gray-300">
                      {part.min_stock} / {part.reorder_point}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800 dark:text-white">
                      {formatCurrency(part.unit_cost)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {part.needs_reorder ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                          <ExclamationTriangleIcon className="h-3 w-3" />
                          Reorder
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircleIcon className="h-3 w-3" />
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SparePartsList;
