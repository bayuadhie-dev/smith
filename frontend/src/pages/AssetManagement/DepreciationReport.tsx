import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import { ArrowPathIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { KpiStrip, PageHeader, Panel, StatusPill } from '../../components/ui/PageKit';
import { confirmDialog } from '../../components/ui';

interface BarisPenyusutan {
  id: number;
  asset_code: string;
  asset_name: string;
  asset_type: string;
  category: string | null;
  purchase_date: string | null;
  purchase_cost: number;
  depreciation_method: string | null;
  useful_life_years: number | null;
  monthly_depreciation: number;
  accumulated_depreciation: number;
  net_book_value: number;
  fully_depreciated: boolean;
  posted_this_period: boolean;
  amount_this_period: number;
  months_behind: number;
}

interface Laporan {
  period: string;
  assets: BarisPenyusutan[];
  totals: {
    count: number;
    purchase_cost: number;
    accumulated_depreciation: number;
    net_book_value: number;
    monthly_depreciation: number;
    posted_this_period: number;
    never_depreciated: number;
  };
}

const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);

const namaMetode: Record<string, string> = {
  straight_line: 'Garis lurus',
  declining_balance: 'Saldo menurun',
};

const DepreciationReport: React.FC = () => {
  const [laporan, setLaporan] = useState<Laporan | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [menghitung, setMenghitung] = useState(false);
  const [periode, setPeriode] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  const muat = useCallback(async () => {
    try {
      setMemuat(true);
      const res = await axiosInstance.get('/api/assets/reports/depreciation', { params: { period: periode } });
      setLaporan(res.data);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Laporan gagal dimuat');
    } finally {
      setMemuat(false);
    }
  }, [periode]);

  useEffect(() => {
    muat();
  }, [muat]);

  const hitungPenyusutan = async () => {
    const t = laporan?.totals;
    const pesan = t
      ? `Hitung penyusutan bulan berjalan untuk ${t.count} aset? Beban yang dibukukan sekitar ${rupiah(t.monthly_depreciation)} dan langsung masuk jurnal.`
      : 'Hitung penyusutan bulan berjalan dan bukukan jurnalnya?';
    if (!(await confirmDialog(pesan))) return;
    try {
      setMenghitung(true);
      const res = await axiosInstance.post('/api/assets/batch-depreciation');
      toast.success(res.data.message || 'Penyusutan selesai dihitung');
      muat();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Penyusutan gagal dihitung');
    } finally {
      setMenghitung(false);
    }
  };

  const t = laporan?.totals;
  const tertinggal = (laporan?.assets || []).filter((a) => a.months_behind > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-10">
      <PageHeader
        eyebrow="ASET · PENYUSUTAN"
        title="Laporan Penyusutan"
        subtitle="Beban penyusutan tiap aset, akumulasinya, dan nilai buku yang tersisa."
        actions={
          <>
            <label className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800">
              <CalendarIcon className="h-4 w-4 text-gray-400" />
              <input
                type="month"
                value={periode}
                onChange={(e) => setPeriode(e.target.value)}
                className="bg-transparent text-sm text-gray-700 outline-none dark:text-gray-200"
              />
            </label>
            <button
              onClick={hitungPenyusutan}
              disabled={menghitung}
              className="fn-press inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              <ArrowPathIcon className={`h-4 w-4 ${menghitung ? 'animate-spin' : ''}`} />
              {menghitung ? 'Menghitung...' : 'Hitung bulan ini'}
            </button>
          </>
        }
      />

      <KpiStrip
        items={[
          { label: 'Aset dilaporkan', value: (t?.count || 0).toLocaleString('id-ID'), hint: 'Selain aset yang sudah dilepas' },
          { label: 'Nilai perolehan', value: rupiah(t?.purchase_cost || 0), hint: 'Total harga beli' },
          {
            label: 'Akumulasi penyusutan',
            value: rupiah(t?.accumulated_depreciation || 0),
            tone: (t?.accumulated_depreciation || 0) > 0 ? undefined : 'warn',
            hint: (t?.accumulated_depreciation || 0) > 0 ? 'Sudah dibebankan' : 'Belum ada yang dibebankan',
          },
          { label: 'Beban per bulan', value: rupiah(t?.monthly_depreciation || 0), hint: 'Kalau dihitung penuh' },
        ]}
      />

      {/* Akumulasi nol pada aset yang sudah lama dipakai berarti penyusutan
          bulanannya memang belum pernah dijalankan - nilai bukunya jadi
          kelihatan lebih besar daripada seharusnya. */}
      {!memuat && tertinggal.length > 0 && (
        <p className="fn-card border-l-2 border-amber-400 px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
          <b className="font-semibold">{tertinggal.length} aset belum disusutkan sepenuhnya.</b>{' '}
          Tombol &quot;Hitung bulan ini&quot; hanya membebankan satu bulan, jadi bulan-bulan yang lewat tetap
          tertinggal. Yang paling jauh tertinggal {Math.max(...tertinggal.map((a) => a.months_behind))} bulan.
        </p>
      )}

      <Panel
        title={`Rincian per aset${laporan ? ` · ${new Date(laporan.period).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}` : ''}`}
        loading={memuat}
        action={t ? <span className="fn-label">{t.posted_this_period} aset sudah dibukukan bulan ini</span> : undefined}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200/70 dark:border-gray-700/70">
                <th className="fn-label px-4 py-2.5 text-left">Aset</th>
                <th className="fn-label px-4 py-2.5 text-left">Metode</th>
                <th className="fn-label px-4 py-2.5 text-right">Masa manfaat</th>
                <th className="fn-label px-4 py-2.5 text-right">Perolehan</th>
                <th className="fn-label px-4 py-2.5 text-right">Beban/bulan</th>
                <th className="fn-label px-4 py-2.5 text-right">Akumulasi</th>
                <th className="fn-label px-4 py-2.5 text-right">Nilai buku</th>
                <th className="fn-label px-4 py-2.5 text-left">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200/70 dark:divide-gray-700/70">
              {(laporan?.assets || []).map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="px-4 py-3">
                    <Link to={`/app/assets/${a.id}`} className="font-medium text-gray-900 hover:underline dark:text-white">
                      {a.asset_name}
                    </Link>
                    <div className="fn-label mt-0.5">{a.asset_code}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {a.depreciation_method ? namaMetode[a.depreciation_method] || a.depreciation_method : '-'}
                  </td>
                  <td className="fn-num px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                    {a.useful_life_years ? `${a.useful_life_years} tahun` : '-'}
                  </td>
                  <td className="fn-num px-4 py-3 text-right text-gray-900 dark:text-white">{rupiah(a.purchase_cost)}</td>
                  <td className="fn-num px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                    {a.monthly_depreciation > 0 ? rupiah(a.monthly_depreciation) : '-'}
                  </td>
                  <td className="fn-num px-4 py-3 text-right text-gray-600 dark:text-gray-300">{rupiah(a.accumulated_depreciation)}</td>
                  <td className="fn-num px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{rupiah(a.net_book_value)}</td>
                  <td className="px-4 py-3">
                    {a.monthly_depreciation <= 0 ? (
                      <StatusPill tone="muted">Data penyusutan belum lengkap</StatusPill>
                    ) : a.fully_depreciated ? (
                      <StatusPill tone="ok">Sudah habis disusutkan</StatusPill>
                    ) : a.posted_this_period ? (
                      <StatusPill tone="ok">Bulan ini dibukukan</StatusPill>
                    ) : a.months_behind > 0 ? (
                      <StatusPill tone="warn">Tertinggal {a.months_behind} bulan</StatusPill>
                    ) : (
                      <StatusPill tone="muted">Belum dibukukan bulan ini</StatusPill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!memuat && (laporan?.assets || []).length === 0 && (
            <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada aset untuk dilaporkan.</p>
          )}
        </div>
      </Panel>
    </div>
  );
};

export default DepreciationReport;
