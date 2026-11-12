import React, { useState, useEffect } from 'react';
import {
  Bar, ComposedChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart,
} from 'recharts';
import { showError } from '../../components/ui';
import { PageHeader, KpiStrip, Panel } from '../../components/ui/PageKit';

interface AnalyticsFilters {
  date_from: string;
  date_to: string;
  machine_id: string;
  maintenance_type: string;
  department: string;
  report_type: string;
}

interface AnalyticsData {
  summary: {
    total_work_orders: number;
    completed_work_orders: number;
    pending_work_orders: number;
    total_cost: number;
    average_completion_time: number;
    mttr: number;
    mtbf: number;
    availability_rate: number;
  };
  charts: {
    maintenance_by_type: Array<{ name: string; value: number; color: string }>;
    monthly_trends: Array<{ month: string; work_orders: number; cost: number; mttr: number }>;
    machine_performance: Array<{ machine: string; availability: number; mttr: number; cost: number }>;
    cost_breakdown: Array<{ category: string; amount: number; percentage: number }>;
    downtime_analysis: Array<{ reason: string; hours: number; frequency: number }>;
  };
  kpis: {
    preventive_ratio: number;
    emergency_ratio: number;
    cost_per_hour: number;
    parts_cost_ratio: number;
    labor_cost_ratio: number;
    schedule_compliance: number;
  };
}

const COLORS = ['rgb(var(--brand-600))', '#0f766e', '#d97706', '#dc2626', '#6b7280', '#0369a1'];

const reportTypes = [
  { value: 'overview', label: 'Ringkasan' },
  { value: 'performance', label: 'Kinerja' },
  { value: 'cost_analysis', label: 'Analisis biaya' },
  { value: 'downtime', label: 'Downtime' },
  { value: 'parts_usage', label: 'Pemakaian sparepart' },
  { value: 'compliance', label: 'Kepatuhan jadwal' },
];

const maintenanceTypes = [
  { value: 'preventive', label: 'Preventive' },
  { value: 'corrective', label: 'Corrective' },
  { value: 'emergency', label: 'Darurat' },
  { value: 'inspection', label: 'Inspeksi' },
  { value: 'calibration', label: 'Kalibrasi' },
];

const inputCls = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white';
const labelCls = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

const formatHours = (hours: number) => `${hours.toLocaleString('id-ID', { maximumFractionDigits: 1 })} jam`;

