import { PendingAttachments, uploadAttachments } from '../../components/AttachmentsPanel'
import React, { useState, useEffect, useRef } from 'react'
import SearchableSelect from '../../components/SearchableSelect';
import { useDraftState } from '../../workspace/drafts';
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../../contexts/LanguageContext';
import axiosInstance from '../../utils/axiosConfig';
import toast from 'react-hot-toast';
import { XMarkIcon } from '@heroicons/react/24/outline';
import NumberInput from '../../components/ui/NumberInput'
import { PageHeader, Panel } from '../../components/ui/PageKit'

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
  currency?: string;
  bank_name?: string | null;
  account_number?: string | null;
}

interface ContraAccount {
  id: number;
  code: string;
  name: string;
}

const FORM_TITLES: Record<string, [string, string]> = {"kas_in": ["Penerimaan Kas/Bank", "Uang masuk non-faktur: bunga bank, setoran modal, pendapatan lain"], "kas_out": ["Pembayaran Kas/Bank", "Uang keluar non-faktur: biaya admin bank, biaya operasional, dll"], "ar": ["Penerimaan Penjualan (Piutang)", "Terima pembayaran pelanggan untuk melunasi satu atau lebih faktur penjualan"], "ap": ["Pembayaran Pembelian (Utang)", "Bayar pemasok untuk melunasi satu atau lebih faktur pembelian"]};

type FormKind = 'kas_in' | 'kas_out' | 'ar' | 'ap';

