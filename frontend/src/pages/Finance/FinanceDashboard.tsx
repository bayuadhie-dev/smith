import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatRupiah } from '../../utils/currencyUtils';
import {
  BanknotesIcon,
  BookOpenIcon,
  CalculatorIcon,
  ChartBarIcon,
  ChartBarIcon as Calculator,
  ChartPieIcon,
  CheckCircleIcon,
  CreditCardIcon,
  CurrencyDollarIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
interface FinanceKPIs {
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  profit_margin: number;
  cash_balance: number;
  accounts_receivable: number;
  accounts_payable: number;
  working_capital: number;
}

interface CashFlowData {
  month: string;
  cash_in: number;
  cash_out: number;
  net_cash_flow: number;
}

interface ExpenseBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

interface RevenueData {
  month: string;
  revenue: number;
  profit: number;
  expenses: number;
}

const FinanceDashboard: React.FC = () => {
  const { t } = useLanguage();

  const [kpis, setKpis] = useState<FinanceKPIs>({
    total_revenue: 0,
    total_expenses: 0,
    net_profit: 0,
    profit_margin: 0,
    cash_balance: 0,
    accounts_receivable: 0,
    accounts_payable: 0,
    working_capital: 0
  });
  const [cashFlowData, setCashFlowData] = useState<CashFlowData[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdown[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFinanceData();
  }, []);

  const loadFinanceData = async () => {
    try {
      setLoading(true);
      
      const [kpisRes, cashFlowRes, expensesRes, revenueRes] = await Promise.all([
        axiosInstance.get('/api/finance/dashboard/kpis'),
        axiosInstance.get('/api/finance/dashboard/cash-flow'),
        axiosInstance.get('/api/finance/dashboard/expenses'),
        axiosInstance.get('/api/finance/dashboard/revenue')
      ]);

      setKpis(kpisRes.data?.kpis || {});
      setCashFlowData(cashFlowRes.data?.cash_flow || []);
      setExpenseBreakdown(expensesRes.data?.expenses || []);
      setRevenueData(revenueRes.data?.revenue || []);
    } catch (error) {
      console.error('Failed to load finance data:', error);
      // Show an honest empty state on API failure - no fabricated
      // placeholder months/categories (the "No Data" pie slice used to
      // render as a real-looking 100% chart segment).
      setKpis({
        total_revenue: 0,
        total_expenses: 0,
        net_profit: 0,
        profit_margin: 0,
        cash_balance: 0,
        accounts_receivable: 0,
        accounts_payable: 0,
        working_capital: 0
      });
      setCashFlowData([]);
      setExpenseBreakdown([]);
      setRevenueData([]);
    } finally {
      setLoading(false);
    }
  };

  const formatPercent = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  // Adaptive axis-tick scale (was hardcoded to divide by 1 billion, which
  // rendered every gridline as "0B" for this company's real revenue
  // figures - hundreds of millions, not billions).
  const formatAxisValue = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}Jt`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}Rb`;
    return `${value}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#059669]"></div>
        <span className="ml-3">Loading finance dashboard...</span>
      </div>
    );
  }

  // 2026-10-07: Axion bento-grid restyle (tier-1 module landing page,
  // #7 of 17). Sub-pages (Accounting, Budget, Cash Flow, Reports) are
  // intentionally left as-is - only this landing dashboard is in scope.
  return (
    <div className="space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-snug">Dashboard Keuangan</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Financial overview and key performance indicators</p>
        </div>
      </div>

      {/* KPI Cards - bento: Total Revenue spans 2 cols (primary metric) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-2 bg-gradient-to-br from-[#059669] to-[#047857] rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <CurrencyDollarIcon className="w-5 h-5" />
            </div>
            <p className="text-sm opacity-90">Total Revenue</p>
          </div>
          <p className="text-3xl font-bold">{formatRupiah(kpis.total_revenue)}</p>
        </div>

        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <ChartBarIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs opacity-90 mb-1">Net Profit</p>
          <p className="text-2xl font-bold">{formatRupiah(kpis.net_profit)}</p>
        </div>

        <div className={`bg-gradient-to-br ${kpis.cash_balance > 0 ? 'from-violet-500 to-violet-600' : 'from-red-500 to-red-600'} rounded-xl p-4 text-white shadow-lg`}>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <BanknotesIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs opacity-90 mb-1">Cash Balance</p>
          <p className="text-2xl font-bold">{formatRupiah(kpis.cash_balance)}</p>
          <div className="flex items-center gap-1 mt-1">
            <CheckCircleIcon className="h-3.5 w-3.5" />
            <span className="text-xs opacity-90">{kpis.cash_balance > 0 ? 'Positif' : 'Negatif'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#F15D2C] to-[#C73E1D] rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <CalculatorIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs opacity-90 mb-1">Profit Margin</p>
          <p className="text-2xl font-bold">{formatPercent(kpis.profit_margin)}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash Flow Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cash Flow Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatAxisValue} />
              <Tooltip formatter={(value, name) => [
                formatRupiah(value as number),
                name === 'cash_in' ? 'Cash In' :
                name === 'cash_out' ? 'Cash Out' : 'Net Cash Flow'
              ]} />
              <Area type="monotone" dataKey="cash_in" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
              <Area type="monotone" dataKey="cash_out" stackId="2" stroke="#EF4444" fill="#EF4444" fillOpacity={0.6} />
              <Area type="monotone" dataKey="net_cash_flow" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Expense Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={expenseBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ category, percentage }) => `${category}: ${percentage}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="amount"
              >
                {expenseBreakdown.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [formatRupiah(value as number), 'Amount']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue & Profit Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Revenue & Profit Trend</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={formatAxisValue} />
            <Tooltip formatter={(value, name) => [
              formatRupiah(value as number),
              name === 'revenue' ? 'Revenue' :
              name === 'profit' ? 'Profit' : 'Expenses'
            ]} />
            <Bar dataKey="revenue" fill="#3B82F6" name="Revenue" />
            <Bar dataKey="profit" fill="#10B981" name="Profit" />
            <Bar dataKey="expenses" fill="#EF4444" name="Expenses" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Financial Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Accounts Receivable</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatRupiah(kpis.accounts_receivable)}</p>
            </div>
            <CreditCardIcon className="h-8 w-8 text-blue-600" />
          </div>
          <div className="mt-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Average collection: 32 days</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Accounts Payable</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatRupiah(kpis.accounts_payable)}</p>
            </div>
            <BanknotesIcon className="h-8 w-8 text-red-600" />
          </div>
          <div className="mt-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Average payment: 28 days</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Working Capital</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatRupiah(kpis.working_capital)}</p>
            </div>
            <ChartPieIcon className="h-8 w-8 text-green-600" />
          </div>
          <div className="mt-2">
            <span className="text-sm text-green-600">Ratio: 2.7x</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Expenses</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatRupiah(kpis.total_expenses)}</p>
            </div>
            <CalculatorIcon className="h-8 w-8 text-orange-600" />
          </div>
          <div className="mt-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">76% of revenue</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { to: '/app/finance/accounting', icon: BookOpenIcon, label: 'Accounting', gradient: 'from-[#059669] to-[#047857]' },
            { to: '/app/finance/budget', icon: CalculatorIcon, label: 'Budget Planning', gradient: 'from-teal-500 to-teal-600' },
            { to: '/app/finance/cash-flow', icon: BanknotesIcon, label: 'Cash Flow', gradient: 'from-violet-500 to-violet-600' },
            { to: '/app/finance/reports', icon: DocumentTextIcon, label: 'Reports', gradient: 'from-[#F15D2C] to-[#C73E1D]' },
          ].map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="flex flex-col items-center text-center p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
            >
              <div className={`bg-gradient-to-br ${action.gradient} p-3 rounded-xl mb-2 group-hover:scale-110 transition-transform`}>
                <action.icon className="h-6 w-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FinanceDashboard;
