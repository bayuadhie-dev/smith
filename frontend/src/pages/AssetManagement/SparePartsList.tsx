import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import { KpiStrip, PageHeader } from '../../components/ui/PageKit';
import {
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  WrenchScrewdriverIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { useUrlFilter } from '../../hooks/useUrlState'

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
  const [search, setSearch] = useUrlFilter<string>('cari', '')

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
    <div className="mx-auto max-w-6xl space-y-4 pb-10">
      <PageHeader
        eyebrow="ASET · SUKU CADANG"
        title="Suku Cadang"
        subtitle="Persediaan suku cadang dan bahan perawatan mesin."
      />

      <KpiStrip
        items={[
          { label: 'Jenis suku cadang', value: parts.length.toLocaleString('id-ID'), hint: 'Terdaftar di master' },
          {
            label: 'Perlu dipesan ulang',
            value: parts.filter((p) => p.needs_reorder).length.toLocaleString('id-ID'),
            tone: parts.some((p) => p.needs_reorder) ? 'warn' : undefined,
            hint: 'Stok di bawah titik pesan ulang',
          },
          {
            label: 'Stok aman',
            value: parts.filter((p) => !p.needs_reorder).length.toLocaleString('id-ID'),
            hint: 'Masih di atas ambang',
          },
        ]}
      />

      <div className="fn-card flex flex-col gap-3 p-4 md:flex-row">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nomor part atau namanya..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">
          <input
            type="checkbox"
            checked={showLowStockOnly}
            onChange={(e) => setShowLowStockOnly(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
          />
          <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Hanya yang stoknya menipis</span>
        </label>
      </div>

      {/* Table */}
      <div className="fn-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredParts.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-gray-400">
            Tidak ada suku cadang yang cocok dengan pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-gray-700/50 border-b border-slate-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Nomor part</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Nama part</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Kategori</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Stok</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Min / titik pesan</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-gray-400 uppercase">Harga satuan</th>
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
                          Pesan ulang
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircleIcon className="h-3 w-3" />
                          Aman
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
