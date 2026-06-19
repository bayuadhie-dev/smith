import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import {
  ArrowLeftIcon, ArrowPathIcon, CheckCircleIcon,
  ExclamationTriangleIcon, XCircleIcon,
} from '@heroicons/react/24/outline';

const OVERALL_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  matched:     { label: '✅ 3-Way Match OK',        icon: CheckCircleIcon,       color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  discrepancy: { label: '⚠️ Ada Selisih',           icon: ExclamationTriangleIcon, color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  missing_grn: { label: '❌ GRN Belum Ada',         icon: XCircleIcon,           color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
};

function fmt(n: number) {
  return n.toLocaleString('id-ID', { maximumFractionDigits: 4 });
}

function Variance({ val, unit = '' }: { val: number; unit?: string }) {
  if (Math.abs(val) < 0.001) return <span className="text-green-600 text-xs font-medium">✓</span>;
  return (
    <span className={`text-xs font-semibold ${val > 0 ? 'text-red-600' : 'text-blue-600'}`}>
      {val > 0 ? '+' : ''}{fmt(val)}{unit}
    </span>
  );
}

export default function InvoiceMatching() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    axiosInstance.get(`/api/purchasing/purchase-invoices/${id}/three-way-match`)
      .then(r => setData(r.data))
      .catch(err => setError(err?.response?.data?.error || 'Gagal memuat data matching'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64 text-gray-400">
        <ArrowPathIcon className="h-6 w-6 animate-spin mr-2" /> Memuat...
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">{error}</div>
        <Link to="/app/purchasing/invoices" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          ← Kembali ke daftar invoice
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const overall = OVERALL_CONFIG[data.overall_status] || OVERALL_CONFIG.discrepancy;
  const OIcon = overall.icon;

  const matchedCount = data.lines.filter((l: any) => l.status === 'matched').length;
  const discrepancyCount = data.lines.filter((l: any) => l.status === 'discrepancy').length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/app/purchasing/invoices" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            3-Way Matching — {data.invoice_number}
          </h1>
          <p className="text-sm text-gray-500">
            PO: <span className="font-medium">{data.po_number}</span> |
            Supplier: <span className="font-medium">{data.supplier_name}</span>
          </p>
        </div>
      </div>

      {/* Overall status banner */}
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${overall.bg}`}>
        <OIcon className={`h-6 w-6 ${overall.color} flex-shrink-0`} />
        <div className="flex-1">
          <p className={`font-semibold ${overall.color}`}>{overall.label}</p>
          <p className="text-sm text-gray-600 mt-0.5">
            {matchedCount} item cocok{discrepancyCount > 0 ? `, ${discrepancyCount} item ada selisih` : ''}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-gray-500">Total Invoice</p>
          <p className="font-bold text-gray-900 dark:text-white">
            Rp {data.invoice_total.toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total PO', value: `Rp ${data.po_total.toLocaleString('id-ID')}`, color: 'text-blue-700' },
          { label: 'GRN Terkait', value: `${data.grn_count} dokumen`, color: 'text-purple-700' },
          {
            label: 'Selisih Invoice vs PO',
            value: `Rp ${Math.abs(data.invoice_total - data.po_total).toLocaleString('id-ID')}`,
            color: Math.abs(data.invoice_total - data.po_total) < 1 ? 'text-green-700' : 'text-red-600',
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`font-bold text-lg ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Line detail table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Detail Per Item</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm divide-y divide-gray-100 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase text-xs">Item</th>
                {/* PO columns */}
                <th className="px-3 py-2 text-right font-medium text-blue-500 uppercase text-xs bg-blue-50 dark:bg-blue-900/20">PO Qty</th>
                <th className="px-3 py-2 text-right font-medium text-blue-500 uppercase text-xs bg-blue-50 dark:bg-blue-900/20">PO Harga</th>
                <th className="px-3 py-2 text-right font-medium text-blue-500 uppercase text-xs bg-blue-50 dark:bg-blue-900/20">PO Total</th>
                {/* GRN columns */}
                <th className="px-3 py-2 text-right font-medium text-purple-500 uppercase text-xs bg-purple-50 dark:bg-purple-900/20">GRN Terima</th>
                <th className="px-3 py-2 text-right font-medium text-purple-500 uppercase text-xs bg-purple-50 dark:bg-purple-900/20">GRN Diterima</th>
                {/* Invoice columns */}
                <th className="px-3 py-2 text-right font-medium text-green-600 uppercase text-xs bg-green-50 dark:bg-green-900/20">Inv Qty</th>
                <th className="px-3 py-2 text-right font-medium text-green-600 uppercase text-xs bg-green-50 dark:bg-green-900/20">Inv Harga</th>
                <th className="px-3 py-2 text-right font-medium text-green-600 uppercase text-xs bg-green-50 dark:bg-green-900/20">Inv Total</th>
                {/* Variance */}
                <th className="px-3 py-2 text-center font-medium text-gray-500 uppercase text-xs">Δ Harga</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 uppercase text-xs">Δ Qty/GRN</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 uppercase text-xs">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.lines.map((line: any, idx: number) => (
                <tr key={idx} className={line.status === 'discrepancy' ? 'bg-red-50/40 dark:bg-red-900/10' : ''}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-gray-800 dark:text-gray-200">{line.item_name}</p>
                    {line.issues.length > 0 && (
                      <ul className="mt-0.5 space-y-0.5">
                        {line.issues.map((issue: string, i: number) => (
                          <li key={i} className="text-xs text-red-500">⚠ {issue}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  {/* PO */}
                  <td className="px-3 py-2.5 text-right text-blue-700 bg-blue-50/30 dark:bg-blue-900/10">
                    {fmt(line.po_qty)} <span className="text-xs text-gray-400">{line.uom}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-blue-700 bg-blue-50/30 dark:bg-blue-900/10">
                    Rp {fmt(line.po_price)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-blue-700 bg-blue-50/30 dark:bg-blue-900/10 font-medium">
                    Rp {fmt(line.po_total)}
                  </td>
                  {/* GRN */}
                  <td className="px-3 py-2.5 text-right text-purple-700 bg-purple-50/30 dark:bg-purple-900/10">
                    {fmt(line.grn_received)} <span className="text-xs text-gray-400">{line.uom}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-purple-700 bg-purple-50/30 dark:bg-purple-900/10 font-medium">
                    {fmt(line.grn_accepted)} <span className="text-xs text-gray-400">{line.uom}</span>
                  </td>
                  {/* Invoice */}
                  <td className="px-3 py-2.5 text-right text-green-700 bg-green-50/30 dark:bg-green-900/10">
                    {fmt(line.inv_qty)} <span className="text-xs text-gray-400">{line.uom}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-green-700 bg-green-50/30 dark:bg-green-900/10">
                    Rp {fmt(line.inv_price)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-green-700 bg-green-50/30 dark:bg-green-900/10 font-medium">
                    Rp {fmt(line.inv_total)}
                  </td>
                  {/* Variances */}
                  <td className="px-3 py-2.5 text-center">
                    <Variance val={line.price_variance} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Variance val={line.qty_vs_grn} unit={` ${line.uom}`} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {line.status === 'matched' ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">OK</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">Selisih</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes */}
      <div className="text-xs text-gray-400 space-y-0.5">
        <p>🔵 <strong>PO</strong> = Jumlah & harga yang dipesan</p>
        <p>🟣 <strong>GRN</strong> = Jumlah yang sudah diterima & lulus QC</p>
        <p>🟢 <strong>Invoice</strong> = Jumlah & harga yang ditagih supplier</p>
        <p>Δ = Selisih (merah = tagihan lebih besar, biru = tagihan lebih kecil)</p>
      </div>
    </div>
  );
}
