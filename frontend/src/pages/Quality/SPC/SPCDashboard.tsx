import React, { useState } from 'react';
import {
  useGetSPCDashboardQuery,
  useGetSPCChartDataQuery,
  useGetSPCParametersQuery,
  useGetSPCSpecsQuery,
  useRecalculateSPCLimitsMutation,
} from '../../../services/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ScatterChart, Scatter
} from 'recharts';
import {
  BeakerIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ChartBarIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline';
import SPCSampleForm from './SPCSampleForm';

// ─── Types ───────────────────────────────────
interface CapabilityBadgeProps { cpk: number | null; }
interface ChartPoint {
  sample_number: string;
  sample_time: string;
  xbar: number | null;
  r_value: number | null;
  is_out_of_control: boolean;
  violations: string[];
}

// ─── Helpers ─────────────────────────────────
const CapabilityBadge: React.FC<CapabilityBadgeProps> = ({ cpk }) => {
  if (cpk === null) return (
    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
      Insufficient Data
    </span>
  );
  if (cpk >= 1.33) return (
    <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 font-medium">
      Capable ✓
    </span>
  );
  if (cpk >= 1.0) return (
    <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 font-medium">
      Marginal ⚠
    </span>
  );
  return (
    <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 font-medium">
      Not Capable ✗
    </span>
  );
};

const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (payload.is_out_of_control) {
    return <circle cx={cx} cy={cy} r={6} fill="#EF4444" stroke="#fff" strokeWidth={2} />;
  }
  return <circle cx={cx} cy={cy} r={4} fill="#3B82F6" stroke="#fff" strokeWidth={1} />;
};

