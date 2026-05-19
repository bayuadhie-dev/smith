import React, { useState, useEffect, useMemo } from 'react';
import {
  ChartBarIcon, ExclamationTriangleIcon,
  ClockIcon, CubeIcon, CogIcon, ChevronDownIcon, ChevronUpIcon,
  PresentationChartLineIcon, CalendarDaysIcon, ArrowsRightLeftIcon,
  BoltIcon, BeakerIcon
} from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import DowntimeActionItems from '../../components/Production/DowntimeActionItems';
import DailyControllerSwiper from '../../components/Production/DailyControllerSwiper';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

const GRADE_COLORS = { a: '#22C55E', b: '#F59E0B', c: '#EF4444' };
const DOWNTIME_COLORS: Record<string, string> = {
  mesin: '#EF4444', operator: '#F59E0B', material: '#3B82F6', design: '#8B5CF6', idle: '#FCD34D', others: '#6B7280'
};
const CATEGORY_LABELS: Record<string, string> = {
  mesin: 'Mesin', operator: 'Operator', material: 'Material', design: 'Design', idle: 'Idle', others: 'Lainnya'
};
const MONTHS = [
  { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' }, { value: 3, label: 'Maret' },
  { value: 4, label: 'April' }, { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' }, { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' }, { value: 11, label: 'November' }, { value: 12, label: 'Desember' }
];

const fmtNum = (n: number) => n.toLocaleString('id-ID');
const fmtMin = (m: number) => {
  if (m >= 60) return `${Math.floor(m / 60)}j ${m % 60}m`;
  return `${m}m`;
};

// Strip packaging suffix from product name (e.g., "@96", "@12X2")
const stripPackagingSuffix = (productName: string): string => {
  if (!productName) return productName;
  // Remove patterns like @96, @12X2, @27X3, etc.
  return productName.replace(/\s*@\d+[xX]?\d*\s*$/i, '').trim();
};

const ProductionMonitoringDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [viewMode, setViewMode] = useState<'monthly' | 'weekly'>('monthly');
  const [weekNumber, setWeekNumber] = useState(0);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'overview' | 'daily' | 'dailySwiper' | 'products' | 'machines' | 'downtime' | 'graph' | 'fg' | 'shift' | 'analytics'>('overview');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5); // minutes
  const [fgData, setFgData] = useState<any>(null);
  const [fgLoading, setFgLoading] = useState(false);
  const [fgFetched, setFgFetched] = useState(false);

  // Prevent search engine indexing
  useEffect(() => {
    // Add noindex meta tag
    const metaRobots = document.createElement('meta');
    metaRobots.name = 'robots';
    metaRobots.content = 'noindex, nofollow';
    document.head.appendChild(metaRobots);
    
    return () => {
      document.head.removeChild(metaRobots);
    };
  }, []);

  // Force light mode for public view
  useEffect(() => {
    // Remove dark class from html element
    document.documentElement.classList.remove('dark');
    // Force light background
    document.documentElement.style.backgroundColor = '#f9fafb';
    document.body.style.backgroundColor = '#f9fafb';
    
    // Add custom CSS to override ALL dark mode styles
    const style = document.createElement('style');
    style.id = 'force-light-mode';
    style.textContent = `
      /* Force light mode - override ALL dark variants */
      [class*="dark:"] { color: inherit !important; }
      
      /* Backgrounds */
      .dark\\:bg-gray-800, 
      .dark\\:bg-gray-900,
      .dark\\:bg-gray-700 { 
        background-color: white !important; 
      }
      
      /* Text colors */
      .dark\\:text-white,
      .dark\\:text-gray-100 { 
        color: #111827 !important; 
      }
      .dark\\:text-gray-200 { color: #374151 !important; }
      .dark\\:text-gray-300 { color: #4b5563 !important; }
      .dark\\:text-gray-400 { color: #6b7280 !important; }
      
      /* Borders */
      .dark\\:border-gray-700,
      .dark\\:border-gray-600 { 
        border-color: #e5e7eb !important; 
      }
      
      /* Hover states */
      .dark\\:hover\\:bg-gray-700:hover,
      .dark\\:hover\\:bg-gray-800:hover { 
        background-color: #f3f4f6 !important; 
      }
      .dark\\:hover\\:bg-gray-900\\/50:hover { 
        background-color: #f9fafb !important; 
      }
      
      /* Specific overrides for this page */
      .bg-gray-50 { background-color: #f9fafb !important; }
      
      /* Ensure all cards are white */
      .rounded-xl, .rounded-2xl {
        background-color: white;
      }
      
      /* Ensure all text is readable */
      body, div, span, p, td, th, label {
        color: #111827;
      }
      
      /* Keep colored text as is */
      .text-blue-600, .text-red-600, .text-green-600, 
      .text-yellow-600, .text-indigo-600 {
        /* Keep original colors */
      }
      
      /* Fix select/dropdown backgrounds */
      select, option {
        background-color: white !important;
        color: #111827 !important;
      }
      
      /* Fix switch/toggle backgrounds */
      .bg-white\\/20,
      .dark\\:bg-gray-800\\/20 {
        background-color: rgba(255, 255, 255, 0.3) !important;
      }
      
      /* Fix button text in header */
      button {
        color: inherit;
      }
      
      /* Ensure dropdown options are readable */
      select option {
        background-color: white !important;
        color: #111827 !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      // Cleanup
      document.documentElement.style.backgroundColor = '';
      document.body.style.backgroundColor = '';
      const styleEl = document.getElementById('force-light-mode');
      if (styleEl) styleEl.remove();
      
      // Restore dark mode preference on unmount if needed
      const isDark = localStorage.getItem('theme') === 'dark';
      if (isDark) {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  useEffect(() => { fetchData(); }, [year, month, viewMode, weekNumber]);

  // When month/year changes, reset weekNumber to 0 (show all weeks)
  useEffect(() => {
    setWeekNumber(0);
  }, [year, month]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;
    
    const intervalId = setInterval(() => {
      fetchData();
    }, refreshInterval * 60 * 1000); // Convert minutes to milliseconds
    
    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, year, month, viewMode, weekNumber]);

  const fetchFgData = async () => {
    try {
      setFgLoading(true);
      const params = new URLSearchParams({ year: String(year), month: String(month) });
      const res = await axiosInstance.get(`/api/executive/fg-conversion-summary?${params}`);
      if (res.data.success) setFgData(res.data.data);
    } catch (e) { console.error(e); } finally { setFgLoading(false); setFgFetched(true); }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ year: String(year), month: String(month), view: viewMode });
      if (viewMode === 'weekly' && weekNumber > 0) params.set('week', String(weekNumber));
      const res = await axiosInstance.get(`/api/executive/production-monitoring?${params}`);
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const toggleDay = (date: string) => {
    setExpandedDays(prev => { const n = new Set(prev); n.has(date) ? n.delete(date) : n.add(date); return n; });
  };

  // Calculate daily target breakdown
  const calculateDailyTarget = (weeklyTarget: number, workingDays: number) => {
    if (workingDays === 0) return 0;
    return Math.ceil(weeklyTarget / workingDays);
  };

  const dailyChartData = useMemo(() => {
    if (!data) return [];
    return data.daily_table.map((d: any) => ({
      date: d.date.split('-')[2], grade_a: d.day_summary.grade_a, grade_b: d.day_summary.grade_b,
      grade_c: d.day_summary.grade_c, ctn: d.day_summary.total_ctn,
      runtime: +(d.day_summary.runtime / 60).toFixed(1), downtime: +(d.day_summary.downtime / 60).toFixed(1),
      idle: +(d.day_summary.idle_time / 60).toFixed(1)
    }));
  }, [data]);

  const timePieData = useMemo(() => {
    if (!data) return [];
    const s = data.summary;
    return [
      { name: 'Runtime', value: s.runtime_minutes, color: '#22C55E' },
      { name: 'Downtime', value: s.downtime_minutes, color: '#EF4444' },
      { name: 'Idle Time', value: s.idle_time_minutes, color: '#F59E0B' }
    ].filter((d: any) => d.value > 0);
  }, [data]);

  const downtimePieData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.downtime_by_category)
      .filter(([_, v]) => (v as number) > 0)
      .map(([k, v]) => ({ name: CATEGORY_LABELS[k] || k, value: v as number, color: DOWNTIME_COLORS[k] || '#6B7280' }));
  }, [data]);

  // Compute display values based on viewMode (must be before conditional returns)
  const displaySummary = useMemo(() => {
    if (!data || !data.summary) return null;
    
    if (viewMode === 'weekly' && data.weekly_summary) {
      // Use weekly summary data
      return {
        target_ctn: data.weekly_summary.target_ctn || 0,
        actual_ctn: data.weekly_summary.actual_ctn || 0,
        gap_ctn: data.weekly_summary.gap_ctn || 0,
        achievement_pct: data.weekly_summary.achievement_pct || 0,
        daily_target_ctn: data.weekly_summary.daily_target_ctn || 0,
        total_working_days: data.weekly_summary.working_days || 5,
        working_days: data.weekly_summary.days_elapsed || 0,
        total_grade_a: data.weekly_summary.total_grade_a || 0,
        total_grade_b: data.weekly_summary.total_grade_b || 0,
        total_grade_c: data.weekly_summary.total_grade_c || 0,
        total_pcs: data.weekly_summary.total_pcs || 0,
        quality_rate: data.weekly_summary.quality_rate || 0,
        runtime_minutes: data.weekly_summary.runtime_minutes || 0,
        downtime_minutes: data.weekly_summary.downtime_minutes || 0,
        idle_time_minutes: data.weekly_summary.idle_time_minutes || 0,
        planned_runtime_minutes: data.weekly_summary.planned_runtime_minutes || 0,
        runtime_hours: data.weekly_summary.runtime_hours || 0,
        downtime_hours: data.weekly_summary.downtime_hours || 0,
        idle_hours: data.weekly_summary.idle_hours || 0,
        is_behind: data.weekly_summary.is_behind || false,
        behind_pct: data.weekly_summary.behind_pct || 0,
      };
    }
    // Use monthly summary (default)
    return data.summary;
  }, [viewMode, data]);

  const displayLabel = viewMode === 'weekly' ? 'Mingguan' : 'Bulanan';

  if (loading) return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>;
  if (!data || !displaySummary) return <div className="p-6 text-center text-gray-500 dark:text-gray-400">Tidak ada data tersedia</div>;

  const { summary, period } = data;
  const isCritical = displaySummary.achievement_pct < 50;
  const isOnTrack = displaySummary.achievement_pct >= 80;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: ChartBarIcon },
    { id: 'daily', label: 'Detail Harian', icon: ClockIcon },
    { id: 'dailySwiper', label: 'Controller', icon: CalendarDaysIcon },
    { id: 'products', label: 'Per Produk', icon: CubeIcon },
    { id: 'machines', label: 'Per Mesin', icon: CogIcon },
    { id: 'downtime', label: 'Downtime', icon: ExclamationTriangleIcon },
    { id: 'graph', label: 'Graph', icon: PresentationChartLineIcon },
    { id: 'fg', label: 'FG Conversion', icon: ArrowsRightLeftIcon },
    { id: 'shift', label: 'Per Shift', icon: BoltIcon },
    { id: 'analytics', label: 'Analytics', icon: BeakerIcon },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5 bg-gray-50 min-h-screen">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 rounded-2xl p-5 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ChartBarIcon className="h-7 w-7" /> Production Monitoring Dashboard
            </h1>
            <p className="text-blue-100 text-sm mt-1">
              Target vs Aktual &bull; {period.month_name} {period.year}
              {viewMode === 'weekly' && weekNumber > 0 && ` - Week ${weekNumber}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-white dark:bg-gray-800/20 rounded-lg p-0.5">
              <button onClick={() => { setViewMode('monthly'); setWeekNumber(0); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'monthly' ? 'bg-white text-blue-700' : 'text-white hover:bg-white/10'}`}>Monthly</button>
              <button onClick={() => { setViewMode('weekly'); setWeekNumber(0); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'weekly' ? 'bg-white text-blue-700' : 'text-white hover:bg-white/10'}`}>Weekly</button>
            </div>
            {viewMode === 'weekly' && period.weeks && (
              <select value={weekNumber} onChange={e => setWeekNumber(+e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-gray-800/20 border border-white/30 rounded-lg text-white text-sm focus:outline-none">
                <option value={0} className="text-gray-900 dark:text-white">Semua Week</option>
                {period.weeks.map((w: any) => <option key={w.week} value={w.week} className="text-gray-900 dark:text-white">{w.label}</option>)}
              </select>
            )}
            <select value={month} onChange={e => setMonth(+e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-gray-800/20 border border-white/30 rounded-lg text-white text-sm focus:outline-none">
              {MONTHS.map(m => <option key={m.value} value={m.value} className="text-gray-900 dark:text-white">{m.label}</option>)}
            </select>
            <select value={year} onChange={e => setYear(+e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-gray-800/20 border border-white/30 rounded-lg text-white text-sm focus:outline-none">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y} className="text-gray-900 dark:text-white">{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. TARGET */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Target {displayLabel}</p>
          <p className="text-xl font-bold text-blue-600">{fmtNum(displaySummary.target_ctn)} ctn</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Per hari: <span className="font-semibold text-blue-500">{fmtNum(displaySummary.daily_target_ctn || 0)} ctn</span>
          </p>
          <p className="text-[10px] text-gray-400">({displaySummary.total_working_days || 22} hari kerja/{viewMode === 'weekly' ? 'minggu' : 'bulan'})</p>
        </div>
        {/* 2. GAP + Achievement % */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Gap dari Target</p>
          <p className={`text-xl font-bold ${displaySummary.gap_ctn > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {displaySummary.gap_ctn > 0 ? '-' : '+'}{fmtNum(Math.abs(Math.round(displaySummary.gap_ctn)))} ctn
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Tercapai: <span className={`font-semibold ${displaySummary.achievement_pct >= 80 ? 'text-green-600' : displaySummary.achievement_pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{displaySummary.achievement_pct}%</span> dari target
          </p>
          <p className="text-[10px] text-gray-400">Aktual {fmtNum(Math.round(displaySummary.actual_ctn))} ctn &bull; Hari {displaySummary.working_days}/{displaySummary.total_working_days || 22}</p>
        </div>
        {/* 3. ACHIEVEMENT + WARNING */}
        <div className={`rounded-xl p-4 shadow-lg text-white relative overflow-hidden ${isCritical ? 'bg-gradient-to-br from-red-500 to-red-600' : isOnTrack ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-yellow-500 to-yellow-600'}`}>
          <p className="text-xs opacity-80 font-medium">Achievement</p>
          <p className="text-2xl font-bold">{fmtNum(Math.round(displaySummary.actual_ctn))} ctn</p>
          <p className="text-[10px] opacity-80">
            dari {fmtNum(Math.round(displaySummary.target_ctn))} ctn ({displaySummary.achievement_pct}%)
          </p>
          <p className="text-[10px] opacity-80 mt-0.5">
            Seharusnya: {fmtNum(Math.round(displaySummary.daily_target_ctn * displaySummary.working_days))} ctn (hari ke-{displaySummary.working_days})
          </p>
          {displaySummary.is_behind && (
            <div className="mt-1 bg-white dark:bg-gray-800/20 rounded px-1.5 py-0.5 inline-flex items-center gap-1">
              <ExclamationTriangleIcon className="h-3 w-3" />
              <span className="text-[10px] font-bold">BEHIND {displaySummary.behind_pct}%</span>
            </div>
          )}
        </div>
        {/* 4. GRADE A/B/C */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Grade A / B / C</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg font-bold text-green-600">{fmtNum(displaySummary.total_grade_a)}</span>
            <span className="text-gray-400">/</span>
            <span className="text-sm font-semibold text-yellow-500">{fmtNum(displaySummary.total_grade_b)}</span>
            <span className="text-gray-400">/</span>
            <span className="text-sm font-semibold text-red-500">{fmtNum(displaySummary.total_grade_c)}</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Quality: {displaySummary.quality_rate}% &bull; Reject: <span className="text-red-500 font-semibold">{displaySummary.total_pcs > 0 ? ((displaySummary.total_grade_c / displaySummary.total_pcs) * 100).toFixed(2) : 0}%</span></p>
        </div>
        {/* 5. WAKTU (RT / DT / IDLE gabungan) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Waktu Produksi <span className="text-gray-400">(Planned: {displaySummary.planned_runtime_minutes > 0 ? (displaySummary.planned_runtime_minutes / 60).toFixed(1) : 0}j)</span></p>
          {/* Stacked bar */}
          <div className="flex rounded-full h-3 overflow-hidden mt-2 mb-2">
            {displaySummary.planned_runtime_minutes > 0 ? (<>
              <div className="bg-green-500" style={{ width: `${(displaySummary.runtime_minutes / displaySummary.planned_runtime_minutes * 100)}%` }} />
              <div className="bg-red-500" style={{ width: `${(displaySummary.downtime_minutes / displaySummary.planned_runtime_minutes * 100)}%` }} />
              <div className="bg-yellow-400" style={{ width: `${(displaySummary.idle_time_minutes / displaySummary.planned_runtime_minutes * 100)}%` }} />
            </>) : <div className="bg-gray-300 w-full" />}
          </div>
          <div className="space-y-0.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-green-600 font-medium">Runtime</span>
              <span className="text-gray-700 dark:text-gray-200">{displaySummary.runtime_hours}j <span className="text-green-600 font-semibold">({displaySummary.planned_runtime_minutes > 0 ? (displaySummary.runtime_minutes / displaySummary.planned_runtime_minutes * 100).toFixed(1) : 0}%)</span></span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-500 font-medium">Downtime</span>
              <span className="text-gray-700 dark:text-gray-200">{displaySummary.downtime_hours}j <span className="text-red-500 font-semibold">({displaySummary.planned_runtime_minutes > 0 ? (displaySummary.downtime_minutes / displaySummary.planned_runtime_minutes * 100).toFixed(1) : 0}%)</span></span>
            </div>
            <div className="flex justify-between">
              <span className="text-yellow-500 font-medium">Idle</span>
              <span className="text-gray-700 dark:text-gray-200">{displaySummary.idle_hours}j <span className="text-yellow-500 font-semibold">({displaySummary.planned_runtime_minutes > 0 ? (displaySummary.idle_time_minutes / displaySummary.planned_runtime_minutes * 100).toFixed(1) : 0}%)</span></span>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">WO: {data.work_orders.completed}/{data.work_orders.total} selesai</p>
        </div>
      </div>

      {/* AUTO-REFRESH CONTROL */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Auto-refresh</span>
          </label>
          {autoRefresh && (
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(+e.target.value)}
              className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1 menit</option>
              <option value={2}>2 menit</option>
              <option value={5}>5 menit</option>
              <option value={10}>10 menit</option>
              <option value={15}>15 menit</option>
            </select>
          )}
        </div>
        <button
          onClick={fetchData}
          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          🔄 Refresh Now
        </button>
      </div>

      {/* TAB NAVIGATION */}
      <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-xl p-1 shadow border overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${activeTab === t.id ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'overview' && <OverviewTab data={data} dailyChartData={dailyChartData} timePieData={timePieData} downtimePieData={downtimePieData} displaySummary={displaySummary} viewMode={viewMode} />}
      {activeTab === 'daily' && <DailyTab data={data} expandedDays={expandedDays} toggleDay={toggleDay} calculateDailyTarget={calculateDailyTarget} />}
      {activeTab === 'dailySwiper' && (
        <div className="mt-6">
          <DailyControllerSwiper
            year={year}
            month={month}
            startDate={data?.period?.start_date || ''}
            endDate={data?.period?.end_date || ''}
          />
        </div>
      )}
      {activeTab === 'products' && <ProductsTab data={data} />}
      {activeTab === 'machines' && <MachinesTab data={data} />}
      {activeTab === 'downtime' && <DowntimeTab data={data} downtimePieData={downtimePieData} />}
      {activeTab === 'graph' && <GraphTab data={data} />}
      {activeTab === 'shift' && <ShiftTab data={data} />}
      {activeTab === 'analytics' && <AnalyticsTab data={data} dailyChartData={dailyChartData} />}
      {activeTab === 'fg' && (
        <FGConversionTab
          fgData={fgData}
          fgLoading={fgLoading}
          fgFetched={fgFetched}
          onFetch={fetchFgData}
          year={year}
          month={month}
        />
      )}
    </div>
  );
};

// ==================== OVERVIEW TAB ====================
const OverviewTab: React.FC<{ data: any; dailyChartData: any[]; timePieData: any[]; downtimePieData: any[]; displaySummary: any; viewMode: string }> = ({ data, dailyChartData, timePieData, downtimePieData, displaySummary, viewMode }) => {
  const s = displaySummary || {};
  const totalWd = s.total_working_days || 22;
  const elapsed = s.working_days || 0;
  const actual = s.actual_ctn || 0;
  const target = s.target_ctn || 0;
  const projectedCtn = elapsed > 0 ? Math.round(actual / elapsed * totalWd) : 0;
  const projectedPct = target > 0 ? Math.round(projectedCtn / target * 100) : 0;
  const paceStatus = projectedPct >= 100 ? 'ahead' : projectedPct >= 85 ? 'on-track' : projectedPct >= 70 ? 'at-risk' : 'behind';
  const paceColor = { ahead: 'from-green-500 to-emerald-600', 'on-track': 'from-blue-500 to-indigo-600', 'at-risk': 'from-yellow-500 to-orange-500', behind: 'from-red-500 to-rose-600' }[paceStatus];
  const paceLabel = { ahead: 'Di Atas Target', 'on-track': 'Sesuai Target', 'at-risk': 'Perlu Perhatian', behind: 'Di Bawah Target' }[paceStatus];
  const remainingDays = Math.max(0, totalWd - elapsed);
  const neededPerDay = remainingDays > 0 ? Math.ceil((target - actual) / remainingDays) : 0;

  const timePct = Math.round(elapsed / totalWd * 100);
  const achievePct = Math.min(100, s.achievement_pct || 0);

  return (
  <div className="space-y-5">
    {/* Pace Indicator */}
    <div className={`bg-gradient-to-r ${paceColor} rounded-2xl p-5 text-white shadow-xl`}>
      {/* Header row */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
        {/* Left: projection summary */}
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-2">
            📈 Proyeksi Akhir {viewMode === 'weekly' ? 'Minggu' : 'Bulan'}
          </p>
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-extrabold leading-none">{projectedPct}%</span>
            <span className="text-sm font-bold px-3 py-1 rounded-full bg-black/20 border border-white/30">{paceLabel}</span>
          </div>
          <p className="text-sm text-white/80 mt-2">
            Proyeksi: <strong className="text-white">{fmtNum(projectedCtn)} ctn</strong>
            <span className="text-white/60 mx-1.5">dari target</span>
            <strong className="text-white">{fmtNum(Math.round(target))} ctn</strong>
          </p>
        </div>
        {/* Right: 3 metric cards */}
        <div className="grid grid-cols-3 gap-3 text-center min-w-[300px]">
          {[
            { label: '📅 Hari Berlalu', value: `${elapsed}/${totalWd}`, sub: 'hari kerja' },
            { label: '📦 Produksi Aktual', value: fmtNum(Math.round(actual)), sub: 'carton' },
            { label: '⚡ Target/Hari Sisa', value: fmtNum(neededPerDay), sub: 'ctn/hari' },
          ].map(c => (
            <div key={c.label} className="bg-black/20 border border-white/20 rounded-xl px-3 py-3">
              <p className="text-[10px] font-semibold text-white/70 mb-1 leading-tight">{c.label}</p>
              <p className="text-xl font-extrabold text-white leading-none">{c.value}</p>
              <p className="text-[10px] text-white/50 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>
      </div>
      {/* Progress bars — clearly separated */}
      <div className="space-y-2">
        {/* Achievement bar */}
        <div>
          <div className="flex justify-between text-xs font-semibold text-white/90 mb-1">
            <span>📦 Achievement Produksi</span>
            <span>{achievePct}%</span>
          </div>
          <div className="w-full bg-black/20 rounded-full h-3 border border-white/10">
            <div className="h-3 rounded-full bg-white transition-all duration-500"
              style={{ width: `${achievePct}%` }} />
          </div>
        </div>
        {/* Time progress bar */}
        <div>
          <div className="flex justify-between text-xs font-semibold text-white/70 mb-1">
            <span>🕐 Progress Waktu</span>
            <span>{timePct}%</span>
          </div>
          <div className="w-full bg-black/10 rounded-full h-2 border border-white/10">
            <div className="h-2 rounded-full bg-white/50 transition-all duration-500"
              style={{ width: `${timePct}%` }} />
          </div>
        </div>
        {/* Gap indicator */}
        <p className="text-xs text-white/60 text-right pt-0.5">
          {achievePct >= timePct
            ? `✅ Produksi ${achievePct - timePct}% di atas progress waktu`
            : `⚠️ Produksi ${timePct - achievePct}% tertinggal dari progress waktu`}
        </p>
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Daily Production Trend */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow border">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Trend Produksi Harian (pcs)</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmtNum(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="grade_a" name="Grade A" fill={GRADE_COLORS.a} stackId="prod" />
              <Bar dataKey="grade_b" name="Grade B" fill={GRADE_COLORS.b} stackId="prod" />
              <Bar dataKey="grade_c" name="Grade C" fill={GRADE_COLORS.c} stackId="prod" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Time Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow border">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Distribusi Waktu</h3>
        <div className="h-72 flex items-center">
          {timePieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={timePieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value"
                  label={({ name, value }) => `${name}: ${fmtMin(value)}`}>
                  {timePieData.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtMin(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="w-full text-center text-gray-400">No data</p>}
        </div>
        <div className="flex justify-center gap-5 mt-2">
          {[{ l: 'Runtime', c: '#22C55E' }, { l: 'Downtime', c: '#EF4444' }, { l: 'Idle', c: '#F59E0B' }].map(x => (
            <div key={x.l} className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: x.c }} /><span className="text-xs text-gray-600 dark:text-gray-300">{x.l}</span></div>
          ))}
        </div>
      </div>
    </div>

    {/* Runtime / Downtime / Idle per Day */}
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow border">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Runtime / Downtime / Idle Harian (jam)</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dailyChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${v} jam`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="runtime" name="Runtime" stroke="#22C55E" fill="#BBF7D0" />
            <Area type="monotone" dataKey="downtime" name="Downtime" stroke="#EF4444" fill="#FECACA" />
            <Area type="monotone" dataKey="idle" name="Idle" stroke="#F59E0B" fill="#FEF08A" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>

    {/* Product Achievement Summary (top 10) */}
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow border">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Achievement per Produk</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300">
              <th className="px-3 py-2 text-left">Produk</th>
              <th className="px-3 py-2 text-left">Mesin</th>
              <th className="px-3 py-2 text-right">Target (ctn)</th>
              <th className="px-3 py-2 text-right">Aktual (ctn)</th>
              <th className="px-3 py-2 text-right">Gap</th>
              <th className="px-3 py-2 text-right">A / B / C</th>
              <th className="px-3 py-2 text-right">Achievement</th>
              <th className="px-3 py-2 text-left">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.products.slice(0, 10).map((p: any, i: number) => (
              <tr key={i} className={`hover:bg-gray-50 ${p.achievement_pct < 50 ? 'bg-red-50/50' : ''}`}>
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{stripPackagingSuffix(p.product_name)}</td>
                <td className="px-3 py-2 text-left text-gray-600 dark:text-gray-300 text-xs">{p.machines || 'N/A'}</td>
                <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">{fmtNum(p.target_ctn)}</td>
                <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">{fmtNum(Math.round(p.actual_ctn))}</td>
                <td className={`px-3 py-2 text-right font-medium ${p.gap_ctn > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {p.gap_ctn > 0 ? '-' : '+'}{fmtNum(Math.abs(Math.round(p.gap_ctn)))}
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="text-green-600">{fmtNum(p.grade_a)}</span>
                  <span className="text-gray-400"> / </span>
                  <span className="text-yellow-500">{fmtNum(p.grade_b)}</span>
                  <span className="text-gray-400"> / </span>
                  <span className="text-red-500">{fmtNum(p.grade_c)}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.achievement_pct >= 80 ? 'bg-green-100 text-green-700' : p.achievement_pct >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                    {p.achievement_pct}%
                  </span>
                </td>
                <td className="px-3 py-2 w-32">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className={`h-2 rounded-full ${p.achievement_pct >= 80 ? 'bg-green-500' : p.achievement_pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(p.achievement_pct, 100)}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  );
};

// ==================== DAILY TAB ====================
const DailyTab: React.FC<{ data: any; expandedDays: Set<string>; toggleDay: (d: string) => void; calculateDailyTarget: (weeklyTarget: number, workingDays: number) => number }> = ({ data, expandedDays, toggleDay, calculateDailyTarget }) => {
  const dayNames: Record<string, string> = {
    Monday: 'Senin', Tuesday: 'Selasa', Wednesday: 'Rabu', Thursday: 'Kamis',
    Friday: 'Jumat', Saturday: 'Sabtu', Sunday: 'Minggu'
  };

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border overflow-hidden">
        <div className="p-4 border-b bg-gray-50 dark:bg-gray-900">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Detail Harian - Produksi per Hari per Produk</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Klik tanggal untuk melihat detail shift, mesin, dan work order</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium">
                <th className="px-3 py-2.5 text-left sticky left-0 bg-gray-100 dark:bg-gray-800 z-10">Tanggal</th>
                <th className="px-3 py-2.5 text-left">Produk</th>
                <th className="px-2 py-2.5 text-left">Mesin</th>
                <th className="px-2 py-2.5 text-right text-green-700">Grade A</th>
                <th className="px-2 py-2.5 text-right text-yellow-700">Grade B</th>
                <th className="px-2 py-2.5 text-right text-red-700">Grade C</th>
                <th className="px-2 py-2.5 text-right">Total (pcs)</th>
                <th className="px-2 py-2.5 text-right">Karton</th>
                <th className="px-2 py-2.5 text-right">Kumulatif</th>
                <th className="px-2 py-2.5 text-right">Target</th>
                <th className="px-2 py-2.5 text-right">Sisa</th>
                <th className="px-2 py-2.5 text-right text-green-700">RT</th>
                <th className="px-2 py-2.5 text-right text-red-700">DT</th>
                <th className="px-2 py-2.5 text-right text-yellow-700">Idle</th>
              </tr>
            </thead>
            <tbody>
              {data.daily_table.map((day: any, dayIdx: number) => {
                const isExpanded = expandedDays.has(day.date);
                const dateLabel = day.date.split('-').reverse().join('/');
                const dayLabel = dayNames[day.day_name] || day.day_name;

                return (
                  <React.Fragment key={day.date}>
                    {/* Day summary row */}
                    <tr className="bg-blue-50/60 hover:bg-blue-100/60 cursor-pointer border-t border-blue-200" onClick={() => toggleDay(day.date)}>
                      <td className="px-3 py-2 sticky left-0 bg-blue-50/60 z-10">
                        <div className="flex items-center gap-1.5">
                          {isExpanded ? <ChevronUpIcon className="h-3.5 w-3.5 text-blue-500" /> : <ChevronDownIcon className="h-3.5 w-3.5 text-blue-500" />}
                          <span className="font-semibold text-blue-800">{dateLabel}</span>
                          <span className="text-blue-500 text-[10px]">({dayLabel})</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 font-medium text-blue-700">{day.products.length} produk</td>
                      <td className="px-2 py-2"></td>
                      <td className="px-2 py-2 text-right font-semibold text-green-700">{fmtNum(day.day_summary.grade_a)}</td>
                      <td className="px-2 py-2 text-right font-semibold text-yellow-600">{fmtNum(day.day_summary.grade_b)}</td>
                      <td className="px-2 py-2 text-right font-semibold text-red-600">{fmtNum(day.day_summary.grade_c)}</td>
                      <td className="px-2 py-2 text-right font-semibold">{fmtNum(day.day_summary.total_pcs)}</td>
                      <td className="px-2 py-2 text-right font-semibold">{fmtNum(Math.round(day.day_summary.total_ctn))}</td>
                      <td className="px-2 py-2 text-right">-</td>
                      <td className="px-2 py-2 text-right">-</td>
                      <td className="px-2 py-2 text-right">-</td>
                      <td className="px-2 py-2 text-right text-green-700 font-medium">{fmtMin(day.day_summary.runtime)}</td>
                      <td className="px-2 py-2 text-right text-red-600 font-medium">{fmtMin(day.day_summary.downtime)}</td>
                      <td className="px-2 py-2 text-right text-yellow-600 font-medium">{fmtMin(day.day_summary.idle_time)}</td>
                    </tr>
                    {/* Product rows */}
                    {day.products.map((p: any, pIdx: number) => (
                      <tr key={`${day.date}-${pIdx}`} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 border-t border-gray-100">
                        <td className="px-3 py-1.5 sticky left-0 bg-white dark:bg-gray-800 z-10"></td>
                        <td className="px-3 py-1.5">
                          <span className="font-medium text-gray-800 dark:text-gray-100">{stripPackagingSuffix(p.product_name)}</span>
                          {p.product_code && <span className="text-[10px] text-gray-400 ml-1">({p.product_code})</span>}
                        </td>
                        <td className="px-2 py-1.5 text-left">
                          <span className="text-xs text-gray-600 dark:text-gray-300">{p.machines || 'N/A'}</span>
                        </td>
                        <td className="px-2 py-1.5 text-right text-green-600">{fmtNum(Math.round(p.grade_a))}</td>
                        <td className="px-2 py-1.5 text-right text-yellow-500">{fmtNum(Math.round(p.grade_b))}</td>
                        <td className="px-2 py-1.5 text-right text-red-500">{fmtNum(Math.round(p.grade_c))}</td>
                        <td className="px-2 py-1.5 text-right">{fmtNum(Math.round(p.total_pcs))}</td>
                        <td className="px-2 py-1.5 text-right">{fmtNum(Math.round(p.total_ctn))}</td>
                        <td className="px-2 py-1.5 text-right text-blue-600 font-medium">{fmtNum(Math.round(p.cumulative_ctn))}</td>
                        <td className="px-2 py-1.5 text-right text-gray-500 dark:text-gray-400">{fmtNum(Math.round(p.target_monthly_ctn))}</td>
                        <td className={`px-2 py-1.5 text-right font-medium ${p.gap_ctn > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {p.gap_ctn > 0 ? '-' : '+'}{fmtNum(Math.abs(Math.round(p.gap_ctn)))}
                        </td>
                        <td className="px-2 py-1.5 text-right text-green-600">{fmtMin(p.runtime)}</td>
                        <td className="px-2 py-1.5 text-right text-red-500">{fmtMin(p.downtime)}</td>
                        <td className="px-2 py-1.5 text-right text-yellow-500">{fmtMin(p.idle_time)}</td>
                      </tr>
                    ))}
                    {/* Expanded: Top 5 Unplanned Downtime + All Downtime per Shift */}
                    {isExpanded && day.downtime_records && day.downtime_records.length > 0 && (() => {
                      const allRecords = day.downtime_records;
                      const unplannedRecords = allRecords.filter((d: any) => 
                        d.category === 'mesin' || d.category === 'idle'
                      );
                      
                      const shifts = [...new Set(allRecords.map((d: any) => d.shift))].sort();
                      const shiftColors: Record<number, string> = { 1: 'bg-blue-500', 2: 'bg-green-500', 3: 'bg-purple-500' };
                      const catColors: Record<string, string> = {
                        mesin: 'bg-red-100 text-red-700 border-red-300',
                        operator: 'bg-orange-100 text-orange-700 border-orange-300',
                        material: 'bg-blue-100 text-blue-700 border-blue-300',
                        design: 'bg-purple-100 text-purple-700 border-purple-300',
                        idle: 'bg-yellow-100 text-yellow-700 border-yellow-300',
                        others: 'bg-gray-100 text-gray-700 border-gray-300'
                      };
                      const catLabels: Record<string, string> = {
                        mesin: 'Mesin', operator: 'Operator', material: 'Material',
                        design: 'Design', idle: 'Idle', others: 'Lainnya'
                      };
                      
                      return (
                        <>
                          {/* TOP 5 UNPLANNED DOWNTIME SECTION */}
                          {unplannedRecords.length > 0 && (
                            <tr className="bg-gradient-to-r from-red-100 to-orange-100">
                              <td colSpan={13} className="px-6 py-2">
                                <span className="text-xs font-bold text-red-700 uppercase tracking-wider">
                                  ⚠️ Top 5 Unplanned Downtime (Mesin & Idle) per Shift
                                </span>
                              </td>
                            </tr>
                          )}
                          {shifts.map((shiftNum: number) => {
                            const shiftUnplanned = unplannedRecords
                              .filter((d: any) => d.shift === shiftNum)
                              .sort((a: any, b: any) => {
                                if (a.product_name !== b.product_name) return a.product_name.localeCompare(b.product_name);
                                if (a.machine_name !== b.machine_name) return a.machine_name.localeCompare(b.machine_name);
                                return b.duration_minutes - a.duration_minutes;
                              })
                              .slice(0, 5);
                            
                            if (shiftUnplanned.length === 0) return null;
                            
                            const totalUnplanned = unplannedRecords
                              .filter((d: any) => d.shift === shiftNum)
                              .reduce((s: number, d: any) => s + d.duration_minutes, 0);
                            
                            return (
                              <React.Fragment key={`top5-shift-${day.date}-${shiftNum}`}>
                                <tr className="bg-red-50/70">
                                  <td colSpan={13} className="px-6 py-1">
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 rounded text-white text-[10px] font-bold ${shiftColors[shiftNum] || 'bg-gray-500'}`}>
                                        Shift {shiftNum}
                                      </span>
                                      <span className="text-[10px] font-semibold text-red-600">
                                        Top 5 • Total Unplanned: {totalUnplanned}m
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                                {shiftUnplanned.map((dt: any, dtIdx: number) => (
                                  <tr key={`top5-${day.date}-${shiftNum}-${dtIdx}`} className="bg-red-50/40 text-[11px]">
                                    <td className="px-3 py-1 sticky left-0 bg-red-50/40 z-10 text-red-500 text-center font-bold">{dtIdx + 1}</td>
                                    <td className="px-3 py-1" colSpan={4}>
                                      <span className="text-gray-800 dark:text-gray-100 font-medium">{dt.reason}</span>
                                      <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-medium border ${catColors[dt.category]}`}>
                                        {catLabels[dt.category]}
                                      </span>
                                    </td>
                                    <td className="px-2 py-1 text-right font-bold text-red-600">{dt.duration_minutes}m</td>
                                    <td className="px-2 py-1 text-center">
                                      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-medium">{dt.pic}</span>
                                    </td>
                                    <td className="px-2 py-1 text-gray-600 dark:text-gray-300 text-[10px] font-medium">{dt.machine_name}</td>
                                    <td className="px-2 py-1 text-gray-500 dark:text-gray-400 text-[10px]" colSpan={2}>{stripPackagingSuffix(dt.product_name)}</td>
                                    <td className="px-2 py-1 text-blue-600 text-[10px]" colSpan={2}>{dt.wo_number}</td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            );
                          })}
                          
                          {/* ALL DOWNTIME SECTION */}
                          <tr className="bg-gradient-to-r from-slate-100 to-slate-200">
                            <td colSpan={13} className="px-6 py-2">
                              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                📋 Semua Downtime per Shift
                              </span>
                            </td>
                          </tr>
                          {shifts.map((shiftNum: number) => {
                            const shiftItems = allRecords
                              .filter((d: any) => d.shift === shiftNum)
                              .sort((a: any, b: any) => b.duration_minutes - a.duration_minutes);
                            const totalMin = shiftItems.reduce((s: number, d: any) => s + d.duration_minutes, 0);
                            
                            return (
                              <React.Fragment key={`all-shift-${day.date}-${shiftNum}`}>
                                <tr className="bg-slate-50/70">
                                  <td colSpan={13} className="px-6 py-1">
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 rounded text-white text-[10px] font-bold ${shiftColors[shiftNum] || 'bg-gray-500'}`}>
                                        Shift {shiftNum}
                                      </span>
                                      <span className="text-[10px] font-medium text-slate-600">
                                        {shiftItems.length} downtime • Total: {totalMin}m
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                                {shiftItems.map((dt: any, dtIdx: number) => (
                                  <tr key={`all-${day.date}-${shiftNum}-${dtIdx}`} className="bg-slate-50/30 text-[11px]">
                                    <td className="px-3 py-1 sticky left-0 bg-slate-50/30 z-10 text-gray-400 text-center">{dtIdx + 1}</td>
                                    <td className="px-3 py-1" colSpan={4}>
                                      <span className="text-gray-800 dark:text-gray-100 font-medium">{dt.reason}</span>
                                      <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-medium border ${catColors[dt.category] || catColors.others}`}>
                                        {catLabels[dt.category] || dt.category}
                                      </span>
                                    </td>
                                    <td className="px-2 py-1 text-right font-bold text-red-600">{dt.duration_minutes}m</td>
                                    <td className="px-2 py-1 text-center">
                                      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-medium">{dt.pic}</span>
                                    </td>
                                    <td className="px-2 py-1 text-gray-600 dark:text-gray-300 text-[10px] font-medium">{dt.machine_name}</td>
                                    <td className="px-2 py-1 text-gray-500 dark:text-gray-400 text-[10px]" colSpan={2}>{stripPackagingSuffix(dt.product_name)}</td>
                                    <td className="px-2 py-1 text-blue-600 text-[10px]" colSpan={2}>{dt.wo_number}</td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            );
                          })}
                        </>
                      );
                    })()}
                    {isExpanded && (!day.downtime_records || day.downtime_records.length === 0) && (
                      <tr className="bg-gray-50 dark:bg-gray-900/50">
                        <td colSpan={13} className="px-6 py-3 text-center text-gray-400 text-xs">
                          Tidak ada downtime tercatat untuk hari ini
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ==================== PRODUCTS TAB ====================
const ProductsTab: React.FC<{ data: any }> = ({ data }) => {
  const chartData = data.products.map((p: any) => ({
    name: stripPackagingSuffix(p.product_name),
    fullName: stripPackagingSuffix(p.product_name),
    machines: p.machines || 'N/A',
    target: p.target_ctn, 
    targetWeekly: p.target_ctn_weekly || 0,
    weeklyWorkingDays: p.weekly_working_days || 0,
    weeklyTotalShifts: p.weekly_total_shifts || 0,
    plannedDays: p.planned_days || 0,
    plannedShifts: p.planned_shifts || 0,
    productionDays: p.production_days || 0,
    shiftCount: p.shift_count || 0,
    actual: Math.round(p.actual_ctn), 
    gap: Math.round(Math.abs(p.gap_ctn)),
    gapWeekly: Math.round(p.gap_ctn_weekly || 0),
    achievementPct: p.achievement_pct,
    achievementPctWeekly: p.achievement_pct_weekly || 0,
    gapMessage: p.gap_message || ''
  }));

  // Custom Tooltip Component
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    
    const data = payload[0].payload;
    const isTargetAchieved = data.actual >= data.targetWeekly;
    const achievementPct = data.targetWeekly > 0 
      ? Math.round((data.actual / data.targetWeekly) * 100) 
      : 0;
    
    return (
      <div className="bg-white dark:bg-gray-800 border-2 border-slate-300 dark:border-gray-600 rounded-lg shadow-lg p-4 min-w-[280px]">
        <h4 className="font-bold text-slate-900 dark:text-white mb-3 text-base border-b pb-2">
          {data.fullName}
        </h4>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-gray-400">Forecast:</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">{fmtNum(data.target)} ctn</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-gray-400">Target Mingguan:</span>
            <span className="font-semibold text-red-600 dark:text-red-400">{fmtNum(data.targetWeekly)} ctn</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-gray-400">Aktual:</span>
            <span className="font-semibold text-green-600 dark:text-green-400">{fmtNum(data.actual)} ctn</span>
          </div>
          
          <div className="border-t pt-2 mt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-700 dark:text-gray-300 font-medium">Status:</span>
              <span className={`font-bold flex items-center gap-1 ${isTargetAchieved ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isTargetAchieved ? '✅ Tercapai' : '❌ Tidak Tercapai'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-gray-400">Achievement:</span>
              <span className={`font-semibold ${achievementPct >= 100 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                {achievementPct}% dari target mingguan
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-gray-400">{isTargetAchieved ? 'Surplus:' : 'Gap:'}</span>
              <span className={`font-bold ${isTargetAchieved ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isTargetAchieved ? '+' : '-'}{fmtNum(Math.abs(data.gapWeekly))} ctn
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Custom Y-axis tick component to show product name (bold) and machine below
  const CustomYAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const item = chartData.find((d: any) => d.name === payload.value);
    
    return (
      <g transform={`translate(${x},${y})`}>
        <text 
          x={-8} 
          y={-6} 
          dy={0} 
          textAnchor="end" 
          fill="#111827" 
          fontSize={11}
          fontWeight="700"
        >
          {payload.value}
        </text>
        {item && item.machines && (
          <text 
            x={-8} 
            y={8} 
            dy={0} 
            textAnchor="end" 
            fill="#6B7280" 
            fontSize={10}
            fontWeight="500"
          >
            {item.machines}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="space-y-5">
      {/* Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow border">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Target vs Aktual per Produk (karton)</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 30, right: 200 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={200} tick={<CustomYAxisTick />} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="target" name="Forecast" fill="#93C5FD" />
              <Bar 
                dataKey="targetWeekly" 
                name="Target Mingguan" 
                fill="#EF4444"
                label={(props: any) => {
                  const { x, y, width, value, index } = props;
                  const item = chartData[index];
                  if (item && item.targetWeekly > 0) {
                    // Use planned_days and planned_shifts from schedule grid
                    if (item.plannedDays > 0 && item.plannedShifts > 0) {
                      const labelText = `Planned: ${item.plannedDays} hari, ${item.plannedShifts} shift`;
                      return (
                        <text 
                          x={x + width + 5} 
                          y={y + 10} 
                          fill="#DC2626" 
                          fontSize={9}
                          fontWeight="600"
                        >
                          {labelText}
                        </text>
                      );
                    } else if (item.weeklyWorkingDays > 0) {
                      // Fallback to working days if no planned schedule
                      const labelText = `Planned: ${item.weeklyWorkingDays} hari kerja`;
                      return (
                        <text 
                          x={x + width + 5} 
                          y={y + 10} 
                          fill="#DC2626" 
                          fontSize={9}
                          fontWeight="600"
                        >
                          {labelText}
                        </text>
                      );
                    }
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="actual" 
                name="Aktual" 
                fill="#22C55E"
                label={(props: any) => {
                  const { x, y, width, value, index } = props;
                  const item = chartData[index];
                  if (item && item.actual > 0) {
                    // Calculate gap for days and shifts
                    const gapDays = item.plannedDays - item.productionDays;
                    const gapShifts = item.plannedShifts - item.shiftCount;
                    
                    return (
                      <g>
                        {/* Gap message - line 1 */}
                        {item.gapMessage && (
                          <text 
                            x={x + width + 5} 
                            y={y + 5} 
                            fill="#EF4444" 
                            fontSize={9}
                            fontWeight="500"
                          >
                            {item.gapMessage}
                          </text>
                        )}
                        {/* Gap days/shifts - line 2 */}
                        {gapDays > 0 && gapShifts > 0 && (
                          <text 
                            x={x + width + 5} 
                            y={y + 17} 
                            fill="#DC2626" 
                            fontSize={9}
                            fontWeight="600"
                          >
                            {`Gap: ${gapDays} hari, ${gapShifts} shift`}
                          </text>
                        )}
                      </g>
                    );
                  }
                  return null;
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Full Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow border">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Detail Lengkap per Produk</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 font-medium">
                <th className="px-3 py-2 text-left">Produk</th>
                <th className="px-2 py-2 text-left">Mesin</th>
                <th className="px-2 py-2 text-right">Pack/Ctn</th>
                <th className="px-2 py-2 text-right">Forecast (pack)</th>
                <th className="px-2 py-2 text-right">Forecast (ctn)</th>
                <th className="px-2 py-2 text-right">Target Mingguan (ctn)</th>
                <th className="px-2 py-2 text-right">Aktual (ctn)</th>
                <th className="px-2 py-2 text-right">Gap Forecast</th>
                <th className="px-2 py-2 text-right">Gap Mingguan</th>
                <th className="px-2 py-2 text-right">Achievement</th>
                <th className="px-2 py-2 text-right text-green-700">Grade A</th>
                <th className="px-2 py-2 text-right text-yellow-700">Grade B</th>
                <th className="px-2 py-2 text-right text-red-700">Grade C</th>
                <th className="px-2 py-2 text-right">Total (pcs)</th>
                <th className="px-2 py-2 text-right">Quality</th>
                <th className="px-2 py-2 text-right">Runtime</th>
                <th className="px-2 py-2 text-right">Downtime</th>
                <th className="px-2 py-2 text-right">Idle</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.products.map((p: any, i: number) => (
                <tr key={i} className={`hover:bg-gray-50 ${p.achievement_pct < 50 ? 'bg-red-50/50' : ''}`}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900 dark:text-white">{stripPackagingSuffix(p.product_name)}</div>
                    {p.product_code && <div className="text-[10px] text-gray-400">{p.product_code}</div>}
                    {p.gap_message && (
                      <div className="text-[10px] text-red-600 mt-1 italic">{p.gap_message}</div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-left">
                    <span className="text-xs text-gray-600 dark:text-gray-300">{p.machines || 'N/A'}</span>
                  </td>
                  <td className="px-2 py-2 text-right text-gray-500 dark:text-gray-400">{p.pack_per_ctn}</td>
                  <td className="px-2 py-2 text-right text-gray-600 dark:text-gray-300">{fmtNum(p.target_ctn * p.pack_per_ctn)}</td>
                  <td className="px-2 py-2 text-right text-gray-600 dark:text-gray-300">{fmtNum(p.target_ctn)}</td>
                  <td className="px-2 py-2 text-right text-red-600 font-medium">{fmtNum(p.target_ctn_weekly || 0)}</td>
                  <td className="px-2 py-2 text-right font-medium">{fmtNum(Math.round(p.actual_ctn))}</td>
                  <td className={`px-2 py-2 text-right font-medium ${p.gap_ctn > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {p.gap_ctn > 0 ? '-' : '+'}{fmtNum(Math.abs(Math.round(p.gap_ctn)))}
                  </td>
                  <td className={`px-2 py-2 text-right font-medium ${p.gap_ctn_weekly > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {p.gap_ctn_weekly > 0 ? '-' : '+'}{fmtNum(Math.abs(Math.round(p.gap_ctn_weekly)))}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold mb-1 ${p.achievement_pct >= 80 ? 'bg-green-100 text-green-700' : p.achievement_pct >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                      Forecast: {p.achievement_pct}%
                    </div>
                    {p.target_ctn_weekly > 0 && (
                      <div className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${p.achievement_pct_weekly >= 80 ? 'bg-green-100 text-green-700' : p.achievement_pct_weekly >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                        Mingguan: {p.achievement_pct_weekly}%
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right text-green-600 font-medium">{fmtNum(p.grade_a)}</td>
                  <td className="px-2 py-2 text-right text-yellow-500">{fmtNum(p.grade_b)}</td>
                  <td className="px-2 py-2 text-right text-red-500">{fmtNum(p.grade_c)}</td>
                  <td className="px-2 py-2 text-right">{fmtNum(p.total_pcs)}</td>
                  <td className="px-2 py-2 text-right">{p.quality_rate}%</td>
                  <td className="px-2 py-2 text-right text-green-600">{fmtMin(p.runtime)}</td>
                  <td className="px-2 py-2 text-right text-red-500">{fmtMin(p.downtime)}</td>
                  <td className="px-2 py-2 text-right text-yellow-500">{fmtMin(p.idle_time)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 dark:bg-gray-800 font-semibold text-xs">
                <td className="px-3 py-2">TOTAL</td>
                <td className="px-2 py-2 text-left">-</td>
                <td className="px-2 py-2 text-right">-</td>
                <td className="px-2 py-2 text-right">-</td>
                <td className="px-2 py-2 text-right">{fmtNum(data.summary.target_ctn)}</td>
                <td className="px-2 py-2 text-right">-</td>
                <td className="px-2 py-2 text-right">{fmtNum(Math.round(data.summary.actual_ctn))}</td>
                <td className={`px-2 py-2 text-right ${data.summary.gap_ctn > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {data.summary.gap_ctn > 0 ? '-' : '+'}{fmtNum(Math.abs(Math.round(data.summary.gap_ctn)))}
                </td>
                <td className="px-2 py-2 text-right">-</td>
                <td className="px-2 py-2 text-right">{data.summary.achievement_pct}%</td>
                <td className="px-2 py-2 text-right text-green-600">{fmtNum(data.summary.total_grade_a)}</td>
                <td className="px-2 py-2 text-right text-yellow-500">{fmtNum(data.summary.total_grade_b)}</td>
                <td className="px-2 py-2 text-right text-red-500">{fmtNum(data.summary.total_grade_c)}</td>
                <td className="px-2 py-2 text-right">{fmtNum(data.summary.total_pcs)}</td>
                <td className="px-2 py-2 text-right">{data.summary.quality_rate}%</td>
                <td className="px-2 py-2 text-right text-green-600">{data.summary.runtime_hours}j</td>
                <td className="px-2 py-2 text-right text-red-500">{data.summary.downtime_hours}j</td>
                <td className="px-2 py-2 text-right text-yellow-500">{data.summary.idle_time_hours}j</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Action Items Section */}
      <DowntimeActionItems 
        topUnplannedDowntime={data.top_unplanned_downtime || {}}
        weekNumber={data.period?.week_number || 0}
        month={data.period?.month}
        year={data.period?.year}
      />
    </div>
  );
};

// ==================== MACHINES TAB ====================
// ==================== MACHINES TAB ====================
const MachinesTab: React.FC<{ data: any }> = ({ data }) => {
  // Prepare machine comparison data for charts
  const machineChartData = data.machines.map((m: any) => ({
    name: m.machine_name,
    OEE: m.avg_oee || 0,
    Runtime: Math.round(m.runtime / 60),
    Downtime: Math.round(m.downtime / 60),
    Idle: Math.round(m.idle_time / 60),
    Production: m.total_ctn || 0,
    Quality: m.quality_rate || 0
  }));

  return (
    <div className="space-y-5">
      {/* Machine Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.machines.map((m: any, i: number) => {
          const totalTime = m.runtime + m.downtime + m.idle_time;
          const rtPct = totalTime > 0 ? (m.runtime / totalTime * 100) : 0;
          const dtPct = totalTime > 0 ? (m.downtime / totalTime * 100) : 0;
          const idlePct = totalTime > 0 ? (m.idle_time / totalTime * 100) : 0;
          return (
            <div key={i} className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow border-l-4 ${m.avg_oee >= 60 ? 'border-l-green-500' : m.avg_oee >= 40 ? 'border-l-yellow-500' : 'border-l-red-500'}`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{m.machine_name}</h4>
                <span className={`text-lg font-bold ${m.avg_oee >= 60 ? 'text-green-600' : m.avg_oee >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {m.avg_oee}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                  <p className="text-[10px] text-green-600 font-medium">Grade A</p>
                  <p className="text-sm font-bold text-green-700 dark:text-green-400">{fmtNum(m.grade_a)}</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-2">
                  <p className="text-[10px] text-yellow-600 font-medium">Grade B</p>
                  <p className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{fmtNum(m.grade_b)}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
                  <p className="text-[10px] text-red-600 font-medium">Grade C</p>
                  <p className="text-sm font-bold text-red-600 dark:text-red-400">{fmtNum(m.grade_c)}</p>
                </div>
              </div>
              {/* Time bar */}
              <div className="flex rounded-full h-3 overflow-hidden mb-2">
                <div className="bg-green-500" style={{ width: `${rtPct}%` }} title={`Runtime: ${fmtMin(m.runtime)}`} />
                <div className="bg-red-500" style={{ width: `${dtPct}%` }} title={`Downtime: ${fmtMin(m.downtime)}`} />
                <div className="bg-yellow-400" style={{ width: `${idlePct}%` }} title={`Idle: ${fmtMin(m.idle_time)}`} />
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400">
                <span className="text-green-600">RT: {fmtMin(m.runtime)}</span>
                <span className="text-red-500">DT: {fmtMin(m.downtime)}</span>
                <span className="text-yellow-500">Idle: {fmtMin(m.idle_time)}</span>
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-gray-500 dark:text-gray-400">
                <span>Total: {fmtNum(m.total_produced)} pcs</span>
                <span>Quality: {m.quality_rate}%</span>
                <span>{m.shift_count} shift</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* OEE Comparison Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow border">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">📊 Perbandingan OEE per Mesin</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={machineChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} label={{ value: 'OEE %', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Bar dataKey="OEE" fill="#3B82F6">
                {machineChartData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.OEE >= 60 ? '#22C55E' : entry.OEE >= 40 ? '#F59E0B' : '#EF4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Time Utilization Comparison */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow border">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">⏱️ Utilisasi Waktu per Mesin (Jam)</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={machineChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Runtime" stackId="a" fill="#22C55E" name="Runtime" />
              <Bar dataKey="Downtime" stackId="a" fill="#EF4444" name="Downtime" />
              <Bar dataKey="Idle" stackId="a" fill="#F59E0B" name="Idle" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Production & Quality Comparison */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow border">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">📦 Produksi & Kualitas per Mesin</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={machineChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: 'Karton', angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} label={{ value: 'Quality %', angle: 90, position: 'insideRight' }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="Production" fill="#3B82F6" name="Produksi (ctn)" />
              <Bar yAxisId="right" dataKey="Quality" fill="#22C55E" name="Quality %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow border">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">📋 Detail Lengkap per Mesin</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300">
                <th className="px-3 py-2 text-left">Mesin</th>
                <th className="px-3 py-2 text-right">OEE</th>
                <th className="px-3 py-2 text-right">Grade A</th>
                <th className="px-3 py-2 text-right">Grade B</th>
                <th className="px-3 py-2 text-right">Grade C</th>
                <th className="px-3 py-2 text-right">Total (pcs)</th>
                <th className="px-3 py-2 text-right">Karton</th>
                <th className="px-3 py-2 text-right">Quality</th>
                <th className="px-3 py-2 text-right">Runtime</th>
                <th className="px-3 py-2 text-right">Downtime</th>
                <th className="px-3 py-2 text-right">Idle</th>
                <th className="px-3 py-2 text-right">Shifts</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {data.machines.map((m: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{m.machine_name}</td>
                  <td className={`px-3 py-2 text-right font-bold ${m.avg_oee >= 60 ? 'text-green-600' : m.avg_oee >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {m.avg_oee}%
                  </td>
                  <td className="px-3 py-2 text-right text-green-600 font-medium">{fmtNum(m.grade_a)}</td>
                  <td className="px-3 py-2 text-right text-yellow-500">{fmtNum(m.grade_b)}</td>
                  <td className="px-3 py-2 text-right text-red-500">{fmtNum(m.grade_c)}</td>
                  <td className="px-3 py-2 text-right">{fmtNum(m.total_produced)}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtNum(m.total_ctn || 0)}</td>
                  <td className="px-3 py-2 text-right">{m.quality_rate}%</td>
                  <td className="px-3 py-2 text-right text-green-600">{fmtMin(m.runtime)}</td>
                  <td className="px-3 py-2 text-right text-red-500">{fmtMin(m.downtime)}</td>
                  <td className="px-3 py-2 text-right text-yellow-500">{fmtMin(m.idle_time)}</td>
                  <td className="px-3 py-2 text-right">{m.shift_count}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 dark:bg-gray-800 font-semibold">
                <td className="px-3 py-2">TOTAL</td>
                <td className="px-3 py-2 text-right">-</td>
                <td className="px-3 py-2 text-right text-green-600">{fmtNum(data.machines.reduce((sum: number, m: any) => sum + m.grade_a, 0))}</td>
                <td className="px-3 py-2 text-right text-yellow-500">{fmtNum(data.machines.reduce((sum: number, m: any) => sum + m.grade_b, 0))}</td>
                <td className="px-3 py-2 text-right text-red-500">{fmtNum(data.machines.reduce((sum: number, m: any) => sum + m.grade_c, 0))}</td>
                <td className="px-3 py-2 text-right">{fmtNum(data.machines.reduce((sum: number, m: any) => sum + m.total_produced, 0))}</td>
                <td className="px-3 py-2 text-right">{fmtNum(data.machines.reduce((sum: number, m: any) => sum + (m.total_ctn || 0), 0))}</td>
                <td className="px-3 py-2 text-right">-</td>
                <td className="px-3 py-2 text-right text-green-600">{Math.round(data.machines.reduce((sum: number, m: any) => sum + m.runtime, 0) / 60)}j</td>
                <td className="px-3 py-2 text-right text-red-500">{Math.round(data.machines.reduce((sum: number, m: any) => sum + m.downtime, 0) / 60)}j</td>
                <td className="px-3 py-2 text-right text-yellow-500">{Math.round(data.machines.reduce((sum: number, m: any) => sum + m.idle_time, 0) / 60)}j</td>
                <td className="px-3 py-2 text-right">{data.machines.reduce((sum: number, m: any) => sum + m.shift_count, 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

// ==================== DOWNTIME TAB ====================
const DowntimeTab: React.FC<{ data: any; downtimePieData: any[] }> = ({ data, downtimePieData }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Category Pie */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow border">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Downtime per Kategori</h3>
        <div className="h-72 flex items-center">
          {downtimePieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={downtimePieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value"
                  label={({ name, value }) => `${name}: ${fmtMin(value)}`}>
                  {downtimePieData.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtMin(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="w-full text-center text-gray-400">No downtime data</p>}
        </div>
        <div className="flex flex-wrap justify-center gap-4 mt-2">
          {Object.entries(DOWNTIME_COLORS).map(([k, c]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
              <span className="text-xs text-gray-600 dark:text-gray-300">{CATEGORY_LABELS[k]}</span>
              <span className="text-xs text-gray-400">({fmtMin(data.downtime_by_category[k] || 0)})</span>
            </div>
          ))}
        </div>
      </div>
      {/* Category Breakdown Cards */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow border">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Breakdown Waktu Downtime</h3>
        <div className="space-y-3">
          {Object.entries(data.downtime_by_category).map(([k, v]) => {
            const total = Object.values(data.downtime_by_category).reduce((a: number, b: any) => a + b, 0) as number;
            const pct = total > 0 ? ((v as number) / total * 100) : 0;
            return (
              <div key={k}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-gray-700 dark:text-gray-200">{CATEGORY_LABELS[k]}</span>
                  <span className="text-gray-500 dark:text-gray-400">{fmtMin(v as number)} ({pct.toFixed(1)}%)</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: DOWNTIME_COLORS[k] }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    {/* Top Downtime Reasons - Single table with Unplanned/Planned indicator */}
    {(() => {
      const unplannedCategories = ['mesin', 'idle'];
      const sorted = [...data.top_downtime_reasons].sort((a: any, b: any) => {
        const aU = unplannedCategories.includes(a.category) ? 0 : 1;
        const bU = unplannedCategories.includes(b.category) ? 0 : 1;
        if (aU !== bU) return aU - bU;
        return b.total_minutes - a.total_minutes;
      });

      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow border">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            <ExclamationTriangleIcon className="h-4 w-4 inline mr-1 text-red-500" />
            Top 10 Downtime
          </h3>
          {sorted.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300">
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Tipe</th>
                    <th className="px-3 py-2 text-left">Alasan</th>
                    <th className="px-3 py-2 text-left">Kategori</th>
                    <th className="px-3 py-2 text-left">Mesin</th>
                    <th className="px-3 py-2 text-left">Produk</th>
                    <th className="px-3 py-2 text-right">Frekuensi</th>
                    <th className="px-3 py-2 text-right">Total Waktu</th>
                    <th className="px-3 py-2 text-left">Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sorted.map((item: any, idx: number) => {
                    const maxMin = sorted[0]?.total_minutes || 1;
                    const pct = (item.total_minutes / maxMin) * 100;
                    const isUnplanned = unplannedCategories.includes(item.category);
                    return (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                        <td className="px-3 py-2 font-medium">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${isUnplanned ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                            {isUnplanned ? 'Unplanned' : 'Planned'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{item.reason}</td>
                        <td className="px-3 py-2">
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{
                            backgroundColor: DOWNTIME_COLORS[item.category] ? DOWNTIME_COLORS[item.category] + '20' : '#F3F4F6',
                            color: DOWNTIME_COLORS[item.category] || '#6B7280'
                          }}>{CATEGORY_LABELS[item.category] || item.category}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300 text-[11px]">
                          {item.machines || 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300 text-[11px]">
                          {item.products ? stripPackagingSuffix(item.products) : 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-right">{item.count}x</td>
                        <td className="px-3 py-2 text-right font-medium text-red-600">{fmtMin(item.total_minutes)}</td>
                        <td className="px-3 py-2 w-36">
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div className={`h-2 rounded-full ${isUnplanned ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="text-center text-gray-400 py-6">Tidak ada data downtime</p>}
        </div>
      );
    })()}
  </div>
);

// ==================== GRAPH TAB ====================
const GraphTab: React.FC<{ data: any }> = ({ data }) => {
  // Prepare Waterfall Chart Data (Gap Analysis)
  const waterfallData = useMemo(() => {
    if (!data || !data.summary) return [];
    
    const result: any[] = [];
    let cumulative = 0;
    
    // Start with target
    result.push({
      name: 'Target Forecast',
      value: data.summary.target_ctn,
      cumulative: data.summary.target_ctn,
      fill: '#3B82F6'
    });
    
    cumulative = data.summary.target_ctn;
    
    // Add actual production
    const actualCtn = Math.round(data.summary.actual_ctn);
    const gap = data.summary.target_ctn - actualCtn;
    
    result.push({
      name: 'Produksi Aktual',
      value: -gap,
      cumulative: actualCtn,
      fill: gap > 0 ? '#EF4444' : '#22C55E'
    });
    
    // Final result
    result.push({
      name: 'Hasil Akhir',
      value: actualCtn,
      cumulative: actualCtn,
      fill: actualCtn >= data.summary.target_ctn * 0.8 ? '#22C55E' : '#EF4444'
    });
    
    return result;
  }, [data]);

  // Prepare Pareto Chart Data (80/20 Downtime Analysis)
  const paretoData = useMemo(() => {
    if (!data || !data.top_downtime_reasons) return [];
    
    const sorted = [...data.top_downtime_reasons]
      .sort((a, b) => b.total_minutes - a.total_minutes)
      .slice(0, 10);
    
    const totalDowntime = sorted.reduce((sum, item) => sum + item.total_minutes, 0);
    let cumulativePct = 0;
    
    return sorted.map(item => {
      cumulativePct += (item.total_minutes / totalDowntime * 100);
      return {
        reason: item.reason.length > 20 ? item.reason.substring(0, 20) + '...' : item.reason,
        minutes: item.total_minutes,
        cumulative: cumulativePct
      };
    });
  }, [data]);

  // Prepare Gantt Chart Data (WO Timeline)
  const ganttData = useMemo(() => {
    if (!data) return [];
    
    // Since daily_table.products doesn't have wo_number,
    // we'll create a simplified gantt chart from top-level products data
    // showing which days each product was produced
    
    if (!data.products || !data.daily_table) return [];
    
    const productMap: Record<string, any> = {};
    
    // For each product, find all days it was produced
    data.products.forEach((product: any) => {
      const productName = product.product_name;
      const dates: string[] = [];
      
      // Check each day to see if this product was produced
      data.daily_table.forEach((day: any) => {
        if (day.products && Array.isArray(day.products)) {
          const dayProduct = day.products.find((p: any) => 
            p.product_name === productName || 
            (p.product_name && productName && p.product_name.includes(productName.split(' ')[0]))
          );
          
          if (dayProduct && dayProduct.grade_a > 0) {
            dates.push(day.date);
          }
        }
      });
      
      if (dates.length > 0) {
        // Sort dates to get start and end
        dates.sort();
        
        productMap[productName] = {
          wo: `WO-${product.product_code || 'N/A'}`,
          product: productName.length > 30 ? productName.substring(0, 30) + '...' : productName,
          startDate: dates[0],
          endDate: dates[dates.length - 1],
          days: dates,
          totalCtn: Math.round(product.actual_ctn || 0)
        };
      }
    });
    
    const result = Object.values(productMap)
      .sort((a: any, b: any) => b.totalCtn - a.totalCtn) // Sort by total cartons
      .slice(0, 15); // Top 15
    
    console.log('Gantt Data Result:', result);
    
    return result;
  }, [data]);

  // NEW: Trend Line Chart Data (Daily Production Trend)
  const trendData = useMemo(() => {
    if (!data || !data.daily_table) return [];
    
    return data.daily_table.map((day: any) => ({
      date: day.date.split('-')[2], // Get day number
      target: Math.round(data.summary.daily_target_ctn || 0),
      actual: Math.round(day.day_summary.total_ctn || 0),
      cumulative: 0 // Will be calculated below
    })).map((item: any, idx: number, arr: any[]) => {
      // Calculate cumulative
      item.cumulative = arr.slice(0, idx + 1).reduce((sum, d) => sum + d.actual, 0);
      return item;
    });
  }, [data]);

  // NEW: Stacked Area Chart Data (Grade Distribution Over Time)
  const gradeAreaData = useMemo(() => {
    if (!data || !data.daily_table) return [];
    
    return data.daily_table.map((day: any) => ({
      date: day.date.split('-')[2],
      'Grade A': day.day_summary.grade_a || 0,
      'Grade B': day.day_summary.grade_b || 0,
      'Grade C': day.day_summary.grade_c || 0
    }));
  }, [data]);

  // NEW: Radar Chart Data (Product Performance Metrics)
  const radarData = useMemo(() => {
    if (!data || !data.products) return [];
    
    // Take top 5 products by production
    const topProducts = [...data.products]
      .sort((a, b) => b.actual_ctn - a.actual_ctn)
      .slice(0, 5);
    
    return topProducts.map(p => ({
      product: stripPackagingSuffix(p.product_name).substring(0, 15),
      achievement: p.achievement_pct,
      quality: p.quality_rate,
      efficiency: p.runtime > 0 ? Math.round((p.runtime / (p.runtime + p.downtime + p.idle_time)) * 100) : 0,
      fullName: stripPackagingSuffix(p.product_name)
    }));
  }, [data]);

  // NEW: Machine Efficiency Comparison
  const machineComparisonData = useMemo(() => {
    if (!data || !data.machines) return [];
    
    return data.machines.map((m: any) => ({
      machine: m.machine_name,
      oee: m.avg_oee || 0,
      runtime: Math.round(m.runtime / 60), // Convert to hours
      downtime: Math.round(m.downtime / 60),
      production: m.total_ctn || 0
    }));
  }, [data]);

  // NEW: Quality Trend (Grade A percentage over time)
  const qualityTrendData = useMemo(() => {
    if (!data || !data.daily_table) return [];
    
    return data.daily_table.map((day: any) => {
      const total = day.day_summary.grade_a + day.day_summary.grade_b + day.day_summary.grade_c;
      const gradeAPct = total > 0 ? Math.round((day.day_summary.grade_a / total) * 100) : 0;
      
      return {
        date: day.date.split('-')[2],
        gradeAPct: gradeAPct,
        target: 95 // Target quality 95%
      };
    });
  }, [data]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading graph data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Waterfall Chart - Gap Analysis */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow border">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          📊 Waterfall Chart - Gap Analysis (Target vs Aktual)
        </h3>
        {waterfallData.length > 0 ? (
          <>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waterfallData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => fmtNum(Math.abs(Math.round(v)))} />
                  <Bar dataKey="value" fill="#3B82F6">
                    {waterfallData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-900">
                <strong>Insight:</strong> Gap dari target forecast: <span className={`font-bold ${data.summary.gap_ctn > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {data.summary.gap_ctn > 0 ? '-' : '+'}{fmtNum(Math.abs(Math.round(data.summary.gap_ctn)))} ctn
                </span> ({data.summary.achievement_pct}% tercapai)
              </p>
            </div>
          </>
        ) : (
          <div className="h-80 flex items-center justify-center text-gray-400">
            No data available for waterfall chart
          </div>
        )}
      </div>

      {/* Pareto Chart - 80/20 Downtime Analysis */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow border">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          📈 Pareto Chart - 80/20 Downtime Analysis
        </h3>
        {paretoData.length > 0 ? (
          <>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paretoData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="reason" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={100} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} label={{ value: 'Cumulative %', angle: 90, position: 'insideRight' }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="minutes" fill="#EF4444" name="Downtime (min)" />
                  <Bar yAxisId="right" dataKey="cumulative" fill="#F59E0B" name="Cumulative %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
              <p className="text-xs text-yellow-900">
                <strong>Pareto Principle:</strong> {paretoData.length > 0 && paretoData[0].cumulative > 80 ? 
                  `Top ${paretoData.findIndex(d => d.cumulative >= 80) + 1} alasan downtime menyumbang 80% total downtime` :
                  'Distribusi downtime relatif merata'
                }
              </p>
            </div>
          </>
        ) : (
          <div className="h-80 flex items-center justify-center text-gray-400">
            No downtime data available for pareto chart
          </div>
        )}
      </div>

      {/* NEW: Trend Line Chart - Daily Production */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow border">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          📉 Trend Produksi Harian (Target vs Aktual vs Kumulatif)
        </h3>
        {trendData.length > 0 ? (
          <>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} label={{ value: 'Tanggal', position: 'insideBottom', offset: -5 }} />
                  <YAxis tick={{ fontSize: 11 }} label={{ value: 'Karton', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="cumulative" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.2} name="Kumulatif" />
                  <Area type="monotone" dataKey="actual" stroke="#22C55E" fill="#22C55E" fillOpacity={0.4} name="Aktual" />
                  <Area type="monotone" dataKey="target" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} name="Target Harian" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 p-3 bg-purple-50 rounded-lg">
              <p className="text-xs text-purple-900">
                <strong>Trend:</strong> Produksi kumulatif saat ini: <span className="font-bold text-purple-700">{fmtNum(trendData[trendData.length - 1]?.cumulative || 0)} ctn</span>. 
                {trendData[trendData.length - 1]?.cumulative >= data.summary.target_ctn ? 
                  ' ✅ Target tercapai!' : 
                  ` Perlu ${fmtNum(data.summary.target_ctn - trendData[trendData.length - 1]?.cumulative)} ctn lagi.`
                }
              </p>
            </div>
          </>
        ) : (
          <div className="h-80 flex items-center justify-center text-gray-400">
            No trend data available
          </div>
        )}
      </div>

      {/* NEW: Stacked Area Chart - Grade Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow border">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          📊 Distribusi Grade A/B/C Over Time
        </h3>
        {gradeAreaData.length > 0 ? (
          <>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={gradeAreaData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="Grade A" stackId="1" stroke="#22C55E" fill="#22C55E" />
                  <Area type="monotone" dataKey="Grade B" stackId="1" stroke="#F59E0B" fill="#F59E0B" />
                  <Area type="monotone" dataKey="Grade C" stackId="1" stroke="#EF4444" fill="#EF4444" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-green-900">
                <strong>Quality:</strong> Grade A dominan = kualitas produksi baik. Grade B/C tinggi = perlu perbaikan proses.
              </p>
            </div>
          </>
        ) : (
          <div className="h-80 flex items-center justify-center text-gray-400">
            No grade data available
          </div>
        )}
      </div>

      {/* NEW: Quality Trend Line */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow border">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          ✨ Trend Kualitas (% Grade A)
        </h3>
        {qualityTrendData.length > 0 ? (
          <>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={qualityTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="target" stroke="#94A3B8" fill="#94A3B8" fillOpacity={0.2} name="Target (95%)" strokeDasharray="5 5" />
                  <Area type="monotone" dataKey="gradeAPct" stroke="#22C55E" fill="#22C55E" fillOpacity={0.4} name="Grade A %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-green-900">
                <strong>Target Quality:</strong> 95% Grade A. 
                Rata-rata saat ini: <span className="font-bold text-green-700">
                  {Math.round(qualityTrendData.reduce((sum, d) => sum + d.gradeAPct, 0) / qualityTrendData.length)}%
                </span>
              </p>
            </div>
          </>
        ) : (
          <div className="h-80 flex items-center justify-center text-gray-400">
            No quality data available
          </div>
        )}
      </div>

      {/* NEW: Machine Efficiency Comparison */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow border">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          ⚙️ Perbandingan Efisiensi Mesin (OEE & Produksi)
        </h3>
        {machineComparisonData.length > 0 ? (
          <>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={machineComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="machine" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: 'OEE %', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: 'Karton', angle: 90, position: 'insideRight' }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="oee" fill="#3B82F6" name="OEE %" />
                  <Bar yAxisId="right" dataKey="production" fill="#22C55E" name="Produksi (ctn)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-900">
                <strong>Best Performer:</strong> {machineComparisonData.reduce((best, m) => m.oee > best.oee ? m : best, machineComparisonData[0]).machine} 
                ({machineComparisonData.reduce((best, m) => m.oee > best.oee ? m : best, machineComparisonData[0]).oee}% OEE)
              </p>
            </div>
          </>
        ) : (
          <div className="h-80 flex items-center justify-center text-gray-400">
            No machine data available
          </div>
        )}
      </div>

      {/* Gantt Chart - WO Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow border">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          📅 Gantt Chart - Timeline Produksi per Work Order
        </h3>
        {ganttData.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900">
                    <th className="px-3 py-2 text-left">WO Number</th>
                    <th className="px-3 py-2 text-left">Produk</th>
                    <th className="px-3 py-2 text-center">Start Date</th>
                    <th className="px-3 py-2 text-center">End Date</th>
                    <th className="px-3 py-2 text-center">Duration (days)</th>
                    <th className="px-3 py-2 text-right">Total Karton</th>
                    <th className="px-3 py-2 text-left">Timeline</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ganttData.map((wo: any, idx: number) => {
                    const duration = wo.days.length;
                    const maxDuration = Math.max(...ganttData.map((w: any) => w.days.length));
                    const barWidth = (duration / maxDuration * 100);
                    
                    return (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-3 py-2 font-medium text-blue-600">{wo.wo}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{stripPackagingSuffix(wo.product)}</td>
                        <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-300">{wo.startDate}</td>
                        <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-300">{wo.endDate}</td>
                        <td className="px-3 py-2 text-center font-medium">{duration} hari</td>
                        <td className="px-3 py-2 text-right font-medium text-green-600">{fmtNum(wo.totalCtn)}</td>
                        <td className="px-3 py-2">
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-cyan-500 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-medium"
                              style={{ width: `${barWidth}%` }}
                            >
                              {duration}d
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-green-900">
                <strong>Summary:</strong> Total {ganttData.length} Work Orders aktif dalam periode ini. 
                Rata-rata durasi: {ganttData.length > 0 ? (ganttData.reduce((sum: number, wo: any) => sum + wo.days.length, 0) / ganttData.length).toFixed(1) : 0} hari per WO.
              </p>
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-gray-400">
            No work order data available for gantt chart
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== SHIFT TAB ====================
const SHIFT_COLORS = ['#6366F1', '#10B981', '#F59E0B'];
const ShiftTab: React.FC<{ data: any }> = ({ data }) => {
  const shifts: any[] = (data?.shift_breakdown || []).filter((s: any) => s.shift_count > 0);

  if (shifts.length === 0) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <BoltIcon className="h-12 w-12 text-gray-300" />
      <p className="text-gray-400">Tidak ada data shift untuk periode ini</p>
    </div>
  );

  const barData = shifts.map((s: any) => ({
    name: s.shift_label,
    'Output (pcs)': s.total_pcs,
    'Grade A': s.grade_a,
    'Grade B': s.grade_b,
    'Grade C': s.grade_c,
    'OEE (%)': s.avg_oee,
    'Quality (%)': s.quality_rate,
    'Downtime (mnt)': s.downtime,
  }));

  const best = shifts.reduce((a: any, b: any) => a.total_pcs > b.total_pcs ? a : b);

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {shifts.map((s: any, i: number) => (
          <div key={i} className={`rounded-xl p-4 shadow text-white ${s.shift_label === best.shift_label ? 'ring-4 ring-yellow-300' : ''}`}
            style={{ background: `linear-gradient(135deg, ${SHIFT_COLORS[i]}, ${SHIFT_COLORS[i]}CC)` }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold">{s.shift_label}</span>
              {s.shift_label === best.shift_label && <span className="text-xs bg-yellow-300 text-yellow-900 px-2 py-0.5 rounded-full font-semibold">🏆 Terbaik</span>}
            </div>
            <p className="text-2xl font-bold">{fmtNum(s.total_pcs)}<span className="text-sm font-normal text-white/70"> pcs</span></p>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
              <div className="bg-white/15 rounded-lg py-1.5">
                <p className="text-white/70">OEE</p>
                <p className="font-bold">{s.avg_oee}%</p>
              </div>
              <div className="bg-white/15 rounded-lg py-1.5">
                <p className="text-white/70">Quality</p>
                <p className="font-bold">{s.quality_rate}%</p>
              </div>
              <div className="bg-white/15 rounded-lg py-1.5">
                <p className="text-white/70">Shift</p>
                <p className="font-bold">{s.shift_count}x</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl p-5 shadow border">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Output per Shift (pcs)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmtNum(v)} />
                <Bar dataKey="Grade A" fill={GRADE_COLORS.a} stackId="s" />
                <Bar dataKey="Grade B" fill={GRADE_COLORS.b} stackId="s" />
                <Bar dataKey="Grade C" fill={GRADE_COLORS.c} stackId="s" radius={[4, 4, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow border">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">OEE & Quality Rate per Shift (%)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="OEE (%)" fill="#6366F1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Quality (%)" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detail Table */}
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-900">Detail Perbandingan Shift</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-600 text-xs font-semibold">
                <th className="px-4 py-3 text-left">Shift</th>
                <th className="px-4 py-3 text-right">Total Pcs</th>
                <th className="px-4 py-3 text-right">Grade A</th>
                <th className="px-4 py-3 text-right">Grade B</th>
                <th className="px-4 py-3 text-right">Grade C</th>
                <th className="px-4 py-3 text-right">Quality %</th>
                <th className="px-4 py-3 text-right">OEE %</th>
                <th className="px-4 py-3 text-right">Runtime (j)</th>
                <th className="px-4 py-3 text-right">Downtime (j)</th>
                <th className="px-4 py-3 text-right">Jumlah Shift</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shifts.map((s: any, i: number) => (
                <tr key={i} className={`hover:bg-gray-50 ${s.shift_label === best.shift_label ? 'bg-yellow-50' : ''}`}>
                  <td className="px-4 py-3 font-bold" style={{ color: SHIFT_COLORS[i] }}>{s.shift_label} {s.shift_label === best.shift_label ? '🏆' : ''}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtNum(s.total_pcs)}</td>
                  <td className="px-4 py-3 text-right text-green-600">{fmtNum(s.grade_a)}</td>
                  <td className="px-4 py-3 text-right text-yellow-500">{fmtNum(s.grade_b)}</td>
                  <td className="px-4 py-3 text-right text-red-500">{fmtNum(s.grade_c)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.quality_rate >= 95 ? 'bg-green-100 text-green-700' : s.quality_rate >= 85 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{s.quality_rate}%</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.avg_oee >= 85 ? 'bg-green-100 text-green-700' : s.avg_oee >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{s.avg_oee}%</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{(s.runtime / 60).toFixed(1)}</td>
                  <td className="px-4 py-3 text-right text-red-500">{(s.downtime / 60).toFixed(1)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{s.shift_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ==================== ANALYTICS TAB ====================
const getOeeColor = (oee: number): string => {
  if (oee === 0) return '#F3F4F6';
  if (oee >= 85) return '#10B981';
  if (oee >= 70) return '#F59E0B';
  if (oee >= 50) return '#EF4444';
  return '#FCA5A5';
};

const AnalyticsTab: React.FC<{ data: any; dailyChartData: any[] }> = ({ data, dailyChartData }) => {
  const oeeRaw: any[] = data?.machine_daily_oee || [];

  // Build heatmap: machines × dates
  const machines = Array.from(new Set(oeeRaw.map((r: any) => r.machine))).sort();
  const dates = Array.from(new Set(oeeRaw.map((r: any) => r.date))).sort();
  const oeeMap: Record<string, number> = {};
  oeeRaw.forEach((r: any) => { oeeMap[`${r.machine}__${r.date}`] = r.avg_oee; });

  // Quality trend from dailyChartData
  const qualityTrend = dailyChartData.map((d: any) => {
    const total = d.grade_a + d.grade_b + d.grade_c;
    return { ...d, quality_rate: total > 0 ? Math.round(d.grade_a / total * 100) : 0 };
  });

  return (
    <div className="space-y-5">
      {/* Quality Trend */}
      <div className="bg-white rounded-xl p-5 shadow border">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Tren Kualitas Harian</h3>
        <p className="text-xs text-gray-400 mb-3">Grade A/B/C per hari dan quality rate (%)</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={qualityTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
              <Tooltip formatter={(v: number, name: string) => [name.includes('%') ? `${v}%` : fmtNum(v), name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="grade_a" name="Grade A" fill={GRADE_COLORS.a} stackId="q" />
              <Bar yAxisId="left" dataKey="grade_b" name="Grade B" fill={GRADE_COLORS.b} stackId="q" />
              <Bar yAxisId="left" dataKey="grade_c" name="Grade C" fill={GRADE_COLORS.c} stackId="q" radius={[3, 3, 0, 0]} />
              <Area yAxisId="right" type="monotone" dataKey="quality_rate" name="Quality Rate %" stroke="#6366F1" fill="transparent" strokeWidth={2} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* OEE Heatmap */}
      <div className="bg-white rounded-xl p-5 shadow border overflow-hidden">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">OEE Heatmap — Per Mesin per Hari</h3>
        <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
          {[{ color: '#10B981', label: '≥85% Baik' }, { color: '#F59E0B', label: '70–84% Cukup' }, { color: '#EF4444', label: '50–69% Rendah' }, { color: '#FCA5A5', label: '<50% Kritis' }, { color: '#F3F4F6', label: 'No Data' }].map(x => (
            <span key={x.label} className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: x.color, border: '1px solid #e5e7eb' }} />{x.label}</span>
          ))}
        </div>
        {machines.length === 0 ? (
          <p className="text-center text-gray-400 py-8">Tidak ada data OEE untuk periode ini</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white px-3 py-2 text-left text-gray-700 font-semibold z-10 min-w-[120px]">Mesin</th>
                  {dates.map((d: string) => (
                    <th key={d} className="px-1 py-2 text-center text-gray-500 font-normal min-w-[36px]">{d.split('-')[2]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {machines.map((m: string) => (
                  <tr key={m}>
                    <td className="sticky left-0 bg-white px-3 py-1 font-medium text-gray-800 z-10 border-r border-gray-100">{m}</td>
                    {dates.map((d: string) => {
                      const oee = oeeMap[`${m}__${d}`];
                      const color = oee !== undefined ? getOeeColor(oee) : '#F3F4F6';
                      const textColor = oee !== undefined && oee > 0 ? (oee >= 70 ? '#065F46' : '#7F1D1D') : '#9CA3AF';
                      return (
                        <td key={d} className="px-1 py-1 text-center" title={oee !== undefined ? `${m} · ${d}: ${oee}%` : 'No data'}>
                          <div className="w-8 h-8 rounded flex items-center justify-center text-[10px] font-semibold mx-auto"
                            style={{ backgroundColor: color, color: textColor }}>
                            {oee !== undefined && oee > 0 ? oee : ''}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== FG CONVERSION TAB ====================
const FGConversionTab: React.FC<{
  fgData: any; fgLoading: boolean; fgFetched: boolean;
  onFetch: () => void; year: number; month: number;
}> = ({ fgData, fgLoading, fgFetched, onFetch, year, month }) => {
  useEffect(() => { if (!fgFetched) onFetch(); }, []);

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    draft:       { label: 'Draft',      color: 'text-gray-600',  bg: 'bg-gray-100' },
    in_progress: { label: 'Proses',     color: 'text-blue-600',  bg: 'bg-blue-100' },
    completed:   { label: 'Selesai',    color: 'text-green-700', bg: 'bg-green-100' },
    cancelled:   { label: 'Batal',      color: 'text-red-600',   bg: 'bg-red-100' },
  };
  const qcConfig: Record<string, { label: string; color: string }> = {
    pass:   { label: 'Pass',   color: 'text-green-700' },
    fail:   { label: 'Fail',   color: 'text-red-600' },
    rework: { label: 'Rework', color: 'text-yellow-600' },
    pending:{ label: 'Pending',color: 'text-gray-500' },
  };

  if (fgLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Memuat data FG Conversion...</p>
      </div>
    </div>
  );

  if (!fgData) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <ArrowsRightLeftIcon className="h-12 w-12 text-gray-300" />
      <p className="text-gray-400">Belum ada data FG Conversion</p>
      <button onClick={onFetch} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Muat Data</button>
    </div>
  );

  const { summary, by_product, recent_conversions, status_breakdown } = fgData;
  const MONTH_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const chartData = (by_product || []).slice(0, 10).map((p: any) => ({
    name: stripPackagingSuffix(p.product_name),
    cartons: p.cartons,
    loss_pct: p.loss_pct,
    fg_qty: p.fg_qty,
    wip_qty: p.wip_qty,
  }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl p-5 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ArrowsRightLeftIcon className="h-6 w-6" /> FG Conversion — WIP ke Finished Good
            </h2>
            <p className="text-sm text-emerald-100 mt-1">{MONTH_NAMES[month]} {year} · Konversi WIP menjadi produk jadi siap kirim</p>
          </div>
          <button onClick={onFetch} className="self-start sm:self-auto px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Konversi', value: summary.total_conversions, sub: `${summary.completed} selesai`, color: 'from-indigo-500 to-blue-600', icon: '📦' },
          { label: 'Total FG Output', value: fmtNum(summary.total_fg_qty), sub: 'pcs diproduksi', color: 'from-emerald-500 to-teal-600', icon: '✅' },
          { label: 'Total WIP Input', value: fmtNum(summary.total_wip_qty), sub: 'pcs WIP dipakai', color: 'from-violet-500 to-purple-600', icon: '🏭' },
          {
            label: 'Loss Rate',
            value: `${summary.loss_pct}%`,
            sub: `${fmtNum(summary.total_loss_qty)} pcs loss`,
            color: summary.loss_pct > 5 ? 'from-red-500 to-rose-600' : 'from-amber-400 to-orange-500',
            icon: summary.loss_pct > 5 ? '⚠️' : '📉'
          },
        ].map((card, i) => (
          <div key={i} className={`bg-gradient-to-br ${card.color} rounded-xl p-4 text-white shadow`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-white/80">{card.label}</p>
                <p className="text-2xl font-bold mt-1">{card.value}</p>
                <p className="text-xs text-white/70 mt-1">{card.sub}</p>
              </div>
              <span className="text-2xl">{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Status Breakdown + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Status Pills */}
        <div className="bg-white rounded-xl p-5 shadow border">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Status Konversi</h3>
          <div className="space-y-3">
            {Object.entries(status_breakdown || {}).map(([status, count]) => {
              const cfg = statusConfig[status] || { label: status, color: 'text-gray-600', bg: 'bg-gray-100' };
              const pct = summary.total_conversions > 0 ? Math.round((count as number) / summary.total_conversions * 100) : 0;
              return (
                <div key={status}>
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-sm font-bold text-gray-800">{count as number} <span className="text-gray-400 font-normal text-xs">({pct}%)</span></span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-gradient-to-r from-indigo-400 to-blue-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(status_breakdown || {}).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Tidak ada data</p>
            )}
          </div>
        </div>

        {/* Bar Chart Top 10 Products */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow border">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Output FG per Produk (Top 10 · karton)</h3>
          {chartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={160} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(val: number, name: string) => [
                      name === 'cartons' ? `${fmtNum(val)} karton` : `${val}%`,
                      name === 'cartons' ? 'FG Karton' : 'Loss %'
                    ]}
                  />
                  <Bar dataKey="cartons" name="FG Karton" fill="#10B981" radius={[0, 4, 4, 0]}
                    label={{ position: 'right', fontSize: 10, fill: '#374151', formatter: (v: number) => v > 0 ? fmtNum(v) : '' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Tidak ada data produk</div>
          )}
        </div>
      </div>

      {/* Per Product Detail Table */}
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <div className="px-5 py-4 border-b bg-gradient-to-r from-emerald-50 to-teal-50">
          <h3 className="text-sm font-semibold text-gray-900">Detail FG per Produk</h3>
          <p className="text-xs text-gray-500 mt-0.5">WIP terpakai, FG dihasilkan, loss, dan jumlah batch</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs font-semibold">
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Produk</th>
                <th className="px-4 py-3 text-right">WIP Input (pcs)</th>
                <th className="px-4 py-3 text-right">FG Output (pcs)</th>
                <th className="px-4 py-3 text-right">Karton</th>
                <th className="px-4 py-3 text-right">Loss (pcs)</th>
                <th className="px-4 py-3 text-right">Loss %</th>
                <th className="px-4 py-3 text-right">Batch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(by_product || []).map((p: any, i: number) => (
                <tr key={i} className={`hover:bg-gray-50 transition ${p.loss_pct > 5 ? 'bg-red-50/40' : ''}`}>
                  <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{stripPackagingSuffix(p.product_name)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{fmtNum(p.wip_qty)}</td>
                  <td className="px-4 py-3 text-right text-emerald-700 font-semibold">{fmtNum(p.fg_qty)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full text-xs font-bold">{fmtNum(p.cartons)}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-red-500">{fmtNum(p.loss_qty)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      p.loss_pct === 0 ? 'bg-green-100 text-green-700' :
                      p.loss_pct <= 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    }`}>{p.loss_pct}%</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{p.batch_count}</td>
                </tr>
              ))}
              {(by_product || []).length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Tidak ada data produk</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Conversions Table */}
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <div className="px-5 py-4 border-b bg-gradient-to-r from-slate-50 to-gray-50">
          <h3 className="text-sm font-semibold text-gray-900">Riwayat Konversi Terbaru</h3>
          <p className="text-xs text-gray-500 mt-0.5">30 konversi terakhir pada periode ini</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100 text-gray-600 font-semibold">
                <th className="px-3 py-2.5 text-left">No. Konversi</th>
                <th className="px-3 py-2.5 text-left">Batch</th>
                <th className="px-3 py-2.5 text-left">WO</th>
                <th className="px-3 py-2.5 text-left">Produk FG</th>
                <th className="px-3 py-2.5 text-center">Tanggal</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="px-3 py-2.5 text-center">QC</th>
                <th className="px-3 py-2.5 text-right">WIP (pcs)</th>
                <th className="px-3 py-2.5 text-right">FG (pcs)</th>
                <th className="px-3 py-2.5 text-right">Loss %</th>
                <th className="px-3 py-2.5 text-center">Validasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(recent_conversions || []).map((c: any, i: number) => {
                const sc = statusConfig[c.status] || { label: c.status, color: 'text-gray-600', bg: 'bg-gray-100' };
                const qc = qcConfig[c.qc_status] || { label: c.qc_status, color: 'text-gray-500' };
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-indigo-700 font-medium">{c.conversion_number}</td>
                    <td className="px-3 py-2 font-mono text-gray-600">{c.batch_number}</td>
                    <td className="px-3 py-2 text-blue-600 font-medium">{c.wo_number}</td>
                    <td className="px-3 py-2 text-gray-800 max-w-[180px] truncate" title={c.fg_products}>{stripPackagingSuffix(c.fg_products)}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{c.conversion_date}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.bg} ${sc.color}`}>{sc.label}</span>
                    </td>
                    <td className={`px-3 py-2 text-center font-semibold ${qc.color}`}>{qc.label}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmtNum(c.total_wip_qty)}</td>
                    <td className="px-3 py-2 text-right text-emerald-700 font-semibold">{fmtNum(c.total_fg_qty)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`font-semibold ${
                        c.loss_pct === 0 ? 'text-green-600' : c.loss_pct <= 2 ? 'text-yellow-600' : 'text-red-600'
                      }`}>{c.loss_pct}%</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {c.batch_validated
                        ? <span className="text-green-600 font-bold">✓</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                );
              })}
              {(recent_conversions || []).length === 0 && (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">Tidak ada data konversi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProductionMonitoringDashboard;
