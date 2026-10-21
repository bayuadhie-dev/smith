import { Fragment, useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { ArrowPathIcon, PrinterIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:        { label: 'Draft',        color: 'bg-gray-100 text-gray-700' },
  approved:     { label: 'Disetujui',    color: 'bg-blue-100 text-blue-700' },
  in_progress:  { label: 'Berjalan',     color: 'bg-amber-100 text-amber-700' },
  completed:    { label: 'Selesai',      color: 'bg-emerald-100 text-emerald-700' },
  cancelled:    { label: 'Dibatalkan',   color: 'bg-red-100 text-red-700' },
  unplaceable:  { label: 'Belum Terjadwal', color: 'bg-gray-100 text-gray-700' },
};

function mondayOf(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // back up to Monday
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtDateLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function BatchRecordWeeklyReport() {
  const [weekStart, setWeekStart] = useState(() => toISODate(mondayOf(new Date())));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, any>>({});
  const [detailLoading, setDetailLoading] = useState<number | null>(null);

  const toggleExpand = (batchId: number) => {
    if (expandedId === batchId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(batchId);
    if (!detailCache[batchId]) {
      setDetailLoading(batchId);
      axiosInstance.get(`/api/production/batches/${batchId}/record`)
        .then(r => setDetailCache(prev => ({ ...prev, [batchId]: r.data })))
        .catch(() => setDetailCache(prev => ({ ...prev, [batchId]: null })))
        .finally(() => setDetailLoading(null));
    }
  };

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart + 'T00:00:00');
    end.setDate(end.getDate() + 6);
    return toISODate(end);
  }, [weekStart]);

  useEffect(() => {
    setLoading(true);
    axiosInstance.get('/api/production/batches/weekly-report', {
      params: { start_date: weekStart, end_date: weekEnd },
    })
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [weekStart, weekEnd]);

  const shiftWeek = (deltaWeeks: number) => {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + deltaWeeks * 7);
    setWeekStart(toISODate(d));
  };

  const summary = data?.summary;

  return (
    <div className="space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen p-6 print:bg-white print:p-0">
      {/* Header - hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Laporan Mingguan Batch Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ringkasan Catatan Pengolahan Bets (GMP) per minggu</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/app/production/batch-records"
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Daftar Batch
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-[#059669] to-[#047857] text-white rounded-lg hover:shadow-lg transition-shadow text-sm font-medium"
          >
            <PrinterIcon className="h-4 w-4" /> Cetak / PDF
          </button>
        </div>
      </div>

      {/* Week picker - hidden on print */}
      <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-2xl shadow-md p-3 print:hidden">
        <button
          onClick={() => shiftWeek(-1)}
          className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
          title="Minggu sebelumnya"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <input
          type="date"
          value={weekStart}
          onChange={e => setWeekStart(toISODate(mondayOf(new Date(e.target.value + 'T00:00:00'))))}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 dark:text-white text-sm"
        />
        <button
          onClick={() => shiftWeek(1)}
          className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
          title="Minggu berikutnya"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
          {fmtDateLabel(weekStart)} &ndash; {fmtDateLabel(weekEnd)}
        </span>
        <button
          onClick={() => setWeekStart(toISODate(mondayOf(new Date())))}
          className="ml-auto px-3 py-1.5 text-xs font-medium text-[#059669] hover:underline"
        >
          Minggu Ini
        </button>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block text-center border-b-2 border-gray-900 pb-3 mb-4">
        <h2 className="text-lg font-bold uppercase tracking-wide">Laporan Mingguan Batch Report</h2>
        <p className="text-xs text-gray-500">{fmtDateLabel(weekStart)} &ndash; {fmtDateLabel(weekEnd)}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <ArrowPathIcon className="h-6 w-6 animate-spin mr-2" /> Memuat laporan...
        </div>
      ) : !summary ? (
        <div className="text-center py-16 text-gray-500">Gagal memuat laporan minggu ini.</div>
      ) : (
        <>
          {/* Summary bento cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
            <div className="xl:col-span-2 print:col-span-1 bg-gradient-to-br from-[#059669] to-[#047857] rounded-2xl shadow-md p-5 text-white print:shadow-none print:border print:border-gray-300 print:text-gray-900 print:bg-none">
              <p className="text-sm text-white/80 print:text-gray-500">Total Batch Minggu Ini</p>
              <p className="text-3xl font-black mt-1">{summary.total_batches}</p>
              <p className="text-xs text-white/70 print:text-gray-500 mt-1">{summary.batches_closed} ditutup &bull; {summary.batches_open} belum ditutup</p>
            </div>
            <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl shadow-md p-5 text-white print:shadow-none print:border print:border-gray-300 print:text-gray-900 print:bg-none">
              <p className="text-sm text-white/80 print:text-gray-500">Realisasi vs Rencana</p>
              <p className="text-2xl font-black mt-1">{summary.total_realized_qty.toLocaleString('id-ID')}</p>
              <p className="text-xs text-white/70 print:text-gray-500 mt-1">dari {summary.total_planned_qty.toLocaleString('id-ID')} rencana</p>
            </div>
            <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl shadow-md p-5 text-white print:shadow-none print:border print:border-gray-300 print:text-gray-900 print:bg-none">
              <p className="text-sm text-white/80 print:text-gray-500">Yield Minggu Ini</p>
              <p className="text-2xl font-black mt-1">{summary.yield_percent != null ? `${summary.yield_percent}%` : '-'}</p>
            </div>
            <div className="bg-gradient-to-br from-[#F15D2C] to-[#C73E1D] rounded-2xl shadow-md p-5 text-white print:shadow-none print:border print:border-gray-300 print:text-gray-900 print:bg-none">
              <p className="text-sm text-white/80 print:text-gray-500">Total Reject</p>
              <p className="text-2xl font-black mt-1">{summary.total_reject.toLocaleString('id-ID')}</p>
            </div>
          </div>

          {/* Batch table */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden print:shadow-none print:border print:border-gray-300">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 print:bg-gray-100">
                    <th className="px-2 py-3 print:hidden"></th>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">No. Batch</th>
                    <th className="px-4 py-3">No. SPK</th>
                    <th className="px-4 py-3">Produk</th>
                    <th className="px-4 py-3 text-right">Target</th>
                    <th className="px-4 py-3 text-right">Aktual</th>
                    <th className="px-4 py-3 text-right">Reject</th>
                    <th className="px-4 py-3 text-right">Yield</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {data.batches.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-8 text-gray-500">Tidak ada batch pada periode ini.</td></tr>
                  ) : data.batches.map((b: any) => {
                    const cfg = STATUS_CONFIG[b.status] || { label: b.status, color: 'bg-gray-100 text-gray-700' };
                    const isExpanded = expandedId === b.id;
                    return (
                      <Fragment key={b.id}>
                        <tr
                          onClick={() => toggleExpand(b.id)}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer"
                        >
                          <td className="px-2 py-3 text-center print:hidden">
                            {isExpanded ? <ChevronUpIcon className="h-4 w-4 text-gray-400 mx-auto" /> : <ChevronDownIcon className="h-4 w-4 text-gray-400 mx-auto" />}
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{b.scheduled_date || '-'}</td>
                          <td className="px-4 py-3 font-medium">
                            <Link
                              to={`/app/production/batches/${b.id}/record`}
                              onClick={e => e.stopPropagation()}
                              className="text-[#059669] hover:underline"
                            >
                              {b.batch_number}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{b.wo_number || '-'}</td>
                          <td className="px-4 py-3">{b.product_name || '-'}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{b.planned_qty.toLocaleString('id-ID')}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{b.realized_qty.toLocaleString('id-ID')}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-red-600">{b.reject_quantity.toLocaleString('id-ID')}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{b.yield_percent != null ? `${b.yield_percent}%` : '-'}</td>
                          <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>{cfg.label}</span></td>
                        </tr>
                        {isExpanded && (
                          <tr className="print:hidden">
                            <td colSpan={11} className="px-4 py-4 bg-gray-50 dark:bg-gray-900/40">
                              <BatchExpandDetail
                                loading={detailLoading === b.id}
                                detail={detailCache[b.id]}
                                batchId={b.id}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BatchExpandDetail({ loading, detail, batchId }: { loading: boolean; detail: any; batchId: number }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 text-gray-400">
        <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" /> Memuat detail batch...
      </div>
    );
  }
  if (!detail) {
    return <p className="text-sm text-gray-500 py-2">Gagal memuat detail batch ini.</p>;
  }
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Bahan Baku Terpakai</h4>
        {detail.materials.length === 0 ? (
          <p className="text-xs text-gray-400">Belum ada data bahan aktual.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="pb-1 pr-3">Nama Bahan</th>
                <th className="pb-1 pr-3 text-right">Rencana</th>
                <th className="pb-1 pr-3 text-right">Aktual</th>
                <th className="pb-1 pr-3 text-right">Varians</th>
                <th className="pb-1">Satuan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {detail.materials.map((m: any) => (
                <tr key={m.id}>
                  <td className="py-1 pr-3 text-gray-700 dark:text-gray-200">{m.item_name}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{m.quantity_planned.toLocaleString('id-ID')}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{m.quantity_actual != null ? m.quantity_actual.toLocaleString('id-ID') : '-'}</td>
                  <td className={`py-1 pr-3 text-right tabular-nums ${m.variance != null && m.variance !== 0 ? 'text-amber-600' : ''}`}>{m.variance != null ? m.variance.toLocaleString('id-ID') : '-'}</td>
                  <td className="py-1 text-gray-400">{m.uom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Parameter Proses &amp; Hasil per Shift</h4>
        {detail.shifts.length === 0 ? (
          <p className="text-xs text-gray-400">Belum ada input shift.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="pb-1 pr-3">Tanggal</th>
                <th className="pb-1 pr-3">Shift</th>
                <th className="pb-1 pr-3">Operator</th>
                <th className="pb-1 pr-3 text-right">Target</th>
                <th className="pb-1 pr-3 text-right">Aktual</th>
                <th className="pb-1 text-right">Reject</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {detail.shifts.map((s: any) => (
                <tr key={s.id}>
                  <td className="py-1 pr-3">{s.production_date}</td>
                  <td className="py-1 pr-3">{s.shift}{s.sub_shift ? `-${s.sub_shift}` : ''}</td>
                  <td className="py-1 pr-3">{s.operator_name || '-'}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{s.target_quantity.toLocaleString('id-ID')}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{s.actual_quantity.toLocaleString('id-ID')}</td>
                  <td className="py-1 text-right tabular-nums text-red-600">{s.reject_quantity.toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Link
        to={`/app/production/batches/${batchId}/record`}
        className="inline-block text-xs font-medium text-[#059669] hover:underline"
      >
        Lihat dokumen Catatan Pengolahan Bets lengkap &rarr;
      </Link>
    </div>
  );
}