const PaymentForm = ({ kind }: { kind?: FormKind }) => {
  const { t } = useLanguage();
  const navigate = useNavigate()
  const [attFiles, setAttFiles] = useState<File[]>([])
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

  const editId = searchParams.get('edit');
  const editAllocRef = useRef<{ invoice_id: number; invoice_number: string | null; invoice_total_amount: number | null; amount: number; discount?: number }[] | null>(null);
  const [paymentNumber, setPaymentNumber] = useDraftState('paymentNumber', '');
  const [nextNumber, setNextNumber] = useState('');
  const numberTouched = useRef(false);
  useEffect(() => { if (!editId && nextNumber && !numberTouched.current && !paymentNumber) setPaymentNumber(nextNumber); }, [nextNumber]);
  const [alloc, setAlloc] = useDraftState<Record<number, string>>('alloc', {});
  const [lines, setLines] = useDraftState<{ account_id: string; amount: string; description: string; party_type?: string; party_id?: string }[]>('lines', [
    { account_id: '', amount: '', description: '' },
  ]);

  const [adj, setAdj] = useDraftState<{ account_id: string; amount: string; description: string }[]>('adj', []);
  const [openAdv, setOpenAdv] = useState<{ account_id: number; account_code: string; account_name: string; outstanding: number; party_name: string; entries: { payment_number: string; amount: number }[] }[]>([]);
  const updateAdj = (idx: number, patch: Partial<{ account_id: string; amount: string; description: string }>) => setAdj((a) => a.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  // Baris selisih diisi sebagai potongan (positif) yang melunasi faktur tanpa kas; ke server dikirim berlawanan tanda.
  const adjTotal = -adj.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const [formData, setFormData] = useDraftState('formData', {
    party_id: '',
    payment_date: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })(),
    payment_method: 'bank_transfer',
    reference_number: '',
    notes: '',
    paid_to: '',
    bank_account_id: ''
  })

  // Diskon = total nilai negatif di "Selisih dan diskon", dibagi ke faktur yang dicentang (urut tampil), maksimal sisa tiap faktur.
  // Faktur dilunasi = Dibayar + Diskon.
  const discOf: Record<number, number> = (() => {
    const out: Record<number, number> = {};
    let pool = adj.reduce((s, l) => s + Math.max(0, Number(l.amount) || 0), 0);
    const checked = invoices.filter((i) => i.id in alloc);
    checked.forEach((inv, k) => {
      if (pool <= 0) return;
      const room = Math.max(0, inv.balance_due - (Number(alloc[inv.id]) || 0));
      // Sisa diskon yang tidak muat ditaruh di faktur terakhir (jadi terlihat minus di Sisa Setelah), bukan hilang diam-diam.
      const give = k === checked.length - 1 ? pool : Math.min(room, pool);
      if (give > 0) { out[inv.id] = give; pool -= give; }
    });
    return out;
  })();
  const effAlloc: Record<number, string> = Object.fromEntries(
    Object.entries(alloc).map(([id, v]) => [id, String((Number(v) || 0) + (discOf[Number(id)] || 0))]),
  );

  const totalAmount = isStandalone
    ? lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
    : Object.values(effAlloc).reduce((s, v) => s + (Number(v) || 0), 0) + adjTotal;
  const allocTotal = totalAmount - (isStandalone ? 0 : adjTotal);

  useEffect(() => {
    if (!editId) {
      setFormData(f => ({ ...f, party_id: '' }));
      setInvoices([]);
      setAlloc({});
    }
    if (mode === 'kas') { setParties([]); return; }

    const partyEndpoint = mode === 'ap'
      ? '/api/purchasing/suppliers'
      : '/api/sales/customers';

    axiosInstance.get(partyEndpoint, { params: { per_page: 1000 } }).then((res) => {
      const list = res.data.suppliers || res.data.customers || res.data || [];
      setParties(list.map((p: any) => ({
        id: p.id,
        name: p.company_name || p.name || `#${p.id}`
      })));
    }).catch(() => setParties([]));
  }, [mode]);

  const [advSuppliers, setAdvSuppliers] = useState<{ id: number; name: string }[]>([]);
  const [advCustomers, setAdvCustomers] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    if (mode !== 'kas') return;
    axiosInstance.get('/api/purchasing/suppliers', { params: { per_page: 1000 } }).then((r) => setAdvSuppliers((r.data.suppliers || []).map((p: any) => ({ id: p.id, name: p.company_name || p.name })))).catch(() => {});
    axiosInstance.get('/api/sales/customers', { params: { per_page: 1000 } }).then((r) => setAdvCustomers((r.data.customers || []).map((p: any) => ({ id: p.id, name: p.company_name || p.name })))).catch(() => {});
  }, [mode]);
  useEffect(() => {
    if (isStandalone || !formData.party_id) { setOpenAdv([]); return; }
    const ptype = mode === 'ap' ? 'supplier' : 'customer';
    axiosInstance.get('/api/finance/advances-summary').then((r) => {
      setOpenAdv((r.data.advances || []).filter((a: any) => a.party_type === ptype && String(a.party_id) === String(formData.party_id) && a.outstanding > 0.005));
    }).catch(() => setOpenAdv([]));
  }, [formData.party_id, mode, isStandalone]);
  const useAdvance = (a: (typeof openAdv)[number]) => {
    // Tanpa faktur yang dicentang, potongan akan jadi uang keluar negatif: centang dulu faktur terbuka (terlama dulu) sampai tertutup.
    let nextAlloc = alloc;
    const hasChecked = invoices.some((i) => i.id in alloc);
    if (!hasChecked) {
      nextAlloc = Object.fromEntries(invoices.map((i) => [i.id, '0']));
      setAlloc(nextAlloc);
    }
    const open = invoices.filter((i) => i.id in nextAlloc).reduce((s2, i) => s2 + i.balance_due - (Number(nextAlloc[i.id]) || 0), 0);
    const already = adj.reduce((s2, l) => s2 + (Number(l.amount) || 0), 0);
    const used = adj.filter((x) => Number(x.account_id) === a.account_id).reduce((s2, x) => s2 + (Number(x.amount) || 0), 0);
    const amt = Math.max(0, Math.min(a.outstanding - used, open - already));
    const refs = Array.from(new Set(a.entries.filter((e) => e.amount > 0).map((e) => e.payment_number))).join(', ');
    if (amt <= 0) { toast.error('Tidak ada sisa tagihan yang bisa ditutup dengan uang muka ini.'); return; }
    setAdj((x) => [...x, { account_id: String(a.account_id), amount: String(amt), description: `Pemakaian uang muka${refs ? ' ' + refs : ''}` }]);
  };
  const isAdvanceAccount = (id: string) => /uang\s*muka|panjar|deposit/i.test(accName(id));

  useEffect(() => {
    axiosInstance.get('/api/finance/chart-of-accounts').then((res) => {
      const all = res.data.accounts || [];
      setCashBankAccounts(all.filter((a: any) => a.is_cash_bank && !a.is_header).map((a: any) => ({ id: a.id, code: a.code, name: a.name, currency: a.currency || 'IDR', bank_name: a.bank_name, account_number: a.account_number })));
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
      .then((res) => {
        let list: UnpaidInvoice[] = res.data.invoices || [];
        const old = editAllocRef.current;
        if (old) {
          // Ubah: saldo yang dipegang transaksi lama dianggap tersedia lagi.
          list = list.map((i) => {
            const o = old.find((x) => x.invoice_id === i.id);
            return o ? { ...i, balance_due: i.balance_due + o.amount + (o.discount || 0) } : i;
          });
          old.forEach((o) => {
            if (!list.some((i) => i.id === o.invoice_id)) {
              list.push({ id: o.invoice_id, invoice_number: o.invoice_number || `#${o.invoice_id}`, due_date: null, total_amount: o.invoice_total_amount || o.amount, balance_due: o.amount + (o.discount || 0) });
            }
          });
          setAlloc(Object.fromEntries(old.map((o) => [o.invoice_id, String(o.amount)])));
          editAllocRef.current = null;
        }
        setInvoices(list);
      })
      .catch(() => setInvoices([]))
      .finally(() => setLoadingInvoices(false));
    if (!editAllocRef.current) setAlloc({});
  }, [formData.party_id, mode]);

  useEffect(() => {
    if (editId) return;
    const t = mode === 'ar' || (mode === 'kas' && cashDirection === 'in') ? 'receipt' : 'payment';
    axiosInstance.get(`/api/finance/payments/next-number?type=${t}`)
      .then((res) => setNextNumber(res.data.next_number || ''))
      .catch(() => setNextNumber(''));
  }, [mode, cashDirection, editId]);

  useEffect(() => {
    if (!editId) return;
    axiosInstance.get(`/api/finance/payments/${editId}`).then((res) => {
      const d = res.data;
      if (d.allocations?.length) {
        let pool = d.lines?.length ? -d.lines.reduce((x: number, l: any) => x + Math.min(0, Number(l.amount) || 0), 0) : 0;
        editAllocRef.current = d.allocations.map((a: any) => {
          const cut = Math.max(0, Math.min(a.amount, pool)); pool -= cut;
          return { ...a, amount: a.amount - cut, discount: cut };
        });
      }
      setFormData({
        party_id: String(d.customer_id || d.supplier_id || ''),
        payment_date: (d.payment_date || '').slice(0, 10),
        payment_method: d.payment_method || 'bank_transfer',
        reference_number: d.reference_number || '',
        notes: d.notes || '',
        paid_to: d.paid_to || '',
        bank_account_id: d.bank_account_id ? String(d.bank_account_id) : '',
      });
      if (d.lines?.length && d.allocations?.length) {
        setAdj(d.lines.map((l: any) => ({ account_id: String(l.account_id), amount: String(-Number(l.amount)), description: l.description || '' })));
      } else if (d.lines?.length) {
        setLines(d.lines.map((l: any) => ({ account_id: String(l.account_id), amount: String(l.amount), description: l.description || '', party_type: l.party_type || '', party_id: l.party_id ? String(l.party_id) : '' })));
      }
    }).catch(() => setError('Gagal memuat transaksi yang akan diubah.'));
  }, [editId]);

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

  const [distributeAmount, setDistributeAmount] = useDraftState('distributeAmount', '');
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

  const updateLine = (idx: number, patch: Partial<{ account_id: string; amount: string; description: string; party_type: string; party_id: string }>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const paidOf = (i: { total_amount: number; balance_due: number }) => Math.max(0, i.total_amount - i.balance_due);
  const overAllocated = invoices.filter((i) => {
    const n = Number(effAlloc[i.id]) || 0;
    return n > i.balance_due + 0.01 || (n < 0 && -n > paidOf(i) + 0.01);
  });
  const bankName = cashBankAccounts.find((a) => a.id === Number(formData.bank_account_id));
  const bankCurrency = (bankName?.currency || 'IDR').toUpperCase();
  const [fxRate, setFxRate] = useState('');
  useEffect(() => {
    if (bankCurrency === 'IDR') { setFxRate(''); return; }
    axiosInstance.get('/api/purchasing/exchange-rate', { params: { currency: bankCurrency } })
      .then((r) => { if (r.data?.rate) setFxRate((cur) => cur || String(r.data.rate)); }).catch(() => {});
  }, [bankCurrency]);
  const accName = (id: string) => {
    const a = contraAccounts.find((c) => c.id === Number(id));
    return a ? `${a.code} - ${a.name}` : '(akun belum dipilih)';
  };
  const isReceiptKind = mode === 'ar' || (mode === 'kas' && cashDirection === 'in');
  const bankLabel = bankName ? `${bankName.code} - ${bankName.name}` : '(Kas/Bank belum dipilih)';
  const hasDetail = isStandalone
    ? lines.some((l) => Number(l.amount) !== 0)
    : Object.values(effAlloc).some((v) => Number(v) !== 0);
  const journalPreview: { account: string; debit: number; credit: number }[] = [];
  if (hasDetail) {
    const bankIn = totalAmount > 0 ? isReceiptKind : !isReceiptKind;
    const bankLine = totalAmount === 0 ? null : { account: bankLabel, debit: bankIn ? Math.abs(totalAmount) : 0, credit: bankIn ? 0 : Math.abs(totalAmount) };
    const detail = isStandalone
      ? lines.filter((l) => Number(l.amount) !== 0).map((l) => {
          const n = Number(l.amount);
          const onDebit = isReceiptKind ? n < 0 : n > 0;
          return { account: accName(l.account_id), debit: onDebit ? Math.abs(n) : 0, credit: onDebit ? 0 : Math.abs(n) };
        })
      : invoices.filter((i) => Number(effAlloc[i.id]) !== 0 && effAlloc[i.id] !== undefined).map((i) => {
          const n = Number(effAlloc[i.id]);
          const onDebit = mode === 'ap' ? n > 0 : n < 0;
          return { account: `${mode === 'ar' ? 'Piutang Usaha' : 'Hutang Usaha'} — ${i.invoice_number}`, debit: onDebit ? Math.abs(n) : 0, credit: onDebit ? 0 : Math.abs(n) };
        });
    if (!isStandalone) {
      adj.filter((l) => Number(l.amount) !== 0).forEach((l) => {
        const n = -Number(l.amount);
        const onDebit = isReceiptKind ? n < 0 : n > 0;
        detail.push({ account: accName(l.account_id), debit: onDebit ? Math.abs(n) : 0, credit: onDebit ? 0 : Math.abs(n) });
      });
    }
    if (isReceiptKind) journalPreview.push(...(bankLine ? [bankLine] : []), ...detail);
    else journalPreview.push(...detail, ...(bankLine ? [bankLine] : []));
  }
  const canSubmit = hasDetail && overAllocated.length === 0 && !!formData.bank_account_id && !!formData.payment_date;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null);
    const fail = (msg: string) => { setError(msg); toast.error(msg); window.scrollTo({ top: 0, behavior: 'smooth' }) }

    const allocations = Object.entries(effAlloc)
      .filter(([, v]) => Number(v) !== 0)
      .map(([id, v]) => ({ invoice_id: Number(id), amount: Number(v) }));
    const cleanLines = lines
      .filter((l) => l.account_id || Number(l.amount))
      .map((l) => ({ account_id: Number(l.account_id), amount: Number(l.amount), description: l.description || undefined,
        party_type: l.party_id ? (l.party_type || 'supplier') : undefined, party_id: l.party_id ? Number(l.party_id) : undefined }));

    if (!isStandalone && allocations.length === 0) {
      fail('Centang minimal satu faktur yang akan dilunasi.');
      return;
    }
    const cleanAdj = adj.filter((l) => l.account_id || Number(l.amount))
      .map((l) => ({ account_id: Number(l.account_id), amount: -Number(l.amount), description: l.description || undefined }));
    for (const a of openAdv) {
      const used = adj.filter((x) => Number(x.account_id) === a.account_id).reduce((s2, x) => s2 + (Number(x.amount) || 0), 0);
      if (used > a.outstanding + 0.01) { fail(`Pemakaian uang muka ${a.account_code} (${rp(used)}) melebihi sisanya (${rp(a.outstanding)}).`); return; }
    }
    if (!isStandalone && cleanAdj.some((l) => !l.account_id || !l.amount)) {
      fail('Setiap baris selisih harus punya akun dan nilai tidak sama dengan 0.');
      return;
    }
    if (isStandalone && (cleanLines.length === 0 || cleanLines.some((l) => !l.account_id || !l.amount))) {
      fail('Setiap baris rincian harus punya akun dan nilai tidak sama dengan 0 (boleh negatif untuk pengurang).');
      return;
    }
    if (!formData.bank_account_id) {
      fail('Pilih akun Kas/Bank.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axiosInstance.post('/api/finance/payments', {
        payment_number: (paymentNumber.trim() && !(paymentNumber.trim() === nextNumber && !numberTouched.current)) ? paymentNumber.trim() : undefined,
        replace_payment_id: editId ? Number(editId) : undefined,
        payment_date: formData.payment_date,
        payment_type: paymentType === 'supplier' ? 'payment' : 'receipt',
        allocations: isStandalone ? undefined : allocations,
        lines: isStandalone ? cleanLines : undefined,
        adjustments: !isStandalone && cleanAdj.length ? cleanAdj : undefined,
        supplier_id: !isStandalone && paymentType === 'supplier' ? Number(formData.party_id) : undefined,
        customer_id: !isStandalone && paymentType === 'customer' ? Number(formData.party_id) : undefined,
        payment_method: formData.payment_method,
        amount: totalAmount,
        reference_number: formData.reference_number || undefined,
        notes: formData.notes || undefined,
        paid_to: isStandalone ? (formData.paid_to.trim() || undefined) : undefined,
        bank_account_id: Number(formData.bank_account_id),
        exchange_rate: bankCurrency !== 'IDR' && isStandalone && fxRate ? Number(fxRate) : undefined,
      });
      await uploadAttachments('payment', res.data?.payment_id, attFiles);
      navigate(res.data?.payment_id ? `/app/finance/payments/${res.data.payment_id}` : '/app/finance/pembayaran');
    } catch (err: any) {
      fail(err.response?.data?.error || 'Gagal menyimpan pembayaran. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  const handleCancel = () => {
    navigate(isStandalone ? (cashDirection === 'in' ? '/app/finance/penerimaan' : '/app/finance/pembayaran') : (mode === 'ap' ? '/app/accounting/payable' : '/app/accounting/receivable'))
  }


  const inputCls = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white'
  const labelCls = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200'
  const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
  const partyWord = mode === 'ap' ? 'Pemasok' : 'Pelanggan'
  const checkedCount = Object.keys(effAlloc).filter((k) => Number(effAlloc[Number(k)]) !== 0).length
  const reason = !canSubmit && !submitting
    ? (!formData.bank_account_id ? 'Pilih akun kas/bank dulu.' : !hasDetail ? (isStandalone ? 'Isi nilai rincian akun.' : 'Centang faktur yang dilunasi.') : overAllocated.length > 0 ? 'Nilai melebihi sisa tagihan.' : !formData.payment_date ? 'Isi tanggal.' : '')
    : ''

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title={`${editId ? 'Ubah ' : ''}${FORM_TITLES[effectiveKind][0]}`}
        subtitle={FORM_TITLES[effectiveKind][1]}
        actions={<button type="button" onClick={handleCancel} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">Batal</button>}
      />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
<div className="lg:col-span-full"><PendingAttachments files={attFiles} onChange={setAttFiles} entityType="payment" entityId={editId || undefined} /></div>
        <div className="min-w-0 space-y-4">
          <Panel title={isStandalone ? 'Data transaksi' : `${partyWord} dan tanggal`}>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              {!isStandalone && (
                <div className="md:col-span-2">
                  <label className={labelCls}>{partyWord}</label>
                  <SearchableSelect
                    options={parties.map((p) => ({ id: p.id, name: p.name }))}
                    value={formData.party_id ? Number(formData.party_id) : null}
                    onChange={(v) => setFormData({ ...formData, party_id: v ? String(v) : '' })}
                    placeholder={`Pilih ${partyWord.toLowerCase()}`}
                    required
                  />
                </div>
              )}
              <div>
                <label className={labelCls}>Tanggal</label>
                <input type="date" className={inputCls} value={formData.payment_date} onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })} required />
              </div>
              <div>
                <label className={labelCls}>No. bukti</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder={editId ? 'Nomor lama dipertahankan' : (nextNumber ? `${nextNumber} (otomatis)` : 'Otomatis')}
                  value={paymentNumber}
                  onChange={(e) => { numberTouched.current = true; setPaymentNumber(e.target.value); }}
                />
                <p className="mt-1 text-xs text-gray-500">Terisi nomor berikutnya secara otomatis; bisa diganti manual.</p>
              </div>
              {isStandalone && (
                <div className="md:col-span-2">
                  <label className={labelCls}>{cashDirection === 'in' ? 'Diterima dari' : 'Dibayarkan kepada'}</label>
                  <input
                    type="text"
                    className={inputCls}
                    maxLength={200}
                    placeholder={cashDirection === 'in' ? 'Nama pemberi (opsional)' : 'Nama penerima pembayaran (opsional)'}
                    value={formData.paid_to}
                    onChange={(e) => setFormData({ ...formData, paid_to: e.target.value })}
                  />
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Rekening dan metode">
            <div className="grid gap-4 p-4 md:grid-cols-3">
              <div className="md:col-span-1">
                <label className={labelCls}>Akun kas/bank</label>
                <SearchableSelect
                  options={cashBankAccounts.map((acc) => ({ id: acc.id, code: acc.code, name: acc.name }))}
                  value={formData.bank_account_id ? Number(formData.bank_account_id) : null}
                  onChange={(v) => setFormData({ ...formData, bank_account_id: v ? String(v) : '' })}
                  placeholder="Pilih akun"
                  required
                />
              </div>
              {bankCurrency !== 'IDR' && (
                <div className="md:col-span-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
                  <p className="mb-2">Akun ini bermata uang <strong>{bankCurrency}</strong>. {isStandalone ? `Nilai rincian diisi dalam ${bankCurrency}; jurnal dibukukan dalam Rupiah dengan kurs di bawah.` : `Hanya faktur ${bankCurrency} yang bisa dibayar dari akun ini.`}</p>
                  {isStandalone && (
                    <label className="flex items-center gap-2">Kurs 1 {bankCurrency} =
                      <NumberInput className={`${inputCls} w-40 text-right`} value={fxRate} onChange={(e) => setFxRate(e.target.value)} />
                      Rupiah
                    </label>
                  )}
                </div>
              )}
              <div>
                <label className={labelCls}>Metode</label>
                <select className={inputCls} value={formData.payment_method} onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })} required>
                  <option value="cash">Tunai</option>
                  <option value="bank_transfer">Transfer bank</option>
                  <option value="check">Cek / giro</option>
                  <option value="credit_card">Kartu kredit</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>No. referensi</label>
                <input type="text" className={inputCls} placeholder="No. transfer atau cek (opsional)" value={formData.reference_number} onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })} />
              </div>
            </div>
          </Panel>

          {!isStandalone && formData.party_id && (
            <Panel
              title="Faktur yang dilunasi"
              action={
                <button type="button" className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400" onClick={() => setAlloc(Object.fromEntries(invoices.map((i) => [i.id, String(i.balance_due)])))}>
                  Lunasi semua
                </button>
              }
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-3 dark:border-gray-700">
                <NumberInput currency className={`${inputCls} !w-52`} placeholder="Nilai pembayaran" value={distributeAmount} onChange={(e) => setDistributeAmount(e.target.value)} />
                <button type="button" className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200" onClick={distribute}>
                  Bagikan ke faktur terlama
                </button>
              </div>
              {loadingInvoices && <p className="p-4 text-sm text-gray-500">Memuat faktur...</p>}
              {!loadingInvoices && invoices.length === 0 && (
                <p className="p-4 text-sm text-gray-500">Tidak ada faktur belum lunas untuk {partyWord.toLowerCase()} ini.</p>
              )}
              {invoices.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                      <tr>
                        <th className="w-10 px-3 py-2"></th>
                        <th className="px-3 py-2">No. faktur</th>
                        <th className="px-3 py-2">Jatuh tempo</th>
                        <th className="px-3 py-2 text-right">Sisa tagihan</th>
                        <th className="w-44 px-3 py-2 text-right">Dibayar</th>
                        <th className="px-3 py-2 text-right">Diskon</th>
                        <th className="px-3 py-2 text-right">Sisa setelah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {invoices.map((inv) => {
                        const checked = inv.id in alloc;
                        return (
                          <tr key={inv.id} className={checked ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}>
                            <td className="px-3 py-2"><input type="checkbox" checked={checked} onChange={(e) => toggleInvoice(inv, e.target.checked)} /></td>
                            <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900 dark:text-white">
                              <a href={`/app/${mode === 'ap' ? 'purchasing' : 'finance'}/invoices/${inv.id}`} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline dark:text-blue-400" title="Buka faktur di tab baru">{inv.invoice_number}</a>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">{inv.due_date || '-'}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{rp(inv.balance_due)}</td>
                            <td className="px-3 py-2">
                              <NumberInput className={`${inputCls} text-right`} disabled={!checked} value={alloc[inv.id] ?? ''} onChange={(e) => setAlloc((a) => ({ ...a, [inv.id]: e.target.value }))} />
                              {(Number(effAlloc[inv.id]) || 0) > inv.balance_due + 0.01 && <p className="mt-1 text-xs text-red-600">Dibayar + diskon melebihi sisa faktur</p>}
                              {(Number(alloc[inv.id]) || 0) < 0 && -(Number(alloc[inv.id]) || 0) > paidOf(inv) + 0.01 && <p className="mt-1 text-xs text-red-600">Melebihi yang sudah dibayar</p>}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{discOf[inv.id] ? rp(discOf[inv.id]) : '-'}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{rp(inv.balance_due - (Number(effAlloc[inv.id]) || 0))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}

          {!isStandalone && formData.party_id && (
            <Panel title="Informasi diskon / potongan (opsional)">
              <div className="space-y-2 p-4">
                <p className="text-xs text-gray-500">
                  Isi nilai potongan (positif) yang ikut melunasi faktur tanpa uang keluar dari kas/bank, misalnya diskon, pembulatan, atau uang muka. Kolom Dibayar di faktur adalah uang yang benar-benar keluar dari kas/bank; kolom Diskon adalah total potongan di sini.
                </p>
                {openAdv.length > 0 && (
                  <div className="rounded-md bg-amber-50 p-3 text-sm dark:bg-amber-900/20">
                    <p className="mb-1 font-medium text-amber-900 dark:text-amber-100">Uang muka lainnya yang masih menggantung untuk {partyWord.toLowerCase()} ini</p>
                    {openAdv.map((a) => {
                      const used = adj.filter((x) => Number(x.account_id) === a.account_id).reduce((s2, x) => s2 + (Number(x.amount) || 0), 0);
                      const left = Math.max(0, a.outstanding - used);
                      return (
                        <div key={a.account_id} className="flex items-center justify-between gap-2 py-0.5">
                          <span>{a.account_code} {a.account_name}: sisa <strong>{rp(a.outstanding)}</strong></span>
                          <button type="button" disabled={left <= 0} className="rounded border border-amber-400 px-2 py-0.5 text-xs hover:bg-amber-100 disabled:opacity-40"
                            onClick={() => useAdvance(a)}>
                            Pakai sebagai potongan
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {adj.map((l, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <div className="col-span-12 md:col-span-5">
                      <SearchableSelect
                        options={[...contraAccounts.map((acc) => ({ id: acc.id, code: acc.code, name: acc.name })), ...openAdv.filter((a) => !contraAccounts.some((c) => c.id === a.account_id)).map((a) => ({ id: a.account_id, code: a.account_code, name: a.account_name }))]}
                        value={l.account_id ? Number(l.account_id) : null}
                        onChange={(v) => updateAdj(idx, { account_id: v ? String(v) : '' })}
                        placeholder="Pilih akun (mis. Biaya Lain-lain, Piutang Karyawan)"
                      />
                    </div>
                    <input type="text" className={`${inputCls} col-span-7 md:col-span-4`} placeholder="Keterangan (opsional)" value={l.description} onChange={(e) => updateAdj(idx, { description: e.target.value })} />
                    {openAdv.some((a) => a.account_id === Number(l.account_id)) && (
                      <p className="col-span-12 -mt-1 text-xs text-emerald-700 dark:text-emerald-400">Pemakaian uang muka {partyWord.toLowerCase()}: sisa uang muka akan berkurang otomatis dan tercatat di Rekap Uang Muka Lainnya.</p>
                    )}
                    <NumberInput currency className={`${inputCls} col-span-4 text-right md:col-span-2`} placeholder="Nilai" value={l.amount} onChange={(e) => updateAdj(idx, { amount: e.target.value })} />
                    <button type="button" className="col-span-1 text-gray-400 hover:text-red-600" onClick={() => setAdj((a) => a.filter((_, i) => i !== idx))} title="Hapus baris">
                      <XMarkIcon className="mx-auto h-5 w-5" />
                    </button>
                  </div>
                ))}
                <button type="button" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400" onClick={() => setAdj((a) => [...a, { account_id: '', amount: '', description: '' }])}>
                  + Tambah baris selisih
                </button>
              </div>
            </Panel>
          )}

          {isStandalone && (
            <Panel title="Rincian akun">
              <div className="space-y-2 p-4">
                <p className="text-xs text-gray-500">Satu nilai kas bisa dibagi ke beberapa akun. Nilai negatif dipakai sebagai pengurang.</p>
                {lines.map((l, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <div className="col-span-12 md:col-span-5">
                      <SearchableSelect
                        options={contraAccounts.map((acc) => ({ id: acc.id, code: acc.code, name: acc.name }))}
                        value={l.account_id ? Number(l.account_id) : null}
                        onChange={(v) => updateLine(idx, { account_id: v ? String(v) : '' })}
                        placeholder="Pilih akun (mis. Beban Bunga)"
                      />
                    </div>
                    <input type="text" className={`${inputCls} col-span-7 md:col-span-4`} placeholder="Keterangan baris (opsional)" value={l.description} onChange={(e) => updateLine(idx, { description: e.target.value })} />
                    <NumberInput currency className={`${inputCls} col-span-4 text-right md:col-span-2`} placeholder="Nilai" value={l.amount} onChange={(e) => updateLine(idx, { amount: e.target.value })} />
                    <button type="button" className="col-span-1 text-gray-400 hover:text-red-600 disabled:opacity-30" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))} title="Hapus baris">
                      <XMarkIcon className="mx-auto h-5 w-5" />
                    </button>
                    {l.account_id && isAdvanceAccount(l.account_id) && (
                      <div className="col-span-12 grid grid-cols-12 gap-2 rounded-md bg-gray-50 p-2 dark:bg-gray-700/40">
                        <select className={`${inputCls} col-span-4 md:col-span-3`} value={l.party_type || 'supplier'} onChange={(e) => updateLine(idx, { party_type: e.target.value, party_id: '' })}>
                          <option value="supplier">Pemasok</option>
                          <option value="customer">Pelanggan</option>
                        </select>
                        <div className="col-span-8 md:col-span-9">
                          <SearchableSelect
                            options={(l.party_type === 'customer' ? advCustomers : advSuppliers).map((p) => ({ id: p.id, name: p.name }))}
                            value={l.party_id ? Number(l.party_id) : null}
                            onChange={(v) => updateLine(idx, { party_id: v ? String(v) : '', party_type: l.party_type || 'supplier' })}
                            placeholder={`Uang muka untuk ${l.party_type === 'customer' ? 'pelanggan' : 'pemasok'} siapa?`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <button type="button" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400" onClick={() => setLines((ls) => [...ls, { account_id: '', amount: '', description: '' }])}>
                  + Tambah baris akun
                </button>
              </div>
            </Panel>
          )}

          <Panel title="Keterangan">
            <div className="p-4">
              <textarea className={inputCls} rows={3} placeholder="Catatan untuk transaksi ini (opsional)" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
            </div>
          </Panel>

          {journalPreview.length > 0 && (
            <Panel title="Pratinjau jurnal">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  <tr><th className="px-4 py-2">Akun</th><th className="px-4 py-2 text-right">Debit</th><th className="px-4 py-2 text-right">Kredit</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {journalPreview.map((j, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2">{j.account}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{j.debit ? rp(j.debit) : ''}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{j.credit ? rp(j.credit) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
        </div>

        <aside className="lg:sticky lg:top-4">
          <Panel title="Ringkasan">
            <dl className="space-y-3 p-4 text-sm">
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">{isReceiptKind ? 'Total diterima' : 'Total dibayar'}</dt>
                <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{rp(totalAmount)}</dd>
              </div>
              {!isStandalone && (
                <>
                  <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">Faktur dipilih</dt><dd className="font-medium">{checkedCount}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">Faktur dilunasi</dt><dd className="font-medium tabular-nums">{rp(allocTotal)}</dd></div>
                  {adjTotal !== 0 && <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">Total diskon/potongan</dt><dd className="font-medium tabular-nums">{rp(-adjTotal)}</dd></div>}
                </>
              )}
              <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Tanggal</dt><dd className="font-medium">{formData.payment_date || '-'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Akun kas/bank</dt><dd className="truncate text-right font-medium">{bankName ? `${bankName.code} ${bankName.name}` : '-'}</dd></div>
            </dl>
            <div className="space-y-2 border-t border-gray-200 p-4 dark:border-gray-700">
              {reason && <p className="text-sm text-amber-700 dark:text-amber-400">{reason}</p>}
              <button type="submit" disabled={submitting || !canSubmit} className="w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
                {submitting ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </Panel>
        </aside>
      </form>
    </div>
  )
}

export default PaymentForm
