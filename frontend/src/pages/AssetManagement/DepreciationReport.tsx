import React, { useState } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';
import {
  CurrencyDollarIcon,
  ArrowDownTrayIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';

const DepreciationReport: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  const handleCalculateDepreciation = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.post('/api/assets/batch-depreciation');
      toast.success(res.data.message || 'Penyusutan berhasil dihitung');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal menghitung penyusutan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
          <CurrencyDollarIcon className="h-8 w-8 text-green-600" />
          Laporan Penyusutan Aset
        </h1>
        <p className="text-slate-500 dark:text-gray-400 mt-1">
          Depreciation Schedule & Reporting
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Calculate Monthly Depreciation */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <CalendarIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
                Hitung Penyusutan Bulanan
              </h3>
              <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
                Jalankan perhitungan penyusutan untuk semua aset aktif pada bulan berjalan
              </p>
              <button
                onClick={handleCalculateDepreciation}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Menghitung...
                  </>
                ) : (
                  <>
                    <CurrencyDollarIcon className="h-5 w-5" />
                    Hitung Penyusutan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Export Report */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <ArrowDownTrayIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
                Export Laporan
              </h3>
              <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
                Download laporan penyusutan dalam format Excel
              </p>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="month"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <button
                disabled
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors opacity-50 cursor-not-allowed"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                Export Excel (Coming Soon)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <h4 className="text-sm opacity-90 mb-2">Metode Penyusutan</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              Straight Line (Garis Lurus)
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              Declining Balance
            </li>
          </ul>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <h4 className="text-sm opacity-90 mb-2">Otomasi</h4>
          <p className="text-sm">
            Sistem secara otomatis menghitung penyusutan bulanan untuk semua aset aktif berdasarkan jadwal yang telah ditentukan.
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <h4 className="text-sm opacity-90 mb-2">Integrasi Akuntansi</h4>
          <p className="text-sm">
            Hasil perhitungan penyusutan dapat di-posting ke jurnal akuntansi untuk pencatatan keuangan.
          </p>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-3">
          Cara Penggunaan
        </h3>
        <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <li className="flex gap-2">
            <span className="font-semibold">1.</span>
            <span>Pastikan semua aset sudah memiliki informasi harga perolehan, masa manfaat, dan metode penyusutan</span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold">2.</span>
            <span>Klik tombol "Hitung Penyusutan" untuk menjalankan perhitungan bulanan</span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold">3.</span>
            <span>Sistem akan mengupdate akumulasi penyusutan untuk setiap aset</span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold">4.</span>
            <span>Review hasil perhitungan di halaman detail masing-masing aset</span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold">5.</span>
            <span>Export laporan untuk dokumentasi atau posting ke sistem akuntansi</span>
          </li>
        </ol>
      </div>
    </div>
  );
};

export default DepreciationReport;
