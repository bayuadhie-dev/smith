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
  product_name: string | null;
  satuan: string | null;
  jumlah: number | null;
  packs_per_karton: number | null;
  penjualan: number;
  diskon: number;
  diskon_percent: number;
  bpp: number;
  laba_kotor: number;
}

interface ProductReportRow {
  product_id: number;
  product_name: string;
  qty_terjual: number;
  penjualan: number;
  diskon: number;
  bpp: number;
  laba_kotor: number;
}

interface ProductReportData {
  period: { date_from: string; date_to: string };
  rows: ProductReportRow[];
  totals: { penjualan: number; diskon: number; bpp: number; laba_kotor: number };
}

interface SalesReportData {
  period: { date_from: string; date_to: string };
  rows: SalesReportRow[];
  totals: { penjualan: number; diskon: number; bpp: number; laba_kotor: number };
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
  const [view, setView] = useState<'invoice' | 'product'>('invoice');
  const [data, setData] = useState<SalesReportData | null>(null);
  const [productData, setProductData] = useState<ProductReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (view === 'invoice') {
        const res = await axiosInstance.get(
          `/api/finance/reports/sales-report?date_from=${dateFrom}&date_to=${dateTo}`
        );
        setData(res.data);
      } else {
        const res = await axiosInstance.get(
          `/api/finance/reports/sales-report-by-product?date_from=${dateFrom}&date_to=${dateTo}`
        );
        setProductData(res.data);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Gagal memuat laporan penjualan');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, view]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

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
        <div className="flex gap-1 bg-gray-100 rounded p-1">
          <button
            onClick={() => setView('invoice')}
            className={`px-3 py-1.5 rounded text-sm ${view === 'invoice' ? 'bg-white shadow font-medium' : 'text-gray-500'}`}
          >
            Per Invoice
          </button>
          <button
            onClick={() => setView('product')}
            className={`px-3 py-1.5 rounded text-sm ${view === 'product' ? 'bg-white shadow font-medium' : 'text-gray-500'}`}
          >
            Per Produk
          </button>
        </div>
      </div>

      {loading && <LoadingSpinner />}
      {error && <div className="bg-red-50 text-red-700 p-3 rounded">{error}</div>}

      {view === 'product' && productData && !loading && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Produk</th>
                <th className="px-4 py-2 text-right">Qty Terjual</th>
                <th className="px-4 py-2 text-right">Penjualan</th>
                <th className="px-4 py-2 text-right">Diskon</th>
                <th className="px-4 py-2 text-right">BPP</th>
                <th className="px-4 py-2 text-right">Laba Kotor</th>
              </tr>
            </thead>
            <tbody>
              {productData.rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    Tidak ada penjualan produk pada periode ini.
                  </td>
                </tr>
              )}
              {productData.rows.map((row) => (
                <tr key={row.product_id} className="border-t">
                  <td className="px-4 py-2">{row.product_name}</td>
                  <td className="px-4 py-2 text-right">{row.qty_terjual.toLocaleString('id-ID')}</td>
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
                <td className="px-4 py-2" colSpan={2}>TOTAL</td>
                <td className="px-4 py-2 text-right">{formatRupiah(productData.totals.penjualan)}</td>
                <td className="px-4 py-2 text-right text-red-600">
                  {productData.totals.diskon > 0 ? `(${formatRupiah(productData.totals.diskon)})` : formatRupiah(0)}
                </td>
                <td className="px-4 py-2 text-right">{formatRupiah(productData.totals.bpp)}</td>
                <td className="px-4 py-2 text-right">{formatRupiah(productData.totals.laba_kotor)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {view === 'invoice' && data && !loading && (
        <>
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">No Invoice</th>
                  <th className="px-4 py-2 text-left">Tanggal</th>
                  <th className="px-4 py-2 text-left">Customer</th>
                  <th className="px-4 py-2 text-left">Produk</th>
                  <th className="px-4 py-2 text-right">Isi/Karton</th>
                  <th className="px-4 py-2 text-center">Satuan</th>
                  <th className="px-4 py-2 text-right">Jumlah</th>
                  <th className="px-4 py-2 text-right">Penjualan</th>
                  <th className="px-4 py-2 text-right">Diskon</th>
                  <th className="px-4 py-2 text-right">Diskon %</th>
                  <th className="px-4 py-2 text-right">BPP</th>
                  <th className="px-4 py-2 text-right">Laba Kotor</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-4 py-6 text-center text-gray-400">
                      Tidak ada invoice penjualan pada periode ini.
                    </td>
                  </tr>
                )}
                {data.rows.map((row) => (
                  <tr key={row.invoice_id} className="border-t">
                    <td className="px-4 py-2">{row.invoice_number}</td>
                    <td className="px-4 py-2">{row.invoice_date}</td>
                    <td className="px-4 py-2">{row.customer_name || '-'}</td>
                    <td className="px-4 py-2">{row.product_name || '-'}</td>
                    <td className="px-4 py-2 text-right">{row.packs_per_karton ?? '-'}</td>
                    <td className="px-4 py-2 text-center">{row.satuan || '-'}</td>
                    <td className="px-4 py-2 text-right">{row.jumlah?.toLocaleString('id-ID') ?? '-'}</td>
                    <td className="px-4 py-2 text-right">{formatRupiah(row.penjualan)}</td>
                    <td className="px-4 py-2 text-right text-red-600">
                      {row.diskon > 0 ? `(${formatRupiah(row.diskon)})` : formatRupiah(0)}
                    </td>
                    <td className="px-4 py-2 text-right">{row.diskon_percent > 0 ? `${row.diskon_percent}%` : '-'}</td>
                    <td className="px-4 py-2 text-right">{formatRupiah(row.bpp)}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatRupiah(row.laba_kotor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold border-t-2">
                <tr>
                  <td className="px-4 py-2" colSpan={7}>TOTAL</td>
                  <td className="px-4 py-2 text-right">{formatRupiah(data.totals.penjualan)}</td>
                  <td className="px-4 py-2 text-right text-red-600">
                    {data.totals.diskon > 0 ? `(${formatRupiah(data.totals.diskon)})` : formatRupiah(0)}
                  </td>
                  <td className="px-4 py-2 text-right"></td>
                  <td className="px-4 py-2 text-right">{formatRupiah(data.totals.bpp)}</td>
                  <td className="px-4 py-2 text-right">{formatRupiah(data.totals.laba_kotor)}</td>
                </tr>
              </tfoot>
            </table>
            <p className="text-xs text-gray-400 mt-3 px-4 pb-3">
              Catatan: kolom BPP per-invoice hanya terisi untuk invoice yang pengirimannya
              sudah tercatat dengan biaya (unit cost) yang valid. Invoice lama yang HPP-nya
              belum punya basis biaya akan tampil BPP Rp0 — bukan kesalahan laporan ini.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default SalesReport;
