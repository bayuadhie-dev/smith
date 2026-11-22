import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import axiosInstance from '../../utils/axiosConfig';
import { formatRupiah } from '../../utils/currencyUtils';
import { Panel } from '../../components/ui/PageKit';
import RunChart from '../../components/charts/RunChart';
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  CalendarIcon,
  ChartBarIcon,
  ClockIcon,
  CurrencyDollarIcon

} from '@heroicons/react/24/outline';
interface CashFlowForecast {
  period: string;
  opening_balance: number;
  cash_in: number;
  cash_out: number;
  closing_balance: number;
}

interface CashFlowAnalysis {
  operating_cash_flow: number;
  investing_cash_flow: number;
  financing_cash_flow: number;
  net_cash_flow: number;
  days_sales_outstanding: number | null;
  free_cash_flow: number;
}

const CashFlowManagement: React.FC = () => {
  const { t } = useLanguage();

  const [forecast, setForecast] = useState<CashFlowForecast[]>([]);
  const [analysis, setAnalysis] = useState<CashFlowAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'weekly' | 'monthly'>('weekly');

  useEffect(() => {
    loadCashFlowData();
  }, [selectedPeriod]);

  const loadCashFlowData = async () => {
    try {
      setLoading(true);
      
      const [forecastRes, analysisRes] = await Promise.all([
        axiosInstance.get('/api/finance/cash-flow/forecast'),
        axiosInstance.get('/api/finance/cash-flow/analysis')
      ]);

      setForecast(forecastRes.data?.forecast || []);
      setAnalysis(analysisRes.data?.analysis || null);
    } catch (error) {
      console.error('Failed to load cash flow data:', error);
      // No mock-data fallback - showing fabricated billions-of-rupiah numbers
      // on a real API failure was indistinguishable from real data. Show an
      // honest empty state instead; the page below already handles empty
      // forecast/analysis gracefully.
      setForecast([]);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  };

  const formatShortCurrency = (amount: number) => {
    if (Math.abs(amount) >= 1000000000000) {
      return `${(amount / 1000000000000).toFixed(1)}T`;
    } else if (Math.abs(amount) >= 1000000000) {
      return `${(amount / 1000000000).toFixed(1)}B`;
    } else if (Math.abs(amount) >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    }
    return formatRupiah(amount);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600"></div>
        <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">Memuat data arus kas...</span>
      </div>
    );
  }

  const periodeAxis = forecast.length
    ? Array.from(new Set([0, Math.floor(forecast.length / 2), forecast.length - 1]))
        .map((i: number) => String((forecast[i] as any)?.period || '')
          .replace(/^Week\s*/i, 'Minggu ')
          .replace(/^Month\s*/i, 'Bulan '))
        .filter(Boolean)
    : []

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="fn-label mb-1.5">FINANCE · ARUS KAS</div>
          <h1 className="text-[28px] font-semibold text-gray-900 dark:text-white tracking-tight leading-tight">Arus Kas</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Pelacakan dan perkiraan arus kas</p>
        </div>
        <div className="flex space-x-3">
          <select
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as 'weekly' | 'monthly')}
          >
            <option value="weekly">Per minggu</option>
            <option value="monthly">Monthly View</option>
          </select>
          <button className="btn-secondary">
            <CalendarIcon className="h-4 w-4 mr-2" />
            Ekspor laporan
          </button>
        </div>
      </div>

      {/* Cash Flow Analysis Cards */}
      {analysis && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="bg-green-100 p-2 rounded-lg dark:bg-green-900/30">
                <ArrowTrendingUpIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Kas dari operasi</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatShortCurrency(analysis.operating_cash_flow)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="bg-red-100 p-2 rounded-lg dark:bg-red-900/30">
                <ArrowTrendingDownIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Kas dari investasi</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatShortCurrency(analysis.investing_cash_flow)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="bg-blue-100 p-2 rounded-lg dark:bg-blue-900/30">
                <BanknotesIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Kas dari pendanaan</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatShortCurrency(analysis.financing_cash_flow)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="bg-purple-100 p-2 rounded-lg dark:bg-purple-900/30">
                <CurrencyDollarIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Arus kas bersih</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatShortCurrency(analysis.net_cash_flow)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="bg-orange-100 p-2 rounded-lg dark:bg-orange-900/30">
                <ClockIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Rata-rata umur piutang</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{analysis.days_sales_outstanding != null ? `${analysis.days_sales_outstanding} days` : '-'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="bg-indigo-100 p-2 rounded-lg dark:bg-indigo-900/30">
                <ChartBarIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Arus kas bebas</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatShortCurrency(analysis.free_cash_flow)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <Panel title="Perkiraan arus kas">
        <div className="px-4 pb-3 pt-1">
          {forecast.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada data perkiraan.</p>
          ) : (
            <RunChart
              values={forecast.map((f: any) => Number(f.closing_balance || 0))}
              axis={periodeAxis}
              rows={[
                { label: 'Kas masuk', values: forecast.map((f: any) => Number(f.cash_in || 0)) },
                { label: 'Kas keluar', values: forecast.map((f: any) => Number(f.cash_out || 0)) },
                { label: 'Saldo akhir', values: forecast.map((f: any) => Number(f.closing_balance || 0)) },
              ]}
              height={220}
              unit="rupiah"
            />
          )}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Kas masuk dibanding kas keluar">
          <div className="px-4 pb-3 pt-1">
            {forecast.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada data.</p>
            ) : (
              <RunChart
                values={forecast.map((f: any) => Number(f.cash_in || 0))}
                axis={periodeAxis}
                rows={[
                  { label: 'Kas masuk', values: forecast.map((f: any) => Number(f.cash_in || 0)) },
                  { label: 'Kas keluar', values: forecast.map((f: any) => Number(f.cash_out || 0)) },
                ]}
                height={190}
                unit="rupiah"
              />
            )}
          </div>
        </Panel>

        <Panel title="Pergerakan saldo kas">
          <div className="px-4 pb-3 pt-1">
            {forecast.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada data.</p>
            ) : (
              <RunChart
                values={forecast.map((f: any) => Number(f.closing_balance || 0))}
                axis={periodeAxis}
                rows={[
                  { label: 'Saldo awal', values: forecast.map((f: any) => Number(f.opening_balance || 0)) },
                  { label: 'Saldo akhir', values: forecast.map((f: any) => Number(f.closing_balance || 0)) },
                ]}
                height={190}
                unit="rupiah"
              />
            )}
          </div>
        </Panel>
      </div>

      {/* Detailed Forecast Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Rincian perkiraan arus kas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Opening Balance
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cash In
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cash Out
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Net Flow
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Closing Balance
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {forecast.map((item, index) => {
                const netFlow = item.cash_in - item.cash_out;
                return (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {item.period}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                      {formatRupiah(item.opening_balance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right font-medium dark:text-green-400">
                      {formatRupiah(item.cash_in)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right font-medium dark:text-red-400">
                      {formatRupiah(item.cash_out)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      netFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatRupiah(netFlow)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right font-bold">
                      {formatRupiah(item.closing_balance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cash Flow Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-lg dark:bg-green-900/30">
              <ArrowTrendingUpIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Cash In</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {formatRupiah(forecast.reduce((sum, f) => sum + f.cash_in, 0))}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-red-100 p-3 rounded-lg dark:bg-red-900/30">
              <ArrowTrendingDownIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Cash Out</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">
                {formatRupiah(forecast.reduce((sum, f) => sum + f.cash_out, 0))}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-lg dark:bg-blue-900/30">
              <CurrencyDollarIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Arus kas bersih</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {formatRupiah(forecast.reduce((sum, f) => sum + (f.cash_in - f.cash_out), 0))}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-purple-100 p-3 rounded-lg dark:bg-purple-900/30">
              <BanknotesIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Ending Balance</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {forecast.length > 0 ? formatRupiah(forecast[forecast.length - 1].closing_balance) : formatRupiah(0)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashFlowManagement;
