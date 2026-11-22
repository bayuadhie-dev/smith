import React, { useState, useEffect } from 'react';
import {
  ArrowPathIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CogIcon,
  TruckIcon,
  UsersIcon
} from '@heroicons/react/24/outline';
interface OverviewData {
  type: string;
  timestamp: string;
  production: {
    active_work_orders: number;
    active_machines: number;
    today_production: number;
    efficiency_avg: number;
  };
  shipping: {
    active_shipments: number;
    preparing_count: number;
    shipped_count: number;
  };
  roster: {
    total_assignments: number;
    machines_with_operators: number;
    unassigned_machines: number;
  };
  top_active_shipments: Array<{
    shipping_number: string;
    customer_name: string;
    status: string;
    shipping_date: string;
  }>;
}

export default function TVDisplayOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  // Layar ini menyala tanpa penjaga. Kalau API mati, angka lama ditahan dan
  // ditandai basi - jangan pernah menampilkan nol seolah-olah itu data nyata.
  const [gagal, setGagal] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/tv-display/fullscreen?type=overview');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const overviewData = await response.json();
      
      setData(overviewData);
      setLastUpdate(new Date());
      setGagal(null);
      setLoading(false);
    } catch (error) {
      console.error('Gagal mengambil data ringkasan pabrik:', error);
      setGagal(error instanceof Error ? error.message : 'Tidak bisa menghubungi server');
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'shipped':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'preparing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'in_transit':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
    }
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const umurData = lastUpdate ? Math.round((Date.now() - lastUpdate.getTime()) / 1000) : null;
  const basi = gagal !== null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <ArrowPathIcon className="h-16 w-16 text-white animate-spin mx-auto mb-4" />
          <p className="text-white text-xl">Memuat data pabrik...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      {/* Header */}
      <div className="flex items-center flex-wrap justify-between mb-8 gap-3">
        <div>
          <h1 className="text-4xl font-bold mb-2">Ringkasan Pabrik</h1>
          <p className="text-gray-300 text-lg">Pemantauan operasional</p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-mono ${basi ? 'text-amber-400' : ''}`}>
            {lastUpdate ? formatTime(lastUpdate) : '--:--:--'}
          </div>
          <div className={basi ? 'text-amber-400' : 'text-gray-400'}>
            {basi ? 'Data tertahan - server tidak terjawab' : 'Pembaruan terakhir'}
          </div>
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        {/* Production Card */}
        <div className="bg-blue-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <CogIcon className="h-12 w-12 text-blue-300" />
            <div className="text-right">
              <div className="text-3xl font-bold">{data?.production.active_work_orders}</div>
              <div className="text-blue-300">SPK aktif</div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-blue-200">Mesin jalan</span>
              <span className="font-semibold">{data?.production.active_machines}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-200">Produksi hari ini</span>
              <span className="font-semibold">{data?.production.today_production?.toLocaleString('id-ID')} unit</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-200">Efisiensi rata-rata</span>
              <span className="font-semibold">{data?.production.efficiency_avg?.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Shipping Card */}
        <div className="bg-green-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <TruckIcon className="h-12 w-12 text-green-300" />
            <div className="text-right">
              <div className="text-3xl font-bold">{data?.shipping.active_shipments}</div>
              <div className="text-green-300">Pengiriman aktif</div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-green-200">Disiapkan</span>
              <span className="font-semibold">{data?.shipping.preparing_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-200">Terkirim</span>
              <span className="font-semibold">{data?.shipping.shipped_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-200">Tingkat selesai</span>
              <span className="font-semibold">
                {data?.shipping.active_shipments ? 
                  ((data.shipping.shipped_count / data.shipping.active_shipments) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Roster Card */}
        <div className="bg-purple-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <UsersIcon className="h-12 w-12 text-purple-300" />
            <div className="text-right">
              <div className="text-3xl font-bold">{data?.roster.total_assignments}</div>
              <div className="text-purple-300">Penempatan karyawan</div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-purple-200">Mesin ada operator</span>
              <span className="font-semibold">{data?.roster.machines_with_operators}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-200">Mesin tanpa operator</span>
              <span className={`font-semibold ${data?.roster.unassigned_machines === 0 ? 'text-green-400' : 'text-red-400'}`}>
                {data?.roster.unassigned_machines}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-200">Cakupan</span>
              <span className="font-semibold">
                {data?.roster.machines_with_operators && data?.roster.total_assignments ? 
                  ((data.roster.machines_with_operators / (data.roster.machines_with_operators + data.roster.unassigned_machines)) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Active Shipments */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold mb-4 flex items-center">
            <TruckIcon className="h-6 w-6 mr-2" />
            Pengiriman aktif teratas
          </h3>
          <div className="space-y-4">
            {data?.top_active_shipments.map((shipment, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div>
                  <div className="font-semibold">{shipment.shipping_number}</div>
                  <div className="text-gray-300 text-sm">{shipment.customer_name}</div>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(shipment.status)}`}>
                    {shipment.status.toUpperCase()}
                  </span>
                  <div className="text-gray-400 text-sm mt-1">
                    {new Date(shipment.shipping_date).toLocaleDateString('id-ID')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Status data: dibaca dari pengambilan data layar ini sendiri,
            bukan daftar sub-sistem yang selalu ditulis "ONLINE". */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold mb-4 flex items-center">
            <ChartBarIcon className="h-6 w-6 mr-2" />
            Status data
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
              <div className="flex items-center">
                {basi ? (
                  <ExclamationTriangleIcon className="h-6 w-6 text-amber-400 mr-3" />
                ) : (
                  <CheckCircleIcon className="h-6 w-6 text-green-400 mr-3" />
                )}
                <span>Sambungan ke server</span>
              </div>
              <span className={`font-semibold ${basi ? 'text-amber-400' : 'text-green-400'}`}>
                {basi ? 'TERPUTUS' : 'TERSAMBUNG'}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
              <div className="flex items-center">
                <ClockIcon className="h-6 w-6 text-gray-300 mr-3" />
                <span>Umur data</span>
              </div>
              <span className="font-semibold">
                {umurData === null ? 'belum ada' : `${umurData} detik`}
              </span>
            </div>

            {gagal && (
              <div className="p-4 bg-amber-900/30 border border-amber-700 rounded-lg text-amber-200 text-sm">
                {gagal}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Auto-refresh indicator */}
      <div className="fixed bottom-4 right-4 bg-gray-800 rounded-lg px-4 py-2 shadow-lg">
        <div className="flex items-center text-sm text-gray-300">
          <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
          Muat ulang tiap 30 detik
        </div>
      </div>
    </div>
  );
}
