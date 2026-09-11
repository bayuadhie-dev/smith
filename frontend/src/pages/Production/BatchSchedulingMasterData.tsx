import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { Save, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { showSuccess, showError } from '../../components/ui/Toast';

const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu', 'Minggu'];

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // 0=Senin
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toISODate(d: Date): string {
  // Bukan d.toISOString() - itu konversi ke UTC dulu, dan karena Jakarta UTC+7,
  // tengah malam waktu lokal jadi jam 17:00 hari sebelumnya di UTC - tanggalnya
  // jadi mundur 1 hari. Format langsung dari komponen tanggal lokal browser.
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const BatchSchedulingMasterData: React.FC = () => {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <CalendarIcon className="w-6 h-6" /> Batch Scheduling — Override Per Mesin
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Penyesuaian kalender kerja per mesin, per minggu berjalan. Untuk resep produksi dan
          kalender baseline/exception (setup awal, jarang diubah), buka{' '}
          <Link to="/app/settings/batch-scheduling" className="text-blue-600 dark:text-blue-400 underline">
            Settings → Batch Scheduling
          </Link>.
        </p>
      </div>
      <OverrideGridTab />
    </div>
  );
};

// ─────────────────────────────────────────────
// TAB: MACHINE CALENDAR OVERRIDE GRID (R4.d)
// ─────────────────────────────────────────────
interface GridCell {
  date: string;
  has_override: boolean;
  is_working_day: boolean;
  shift_count: number;
  shift_duration_hours: number | null;
  reason: string | null;
}
interface GridRow {
  machine_id: number;
  machine_code: string;
  machine_name: string;
  machine_number: number | null;
  cells: GridCell[];
}

const OverrideGridTab: React.FC = () => {
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [dates, setDates] = useState<string[]>([]);
  const [grid, setGrid] = useState<GridRow[]>([]);
  const [original, setOriginal] = useState<Record<string, GridCell>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingNumberFor, setSavingNumberFor] = useState<number | null>(null);

  const cellKey = (machineId: number, date: string) => `${machineId}|${date}`;

  const saveMachineNumber = async (machineId: number, value: string) => {
    const machine_number = value.trim() === '' ? null : parseInt(value, 10);
    if (value.trim() !== '' && Number.isNaN(machine_number as number)) return;
    setSavingNumberFor(machineId);
    try {
      await axiosInstance.patch(`/api/batch-scheduling/machines/${machineId}/machine-number`, { machine_number });
      setGrid((prev) => prev.map((r) => (r.machine_id === machineId ? { ...r, machine_number } : r)));
      showSuccess('Nomor mesin tersimpan');
    } catch (err: any) {
      showError(err?.response?.data?.error || 'Gagal simpan nomor mesin');
    } finally {
      setSavingNumberFor(null);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/batch-scheduling/calendar/machine-override-grid', {
        params: { week_start: toISODate(weekStart) },
      });
      setDates(res.data.dates);
      setGrid(res.data.grid);
      const orig: Record<string, GridCell> = {};
      res.data.grid.forEach((row: GridRow) => {
        row.cells.forEach((c) => {
          orig[cellKey(row.machine_id, c.date)] = { ...c };
        });
      });
      setOriginal(orig);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  const updateCell = (machineId: number, date: string, patch: Partial<GridCell>) => {
    setGrid((prev) =>
      prev.map((row) =>
        row.machine_id !== machineId
          ? row
          : { ...row, cells: row.cells.map((c) => (c.date === date ? { ...c, ...patch, has_override: true } : c)) }
      )
    );
  };

  const isChanged = (machineId: number, cell: GridCell) => {
    const orig = original[cellKey(machineId, cell.date)];
    if (!orig) return true;
    return (
      orig.is_working_day !== cell.is_working_day ||
      orig.shift_count !== cell.shift_count ||
      orig.shift_duration_hours !== cell.shift_duration_hours
    );
  };

  const handleSave = async () => {
    const overrides: any[] = [];
    grid.forEach((row) => {
      row.cells.forEach((cell) => {
        if (isChanged(row.machine_id, cell)) {
          overrides.push({
            machine_id: row.machine_id,
            override_date: cell.date,
            is_working_day: cell.is_working_day,
            shift_count: cell.shift_count,
            shift_duration_hours: cell.shift_duration_hours,
          });
        }
      });
    });
    if (overrides.length === 0) return;
    setSaving(true);
    try {
      await axiosInstance.post('/api/batch-scheduling/calendar/machine-overrides', { overrides });
      load();
    } finally {
      setSaving(false);
    }
  };

  const changedCount = grid.reduce(
    (acc, row) => acc + row.cells.filter((c) => isChanged(row.machine_id, c)).length,
    0
  );

  if (loading) return <div className="text-center py-10 text-gray-500">Memuat...</div>;

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Grid ini otomatis diisi dari hasil Global+Exception sebagai starting point. Ubah sel yang perlu — hanya sel yang berubah yang tersimpan sebagai override.
      </p>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })} className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarIcon className="w-4 h-4" /> {dates[0]} — {dates[6]}
          </div>
          <button onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })} className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || changedCount === 0}
          className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> Simpan {changedCount > 0 ? `(${changedCount} sel)` : ''}
        </button>
      </div>

      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="text-xs border-collapse" style={{ tableLayout: 'fixed', width: `${160 + dates.length * 130}px` }}>
          <colgroup>
            <col style={{ width: '160px' }} />
            {dates.map((d) => (
              <col key={d} style={{ width: '130px' }} />
            ))}
          </colgroup>
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500 sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                Mesin
              </th>
              {dates.map((d, i) => (
                <th key={d} className="px-2 py-2 text-center font-medium text-gray-500 border-b border-l border-gray-200 dark:border-gray-700">
                  <div>{DAY_NAMES[i]}</div>
                  <div className="font-normal text-gray-400">{d.slice(5)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {grid.map((row) => (
              <tr key={row.machine_id}>
                <td className="px-3 py-2 sticky left-0 z-10 bg-white dark:bg-gray-900 align-top">
                  <div className="font-medium text-gray-800 dark:text-gray-100 truncate" title={row.machine_name}>{row.machine_code}</div>
                  <div className="text-gray-400 truncate" title={row.machine_name}>{row.machine_name}</div>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="mt-1 w-full px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-[11px]"
                    defaultValue={row.machine_number ?? ''}
                    placeholder="No. mesin"
                    title="Nomor mesin (untuk penjadwalan Batch Scheduling)"
                    disabled={savingNumberFor === row.machine_id}
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (parseInt(v, 10) === row.machine_number || (v.trim() === '' && row.machine_number == null)) return;
                      saveMachineNumber(row.machine_id, v);
                    }}
                  />
                </td>
                {row.cells.map((cell) => {
                  const changed = isChanged(row.machine_id, cell);
                  return (
                    <td key={cell.date} className={`px-2 py-2 text-center align-top border-l border-gray-100 dark:border-gray-800 ${changed ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}>
                      <div className="flex flex-col items-center gap-1.5">
                        <label className="flex items-center gap-1 text-[11px] text-gray-500">
                          <input
                            type="checkbox"
                            checked={cell.is_working_day}
                            onChange={(e) => updateCell(row.machine_id, cell.date, { is_working_day: e.target.checked })}
                            title="Hari kerja"
                          />
                          Kerja
                        </label>
                        <input
                          type="number"
                          min={0}
                          className="w-16 px-1 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-center"
                          value={cell.shift_count}
                          onChange={(e) => updateCell(row.machine_id, cell.date, { shift_count: parseInt(e.target.value) || 0 })}
                          title="Jumlah shift"
                          placeholder="Shift"
                        />
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          className="w-16 px-1 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-center"
                          value={cell.shift_duration_hours ?? ''}
                          onChange={(e) => updateCell(row.machine_id, cell.date, { shift_duration_hours: e.target.value ? parseFloat(e.target.value) : null })}
                          title="Durasi shift (jam)"
                          placeholder="Jam"
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {grid.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">Tidak ada mesin aktif</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BatchSchedulingMasterData;
