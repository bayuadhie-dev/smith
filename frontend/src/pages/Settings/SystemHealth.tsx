import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface PM2Process {
  name: string; status: string; restarts: number;
  uptime_ms: number; memory_mb: number; cpu: number;
}
interface HealthData {
  timestamp: string; server: string;
  api: { status: string; uptime_human: string; uptime_seconds: number; pid: number; python_version: string };
  resources: { cpu_percent: number; cpu_status: string; memory_used_mb: number; memory_total_mb: number; memory_percent: number; memory_status: string; disk_used_gb: number; disk_total_gb: number; disk_percent: number; disk_status: string };
  database: { status: string; size_mb: number; table_count: number; last_backup: string; engine: string; error?: string };
  whatsapp: { status: string; healthy: boolean; session_name: string; session_id: string; phone: string; push_name: string; last_active: string; gateway_url: string; error?: string };
  pm2: { processes: PM2Process[]; error?: string };
  recent_errors: string[];
}

function fmtPhone(raw: string) {
  if (!raw) return '—';
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('62') && d.length >= 10) {
    const local = '0' + d.slice(2);
    return local.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3');
  }
  return raw;
}

function fmtUptime(ms?: number) {
  if (!ms) return '—';
  const secs = Math.floor((Date.now() - ms) / 1000);
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    healthy:      { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500',  label: 'Healthy'       },
    ready:        { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500',  label: 'Connected'     },
    online:       { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500',  label: 'Online'        },
    warning:      { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500',  label: 'Warning'       },
    error:        { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Error'         },
    stopped:      { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Stopped'       },
    disconnected: { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Disconnected'  },
    not_configured: { bg: 'bg-gray-100', text: 'text-gray-500',  dot: 'bg-gray-400',  label: 'Not configured'},
  };
  const s = map[status] ?? { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400', label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function UsageBar({ percent, status }: { percent: number; status: string }) {
  const color = status === 'warning' ? 'bg-amber-500' : percent > 90 ? 'bg-red-500' : 'bg-green-500';
  return (
    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}

function MetricRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="flex items-center gap-2 text-sm text-gray-500">
        <i className={`ti ${icon} text-base`} aria-hidden="true" />
        {label}
      </span>
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{children}</p>;
}

interface ResourcePoint {
  timestamp: string;
  cpu_percent: number | null;
  memory_percent: number | null;
  disk_percent: number | null;
}
interface StatusPoint {
  timestamp: string;
  database_status: string;
  whatsapp_status: string;
}
interface SlowEndpoint {
  endpoint: string;
  avg_ms: number;
  max_ms: number;
  request_count: number;
}
interface HistoryData {
  range: string;
  point_count: number;
  resource_series: ResourcePoint[];
  status_series: StatusPoint[];
  slowest_endpoints: SlowEndpoint[];
}

function fmtChartTime(ts: string, range: string) {
  const d = new Date(ts);
  if (range === '24h') {
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

function StatusUptimeBar({ points, statusKey, label }: { points: StatusPoint[]; statusKey: 'database_status' | 'whatsapp_status'; label: string }) {
  const healthyValues = ['healthy', 'ready'];
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-xs text-gray-400">
          {points.length > 0
            ? `${Math.round((points.filter(p => healthyValues.includes(p[statusKey])).length / points.length) * 100)}% uptime`
            : '—'}
        </span>
      </div>
      <div className="flex gap-[1px] h-4 rounded overflow-hidden">
        {points.map((p, i) => (
          <div
            key={i}
            title={`${p.timestamp}: ${p[statusKey]}`}
            className={`flex-1 ${healthyValues.includes(p[statusKey]) ? 'bg-green-400' : 'bg-red-400'}`}
          />
        ))}
        {points.length === 0 && <div className="flex-1 bg-gray-100 dark:bg-gray-800" />}
      </div>
    </div>
  );
}

function HealthHistorySection({ apiBase }: { apiBase: string }) {
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('24h');

  const fetchHistory = useCallback(async (selectedRange: string) => {
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${apiBase}/api/health/history`, { params: { range: selectedRange } });
      setHistory(res.data);
    } catch {
      setHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  }, [apiBase]);

  useEffect(() => { fetchHistory(range); }, [range, fetchHistory]);

  return (
    <Card className="col-span-full">
      <div className="flex items-center justify-between mb-4">
        <SectionTitle>Resource Trend</SectionTitle>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {(['24h', '7d', '30d'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                range === r ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500'
              }`}
            >
              {r === '24h' ? '24 Jam' : r === '7d' ? '7 Hari' : '30 Hari'}
            </button>
          ))}
        </div>
      </div>

      {historyLoading && (
        <div className="h-64 flex items-center justify-center text-sm text-gray-400">Memuat data trend...</div>
      )}

      {!historyLoading && (!history || history.point_count === 0) && (
        <div className="h-64 flex items-center justify-center text-sm text-gray-400">
          Belum ada data history. Data akan muncul setelah collector berjalan beberapa saat.
        </div>
      )}

      {!historyLoading && history && history.point_count > 0 && (
        <>
          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history.resource_series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(ts) => fmtChartTime(ts, history.range)}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  minTickGap={30}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} unit="%" />
                <Tooltip
                  labelFormatter={(ts) => new Date(ts as string).toLocaleString('id-ID')}
                  formatter={(value: number, name: string) => [`${value}%`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="cpu_percent" name="CPU" stroke="#3b82f6" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="memory_percent" name="Memory" stroke="#8b5cf6" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="disk_percent" name="Disk" stroke="#f59e0b" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mb-6">
            <StatusUptimeBar points={history.status_series} statusKey="database_status" label="Database Uptime" />
            <StatusUptimeBar points={history.status_series} statusKey="whatsapp_status" label="WhatsApp Gateway Uptime" />
          </div>

          {history.slowest_endpoints.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Endpoint Terlambat (Top 10)</p>
              <div className="space-y-1.5">
                {history.slowest_endpoints.map((ep, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <span className="font-mono text-gray-600 dark:text-gray-400 truncate flex-1 mr-3">{ep.endpoint}</span>
                    <span className="text-gray-400 mr-3">{ep.request_count}x</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100 w-16 text-right">{ep.avg_ms}ms avg</span>
                    <span className="text-gray-400 w-16 text-right">{ep.max_ms}ms max</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}


export default function SystemHealth() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectMsg, setReconnectMsg] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealth = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await axios.get(`${API_BASE}/api/health/system`);
      setData(res.data);
      setLastRefreshed(new Date());
    } catch (e) {
      console.error('Failed to fetch health:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => fetchHealth(true), 30000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchHealth]);

  const handleReconnect = async () => {
    setReconnecting(true);
    setReconnectMsg('');
    try {
      const res = await axios.post(`${API_BASE}/api/health/whatsapp/reconnect`);
      setReconnectMsg(res.data.success ? 'Reconnect triggered — refreshing in 5s…' : `Failed: ${res.data.error}`);
      if (res.data.success) setTimeout(() => fetchHealth(true), 5000);
    } catch {
      setReconnectMsg('Request failed');
    } finally {
      setReconnecting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <i className="ti ti-loader-2 text-3xl text-gray-400 animate-spin block mb-3" />
        <p className="text-sm text-gray-500">Loading system health…</p>
      </div>
    </div>
  );

  if (!data) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <i className="ti ti-alert-circle text-3xl text-red-400 block mb-3" />
        <p className="text-sm text-gray-500">Failed to load health data.</p>
        <button className="mt-4 text-sm px-4 py-2 border rounded-lg" onClick={() => fetchHealth()}>Retry</button>
      </div>
    </div>
  );

  const { api, resources, database, whatsapp, pm2, recent_errors } = data;
  const overallOk = api.status === 'healthy' && database.status === 'healthy' && whatsapp.healthy && resources.cpu_status === 'healthy' && resources.memory_status === 'healthy';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">System health</h1>
            <StatusBadge status={overallOk ? 'healthy' : 'warning'} />
          </div>
          <p className="text-sm text-gray-400">
            {data.server}&nbsp;·&nbsp;
            {lastRefreshed ? `Refreshed ${lastRefreshed.toLocaleTimeString()}` : 'Loading…'}
            &nbsp;·&nbsp;
            <button className="text-blue-500 hover:underline text-sm" onClick={() => setAutoRefresh(v => !v)}>
              Auto-refresh {autoRefresh ? 'on' : 'off'}
            </button>
          </p>
        </div>
        <button
          onClick={() => fetchHealth()}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          <i className={`ti ti-refresh text-base ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'API server', status: api.status, sub: `Uptime ${api.uptime_human}`, icon: 'ti-server' },
          { label: 'Database', status: database.status, sub: `${database.size_mb} MB · ${database.table_count} tables`, icon: 'ti-database' },
          { label: 'WhatsApp', status: whatsapp.healthy ? 'ready' : whatsapp.status, sub: whatsapp.phone ? fmtPhone(whatsapp.phone) : '—', icon: 'ti-brand-whatsapp' },
          { label: 'Frontend', status: pm2.processes.find(p => p.name === 'smith-frontend')?.status ?? 'unknown', sub: 'smith-frontend · PM2', icon: 'ti-layout' },
        ].map(({ label, status, sub, icon }) => (
          <Card key={label}>
            <div className="flex items-center gap-2 mb-3">
              <i className={`ti ${icon} text-lg text-gray-400`} aria-hidden="true" />
              <span className="text-xs text-gray-500 font-medium">{label}</span>
            </div>
            <StatusBadge status={status} />
            <p className="text-xs text-gray-400 mt-2">{sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        <Card>
          <SectionTitle>Resource usage</SectionTitle>
          <div className="space-y-4">
            {[
              { icon: 'ti-cpu', label: 'CPU', value: `${resources.cpu_percent}%`, percent: resources.cpu_percent, status: resources.cpu_status },
              { icon: 'ti-device-desktop-analytics', label: 'Memory', value: `${(resources.memory_used_mb/1024).toFixed(1)} GB / ${(resources.memory_total_mb/1024).toFixed(1)} GB`, percent: resources.memory_percent, status: resources.memory_status },
              { icon: 'ti-database', label: 'Disk', value: `${resources.disk_used_gb} GB / ${resources.disk_total_gb} GB`, percent: resources.disk_percent, status: resources.disk_status },
            ].map(({ icon, label, value, percent, status }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-2 text-sm text-gray-500">
                    <i className={`ti ${icon} text-base`} aria-hidden="true" />
                    {label}
                  </span>
                  <span className={`text-sm font-medium ${status === 'warning' ? 'text-amber-600' : 'text-gray-900 dark:text-gray-100'}`}>{value}</span>
                </div>
                <UsageBar percent={percent} status={status} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle>Database</SectionTitle>
          <MetricRow icon="ti-table" label="Tables" value={String(database.table_count)} />
          <MetricRow icon="ti-file-database" label="Size" value={`${database.size_mb} MB`} />
          <MetricRow icon="ti-clock" label="Last backup" value={database.last_backup === 'unknown' ? 'No backup found' : database.last_backup} />
          <MetricRow icon="ti-engine" label="Engine" value={database.engine} />
          <MetricRow icon="ti-activity" label="Status" value={database.status === 'healthy' ? 'Online' : 'Error'} />
        </Card>
      </div>

      <Card className="mb-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>WhatsApp gateway</SectionTitle>
          <div className="flex items-center gap-3">
            {reconnectMsg && (
              <span className={`text-xs ${reconnectMsg.startsWith('Failed') || reconnectMsg.startsWith('Request') ? 'text-red-500' : 'text-green-600'}`}>
                {reconnectMsg}
              </span>
            )}
            <button
              onClick={handleReconnect}
              disabled={reconnecting || whatsapp.healthy}
              className="text-sm px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {reconnecting
                ? <><i className="ti ti-loader-2 animate-spin text-sm" /> Connecting…</>
                : <><i className="ti ti-refresh text-sm" /> Reconnect</>}
            </button>
          </div>
        </div>

        {!whatsapp.healthy && whatsapp.status !== 'not_configured' && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 mb-4 text-sm text-red-700 dark:text-red-400">
            <i className="ti ti-alert-triangle text-base mt-0.5" aria-hidden="true" />
            Notifikasi WO otomatis tidak akan terkirim sampai gateway reconnect.
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Status', value: <StatusBadge status={whatsapp.status} /> },
            { label: 'Nomor aktif', value: fmtPhone(whatsapp.phone) },
            { label: 'Push name', value: whatsapp.push_name || '—' },
            { label: 'Terakhir aktif', value: whatsapp.last_active || '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-400">
          <span>Session: <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{whatsapp.session_name}</code></span>
          <span className="font-mono">{whatsapp.session_id?.slice(0, 8)}…</span>
        </div>
      </Card>

      <HealthHistorySection apiBase={API_BASE} />
      <Card className="mb-5">
        <SectionTitle>PM2 processes</SectionTitle>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {pm2.processes.map(proc => (
            <div key={proc.name} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <i className="ti ti-terminal text-gray-400 text-base" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{proc.name}</p>
                  <p className="text-xs text-gray-400">Uptime {fmtUptime(proc.uptime_ms)} · {proc.restarts} restart{proc.restarts !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-right">
                <div><p className="text-xs text-gray-400">CPU</p><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{proc.cpu}%</p></div>
                <div><p className="text-xs text-gray-400">Memory</p><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{proc.memory_mb} MB</p></div>
                <StatusBadge status={proc.status} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Recent errors</SectionTitle>
        {recent_errors.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <i className="ti ti-circle-check text-base" aria-hidden="true" />
            No errors in the recent log
          </div>
        ) : (
          <div className="space-y-1.5">
            {recent_errors.map((line, i) => (
              <div key={i} className="text-xs font-mono bg-gray-50 dark:bg-gray-800 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg break-all">
                {line}
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="text-center text-xs text-gray-300 dark:text-gray-600 mt-6">
        Python {api.python_version} · PID {api.pid} · {data.server}
      </p>
    </div>
  );
}
