import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import axiosInstance from '../../utils/axiosConfig';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import {
  ArrowDownTrayIcon,
  BookOpenIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

interface LedgerEntry {
  id: number
  entry_date: string
  account_code: string
  account_name: string
  description: string
  debit_amount: number
  credit_amount: number
  reference_number: string
  reference_type: string | null
  entry_number: string
  created_by: string
}

interface AccountOption {
  id: number
  code: string
  name: string
  is_header: boolean
}

interface NewEntryLine {
  account_id: string
  debit: string
  credit: string
}

const GeneralLedger = () => {
    const { t } = useLanguage();

const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showNewEntryModal, setShowNewEntryModal] = useState(false)
  const [filters, setFilters] = useState({
    account_id: '',
    start_date: '',
    end_date: '',
    search: ''
  })

  // Real accounts fetched from the backend, replacing the previous
  // hardcoded 10-account list that didn't match any real account in the
  // database (SMITH's seeded Chart of Accounts uses codes like 2-1110,
  // 7-1000, not 1000/2000/etc). Used for both the filter dropdown and the
  // new-entry-line account selects.
  const [accounts, setAccounts] = useState<AccountOption[]>([])

  // New manual journal entry form state
  const [newEntryDate, setNewEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [newEntryDescription, setNewEntryDescription] = useState('')
  const [newEntryReference, setNewEntryReference] = useState('')
  const [newEntryLines, setNewEntryLines] = useState<NewEntryLine[]>([
    { account_id: '', debit: '', credit: '' },
    { account_id: '', debit: '', credit: '' },
  ])
  const [creatingEntry, setCreatingEntry] = useState(false)

  useEffect(() => {
    loadEntries()
  }, [currentPage, filters])

  useEffect(() => {
    loadAccounts()
  }, [])

  const loadAccounts = async () => {
    try {
      const response = await axiosInstance.get('/api/finance/accounts')
      setAccounts(response.data?.accounts || [])
    } catch (error) {
      console.error('Error loading accounts:', error)
      setAccounts([])
    }
  }

  const loadEntries = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: '20',
        ...(filters.account_id && { account_id: filters.account_id }),
        ...(filters.start_date && { start_date: filters.start_date }),
        ...(filters.end_date && { end_date: filters.end_date }),
        ...(filters.search && { search: filters.search })
      })

      const response = await axiosInstance.get(`/api/finance/general-ledger?${params}`)
      setEntries(response.data.entries || [])
      setTotalPages(response.data.pages || 1)
    } catch (error) {
      console.error('Error loading general ledger:', error)
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID')
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setCurrentPage(1)
  }

  const clearFilters = () => {
    setFilters({
      account_id: '',
      start_date: '',
      end_date: '',
      search: ''
    })
    setCurrentPage(1)
  }

  const calculateRunningBalance = (index: number) => {
    let balance = 0
    for (let i = 0; i <= index; i++) {
      balance += entries[i].debit_amount - entries[i].credit_amount
    }
    return balance
  }

  const getTotalDebits = () => {
    return entries.reduce((sum, entry) => sum + entry.debit_amount, 0)
  }

  const getTotalCredits = () => {
    return entries.reduce((sum, entry) => sum + entry.credit_amount, 0)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleDeleteEntry = async (entry: LedgerEntry) => {
    if (window.confirm(`Hapus jurnal manual ini?\n\nTanggal: ${formatDate(entry.entry_date)}\nDeskripsi: ${entry.description}\nReferensi: ${entry.reference_number || 'N/A'}\n\nSemua baris dalam jurnal ini (debit dan kredit) akan ikut terhapus.`)) {
      try {
        await axiosInstance.delete(`/api/finance/general-ledger/${entry.id}`)
        loadEntries() // Reload the entries
      } catch (error: any) {
        console.error('Error deleting journal entry:', error)
        alert(error.response?.data?.error || 'Gagal menghapus jurnal. Silakan coba lagi.')
      }
    }
  }

  const addNewEntryLine = () => {
    setNewEntryLines(prev => [...prev, { account_id: '', debit: '', credit: '' }])
  }

  const removeNewEntryLine = (index: number) => {
    setNewEntryLines(prev => prev.filter((_, i) => i !== index))
  }

  const updateNewEntryLine = (index: number, field: keyof NewEntryLine, value: string) => {
    setNewEntryLines(prev => prev.map((line, i) => i === index ? { ...line, [field]: value } : line))
  }

  const newEntryTotalDebit = newEntryLines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0)
  const newEntryTotalCredit = newEntryLines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0)
  const newEntryIsBalanced = newEntryTotalDebit === newEntryTotalCredit

  const resetNewEntryForm = () => {
    setNewEntryDate(new Date().toISOString().split('T')[0])
    setNewEntryDescription('')
    setNewEntryReference('')
    setNewEntryLines([
      { account_id: '', debit: '', credit: '' },
      { account_id: '', debit: '', credit: '' },
    ])
  }

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newEntryIsBalanced || newEntryTotalDebit === 0) {
      alert('Jurnal harus balance (total debit = total kredit) dan tidak boleh 0.')
      return
    }

    const linesPayload = newEntryLines
      .filter(l => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
      .map(l => ({
        account_id: parseInt(l.account_id, 10),
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
      }))

    if (linesPayload.length < 2) {
      alert('Isi minimal 2 baris jurnal dengan akun dan nominal.')
      return
    }

    try {
      setCreatingEntry(true)
      await axiosInstance.post('/api/finance/general-ledger', {
        entry_date: newEntryDate,
        description: newEntryDescription,
        reference_number: newEntryReference,
        lines: linesPayload,
      })
      setShowNewEntryModal(false)
      resetNewEntryForm()
      loadEntries()
    } catch (error: any) {
      console.error('Error creating journal entry:', error)
      alert(error.response?.data?.error || 'Gagal membuat jurnal. Silakan coba lagi.')
    } finally {
      setCreatingEntry(false)
    }
  }

  if (loading && entries.length === 0) {
    return <LoadingSpinner />
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">General Ledger</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">View all accounting entries and transaction details</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowNewEntryModal(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            New Entry
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="bg-green-500 p-3 rounded-lg">
              <BookOpenIcon className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Debits</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatRupiah(getTotalDebits())}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="bg-red-500 p-3 rounded-lg">
              <BookOpenIcon className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Credits</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatRupiah(getTotalCredits())}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className={`p-3 rounded-lg ${
              getTotalDebits() === getTotalCredits() ? 'bg-green-500' : 'bg-red-500'
            }`}>
              <BookOpenIcon className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Balance Check</p>
              <p className={`text-2xl font-bold ${
                getTotalDebits() === getTotalCredits() ? 'text-green-600' : 'text-red-600'
              }`}>
                {getTotalDebits() === getTotalCredits() ? 'Balanced' : 'Out of Balance'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search entries..."
              className="input pl-10 w-full"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>
          
          <select
            className="input"
            value={filters.account_id}
            onChange={(e) => handleFilterChange('account_id', e.target.value)}
          >
            <option value="">All Accounts</option>
            {accounts.filter(a => !a.is_header).map(a => (
              <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
            ))}
          </select>

          <input
            type="date"
            className="input"
            value={filters.start_date}
            onChange={(e) => handleFilterChange('start_date', e.target.value)}
            placeholder="Start Date"
          />

          <input
            type="date"
            className="input"
            value={filters.end_date}
            onChange={(e) => handleFilterChange('end_date', e.target.value)}
            placeholder="End Date"
          />

          <div className="flex gap-2">
            <button
              onClick={clearFilters}
              className="btn-secondary flex-1"
            >
              Clear
            </button>
            <button 
              onClick={() => {
                const data = entries.map(entry => ({
                  [t('common.date')]: formatDate(entry.entry_date),
                  'Account Code': entry.account_code,
                  'Account Name': entry.account_name,
                  [t('common.description')]: entry.description,
                  'Reference': entry.reference_number || '',
                  'Debit': entry.debit_amount,
                  'Credit': entry.credit_amount,
                  'Created By': entry.created_by
                }))
                console.log('Exporting GL data:', data)
                alert('Export functionality will be implemented soon!')
              }}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />{t('common.export')}</button>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.date')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.description')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Reference
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Debit
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Credit
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Running Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {entries.map((entry, index) => (
                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{formatDate(entry.entry_date)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{entry.account_code}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{entry.account_name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white max-w-xs truncate">{entry.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{entry.reference_number || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-green-600">
                      {entry.debit_amount > 0 ? formatRupiah(entry.debit_amount) : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-red-600">
                      {entry.credit_amount > 0 ? formatRupiah(entry.credit_amount) : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className={`text-sm font-medium ${
                      calculateRunningBalance(index) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatRupiah(calculateRunningBalance(index))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{entry.created_by}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {entry.reference_type === 'manual_journal' ? (
                      <button
                        onClick={() => handleDeleteEntry(entry)}
                        className="text-red-600 hover:text-red-900 flex items-center gap-1"
                        title="Hapus jurnal manual ini"
                      >
                        <TrashIcon className="h-4 w-4" />{t('common.delete')}</button>
                    ) : (
                      <span
                        className="text-gray-400 text-xs italic"
                        title="Jurnal otomatis dari transaksi lain - koreksi lewat sumbernya, bukan dari sini"
                      >
                        Otomatis
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {entries.length > 0 && (
              <tfoot className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                    Totals:
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-bold text-green-600">
                      {formatRupiah(getTotalDebits())}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-bold text-red-600">
                      {formatRupiah(getTotalCredits())}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className={`text-sm font-bold ${
                      getTotalDebits() - getTotalCredits() >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatRupiah(getTotalDebits() - getTotalCredits())}
                    </div>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {entries.length === 0 && !loading && (
          <div className="text-center py-12">
            <BookOpenIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No entries found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Try adjusting your search criteria</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 sm:px-6">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-200">
                Page <span className="font-medium">{currentPage}</span> of{' '}
                <span className="font-medium">{totalPages}</span>
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                        page === currentPage
                          ? 'z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                          : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-offset-0'
                      }`}
                    >
                      {page}
                    </button>
                  )
                  })}
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* New Journal Entry Modal */}
      {showNewEntryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Jurnal Manual Baru</h3>
              <button
                onClick={() => setShowNewEntryModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-2xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateEntry} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Tanggal Jurnal *
                  </label>
                  <input
                    type="date"
                    value={newEntryDate}
                    onChange={(e) => setNewEntryDate(e.target.value)}
                    className="input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Nomor Referensi
                  </label>
                  <input
                    type="text"
                    value={newEntryReference}
                    onChange={(e) => setNewEntryReference(e.target.value)}
                    className="input w-full"
                    placeholder="cth. CHK-123"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Deskripsi *
                </label>
                <textarea
                  value={newEntryDescription}
                  onChange={(e) => setNewEntryDescription(e.target.value)}
                  className="input w-full"
                  rows={2}
                  placeholder="Keterangan transaksi..."
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Baris Jurnal * (minimal 2, debit = kredit)
                  </label>
                  <button
                    type="button"
                    onClick={addNewEntryLine}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    + Tambah Baris
                  </button>
                </div>
                <div className="space-y-2">
                  {newEntryLines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <select
                        value={line.account_id}
                        onChange={(e) => updateNewEntryLine(idx, 'account_id', e.target.value)}
                        className="input col-span-5"
                        required
                      >
                        <option value="">Pilih akun...</option>
                        {accounts.filter(a => !a.is_header).map(a => (
                          <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={line.debit}
                        onChange={(e) => updateNewEntryLine(idx, 'debit', e.target.value)}
                        className="input col-span-3"
                        placeholder="Debit"
                        min="0"
                        step="0.01"
                      />
                      <input
                        type="number"
                        value={line.credit}
                        onChange={(e) => updateNewEntryLine(idx, 'credit', e.target.value)}
                        className="input col-span-3"
                        placeholder="Kredit"
                        min="0"
                        step="0.01"
                      />
                      <button
                        type="button"
                        onClick={() => removeNewEntryLine(idx)}
                        disabled={newEntryLines.length <= 2}
                        className="col-span-1 text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Hapus baris"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className={`mt-3 text-sm font-medium ${newEntryIsBalanced ? 'text-green-600' : 'text-red-600'}`}>
                  Total Debit: {formatRupiah(newEntryTotalDebit)} | Total Kredit: {formatRupiah(newEntryTotalCredit)}
                  {newEntryIsBalanced ? ' (Balance)' : ' (Belum balance)'}
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewEntryModal(false)}
                  className="btn-secondary"
                >{t('common.cancel')}</button>
                <button
                  type="submit"
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!newEntryIsBalanced || newEntryTotalDebit === 0 || creatingEntry}
                >
                  {creatingEntry ? 'Menyimpan...' : 'Buat Jurnal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default GeneralLedger
