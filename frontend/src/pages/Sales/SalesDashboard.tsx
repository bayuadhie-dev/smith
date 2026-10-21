import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import axiosInstance from '../../utils/axiosConfig';
import { formatRupiah } from '../../utils/currencyUtils';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  ArrowTrendingUpIcon,
  BanknotesIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  ChartBarIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  ShoppingCartIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';

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

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
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
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Failed to load dashboard</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Please try refreshing the page.</p>
      </div>
    );
  }

  // 2026-10-07: Axion bento-grid restyle (tier-1 module landing page,
  // #6 of 17). Sub-pages (Leads, Pipeline, Quotations, etc) are
  // intentionally left as-is - only this landing dashboard is in scope.
  return (
    <div className="space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-snug">Dashboard Penjualan</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Comprehensive CRM and Sales Management</p>
        </div>
      </div>

      {/* CRM Navigation - bento module cards */}
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3">Sales CRM Modules</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { to: '/app/sales/leads', icon: UserGroupIcon, label: 'Leads', gradient: 'from-[#059669] to-[#047857]' },
            { to: '/app/sales/opportunities', icon: FunnelIcon, label: 'Pipeline', gradient: 'from-teal-500 to-teal-600' },
            { to: '/app/sales/quotations', icon: DocumentTextIcon, label: 'Quotations', gradient: 'from-violet-500 to-violet-600' },
            { to: '/app/sales/activities', icon: CalendarIcon, label: 'Activities', gradient: 'from-[#F15D2C] to-[#C73E1D]' },
            { to: '/app/sales/customers', icon: BuildingOfficeIcon, label: 'Customers', gradient: 'from-indigo-500 to-indigo-600' },
            { to: '/app/sales/orders', icon: ShoppingCartIcon, label: 'Orders', gradient: 'from-pink-500 to-pink-600' },
          ].map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className="flex flex-col items-center text-center p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 group"
            >
              <div className={`bg-gradient-to-br ${m.gradient} p-3 rounded-xl mb-2 group-hover:scale-110 transition-transform`}>
                <m.icon className="h-6 w-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{m.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Key Metrics - bento: Lead Conversion spans 2 cols (primary metric) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-2 bg-gradient-to-br from-[#059669] to-[#047857] rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <ArrowTrendingUpIcon className="w-5 h-5" />
            </div>
            <p className="text-sm opacity-90">Lead Conversion</p>
          </div>
          <p className="text-3xl font-bold">{formatPercentage(metrics.lead_metrics.conversion_rate)}</p>
          <p className="text-xs opacity-75 mt-1">
            {metrics.lead_metrics.converted_leads} of {metrics.lead_metrics.total_leads} leads converted
          </p>
        </div>

        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <BanknotesIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs opacity-90 mb-1">Pipeline Value</p>
          <p className="text-2xl font-bold">{formatRupiah(metrics.opportunity_metrics.total_value)}</p>
          <p className="text-xs opacity-75 mt-1">{metrics.opportunity_metrics.total_opportunities} active opportunities</p>
        </div>

        <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <FunnelIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs opacity-90 mb-1">Win Rate</p>
          <p className="text-2xl font-bold">{formatPercentage(metrics.opportunity_metrics.win_rate)}</p>
          <p className="text-xs opacity-75 mt-1">{metrics.opportunity_metrics.won_opportunities} deals won</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#F15D2C] to-[#C73E1D] rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <DocumentTextIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs opacity-90 mb-1">Quote Acceptance</p>
          <p className="text-2xl font-bold">{formatPercentage(metrics.quotation_metrics.acceptance_rate)}</p>
          <p className="text-xs opacity-75 mt-1">
            {metrics.quotation_metrics.accepted_quotations} of {metrics.quotation_metrics.total_quotations} quotes accepted
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link
          to="/app/sales/leads/new"
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center">
            <UserGroupIcon className="h-8 w-8 text-blue-600 group-hover:text-blue-700" />
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white group-hover:text-blue-700">Add New Lead</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">Capture new lead information</p>
            </div>
          </div>
        </Link>

        <Link
          to="/app/sales/opportunities/new"
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center">
            <FunnelIcon className="h-8 w-8 text-green-600 group-hover:text-green-700" />
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white group-hover:text-green-700">Create Opportunity</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">Start new sales opportunity</p>
            </div>
          </div>
        </Link>

        <Link
          to="/app/sales/quotations/new"
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center">
            <DocumentTextIcon className="h-8 w-8 text-purple-600 group-hover:text-purple-700" />
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white group-hover:text-purple-700">New Quotation</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">Generate price quote</p>
            </div>
          </div>
        </Link>

        <Link
          to="/app/sales/activities/new"
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center">
            <CalendarIcon className="h-8 w-8 text-orange-600 group-hover:text-orange-700" />
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white group-hover:text-orange-700">Schedule Activity</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">Plan sales activities</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Additional Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          to="/app/sales/forecasts"
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center">
            <ChartBarIcon className="h-8 w-8 text-indigo-600 group-hover:text-indigo-700" />
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white group-hover:text-indigo-700">Sales Forecasts</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">Manage sales predictions</p>
            </div>
          </div>
        </Link>

        <Link
          to="/app/sales/orders"
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center">
            <ShoppingCartIcon className="h-8 w-8 text-teal-600 group-hover:text-teal-700" />
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white group-hover:text-teal-700">Sales Orders</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">View and manage orders</p>
            </div>
          </div>
        </Link>

        <Link
          to="/app/sales/customers"
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center">
            <BuildingOfficeIcon className="h-8 w-8 text-pink-600 group-hover:text-pink-700" />
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white group-hover:text-pink-700">Customer Database</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">Manage customer records</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Lead Pipeline</h3>
            <Link to="/app/sales/leads" className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 text-sm font-medium">
              View All →
            </Link>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Total Leads</span>
              <span className="font-semibold text-gray-900 dark:text-white">{metrics.lead_metrics.total_leads}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">New Leads</span>
              <span className="font-semibold text-blue-600">{metrics.lead_metrics.new_leads}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Qualified Leads</span>
              <span className="font-semibold text-green-600">{metrics.lead_metrics.qualified_leads}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Converted Leads</span>
              <span className="font-semibold text-purple-600">{metrics.lead_metrics.converted_leads}</span>
            </div>
          </div>
        </div>

        {/* Opportunity Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Sales Pipeline</h3>
            <Link to="/app/sales/opportunities" className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 text-sm font-medium">
              View Pipeline →
            </Link>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Active Opportunities</span>
              <span className="font-semibold text-gray-900 dark:text-white">{metrics.opportunity_metrics.total_opportunities}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Pipeline Value</span>
              <span className="font-semibold text-blue-600">{formatRupiah(metrics.opportunity_metrics.total_value)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Won Deals</span>
              <span className="font-semibold text-green-600">{metrics.opportunity_metrics.won_opportunities}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Won Value</span>
              <span className="font-semibold text-green-600">{formatRupiah(metrics.opportunity_metrics.won_value)}</span>
            </div>
          </div>
        </div>

        {/* Activity Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Activities</h3>
            <Link to="/app/sales/activities" className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 text-sm font-medium">
              View All →
            </Link>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Total Activities</span>
              <span className="font-semibold text-gray-900 dark:text-white">{metrics.activity_metrics.total_activities}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Pending Activities</span>
              <span className="font-semibold text-blue-600">{metrics.activity_metrics.pending_activities}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Overdue Activities</span>
              <span className="font-semibold text-red-600">{metrics.activity_metrics.overdue_activities}</span>
            </div>
          </div>
        </div>

        {/* Quotation Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Quotations</h3>
            <Link to="/app/sales/quotations" className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 text-sm font-medium">
              View All →
            </Link>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Total Quotations</span>
              <span className="font-semibold text-gray-900 dark:text-white">{metrics.quotation_metrics.total_quotations}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Pending Quotes</span>
              <span className="font-semibold text-yellow-600">{metrics.quotation_metrics.pending_quotations}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-300">Accepted Quotes</span>
              <span className="font-semibold text-green-600">{metrics.quotation_metrics.accepted_quotations}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesDashboard;
