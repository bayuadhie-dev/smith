import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatRupiah } from '../../utils/currencyUtils';
import axiosInstance from '../../utils/axiosConfig';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import {
  ArrowDownTrayIcon,
  EyeIcon,
  FunnelIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  PencilIcon
,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

interface Account {
  id: number
  code: string
  name: string
  type: string
  balance: number
  description?: string
}

const ChartOfAccounts = () => {
    const { t } = useLanguage();

const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    loadAccounts()
  }, [])

  const loadAccounts = async () => {
    try {
      setLoading(true)
      const response = await axiosInstance.get('/api/finance/chart-of-accounts')
      setAccounts(response.data.accounts || [])
    } catch (error) {
      console.error('Error loading chart of accounts:', error)
      setAccounts([])
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

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         account.code.includes(searchTerm)
    const matchesType = !typeFilter || account.type === typeFilter
    return matchesSearch && matchesType
  })

  const groupedAccounts = filteredAccounts.reduce((groups, account) => {
    const type = account.type
    if (!groups[type]) {
      groups[type] = []
    }
    groups[type].push(account)
    return groups
  }, {} as Record<string, Account[]>)

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'asset':
        return 'bg-green-100 text-green-800'
      case 'liability':
        return 'bg-red-100 text-red-800'
      case 'equity':
        return 'bg-blue-100 text-blue-800'
      case 'revenue':
        return 'bg-purple-100 text-purple-800'
      case 'expense':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'asset':
        return '🏢'
      case 'liability':
        return '💳'
      case 'equity':
        return '📈'
      case 'revenue':
        return '💰'
      case 'expense':
        return '💸'
      default:
        return '📊'
    }
  }

  const getTotalByType = (type: string) => {
    return accounts
      .filter(account => account.type === type)
      .reduce((sum, account) => sum + account.balance, 0)
  }

  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: '',
    balance: 0,
    description: ''
  })

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account)
    setFormData({
      code: account.code,
      name: account.name,
      type: account.type,
      balance: account.balance,
      description: account.description || ''
    })
    setShowAddModal(true)
  }

  const handleCloseModal = () => {
    setShowAddModal(false)
    setEditingAccount(null)
    setFormData({
      code: '',
      name: '',
      type: '',
      balance: 0,
      description: ''
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingAccount) {
        // Update existing account
        await axiosInstance.put(`/api/finance/chart-of-accounts/${editingAccount.code}`, formData)
        alert('Account updated successfully!')
      } else {
        // Create new account
        await axiosInstance.post('/api/finance/chart-of-accounts', formData)
        alert('Account created successfully!')
      }
      handleCloseModal()
      loadAccounts()
    } catch (error: any) {
      console.error('Error saving account:', error)
      alert(error.response?.data?.error || 'Failed to save account. Please try again.')
    }
  }

  // --- Account transaction drilldown (ported from AccountingManagement.tsx's
  // "accounts" tab, 2026-09-10, to converge the 2 duplicate implementations -
  // ChartOfAccounts had full CRUD but no drilldown; AccountingManagement had
  // drilldown but create-only. This page now has both. ---
  const [detailAccount, setDetailAccount] = useState<Account | null>(null)
  const [detailTransactions, setDetailTransactions] = useState<any[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [recurringTxDetail, setRecurringTxDetail] = useState<any>(null)
  const [loadingRecurringTxDetail, setLoadingRecurringTxDetail] = useState(false)
  const [payrollPeriodDetail, setPayrollPeriodDetail] = useState<any>(null)
  const [loadingPayrollPeriodDetail, setLoadingPayrollPeriodDetail] = useState(false)

  const handleViewAccount = async (account: Account) => {
    setDetailAccount(account)
    setLoadingDetail(true)
    try {
      const response = await axiosInstance.get(`/api/finance/accounts/${account.id}/transactions`)
      setDetailTransactions(response.data?.transactions || [])
    } catch (error) {
      console.error('Failed to load account transactions:', error)
      setDetailTransactions([])
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleCloseDetailModal = () => {
    setDetailAccount(null)
    setDetailTransactions([])
  }

  const handleOpenRecurringTxDetail = async (txId: number) => {
    setLoadingRecurringTxDetail(true)
    try {
      const lookupRes = await axiosInstance.get(`/api/finance/recurring-payment-transactions/${txId}`)
      const masterId = lookupRes.data?.recurring_payment_id
      if (!masterId) {
        setLoadingRecurringTxDetail(false)
        return
      }
      const detailRes = await axiosInstance.get(`/api/finance/recurring-payments/${masterId}/transactions/${txId}`)
      setRecurringTxDetail(detailRes.data)
    } catch (error) {
      console.error('Failed to load recurring payment transaction detail:', error)
    } finally {
      setLoadingRecurringTxDetail(false)
    }
  }

  const handleCloseRecurringTxDetail = () => {
    setRecurringTxDetail(null)
  }

  const handleOpenPayrollPeriodDetail = async (periodId: number) => {
    setLoadingPayrollPeriodDetail(true)
    try {
      const response = await axiosInstance.get(`/api/hr/payroll/periods/${periodId}`)
      setPayrollPeriodDetail(response.data)
    } catch (error) {
      console.error('Failed to load payroll period detail:', error)
    } finally {
      setLoadingPayrollPeriodDetail(false)
    }
  }

  const handleClosePayrollPeriodDetail = () => {
    setPayrollPeriodDetail(null)
  }

  // Maps AccountingEntry.reference_type to the frontend route for that
  // source document, so a transaction row in the account detail view can
  // link straight to it. Falls back to no link if the type is unmapped.
  const getReferenceLink = (referenceType: string | null, referenceId: number | null): string | null => {
    if (!referenceType || !referenceId) return null
    const routeMap: Record<string, string> = {
      purchase_invoice: `/app/purchasing/invoices/${referenceId}`,
      sales_invoice: `/app/sales/invoices/${referenceId}`,
      expense: `/app/finance/expenses/${referenceId}`,
      reimbursement: `/app/finance/reimbursements/${referenceId}`,
      fixed_asset: `/app/accounting/fixed-assets/${referenceId}`,
      recurring_payment: `/app/finance/recurring-payment-transactions/${referenceId}`,
      customer_deposit_usage: `/app/sales/invoices/${referenceId}`,
    }
    return routeMap[referenceType] || null
  }

  const handleDeleteAccount = async (account: Account) => {
    if (window.confirm(`Are you sure you want to delete this account?\n\nCode: ${account.code}\nName: ${account.name}\nType: ${account.type}\n\nThis action cannot be undone.`)) {
      try {
        await axiosInstance.delete(`/api/finance/chart-of-accounts/${account.code}`)
        alert(`Account "${account.name}" has been deleted successfully.`)
        loadAccounts() // Reload the accounts
      } catch (error) {
        console.error('Error deleting account:', error)
        alert('Failed to delete account. Please try again.')
      }
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Chart of Accounts</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Manage your accounting structure and account balances</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Add Account
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="bg-green-500 p-3 rounded-lg">
              <span className="text-2xl">🏢</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Assets</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatRupiah(getTotalByType('asset'))}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="bg-red-500 p-3 rounded-lg">
              <span className="text-2xl">💳</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Liabilities</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatRupiah(getTotalByType('liability'))}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="bg-blue-500 p-3 rounded-lg">
              <span className="text-2xl">📈</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Equity</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatRupiah(getTotalByType('equity'))}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="bg-purple-500 p-3 rounded-lg">
              <span className="text-2xl">💰</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Revenue</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatRupiah(getTotalByType('revenue'))}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="bg-orange-500 p-3 rounded-lg">
              <span className="text-2xl">💸</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Expenses</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatRupiah(getTotalByType('expense'))}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search accounts..."
              className="input pl-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <select
              className="input"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="asset">Assets</option>
              <option value="liability">Liabilities</option>
              <option value="equity">Equity</option>
              <option value="revenue">Revenue</option>
              <option value="expense">Expenses</option>
            </select>
            <button className="btn-secondary inline-flex items-center gap-2">
              <FunnelIcon className="h-4 w-4" />
            </button>
            <button className="btn-secondary inline-flex items-center gap-2">
              <ArrowDownTrayIcon className="h-4 w-4" />{t('common.export')}</button>
          </div>
        </div>
      </div>

      {/* Accounts by Type */}
      <div className="space-y-6">
        {Object.entries(groupedAccounts).map(([type, typeAccounts]) => (
          <div key={type} className="card overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{getTypeIcon(type)}</span>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white capitalize">{type}</h3>
                  <span className={`ml-3 px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(type)}`}>
                    {typeAccounts.length} accounts
                  </span>
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatRupiah(getTotalByType(type))}
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Account Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Account Name
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {typeAccounts.map((account) => (
                    <tr key={account.code} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{account.code}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{account.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-medium ${
                          account.balance >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatRupiah(account.balance)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewAccount(account)}
                            className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                            title="Lihat Riwayat Transaksi"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEditAccount(account)}
                            className="text-indigo-600 hover:text-indigo-900 inline-flex items-center"
                            title="Edit Account"
                          >
                            <PencilIcon className="h-4 w-4 mr-1" />{t('common.edit')}</button>
                          <button 
                            onClick={() => handleDeleteAccount(account)}
                            className="text-red-600 hover:text-red-900 inline-flex items-center"
                            title="Delete Account"
                          >
                            <TrashIcon className="h-4 w-4 mr-1" />{t('common.delete')}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{editingAccount ? 'Edit Account' : 'Add New Account'}</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Account Code *
                </label>
                <input 
                  type="text" 
                  className="input w-full" 
                  placeholder="e.g., 1000" 
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  disabled={!!editingAccount}
                  required 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Account Name *
                </label>
                <input 
                  type="text" 
                  className="input w-full" 
                  placeholder="e.g., Cash in Bank"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Account Type *
                </label>
                <select 
                  className="input w-full"
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  required
                >
                  <option value="">Select type</option>
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="equity">Equity</option>
                  <option value="revenue">Revenue</option>
                  <option value="expense">Expense</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {editingAccount ? 'Current Balance' : 'Opening Balance'}
                </label>
                <input 
                  type="number" 
                  className="input w-full" 
                  placeholder="0"
                  value={formData.balance}
                  onChange={(e) => setFormData({...formData, balance: parseFloat(e.target.value) || 0})}
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Description
                </label>
                <textarea 
                  className="input w-full" 
                  placeholder="Optional description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t">
                <button 
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-secondary"
                >{t('common.cancel')}</button>
                <button type="submit" className="btn-primary">
                  {editingAccount ? 'Update Account' : 'Add Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {filteredAccounts.length === 0 && !loading && (
        <div className="text-center py-12">
          <ListBulletIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No accounts found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Try adjusting your search criteria or add a new account</p>
        </div>
      )}

      {/* Account transaction drilldown modal */}
      {detailAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-3xl mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {detailAccount.code} - {detailAccount.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                  {detailAccount.type} &middot; Saldo: {formatRupiah(detailAccount.balance)}
                </p>
              </div>
              <button
                onClick={handleCloseDetailModal}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-2xl"
              >
                &times;
              </button>
            </div>

            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
              Riwayat Transaksi
            </h4>

            {loadingDetail ? (
              <div className="text-gray-500 text-sm py-8 text-center">Memuat...</div>
            ) : detailTransactions.length === 0 ? (
              <div className="text-gray-500 text-sm py-8 text-center">
                Belum ada transaksi tercatat untuk akun ini.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-3">Tanggal</th>
                    <th className="py-2 pr-3">No. Jurnal</th>
                    <th className="py-2 pr-3">Deskripsi</th>
                    <th className="py-2 pr-3 text-right">Debit</th>
                    <th className="py-2 pr-3 text-right">Kredit</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {detailTransactions.map((tx) => {
                    const link = getReferenceLink(tx.reference_type, tx.reference_id)
                    return (
                      <tr
                        key={tx.id}
                        className={`border-b border-gray-100 dark:border-gray-800 ${
                          (link || (tx.reference_type === 'payroll_period' && tx.reference_id)) ? 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer' : ''
                        }`}
                        onClick={() => {
                          if (tx.reference_type === 'recurring_payment' && tx.reference_id) {
                            handleOpenRecurringTxDetail(tx.reference_id)
                          } else if (tx.reference_type === 'payroll_period' && tx.reference_id) {
                            handleOpenPayrollPeriodDetail(tx.reference_id)
                          } else if (link) {
                            window.location.href = link
                          }
                        }}
                      >
                        <td className="py-2 pr-3">
                          {tx.entry_date ? new Date(tx.entry_date).toLocaleDateString('id-ID') : '-'}
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs">{tx.entry_number}</td>
                        <td className="py-2 pr-3">{tx.description}</td>
                        <td className="py-2 pr-3 text-right">
                          {tx.debit_amount > 0 ? formatRupiah(tx.debit_amount) : '-'}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          {tx.credit_amount > 0 ? formatRupiah(tx.credit_amount) : '-'}
                        </td>
                        <td className="py-2 text-blue-600">{link ? '→' : ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {(recurringTxDetail || loadingRecurringTxDetail) && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {recurringTxDetail ? recurringTxDetail.transaction.transaction_number : 'Memuat...'}
              </h3>
              <button
                onClick={handleCloseRecurringTxDetail}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-2xl"
              >
                &times;
              </button>
            </div>

            {loadingRecurringTxDetail ? (
              <div className="text-gray-500 text-sm py-8 text-center">Memuat...</div>
            ) : recurringTxDetail && (
              <>
                {recurringTxDetail.recurring_payment && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {recurringTxDetail.recurring_payment.name}
                    {recurringTxDetail.recurring_payment.vendor_name &&
                      ` · ${recurringTxDetail.recurring_payment.vendor_name}`}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm mb-4 bg-gray-50 dark:bg-gray-900 rounded-md p-4">
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Tanggal Bayar</div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {recurringTxDetail.transaction.payment_date
                        ? new Date(recurringTxDetail.transaction.payment_date).toLocaleDateString('id-ID')
                        : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Periode</div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {recurringTxDetail.transaction.period_label || '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Jumlah</div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      Rp{recurringTxDetail.transaction.amount.toLocaleString('id-ID')}
                    </div>
                  </div>
                  {recurringTxDetail.transaction.notes && (
                    <div className="col-span-2">
                      <div className="text-gray-500 dark:text-gray-400">Catatan</div>
                      <div className="text-gray-900 dark:text-white">{recurringTxDetail.transaction.notes}</div>
                    </div>
                  )}
                </div>

                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Jurnal yang Diposting
                </h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2">Akun</th>
                      <th className="py-2 text-right">Debit</th>
                      <th className="py-2 text-right">Kredit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recurringTxDetail.journal_lines.map((line: any) => (
                      <tr key={line.id} className="border-b border-gray-100 dark:border-gray-800">
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
                </table>
              </>
            )}
          </div>
        </div>
      )}

      {(payrollPeriodDetail || loadingPayrollPeriodDetail) && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {payrollPeriodDetail ? payrollPeriodDetail.period_name : 'Memuat...'}
              </h3>
              <button
                onClick={handleClosePayrollPeriodDetail}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-2xl"
              >
                &times;
              </button>
            </div>

            {loadingPayrollPeriodDetail ? (
              <div className="text-gray-500 text-sm py-8 text-center">Memuat...</div>
            ) : payrollPeriodDetail && (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4 bg-gray-50 dark:bg-gray-900 rounded-md p-4">
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Periode</div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {new Date(payrollPeriodDetail.start_date).toLocaleDateString('id-ID')} - {new Date(payrollPeriodDetail.end_date).toLocaleDateString('id-ID')}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Status</div>
                    <div className="font-medium text-gray-900 dark:text-white">{payrollPeriodDetail.status}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Jumlah Karyawan</div>
                    <div className="font-medium text-gray-900 dark:text-white">{payrollPeriodDetail.total_employees}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Total Gaji Bersih</div>
                    <div className="font-medium text-gray-900 dark:text-white">{formatRupiah(payrollPeriodDetail.total_net_salary)}</div>
                  </div>
                </div>

                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Rincian per Karyawan
                </h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2 pr-3">Nama</th>
                      <th className="py-2 pr-3 text-right">Gaji Bruto</th>
                      <th className="py-2 pr-3 text-right">Potongan</th>
                      <th className="py-2 pr-3 text-right">Gaji Bersih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollPeriodDetail.records.map((r: any) => (
                      <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 pr-3">{r.employee_name}</td>
                        <td className="py-2 pr-3 text-right">{formatRupiah(r.gross_salary)}</td>
                        <td className="py-2 pr-3 text-right">{formatRupiah(r.total_deductions)}</td>
                        <td className="py-2 pr-3 text-right">{formatRupiah(r.net_salary)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ChartOfAccounts
