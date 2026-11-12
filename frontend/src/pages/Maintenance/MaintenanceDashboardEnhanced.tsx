import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPieChart, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../utils/axiosConfig';
import { PageHeader, KpiStrip, QuickLinks } from '../../components/ui/PageKit';
import {
  ArrowPathIcon as Activity,
  ArrowDownTrayIcon,
  ArrowPathIcon as RefreshCw,
  ArrowTrendingUpIcon,
  CalendarIcon as Calendar,
  ChartBarIcon,
  CheckCircleIcon as CheckCircle,
  ClockIcon,
  CogIcon as Settings,
  CurrencyDollarIcon,
  ExclamationTriangleIcon as AlertTriangle,
  PlusIcon as Plus,
  WrenchIcon as Wrench
} from '@heroicons/react/24/outline';
interface MaintenanceKPIs {
  total_work_orders: number;
  pending_work_orders: number;
  completed_work_orders: number;
  overdue_work_orders: number;
  total_cost_this_month: number;
  avg_completion_time: number;
  mttr: number; // Mean Time To Repair
  mtbf: number; // Mean Time Between Failures
  preventive_percentage: number;
  equipment_uptime: number;
}

interface MaintenanceAlert {
  id: number;
  machine_name: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  created_at: string;
  status: string;
}

interface WorkOrderSummary {
  id: number;
  record_number: string;
  machine_name: string;
  maintenance_type: string;
  priority: string;
  status: string;
  scheduled_date: string;
  assigned_to: string;
  estimated_duration: number;
}

interface MaintenanceTrend {
  month: string;
  preventive: number;
  corrective: number;
  emergency: number;
  cost: number;
}

interface EquipmentPerformance {
  machine_name: string;
  uptime_percentage: number;
  mttr: number;
  mtbf: number | null;
  maintenance_cost: number;
  last_maintenance: string;
}