// ─── Main Component ───────────────────────────
export default function SPCDashboard() {
  const [selectedProductId, setSelectedProductId] = useState<number | undefined>();
  const [selectedParameterId, setSelectedParameterId] = useState<number | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [chartLimit, setChartLimit] = useState(30);

  const { data: dashboardData, isLoading: dashLoading, refetch: refetchDash } =
    useGetSPCDashboardQuery({ product_id: selectedProductId });

  const { data: chartData, isLoading: chartLoading } =
    useGetSPCChartDataQuery(
      { product_id: selectedProductId!, parameter_id: selectedParameterId!, limit: chartLimit },
      { skip: !selectedProductId || !selectedParameterId }
    );

  const { data: paramsData } = useGetSPCParametersQuery();
  const { data: specsData } = useGetSPCSpecsQuery(
    { product_id: selectedProductId },
    { skip: !selectedProductId }
  );

  const [recalculate, { isLoading: recalcLoading }] = useRecalculateSPCLimitsMutation();

  const dashboard = dashboardData || {};
  const capSummary: any[] = dashboard.capability_summary || [];
  const chart: ChartPoint[] = chartData?.chart_data || [];
  const limits = chartData?.control_limits || {};
  const capability = chartData?.capability || {};

  // Ambil unique products dari capability summary
  const uniqueProducts = Array.from(
    new Map(capSummary.map((c: any) => [c.product_id, { id: c.product_id, name: c.product_name }])).values()
  );

  const handleRecalculate = async () => {
    if (!selectedProductId || !selectedParameterId) return;
    await recalculate({ product_id: selectedProductId, parameter_id: selectedParameterId });
    refetchDash();
  };

  if (dashLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Statistical Process Control
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            X-bar R Chart · Capability Analysis · Western Electric Rules
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusCircleIcon className="h-5 w-5" />
          Input Sample
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3">
            <BeakerIcon className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Samples Today</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {dashboard.today_samples ?? 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Out of Control Today</p>
              <p className={`text-2xl font-bold ${dashboard.today_ooc > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {dashboard.today_ooc ?? 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Capable Parameters</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {capSummary.filter((c: any) => c.status === 'capable').length}
                <span className="text-sm text-gray-400 font-normal"> / {capSummary.length}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Capability Summary Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Capability Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                {['Product', 'Parameter', 'Cp', 'Cpk', 'Samples', 'OOC', 'Status', 'Chart'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {capSummary.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    <ChartBarIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>Belum ada data SPC</p>
                    <p className="text-sm mt-1">Input sample pertama untuk mulai monitoring</p>
                  </td>
                </tr>
              ) : (
                capSummary.map((c: any, i: number) => (
                  <tr key={i} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    selectedProductId === c.product_id && selectedParameterId === c.parameter_id
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : ''
                  }`}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {c.product_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                        {c.parameter_code}
                      </span>
                      <span className="ml-2">{c.parameter_name}</span>
                      <span className="text-gray-400 ml-1 text-xs">({c.uom})</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono">
                      {c.cp ? c.cp.toFixed(3) : '-'}
                    </td>
                    <td className={`px-4 py-3 text-sm font-mono font-semibold ${
                      c.cpk >= 1.33 ? 'text-green-600' : c.cpk >= 1.0 ? 'text-yellow-600' : c.cpk ? 'text-red-600' : 'text-gray-400'
                    }`}>
                      {c.cpk ? c.cpk.toFixed(3) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{c.sample_count}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={c.ooc_count > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}>
                        {c.ooc_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <CapabilityBadge cpk={c.cpk} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setSelectedProductId(c.product_id);
                          // Cari parameter_id dari specsData atau capSummary
                          const spec = specsData?.specs?.find(
                            (s: any) => s.product_id === c.product_id && s.parameter_code === c.parameter_code
                          );
                          if (spec) setSelectedParameterId(spec.parameter_id);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 underline"
                      >
                        View Chart
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Control Chart */}
      {selectedProductId && selectedParameterId && (
        <div className="space-y-4">

          {/* Chart Controls */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">Points:</label>
                <select
                  value={chartLimit}
                  onChange={(e) => setChartLimit(Number(e.target.value))}
                  className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 dark:text-white"
                >
                  {[20, 30, 50, 100].map(n => (
                    <option key={n} value={n}>{n} points</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleRecalculate}
                disabled={recalcLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                <ArrowPathIcon className={`h-4 w-4 ${recalcLoading ? 'animate-spin' : ''}`} />
                Recalculate Limits
              </button>

              {/* Capability Info */}
              {capability.cpk !== undefined && (
                <div className="flex items-center gap-3 ml-auto text-sm">
                  <span className="text-gray-500">Cp: <strong>{capability.cp?.toFixed(3) ?? '-'}</strong></span>
                  <span className="text-gray-500">Cpk: <strong>{capability.cpk?.toFixed(3) ?? '-'}</strong></span>
                  <span className="text-gray-500">σ: <strong>{capability.sigma?.toFixed(4) ?? '-'}</strong></span>
                  <CapabilityBadge cpk={capability.cpk} />
                </div>
              )}
            </div>
          </div>

          {/* X-bar Chart */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                X-bar Chart
                {chartData?.out_of_control_count > 0 && (
                  <span className="ml-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                    {chartData.out_of_control_count} OOC
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-full bg-blue-500" /> In Control
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-full bg-red-500" /> Out of Control
                </span>
              </div>
            </div>

            {chartLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : chart.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <ChartBarIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>Belum ada data untuk parameter ini</p>
                </div>
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="sample_number"
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 shadow-lg text-sm">
                            <p className="font-semibold">{d.sample_number}</p>
                            <p>X̄ = <strong>{d.xbar?.toFixed(4)}</strong></p>
                            <p className="text-gray-500 text-xs">{new Date(d.sample_time).toLocaleString('id-ID')}</p>
                            {d.is_out_of_control && (
                              <div className="mt-1 text-red-600 text-xs">
                                {d.violations.map((v: string, i: number) => <p key={i}>⚠ {v}</p>)}
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />

                    {/* Control Limits */}
                    {limits.ucl && <ReferenceLine y={limits.ucl} stroke="#EF4444" strokeDasharray="4 2" label={{ value: `UCL ${limits.ucl}`, position: 'right', fontSize: 10, fill: '#EF4444' }} />}
                    {limits.lcl && <ReferenceLine y={limits.lcl} stroke="#EF4444" strokeDasharray="4 2" label={{ value: `LCL ${limits.lcl}`, position: 'right', fontSize: 10, fill: '#EF4444' }} />}
                    {limits.target && <ReferenceLine y={limits.target} stroke="#10B981" strokeDasharray="6 2" label={{ value: `CL ${limits.target}`, position: 'right', fontSize: 10, fill: '#10B981' }} />}
                    {limits.usl && <ReferenceLine y={limits.usl} stroke="#F59E0B" strokeDasharray="2 2" label={{ value: `USL`, position: 'right', fontSize: 10, fill: '#F59E0B' }} />}
                    {limits.lsl && <ReferenceLine y={limits.lsl} stroke="#F59E0B" strokeDasharray="2 2" label={{ value: `LSL`, position: 'right', fontSize: 10, fill: '#F59E0B' }} />}

                    <Line
                      type="linear"
                      dataKey="xbar"
                      stroke="#3B82F6"
                      strokeWidth={1.5}
                      dot={<CustomDot />}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* R Chart */}
          {chart.length > 0 && (
            <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">R Chart (Range)</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="sample_number" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(val: number) => [val?.toFixed(4), 'Range']} />
                    {limits.ucl_r && <ReferenceLine y={limits.ucl_r} stroke="#EF4444" strokeDasharray="4 2" label={{ value: `UCL_R ${limits.ucl_r}`, position: 'right', fontSize: 10, fill: '#EF4444' }} />}
                    {limits.lcl_r && limits.lcl_r > 0 && <ReferenceLine y={limits.lcl_r} stroke="#EF4444" strokeDasharray="4 2" />}
                    <Line type="linear" dataKey="r_value" stroke="#8B5CF6" strokeWidth={1.5} dot={{ r: 3, fill: '#8B5CF6' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sample Form Modal */}
      {showForm && (
        <SPCSampleForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            refetchDash();
          }}
        />
      )}
    </div>
  );
}
