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

const PaymentForm = () => {
  const { t } = useLanguage();
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefillInvoiceId = searchParams.get('invoice_id')
  const prefillApplied = useRef(false)

  const [paymentType, setPaymentType] = useState<'supplier' | 'customer'>(
    searchParams.get('type') === 'supplier' ? 'supplier' : (prefillInvoiceId ? 'customer' : 'supplier')
  );
  const [parties, setParties] = useState<Party[]>([]);
  const [invoices, setInvoices] = useState<UnpaidInvoice[]>([]);
  const [cashBankAccounts, setCashBankAccounts] = useState<CashBankAccount[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    party_id: '',
    invoice_id: '',
    amount: '',
    payment_date: '',
    payment_method: 'bank_transfer',
    reference_number: '',
    notes: '',
    bank_account_id: ''
  })

  // Load parties (suppliers or customers) + cash/bank accounts whenever
  // payment type changes
  useEffect(() => {
    setFormData(f => ({ ...f, party_id: '', invoice_id: '', amount: '' }));
    setInvoices([]);

    const partyEndpoint = paymentType === 'supplier'
      ? '/api/purchasing/suppliers'
      : '/api/customers';

    axiosInstance.get(partyEndpoint).then((res) => {
      const list = res.data.suppliers || res.data.customers || res.data || [];
      setParties(list.map((p: any) => ({
        id: p.id,
        name: p.company_name || p.name || `#${p.id}`
      })));
    }).catch(() => setParties([]));
  }, [paymentType]);

  useEffect(() => {
    axiosInstance.get('/api/finance/chart-of-accounts').then((res) => {
      const all = res.data.accounts || [];
      setCashBankAccounts(all.filter((a: any) => a.is_cash_bank));
    }).catch(() => setCashBankAccounts([]));
  }, []);

  // Load unpaid invoices whenever the selected party changes
  useEffect(() => {
    if (!formData.party_id) {
      setInvoices([]);
      return;
    }
    setLoadingInvoices(true);
    const param = paymentType === 'supplier' ? 'supplier_id' : 'customer_id';
    axiosInstance.get(`/api/finance/invoices/unpaid?${param}=${formData.party_id}`)
      .then((res) => setInvoices(res.data.invoices || []))
      .catch(() => setInvoices([]))
      .finally(() => setLoadingInvoices(false));
  }, [formData.party_id, paymentType]);

  // Prefill from ?invoice_id= (Temuan 6, UX_AUDIT_REPORT.md) - "Catat Pembayaran" row
  // action on InvoiceList.tsx navigates here so staff don't have to re-search both the
  // customer/supplier AND the invoice from scratch. Fetch the invoice once to discover
  // its party, then auto-select the invoice itself once the party's unpaid-invoice list
  // has loaded.
  useEffect(() => {
    if (!prefillInvoiceId || prefillApplied.current) return;
    axiosInstance.get(`/api/finance/invoices/${prefillInvoiceId}`).then((res) => {
      const inv = res.data.invoice || res.data;
      const partyId = inv.customer_id || inv.supplier_id;
      if (inv.customer_id) setPaymentType('customer');
      else if (inv.supplier_id) setPaymentType('supplier');
      if (partyId) setFormData((f) => ({ ...f, party_id: String(partyId) }));
    }).catch(() => {});
  }, [prefillInvoiceId]);

  useEffect(() => {
    if (!prefillInvoiceId || prefillApplied.current || invoices.length === 0) return;
    const inv = invoices.find((i) => String(i.id) === String(prefillInvoiceId));
    if (inv) {
      handleInvoiceChange(String(inv.id));
      prefillApplied.current = true;
    }
  }, [invoices, prefillInvoiceId]);

  const selectedInvoice = invoices.find(i => i.id === Number(formData.invoice_id));

  const handleInvoiceChange = (invoiceId: string) => {
    const inv = invoices.find(i => i.id === Number(invoiceId));
    setFormData({
      ...formData,
      invoice_id: invoiceId,
      amount: inv ? String(inv.balance_due) : formData.amount
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null);

    if (!formData.invoice_id) {
      setError('Pilih faktur yang akan dibayar.');
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
        invoice_id: Number(formData.invoice_id),
        supplier_id: paymentType === 'supplier' ? Number(formData.party_id) : undefined,
        customer_id: paymentType === 'customer' ? Number(formData.party_id) : undefined,
        payment_method: formData.payment_method,
        amount: Number(formData.amount),
        reference_number: formData.reference_number || undefined,
        bank_account_id: Number(formData.bank_account_id),
      });
      navigate(paymentType === 'supplier' ? '/app/accounting/payable' : '/app/accounting/receivable');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Gagal menyimpan pembayaran. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  const handleCancel = () => {
    navigate('/app/accounting/payable')
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">💳 Record Payment</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Record supplier payment or customer receipt</p>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Payment Type
              </label>
              <select
                className="input w-full"
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as 'supplier' | 'customer')}
                required
              >
                <option value="supplier">Supplier Payment (AP)</option>
                <option value="customer">Customer Receipt (AR)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                {paymentType === 'supplier' ? 'Supplier' : 'Customer'}
              </label>
              <select 
                className="input w-full"
                value={formData.party_id}
                onChange={(e) => setFormData({...formData, party_id: e.target.value, invoice_id: ''})}
                required
              >
                <option value="">Pilih {paymentType === 'supplier' ? 'supplier' : 'customer'}</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Faktur
              </label>
              <select
                className="input w-full"
                value={formData.invoice_id}
                onChange={(e) => handleInvoiceChange(e.target.value)}
                disabled={!formData.party_id || loadingInvoices}
                required
              >
                <option value="">
                  {loadingInvoices ? 'Memuat...' : !formData.party_id ? 'Pilih pihak dulu' : 'Pilih faktur'}
                </option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} — sisa Rp{inv.balance_due.toLocaleString('id-ID')}
                  </option>
                ))}
              </select>
              {formData.party_id && !loadingInvoices && invoices.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">Tidak ada faktur belum lunas untuk pihak ini.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Amount (IDR)
              </label>
              <input
                type="number"
                className="input w-full"
                placeholder="0"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                max={selectedInvoice?.balance_due}
                required
              />
              {selectedInvoice && (
                <p className="text-sm text-gray-500 mt-1">
                  Sisa tagihan: Rp{selectedInvoice.balance_due.toLocaleString('id-ID')}
                </p>
              )}
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
                  {formData.amount ? `Rp ${Number(formData.amount).toLocaleString('id-ID')}` : 'Rp 0'}
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
