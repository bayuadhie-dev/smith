import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../../contexts/LanguageContext';
import axiosInstance from '../../utils/axiosConfig';
import {
  BanknotesIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface Party {
  id: number;
  name: string;
}

interface UnpaidInvoice {
  id: number;
  invoice_number: string;
  due_date: string | null;
  total_amount: number;
  balance_due: number;
}

interface CashBankAccount {
  id: number;
  code: string;
  name: string;
}

interface ContraAccount {
  id: number;
  code: string;
  name: string;
}

const FORM_TITLES: Record<string, [string, string]> = {"kas_in": ["Penerimaan Kas/Bank", "Uang masuk non-faktur: bunga bank, setoran modal, pendapatan lain"], "kas_out": ["Pembayaran Kas/Bank", "Uang keluar non-faktur: biaya admin bank, biaya operasional, dll"], "ar": ["Penerimaan Penjualan (Piutang)", "Terima pembayaran customer untuk melunasi satu atau lebih faktur penjualan"], "ap": ["Pembayaran Pembelian (Hutang)", "Bayar supplier untuk melunasi satu atau lebih faktur pembelian"]};

type FormKind = 'kas_in' | 'kas_out' | 'ar' | 'ap';

const PaymentForm = ({ kind }: { kind?: FormKind }) => {
  const { t } = useLanguage();
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefillInvoiceId = searchParams.get('invoice_id')
  const prefillApplied = useRef(false)

  // Satu form, tiga mode: transaksi Kas/Bank bebas (rincian akun), Penerimaan
  // Penjualan (Piutang), Pembayaran Pembelian (Hutang). AR/AP bisa melunasi
  // beberapa faktur sekaligus (centang + nilai per faktur); Kas/Bank bisa
  // dibagi ke beberapa akun biaya/pendapatan.
  type Mode = 'kas' | 'ar' | 'ap';
  // Tiga form terpisah (route masing-masing); route lama /payments/new
  // memilih bentuk dari ?type= supaya tautan lama tetap jalan.
  const queryType = searchParams.get('type');
  const effectiveKind: FormKind = kind ?? (
    queryType === 'kas' ? (searchParams.get('direction') === 'in' ? 'kas_in' : 'kas_out')
    : queryType === 'supplier' ? 'ap'
    : (queryType === 'customer' || prefillInvoiceId) ? 'ar' : 'ap'
  );
  const [mode, setMode] = useState<Mode>(
    effectiveKind === 'ar' ? 'ar' : effectiveKind === 'ap' ? 'ap' : 'kas'
  );
  const cashDirection: 'in' | 'out' = effectiveKind === 'kas_in' ? 'in' : 'out';
  const isStandalone = mode === 'kas';
  const paymentType: 'supplier' | 'customer' = mode === 'ar' ? 'customer' : mode === 'ap' ? 'supplier' : (cashDirection === 'in' ? 'customer' : 'supplier');

  const [parties, setParties] = useState<Party[]>([]);
  const [invoices, setInvoices] = useState<UnpaidInvoice[]>([]);
  const [cashBankAccounts, setCashBankAccounts] = useState<CashBankAccount[]>([]);
  const [contraAccounts, setContraAccounts] = useState<ContraAccount[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [alloc, setAlloc] = useState<Record<number, string>>({});
  const [lines, setLines] = useState<{ account_id: string; amount: string; description: string }[]>([
    { account_id: '', amount: '', description: '' },
  ]);

  const [formData, setFormData] = useState({
    party_id: '',
    payment_date: '',
    payment_method: 'bank_transfer',
    reference_number: '',
    notes: '',
    bank_account_id: ''
  })

  const totalAmount = isStandalone
    ? lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
    : Object.values(alloc).reduce((s, v) => s + (Number(v) || 0), 0);

  useEffect(() => {
    setFormData(f => ({ ...f, party_id: '' }));
    setInvoices([]);
    setAlloc({});
    if (mode === 'kas') { setParties([]); return; }

    const partyEndpoint = mode === 'ap'
      ? '/api/purchasing/suppliers'
      : '/api/sales/customers';

    axiosInstance.get(partyEndpoint).then((res) => {
      const list = res.data.suppliers || res.data.customers || res.data || [];
      setParties(list.map((p: any) => ({
        id: p.id,
        name: p.company_name || p.name || `#${p.id}`
      })));
    }).catch(() => setParties([]));
  }, [mode]);

  useEffect(() => {
    axiosInstance.get('/api/finance/chart-of-accounts').then((res) => {
      const all = res.data.accounts || [];
      setCashBankAccounts(all.filter((a: any) => a.is_cash_bank));
      setContraAccounts(
        all
          .filter((a: any) => !a.is_cash_bank && !a.is_header)
          .map((a: any) => ({ id: a.id, code: a.code, name: a.name }))
      );
    }).catch(() => { setCashBankAccounts([]); setContraAccounts([]); });
  }, []);

  useEffect(() => {
    if (!formData.party_id || mode === 'kas') {
      setInvoices([]);
      return;
    }
    setLoadingInvoices(true);
    const param = mode === 'ap' ? 'supplier_id' : 'customer_id';
    axiosInstance.get(`/api/finance/invoices/unpaid?${param}=${formData.party_id}`)
      .then((res) => setInvoices(res.data.invoices || []))
      .catch(() => setInvoices([]))
      .finally(() => setLoadingInvoices(false));
    setAlloc({});
  }, [formData.party_id, mode]);

  // Prefill from ?invoice_id= ("Catat Pembayaran" row action on InvoiceList.tsx).
  useEffect(() => {
    if (!prefillInvoiceId || prefillApplied.current) return;
    axiosInstance.get(`/api/finance/invoices/${prefillInvoiceId}`).then((res) => {
      const inv = res.data.invoice || res.data;
      const partyId = inv.customer_id || inv.supplier_id;
      if (inv.customer_id) setMode('ar');
      else if (inv.supplier_id) setMode('ap');
      if (partyId) setFormData((f) => ({ ...f, party_id: String(partyId) }));
    }).catch(() => {});
  }, [prefillInvoiceId]);

  useEffect(() => {
    if (!prefillInvoiceId || prefillApplied.current || invoices.length === 0) return;
    const inv = invoices.find((i) => String(i.id) === String(prefillInvoiceId));
    if (inv) {
      setAlloc({ [inv.id]: String(inv.balance_due) });
      prefillApplied.current = true;
    }
  }, [invoices, prefillInvoiceId]);

  const toggleInvoice = (inv: UnpaidInvoice, checked: boolean) => {
    setAlloc((a) => {
      const next = { ...a };
      if (checked) next[inv.id] = String(inv.balance_due);
      else delete next[inv.id];
      return next;
    });
  };

  const [distributeAmount, setDistributeAmount] = useState('');
  // Seperti "Distribusi Nilai Pembayaran" di Accurate: isi dari faktur
  // paling lama (jatuh tempo terdekat) sampai nilai habis.
  const distribute = () => {
    let remaining = Number(distributeAmount) || 0;
    const next: Record<number, string> = {};
    for (const inv of invoices) {
      if (remaining <= 0) break;
      const pay = Math.min(remaining, inv.balance_due);
      next[inv.id] = String(pay);
      remaining -= pay;
    }
    setAlloc(next);
  };

  const updateLine = (idx: number, patch: Partial<{ account_id: string; amount: string; description: string }>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null);

    const allocations = Object.entries(alloc)
      .filter(([, v]) => Number(v) > 0)
      .map(([id, v]) => ({ invoice_id: Number(id), amount: Number(v) }));
    const cleanLines = lines
      .filter((l) => l.account_id || Number(l.amount))
      .map((l) => ({ account_id: Number(l.account_id), amount: Number(l.amount), description: l.description || undefined }));

    if (!isStandalone && allocations.length === 0) {
      setError('Centang minimal satu faktur yang akan dilunasi.');
      return;
    }
    if (isStandalone && (cleanLines.length === 0 || cleanLines.some((l) => !l.account_id || !(l.amount > 0)))) {
      setError('Setiap baris rincian harus punya akun dan nilai lebih dari 0.');
      return;
    }
    if (!formData.bank_account_id) {
      setError('Pilih akun Kas/Bank.');
      return;
    }

    setSubmitting(true);
    try {
      await axiosInstance.post('/api/finance/payments', {
        payment_date: formData.payment_date,
        payment_type: paymentType === 'supplier' ? 'payment' : 'receipt',
        allocations: isStandalone ? undefined : allocations,
        lines: isStandalone ? cleanLines : undefined,
        supplier_id: !isStandalone && paymentType === 'supplier' ? Number(formData.party_id) : undefined,
        customer_id: !isStandalone && paymentType === 'customer' ? Number(formData.party_id) : undefined,
        payment_method: formData.payment_method,
        amount: totalAmount,
        reference_number: formData.reference_number || undefined,
        notes: formData.notes || undefined,
        bank_account_id: Number(formData.bank_account_id),
      });
      navigate(
        isStandalone
          ? (paymentType === 'supplier' ? '/app/finance/pembayaran' : '/app/finance/penerimaan')
          : (paymentType === 'supplier' ? '/app/accounting/payable' : '/app/accounting/receivable')
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal menyimpan pembayaran. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  const handleCancel = () => {
    navigate(isStandalone ? (cashDirection === 'in' ? '/app/finance/penerimaan' : '/app/finance/pembayaran') : (mode === 'ap' ? '/app/accounting/payable' : '/app/accounting/receivable'))
  }


  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{FORM_TITLES[effectiveKind][0]}</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">{FORM_TITLES[effectiveKind][1]}</p>
        </div>
        <button 
          onClick={handleCancel}
          className="btn-secondary inline-flex items-center gap-2"
        >
          <XMarkIcon className="h-5 w-5" />{t('common.cancel')}</button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {/* Payment Form */}
      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {!isStandalone && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {mode === 'ap' ? 'Supplier' : 'Customer'}
                </label>
                <select
                  className="input w-full"
                  value={formData.party_id}
                  onChange={(e) => setFormData({ ...formData, party_id: e.target.value })}
                  required
                >
                  <option value="">Pilih {mode === 'ap' ? 'supplier' : 'customer'}</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {!isStandalone && formData.party_id && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Faktur yang dilunasi (centang satu atau lebih)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="number"
                    className="input w-56"
                    placeholder="Nilai pembayaran (opsional)"
                    value={distributeAmount}
                    onChange={(e) => setDistributeAmount(e.target.value)}
                  />
                  <button type="button" className="btn-secondary text-sm" onClick={distribute}>
                    Distribusikan ke faktur terlama
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    onClick={() => setAlloc(Object.fromEntries(invoices.map((i) => [i.id, String(i.balance_due)])))}
                  >
                    Lunasi semua
                  </button>
                </div>
                {loadingInvoices && <p className="text-sm text-gray-500">Memuat...</p>}
                {!loadingInvoices && invoices.length === 0 && (
                  <p className="text-sm text-gray-500">Tidak ada faktur belum lunas untuk pihak ini.</p>
                )}
                {invoices.length > 0 && (
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700 text-left">
                        <tr>
                          <th className="p-2 w-10"></th>
                          <th className="p-2">No. Faktur</th>
                          <th className="p-2">Jatuh Tempo</th>
                          <th className="p-2 text-right">Total</th>
                          <th className="p-2 text-right">Sisa</th>
                          <th className="p-2 text-right w-44">Dibayar</th>
                          <th className="p-2 text-right">Sisa Setelah</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((inv) => {
                          const checked = inv.id in alloc;
                          return (
                            <tr key={inv.id} className="border-t">
                              <td className="p-2">
                                <input type="checkbox" checked={checked} onChange={(e) => toggleInvoice(inv, e.target.checked)} />
                              </td>
                              <td className="p-2">{inv.invoice_number}</td>
                              <td className="p-2">{inv.due_date || '-'}</td>
                              <td className="p-2 text-right">Rp{inv.total_amount.toLocaleString('id-ID')}</td>
                              <td className="p-2 text-right">Rp{inv.balance_due.toLocaleString('id-ID')}</td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  className="input w-full text-right"
                                  disabled={!checked}
                                  max={inv.balance_due}
                                  value={alloc[inv.id] ?? ''}
                                  onChange={(e) => setAlloc((a) => ({ ...a, [inv.id]: e.target.value }))}
                                />
                              </td>
                              <td className="p-2 text-right">
                                Rp{(inv.balance_due - (Number(alloc[inv.id]) || 0)).toLocaleString('id-ID')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {isStandalone && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Rincian Akun (satu nilai kas bisa dibagi ke beberapa akun)
                </label>
                <div className="space-y-2">
                  {lines.map((l, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2">
                      <select
                        className="input col-span-5"
                        value={l.account_id}
                        onChange={(e) => updateLine(idx, { account_id: e.target.value })}
                      >
                        <option value="">Pilih akun (mis. Beban Bunga, Pendapatan Lain-lain)</option>
                        {contraAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        className="input col-span-4"
                        placeholder="Keterangan baris (opsional)"
                        value={l.description}
                        onChange={(e) => updateLine(idx, { description: e.target.value })}
                      />
                      <input
                        type="number"
                        className="input col-span-2 text-right"
                        placeholder="Nilai"
                        value={l.amount}
                        onChange={(e) => updateLine(idx, { amount: e.target.value })}
                      />
                      <button
                        type="button"
                        className="col-span-1 text-red-600 disabled:opacity-30"
                        disabled={lines.length === 1}
                        onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                      >
                        <XMarkIcon className="h-5 w-5 mx-auto" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn-secondary mt-2 text-sm"
                  onClick={() => setLines((ls) => [...ls, { account_id: '', amount: '', description: '' }])}
                >
                  + Tambah baris akun
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  {cashDirection === 'in'
                    ? 'Jurnal: Debit Kas/Bank (total), Kredit tiap akun di atas.'
                    : 'Jurnal: Debit tiap akun di atas, Kredit Kas/Bank (total).'}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Total (IDR)
              </label>
              <input
                type="text"
                className="input w-full bg-gray-50 font-semibold"
                readOnly
                value={`Rp ${totalAmount.toLocaleString('id-ID')}`}
              />
              <p className="text-xs text-gray-500 mt-1">
                {isStandalone ? 'Jumlah dari semua baris rincian.' : 'Jumlah dari semua faktur yang dicentang.'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Payment Date
              </label>
              <input
                type="date"
                className="input w-full"
                value={formData.payment_date}
                onChange={(e) => setFormData({...formData, payment_date: e.target.value})}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Bank Account
              </label>
              <select 
                className="input w-full"
                value={formData.bank_account_id}
                onChange={(e) => setFormData({...formData, bank_account_id: e.target.value})}
                required
              >
                <option value="">Pilih akun Kas/Bank</option>
                {cashBankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Metode Pembayaran
              </label>
              <select
                className="input w-full"
                value={formData.payment_method}
                onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                required
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="check">Check</option>
                <option value="credit_card">Credit Card</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                No. Referensi
              </label>
              <input
                type="text"
                className="input w-full"
                placeholder="No. transfer / cek (opsional)"
                value={formData.reference_number}
                onChange={(e) => setFormData({...formData, reference_number: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{t('common.description')}</label>
            <textarea
              className="input w-full"
              rows={3}
              placeholder="Payment description..."
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-4 pt-6 border-t">
            <button 
              type="button"
              onClick={handleCancel}
              className="btn-secondary"
            >{t('common.cancel')}</button>
            <button 
              type="submit"
              disabled={submitting}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              <CreditCardIcon className="h-5 w-5" />
              {submitting ? 'Menyimpan...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>

      {/* Payment Summary */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">💰 Payment Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <BanknotesIcon className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-blue-600">Amount to Pay</p>
                <p className="text-xl font-bold text-blue-800">
                  {`Rp ${totalAmount.toLocaleString('id-ID')}`}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <CalendarDaysIcon className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm text-green-600">Payment Date</p>
                <p className="text-xl font-bold text-green-800">
                  {formData.payment_date || 'Not set'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center">
              <CreditCardIcon className="h-8 w-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm text-purple-600">Bank Account</p>
                <p className="text-xl font-bold text-purple-800">
                  {cashBankAccounts.find(a => a.id === Number(formData.bank_account_id))?.name || 'Not selected'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaymentForm
