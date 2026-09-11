import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { showSuccess, showError } from '../../components/ui/Toast';
import { PencilSquareIcon, DocumentTextIcon, ArrowLeftIcon, ChartBarIcon } from '@heroicons/react/24/outline';

interface Quotation {
  id: number;
  quote_number: string;
  customer_name: string | null;
  quote_date: string;
  total_amount: number;
  status: string;
}

// §7.1 (masukan manajemen, 2026-08-25): klik "Buat Sales Order" langsung menampilkan
// pilihan sumber - Manual (form biasa) atau Dari Quotation (reuse endpoint convert
// quotation yang sudah ada). "Dari Forecast" SENGAJA TIDAK ADA di sini (rombak putaran
// 7) - forecast itu agregat semua customer, hasil convert-nya sekarang dikirim ke
// Monthly Planning (bukan SPK langsung lagi, apalagi Sales Order) lewat halaman
// Forecast Grid sendiri - lihat SalesForecastGrid.tsx. SO/customer riil cuma dari
// Manual atau Quotation.
export default function SalesOrderSourcePicker() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'pick' | 'quotation'>('pick');

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {mode === 'pick' && (
        <>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Buat Sales Order</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Pilih sumber data untuk order baru.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SourceCard
              icon={<PencilSquareIcon className="w-6 h-6" />}
              title="Manual"
              desc="Isi order dari kosong, seperti biasa."
              color="blue"
              onClick={() => navigate('/app/sales/orders/new/manual')}
            />
            <SourceCard
              icon={<DocumentTextIcon className="w-6 h-6" />}
              title="Dari Quotation"
              desc="Convert quotation yang sudah disetujui customer jadi Sales Order."
              color="emerald"
              onClick={() => setMode('quotation')}
            />
          </div>
          <div className="mt-4 flex items-start gap-2 text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <ChartBarIcon className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Mau siapkan stok dari Sales Forecast? Forecast itu rencana agregat semua customer, jadi hasil convert-nya masuk ke
              {' '}<span className="font-medium text-gray-500 dark:text-gray-300">Monthly Planning</span> (bukan Sales Order) -
              buka <Link to="/app/sales/forecasts" className="text-blue-600 dark:text-blue-400 hover:underline">halaman Forecast</Link> untuk itu.
            </span>
          </div>
        </>
      )}
      {mode === 'quotation' && <FromQuotationFlow onBack={() => setMode('pick')} />}
    </div>
  );
}

function SourceCard({ icon, title, desc, color, onClick }: { icon: React.ReactNode; title: string; desc: string; color: string; onClick: () => void }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600',
  };
  return (
    <button
      onClick={onClick}
      className="text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-lg hover:-translate-y-0.5 transition-all"
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${colorMap[color]}`}>{icon}</div>
      <div className="font-semibold text-gray-900 dark:text-white mb-1">{title}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{desc}</div>
    </button>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4">
      <ArrowLeftIcon className="w-4 h-4" /> Ganti sumber
    </button>
  );
}

function FromQuotationFlow({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState<number | null>(null);

  useEffect(() => {
    axiosInstance.get('/api/sales/quotations?status=accepted&per_page=100').then((res) => setQuotations(res.data.quotations || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleConvert = async (q: Quotation) => {
    setConverting(q.id);
    try {
      const res = await axiosInstance.post(`/api/sales/quotations/${q.id}/convert`);
      showSuccess(`SO ${res.data.order_number} dibuat dari ${q.quote_number}`);
      navigate(`/app/sales/orders/${res.data.order_id}`);
    } catch (e: any) {
      showError(e?.response?.data?.error || 'Gagal convert quotation');
    } finally {
      setConverting(null);
    }
  };

  return (
    <div>
      <BackButton onBack={onBack} />
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Pilih Quotation</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Hanya quotation berstatus "accepted" yang bisa di-convert.</p>
      {loading ? (
        <div className="text-gray-400 text-sm">Memuat...</div>
      ) : quotations.length === 0 ? (
        <div className="text-gray-400 text-sm">Tidak ada quotation accepted yang siap di-convert.</div>
      ) : (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">No. Quotation</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Customer</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {quotations.map((q) => (
                <tr key={q.id}>
                  <td className="px-3 py-2">{q.quote_number}</td>
                  <td className="px-3 py-2">{q.customer_name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{q.total_amount.toLocaleString('id-ID')}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => handleConvert(q)} disabled={converting === q.id} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                      {converting === q.id ? 'Memproses...' : 'Convert ke SO'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
