import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Calendar, Package, TrendingUp, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface DashboardData {
  summary: {
    total_planned: number;
    total_actual: number;
    completion_rate: number;
  };
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  upcoming_plans: Array<{
    id: number;
    plan_number: string;
    plan_name: string;
    product_name: string;
    planned_quantity: number;
    period_start: string;
    period_end: string;
    status: string;
    priority: string;
  }>;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const ProductionPlanningDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams(dateRange);
      
      const response = await axiosInstance.get(
        `/api/production-planning/production-plans/dashboard?${params.toString()}`
      );

      setDashboardData(response.data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !dashboardData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#059669]"></div>
      </div>
    );
  }

  const statusData = Object.entries(dashboardData.by_status).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value
  }));

  const priorityData = Object.entries(dashboardData.by_priority).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value
  }));

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      approved: 'bg-green-100 text-green-800',
      released: 'bg-blue-100 text-blue-800',
      completed: 'bg-purple-100 text-purple-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return badges[status] || badges.draft;
  };

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, string> = {
      low: 'bg-gray-100 text-gray-800',
      normal: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return badges[priority] || badges.normal;
  };

  // 2026-10-07: Axion bento-grid restyle (tier-2 sub-dashboard).
  // Filters/charts/table are intentionally left as-is - only the
  // header + summary cards are in scope for the bento treatment.
  return (
    <div className="p-6 space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="mb-2">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-snug">Production Planning Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Master Production Schedule (MPS) Overview</p>
          </div>
          <button
            onClick={() => navigate('/app/production/planning')}
            className="px-4 py-2 bg-gradient-to-br from-[#059669] to-[#047857] text-white rounded-lg hover:shadow-lg transition-shadow text-sm font-medium"
          >
            View All Plans
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.start_date}
              onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={dateRange.end_date}
              onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards - bento: Total Planned spans 2 cols (primary metric) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-1 bg-gradient-to-br from-[#059669] to-[#047857] rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <Package size={18} />
            </div>
            <p className="text-sm opacity-90">Total Planned</p>
          </div>
          <p className="text-3xl font-bold">{dashboardData.summary.total_planned.toLocaleString()}</p>
          <p className="text-xs opacity-75 mt-1">Units planned for production</p>
        </div>

        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <CheckCircle size={18} />
            </div>
            <p className="text-sm opacity-90">Total Actual</p>
          </div>
          <p className="text-3xl font-bold">{dashboardData.summary.total_actual.toLocaleString()}</p>
          <p className="text-xs opacity-75 mt-1">Units actually produced</p>
        </div>

        <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <TrendingUp size={18} />
            </div>
            <p className="text-sm opacity-90">Completion Rate</p>
          </div>
          <p className="text-3xl font-bold">{dashboardData.summary.completion_rate.toFixed(1)}%</p>
          <p className="text-xs opacity-75 mt-1">Overall plan completion</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Status Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Plans by Status</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Priority Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Plans by Priority</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={priorityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#3B82F6" name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Upcoming Plans */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upcoming Production Plans</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Plan Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Plan Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Period</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Priority</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {dashboardData.upcoming_plans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No upcoming plans
                  </td>
                </tr>
              ) : (
                dashboardData.upcoming_plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{plan.plan_number}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">{plan.plan_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">{plan.product_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {plan.planned_quantity.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {new Date(plan.period_start).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        to {new Date(plan.period_end).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(plan.status)}`}>
                        {plan.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getPriorityBadge(plan.priority)}`}>
                        {plan.priority}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProductionPlanningDashboard;
