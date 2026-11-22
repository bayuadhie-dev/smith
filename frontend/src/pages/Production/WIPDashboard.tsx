import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  ChartBarIcon,
  CheckCircleIcon,
  CogIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  PauseIcon,
  PlayIcon

} from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';
import { CategoryBars, Panel } from '../../components/ui/PageKit';
import RunChart from '../../components/charts/RunChart';

interface WIPBatch {
  id: number;
  wip_batch_no: string;
  work_order_no: string;
  product_name: string;
  current_stage: string;
  machine_name?: string;
  line_name?: string;
  qty_started: number;
  qty_completed: number;
  qty_rejected: number;
  qty_in_process: number;
  completion_percentage: number;
  rejection_rate: number;
  material_cost: number;
  labor_cost: number;
  overhead_cost: number;
  total_wip_value: number;
  status: string;
  operator_name?: string;
  shift?: string;
  started_at?: string;
  completed_at?: string;
  duration_minutes?: number;
}

interface DashboardData {
  summary: {
    total_wip_value: number;
    total_batches: number;
    active_batches: number;
    completed_batches: number;
  };
  stage_distribution: Record<string, { count: number; value: number }>;
  wip_trend: Array<{ date: string; wip_value: number }>;
  stage_performance: Array<{
    stage: string;
    avg_processing_time: number;
    total_good: number;
    total_rejected: number;
    rejection_rate: number;
  }>;
  cost_breakdown: Record<string, number>;
}

interface BottleneckData {
  bottleneck_analysis: Array<{
    stage: string;
    batch_count: number;
    total_wip_value: number;
    avg_qty_in_process: number;
    is_bottleneck: boolean;
    severity: 'high' | 'medium' | 'low';
  }>;
  total_bottlenecks: number;
}

