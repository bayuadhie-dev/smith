import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ExclamationTriangleIcon, BellIcon } from '@heroicons/react/24/outline';
import { PageHeader, KpiStrip, QuickLinks, Panel } from '../../components/ui/PageKit';
import axiosInstance from '../../utils/axiosConfig';
interface QualityDashboardData {
  summary: {
    inspections_today: number;
    inspections_this_week: number;
    pass_rate: number;
    active_alerts: number;
    critical_alerts: number;
    open_capas: number;
    overdue_capas: number;
    total_defects_week: number;
  };
  trends: {
    pass_rate: Array<{
      date: string;
      pass_rate: number;
      inspections: number;
    }>;
  };
  machine_performance: Array<{
    machine: string;
    pass_rate: number;
    total_inspections: number;
  }>;
  last_updated: string;
}

interface QualityAlert {
  id: number;
  alert_number: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  product_name?: string;
  machine_name?: string;
  threshold_value?: number;
  actual_value?: number;
  status: string;
  created_at: string;
}

export default function QualityDashboardEnhanced() {
  const [dashboardData, setDashboardData] = useState<QualityDashboardData | null>(null);
  const [alerts, setAlerts] = useState<QualityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
    fetchAlerts();
    
    // Auto refresh every 5 minutes
    const interval = setInterval(() => {
      fetchDashboardData();
      fetchAlerts();
    }, 300000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await axiosInstance.get('/api/quality-enhanced/dashboard');
      setDashboardData(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await axiosInstance.get('/api/quality-enhanced/alerts?status=active');
      setAlerts(response.data.alerts || []);
    } catch (err: any) {
      console.error('Failed to fetch alerts:', err);
    }
  };

  const acknowledgeAlert = async (alertId: number) => {
    try {
      await axiosInstance.put(`/api/quality-enhanced/alerts/${alertId}/acknowledge`);
      fetchAlerts(); // Refresh alerts
    } catch (err: any) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPassRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#059669]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Dashboard gagal dimuat</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
          <button onClick={fetchDashboardData} className="btn-primary">
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  const severityLabel: { [key: string]: string } = { critical: 'kritis', high: 'tinggi', medium: 'sedang', low: 'rendah' };

  return (
    <div className="space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen p-6">
      <PageHeader
        title="Dashboard Mutu"
        subtitle={`Pemantauan mutu${dashboardData ? ` · diperbarui ${new Date(dashboardData.last_updated).toLocaleTimeString('id-ID')}` : ''}`}
        actions={
          <>
            <button onClick={fetchDashboardData} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">Muat ulang</button>
            <Link to="/app/quality/to-warehouse" className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">Transfer ke Gudang</Link>
          </>
        }
      />

      {dashboardData?.summary.critical_alerts > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <BellIcon className="h-5 w-5 text-red-500 mr-2" />
            <h3 className="text-sm font-semibold text-red-800">
              {dashboardData.summary.critical_alerts} peringatan mutu kritis
            </h3>
          </div>
          <div className="space-y-2">
            {alerts.filter(alert => alert.severity === 'critical' || alert.severity === 'high').slice(0, 3).map((alert) => (
              <div key={alert.id} className={`p-3 rounded-md border ${getSeverityColor(alert.severity)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{alert.title}</span>
                    <p className="text-sm mt-1">{alert.message}</p>
                    {alert.product_name && (
                      <p className="text-xs mt-1">Produk: {alert.product_name}</p>
                    )}
                  </div>
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="btn-sm btn-secondary"
                  >
                    Konfirmasi
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <KpiStrip
        items={[
          { label: 'Tingkat lolos minggu ini', value: `${dashboardData?.summary.pass_rate || 0}%`, hint: `${dashboardData?.summary.inspections_this_week || 0} inspeksi` },
          { label: 'Inspeksi hari ini', value: dashboardData?.summary.inspections_today || 0 },
          { label: 'Peringatan aktif', value: dashboardData?.summary.active_alerts || 0, tone: (dashboardData?.summary.active_alerts || 0) > 0 ? 'warn' : null, hint: `${dashboardData?.summary.critical_alerts || 0} kritis` },
          { label: 'CAPA terbuka', value: dashboardData?.summary.open_capas || 0, tone: (dashboardData?.summary.overdue_capas || 0) > 0 ? 'bad' : null, hint: `${dashboardData?.summary.overdue_capas || 0} lewat tenggat` },
        ]}
      />

      <QuickLinks
        title="Pintasan"
        links={[
          { to: '/app/quality/pending-qc', label: 'SPK menunggu QC' },
          { to: '/app/quality/to-warehouse', label: 'QC selesai: transfer ke gudang' },
          { to: '/app/quality/tests/new', label: 'Buat uji QC baru' },
          { to: '/app/shipping/orders/from-qc', label: 'Siap kirim: buat pengiriman' },
          { to: '/app/quality/inspections/new', label: 'Inspeksi baru' },
          { to: '/app/quality-enhanced/alerts', label: `Peringatan mutu${dashboardData?.summary.active_alerts ? ` (${dashboardData.summary.active_alerts})` : ''}` },
          { to: '/app/quality-enhanced/analytics', label: 'Analitik mutu' },
          { to: '/app/quality-enhanced/audits', label: 'Audit mutu' },
        ]}
      />

      {dashboardData?.trends.pass_rate && dashboardData.trends.pass_rate.length > 0 && (
        <Panel title="Tren tingkat lolos, 7 hari terakhir">
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dashboardData.trends.pass_rate}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
                />
                <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, 'Tingkat lolos']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString('id-ID')}
                />
                <Line type="monotone" dataKey="pass_rate" stroke="#10B981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {dashboardData?.machine_performance && dashboardData.machine_performance.length > 0 && (
        <Panel title="Mutu per mesin">
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {dashboardData.machine_performance.map((machine, index) => (
              <li key={index} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{machine.machine}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{machine.total_inspections} inspeksi</p>
                </div>
                <p className={`text-base font-semibold tabular-nums ${getPassRateColor(machine.pass_rate)}`}>{machine.pass_rate}%</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {alerts.length > 0 && (
        <Panel
          title="Peringatan mutu terbaru"
          action={<Link to="/app/quality-enhanced/alerts" className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400">Lihat semua</Link>}
        >
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {alerts.slice(0, 5).map((alert) => (
              <li key={alert.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getSeverityColor(alert.severity)}`}>
                      {severityLabel[alert.severity] || alert.severity}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{alert.title}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{alert.message}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {new Date(alert.created_at).toLocaleDateString('id-ID')}
                  </p>
                </div>
                {alert.status === 'active' && (
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="btn-sm btn-secondary ml-4"
                  >
                    Konfirmasi
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
