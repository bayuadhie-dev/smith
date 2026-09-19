import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import { formatRupiah } from '../../utils/currencyUtils';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  ArrowTrendingUpIcon as ArrowUpIcon,
  ArrowTrendingDownIcon as ArrowDownIcon,
  BanknotesIcon,
  ChartBarIcon,
  CogIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  UsersIcon
} from '@heroicons/react/24/outline';

// Field names match the real backend response from GET /api/executive/overview
// (routes/executive_dashboard.py get_executive_overview) - the previous
// version of this interface assumed metrics (profit, expenses, on_time_delivery,
// capacity_utilization, turnover_rate, training_completion, turnover_ratio,
// stockout_incidents, waste_percentage) that are never computed anywhere in
// the backend. Rather than fabricate numbers for those, this page now only
// shows real computed values and marks the rest "Belum tersedia".
interface ExecutiveMetrics {
  financial: {
    revenue: number;
    revenue_growth: number;
    cash_collected: number;
    outstanding_ar: number;
    collection_rate: number;
  };
  production: {
    output: number;
    production_growth: number;
    avg_oee: number;
    wo_completion_rate: number;
    fg_inventory_value: number;
  };
  quality: {
    pass_rate: number;
    total_inspections: number;
    failed_inspections: number;
  };
  hr: {
    active_employees: number;
  };
  inventory: {
    total_value: number;
    low_stock_items: number;
  };
}

interface Alert {
  id: number;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
}

const ExecutiveDashboard: React.FC = () => {
  const { t } = useLanguage();

  const [metrics, setMetrics] = useState<ExecutiveMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  // Load executive metrics
  const loadExecutiveMetrics = async () => {
    try {
      setLoading(true);
      
      // Real endpoint is /api/executive/overview - the old /api/reports/executive
      // path 404'd on every call since this page was built, and its response
      // envelope is {success, data: {...}} not {metrics, alerts}.
      const response = await axiosInstance.get('/api/executive/overview');

      setMetrics(response.data?.data || null);
      setAlerts([]); // this endpoint doesn't produce alerts yet
      
    } catch (error) {
      console.error('Failed to load executive metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExecutiveMetrics();
  }, [selectedPeriod]);

  // Get trend icon
  const getTrendIcon = (value: number) => {
    if (value > 0) {
      return <ArrowUpIcon className="h-4 w-4 text-green-500" />;
    } else if (value < 0) {
      return <ArrowDownIcon className="h-4 w-4 text-red-500" />;
    }
    return null;
  };

  // Get alert icon
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      default:
        return <ExclamationTriangleIcon className="h-5 w-5 text-blue-500" />;
    }
  };

  // Format currency
  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3">Loading executive dashboard...</span>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Failed to load executive metrics. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Executive Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              High-level business insights and key performance indicators
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
            
            <button
              onClick={loadExecutiveMetrics}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <EyeIcon className="h-5 w-5 mr-2" />
            </button>
          </div>
        </div>
      </div>

      {/* KeyIcon Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        {/* Financial Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Revenue</h3>
            <BanknotesIcon className="h-8 w-8 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {formatRupiah(metrics.financial.revenue)}
          </div>
          <div className="flex items-center">
            {getTrendIcon(metrics.financial.revenue_growth)}
            <span className={`ml-1 text-sm ${metrics.financial.revenue_growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(Math.abs(metrics.financial.revenue_growth))} vs last period
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('navigation.production')}</h3>
            <CogIcon className="h-8 w-8 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {metrics.production.output.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Units produced &middot; OEE {formatPercentage(metrics.production.avg_oee)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Quality Pass Rate</h3>
            <ChartBarIcon className="h-8 w-8 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {metrics.quality.total_inspections > 0 ? formatPercentage(metrics.quality.pass_rate) : 'Belum tersedia'}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {metrics.quality.total_inspections} inspeksi periode ini
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Employees</h3>
            <UsersIcon className="h-8 w-8 text-indigo-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {metrics.hr.active_employees}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Active employees
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* Financial Performance */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Financial Performance</h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-300">Revenue</span>
              <span className="font-semibold">{formatRupiah(metrics.financial.revenue)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-300">Cash Collected</span>
              <span className="font-semibold text-green-600">{formatRupiah(metrics.financial.cash_collected)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-300">Outstanding AR</span>
              <span className="font-semibold text-red-600">{formatRupiah(metrics.financial.outstanding_ar)}</span>
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-300">Collection Rate</span>
                <span className="font-semibold">
                  {formatPercentage(metrics.financial.collection_rate)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Operational Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Operational Excellence</h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-300">Avg OEE</span>
              <span className="font-semibold">{formatPercentage(metrics.production.avg_oee)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-300">WO Completion Rate</span>
              <span className="font-semibold">{formatPercentage(metrics.production.wo_completion_rate)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-300">Quality Pass Rate</span>
              <span className="font-semibold">
                {metrics.quality.total_inspections > 0 ? formatPercentage(metrics.quality.pass_rate) : 'Belum tersedia'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-300">FG Inventory Value</span>
              <span className="font-semibold">{formatRupiah(metrics.production.fg_inventory_value)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* HR & Inventory Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* HR Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Human Resources</h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-300">Active Employees</span>
              <span className="font-semibold">{metrics.hr.active_employees}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-300">Attendance Rate</span>
              <span className="font-semibold text-gray-400 dark:text-gray-500">Belum tersedia</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-300">Turnover Rate</span>
              <span className="font-semibold text-gray-400 dark:text-gray-500">Belum tersedia</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-300">Training Completion</span>
              <span className="font-semibold text-gray-400 dark:text-gray-500">Belum tersedia</span>
            </div>
          </div>
        </div>

        {/* Inventory Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Inventory Management</h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-300">Total Value</span>
              <span className="font-semibold">{formatRupiah(metrics.inventory.total_value)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-300">Low Stock Items</span>
              <span className="font-semibold text-red-600">{metrics.inventory.low_stock_items}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-300">Turnover Ratio</span>
              <span className="font-semibold text-gray-400 dark:text-gray-500">Belum tersedia</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-300">Waste Percentage</span>
              <span className="font-semibold text-gray-400 dark:text-gray-500">Belum tersedia</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts & Notifications */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Executive Alerts</h3>
        
        {alerts.length > 0 ? (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-start p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex-shrink-0 mr-3">
                  {getAlertIcon(alert.type)}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">{alert.title}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">{alert.message}</div>
                  <div className="text-xs text-gray-400 mt-2">
                    {new Date(alert.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <ExclamationTriangleIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No alerts</h3>
            <p className="text-gray-500 dark:text-gray-400">All systems are operating normally.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
