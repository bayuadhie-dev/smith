import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import axiosInstance from '../../utils/axiosConfig';
import { CategoryBars, KpiStrip, PageHeader, Panel, QuickLinks } from '../../components/ui/PageKit';
import {
  ArrowTrendingUpIcon,
  CubeIcon,
  ArrowRightIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
interface DashboardData {
  summary: {
    total_materials: number;
    active_materials: number;
    materials_with_stock: number;
    total_inventory_value: number;
  };
  by_type: Array<{
    type: string;
    count: number;
    label: string;
  }>;
  recent_movements: Array<{
    id: number;
    movement_type: string;
    quantity: number;
    reference_number: string;
    created_at: string;
  }>;
}

/** Nama jenis material dalam Bahasa Indonesia. */
const NAMA_JENIS: Record<string, string> = {
  'raw materials': 'Bahan baku',
  'packaging materials': 'Bahan kemas',
  'chemical materials': 'Bahan kimia',
  'finished goods': 'Barang jadi',
  'wip': 'Barang setengah jadi',
  'non inventory': 'Non-persediaan',
  'consumables': 'Barang habis pakai',
  'spare parts': 'Suku cadang',
};

/**
 * Satu jenis bisa tersimpan dengan dua ejaan ("Raw Materials" dan
 * "Raw_Materials") sehingga dulu muncul sebagai dua batang terpisah.
 * Kuncinya dinormalkan dulu, lalu jumlahnya digabung.
 */
function jenisMaterial(rows: Array<{ type: string; count: number; label?: string }>) {
  const map = new Map<string, { label: string; value: number }>();
  rows.forEach((r) => {
    const kunci = (r.type || r.label || '').toString().replace(/_/g, ' ').trim().toLowerCase();
    const label = NAMA_JENIS[kunci] || (kunci ? kunci.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Tanpa jenis');
    const ada = map.get(label);
    if (ada) ada.value += r.count;
    else map.set(label, { label, value: r.count });
  });
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

const MaterialsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/api/materials/dashboard');
      setDashboardData(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching dashboard data:', err);
      // 2026-10-07: this used to fall back to a fake "1 count each" by_type
      // breakdown (Raw/Packaging/Consumables) on any API error - a chart
      // showing fake data would look like a real-but-tiny inventory
      // instead of an honest error state. Empty/zeroed instead.
      setDashboardData({
        summary: {
          total_materials: 0,
          active_materials: 0,
          materials_with_stock: 0,
          total_inventory_value: 0
        },
        by_type: [],
        recent_movements: []
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);


  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'stock_in':
        return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
      case 'stock_out':
        return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
      case 'transfer':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
      case 'adjustment':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getMovementTypeLabel = (type: string) => {
    // Kunci yang benar-benar ditulis sistem, bukan cuma empat yang dulu
    // ditebak - sisanya tampil sebagai kode mentah seperti "adjust".
    const nama: Record<string, string> = {
      stock_in: 'Stok masuk', stock_out: 'Stok keluar',
      transfer: 'Pemindahan', transfer_in: 'Terima pemindahan', transfer_out: 'Kirim pemindahan',
      adjustment: 'Penyesuaian', adjust: 'Penyesuaian',
      goods_receipt: 'Penerimaan', receive: 'Penerimaan',
      material_issue: 'Permintaan barang', issue: 'Pengeluaran',
      production_output: 'Hasil produksi', production_consumption: 'Pemakaian produksi',
      qc_disposition: 'Keputusan QC', qc_disposition_out: 'Keputusan QC',
    };
    return nama[type] || type;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/20 dark:border-red-800">
        <p className="text-red-800 dark:text-red-300">{error || 'Failed to load dashboard data'}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <PageHeader
        eyebrow="GUDANG · BARANG & MATERIAL"
        title="Dashboard Barang & Material"
        subtitle="Ringkasan master material dan pergerakannya"
        actions={
          <button onClick={() => navigate('/app/warehouse/materials/list')} className="btn-primary">
            <EyeIcon className="h-4 w-4" />
            Lihat semua material
          </button>
        }
      />

      <KpiStrip
        items={[
          { label: 'Total material', value: dashboardData.summary.total_materials.toLocaleString('id-ID'), hint: 'di master barang' },
          { label: 'Material aktif', value: dashboardData.summary.active_materials.toLocaleString('id-ID'), hint: 'masih dipakai' },
          { label: 'Punya stok', value: dashboardData.summary.materials_with_stock.toLocaleString('id-ID'), hint: 'ada isinya di gudang' },
          { label: 'Nilai persediaan', value: `Rp ${dashboardData.summary.total_inventory_value.toLocaleString('id-ID')}`, hint: 'jumlah stok x harga master' },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Dulu halaman ini menggambar data yang sama dua kali - donat dan
            batang bersebelahan. Satu daftar batang sudah cukup, dan angkanya
            terbaca langsung. */}
        <Panel title="Material menurut jenis">
          <div className="p-4">
            {(dashboardData.by_type || []).length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada data.</p>
            ) : (
              <CategoryBars items={jenisMaterial(dashboardData.by_type || [])} unit="material" />
            )}
          </div>
        </Panel>

        <Panel
          title="Mutasi material terbaru"
          action={<button onClick={() => navigate('/app/warehouse/movements')} className="fn-label hover:underline">Lihat semua</button>}
        >
          {dashboardData.recent_movements.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Belum ada mutasi material.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200/70 dark:divide-gray-700/70">
              {dashboardData.recent_movements.map((movement) => (
                <li key={movement.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${getMovementTypeColor(movement.movement_type)}`}>
                      {getMovementTypeLabel(movement.movement_type)}
                    </span>
                    <div className="min-w-0">
                      <p className="fn-num truncate text-sm font-medium text-gray-900 dark:text-white">
                        {movement.reference_number || '-'}
                      </p>
                      <p className="fn-label truncate">{movement.quantity.toLocaleString('id-ID')} satuan</p>
                    </div>
                  </div>
                  <span className="fn-label shrink-0">
                    {new Date(movement.created_at).toLocaleDateString('id-ID')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <QuickLinks
        title="Pintasan"
        links={[
          { to: '/app/warehouse/materials/new', label: 'Material baru' },
          { to: '/app/warehouse/stock-input', label: 'Input stok material' },
          { to: '/app/warehouse/materials/list?filter=low_stock', label: 'Material di bawah minimum' },
          { to: '/app/warehouse/movements', label: 'Mutasi stok' },
          { to: '/app/warehouse/uom', label: 'Satuan barang' },
          { to: '/app/warehouse/inventory', label: 'Penambahan bahan baku' },
        ]}
      />
    </div>
  );
};

export default MaterialsDashboard;
