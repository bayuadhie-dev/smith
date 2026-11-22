import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import { CategoryBars, KpiStrip, PageHeader, Panel, QuickLinks, StatusPill } from '../../components/ui/PageKit';
import {
  BuildingOfficeIcon,
  CogIcon,
  TruckIcon,
  ComputerDesktopIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';

interface AssetSummary {
  by_type: Array<{
    asset_type: string;
    count: number;
    total_cost: number;
    total_depreciation: number;
  }>;
  by_status: Array<{
    status: string;
    count: number;
  }>;
  totals: {
    total_assets: number;
    total_acquisition_cost: number;
    total_depreciation: number;
    total_net_book_value: number;
  };
}

interface MaintenanceDue {
  overdue: Array<{
    id: number;
    asset_code: string;
    asset_name: string;
    next_maintenance_date: string;
    days_overdue: number;
  }>;
  due_soon: Array<{
    id: number;
    asset_code: string;
    asset_name: string;
    next_maintenance_date: string;
    days_until_due: number;
  }>;
}

const AssetDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [maintenanceDue, setMaintenanceDue] = useState<MaintenanceDue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [summaryRes, maintenanceRes] = await Promise.all([
        axiosInstance.get('/api/assets/reports/summary'),
        axiosInstance.get('/api/assets/reports/maintenance-due')
      ]);
      setSummary(summaryRes.data);
      setMaintenanceDue(maintenanceRes.data);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const getAssetTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'machinery':
        return <CogIcon className="h-8 w-8" />;
      case 'building':
        return <BuildingOfficeIcon className="h-8 w-8" />;
      case 'vehicle':
        return <TruckIcon className="h-8 w-8" />;
      case 'it_equipment':
        return <ComputerDesktopIcon className="h-8 w-8" />;
      default:
        return <ChartBarIcon className="h-8 w-8" />;
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
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600"></div>
        <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">Memuat data aset...</span>
      </div>
    );
  }

  const labelTipe: Record<string, string> = {
    machinery: 'Mesin',
    building: 'Bangunan',
    vehicle: 'Kendaraan',
    IT_equipment: 'Perangkat TI',
    it_equipment: 'Perangkat TI',
    equipment: 'Peralatan',
    furniture: 'Perabot',
    land: 'Tanah',
  };

  const totals = summary?.totals;
  const penyusutan = totals?.total_depreciation || 0;
  const perolehan = totals?.total_acquisition_cost || 0;
  const jatuhTempo = (maintenanceDue?.overdue.length || 0) + (maintenanceDue?.due_soon.length || 0);

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-10">
      <PageHeader
        eyebrow="ASET · RINGKASAN"
        title="Dashboard Aset"
        subtitle="Nilai aset perusahaan, penyusutannya, dan perawatan yang sudah dekat."
        actions={
          <button
            onClick={() => navigate('/app/assets/new')}
            className="fn-press inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            <PlusIcon className="h-4 w-4" />
            Tambah aset
          </button>
        }
      />

      <KpiStrip
        items={[
          {
            label: 'Total aset',
            value: (totals?.total_assets || 0).toLocaleString('id-ID'),
            hint: 'Belum termasuk aset yang dilepas',
            to: '/app/assets/list',
          },
          {
            label: 'Nilai perolehan',
            value: formatCurrency(perolehan),
            hint: 'Harga beli seluruh aset',
          },
          {
            label: 'Akumulasi penyusutan',
            value: formatCurrency(penyusutan),
            // Rp 0 di sini bukan berarti asetnya baru - lebih sering
            // penyusutan bulanannya memang belum pernah dijalankan.
            hint: penyusutan > 0 ? 'Sudah dibebankan' : 'Penyusutan belum pernah dihitung',
            tone: penyusutan > 0 ? undefined : 'warn',
            to: '/app/assets/depreciation',
          },
          {
            label: 'Nilai buku bersih',
            value: formatCurrency(totals?.total_net_book_value || 0),
            hint: 'Perolehan dikurangi penyusutan',
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Aset per kategori">
          <div className="p-4">
            {!summary?.by_type.length ? (
              <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada aset terdaftar.</p>
            ) : (
              <CategoryBars
                items={summary.by_type.map((item) => ({
                  label: labelTipe[item.asset_type] || item.asset_type.replace(/_/g, ' '),
                  value: Number(item.total_cost || 0),
                  hint: `${item.count} aset · nilai buku ${formatCurrency(item.total_cost - item.total_depreciation)}`,
                }))}
                format={formatCurrency}
              />
            )}
          </div>
        </Panel>

        <Panel
          title="Perawatan jatuh tempo"
          action={jatuhTempo > 0 ? <span className="fn-label">{jatuhTempo} aset</span> : undefined}
        >
          {jatuhTempo === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              Tidak ada perawatan yang jatuh tempo 30 hari ke depan.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200/70 dark:divide-gray-700/70">
              {maintenanceDue?.overdue.slice(0, 4).map((item) => (
                <li key={`o-${item.id}`}>
                  <button
                    type="button"
                    onClick={() => navigate(`/app/assets/${item.id}`)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{item.asset_name}</p>
                      <p className="fn-label mt-0.5">{item.asset_code}</p>
                    </div>
                    <StatusPill tone="bad">Telat {item.days_overdue} hari</StatusPill>
                  </button>
                </li>
              ))}
              {maintenanceDue?.due_soon.slice(0, 4).map((item) => (
                <li key={`s-${item.id}`}>
                  <button
                    type="button"
                    onClick={() => navigate(`/app/assets/${item.id}`)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{item.asset_name}</p>
                      <p className="fn-label mt-0.5">{item.asset_code}</p>
                    </div>
                    <StatusPill tone="warn">{item.days_until_due} hari lagi</StatusPill>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <QuickLinks
        links={[
          { to: '/app/assets/list', label: 'Daftar aset' },
          { to: '/app/assets/new', label: 'Tambah aset' },
          { to: '/app/assets/depreciation', label: 'Laporan penyusutan' },
          { to: '/app/assets/spare-parts', label: 'Suku cadang' },
          { to: '/app/assets/functional-locations', label: 'Lokasi fungsional' },
        ]}
      />
    </div>
  );
};

export default AssetDashboard;
