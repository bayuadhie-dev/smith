import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatRupiah } from '../../utils/currencyUtils';
import { PageHeader, KpiStrip, QuickLinks } from '../../components/ui/PageKit';
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3">Loading finance dashboard...</span>
      </div>
    );
  }

  // 2026-10-07: Axion bento-grid restyle (tier-1 module landing page,
  // #7 of 17). Sub-pages (Accounting, Budget, Cash Flow, Reports) are
  // intentionally left as-is - only this landing dashboard is in scope.
  return (
    <div className="space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen p-6">
      <PageHeader title="Dashboard Keuangan" subtitle="Ringkasan keuangan dan indikator utama" />

      <KpiStrip
        items={[
          { label: 'Total pendapatan', value: formatRupiah(kpis.total_revenue) },
          { label: 'Laba bersih', value: formatRupiah(kpis.net_profit), tone: kpis.net_profit < 0 ? 'bad' : null },
          { label: 'Saldo kas dan bank', value: formatRupiah(kpis.cash_balance), tone: kpis.cash_balance < 0 ? 'bad' : null, hint: kpis.cash_balance > 0 ? 'positif' : 'negatif' },
          { label: 'Margin laba', value: formatPercent(kpis.profit_margin) },
        ]}
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash Flow Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Tren arus kas</h3>
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

        {/* Rincian beban */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Rincian beban</h3>
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
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Tren pendapatan dan laba</h3>
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

      <KpiStrip
        items={[
          { label: 'Piutang usaha', value: formatRupiah(kpis.accounts_receivable) },
          { label: 'Utang usaha', value: formatRupiah(kpis.accounts_payable) },
          { label: 'Modal kerja', value: formatRupiah(kpis.working_capital), tone: kpis.working_capital < 0 ? 'bad' : null },
          { label: 'Total beban', value: formatRupiah(kpis.total_expenses), hint: kpis.total_revenue > 0 ? `${Math.round((kpis.total_expenses / kpis.total_revenue) * 100)}% dari pendapatan` : undefined },
        ]}
      />

      <QuickLinks
        title="Pintasan"
        links={[
          { to: '/app/finance/accounting', label: 'Akuntansi' },
          { to: '/app/finance/budget', label: 'Perencanaan anggaran' },
          { to: '/app/finance/cash-flow', label: 'Arus kas' },
          { to: '/app/finance/reports', label: 'Laporan' },
        ]}
      />
    </div>
  );
};

export default FinanceDashboard;
