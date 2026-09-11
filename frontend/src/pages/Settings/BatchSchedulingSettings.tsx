import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import SearchableSelect from '../../components/SearchableSelect';
import { Plus, Trash2, Save, Settings2, Pencil } from 'lucide-react';

// Moved out of Production/BatchSchedulingMasterData.tsx (2026-08-24): these 3 tabs are
// setup-once master data (recipe, baseline calendar, holiday exceptions), rarely touched
// after initial config - different character from "Override Per Mesin", which stays in
// the Production module because it's routine day-to-day scheduling adjustment, not setup.
// See BatchSchedulingMasterData.tsx for that tab.

type TabKey = 'recipes' | 'global' | 'exceptions';

interface Machine {
  id: number;
  code: string;
  name: string;
  machine_number: number | null;
}

interface Product {
  id: number;
  code: string;
  name: string;
}

interface Recipe {
  id: number;
  product_id: number;
  product_name: string;
  product_code: string;
  machine_id: number;
  machine_code: string;
  machine_name: string;
  batch_size: number;
  rate_per_hour: number;
  duration_hours: number | null;
  is_default: boolean;
  is_active: boolean;
}

interface GlobalCalendarDay {
  day_of_week: number;
  is_working_day: boolean;
  shift_count: number;
  shift_duration_hours: number | null;
}

interface ExceptionDay {
  id: number;
  exception_date: string;
  is_working_day: boolean;
  shift_count: number | null;
  shift_duration_hours: number | null;
  reason: string | null;
}

const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu', 'Minggu'];

const BatchSchedulingSettings: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('recipes');

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Settings2 className="w-6 h-6" /> Batch Scheduling — Setup Master Data
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Resep produksi (produk+mesin) dan kalender kerja baseline. Setup sekali di awal, jarang diubah.
          Untuk penyesuaian kalender per-mesin sehari-hari (Override Per Mesin), buka
          Production → Batch Scheduling.
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
        {([
          ['recipes', 'Resep Produksi'],
          ['global', 'Kalender Global'],
          ['exceptions', 'Exception (Libur)'],
        ] as [TabKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === key
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'recipes' && <RecipeTab />}
      {tab === 'global' && <GlobalCalendarTab />}
      {tab === 'exceptions' && <ExceptionTab />}
    </div>
  );
};

