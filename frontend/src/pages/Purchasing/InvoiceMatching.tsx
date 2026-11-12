import AttachmentsPanel from '../../components/AttachmentsPanel'
import RiwayatPanel from '../../components/RiwayatPanel'
import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import DocumentGenerateButton from '../../components/DocumentGenerateButton';
import { usePermissions } from '../../contexts/PermissionContext';
import {
  ArrowLeftIcon, ArrowPathIcon, CheckCircleIcon,
  ExclamationTriangleIcon, XCircleIcon,
} from '@heroicons/react/24/outline';

const OVERALL_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  matched:     { label: '✅ 3-Way Match OK',        icon: CheckCircleIcon,       color: 'text-green-700 dark:text-green-300',  bg: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' },
  discrepancy: { label: '⚠️ Ada Selisih',           icon: ExclamationTriangleIcon, color: 'text-yellow-700 dark:text-yellow-300', bg: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800' },
  missing_grn: { label: '❌ GRN Belum Ada',         icon: XCircleIcon,           color: 'text-red-700 dark:text-red-300',    bg: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' },
};

function fmt(n: number) {
  return n.toLocaleString('id-ID', { maximumFractionDigits: 4 });
}

function Variance({ val, unit = '' }: { val: number; unit?: string }) {
  if (Math.abs(val) < 0.001) return <span className="text-green-600 text-xs font-medium dark:text-green-400">✓</span>;
  return (
    <span className={`text-xs font-semibold ${val > 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
      {val > 0 ? '+' : ''}{fmt(val)}{unit}
    </span>
  );
}

export default function InvoiceMatching() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inv, setInv] = useState<any>(null);
  const { hasPermission } = usePermissions() as any;

  useEffect(() => {
    axiosInstance.get(`/api/purchasing/purchase-invoices/${id}/three-way-match`)
      .then(r => setData(r.data))
      .catch(err => setError(err?.response?.data?.error || 'Gagal memuat data matching'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    axiosInstance.get(`/api/purchasing/purchase-invoices/${id}`).then(r => setInv(r.data)).catch(() => setInv(null));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64 text-gray-400">
        <ArrowPathIcon className="h-6 w-6 animate-spin mr-2" /> Memuat...
      </div>
    );
  }

  if (error && inv && !inv.po_id) {
    const fmt = (n: number) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Faktur Pembelian {inv.invoice_number}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{inv.supplier_name || '-'} · tanpa PO{inv.grn_id ? <> · <Link className="text-blue-600 hover:underline dark:text-blue-400" to={`/app/purchasing/grn/${inv.grn_id}`}>lihat GRN</Link></> : null} · pencocokan 3 arah tidak berlaku tanpa PO</p>
          </div>
          <div className="flex items-center gap-2">
          <DocumentGenerateButton transactionType="purchase_invoice" transactionId={inv.id} transactionNumber={inv.invoice_number} label="Cetak" />
          {inv.status !== 'cancelled' && inv.grn_id && (
            <Link to={`/app/purchasing/invoices/new?grn_id=${inv.grn_id}&edit=${id}`} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Ubah faktur</Link>
          )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div><div className="text-xs text-gray-500 dark:text-gray-400">No. faktur pemasok</div>{inv.supplier_invoice_number || '-'}</div>
          <div><div className="text-xs text-gray-500 dark:text-gray-400">Tanggal</div>{inv.invoice_date || '-'}</div>
          <div><div className="text-xs text-gray-500 dark:text-gray-400">Jatuh tempo</div>{inv.due_date || '-'}</div>
          <div><div className="text-xs text-gray-500 dark:text-gray-400">Status</div>{inv.status}</div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400"><tr><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Harga</th><th className="px-3 py-2 text-right">Jumlah</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {(inv.items || []).map((it: any, i: number) => (
                <tr key={i}><td className="px-3 py-2">{it.description || it.material_name || it.product_name || '-'}</td><td className="px-3 py-2 text-right">{Number(it.quantity).toLocaleString('id-ID')} {it.uom}</td><td className="px-3 py-2 text-right">{fmt(it.unit_price)}</td><td className="px-3 py-2 text-right">{fmt(it.total_amount ?? it.total_price)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-right text-lg font-semibold">Total {fmt(inv.total_amount)}</div>
        <Link to="/app/purchasing/invoices" className="inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">← Kembali ke daftar invoice</Link>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800">{error}</div>
        <Link to="/app/purchasing/invoices" className="mt-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">
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
          <p className="text-sm text-gray-500 dark:text-gray-400">
            PO: <span className="font-medium">{data.po_number}</span> |
            Supplier: <span className="font-medium">{data.supplier_name}</span>
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <DocumentGenerateButton transactionType="purchase_invoice" transactionId={Number(id)} transactionNumber={data.invoice_number} label="Cetak Faktur" />
          <DocumentGenerateButton transactionType="three_way_match" transactionId={Number(id)} transactionNumber={data.invoice_number} label="Cetak Hasil" />
          {(!hasPermission || hasPermission('purchasing.edit')) && inv && inv.status !== 'cancelled' && (
            Number(inv.amount_paid || 0) > 0
              ? <span className="text-xs text-gray-500 dark:text-gray-400" title="Batalkan pembayarannya dulu untuk bisa mengubah faktur">Faktur sudah dibayar, tidak bisa diubah</span>
              : <Link to={`/app/purchasing/invoices/new?po_id=${inv.po_id}&edit=${id}`} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Ubah faktur</Link>
          )}
        </div>
      </div>

      {/* Overall status banner */}
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${overall.bg}`}>
        <OIcon className={`h-6 w-6 ${overall.color} flex-shrink-0`} />
        <div className="flex-1">
          <p className={`font-semibold ${overall.color}`}>{overall.label}</p>
          <p className="text-sm text-gray-600 mt-0.5 dark:text-gray-300">
            {matchedCount} item cocok{discrepancyCount > 0 ? `, ${discrepancyCount} item ada selisih` : ''}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-gray-500 dark:text-gray-400">Total Invoice</p>
          <p className="font-bold text-gray-900 dark:text-white">
            Rp {data.invoice_total.toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total PO', value: `Rp ${data.po_total.toLocaleString('id-ID')}`, color: 'text-blue-700 dark:text-blue-300' },
          { label: 'GRN Terkait', value: `${data.grn_count} dokumen`, color: 'text-purple-700 dark:text-purple-300' },
          {
            label: 'Selisih Harga Invoice vs PO (tanpa PPN)',
            value: `Rp ${Math.abs((data.invoice_subtotal ?? data.invoice_total) - (data.po_total_invoiced ?? data.po_total)).toLocaleString('id-ID')}`,
            color: Math.abs((data.invoice_subtotal ?? data.invoice_total) - (data.po_total_invoiced ?? data.po_total)) < 1 ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400',
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center">
            <p className="text-xs text-gray-500 mb-1 dark:text-gray-400">{label}</p>
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
                <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase text-xs dark:text-gray-400">Item</th>
                {/* PO columns */}
                <th className="px-3 py-2 text-right font-medium text-blue-500 uppercase text-xs bg-blue-50 dark:bg-blue-900/20">PO Qty</th>
                <th className="px-3 py-2 text-right font-medium text-blue-500 uppercase text-xs bg-blue-50 dark:bg-blue-900/20">PO Harga</th>
                <th className="px-3 py-2 text-right font-medium text-blue-500 uppercase text-xs bg-blue-50 dark:bg-blue-900/20">PO Total</th>
                {/* GRN columns */}
                <th className="px-3 py-2 text-right font-medium text-purple-500 uppercase text-xs bg-purple-50 dark:bg-purple-900/20">GRN Terima</th>
                <th className="px-3 py-2 text-right font-medium text-purple-500 uppercase text-xs bg-purple-50 dark:bg-purple-900/20">GRN Diterima</th>
                {/* Invoice columns */}
                <th className="px-3 py-2 text-right font-medium text-green-600 uppercase text-xs bg-green-50 dark:bg-green-900/20 dark:text-green-400">Inv Qty</th>
                <th className="px-3 py-2 text-right font-medium text-green-600 uppercase text-xs bg-green-50 dark:bg-green-900/20 dark:text-green-400">Inv Harga</th>
                <th className="px-3 py-2 text-right font-medium text-green-600 uppercase text-xs bg-green-50 dark:bg-green-900/20 dark:text-green-400">Inv Total</th>
                {/* Variance */}
                <th className="px-3 py-2 text-center font-medium text-gray-500 uppercase text-xs dark:text-gray-400">Δ Harga</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 uppercase text-xs dark:text-gray-400">Δ Qty/GRN</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 uppercase text-xs dark:text-gray-400">Status</th>
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
                  <td className="px-3 py-2.5 text-right text-blue-700 bg-blue-50/30 dark:bg-blue-900/10 dark:text-blue-300">
                    {fmt(line.po_qty)} <span className="text-xs text-gray-400">{line.uom}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-blue-700 bg-blue-50/30 dark:bg-blue-900/10 dark:text-blue-300">
                    Rp {fmt(line.po_price)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-blue-700 bg-blue-50/30 dark:bg-blue-900/10 font-medium dark:text-blue-300">
                    Rp {fmt(line.po_total)}
                  </td>
                  {/* GRN */}
                  <td className="px-3 py-2.5 text-right text-purple-700 bg-purple-50/30 dark:bg-purple-900/10 dark:text-purple-300">
                    {fmt(line.grn_received)} <span className="text-xs text-gray-400">{line.uom}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-purple-700 bg-purple-50/30 dark:bg-purple-900/10 font-medium dark:text-purple-300">
                    {fmt(line.grn_accepted)} <span className="text-xs text-gray-400">{line.uom}</span>
                  </td>
                  {/* Invoice */}
                  <td className="px-3 py-2.5 text-right text-green-700 bg-green-50/30 dark:bg-green-900/10 dark:text-green-300">
                    {fmt(line.inv_qty)} <span className="text-xs text-gray-400">{line.uom}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-green-700 bg-green-50/30 dark:bg-green-900/10 dark:text-green-300">
                    Rp {fmt(line.inv_price)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-green-700 bg-green-50/30 dark:bg-green-900/10 font-medium dark:text-green-300">
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
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium dark:bg-green-900/30 dark:text-green-300">OK</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium dark:bg-red-900/30 dark:text-red-300">Selisih</span>
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
      {((data.extra_lines || []).length > 0 || data.notes) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Biaya Tambahan & Catatan</h2>
          </div>
          {(data.extra_lines || []).length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-100 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase text-xs dark:text-gray-400">Keterangan</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase text-xs dark:text-gray-400">Akun</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase text-xs dark:text-gray-400">Qty</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase text-xs dark:text-gray-400">Harga</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase text-xs dark:text-gray-400">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {data.extra_lines.map((x: any, i: number) => (
                    <tr key={i}>
                      <td className="px-3 py-2.5 text-gray-800 dark:text-gray-200">{x.description}{x.notes ? <div className="text-xs text-gray-500 dark:text-gray-400">{x.notes}</div> : null}</td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">{x.account || '-'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{Number(x.quantity).toLocaleString('id-ID', { maximumFractionDigits: 4 })} {x.uom || ''}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">Rp {Number(x.unit_price).toLocaleString('id-ID')}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium">Rp {Number(x.total).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.notes && (
            <div className="border-t border-gray-100 px-5 py-3 text-sm dark:border-gray-700">
              <p className="mb-1 text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Catatan</p>
              <p className="whitespace-pre-line text-gray-700 dark:text-gray-200">{data.notes}</p>
            </div>
          )}
        </div>
      )}

      <AttachmentsPanel entityType="purchase_invoice" entityId={id} />
      <RiwayatPanel table="invoices" id={id} />
    </div>
  );
}
