import React, { useState } from 'react';
import { CalendarDays, CalendarRange, RefreshCw } from 'lucide-react';
import { currentPeriod, periodLabelFull } from './forecastPeriod';

interface Props {
  initialWindow?: string; // "YYYY-MM"
  initialCount?: number;
  // window=null berarti "rolling" (jangan kunci ke bulan tertentu - biarkan backend
  // selalu pakai bulan kalender berjalan tiap kali dibuka, itulah yang bikin rolling
  // bertahan lintas sesi, bukan cuma sekali pas dipilih).
  onConfirm: (window: string | null, count: number) => void;
  onClose: () => void;
}

// Dialog periode - munculnya SEBELUM masuk grid (manajemen: "klik forecast langsung
// muncul pilihan periodenya"), dan juga dipakai ulang di dalam grid via tombol "Ubah
// Periode". Rombak putaran 6 (2026-08-25): forecast tidak lagi punya window 12-bulan
// tetap per header - jadi di sini user pilih bulan KALENDER bebas (bukan slot 1-12
// relatif ke header lagi), plus preset "Rolling" buat kasus paling umum (bulan berjalan
// + 11 ke depan, otomatis maju terus tiap bulan ganti - lihat SalesForecastGrid.tsx).
export default function PeriodSelectModal({ initialWindow, initialCount, onConfirm, onClose }: Props) {
  const [mode, setMode] = useState<'rolling' | 'single' | 'range'>(
    initialCount === 1 ? 'single' : initialCount && initialCount !== 12 ? 'range' : 'rolling'
  );
  const [singleMonth, setSingleMonth] = useState(initialWindow || currentPeriod());
  const [rangeStart, setRangeStart] = useState(initialWindow || currentPeriod());
  const [rangeEnd, setRangeEnd] = useState(
    initialWindow && initialCount ? initialWindow : currentPeriod()
  );

  const confirm = () => {
    if (mode === 'rolling') {
      onConfirm(null, 12);
    } else if (mode === 'single') {
      onConfirm(singleMonth, 1);
    } else {
      const [sy, sm] = rangeStart.split('-').map(Number);
      const [ey, em] = rangeEnd.split('-').map(Number);
      const count = Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
      const startsBefore = sy < ey || (sy === ey && sm <= em);
      onConfirm(startsBefore ? rangeStart : rangeEnd, Math.min(count, 36));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Pilih Periode</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Tampilkan grid rolling 12 bulan, 1 bulan saja, atau rentang custom.</p>

        <div className="flex gap-1.5 mb-4">
          <button
            onClick={() => setMode('rolling')}
            className={`flex-1 inline-flex flex-col items-center justify-center gap-1 px-2 py-2 text-xs rounded-lg border ${mode === 'rolling' ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}
          >
            <RefreshCw className="w-4 h-4" /> Rolling 12 Bulan
          </button>
          <button
            onClick={() => setMode('single')}
            className={`flex-1 inline-flex flex-col items-center justify-center gap-1 px-2 py-2 text-xs rounded-lg border ${mode === 'single' ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}
          >
            <CalendarDays className="w-4 h-4" /> 1 Bulan
          </button>
          <button
            onClick={() => setMode('range')}
            className={`flex-1 inline-flex flex-col items-center justify-center gap-1 px-2 py-2 text-xs rounded-lg border ${mode === 'range' ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}
          >
            <CalendarRange className="w-4 h-4" /> Rentang
          </button>
        </div>

        {mode === 'rolling' && (
          <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
            Menampilkan <span className="font-medium text-gray-700 dark:text-gray-200">{periodLabelFull(currentPeriod())}</span> + 11 bulan ke depan.
            Otomatis maju sendiri tiap bulan berganti - bulan lama tetap bisa dilihat lagi lewat "Ubah Periode" di grid.
          </p>
        )}

        {mode === 'single' && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Bulan</label>
            <input
              type="month"
              value={singleMonth}
              onChange={(e) => setSingleMonth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
            />
          </div>
        )}

        {mode === 'range' && (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Dari</label>
              <input
                type="month"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="w-full px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
              />
            </div>
            <span className="text-gray-400 mt-5">&rarr;</span>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Sampai</label>
              <input
                type="month"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="w-full px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button className="btn-outline" onClick={onClose}>Batal</button>
          <button className="btn-primary" onClick={confirm}>Tampilkan Grid</button>
        </div>
      </div>
    </div>
  );
}
