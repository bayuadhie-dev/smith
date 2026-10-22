import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import { formatRupiah } from '../../utils/currencyUtils';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import { ChartBarIcon } from '@heroicons/react/24/outline';

interface SalesReportRow {
  invoice_id: number;
  invoice_number: string;
  invoice_date: string;
  customer_name: string | null;
  penjualan: number;
  diskon: number;
  bpp: number;
  laba_kotor: number;
}

interface SalesReportData {
  period: { date_from: string; date_to: string };
  rows: SalesReportRow[];
  totals: { penjualan: number; diskon: number; bpp: number; laba_kotor: number };
  rekonsiliasi_laba_rugi: {
    akun_penjualan: { code: string; name: string; balance: number };
    akun_diskon: { code: string; name: string; balance: number };
    akun_bpp: { code: string; name: string; balance: number };
  };
}

function firstDayOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const SalesReport: React.FC = () => {
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [data, setData] = useState<SalesReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get(
        `/api/finance/reports/sales-report?date_from=${dateFrom}&date_to=${dateTo}`
      );
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Gagal memuat laporan penjualan');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const matches = (reportValue: number, glValue: number) => Math.abs(reportValue - glValue) < 1;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <ChartBarIcon className="w-6 h-6 text-green-700" />
        <h1 className="text-2xl font-bold">Laporan Penjualan</h1>
      </div>
      <p className="text-gray-500 text-sm">
        Nilai Penjualan, Diskon, dan BPP (HPP) per invoice — setiap kolom langsung terhubung
        ke akun yang sama di Laporan Laba Rugi untuk periode yang dipilih.
      </p>

      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Dari Tanggal</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Sampai Tanggal</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
        <button
          onClick={fetchReport}
          className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800"
        >
          Tampilkan
        </button>
      </div>

      {loading && <LoadingSpinner />}
      {error && <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>}

      {data && !loading && (
        <>
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">No Invoice</th>
                  <th className="px-4 py-2 text-left">Tanggal</th>
                  <th className="px-4 py-2 text-left">Customer</th>
                  <th className="px-4 py-2 text-right">Penjualan</th>
                  <th className="px-4 py-2 text-right">Diskon</th>
                  <th className="px-4 py-2 text-right">BPP</th>
                  <th className="px-4 py-2 text-right">Laba Kotor</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                      Tidak ada invoice penjualan pada periode ini.
                    </td>
                  </tr>
                )}
                {data.rows.map((row) => (
                  <tr key={row.invoice_id} className="border-t">
                    <td className="px-4 py-2">{row.invoice_number}</td>
                    <td className="px-4 py-2">{row.invoice_date}</td>
                    <td className="px-4 py-2">{row.customer_name || '-'}</td>
                    <td className="px-4 py-2 text-right">{formatRupiah(row.penjualan)}</td>
                    <td className="px-4 py-2 text-right text-red-600">
                      {row.diskon > 0 ? `(${formatRupiah(row.diskon)})` : formatRupiah(0)}
                    </td>
                    <td className="px-4 py-2 text-right">{formatRupiah(row.bpp)}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatRupiah(row.laba_kotor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold border-t-2">
                <tr>
                  <td className="px-4 py-2" colSpan={3}>TOTAL</td>
                  <td className="px-4 py-2 text-right">{formatRupiah(data.totals.penjualan)}</td>
                  <td className="px-4 py-2 text-right text-red-600">
                    {data.totals.diskon > 0 ? `(${formatRupiah(data.totals.diskon)})` : formatRupiah(0)}
                  </td>
                  <td className="px-4 py-2 text-right">{formatRupiah(data.totals.bpp)}</td>
                  <td className="px-4 py-2 text-right">{formatRupiah(data.totals.laba_kotor)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3">Rekonsiliasi ke Laba Rugi</h3>
            <p className="text-sm text-gray-500 mb-3">
              Angka berikut diambil langsung dari saldo akun GL periode yang sama — kalau
              baris di atas menunjukkan tanda centang hijau, totalnya sudah pasti sama dengan
              yang muncul di Laporan Laba Rugi untuk periode ini.
            </p>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Kolom Laporan Penjualan</th>
                  <th className="px-4 py-2 text-left">Akun Laba Rugi</th>
                  <th className="px-4 py-2 text-right">Saldo Akun (GL)</th>
                  <th className="px-4 py-2 text-right">Total Laporan</th>
                  <th className="px-4 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="px-4 py-2">Penjualan</td>
                  <td className="px-4 py-2">
                    {data.rekonsiliasi_laba_rugi.akun_penjualan.code} - {data.rekonsiliasi_laba_rugi.akun_penjualan.name}
                  </td>
                  <td className="px-4 py-2 text-right">{formatRupiah(data.rekonsiliasi_laba_rugi.akun_penjualan.balance)}</td>
                  <td className="px-4 py-2 text-right">{formatRupiah(data.totals.penjualan)}</td>
                  <td className="px-4 py-2 text-center">
                    {matches(data.totals.penjualan, data.rekonsiliasi_laba_rugi.akun_penjualan.balance) ? '✅' : '⚠️'}
                  </td>
                </tr>
                <tr className="border-t">
                  <td className="px-4 py-2">Diskon</td>
                  <td className="px-4 py-2">
                    {data.rekonsiliasi_laba_rugi.akun_diskon.code} - {data.rekonsiliasi_laba_rugi.akun_diskon.name}
                  </td>
                  <td className="px-4 py-2 text-right">{formatRupiah(data.rekonsiliasi_laba_rugi.akun_diskon.balance)}</td>
                  <td className="px-4 py-2 text-right">{formatRupiah(data.totals.diskon)}</td>
                  <td className="px-4 py-2 text-center">
                    {matches(data.totals.diskon, data.rekonsiliasi_laba_rugi.akun_diskon.balance) ? '✅' : '⚠️'}
                  </td>
                </tr>
                <tr className="border-t">
                  <td className="px-4 py-2">BPP</td>
                  <td className="px-4 py-2">
                    {data.rekonsiliasi_laba_rugi.akun_bpp.code} - {data.rekonsiliasi_laba_rugi.akun_bpp.name}
                  </td>
                  <td className="px-4 py-2 text-right">{formatRupiah(data.rekonsiliasi_laba_rugi.akun_bpp.balance)}</td>
                  <td className="px-4 py-2 text-right">{formatRupiah(data.totals.bpp)}</td>
                  <td className="px-4 py-2 text-center">
                    {matches(data.totals.bpp, data.rekonsiliasi_laba_rugi.akun_bpp.balance) ? '✅' : '⚠️'}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-3">
              Catatan: kolom BPP per-invoice hanya terisi untuk invoice yang pengirimannya
              sudah tercatat dengan biaya (unit cost) yang valid. Kalau total BPP per-invoice
              di tabel atas lebih kecil dari saldo akun GL, selisihnya ada di invoice-invoice
              lama yang HPP-nya belum punya basis biaya — bukan kesalahan laporan ini.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default SalesReport;
