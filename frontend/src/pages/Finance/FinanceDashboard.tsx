import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatRupiah } from '../../utils/currencyUtils';
import { AlertStrip, CategoryBars, HeroStat, KpiStrip, PageHeader, Panel, QuickLinks } from '../../components/ui/PageKit';
import RunChart from '../../components/charts/RunChart';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3">Loading finance dashboard...</span>
      </div>
    );
  }

  const bulan = (arr: { month: string }[]) => {
    if (arr.length === 0) return []
    const idx = [0, Math.floor(arr.length / 2), arr.length - 1]
    return Array.from(new Set(idx)).map((i) => arr[i].month)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <PageHeader
        eyebrow="FINANCE · RINGKASAN"
        title="Dashboard Keuangan"
        subtitle="Ringkasan keuangan dan indikator utama"
        actions={
          <>
            <Link to="/app/finance/reports" className="btn-secondary">Pusat laporan</Link>
            <Link to="/app/finance/invoices" className="btn-primary">Faktur</Link>
          </>
        }
      />

      <div className="fn-card overflow-hidden">
        <HeroStat
          label="Laba bersih"
          value={kpis.net_profit}
          format={formatRupiah}
          loading={loading}
          delta={kpis.total_revenue > 0 ? {
            dir: kpis.net_profit >= 0 ? 'up' : 'down',
            text: formatPercent(kpis.profit_margin),
            vs: 'margin dari pendapatan',
          } : undefined}
          note="Pendapatan dikurangi seluruh beban pada periode berjalan."
          stats={[
            { label: 'Pendapatan', value: formatRupiah(kpis.total_revenue) },
            { label: 'Beban', value: formatRupiah(kpis.total_expenses) },
            { label: 'Kas dan bank', value: <span className={kpis.cash_balance < 0 ? 'text-red-600 dark:text-red-400' : ''}>{formatRupiah(kpis.cash_balance)}</span> },
          ]}
          right={
            revenueData.length > 0 ? (
              <div className="pt-1">
                <p className="fn-label mb-2">Pendapatan per bulan</p>
                <RunChart
                  values={revenueData.map((r) => r.revenue)}
                  axis={bulan(revenueData)}
                  rows={[
                    { label: 'Pendapatan', values: revenueData.map((r) => r.revenue) },
                    { label: 'Beban', values: revenueData.map((r) => r.expenses) },
                    { label: 'Laba', values: revenueData.map((r) => r.profit) },
                  ]}
                  height={200}
                  unit="rupiah"
                />
              </div>
            ) : undefined
          }
        />
        {kpis.cash_balance < 0 && (
          <AlertStrip
            tone="bad"
            icon={<AlertTriangle className="h-4 w-4" />}
            actions={<Link to="/app/finance/cash-bank" className="btn-primary !py-1.5 !text-xs">Lihat kas &amp; bank</Link>}
          >
            <b className="font-semibold">Saldo kas dan bank negatif.</b>{' '}
            <span className="text-gray-500 dark:text-gray-400">Periksa mutasi dan pembayaran yang tercatat.</span>
          </AlertStrip>
        )}
      </div>

      <KpiStrip
        items={[
          { label: 'Piutang usaha', value: formatRupiah(kpis.accounts_receivable), hint: 'belum tertagih', to: '/app/finance/receivable' },
          { label: 'Utang usaha', value: formatRupiah(kpis.accounts_payable), hint: 'belum dibayar', to: '/app/finance/payable' },
          { label: 'Modal kerja', value: formatRupiah(kpis.working_capital), tone: kpis.working_capital < 0 ? 'bad' : null, hint: 'aset lancar dikurangi utang lancar' },
          {
            label: 'Beban terhadap pendapatan',
            value: kpis.total_revenue > 0 ? `${Math.round((kpis.total_expenses / kpis.total_revenue) * 100)}%` : 'belum ada data',
            hint: 'semakin kecil semakin baik',
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Arus kas per bulan" loading={loading}>
          <div className="px-4 pb-3 pt-1">
            {cashFlowData.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada data arus kas.</p>
            ) : (
              <RunChart
                values={cashFlowData.map((c) => c.cash_in)}
                axis={bulan(cashFlowData)}
                rows={[
                  { label: 'Kas masuk', values: cashFlowData.map((c) => c.cash_in) },
                  { label: 'Kas keluar', values: cashFlowData.map((c) => c.cash_out) },
                ]}
                height={200}
                unit="rupiah"
              />
            )}
          </div>
        </Panel>

        <Panel title="Rincian beban" loading={loading}>
          <div className="p-4">
            {expenseBreakdown.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada beban tercatat.</p>
            ) : (
              <CategoryBars
                items={expenseBreakdown.map((e) => ({
                  label: e.category,
                  value: e.amount,
                  hint: `${e.percentage}% dari total beban`,
                }))}
                format={formatRupiah}
              />
            )}
          </div>
        </Panel>
      </div>

      <QuickLinks
        title="Pintasan"
        links={[
          { to: '/app/finance/accounting', label: 'Akuntansi' },
          { to: '/app/finance/budget', label: 'Perencanaan anggaran' },
          { to: '/app/finance/cash-flow', label: 'Arus kas' },
          { to: '/app/finance/reports', label: 'Pusat laporan' },
          { to: '/app/finance/aging', label: 'Umur piutang & utang' },
          { to: '/app/finance/bank-transfers', label: 'Transfer kas/bank' },
        ]}
      />
    </div>
  );
};

export default FinanceDashboard;
