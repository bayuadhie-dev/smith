import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { showSuccess, showError } from '../../components/ui/Toast';
import { Plus, ChartBar, Trash2, Calendar, Package, ArrowRight } from 'lucide-react';
import PeriodSelectModal from './PeriodSelectModal';
import { fmtMonth } from './forecastPeriod';

interface ForecastHeaderSummary {
  id: number;
  period_start: string;
  period_end: string;
  name: string | null;
  status: string;
  line_count: number;
  total_qty: number;
  total_converted_qty: number;
  updated_at: string;
}

// §7.3: 1 halaman untuk pilih forecast mana yang mau dibuka. §7.1: Create = MODAL ringan
// (bulan mulai + nama opsional), submit langsung masuk ke halaman grid (SalesForecastGrid.tsx).
// Rombak 2026-08-25 (keputusan manajemen): forecast bukan lagi "per tahun kalender" tapi
// rolling 12-bulan bebas mulai dari bulan apa saja - period_start dipilih via <input type="month">.
// Rombak 2026-08-25 (putaran 2): klik kartu TIDAK langsung ke grid - munculkan dialog
// pilih periode (1 bulan / rentang bulan) dulu, grid lalu hanya menampilkan bulan terpilih.
export default function SalesForecastList() {
  const navigate = useNavigate();
  const [headers, setHeaders] = useState<ForecastHeaderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [periodStart, setPeriodStart] = useState(defaultMonth);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [periodPickerFor, setPeriodPickerFor] = useState<ForecastHeaderSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/sales/forecasts');
      setHeaders(res.data.forecasts || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setError(null);
    if (!periodStart) {
      setError('Bulan mulai wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      const res = await axiosInstance.post('/api/sales/forecasts', {
        period_start: periodStart,
        name: name || undefined,
      });
      navigate(`/app/sales/forecasts/${res.data.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Gagal membuat forecast.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (h: ForecastHeaderSummary) => {
    if (!window.confirm(`Hapus forecast "${h.name || fmtMonth(h.period_start)}"? Semua data grid ikut terhapus.`)) return;
    try {
      await axiosInstance.delete(`/api/sales/forecasts/${h.id}`);
      showSuccess('Forecast dihapus');
      load();
    } catch (e: any) {
      showError(e?.response?.data?.error || 'Gagal menghapus forecast');
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ChartBar className="w-6 h-6" /> Sales Forecast
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            1 forecast = rolling 12 bulan dari bulan mulai yang dipilih. Klik kartu untuk pilih periode lalu buka grid.
          </p>
        </div>
        <button
          onClick={() => { setShowModal(true); setError(null); setPeriodStart(defaultMonth); setName(''); }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-lg shadow-sm hover:shadow-md transition-shadow"
        >
          <Plus className="w-4 h-4" /> Forecast Baru
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Memuat...</div>
      ) : headers.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          <ChartBar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Belum ada forecast — buat yang pertama.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {headers.map((h) => {
            const realizationPct = h.total_qty > 0 ? Math.min(100, Math.round((h.total_converted_qty / h.total_qty) * 100)) : 0;
            return (
              <div
                key={h.id}
                onClick={() => setPeriodPickerFor(h)}
                className="group relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="h-1.5 w-full bg-gradient-to-r from-blue-400 to-indigo-500" />

                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>

                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1 truncate">
                    {h.name || fmtMonth(h.period_start)}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    {fmtMonth(h.period_start)} &rarr; {fmtMonth(h.period_end)}
                  </p>

                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                      <Package className="w-3.5 h-3.5" /> {h.line_count} produk
                    </span>
                    <span className="text-gray-400 text-xs">{new Date(h.updated_at).toLocaleDateString('id-ID')}</span>
                  </div>

                  {h.total_qty > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                        <span>Realisasi ke SO</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-200">{realizationPct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${realizationPct >= 100 ? 'bg-green-500' : realizationPct > 0 ? 'bg-orange-400' : 'bg-gray-300'}`}
                          style={{ width: `${realizationPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 group-hover:gap-1.5 transition-all">
                      Pilih periode &amp; buka <ArrowRight className="w-3 h-3" />
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(h); }}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Forecast Baru</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Berlaku 12 bulan berturut-turut dari bulan yang dipilih.</p>
            {error && <div className="mb-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Bulan Mulai</label>
                <input
                  type="month"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nama (opsional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="mis. Forecast Q3 2026 - Q2 2027"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn-outline" onClick={() => setShowModal(false)} disabled={saving}>Batal</button>
              <button className="btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? 'Membuat...' : 'Buat & Buka Grid'}
              </button>
            </div>
          </div>
        </div>
      )}

      {periodPickerFor && (
        <PeriodSelectModal
          onClose={() => setPeriodPickerFor(null)}
          onConfirm={(newWindow, count) => {
            const qs = newWindow ? `?window=${newWindow}&count=${count}` : '';
            navigate(`/app/sales/forecasts/${periodPickerFor.id}${qs}`);
          }}
        />
      )}
    </div>
  );
}