const WIPDashboard: React.FC = () => {
  const { t } = useLanguage();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [bottleneckData, setBottleneckData] = useState<BottleneckData | null>(null);
  const [wipBatches, setWipBatches] = useState<WIPBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchDashboardData();
    fetchBottleneckData();
    fetchWIPBatches();
  }, [dateRange]);

  const fetchDashboardData = async () => {
    try {
      const response = await axiosInstance.get('/api/wip/wip-dashboard', {
        params: {
          date_from: dateRange.from,
          date_to: dateRange.to
        }
      });
      setDashboardData(response.data);
    } catch (error: any) {
      console.error('Failed to fetch dashboard data:', error);
      setError(error.response?.data?.error || 'Failed to fetch dashboard data');
    }
  };

  const fetchBottleneckData = async () => {
    try {
      const response = await axiosInstance.get('/api/wip/wip-analytics/bottleneck');
      setBottleneckData(response.data);
    } catch (error: any) {
      console.error('Failed to fetch bottleneck data:', error);
    }
  };

  const fetchWIPBatches = async () => {
    try {
      const response = await axiosInstance.get('/api/wip/wip-batches', {
        params: {
          status: 'open,in_progress',
          date_from: dateRange.from,
          date_to: dateRange.to
        }
      });
      setWipBatches(response.data.wip_batches || []);
    } catch (error: any) {
      console.error('Failed to fetch WIP batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <PlayIcon className="h-5 w-5 text-blue-500" />;
      case 'in_progress':
        return <CogIcon className="h-5 w-5 text-yellow-500 animate-spin" />;
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      default:
        return <PauseIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
    }
  };

  // Chart colors
  const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F97316'];

  // Prepare chart data
  const stageDistributionData = dashboardData ? Object.entries(dashboardData.stage_distribution).map(([stage, data]) => ({
    stage: stage.replace('_', ' ').toUpperCase(),
    count: data.count,
    value: data.value
  })) : [];

  const costBreakdownData = dashboardData ? Object.entries(dashboardData.cost_breakdown).map(([type, value]) => ({
    name: type.replace('_', ' ').toUpperCase(),
    value: value
  })) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3">Loading WIP dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4 dark:text-red-400">
          <ExclamationTriangleIcon className="h-12 w-12 mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Dashboard gagal dimuat</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
        <button onClick={fetchDashboardData} className="btn-primary">
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="fn-label mb-1.5">PRODUKSI · WIP</div>
          <h1 className="text-[28px] font-semibold text-gray-900 dark:text-white tracking-tight leading-tight">Dashboard WIP</h1>
          <p className="text-gray-600 dark:text-gray-300">Pemantauan barang setengah jadi dan biayanya</p>
        </div>
        
        {/* Date Range FunnelIcon */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">From:</label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="input-field"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">To:</label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="input-field"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards - bento: Total WIP Value spans 2 cols (primary metric) */}
      {dashboardData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="xl:col-span-2 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg"><CurrencyDollarIcon className="w-5 h-5" /></div>
                <p className="text-sm opacity-90">Total nilai WIP</p>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(dashboardData.summary.total_wip_value)}</p>
            </div>

            <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg"><ChartBarIcon className="w-5 h-5" /></div>
              </div>
              <p className="text-xs opacity-90 mb-1">Batch berjalan</p>
              <p className="text-2xl font-bold">{dashboardData.summary.active_batches}</p>
              <p className="text-xs opacity-75 mt-1">dari {dashboardData.summary.total_batches} batch</p>
            </div>

            <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg"><CheckCircleIcon className="w-5 h-5" /></div>
              </div>
              <p className="text-xs opacity-90 mb-1">Batch selesai</p>
              <p className="text-2xl font-bold">{dashboardData.summary.completed_batches}</p>
              <p className="text-xs opacity-75 mt-1">
                {dashboardData.summary.total_batches > 0
                  ? `${((dashboardData.summary.completed_batches / dashboardData.summary.total_batches) * 100).toFixed(1)}% dari seluruh batch`
                  : 'belum ada batch'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-cta-500 to-cta-700 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg"><ExclamationTriangleIcon className="w-5 h-5" /></div>
              </div>
              <p className="text-xs opacity-90 mb-1">Hambatan</p>
              <p className="text-2xl font-bold">{bottleneckData?.total_bottlenecks || 0}</p>
              <p className="text-xs opacity-75 mt-1">tahap perlu diperiksa</p>
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="WIP per tahap produksi">
          <div className="p-4">
            {stageDistributionData.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada batch WIP.</p>
            ) : (
              <CategoryBars items={stageDistributionData.map((d: any) => ({ label: d.stage, value: d.count }))} unit="batch" />
            )}
          </div>
        </Panel>

        <Panel title="Rincian biaya WIP">
          <div className="p-4">
            {costBreakdownData.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada biaya tercatat.</p>
            ) : (
              <CategoryBars
                items={costBreakdownData.map((d: any) => ({ label: d.name, value: d.value }))}
                format={(n: number) => formatCurrency(n)}
              />
            )}
          </div>
        </Panel>
      </div>

      {dashboardData && dashboardData.wip_trend.length > 0 && (
        <Panel title="Nilai WIP 7 hari terakhir">
          <div className="px-4 pb-3 pt-1">
            <RunChart
              values={dashboardData.wip_trend.map((t: any) => Number(t.wip_value || 0))}
              axis={dashboardData.wip_trend.length
                ? Array.from(new Set([0, Math.floor(dashboardData.wip_trend.length / 2), dashboardData.wip_trend.length - 1]))
                    .map((i: number) => String(dashboardData.wip_trend[i]?.date || '').slice(5))
                : []}
              height={200}
              unit="rupiah"
            />
          </div>
        </Panel>
      )}

      {/* Bottleneck Analysis */}
      {bottleneckData && bottleneckData.bottleneck_analysis.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium">Analisis hambatan</h3>
          </div>
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tahap produksi</th>
                    <th>Jumlah batch</th>
                    <th>Nilai WIP</th>
                    <th>Rata-rata jumlah diproses</th>
                    <th>Tingkat</th>
                    <th>{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bottleneckData.bottleneck_analysis.map((bottleneck, index) => (
                    <tr key={index}>
                      <td className="font-medium">
                        {bottleneck.stage.replace('_', ' ').toUpperCase()}
                      </td>
                      <td>{bottleneck.batch_count}</td>
                      <td>{formatCurrency(bottleneck.total_wip_value)}</td>
                      <td>{bottleneck.avg_qty_in_process.toFixed(1)}</td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(bottleneck.severity)}`}>
                          {bottleneck.severity.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {bottleneck.is_bottleneck ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Active WIP Batches */}
      <div className="card">
        <div className="card-header">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Active WIP Batches</h3>
            <Link to="/app/production/wip-batches" className="btn-primary">
              View All Batches
            </Link>
          </div>
        </div>
        <div className="card-body">
          {wipBatches.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>WIP Batch No</th>
                    <th>SPK</th>
                    <th>{t('production.product')}</th>
                    <th>Current Stage</th>
                    <th>Progress</th>
                    <th>Nilai WIP</th>
                    <th>{t('common.status')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {wipBatches.slice(0, 10).map((batch) => (
                    <tr key={batch.id}>
                      <td className="font-medium">{batch.wip_batch_no}</td>
                      <td>{batch.work_order_no}</td>
                      <td>{batch.product_name}</td>
                      <td>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          {batch.current_stage.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center">
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${batch.completion_percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-600 dark:text-gray-300">
                            {batch.completion_percentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td>{formatCurrency(batch.total_wip_value)}</td>
                      <td>
                        <div className="flex items-center">
                          {getStatusIcon(batch.status)}
                          <span className="ml-1 text-sm capitalize">{batch.status}</span>
                        </div>
                      </td>
                      <td>
                        <Link
                          to={`/app/production/wip-batches/${batch.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm dark:text-blue-400"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Active WIP Batches</h3>
              <p className="text-gray-500 dark:text-gray-400">No work in progress batches found for the selected date range.</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/app/production/wip-batches/new" className="card hover:shadow-lg transition-shadow">
          <div className="card-body text-center">
            <PlayIcon className="h-8 w-8 text-blue-600 mx-auto mb-2 dark:text-blue-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Start New WIP Batch</h3>
            <p className="text-gray-500 dark:text-gray-400">Create WIP batch from SPK</p>
          </div>
        </Link>

        <Link to="/app/production/job-costs" className="card hover:shadow-lg transition-shadow">
          <div className="card-body text-center">
            <CurrencyDollarIcon className="h-8 w-8 text-green-600 mx-auto mb-2 dark:text-green-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Job Costing</h3>
            <p className="text-gray-500 dark:text-gray-400">Track production costs</p>
          </div>
        </Link>

        <Link to="/app/production/wip-analytics" className="card hover:shadow-lg transition-shadow">
          <div className="card-body text-center">
            <ChartBarIcon className="h-8 w-8 text-purple-600 mx-auto mb-2 dark:text-purple-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">WIP Analytics</h3>
            <p className="text-gray-500 dark:text-gray-400">Advanced WIP analysis</p>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default WIPDashboard;
