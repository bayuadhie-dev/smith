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
import ChartOfAccounts from './ChartOfAccounts';

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
  balance: number;
  is_header?: boolean;
  is_active?: boolean;
  description?: string;
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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [journalDetail, setJournalDetail] = useState<any | null>(null);
  const [loadingJournalDetail, setLoadingJournalDetail] = useState(false);
  const [showAddJournalModal, setShowAddJournalModal] = useState(false);
  const [journalFormData, setJournalFormData] = useState({
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
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'accounts') {
        const response = await axiosInstance.get('/api/finance/chart-of-accounts');
        setAccounts(response.data?.accounts || []);
      } else {
        const response = await axiosInstance.get('/api/finance/accounting/journal-entries');
        setJournalEntries(response.data?.entries || []);
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

  const handleDeleteJournal = async (entry: JournalEntry) => {
    if (window.confirm(`Hapus jurnal manual ini?\n\nTanggal: ${new Date(entry.entry_date).toLocaleDateString('id-ID')}\nDeskripsi: ${entry.description}\n\nSemua baris dalam jurnal ini (debit dan kredit) akan ikut terhapus.`)) {
      try {
        // Reuses the same DELETE endpoint GeneralLedger.tsx uses (both
        // pages show the same AccountingEntry data, just grouped
        // differently) - built 2026-08-17, only allows deleting
        // reference_type=='manual_journal' entries.
        await axiosInstance.delete(`/api/finance/general-ledger/${entry.id}`);
        loadData();
      } catch (error: any) {
        console.error('Error deleting journal entry:', error);
        alert(error.response?.data?.error || 'Gagal menghapus jurnal. Silakan coba lagi.');
      }
    }
  };

  const handleSubmitJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate balanced entry
    const totalDebit = journalFormData.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = journalFormData.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    
    if (totalDebit !== totalCredit) {
      alert(`Entry is not balanced!\nTotal Debit: ${formatRupiah(totalDebit)}\nTotal Credit: ${formatRupiah(totalCredit)}\nDifference: ${formatRupiah(Math.abs(totalDebit - totalCredit))}`);
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
      await axiosInstance.post('/api/finance/general-ledger', journalFormData);
      alert('Journal entry created successfully!');
      handleCloseJournalModal();
      loadData();
    } catch (error: any) {
      console.error('Error creating journal entry:', error);
      alert(error.response?.data?.error || 'Failed to create journal entry. Please try again.');
    }
  };

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
    newLines[index] = { ...newLines[index], [field]: value };
    setJournalFormData({ ...journalFormData, lines: newLines });
  };

  const getAccountTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'asset': return 'bg-blue-100 text-blue-800';
      case 'liability': return 'bg-red-100 text-red-800';
      case 'equity': return 'bg-green-100 text-green-800';
      case 'revenue': return 'bg-purple-100 text-purple-800';
      case 'expense': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'posted': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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
        <span className="ml-3">Loading accounting data...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header - accounts tab gets its own full header from the embedded ChartOfAccounts */}
      {activeTab === 'journal' && (
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Manage chart of accounts and journal entries</p>
        </div>
        {activeTab === 'journal' && (
          <div className="flex space-x-3">
            <button className="btn-secondary">
              <ArrowPathIcon className="h-4 w-4 mr-2" />
            </button>
            <button
              onClick={() => setShowAddJournalModal(true)}
              className="btn-primary"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              New Entry
            </button>
          </div>
        )}
      </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'accounts'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <BanknotesIcon className="h-5 w-5 inline mr-2" />
            Chart of Accounts
          </button>
          <button
            onClick={() => setActiveTab('journal')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'journal'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <DocumentTextIcon className="h-5 w-5 inline mr-2" />
            Journal Entries
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
                placeholder="Search journal entries..."
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
              <option value="all">All {t('common.status')}</option>
              <option value="posted">Posted</option>
              <option value="draft">Draft</option>
              <option value="cancelled">Cancelled</option>
            </select>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Entry Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.date')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.description')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.status')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created By
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.actions')}</th>
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
                    {entry.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right font-medium">
                    {formatRupiah(entry.total_debit)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(entry.status)}`}>
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {entry.created_by}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex justify-center items-center space-x-2">
                      <button
                        onClick={() => handleOpenJournalDetail(entry.entry_number)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Lihat detail"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      {entry.reference_type === 'manual_journal' ? (
                        <button
                          onClick={() => handleDeleteJournal(entry)}
                          className="text-red-600 hover:text-red-900"
                          title="Hapus jurnal manual ini"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
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
          
          {filteredJournalEntries.length === 0 && (
            <div className="text-center py-8">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No journal entries found</p>
            </div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-lg">
              <BanknotesIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Assets</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatRupiah(accounts.filter(a => a.type === 'asset').reduce((sum, a) => sum + a.balance, 0))}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-red-100 p-3 rounded-lg">
              <BanknotesIcon className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Liabilities</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatRupiah(accounts.filter(a => a.type === 'liability').reduce((sum, a) => sum + a.balance, 0))}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-lg">
              <BanknotesIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Equity</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatRupiah(accounts.filter(a => a.type === 'equity').reduce((sum, a) => sum + a.balance, 0))}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-purple-100 p-3 rounded-lg">
              <DocumentTextIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Journal Entries</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{journalEntries.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{journalEntries.filter(e => e.status === 'posted').length} posted</p>
            </div>
          </div>
        </div>
      </div>

      {(journalDetail || loadingJournalDetail) && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {journalDetail ? journalDetail.reference_number : 'Memuat...'}
              </h3>
              <button
                onClick={handleCloseJournalDetail}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-2xl"
              >
                &times;
              </button>
            </div>

            {loadingJournalDetail ? (
              <div className="text-gray-500 text-sm py-8 text-center">Memuat...</div>
            ) : journalDetail && (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4 bg-gray-50 dark:bg-gray-900 rounded-md p-4">
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
                  </div>
                </div>

                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Rincian Baris Jurnal
                </h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2">No. Baris</th>
                      <th className="py-2">Akun</th>
                      <th className="py-2 text-right">Debit</th>
                      <th className="py-2 text-right">Kredit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalDetail.lines.map((line: any) => (
                      <tr key={line.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 font-mono text-xs">{line.entry_number}</td>
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
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">New Journal Entry</h3>
              <button 
                onClick={handleCloseJournalModal}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-2xl"
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
                    {journalFormData.lines.map((line, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-start p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div className="col-span-4">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                            Account *
                          </label>
                          <select 
                            className="input w-full text-sm"
                            value={line.account_id}
                            onChange={(e) => updateJournalLine(index, 'account_id', e.target.value)}
                            required
                          >
                            <option value="">Select account</option>
                            {accounts.map(account => (
                              <option key={account.id} value={account.id}>
                                {account.code} - {account.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-3">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                            Debit (IDR)
                          </label>
                          <input 
                            type="number" 
                            className="input w-full text-sm"
                            value={line.debit || ''}
                            onChange={(e) => updateJournalLine(index, 'debit', parseFloat(e.target.value) || 0)}
                            step="1000"
                            min="0"
                          />
                        </div>

                        <div className="col-span-3">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                            Credit (IDR)
                          </label>
                          <input 
                            type="number" 
                            className="input w-full text-sm"
                            value={line.credit || ''}
                            onChange={(e) => updateJournalLine(index, 'credit', parseFloat(e.target.value) || 0)}
                            step="1000"
                            min="0"
                          />
                        </div>

                        <div className="col-span-2 flex items-end">
                          {journalFormData.lines.length > 2 && (
                            <button 
                              type="button"
                              onClick={() => removeJournalLine(index)}
                              className="w-full px-2 py-2 text-red-600 hover:bg-red-50 rounded text-sm"
                            >
                              <TrashIcon className="h-4 w-4 mx-auto" />
                            </button>
                          )}
                        </div>

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
                    ))}
                  </div>

                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
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
                          ? 'text-green-600' : 'text-red-600'
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
                      <p className="text-red-600 text-sm mt-2">⚠️ Entry must be balanced before posting</p>
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
                  Create Journal Entry
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
