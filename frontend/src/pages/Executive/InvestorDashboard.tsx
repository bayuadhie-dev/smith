import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, DollarSign, Factory, Shield, Users, Target,
  BarChart3, PieChart, Activity, AlertTriangle,
  CheckCircle, ArrowUpRight, ArrowDownRight, Download, Printer,
  Moon, Sun, FileText, Building, TrendingDown, Package
} from 'lucide-react';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import api from '../../utils/axiosConfig';
import { Skeleton, CardSkeleton, ChartSkeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const InvestorDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('financial');
  const [darkMode, setDarkMode] = useState(false);
  const [companyName, setCompanyName] = useState('Company');

  // Set document title
  useDocumentTitle('Executive Overview');

  // Load company settings
  useEffect(() => {
    const loadCompanySettings = async () => {
      try {
        const response = await api.get('/api/settings/company');
        setCompanyName(response.data.name || 'Company');
      } catch (error) {
        console.error('Failed to load company settings:', error);
      }
    };
    loadCompanySettings();
    
    const handleCompanyUpdate = () => {
      loadCompanySettings();
    };
    
    window.addEventListener('companySettingsUpdated', handleCompanyUpdate);
    return () => window.removeEventListener('companySettingsUpdated', handleCompanyUpdate);
  }, []);

  // Fetch all investor data
  const { data: financialSummary, isLoading: loadingFinancial } = useQuery({
    queryKey: ['investor-financial-summary'],
    queryFn: () => api.get('/api/executive/executive-overview/financial-summary').then(res => res.data.data)
  });

  const { data: financialRatios, isLoading: loadingRatios } = useQuery({
    queryKey: ['investor-financial-ratios'],
    queryFn: () => api.get('/api/executive/executive-overview/financial-ratios').then(res => res.data.data)
  });

  const { data: growthMetrics, isLoading: loadingGrowth } = useQuery({
    queryKey: ['investor-growth-metrics'],
    queryFn: () => api.get('/api/executive/executive-overview/growth-metrics').then(res => res.data.data)
  });

  const { data: operationalData, isLoading: loadingOperational } = useQuery({
    queryKey: ['investor-operational-excellence'],
    queryFn: () => api.get('/api/executive/executive-overview/operational-excellence').then(res => res.data.data)
  });

  const { data: riskData, isLoading: loadingRisk } = useQuery({
    queryKey: ['investor-risk-compliance'],
    queryFn: () => api.get('/api/executive/executive-overview/risk-compliance').then(res => res.data.data)
  });

  const { data: peopleData, isLoading: loadingPeople } = useQuery({
    queryKey: ['investor-people-culture'],
    queryFn: () => api.get('/api/executive/executive-overview/people-culture').then(res => res.data.data)
  });

  const { data: outlookData, isLoading: loadingOutlook } = useQuery({
    queryKey: ['investor-future-outlook'],
    queryFn: () => api.get('/api/executive/executive-overview/future-outlook').then(res => res.data.data)
  });

  const formatCurrency = (value: number) => {
    if (value >= 1000000000) return `Rp ${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `Rp ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `Rp ${(value / 1000).toFixed(1)}K`;
    return `Rp ${value}`;
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString('id-ID');
  };

  const tabs = [
    { id: 'financial', label: 'Financial', icon: DollarSign },
    { id: 'operational', label: 'Operational', icon: Factory },
    { id: 'growth', label: 'Growth', icon: TrendingUp },
    { id: 'risk', label: 'Risk & Compliance', icon: Shield },
    { id: 'people', label: 'People & Culture', icon: Users },
    { id: 'outlook', label: 'Future Outlook', icon: Target },
  ];

  const handleExport = async () => {
    try {
      console.log('Starting PDF export...');
      const response = await api.get('/api/executive/executive-overview/export-pdf', {
        responseType: 'blob'
      });
      
      console.log('PDF response received:', response);
      
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${companyName.replace(/\s+/g, '_')}_Executive_Overview_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      console.log('PDF download triggered');
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert('Failed to export PDF. Please check console for details.');
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-slate-900' : 'bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20'}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Executive Overview</h1>
            <p className="text-blue-100 mt-1">{companyName} - Executive Overview</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleDarkMode}
              className="p-2.5 bg-white/10 rounded-xl hover:bg-white/20 transition-all"
              title={darkMode ? 'Light Mode' : 'Dark Mode'}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={handleExport}
              className="p-2.5 bg-white/10 rounded-xl hover:bg-white/20 transition-all"
              title="Export to PDF"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={() => window.print()}
              className="p-2.5 bg-white/10 rounded-xl hover:bg-white/20 transition-all"
              title="Print"
            >
              <Printer className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-all border-b-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Financial Tab */}
        {activeTab === 'financial' && (
          <div className="space-y-6">
            {/* P&L Summary */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Profit & Loss Summary
              </h3>
              {loadingFinancial ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Revenue</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {formatCurrency(financialSummary?.profit_loss?.revenue || 0)}
                    </p>
                  </div>
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Gross Profit</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {formatCurrency(financialSummary?.profit_loss?.gross_profit || 0)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{financialSummary?.profit_loss?.gross_margin?.toFixed(1)}% margin</p>
                  </div>
                  <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Operating Profit</p>
                    <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1">
                      {formatCurrency(financialSummary?.profit_loss?.operating_profit || 0)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{financialSummary?.profit_loss?.operating_margin?.toFixed(1)}% margin</p>
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Net Income</p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {formatCurrency(financialSummary?.profit_loss?.net_income || 0)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{financialSummary?.profit_loss?.net_margin?.toFixed(1)}% margin</p>
                  </div>
                </div>
              )}
            </div>

            {/* Balance Sheet */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-600" />
                Balance Sheet Summary
              </h3>
              {loadingFinancial ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Current Assets</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      {formatCurrency(financialSummary?.balance_sheet?.current_assets || 0)}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Fixed Assets</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      {formatCurrency(financialSummary?.balance_sheet?.fixed_assets || 0)}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total Liabilities</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      {formatCurrency(financialSummary?.balance_sheet?.total_liabilities || 0)}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Equity</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      {formatCurrency(financialSummary?.balance_sheet?.equity || 0)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Financial Ratios */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Key Financial Ratios
              </h3>
              {loadingRatios ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Current Ratio</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {financialRatios?.liquidity?.current_ratio?.toFixed(2) || 0}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Liquidity</p>
                  </div>
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">ROA</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {financialRatios?.profitability?.roa?.toFixed(1) || 0}%
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Return on Assets</p>
                  </div>
                  <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">ROE</p>
                    <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1">
                      {financialRatios?.profitability?.roe?.toFixed(1) || 0}%
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Return on Equity</p>
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Debt-to-Equity</p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {financialRatios?.solvency?.debt_to_equity?.toFixed(2) || 0}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Solvency</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Operational Tab */}
        {activeTab === 'operational' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Factory className="w-5 h-5 text-blue-600" />
                Production Excellence
              </h3>
              {loadingOperational ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total Output</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {formatNumber(operationalData?.production?.total_output || 0)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">units</p>
                  </div>
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Avg OEE</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {operationalData?.production?.avg_oee?.toFixed(1) || 0}%
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Efficiency</p>
                  </div>
                  <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Capacity Utilization</p>
                    <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1">
                      {operationalData?.production?.capacity_utilization?.toFixed(1) || 0}%
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Utilization</p>
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">WIP Value</p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {formatCurrency(operationalData?.production?.wip_value || 0)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Work in Process</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                Quality Metrics
              </h3>
              {loadingOperational ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <CardSkeleton /><CardSkeleton /><CardSkeleton />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">First Pass Yield</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {operationalData?.quality?.first_pass_yield?.toFixed(1) || 0}%
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Return Rate</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                      {operationalData?.quality?.return_rate?.toFixed(2) || 0}%
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total Inspections</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {formatNumber(operationalData?.quality?.total_inspections || 0)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Supply Chain
              </h3>
              {loadingOperational ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <CardSkeleton /><CardSkeleton /><CardSkeleton />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Supplier OTD</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {operationalData?.supply_chain?.supplier_otd || 0}%
                    </p>
                    <p className="text-xs text-slate-500 mt-1">On-Time Delivery</p>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Inventory Turnover</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {operationalData?.supply_chain?.inventory_turnover?.toFixed(2) || 0}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">times/year</p>
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Stockout Rate</p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {operationalData?.supply_chain?.stockout_rate?.toFixed(2) || 0}%
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Growth Tab */}
        {activeTab === 'growth' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Year-over-Year Growth
              </h3>
              {loadingGrowth ? (
                <div className="grid grid-cols-2 gap-4">
                  <CardSkeleton /><CardSkeleton />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Revenue Growth</p>
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                        {growthMetrics?.yoy_growth?.revenue?.growth_percent?.toFixed(1) || 0}%
                      </p>
                      {(growthMetrics?.yoy_growth?.revenue?.growth_percent || 0) >= 0 ? (
                        <ArrowUpRight className="w-6 h-6 text-emerald-500" />
                      ) : (
                        <ArrowDownRight className="w-6 h-6 text-red-500" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {formatCurrency(growthMetrics?.yoy_growth?.revenue?.current || 0)} vs {formatCurrency(growthMetrics?.yoy_growth?.revenue?.previous || 0)}
                    </p>
                  </div>
                  <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Production Growth</p>
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                        {growthMetrics?.yoy_growth?.production?.growth_percent?.toFixed(1) || 0}%
                      </p>
                      {(growthMetrics?.yoy_growth?.production?.growth_percent || 0) >= 0 ? (
                        <ArrowUpRight className="w-6 h-6 text-emerald-500" />
                      ) : (
                        <ArrowDownRight className="w-6 h-6 text-red-500" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {formatNumber(growthMetrics?.yoy_growth?.production?.current || 0)} vs {formatNumber(growthMetrics?.yoy_growth?.production?.previous || 0)} units
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <LineChart className="w-5 h-5 text-blue-600" />
                3-Year CAGR (Compound Annual Growth Rate)
              </h3>
              {loadingGrowth ? (
                <div className="grid grid-cols-2 gap-4">
                  <CardSkeleton /><CardSkeleton />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Revenue CAGR</p>
                    <p className="text-3xl font-bold text-violet-600 dark:text-violet-400 mt-2">
                      {growthMetrics?.cagr?.revenue_3y?.toFixed(1) || 0}%
                    </p>
                    <p className="text-xs text-slate-500 mt-2">3-year compound growth</p>
                  </div>
                  <div className="p-6 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Production CAGR</p>
                    <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                      {growthMetrics?.cagr?.production_3y?.toFixed(1) || 0}%
                    </p>
                    <p className="text-xs text-slate-500 mt-2">3-year compound growth</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Risk Tab */}
        {activeTab === 'risk' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                Financial Health
              </h3>
              {loadingRisk ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <CardSkeleton /><CardSkeleton /><CardSkeleton />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Overdue Invoices</p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {riskData?.financial_health?.overdue_invoices || 0}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{formatCurrency(riskData?.financial_health?.overdue_amount || 0)}</p>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total Debt</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                      {formatCurrency(riskData?.financial_health?.total_debt || 0)}
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Current Debt</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {formatCurrency(riskData?.financial_health?.current_debt || 0)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-blue-600" />
                Operational Risks
              </h3>
              {loadingRisk ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <CardSkeleton /><CardSkeleton /><CardSkeleton />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Low Stock Items</p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {riskData?.operational_risks?.low_stock_items || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Low OEE Machines</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                      {riskData?.operational_risks?.low_oee_machines || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Pending Maintenance</p>
                    <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1">
                      {riskData?.operational_risks?.pending_maintenance || 0}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Compliance Status
              </h3>
              {loadingRisk ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <CardSkeleton /><CardSkeleton /><CardSkeleton />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">ISO 9001:2015</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 capitalize">
                      {riskData?.compliance?.iso_9001_status || 'N/A'}
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Active Documents</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {riskData?.compliance?.active_documents || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Safety Incidents YTD</p>
                    <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1">
                      {riskData?.compliance?.safety_incidents_ytd || 0}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* People Tab */}
        {activeTab === 'people' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Workforce
              </h3>
              {loadingPeople ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <CardSkeleton /><CardSkeleton /><CardSkeleton />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total Employees</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {peopleData?.workforce?.total_employees || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Turnover Rate</p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {peopleData?.workforce?.turnover_rate?.toFixed(1) || 0}%
                    </p>
                  </div>
                  <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Training Hours/Employee</p>
                    <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1">
                      {peopleData?.workforce?.training_hours_per_employee || 0}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Productivity
              </h3>
              {loadingPeople ? (
                <div className="grid grid-cols-2 gap-4">
                  <CardSkeleton /><CardSkeleton />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Output per Employee</p>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                      {formatNumber(peopleData?.productivity?.output_per_employee || 0)}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">units/employee</p>
                  </div>
                  <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Revenue per Employee</p>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                      {formatCurrency(peopleData?.productivity?.revenue_per_employee || 0)}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">IDR/employee</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Outlook Tab */}
        {activeTab === 'outlook' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                Pipeline
              </h3>
              {loadingOutlook ? (
                <div className="grid grid-cols-2 gap-4">
                  <CardSkeleton /><CardSkeleton />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Sales Pipeline Value</p>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                      {formatCurrency(outlookData?.pipeline?.sales_pipeline_value || 0)}
                    </p>
                  </div>
                  <div className="p-6 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">WIP Orders</p>
                    <p className="text-3xl font-bold text-violet-600 dark:text-violet-400 mt-2">
                      {outlookData?.pipeline?.wip_orders || 0}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">Work in Progress</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Forecast
              </h3>
              {loadingOutlook ? (
                <div className="grid grid-cols-2 gap-4">
                  <CardSkeleton /><CardSkeleton />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Last Quarter Revenue</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                      {formatCurrency(outlookData?.forecast?.last_quarter_revenue || 0)}
                    </p>
                  </div>
                  <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Forecast Next Quarter</p>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                      {formatCurrency(outlookData?.forecast?.forecast_next_quarter || 0)}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">Projected</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-600" />
                Investment Needs
              </h3>
              {loadingOutlook ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <CardSkeleton /><CardSkeleton /><CardSkeleton />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">CAPEX Requirements</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {formatCurrency(outlookData?.investment_needs?.capex_requirements || 0)}
                    </p>
                  </div>
                  <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">R&D Projects</p>
                    <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1">
                      {outlookData?.investment_needs?.rnd_projects || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Expansion Plans</p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {outlookData?.investment_needs?.expansion_plans?.length || 0}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvestorDashboard;