// ─────────────────────────────────────────────
// TAB: PRODUCTION RECIPES
// ─────────────────────────────────────────────
const RecipeTab: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ product_id: null as number | null, machine_id: null as number | null, batch_size: '', rate_per_hour: '', is_default: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, m, p] = await Promise.all([
        axiosInstance.get('/api/batch-scheduling/recipes'),
        axiosInstance.get('/api/batch-scheduling/machines'),
        axiosInstance.get('/api/products?status=active&per_page=1000'),
      ]);
      setRecipes(r.data.recipes || []);
      setMachines(m.data.machines || []);
      setProducts(p.data.products || p.data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const machineHasNumber = (id: number | null) => {
    if (!id) return true;
    const m = machines.find((mm) => mm.id === id);
    return m ? m.machine_number !== null : true;
  };

  const handleSave = async () => {
    setError(null);
    if (!form.product_id || !form.machine_id || !form.batch_size || !form.rate_per_hour) {
      setError('Semua field wajib diisi.');
      return;
    }
    if (!machineHasNumber(form.machine_id)) {
      setError('Mesin ini belum punya "Machine Number". Isi dulu di tab Override Per Mesin (Production → Batch Scheduling) sebelum bikin resep.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        product_id: form.product_id,
        machine_id: form.machine_id,
        batch_size: parseFloat(form.batch_size),
        rate_per_hour: parseFloat(form.rate_per_hour),
        is_default: form.is_default,
      };
      if (editingId) {
        await axiosInstance.put(`/api/batch-scheduling/recipes/${editingId}`, payload);
      } else {
        await axiosInstance.post('/api/batch-scheduling/recipes', payload);
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ product_id: null, machine_id: null, batch_size: '', rate_per_hour: '', is_default: false });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Gagal menyimpan resep.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (r: Recipe) => {
    setEditingId(r.id);
    setForm({
      product_id: r.product_id,
      machine_id: r.machine_id,
      batch_size: String(r.batch_size),
      rate_per_hour: String(r.rate_per_hour),
      is_default: r.is_default,
    });
    setError(null);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Nonaktifkan resep ini?')) return;
    try {
      await axiosInstance.delete(`/api/batch-scheduling/recipes/${id}`);
      load();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="text-center py-10 text-gray-500">Memuat...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-500">{recipes.length} resep aktif</div>
        <button
          onClick={() => {
            if (showForm) {
              setShowForm(false);
              setEditingId(null);
            } else {
              setForm({ product_id: null, machine_id: null, batch_size: '', rate_per_hour: '', is_default: false });
              setEditingId(null);
              setShowForm(true);
            }
          }}
          className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Resep Baru
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{editingId ? 'Edit Resep' : 'Resep Baru'}</div>
          {error && <div className="mb-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Produk</label>
              {editingId ? (
                <div className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm text-gray-500">
                  {products.find((p) => p.id === form.product_id)?.name || form.product_id}
                </div>
              ) : (
                <SearchableSelect
                  options={products.map((p) => ({ id: p.id, code: p.code, name: p.name }))}
                  value={form.product_id}
                  onChange={(v) => setForm({ ...form, product_id: v as number })}
                  placeholder="Pilih produk"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Mesin</label>
              {editingId ? (
                <div className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm text-gray-500">
                  {machines.find((m) => m.id === form.machine_id)?.name || form.machine_id}
                </div>
              ) : (
                <SearchableSelect
                  options={machines.map((m) => ({ id: m.id, code: m.code, name: m.machine_number === null ? `${m.name} (belum ada machine number!)` : m.name }))}
                  value={form.machine_id}
                  onChange={(v) => setForm({ ...form, machine_id: v as number })}
                  placeholder="Pilih mesin"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Batch Size</label>
              <input
                type="number"
                value={form.batch_size}
                onChange={(e) => setForm({ ...form, batch_size: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Rate / Jam</label>
              <input
                type="number"
                value={form.rate_per_hour}
                onChange={(e) => setForm({ ...form, rate_per_hour: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
              Jadikan default untuk produk ini
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">Batal</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> Simpan
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Produk</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Mesin</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Batch Size</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Rate/Jam</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Durasi</th>
              <th className="px-3 py-2 text-center font-medium text-gray-500">Default</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {recipes.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">{r.product_code} - {r.product_name}</td>
                <td className="px-3 py-2">{r.machine_code} - {r.machine_name}</td>
                <td className="px-3 py-2 text-right">{r.batch_size}</td>
                <td className="px-3 py-2 text-right">{r.rate_per_hour}</td>
                <td className="px-3 py-2 text-right">{r.duration_hours ? `${r.duration_hours} jam` : '-'}</td>
                <td className="px-3 py-2 text-center">{r.is_default ? '✓' : ''}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => handleEdit(r)} className="text-blue-500 hover:text-blue-700" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700" title="Nonaktifkan">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {recipes.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">Belum ada resep</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// TAB: GLOBAL CALENDAR
// ─────────────────────────────────────────────
const GlobalCalendarTab: React.FC = () => {
  const [days, setDays] = useState<GlobalCalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/batch-scheduling/calendar/global');
      setDays(res.data.global_calendar);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (idx: number, patch: Partial<GlobalCalendarDay>) => {
    setDays((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axiosInstance.put('/api/batch-scheduling/calendar/global', { days });
      load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-10 text-gray-500">Memuat...</div>;

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">Pola mingguan baseline pabrik (7 baris tetap). Durasi shift seragam untuk semua shift di hari itu.</p>
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Hari</th>
              <th className="px-3 py-2 text-center font-medium text-gray-500">Hari Kerja</th>
              <th className="px-3 py-2 text-center font-medium text-gray-500">Jumlah Shift</th>
              <th className="px-3 py-2 text-center font-medium text-gray-500">Durasi Shift (jam)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {days.map((d, idx) => (
              <tr key={d.day_of_week}>
                <td className="px-3 py-2 font-medium">{DAY_NAMES[d.day_of_week]}</td>
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" checked={d.is_working_day} onChange={(e) => update(idx, { is_working_day: e.target.checked })} />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="number"
                    min={0}
                    className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-center"
                    value={d.shift_count}
                    onChange={(e) => update(idx, { shift_count: parseInt(e.target.value) || 0 })}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-center"
                    value={d.shift_duration_hours ?? ''}
                    onChange={(e) => update(idx, { shift_duration_hours: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> Simpan Kalender Global
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// TAB: EXCEPTION CALENDAR
// ─────────────────────────────────────────────
const ExceptionTab: React.FC = () => {
  const [rows, setRows] = useState<ExceptionDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ exception_date: '', is_working_day: false, shift_count: '', shift_duration_hours: '', reason: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/batch-scheduling/calendar/exceptions');
      setRows(res.data.exceptions || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setError(null);
    if (!form.exception_date) {
      setError('Tanggal wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      await axiosInstance.post('/api/batch-scheduling/calendar/exceptions', {
        exception_date: form.exception_date,
        is_working_day: form.is_working_day,
        shift_count: form.shift_count ? parseInt(form.shift_count) : null,
        shift_duration_hours: form.shift_duration_hours ? parseFloat(form.shift_duration_hours) : null,
        reason: form.reason || null,
      });
      setShowForm(false);
      setForm({ exception_date: '', is_working_day: false, shift_count: '', shift_duration_hours: '', reason: '' });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus exception ini?')) return;
    await axiosInstance.delete(`/api/batch-scheduling/calendar/exceptions/${id}`);
    load();
  };

  if (loading) return <div className="text-center py-10 text-gray-500">Memuat...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">Override per tanggal, berlaku untuk seluruh pabrik (mis. libur nasional). Kosongkan shift kalau ingin ikut kalender Global.</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Exception Baru
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
          {error && <div className="mb-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Tanggal</label>
              <input type="date" value={form.exception_date} onChange={(e) => setForm({ ...form, exception_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 pb-2">
                <input type="checkbox" checked={form.is_working_day} onChange={(e) => setForm({ ...form, is_working_day: e.target.checked })} />
                Tetap hari kerja
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Jumlah Shift (opsional)</label>
              <input type="number" value={form.shift_count} onChange={(e) => setForm({ ...form, shift_count: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Durasi Shift (opsional)</label>
              <input type="number" step={0.5} value={form.shift_duration_hours} onChange={(e) => setForm({ ...form, shift_duration_hours: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm" />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Alasan</label>
            <input type="text" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Misal: Libur Nasional Kemerdekaan" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm" />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">Batal</button>
            <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <Save className="w-4 h-4" /> Simpan
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Tanggal</th>
              <th className="px-3 py-2 text-center font-medium text-gray-500">Hari Kerja</th>
              <th className="px-3 py-2 text-center font-medium text-gray-500">Shift</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Alasan</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">{r.exception_date}</td>
                <td className="px-3 py-2 text-center">{r.is_working_day ? 'Ya' : 'Libur'}</td>
                <td className="px-3 py-2 text-center">{r.shift_count ?? '(ikut Global)'}</td>
                <td className="px-3 py-2">{r.reason || '-'}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Belum ada exception</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BatchSchedulingSettings;
