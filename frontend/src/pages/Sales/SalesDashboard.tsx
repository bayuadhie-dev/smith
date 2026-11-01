import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import axiosInstance from '../../utils/axiosConfig';
import { formatRupiah } from '../../utils/currencyUtils';
import { useLanguage } from '../../contexts/LanguageContext';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { PageHeader, KpiStrip, QuickLinks, Panel } from '../../components/ui/PageKit';

interface DashboardMetrics {
  lead_metrics: {
    total_leads: number;
    new_leads: number;
    qualified_leads: number;
    converted_leads: number;
    conversion_rate: number;
  };
  opportunity_metrics: {
    total_opportunities: number;
    total_value: number;
    won_opportunities: number;
    won_value: number;
    win_rate: number;
  };
  quotation_metrics: {
    total_quotations: number;
    pending_quotations: number;
    accepted_quotations: number;
    acceptance_rate: number;
  };
  activity_metrics: {
    total_activities: number;
    pending_activities: number;
    overdue_activities: number;
  };
}

const SalesDashboard: React.FC = () => {
  const { t } = useLanguage();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardMetrics();
  }, []);

  const loadDashboardMetrics = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/api/sales/analytics/dashboard');
      setMetrics(response.data);
    } catch (error) {
      console.error('Error loading dashboard metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Dashboard gagal dimuat</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Coba muat ulang halaman.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen p-6">
      <PageHeader title="Dashboard Penjualan" subtitle="CRM dan pengelolaan penjualan" />

      <KpiStrip
        items={[
          { label: 'Konversi lead', value: formatPercentage(metrics.lead_metrics.conversion_rate), hint: `${metrics.lead_metrics.converted_leads} dari ${metrics.lead_metrics.total_leads} lead terkonversi` },
          { label: 'Nilai pipeline', value: formatRupiah(metrics.opportunity_metrics.total_value), hint: `${metrics.opportunity_metrics.total_opportunities} peluang aktif` },
          { label: 'Tingkat menang', value: formatPercentage(metrics.opportunity_metrics.win_rate), hint: `${metrics.opportunity_metrics.won_opportunities} peluang menang` },
          { label: 'Penawaran diterima', value: formatPercentage(metrics.quotation_metrics.acceptance_rate), hint: `${metrics.quotation_metrics.accepted_quotations} dari ${metrics.quotation_metrics.total_quotations} penawaran` },
        ]}
      />

      <QuickLinks
        title="Modul CRM dan penjualan"
        links={[
          { to: '/app/sales/leads', label: 'Lead' },
          { to: '/app/sales/opportunities', label: 'Pipeline' },
          { to: '/app/sales/quotations', label: 'Penawaran' },
          { to: '/app/sales/activities', label: 'Aktivitas' },
          { to: '/app/sales/customers', label: 'Pelanggan' },
          { to: '/app/sales/orders', label: 'Pesanan penjualan' },
          { to: '/app/sales/forecasts', label: 'Forecast penjualan' },
        ]}
      />

      <QuickLinks
        title="Buat baru"
        links={[
          { to: '/app/sales/leads/new', label: 'Lead baru' },
          { to: '/app/sales/opportunities/new', label: 'Peluang baru' },
          { to: '/app/sales/quotations/new', label: 'Penawaran baru' },
          { to: '/app/sales/activities/new', label: 'Jadwalkan aktivitas' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel
          title="Pipeline lead"
          action={<Link to="/app/sales/leads" className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">Lihat semua</Link>}
        >
          <dl className="divide-y divide-gray-100 dark:divide-gray-700">
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-sm text-gray-600 dark:text-gray-300">Total lead</dt>
                <dd className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{metrics.lead_metrics.total_leads}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-sm text-gray-600 dark:text-gray-300">Lead baru</dt>
                <dd className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{metrics.lead_metrics.new_leads}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-sm text-gray-600 dark:text-gray-300">Lead terkualifikasi</dt>
                <dd className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{metrics.lead_metrics.qualified_leads}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-sm text-gray-600 dark:text-gray-300">Lead terkonversi</dt>
                <dd className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{metrics.lead_metrics.converted_leads}</dd>
              </div>
          </dl>
        </Panel>
        <Panel
          title="Pipeline penjualan"
          action={<Link to="/app/sales/opportunities" className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">Lihat pipeline</Link>}
        >
          <dl className="divide-y divide-gray-100 dark:divide-gray-700">
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-sm text-gray-600 dark:text-gray-300">Peluang aktif</dt>
                <dd className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{metrics.opportunity_metrics.total_opportunities}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-sm text-gray-600 dark:text-gray-300">Nilai pipeline</dt>
                <dd className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{formatRupiah(metrics.opportunity_metrics.total_value)}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-sm text-gray-600 dark:text-gray-300">Peluang menang</dt>
                <dd className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{metrics.opportunity_metrics.won_opportunities}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-sm text-gray-600 dark:text-gray-300">Nilai menang</dt>
                <dd className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{formatRupiah(metrics.opportunity_metrics.won_value)}</dd>
              </div>
          </dl>
        </Panel>
        <Panel
          title="Aktivitas"
          action={<Link to="/app/sales/activities" className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">Lihat semua</Link>}
        >
          <dl className="divide-y divide-gray-100 dark:divide-gray-700">
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-sm text-gray-600 dark:text-gray-300">Total aktivitas</dt>
                <dd className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{metrics.activity_metrics.total_activities}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-sm text-gray-600 dark:text-gray-300">Menunggu</dt>
                <dd className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{metrics.activity_metrics.pending_activities}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-sm text-gray-600 dark:text-gray-300">Lewat tenggat</dt>
                <dd className="text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">{metrics.activity_metrics.overdue_activities}</dd>
              </div>
          </dl>
        </Panel>
        <Panel
          title="Penawaran"
          action={<Link to="/app/sales/quotations" className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">Lihat semua</Link>}
        >
          <dl className="divide-y divide-gray-100 dark:divide-gray-700">
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-sm text-gray-600 dark:text-gray-300">Total penawaran</dt>
                <dd className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{metrics.quotation_metrics.total_quotations}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-sm text-gray-600 dark:text-gray-300">Menunggu</dt>
                <dd className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">{metrics.quotation_metrics.pending_quotations}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-sm text-gray-600 dark:text-gray-300">Diterima</dt>
                <dd className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{metrics.quotation_metrics.accepted_quotations}</dd>
              </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
};

export default SalesDashboard;