const MaintenanceAnalyticsForm: React.FC = () => {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    date_from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    machine_id: '',
    maintenance_type: '',
    department: '',
    report_type: 'overview',
  });

  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [machines, setMachines] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    fetchMachines();
    fetchDepartments();
  }, []);

  const fetchMachines = async () => {
    try {
      const response = await fetch('/api/production/machines', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setMachines(data.machines || []);
      }
    } catch (error) {
      console.error('Failed to fetch machines:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/hr/departments', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments?.map((d: any) => d.name) || []);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const buildParams = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    return params;
  };

  const generateAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/maintenance/analytics?${buildParams()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        setAnalyticsData(await response.json());
      } else {
        showError('Analitik gagal dimuat');
      }
    } catch (error) {
      showError('Terjadi kesalahan saat memuat analitik');
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const params = buildParams();
      params.append('format', 'excel');
      const response = await fetch(`/api/maintenance/analytics/export?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) {
        let msg = 'Ekspor gagal';
        try { msg = (await response.json()).error || msg; } catch { /* body bukan JSON */ }
        showError(msg);
        return;
      }
      const url = window.URL.createObjectURL(await response.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `maintenance-analitik-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showError('Terjadi kesalahan saat ekspor');
    } finally {
      setExporting(false);
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const s = analyticsData?.summary;
  const completion = s && s.total_work_orders > 0 ? (s.completed_work_orders / s.total_work_orders) * 100 : null;
  const tone = (value: number, threshold: number) => (value >= threshold ? 'good' : value >= threshold * 0.8 ? 'warn' : 'bad');

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analitik Maintenance"
        subtitle="Kinerja perawatan mesin: ketersediaan, MTTR, biaya, dan downtime"
        actions={
          analyticsData ? (
            <button
              onClick={exportExcel}
              disabled={exporting}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              {exporting ? 'Menyiapkan...' : 'Ekspor Excel'}
            </button>
          ) : undefined
        }
      />

      <Panel title="Filter">
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3 lg:grid-cols-4">
          <div>
            <label className={labelCls}>Jenis laporan</label>
            <select name="report_type" value={filters.report_type} onChange={handleFilterChange} className={inputCls}>
              {reportTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Dari tanggal</label>
            <input type="date" name="date_from" value={filters.date_from} onChange={handleFilterChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sampai tanggal</label>
            <input type="date" name="date_to" value={filters.date_to} onChange={handleFilterChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Mesin</label>
            <select name="machine_id" value={filters.machine_id} onChange={handleFilterChange} className={inputCls}>
              <option value="">Semua mesin</option>
              {machines.map((machine) => (
                <option key={machine.id} value={machine.id}>{machine.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Jenis perawatan</label>
            <select name="maintenance_type" value={filters.maintenance_type} onChange={handleFilterChange} className={inputCls}>
              <option value="">Semua jenis</option>
              {maintenanceTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end md:col-span-2">
            <button
              onClick={generateAnalytics}
              disabled={loading}
              className="w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {loading ? 'Memuat...' : 'Tampilkan analitik'}
            </button>
          </div>
        </div>
      </Panel>

      {analyticsData && s && (
        <div className="space-y-4">
          <KpiStrip
            items={[
              { label: 'Total SPK perawatan', value: s.total_work_orders.toLocaleString('id-ID') },
              { label: 'Tingkat selesai', value: completion === null ? '-' : `${completion.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`, hint: `${s.completed_work_orders} selesai, ${s.pending_work_orders} menunggu` },
              { label: 'MTTR (rata-rata waktu perbaikan)', value: formatHours(s.mttr), hint: s.mtbf ? `MTBF ${formatHours(s.mtbf)}` : undefined },
              { label: 'Total biaya', value: formatCurrency(s.total_cost), hint: analyticsData.kpis.cost_per_hour ? `${formatCurrency(analyticsData.kpis.cost_per_hour)} per jam` : undefined },
            ]}
          />

          <KpiStrip
            items={[
              { label: 'Ketersediaan mesin', value: `${s.availability_rate.toFixed(1)}%`, tone: tone(s.availability_rate, 85), hint: 'target 85%' },
              { label: 'Porsi preventive', value: `${analyticsData.kpis.preventive_ratio.toFixed(1)}%`, tone: tone(analyticsData.kpis.preventive_ratio, 70), hint: 'target 70%' },
              { label: 'Porsi darurat', value: `${analyticsData.kpis.emergency_ratio.toFixed(1)}%`, tone: analyticsData.kpis.emergency_ratio > 10 ? 'warn' : null, hint: 'semakin kecil semakin baik' },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Perawatan per jenis">
              <div className="h-72 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analyticsData.charts.maintenance_by_type}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={90}
                      dataKey="value"
                    >
                      {analyticsData.charts.maintenance_by_type.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Tren bulanan">
              <div className="h-72 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={analyticsData.charts.monthly_trends}>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="work_orders" fill="rgb(var(--brand-200))" name="SPK" />
                    <Line yAxisId="right" type="monotone" dataKey="mttr" stroke="rgb(var(--brand-600))" strokeWidth={2} dot={false} name="MTTR (jam)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Ketersediaan per mesin">
              <div className="h-72 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.charts.machine_performance}>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="machine" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="availability" fill="rgb(var(--brand-600))" name="Ketersediaan (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Rincian biaya">
              <div className="h-72 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analyticsData.charts.cost_breakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ category, percentage }: any) => `${category} ${Number(percentage).toFixed(1)}%`}
                      outerRadius={90}
                      dataKey="amount"
                    >
                      {analyticsData.charts.cost_breakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          {filters.report_type === 'downtime' && analyticsData.charts.downtime_analysis.length > 0 && (
            <Panel title="Analisis downtime">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-2.5">Penyebab</th>
                      <th className="px-4 py-2.5 text-right">Total jam</th>
                      <th className="px-4 py-2.5 text-right">Kejadian</th>
                      <th className="px-4 py-2.5 text-right">Rata-rata per kejadian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {analyticsData.charts.downtime_analysis.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white">{item.reason}</td>
                        <td className="px-4 py-2.5 text-right text-sm tabular-nums text-gray-600 dark:text-gray-300">{formatHours(item.hours)}</td>
                        <td className="px-4 py-2.5 text-right text-sm tabular-nums text-gray-600 dark:text-gray-300">{item.frequency}</td>
                        <td className="px-4 py-2.5 text-right text-sm tabular-nums text-gray-600 dark:text-gray-300">{formatHours(item.hours / item.frequency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </div>
      )}

      {!analyticsData && !loading && (
        <Panel title="Belum ada analitik">
          <p className="p-4 text-sm text-gray-600 dark:text-gray-300">
            Atur filter lalu tekan "Tampilkan analitik" untuk melihat kinerja perawatan.
          </p>
        </Panel>
      )}
    </div>
  );
};

export default MaintenanceAnalyticsForm;