const MaintenanceDashboardEnhanced: React.FC = () => {
  const { t } = useLanguage();

  const [kpis, setKpis] = useState<MaintenanceKPIs>({} as MaintenanceKPIs);
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderSummary[]>([]);
  const [trends, setTrends] = useState<MaintenanceTrend[]>([]);
  const [equipmentPerformance, setEquipmentPerformance] = useState<EquipmentPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [selectedMachine, setSelectedMachine] = useState('all');

  useEffect(() => {
    fetchDashboardData();
  }, [selectedPeriod, selectedMachine]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch KPIs
      try {
        const kpiResponse = await api.get(`/api/maintenance/dashboard/kpis?period=${selectedPeriod}&machine=${selectedMachine}`);
        setKpis(kpiResponse.data);
      } catch (e) {
        console.log('KPIs endpoint not available');
      }

      // Fetch Alerts
      try {
        const alertsResponse = await api.get('/api/maintenance/alerts?status=active');
        setAlerts(alertsResponse.data.alerts || []);
      } catch (e) {
        console.log('Alerts endpoint not available');
      }

      // Fetch SPK
      try {
        const workOrdersResponse = await api.get('/api/maintenance/work-orders/summary');
        setWorkOrders(workOrdersResponse.data.work_orders || []);
      } catch (e) {
        console.log('SPK endpoint not available');
      }

      // Fetch Trends
      try {
        const trendsResponse = await api.get(`/api/maintenance/analytics/trends?period=${selectedPeriod}`);
        setTrends(trendsResponse.data.trends || []);
      } catch (e) {
        console.log('Trends endpoint not available');
      }

      // Fetch Kinerja mesin
      try {
        const performanceResponse = await api.get('/api/maintenance/analytics/equipment-performance');
        setEquipmentPerformance(performanceResponse.data.equipment || []);
      } catch (e) {
        console.log('Equipment performance endpoint not available');
      }

    } catch (error) {
      console.error('Failed to fetch maintenance dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'scheduled': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDuration = (hours: number | null | undefined) => {
    if (hours === null || hours === undefined) {
      return 'N/A';
    }
    if (hours < 24) {
      return `${hours.toFixed(1)} jam`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours.toFixed(1)}h`;
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Perawatan"
        subtitle="Kinerja mesin dan aktivitas perawatan"
        actions={
          <>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="7">7 hari terakhir</option>
              <option value="30">30 hari terakhir</option>
              <option value="90">90 hari terakhir</option>
              <option value="365">1 tahun terakhir</option>
            </select>
            <button
              onClick={fetchDashboardData}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <RefreshCw className="h-4 w-4" />
              Muat ulang
            </button>
          </>
        }
      />

      <KpiStrip
        items={[
          { label: 'Total SPK', value: (kpis.total_work_orders || 0).toLocaleString('id-ID'), hint: `${kpis.pending_work_orders || 0} menunggu, ${kpis.completed_work_orders || 0} selesai` },
          { label: 'Ketersediaan mesin', value: `${(kpis.equipment_uptime || 0).toFixed(1)}%` },
          { label: 'MTTR (rata-rata waktu perbaikan)', value: formatDuration(kpis.mttr || 0) },
          { label: 'Biaya bulan ini', value: formatCurrency(kpis.total_cost_this_month || 0), hint: `${(kpis.preventive_percentage || 0).toFixed(1)}% preventif` },
        ]}
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tren perawatan */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Tren perawatan</h3>
            <ChartBarIcon className="h-5 w-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="preventive" stackId="1" stroke="#10B981" fill="#10B981" />
              <Area type="monotone" dataKey="corrective" stackId="1" stroke="#F59E0B" fill="#F59E0B" />
              <Area type="monotone" dataKey="emergency" stackId="1" stroke="#EF4444" fill="#EF4444" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Analisis biaya */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Analisis biaya</h3>
            <ArrowTrendingUpIcon className="h-5 w-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              <Line type="monotone" dataKey="cost" stroke="#3B82F6" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alerts and SPK */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Peringatan aktif */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Peringatan aktif</h3>
            <AlertTriangle className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <CheckCircle className="mx-auto h-12 w-12 text-green-400 mb-4" />
                <p>Tidak ada peringatan aktif</p>
                <p className="text-sm">Semua mesin berjalan normal</p>
              </div>
            ) : (
              alerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="flex items-start space-x-3 p-3 rounded-lg border">
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                    {alert.severity.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{alert.machine_name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(alert.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SPK terbaru */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">SPK terbaru</h3>
            <Settings className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {workOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p>Belum ada SPK</p>
                <p className="text-sm">Buat SPK pertama</p>
              </div>
            ) : (
              workOrders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{order.record_number}</p>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{order.machine_name}</p>
                    <p className="text-xs text-gray-400">
                      {order.maintenance_type} • {order.assigned_to}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-900 dark:text-white">{formatDuration(order.estimated_duration)}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(order.scheduled_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Kinerja mesin */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Kinerja mesin</h3>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300">
              Export Report
            </button>
            <ArrowDownTrayIcon className="h-5 w-5 text-gray-400" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Perawatan terakhir
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {equipmentPerformance.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    <Activity className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p>Belum ada data kinerja mesin</p>
                  </td>
                </tr>
              ) : (
                equipmentPerformance.map((equipment, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{equipment.machine_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm text-gray-900 dark:text-white">{(equipment.uptime_percentage || 0).toFixed(1)}%</div>
                        <div className="ml-2 w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${equipment.uptime_percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatDuration(equipment.mttr)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatDuration(equipment.mtbf)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatCurrency(equipment.maintenance_cost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(equipment.last_maintenance).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <QuickLinks
        title="Pintasan"
        links={[
          { to: '/app/maintenance/new', label: 'Jadwalkan perawatan' },
          { to: '/app/maintenance/records', label: 'Daftar perawatan' },
          { to: '/app/maintenance/schedules', label: 'Jadwal perawatan' },
          { to: '/app/maintenance/analytics', label: 'Analitik perawatan' },
        ]}
      />
    </div>
  );
};

export default MaintenanceDashboardEnhanced;
