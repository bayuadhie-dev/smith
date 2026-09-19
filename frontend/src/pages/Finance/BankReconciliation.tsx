import React, { useState, useEffect, useCallback } from 'react'
import axiosInstance from '../../utils/axiosConfig'
import { formatRupiah } from '../../utils/currencyUtils'
import {
  ArrowUpTrayIcon,
  CheckCircleIcon,
  XCircleIcon,
  LinkIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'

interface Statement {
  id: number
  account_id: number
  account_name: string | null
  period_start: string
  period_end: string
  source_filename: string | null
  imported_at: string
  total_lines: number
  matched_lines: number
}

interface Candidate {
  id: number
  entry_number: string
  entry_date: string
  description: string | null
  debit_amount: number
  credit_amount: number
}

interface StatementLine {
  id: number
  line_date: string
  description: string | null
  reference_number: string | null
  amount: number
  is_matched: boolean
  matched_accounting_entry_id: number | null
  matched_entry: Candidate | null
  suggested_matches: Candidate[]
}

interface Account {
  id: number
  code: string
  name: string
  is_cash_bank?: boolean
}

export default function BankReconciliation() {
  const [statements, setStatements] = useState<Statement[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedStatementId, setSelectedStatementId] = useState<number | null>(null)
  const [lines, setLines] = useState<StatementLine[]>([])
  const [onlyUnmatched, setOnlyUnmatched] = useState(false)
  const [uploadAccountId, setUploadAccountId] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadStatements = useCallback(async () => {
    const res = await axiosInstance.get('/api/finance/bank-reconciliation/statements')
    setStatements(res.data?.statements || [])
  }, [])

  const loadAccounts = useCallback(async () => {
    const res = await axiosInstance.get('/api/finance/chart-of-accounts')
    const all = res.data?.accounts || res.data || []
    setAccounts(all.filter((a: Account) => a.is_cash_bank))
  }, [])

  const loadLines = useCallback(async (statementId: number, unmatchedOnly: boolean) => {
    const res = await axiosInstance.get(
      `/api/finance/bank-reconciliation/statements/${statementId}/lines?unmatched_only=${unmatchedOnly}`
    )
    setLines(res.data?.lines || [])
  }, [])

  useEffect(() => {
    loadStatements()
    loadAccounts()
  }, [loadStatements, loadAccounts])

  useEffect(() => {
    if (selectedStatementId) loadLines(selectedStatementId, onlyUnmatched)
  }, [selectedStatementId, onlyUnmatched, loadLines])

  const handleUpload = async () => {
    if (!uploadFile || !uploadAccountId) {
      setMessage({ type: 'error', text: 'Pilih rekening dan file terlebih dahulu' })
      return
    }
    setUploading(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('account_id', uploadAccountId)
      const res = await axiosInstance.post('/api/finance/bank-reconciliation/statements', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setMessage({ type: 'success', text: res.data.message })
      setUploadFile(null)
      await loadStatements()
      setSelectedStatementId(res.data.statement_id)
    } catch (e: any) {
      setMessage({ type: 'error', text: e.response?.data?.error || 'Gagal mengimpor file' })
    } finally {
      setUploading(false)
    }
  }

  const handleMatch = async (lineId: number, entryId: number) => {
    try {
      await axiosInstance.post(`/api/finance/bank-reconciliation/lines/${lineId}/match`, {
        accounting_entry_id: entryId,
      })
      if (selectedStatementId) {
        await loadLines(selectedStatementId, onlyUnmatched)
        await loadStatements()
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.response?.data?.error || 'Gagal mencocokkan' })
    }
  }

  const handleUnmatch = async (lineId: number) => {
    try {
      await axiosInstance.post(`/api/finance/bank-reconciliation/lines/${lineId}/unmatch`)
      if (selectedStatementId) {
        await loadLines(selectedStatementId, onlyUnmatched)
        await loadStatements()
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.response?.data?.error || 'Gagal membatalkan kecocokan' })
    }
  }

  const selectedStatement = statements.find((s) => s.id === selectedStatementId)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bank Reconciliation</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          Cocokkan mutasi rekening bank dengan jurnal (Accounting Entry) yang sudah tercatat di sistem.
        </p>
      </div>

      {message && (
        <div className={`rounded-lg p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
          {message.text}
        </div>
      )}

      {/* Upload */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-5">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3">Impor Mutasi Rekening</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          File CSV/Excel dengan kolom header: Tanggal, Keterangan, lalu Debit+Kredit ATAU satu kolom Mutasi/Amount bertanda +/-.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Rekening Kas/Bank</label>
            <select
              value={uploadAccountId}
              onChange={(e) => setUploadAccountId(e.target.value)}
              className="border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm min-w-[220px]"
            >
              <option value="">Pilih rekening...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">File</label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="text-sm text-gray-700 dark:text-gray-300"
            />
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <ArrowUpTrayIcon className="w-4 h-4" />
            {uploading ? 'Mengimpor...' : 'Impor'}
          </button>
        </div>
      </div>

      {/* Statements list + lines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-5">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3">Riwayat Impor</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {statements.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">Belum ada statement diimpor</p>
            ) : (
              statements.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStatementId(s.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedStatementId === s.id
                      ? 'border-[#059669] bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.account_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{s.period_start} s/d {s.period_end}</p>
                  <p className="text-xs mt-1">
                    <span className={s.matched_lines === s.total_lines ? 'text-green-600' : 'text-amber-600'}>
                      {s.matched_lines}/{s.total_lines} baris cocok
                    </span>
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-md p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {selectedStatement ? `Mutasi - ${selectedStatement.account_name}` : 'Pilih statement di kiri'}
            </h3>
            {selectedStatement && (
              <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <input type="checkbox" checked={onlyUnmatched} onChange={(e) => setOnlyUnmatched(e.target.checked)} />
                Tampilkan yang belum cocok saja
              </label>
            )}
          </div>
          {selectedStatement && (
            <p className={`text-xs mb-3 font-medium ${selectedStatement.matched_lines === selectedStatement.total_lines ? 'text-green-600' : 'text-amber-600'}`}>
              {selectedStatement.matched_lines} dari {selectedStatement.total_lines} baris mutasi sudah dicocokkan ke jurnal akuntansi.
            </p>
          )}

          {!selectedStatement ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              <DocumentTextIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Pilih riwayat impor untuk mulai mencocokkan</p>
            </div>
          ) : lines.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              <CheckCircleIcon className="w-12 h-12 mx-auto mb-2 text-green-400" />
              <p className="text-sm">
                {onlyUnmatched
                  ? 'Semua baris sudah cocok — centang "Tampilkan yang belum cocok saja" untuk melihat detail pasangannya'
                  : 'Belum ada baris mutasi pada statement ini'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {lines.map((line) => (
                <div key={line.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{line.description || '(tanpa keterangan)'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{line.line_date} {line.reference_number ? `· ${line.reference_number}` : ''}</p>
                    </div>
                    <p className={`text-sm font-bold ml-4 ${line.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {line.amount >= 0 ? '+' : ''}{formatRupiah(line.amount)}
                    </p>
                  </div>

                  {line.is_matched ? (
                    <div className="mt-2 flex items-center justify-between bg-green-50 dark:bg-green-900/20 rounded px-2 py-1.5">
                      <span className="text-xs text-green-700 dark:text-green-400 flex items-center gap-2 min-w-0">
                        <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
                        {line.matched_entry ? (
                          <span className="truncate">
                            Cocok dengan <strong>{line.matched_entry.entry_number}</strong> · {line.matched_entry.entry_date} · {line.matched_entry.description || '(tanpa keterangan)'}
                          </span>
                        ) : (
                          <span>Cocok dengan jurnal #{line.matched_accounting_entry_id} (jurnal tidak ditemukan / sudah dihapus)</span>
                        )}
                      </span>
                      <button onClick={() => handleUnmatch(line.id)} className="text-xs text-red-600 hover:underline flex items-center gap-1 flex-shrink-0 ml-2">
                        <XCircleIcon className="w-4 h-4" /> Batalkan
                      </button>
                    </div>
                  ) : line.suggested_matches.length === 0 ? (
                    <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 italic">Tidak ada kandidat jurnal yang cocok (cek manual di General Ledger)</p>
                  ) : (
                    <div className="mt-2 space-y-1">
                      {line.suggested_matches.map((c) => (
                        <div key={c.id} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-700/50 rounded px-2 py-1.5">
                          <span className="truncate flex-1">{c.entry_number} · {c.entry_date} · {c.description || '-'}</span>
                          <button
                            onClick={() => handleMatch(line.id, c.id)}
                            className="ml-2 flex-shrink-0 flex items-center gap-1 text-[#059669] hover:underline font-medium"
                          >
                            <LinkIcon className="w-3.5 h-3.5" /> Cocokkan
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
