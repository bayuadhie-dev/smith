import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import {
  BuildingStorefrontIcon,
  CubeIcon,
  ArrowsRightLeftIcon,
  ClipboardDocumentListIcon,
  TruckIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  DocumentMagnifyingGlassIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline';

interface DashboardData {
  inventory: { total_items: number; total_quantity: number };
  zones: Array<{
    name: string;
    material_type: string;
    location_count: number;
    total_capacity: number;
    total_occupied: number;
    utilization: number;
  }>;
  alerts: { low_stock: number; pending_transfers: number; active_picks: number };
  today: { transactions: number };
  material_consumption: { total_tracked: number; over_consumed: number };
  wip: { products: number; total_cartons: number };
}

const WMSDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await axiosInstance.get('/api/wms/dashboard');
      setData(res.data);
    } catch (err: any) {
      toast.error('Gagal memuat dashboard WMS');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const kpiCards = [
    {
      title: 'Total Item Inventori',
      value: data?.inventory.total_items?.toLocaleString() || '0',
      subtitle: `${data?.inventory.total_quantity?.toLocaleString() || '0'} total qty`,
      icon: CubeIcon,
      color: 'bg-blue-500',
      link: '/app/warehouse/inventory',
    },
    {
      title: 'Transaksi Hari Ini',
      value: data?.today.transactions?.toString() || '0',
      subtitle: 'inventory transactions',
      icon: ArrowsRightLeftIcon,
      color: 'bg-green-500',
      link: '/app/wms/transactions',
    },
    {
      title: 'WIP Aktif',
      value: `${data?.wip.products || 0} produk`,
      subtitle: `${data?.wip.total_cartons?.toLocaleString() || '0'} karton`,
      icon: ArchiveBoxIcon,
      color: 'bg-purple-500',
      link: '/app/wms/stock-by-wo',
    },
    {
      title: 'Peringatan Stok',
      value: data?.alerts.low_stock?.toString() || '0',
      subtitle: 'item di bawah minimum',
      icon: ExclamationTriangleIcon,
      color: data?.alerts.low_stock && data.alerts.low_stock > 0 ? 'bg-red-500' : 'bg-gray-400',
      link: '/app/warehouse/alerts',
    },
  ];

  const quickActions = [
    { name: 'Stok per WO', icon: DocumentMagnifyingGlassIcon, href: '/app/wms/stock-by-wo', desc: 'Lihat stok berdasarkan Work Order' },
    { name: 'Konsumsi Material', icon: CubeIcon, href: '/app/wms/material-consumption', desc: 'Tracking pemakaian bahan baku' },
    { name: 'Transaksi Stok', icon: ArrowsRightLeftIcon, href: '/app/wms/transactions', desc: 'Log transaksi inventori' },
    { name: 'Pick List', icon: ClipboardDocumentListIcon, href: '/app/wms/pick-lists', desc: 'Daftar pengambilan barang' },
    { name: 'Transfer Stok', icon: TruckIcon, href: '/app/wms/transfers', desc: 'Pemindahan antar lokasi' },
    { name: 'Cycle Count', icon: ChartBarIcon, href: '/app/wms/cycle-counts', desc: 'Jadwal stock opname berkala' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BuildingStorefrontIcon className="h-8 w-8 text-blue-600" />
            WMS Advanced Dashboard
          </h1>
          <p className="text-gray-500 mt-1">Warehouse Management System — Terintegrasi penuh dengan Produksi & Material</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <div
            key={card.title}
            onClick={() => navigate(card.link)}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                <p className="text-xs text-gray-400 mt-1">{card.subtitle}</p>
              </div>
              <div className={`p-3 rounded-lg ${card.color}`}>
                <card.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Alert Badges */}
      {(data?.alerts.pending_transfers || data?.alerts.active_picks) ? (
        <div className="flex gap-3">
          {data?.alerts.pending_transfers ? (
            <span
              onClick={() => navigate('/app/wms/transfers')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 cursor-pointer hover:bg-yellow-200"
            >
              <TruckIcon className="h-4 w-4" />
              {data.alerts.pending_transfers} Transfer Menunggu
            </span>
          ) : null}
          {data?.alerts.active_picks ? (
            <span
              onClick={() => navigate('/app/wms/pick-lists')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200"
            >
              <ClipboardDocumentListIcon className="h-4 w-4" />
              {data.alerts.active_picks} Pick List Aktif
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Zone Utilization */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Utilisasi Zone Gudang</h3>
          {data?.zones && data.zones.length > 0 ? (
            <div className="space-y-4">
              {data.zones.map((zone, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="font-medium text-gray-700">{zone.name}</span>
                      <span className="ml-2 text-xs text-gray-400 capitalize">{zone.material_type?.replace('_', ' ')}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {zone.total_occupied.toLocaleString()} / {zone.total_capacity.toLocaleString()} · {zone.location_count} lokasi
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        zone.utilization > 90 ? 'bg-red-500' :
                        zone.utilization > 70 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(zone.utilization, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{zone.utilization}% terpakai</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">Belum ada zona gudang</p>
          )}
        </div>

        {/* Material Consumption Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Konsumsi Material</h3>
          <div className="space-y-4">
            <div className="text-center py-4">
              <p className="text-3xl font-bold text-gray-900">{data?.material_consumption.total_tracked || 0}</p>
              <p className="text-sm text-gray-500">Material Terlacak</p>
            </div>
            {data?.material_consumption.over_consumed ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-red-700">{data.material_consumption.over_consumed}</p>
                <p className="text-xs text-red-500">Over-consumed (melebihi rencana)</p>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-sm text-green-700 font-medium">Semua dalam batas normal</p>
              </div>
            )}
            <button
              onClick={() => navigate('/app/wms/material-consumption')}
              className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium py-2"
            >
              Lihat Detail →
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Menu WMS</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <div
              key={action.name}
              onClick={() => navigate(action.href)}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 group-hover:bg-blue-100 transition-colors">
                  <action.icon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{action.name}</p>
                  <p className="text-sm text-gray-500">{action.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WMSDashboard;
