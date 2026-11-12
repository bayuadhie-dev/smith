import SearchableSelect from '../../components/SearchableSelect'
import { PageHeader, KpiStrip } from '../../components/ui/PageKit'
import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  ArrowPathIcon,
  BanknotesIcon,
  DocumentTextIcon,
  EyeIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import ChartOfAccounts from './ChartOfAccounts';
import { confirmDialog, showSuccess, showError, showWarning } from '../../components/ui';
import NumberInput from '../../components/ui/NumberInput'

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
  balance: number;
  is_header?: boolean;
  is_active?: boolean;
  description?: string;
  currency?: string;
}

interface JLine {
  account_id: string; debit: number; credit: number; description: string;
  fx_debit?: number; fx_credit?: number; fx_rate?: number;
}

interface JournalEntry {
  id: number;
  entry_number: string;
  entry_date: string;
  description: string;
  reference_number: string | null;
  reference_type: string | null;
  total_debit: number;
  total_credit: number;
  status: string;
  created_by: string;
  kind?: 'normal' | 'reversal' | 'voided';
  document_url?: string | null;
}

interface AccountingManagementProps {
  initialTab?: 'accounts' | 'journal';
  title?: string;
}

const AccountingManagement: React.FC<AccountingManagementProps> = ({ initialTab = 'accounts', title = 'Accounting' }) => {
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'accounts' | 'journal'>(initialTab);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [showVoided, setShowVoided] = useState(false);
  const [journalPage, setJournalPage] = useState(1);
  const [journalPages, setJournalPages] = useState(1);
  const [journalSummary, setJournalSummary] = useState<{ journals: number; total_debit: number; hidden: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [journalDetail, setJournalDetail] = useState<any | null>(null);
  const [loadingJournalDetail, setLoadingJournalDetail] = useState(false);
  const [showAddJournalModal, setShowAddJournalModal] = useState(false);
  const [editingJournalId, setEditingJournalId] = useState<number | null>(null);
  const [fxRates, setFxRates] = useState<Record<string, number>>({});
  const [sourceFilter, setSourceFilter] = useState('');
  const [journalSort, setJournalSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'entry_date', dir: 'desc' });
  const [journalFormData, setJournalFormData] = useState<{ entry_date: string; description: string; reference_number: string; lines: JLine[] }>({
    entry_date: new Date().toISOString().split('T')[0],
    description: '',
    reference_number: '',
    lines: [
      { account_id: '', debit: 0, credit: 0, description: '' },
      { account_id: '', debit: 0, credit: 0, description: '' }
    ]
  });

  useEffect(() => {
    loadData();
  }, [activeTab, showVoided, journalPage, journalSort, sourceFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'accounts') {
        const response = await axiosInstance.get('/api/finance/chart-of-accounts');
        setAccounts(response.data?.accounts || []);
      } else {
        const [response, coa] = await Promise.all([
          axiosInstance.get(`/api/finance/accounting/journal-entries?per_page=50&page=${journalPage}&hide_voided=${showVoided ? 0 : 1}&sort=${journalSort.key}&dir=${journalSort.dir}${sourceFilter ? `&source=${sourceFilter}` : ''}`),
          axiosInstance.get('/api/finance/chart-of-accounts').catch(() => null),
        ]);
        setJournalEntries(response.data?.entries || []);
        setJournalPages(response.data?.pages || 1);
        setJournalSummary(response.data?.summary || null);
        setAccounts((coa?.data?.accounts || []).filter((a: Account) => !a.is_header && a.is_active !== false));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      // No mock fallback - showing fake data on API failure risks being
      // mistaken for real figures. Leave the list empty; the empty-state
      // UI (if any) or a toast should communicate the failure honestly.
      if (activeTab === 'accounts') {
        setAccounts([]);
      } else {
        setJournalEntries([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const handleOpenJournalDetail = async (referenceNumber: string) => {
    setLoadingJournalDetail(true);
    try {
      const response = await axiosInstance.get(`/api/finance/accounting/journal-entries/${referenceNumber}`);
      setJournalDetail(response.data);
    } catch (error) {
      console.error('Failed to load journal entry detail:', error);
    } finally {
      setLoadingJournalDetail(false);
    }
  };

  const handleCloseJournalDetail = () => {
    setJournalDetail(null);
  };

  const handleCloseJournalModal = () => {
    setShowAddJournalModal(false);
    setEditingJournalId(null);
    setJournalFormData({
      entry_date: new Date().toISOString().split('T')[0],
      description: '',
      reference_number: '',
      lines: [
        { account_id: '', debit: 0, credit: 0, description: '' },
        { account_id: '', debit: 0, credit: 0, description: '' }
      ]
    });
  };

  const handleEditJournal = async (entry: JournalEntry) => {
    try {
      const res = await axiosInstance.get(`/api/finance/accounting/journal-entries/${entry.entry_number}`);
      const d = res.data;
      setJournalFormData({
        entry_date: d.entry_date || entry.entry_date,
        description: d.description || '',
        reference_number: d.reference_number || '',
        lines: (d.lines || []).map((l: any) => ({
          ...(() => {
            const m = /\s*\[FX ([A-Z]{3}) ([0-9.]+) @ ([0-9.]+)\]$/.exec(l.description || '');
            const debit = Number(l.debit_amount) || 0; const credit = Number(l.credit_amount) || 0;
            const base = { account_id: String(l.account_id), debit, credit, description: (l.description || '').replace(/\s*\[FX [A-Z]{3} [0-9.]+ @ [0-9.]+\]$/, '') };
            if (!m) return base;
            const amt = Number(m[2]); const rate = Number(m[3]);
            return { ...base, fx_rate: rate, fx_debit: debit ? amt : undefined, fx_credit: credit ? amt : undefined };
          })(),
        })),
      });
      setEditingJournalId(entry.id);
      setShowAddJournalModal(true);
    } catch {
      showError('Gagal memuat jurnal untuk diubah');
    }
  };

  const handleDeleteJournal = async (entry: JournalEntry) => {
    if (await confirmDialog(`Hapus jurnal manual ini?\n\nTanggal: ${new Date(entry.entry_date).toLocaleDateString('id-ID')}\nDeskripsi: ${entry.description}\n\nSemua baris dalam jurnal ini (debit dan kredit) akan ikut terhapus.`)) {
      try {
        // Reuses the same DELETE endpoint GeneralLedger.tsx uses (both
        // pages show the same AccountingEntry data, just grouped
        // differently) - built 2026-08-17, only allows deleting
        // reference_type=='manual_journal' entries.
        await axiosInstance.delete(`/api/finance/general-ledger/${entry.id}`);
        loadData();
      } catch (error: any) {
        console.error('Error deleting journal entry:', error);
        showError(error.response?.data?.error || 'Gagal menghapus jurnal. Silakan coba lagi.');
      }
    }
  };

  const handleSubmitJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate balanced entry
    const totalDebit = journalFormData.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = journalFormData.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      showWarning(`Entry is not balanced!\nTotal Debit: ${formatRupiah(totalDebit)}\nTotal Credit: ${formatRupiah(totalCredit)}\nDifference: ${formatRupiah(Math.abs(totalDebit - totalCredit))}`);
      return;
    }

    try {
      // FIX 2026-08-17: POST /finance/accounting/journal-entries never
      // existed in the backend (only GET list + GET detail did) - this
      // form's onSubmit always 404'd. Reusing POST /finance/general-ledger
      // instead (built the same session, same AccountingEntry data, same
      // {account_id, debit, credit, description} line shape this form
      // already produces) rather than building a second near-duplicate
      // endpoint for the same underlying table.
      if (editingJournalId) {
        await axiosInstance.put(`/api/finance/general-ledger/${editingJournalId}`, apiJournal());
        showSuccess('Jurnal manual diperbarui');
      } else {
        await axiosInstance.post('/api/finance/general-ledger', apiJournal());
        showSuccess('Journal entry created successfully!');
      }
      handleCloseJournalModal();
      loadData();
    } catch (error: any) {
      console.error('Error creating journal entry:', error);
      showError(error.response?.data?.error || 'Failed to create journal entry. Please try again.');
    }
  };

  const currencyOfAccount = (accountId: string) =>
    ((accounts.find((a) => String(a.id) === String(accountId))?.currency || 'IDR') as string).toUpperCase();

  const ensureRate = (cur: string) => {
    if (cur === 'IDR' || fxRates[cur]) return;
    axiosInstance.get('/api/purchasing/exchange-rate', { params: { currency: cur } })
      .then((r) => { if (r.data?.rate) setFxRates((m) => ({ ...m, [cur]: Number(r.data.rate) })); })
      .catch(() => undefined);
  };

  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

  const apiJournal = () => ({
    ...journalFormData,
    lines: journalFormData.lines.map((l) => {
      const cur = currencyOfAccount(l.account_id);
      const fx = cur !== 'IDR' && l.fx_rate && (l.fx_debit || l.fx_credit);
      const amt = (l.fx_debit || 0) || (l.fx_credit || 0);
      return {
        account_id: l.account_id, debit: l.debit, credit: l.credit,
        description: fx ? `${(l.description || '').trim()} [FX ${cur} ${amt} @ ${l.fx_rate}]`.trim() : l.description,
      };
    }),
  });

  const toggleSort = (key: string) => {
    setJournalPage(1);
    setJournalSort((cur) => (cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'entry_date' || key === 'total_debit' ? 'desc' : 'asc' }));
  };

  const sortTh = (label: string, key: string, align: 'left' | 'right' | 'center' = 'left') => (
    <th
      onClick={() => toggleSort(key)}
      className={`px-6 py-3 text-${align} text-xs font-medium text-gray-500 dark:text-gray-400 tracking-wide cursor-pointer select-none hover:text-gray-800 dark:hover:text-gray-200`}
      title="Klik untuk mengurutkan"
    >
      {label} <span className="text-[10px]">{journalSort.key === key ? (journalSort.dir === 'asc' ? '▲' : '▼') : ''}</span>
    </th>
  );

  const addJournalLine = () => {
    setJournalFormData({
      ...journalFormData,
      lines: [...journalFormData.lines, { account_id: '', debit: 0, credit: 0, description: '' }]
    });
  };

  const removeJournalLine = (index: number) => {
    if (journalFormData.lines.length > 2) {
      const newLines = journalFormData.lines.filter((_, i) => i !== index);
      setJournalFormData({ ...journalFormData, lines: newLines });
    }
  };

  const updateJournalLine = (index: number, field: string, value: any) => {
    const newLines = [...journalFormData.lines];
    let line: JLine = { ...newLines[index], [field]: value };
    if (field === 'account_id') {
      const cur = currencyOfAccount(value);
      if (cur !== 'IDR') {
        ensureRate(cur);
        line = { ...line, fx_rate: fxRates[cur] || line.fx_rate, fx_debit: undefined, fx_credit: undefined, debit: 0, credit: 0 };
      } else {
        line = { ...line, fx_rate: undefined, fx_debit: undefined, fx_credit: undefined };
      }
    }
    if (field === 'fx_debit' || field === 'fx_credit' || field === 'fx_rate') {
      const rate = line.fx_rate || 0;
      line = { ...line, debit: round2((line.fx_debit || 0) * rate), credit: round2((line.fx_credit || 0) * rate) };
    }
    newLines[index] = line;
    setJournalFormData({ ...journalFormData, lines: newLines });
  };

  useEffect(() => {
    // kurs hasil unduhan mengisi baris valuta asing yang belum punya kurs
    setJournalFormData((f) => ({
      ...f,
      lines: f.lines.map((l) => {
        const cur = currencyOfAccount(l.account_id);
        if (cur === 'IDR' || l.fx_rate || !fxRates[cur]) return l;
        const rate = fxRates[cur];
        return { ...l, fx_rate: rate, debit: round2((l.fx_debit || 0) * rate), credit: round2((l.fx_credit || 0) * rate) };
      }),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fxRates]);

  const getAccountTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'asset': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'liability': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'equity': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'revenue': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'expense': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'posted': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'draft': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
    }
  };

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = (account.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (account.code || '').includes(searchTerm);
    const matchesFilter = filterType === 'all' || account.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const filteredJournalEntries = journalEntries.filter(entry => {
    const matchesSearch = (entry.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (entry.entry_number || '').includes(searchTerm);
    const matchesFilter = filterType === 'all' || entry.status === filterType;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3">Memuat data akuntansi...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header - accounts tab gets its own full header from the embedded ChartOfAccounts */}
      {activeTab === 'journal' && (
        <PageHeader
          title={title}
          subtitle="Jurnal manual dan jurnal otomatis dari transaksi"
          actions={
            <>
              <button className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700" onClick={loadData} title="Muat ulang">
                <ArrowPathIcon className="h-4 w-4" />
              </button>
              <Link to="/app/imports?kind=manual_journal" className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">Impor</Link>
              <button onClick={() => setShowAddJournalModal(true)} className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">Jurnal baru</button>
            </>
          }
        />
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'accounts'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-300'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            Daftar Akun
          </button>
          <button
            onClick={() => setActiveTab('journal')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'journal'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-300'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            Jurnal
          </button>
        </nav>
      </div>

      {/* Search and FunnelIcon - journal tab only; accounts tab has its own inside ChartOfAccounts */}
      {activeTab === 'journal' && (
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nomor atau deskripsi jurnal"
                className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <select
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">Semua status</option>
              <option value="posted">Terposting</option>
              <option value="draft">Draft</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
            <select
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={sourceFilter}
              onChange={(e) => { setSourceFilter(e.target.value); setJournalPage(1); }}
              title="Jurnal manual = diinput langsung, otomatis = dibuat dari transaksi"
            >
              <option value="">Semua sumber</option>
              <option value="manual">Jurnal input langsung</option>
              <option value="auto">Jurnal otomatis</option>
            </select>
            <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 ml-3">
              <input type="checkbox" checked={showVoided} onChange={(e) => { setShowVoided(e.target.checked); setJournalPage(1); }} />
              Tampilkan jurnal pembalik &amp; dibatalkan
            </label>
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === 'accounts' ? (
        <div className="-m-6">
          <ChartOfAccounts />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                {sortTh('No. jurnal', 'entry_number')}
                {sortTh('Tanggal', 'entry_date')}
                {sortTh('Deskripsi', 'description')}
                {sortTh('Total debit', 'total_debit', 'right')}
                {sortTh('Status', 'status', 'center')}
                {sortTh('Dibuat oleh', 'created_by')}
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 tracking-wide">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredJournalEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {entry.entry_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {new Date(entry.entry_date).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {entry.document_url ? (
                      <Link to={entry.document_url} className="text-blue-600 hover:underline dark:text-blue-400" title="Buka transaksi asal jurnal ini">{entry.description}</Link>
                    ) : entry.reference_type === 'manual_journal' ? (
                      <span>{entry.description} <span className="ml-1 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">Jurnal manual</span></span>
                    ) : entry.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right font-medium">
                    {formatRupiah(entry.total_debit)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {entry.kind === 'reversal' ? (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" title="Jurnal pembalik dari transaksi yang dibatalkan">Pembalik (void)</span>
                    ) : entry.kind === 'voided' ? (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300" title="Transaksi ini sudah dibatalkan; dinetralkan oleh jurnal pembalik">Dibatalkan</span>
                    ) : (
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(entry.status)}`}>
                        {entry.status === 'posted' ? 'Terposting' : entry.status === 'draft' ? 'Draft' : entry.status === 'cancelled' ? 'Dibatalkan' : entry.status}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {entry.created_by}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex justify-center items-center space-x-2">
                      <button
                        onClick={() => handleOpenJournalDetail(entry.entry_number)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400"
                        title="Lihat detail"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      {entry.reference_type === 'manual_journal' ? (
                        <>
                        <button
                          onClick={() => handleEditJournal(entry)}
                          className="text-amber-600 hover:text-amber-800 dark:text-amber-400"
                          title="Ubah jurnal manual ini"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteJournal(entry)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400"
                          title="Hapus jurnal manual ini"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                        </>
                      ) : (
                        <span
                          className="text-gray-400 text-xs italic"
                          title="Jurnal otomatis dari transaksi lain - koreksi lewat sumbernya, bukan dari sini"
                        >
                          Otomatis
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {journalPages > 1 && (
            <div className="flex items-center justify-end gap-3 px-6 py-3 text-sm">
              <button type="button" disabled={journalPage <= 1} onClick={() => setJournalPage((p) => p - 1)} className="btn-secondary disabled:opacity-40">Sebelumnya</button>
              <span>Halaman {journalPage} dari {journalPages}</span>
              <button type="button" disabled={journalPage >= journalPages} onClick={() => setJournalPage((p) => p + 1)} className="btn-secondary disabled:opacity-40">Berikutnya</button>
            </div>
          )}
          {filteredJournalEntries.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada jurnal.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'journal' && (
        <KpiStrip
          items={[
            { label: 'Jumlah jurnal', value: (journalSummary ? journalSummary.journals : journalEntries.length).toLocaleString('id-ID') },
            { label: 'Total debit', value: formatRupiah(journalSummary ? journalSummary.total_debit : 0) },
            { label: 'Jurnal pembalik atau batal', value: (journalSummary?.hidden || 0).toLocaleString('id-ID'), hint: 'tidak ikut dihitung' },
          ]}
        />
      )}

      {(journalDetail || loadingJournalDetail) && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {journalDetail ? (
                  journalDetail.document_url ? (
                    <Link to={journalDetail.document_url} onClick={handleCloseJournalDetail} className="text-blue-600 hover:underline dark:text-blue-400" title="Buka halaman transaksi">
                      {journalDetail.reference_number || 'Buka transaksi'} &rarr;
                    </Link>
                  ) : journalDetail.reference_number
                ) : 'Memuat...'}
              </h3>
              <button
                onClick={handleCloseJournalDetail}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-2xl dark:hover:text-white"
              >
                &times;
              </button>
            </div>

            {loadingJournalDetail ? (
              <div className="text-gray-500 text-sm py-8 text-center dark:text-gray-400">Memuat...</div>
            ) : journalDetail && (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4 bg-gray-50 dark:bg-gray-900 rounded-md p-4">
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">No. Jurnal</div>
                    <div className="font-mono font-medium text-gray-900 dark:text-white">{journalDetail.entry_number || String(journalDetail.lines?.[0]?.entry_number || '').replace(/-\d+$/, '')}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Tanggal</div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {journalDetail.entry_date
                        ? new Date(journalDetail.entry_date).toLocaleDateString('id-ID')
                        : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Status</div>
                    <div className="font-medium text-gray-900 dark:text-white">{journalDetail.status}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-gray-500 dark:text-gray-400">Deskripsi</div>
                    <div className="font-medium text-gray-900 dark:text-white">{journalDetail.description}</div>
                    {journalDetail.document_url && (
                      <Link to={journalDetail.document_url} className="mt-1 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">Buka transaksi asal &rarr;</Link>
                    )}
                  </div>
                </div>

                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Rincian Baris Jurnal
                </h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2">#</th>
                      <th className="py-2">Akun</th>
                      <th className="py-2 text-right">Debit</th>
                      <th className="py-2 text-right">Kredit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalDetail.lines.map((line: any, idx: number) => (
                      <tr key={line.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 font-mono text-xs">{idx + 1}</td>
                        <td className="py-2">
                          {line.account_code} - {line.account_name}
                        </td>
                        <td className="py-2 text-right">
                          {line.debit_amount > 0 ? `Rp${line.debit_amount.toLocaleString('id-ID')}` : '-'}
                        </td>
                        <td className="py-2 text-right">
                          {line.credit_amount > 0 ? `Rp${line.credit_amount.toLocaleString('id-ID')}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold text-gray-900 dark:text-white border-t-2 border-gray-300 dark:border-gray-600">
                      <td className="py-2" colSpan={2}>
                        Total
                      </td>
                      <td className="py-2 text-right">
                        Rp{journalDetail.total_debit.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2 text-right">
                        Rp{journalDetail.total_credit.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add Journal Entry Modal */}
      {showAddJournalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{editingJournalId ? 'Ubah Jurnal Manual' : 'Jurnal Baru'}</h3>
              <button 
                onClick={handleCloseJournalModal}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-2xl dark:hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmitJournal} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      Entry Date *
                    </label>
                    <input 
                      type="date" 
                      className="input w-full"
                      value={journalFormData.entry_date}
                      onChange={(e) => setJournalFormData({...journalFormData, entry_date: e.target.value})}
                      required 
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      Reference Number
                    </label>
                    <input 
                      type="text" 
                      className="input w-full"
                      value={journalFormData.reference_number}
                      onChange={(e) => setJournalFormData({...journalFormData, reference_number: e.target.value})}
                      placeholder="e.g., INV-2024-001, PO-123"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Description *
                  </label>
                  <textarea 
                    className="input w-full" 
                    rows={2}
                    value={journalFormData.description}
                    onChange={(e) => setJournalFormData({...journalFormData, description: e.target.value})}
                    placeholder="Brief description of the transaction..."
                    required
                  />
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Journal Lines</h4>
                    <button 
                      type="button"
                      onClick={addJournalLine}
                      className="btn-secondary text-sm"
                    >
                      <PlusIcon className="h-4 w-4 mr-1" />
                      Add Line
                    </button>
                  </div>

                  <div className="space-y-3">
                    {journalFormData.lines.map((line, index) => {
                      const cur = currencyOfAccount(line.account_id);
                      const foreign = cur !== 'IDR';
                      return (
                      <div key={index} className="grid grid-cols-12 gap-2 items-start p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div className="col-span-4">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                            Account *
                          </label>
                          <SearchableSelect
                            options={accounts.map((account: any) => ({ id: account.id, name: `${account.code} - ${account.name}` }))}
                            value={line.account_id ? Number(line.account_id) : null}
                            onChange={(v: any) => updateJournalLine(index, 'account_id', v ? String(v) : '')}
                            placeholder="Cari akun (kode atau nama)"
                          />
                        </div>

                        <div className="col-span-3">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                            Debit ({foreign ? cur : 'IDR'})
                          </label>
                          <NumberInput 
                            className="input w-full text-sm"
                            value={(foreign ? line.fx_debit : line.debit) || ''}
                            onChange={(e) => updateJournalLine(index, foreign ? 'fx_debit' : 'debit', parseFloat(e.target.value) || 0)}
                            decimals={2}
                            min="0"
                          />
                        </div>

                        <div className="col-span-3">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                            Credit ({foreign ? cur : 'IDR'})
                          </label>
                          <NumberInput 
                            className="input w-full text-sm"
                            value={(foreign ? line.fx_credit : line.credit) || ''}
                            onChange={(e) => updateJournalLine(index, foreign ? 'fx_credit' : 'credit', parseFloat(e.target.value) || 0)}
                            decimals={2}
                            min="0"
                          />
                        </div>

                        <div className="col-span-2 flex items-end">
                          {journalFormData.lines.length > 2 && (
                            <button 
                              type="button"
                              onClick={() => removeJournalLine(index)}
                              className="w-full px-2 py-2 text-red-600 hover:bg-red-50 rounded text-sm dark:text-red-400"
                            >
                              <TrashIcon className="h-4 w-4 mx-auto" />
                            </button>
                          )}
                        </div>

                        {foreign && (
                          <div className="col-span-12 flex flex-wrap items-center gap-3 text-sm">
                            <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Kurs (Rp per {cur})</label>
                            <NumberInput className="input w-40 text-sm" value={line.fx_rate || ''} decimals={4} min="0"
                              onChange={(e) => updateJournalLine(index, 'fx_rate', parseFloat(e.target.value) || 0)} />
                            <span className="text-gray-600 dark:text-gray-300">
                              Setara {line.debit ? `debit ${formatRupiah(line.debit)}` : line.credit ? `kredit ${formatRupiah(line.credit)}` : 'Rp 0'}
                            </span>
                          </div>
                        )}

                        <div className="col-span-12">
                          <input 
                            type="text" 
                            className="input w-full text-sm"
                            value={line.description}
                            onChange={(e) => updateJournalLine(index, 'description', e.target.value)}
                            placeholder="Line description (optional)"
                          />
                        </div>
                      </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 p-4 bg-blue-50 rounded-lg dark:bg-blue-900/20">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 dark:text-gray-300">Total Debit:</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatRupiah(journalFormData.lines.reduce((sum, line) => sum + (line.debit || 0), 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-300">Total Credit:</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatRupiah(journalFormData.lines.reduce((sum, line) => sum + (line.credit || 0), 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-300">Difference:</p>
                        <p className={`text-lg font-bold ${
                          Math.abs(journalFormData.lines.reduce((sum, line) => sum + (line.debit || 0), 0) - 
                          journalFormData.lines.reduce((sum, line) => sum + (line.credit || 0), 0)) < 0.01 
                          ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {formatRupiah(Math.abs(
                            journalFormData.lines.reduce((sum, line) => sum + (line.debit || 0), 0) - 
                            journalFormData.lines.reduce((sum, line) => sum + (line.credit || 0), 0)
                          ))}
                        </p>
                      </div>
                    </div>
                    {Math.abs(journalFormData.lines.reduce((sum, line) => sum + (line.debit || 0), 0) - 
                      journalFormData.lines.reduce((sum, line) => sum + (line.credit || 0), 0)) >= 0.01 && (
                      <p className="text-red-600 text-sm mt-2 dark:text-red-400">⚠️ Entry must be balanced before posting</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 p-6 border-t bg-gray-50 dark:bg-gray-900">
                <button 
                  type="button"
                  onClick={handleCloseJournalModal}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingJournalId ? 'Simpan Perubahan' : 'Simpan Jurnal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountingManagement;
