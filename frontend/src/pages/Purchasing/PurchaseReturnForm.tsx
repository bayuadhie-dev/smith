import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import { ArrowLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface ReturnLine {
  invoice_item_id: number;
  product_id: number | null;
  material_id: number | null;
  description: string;
  uom: string;
  unit_price: number;
  max_quantity: number;
  quantity: string;
  reason: string;
  selected: boolean;
}

const RETURN_TYPES = [
  { value: 'defective', label: 'Barang Rusak/Cacat' },
  { value: 'wrong_item', label: 'Barang Salah Kirim' },
  { value: 'damaged', label: 'Rusak Saat Pengiriman' },
  { value: 'other', label: 'Lainnya' },
];

export default function PurchaseReturnForm() {
  const navigate = useNavigate();

  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceOptions, setInvoiceOptions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [returnType, setReturnType] = useState('defective');
  const [reason, setReason] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!invoiceSearch || selectedInvoice) {
      setInvoiceOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await axiosInstance.get('/api/purchasing/purchase-invoices', {
          params: { per_page: 20 },
        });
        const q = invoiceSearch.toLowerCase();
        const filtered = (res.data.invoices || []).filter(
          (inv: any) =>
            inv.invoice_number?.toLowerCase().includes(q) ||
            inv.supplier_name?.toLowerCase().includes(q),
        );
        setInvoiceOptions(filtered);
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [invoiceSearch, selectedInvoice]);

  const selectInvoice = async (invoiceSummary: any) => {
    try {
      const res = await axiosInstance.get(`/api/purchasing/purchase-invoices/${invoiceSummary.id}`);
      const invoice = res.data;
      setSelectedInvoice(invoice);
      setLines(
        (invoice.items || []).map((item: any) => ({
          invoice_item_id: item.id,
          product_id: item.product_id,
          material_id: item.material_id,
          description: item.product_name || item.material_name || item.description || '',
          uom: item.uom,
          unit_price: item.unit_price,
          max_quantity: item.quantity - (item.quantity_returned || 0),
          quantity: '0',
          reason: '',
          selected: false,
        })),
      );
    } catch (err) {
      toast.error('Gagal memuat detail invoice');
    }
  };

  const updateLine = (idx: number, field: keyof ReturnLine, value: any) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

  const selectedLines = lines.filter((l) => l.selected && parseFloat(l.quantity) > 0);
  const totalAmount = selectedLines.reduce(
    (sum, l) => sum + parseFloat(l.quantity || '0') * l.unit_price, 0,
  );

  const handleSubmit = async () => {
    if (!selectedInvoice) {
      toast.error('Pilih Purchase Invoice terlebih dahulu');
      return;
    }
    if (selectedLines.length === 0) {
      toast.error('Pilih minimal 1 item untuk diretur');
      return;
    }
    if (!reason.trim()) {
      toast.error('Alasan retur wajib diisi');
      return;
    }

    setSaving(true);
    try {
      const items = selectedLines.map((l) => {
        const quantity = parseFloat(l.quantity);
        const total_price = quantity * l.unit_price;
        return {
          invoice_item_id: l.invoice_item_id,
          product_id: l.product_id,
          material_id: l.material_id,
          description: l.description,
          quantity,
          uom: l.uom,
          unit_price: l.unit_price,
          total_price,
          reason: l.reason || reason,
        };
      });

      const res = await axiosInstance.post('/api/purchasing/purchase-returns', {
        invoice_id: selectedInvoice.id,
        supplier_id: selectedInvoice.supplier_id,
        return_date: returnDate,
        reason,
        return_type: returnType,
        subtotal: totalAmount,
        total_amount: totalAmount,
        items,
      });

      toast.success(res.data.message || 'Retur pembelian berhasil dibuat');
      navigate(`/app/purchasing/returns/${res.data.return?.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Gagal membuat retur pembelian');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/app/purchasing/returns')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Buat Retur Pembelian</h1>
          <p className="text-sm text-gray-500 mt-0.5">Pilih Purchase Invoice, lalu item yang mau diretur</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Purchase Invoice</label>
        {selectedInvoice ? (
          <div className="flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">
            <span>
              <span className="font-medium">{selectedInvoice.invoice_number}</span> — {selectedInvoice.supplier_name}
            </span>
            <button
              onClick={() => { setSelectedInvoice(null); setLines([]); setInvoiceSearch(''); }}
              className="text-xs text-blue-600 hover:underline"
            >
              Ganti
            </button>
          </div>
        ) : (
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nomor invoice / supplier..."
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-900 dark:text-white"
            />
            {searching && <p className="text-xs text-gray-400 mt-1">Mencari...</p>}
            {invoiceOptions.length > 0 && (
              <div className="mt-1 border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700 max-h-56 overflow-y-auto">
                {invoiceOptions.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => selectInvoice(inv)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <span className="font-medium">{inv.invoice_number}</span> — {inv.supplier_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedInvoice && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Retur</label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jenis Retur</label>
              <select
                value={returnType}
                onChange={(e) => setReturnType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-900 dark:text-white"
              >
                {RETURN_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alasan</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Alasan retur..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-3 py-3 w-8"></th>
                  <th className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Item</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Sisa Bisa Retur</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Qty Retur</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Harga Satuan</th>
                  <th className="px-3 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {lines.map((line, idx) => (
                  <tr key={line.invoice_item_id}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={line.selected}
                        onChange={(e) => updateLine(idx, 'selected', e.target.checked)}
                        disabled={line.max_quantity <= 0}
                      />
                    </td>
                    <td className="px-3 py-3 text-gray-800 dark:text-gray-200">{line.description}</td>
                    <td className="px-3 py-3 text-right text-gray-600 dark:text-gray-400">
                      {line.max_quantity} {line.uom}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <input
                        type="number"
                        min={0}
                        max={line.max_quantity}
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                        disabled={!line.selected}
                        className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm text-right dark:bg-gray-900 dark:text-white disabled:opacity-50"
                      />
                    </td>
                    <td className="px-3 py-3 text-right text-gray-600 dark:text-gray-400">
                      {formatCurrency(line.unit_price)}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-gray-800 dark:text-gray-200">
                      {formatCurrency((parseFloat(line.quantity) || 0) * line.unit_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-end gap-2 text-sm font-semibold">
              Total Retur: {formatCurrency(totalAmount)}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => navigate('/app/purchasing/returns')}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium"
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan Retur'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
