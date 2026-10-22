import React, { useState, useEffect } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import { formatRupiah } from '../../utils/currencyUtils';
import LoadingSpinner from '../../components/Common/LoadingSpinner'
import { exportToCSV, generatePDFReport } from '../../utils/exportUtils'
import {
  ArrowDownTrayIcon,
  BanknotesIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';
interface CoaAccountLine {
  code: string
  name: string
  balance: number
}

interface IncomeStatement {
  revenue: {
    sales_revenue: number
    sales_discounts: number
    other_income: number
    total_revenue: number
    accounts: CoaAccountLine[]
  }
  cost_of_sales: {
    direct_materials: number
    direct_labor: number
    manufacturing_overhead: number
    total_cogs: number
    accounts: CoaAccountLine[]
  }
  gross_profit: number
  operating_expenses: {
    selling_expenses: number
    administrative_expenses: number
    total_operating_expenses: number
    selling_accounts: CoaAccountLine[]
    admin_accounts: CoaAccountLine[]
  }
  operating_income: number
  other_expenses: {
    interest_expense: number
    depreciation: number
    total_other_expenses: number
    accounts: CoaAccountLine[]
  }
  net_income_before_tax: number
  income_tax: number
  net_income: number
}

interface BalanceSheet {
  assets: {
    current_assets: {
      cash: number
      accounts_receivable: number
      inventory: number
      prepaid_expenses: number
      total_current_assets: number
    }
    fixed_assets: {
      property_plant_equipment: number
      accumulated_depreciation: number
      net_fixed_assets: number
    }
    total_assets: number
  }
  liabilities: {
    current_liabilities: {
      accounts_payable: number
      accrued_liabilities: number
      short_term_debt: number
      total_current_liabilities: number
    }
    long_term_liabilities: {
      long_term_debt: number
      total_long_term_liabilities: number
    }
    total_liabilities: number
  }
  equity: {
    common_stock: number
    retained_earnings: number
    current_year_earnings?: number
    total_equity: number
  }
  total_liabilities_equity: number
  unclassified_accounts?: Array<{
    account_code: string
    account_name: string
    account_type: string
    balance: number
  }>
  is_balanced?: boolean
  imbalance?: number
  warnings?: string[]
}

interface CashFlow {
  operating_activities: {
    cash_in: number
    cash_out: number
    net_cash_from_operations: number
  }
  investing_activities: {
    net_cash_from_investing: number
  }
  financing_activities: {
    net_cash_from_financing: number
  }
  net_change_in_cash: number
  beginning_cash: number
  ending_cash: number
}

type IncomePeriodMode = 'harian' | 'mingguan' | 'bulanan' | 'tahunan' | 'bebas'

/** Local-calendar-date YYYY-MM-DD, NOT d.toISOString() - that converts to
 * UTC first, which silently shifts the date back a day for any timezone
 * ahead of UTC (e.g. WIB/UTC+7) - caught live: "Bulanan" for October 2026
 * showed 2026-09-30 to 2026-10-30 instead of 2026-10-01 to 2026-10-31. */
function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday-Sunday of the ISO week containing `d`. */
function weekRange(d: Date): { from: string; to: string } {
  const day = d.getDay() || 7 // Sunday=0 -> 7
  const monday = new Date(d)
  monday.setDate(d.getDate() - day + 1)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { from: toISODate(monday), to: toISODate(sunday) }
}

function monthRange(yearMonth: string): { from: string; to: string } {
  const [y, m] = yearMonth.split('-').map(Number)
  const from = new Date(y, m - 1, 1)
  const to = new Date(y, m, 0)
  return { from: toISODate(from), to: toISODate(to) }
}

const FinancialReports = () => {
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatement | null>(null)
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null)
  const [cashFlow, setCashFlow] = useState<CashFlow | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeReport, setActiveReport] = useState<'income' | 'balance' | 'cashflow'>('income')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  // Income Statement period selection (2026-10-22): independent of the
  // year dropdown Balance Sheet/Cash Flow still use - harian/mingguan/
  // bulanan/tahunan/bebas (custom range), per user request.
  const [incomePeriodMode, setIncomePeriodMode] = useState<IncomePeriodMode>('tahunan')
  const [incomeDay, setIncomeDay] = useState(toISODate(new Date()))
  const [incomeWeekAnchor, setIncomeWeekAnchor] = useState(toISODate(new Date()))
  const [incomeMonth, setIncomeMonth] = useState(new Date().toISOString().slice(0, 7))
  const [incomeCustomFrom, setIncomeCustomFrom] = useState(toISODate(new Date(new Date().getFullYear(), 0, 1)))
  const [incomeCustomTo, setIncomeCustomTo] = useState(toISODate(new Date()))
  const [incomeRange, setIncomeRange] = useState<{ from: string; to: string }>(
    { from: `${new Date().getFullYear()}-01-01`, to: `${new Date().getFullYear()}-12-31` }
  )

  useEffect(() => {
    let range: { from: string; to: string }
    switch (incomePeriodMode) {
      case 'harian':
        range = { from: incomeDay, to: incomeDay }
        break
      case 'mingguan':
        range = weekRange(new Date(incomeWeekAnchor))
        break
      case 'bulanan':
        range = monthRange(incomeMonth)
        break
      case 'bebas':
        range = { from: incomeCustomFrom, to: incomeCustomTo }
        break
      case 'tahunan':
      default:
        range = { from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` }
    }
    setIncomeRange(range)
  }, [incomePeriodMode, incomeDay, incomeWeekAnchor, incomeMonth, incomeCustomFrom, incomeCustomTo, selectedYear])

  useEffect(() => {
    loadIncomeStatement()
  }, [incomeRange])

  useEffect(() => {
    loadOtherReports()
  }, [selectedYear])

  const loadIncomeStatement = async () => {
    try {
      const res = await axiosInstance.get(
        `/api/finance/reports/income-statement?date_from=${incomeRange.from}&date_to=${incomeRange.to}`
      )
      setIncomeStatement(res.data.income_statement)
    } catch (error) {
      console.error('Error loading income statement:', error)
    }
  }

  const loadOtherReports = async () => {
    try {
      setLoading(true)
      const [balanceRes, cashFlowRes] = await Promise.all([
        axiosInstance.get(`/api/finance/reports/balance-sheet`),
        axiosInstance.get(`/api/finance/reports/cash-flow?year=${selectedYear}`)
      ])
      setBalanceSheet(balanceRes.data.balance_sheet)
      setCashFlow(cashFlowRes.data.cash_flow)
    } catch (error) {
      console.error('Error loading financial reports:', error)
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

  const renderIncomeStatement = () => {
    if (!incomeStatement) return null

    return (
      <div className="space-y-6">
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-xl font-semibold">📊 Laporan Laba Rugi</h3>
            <span className="text-sm text-gray-500">{incomeRange.from} s/d {incomeRange.to}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {([
                ['harian', 'Harian'],
                ['mingguan', 'Mingguan'],
                ['bulanan', 'Bulanan'],
                ['tahunan', 'Tahunan'],
                ['bebas', 'Bebas'],
              ] as [IncomePeriodMode, string][]).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setIncomePeriodMode(mode)}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${incomePeriodMode === mode ? 'bg-white shadow text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {incomePeriodMode === 'harian' && (
              <input type="date" value={incomeDay} onChange={(e) => setIncomeDay(e.target.value)} className="border rounded px-3 py-2 text-sm" />
            )}
            {incomePeriodMode === 'mingguan' && (
              <div>
                <input type="date" value={incomeWeekAnchor} onChange={(e) => setIncomeWeekAnchor(e.target.value)} className="border rounded px-3 py-2 text-sm" />
                <span className="text-xs text-gray-400 ml-2">pilih tanggal mana saja di minggu yang dimaksud</span>
              </div>
            )}
            {incomePeriodMode === 'bulanan' && (
              <input type="month" value={incomeMonth} onChange={(e) => setIncomeMonth(e.target.value)} className="border rounded px-3 py-2 text-sm" />
            )}
            {incomePeriodMode === 'tahunan' && (
              <span className="text-sm text-gray-500">Tahun {selectedYear} — ubah di dropdown kanan atas</span>
            )}
            {incomePeriodMode === 'bebas' && (
              <div className="flex items-center gap-2">
                <input type="date" value={incomeCustomFrom} onChange={(e) => setIncomeCustomFrom(e.target.value)} className="border rounded px-3 py-2 text-sm" />
                <span className="text-gray-400 text-sm">s/d</span>
                <input type="date" value={incomeCustomTo} onChange={(e) => setIncomeCustomTo(e.target.value)} className="border rounded px-3 py-2 text-sm" />
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* Revenue Section - per actual CoA account */}
            <div className="border-b pb-4">
              <h4 className="font-semibold text-green-700 mb-2">PENDAPATAN</h4>
              <div className="ml-4 space-y-1">
                {(incomeStatement.revenue?.accounts || []).map((acc) => (
                  <div key={acc.code} className="flex justify-between">
                    <span>
                      <span className="text-gray-400 mr-2">{acc.code}</span>
                      {acc.name}
                    </span>
                    <span className={acc.balance < 0 ? 'text-red-600' : ''}>
                      {acc.balance < 0 ? `(${formatRupiah(Math.abs(acc.balance))})` : formatRupiah(acc.balance)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold border-t pt-1">
                  <span>Total Pendapatan</span>
                  <span>{formatRupiah(incomeStatement.revenue?.total_revenue || 0)}</span>
                </div>
              </div>
            </div>

            {/* Cost of Sales - per actual CoA account */}
            <div className="border-b pb-4">
              <h4 className="font-semibold text-red-700 mb-2">BEBAN POKOK PENJUALAN (HPP)</h4>
              <div className="ml-4 space-y-1">
                {(incomeStatement.cost_of_sales?.accounts || []).length === 0 && (
                  <div className="text-gray-400 italic">Belum ada posting HPP periode ini</div>
                )}
                {(incomeStatement.cost_of_sales?.accounts || []).map((acc) => (
                  <div key={acc.code} className="flex justify-between">
                    <span>
                      <span className="text-gray-400 mr-2">{acc.code}</span>
                      {acc.name}
                    </span>
                    <span>{formatRupiah(acc.balance)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold border-t pt-1">
                  <span>Total HPP</span>
                  <span>({formatRupiah(incomeStatement.cost_of_sales?.total_cogs || 0)})</span>
                </div>
              </div>
            </div>

            {/* Gross Profit */}
            <div className="flex justify-between font-bold text-lg bg-blue-50 p-2 rounded">
              <span>LABA KOTOR</span>
              <span className="text-blue-600">{formatRupiah(incomeStatement.gross_profit || 0)}</span>
            </div>

            {/* Operating Expenses - per actual CoA account, selling + admin */}
            <div className="border-b pb-4">
              <h4 className="font-semibold text-orange-700 mb-2">BEBAN OPERASIONAL</h4>
              <div className="ml-4 space-y-1">
                <div className="text-xs uppercase tracking-wide text-gray-400 mt-1">Beban Penjualan</div>
                {(incomeStatement.operating_expenses?.selling_accounts || []).length === 0 && (
                  <div className="text-gray-400 italic">-</div>
                )}
                {(incomeStatement.operating_expenses?.selling_accounts || []).map((acc) => (
                  <div key={acc.code} className="flex justify-between">
                    <span>
                      <span className="text-gray-400 mr-2">{acc.code}</span>
                      {acc.name}
                    </span>
                    <span>{formatRupiah(acc.balance)}</span>
                  </div>
                ))}
                <div className="text-xs uppercase tracking-wide text-gray-400 mt-2">Beban Administrasi &amp; Umum</div>
                {(incomeStatement.operating_expenses?.admin_accounts || []).length === 0 && (
                  <div className="text-gray-400 italic">-</div>
                )}
                {(incomeStatement.operating_expenses?.admin_accounts || []).map((acc) => (
                  <div key={acc.code} className="flex justify-between">
                    <span>
                      <span className="text-gray-400 mr-2">{acc.code}</span>
                      {acc.name}
                    </span>
                    <span>{formatRupiah(acc.balance)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold border-t pt-1">
                  <span>Total Beban Operasional</span>
                  <span>({formatRupiah(incomeStatement.operating_expenses?.total_operating_expenses || 0)})</span>
                </div>
              </div>
            </div>

            {/* Operating Income */}
            <div className="flex justify-between font-bold text-lg bg-green-50 p-2 rounded">
              <span>LABA USAHA</span>
              <span className="text-green-600">{formatRupiah(incomeStatement.operating_income || 0)}</span>
            </div>

            {/* Other Income/Expenses - per actual CoA account (9-xxxx) */}
            {(incomeStatement.other_expenses?.accounts || []).length > 0 && (
              <div className="border-b pb-4">
                <h4 className="font-semibold text-purple-700 mb-2">PENDAPATAN / BEBAN LAIN-LAIN</h4>
                <div className="ml-4 space-y-1">
                  {(incomeStatement.other_expenses?.accounts || []).map((acc) => (
                    <div key={acc.code} className="flex justify-between">
                      <span>
                        <span className="text-gray-400 mr-2">{acc.code}</span>
                        {acc.name}
                      </span>
                      <span>{formatRupiah(acc.balance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold border-t pt-1">
                    <span>Total Lain-lain</span>
                    <span>({formatRupiah(incomeStatement.other_expenses?.total_other_expenses || 0)})</span>
                  </div>
                </div>
              </div>
            )}

            {/* Net Income */}
            <div className="border-t pt-4">
              <div className="flex justify-between">
                <span>Pajak Penghasilan</span>
                <span>({formatRupiah(incomeStatement.income_tax || 0)})</span>
              </div>
              <div className="flex justify-between font-bold text-xl bg-indigo-50 p-3 rounded mt-2">
                <span>LABA BERSIH</span>
                <span className="text-indigo-600">{formatRupiah(incomeStatement.net_income || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderBalanceSheet = () => {
    if (!balanceSheet) return null

    const hasWarnings = (balanceSheet.warnings && balanceSheet.warnings.length > 0) ||
      balanceSheet.is_balanced === false ||
      (balanceSheet.unclassified_accounts && balanceSheet.unclassified_accounts.length > 0)

    return (
      <div className="space-y-6">
        {hasWarnings && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
            <div className="flex items-center gap-2 font-semibold mb-2">
              <span>⚠️</span>
              <span>
                {balanceSheet.is_balanced === false
                  ? `Neraca tidak seimbang (selisih ${formatRupiah(Math.abs(balanceSheet.imbalance || 0))})`
                  : 'Ada akun yang belum terklasifikasi di Neraca'}
              </span>
            </div>
            {balanceSheet.unclassified_accounts && balanceSheet.unclassified_accounts.length > 0 && (
              <ul className="list-disc ml-6 text-sm space-y-1 mb-2">
                {balanceSheet.unclassified_accounts.map((ua) => (
                  <li key={ua.account_code}>
                    {ua.account_code} ({ua.account_name}) - {formatRupiah(ua.balance)} - tipe "{ua.account_type}" tidak masuk kategori manapun
                  </li>
                ))}
              </ul>
            )}
            {balanceSheet.warnings && balanceSheet.warnings.length > 0 && (
              <ul className="list-disc ml-6 text-sm space-y-1">
                {balanceSheet.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="card p-6">
          <h3 className="text-xl font-semibold mb-4">🏢 Balance Sheet - As of Dec 31, {selectedYear}</h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Assets */}
            <div>
              <h4 className="font-bold text-green-700 mb-4 text-lg">ASSETS</h4>
              
              <div className="space-y-3">
                <div>
                  <h5 className="font-semibold mb-2">Current Assets</h5>
                  <div className="ml-4 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Cash</span>
                      <span>{formatRupiah(balanceSheet.assets.current_assets.cash)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Accounts Receivable</span>
                      <span>{formatRupiah(balanceSheet.assets.current_assets.accounts_receivable)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Inventory</span>
                      <span>{formatRupiah(balanceSheet.assets.current_assets.inventory)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Prepaid Expenses</span>
                      <span>{formatRupiah(balanceSheet.assets.current_assets.prepaid_expenses)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Total Current Assets</span>
                      <span>{formatRupiah(balanceSheet.assets.current_assets.total_current_assets)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h5 className="font-semibold mb-2">Fixed Assets</h5>
                  <div className="ml-4 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Property, Plant & Equipment</span>
                      <span>{formatRupiah(balanceSheet.assets.fixed_assets.property_plant_equipment)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Less: Accumulated Depreciation</span>
                      <span>({formatRupiah(Math.abs(balanceSheet.assets.fixed_assets.accumulated_depreciation))})</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Net Fixed Assets</span>
                      <span>{formatRupiah(balanceSheet.assets.fixed_assets.net_fixed_assets)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between font-bold text-lg bg-green-50 p-2 rounded">
                  <span>TOTAL ASSETS</span>
                  <span>{formatRupiah(balanceSheet.assets.total_assets)}</span>
                </div>
              </div>
            </div>

            {/* Liabilities & Equity */}
            <div>
              <h4 className="font-bold text-red-700 mb-4 text-lg">LIABILITIES & EQUITY</h4>
              
              <div className="space-y-3">
                <div>
                  <h5 className="font-semibold mb-2">Current Liabilities</h5>
                  <div className="ml-4 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Accounts Payable</span>
                      <span>{formatRupiah(balanceSheet.liabilities.current_liabilities.accounts_payable)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Accrued Liabilities</span>
                      <span>{formatRupiah(balanceSheet.liabilities.current_liabilities.accrued_liabilities)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Short-term Debt</span>
                      <span>{formatRupiah(balanceSheet.liabilities.current_liabilities.short_term_debt)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Total Current Liabilities</span>
                      <span>{formatRupiah(balanceSheet.liabilities.current_liabilities.total_current_liabilities)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h5 className="font-semibold mb-2">Long-term Liabilities</h5>
                  <div className="ml-4 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Long-term Debt</span>
                      <span>{formatRupiah(balanceSheet.liabilities.long_term_liabilities.long_term_debt)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Total Long-term Liabilities</span>
                      <span>{formatRupiah(balanceSheet.liabilities.long_term_liabilities.total_long_term_liabilities)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between font-semibold bg-red-50 p-2 rounded">
                  <span>TOTAL LIABILITIES</span>
                  <span>{formatRupiah(balanceSheet.liabilities.total_liabilities)}</span>
                </div>

                <div>
                  <h5 className="font-semibold mb-2">Equity</h5>
                  <div className="ml-4 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Common Stock</span>
                      <span>{formatRupiah(balanceSheet.equity.common_stock)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Retained Earnings</span>
                      <span>{formatRupiah(balanceSheet.equity.retained_earnings)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Total Equity</span>
                      <span>{formatRupiah(balanceSheet.equity.total_equity)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between font-bold text-lg bg-blue-50 p-2 rounded">
                  <span>TOTAL LIABILITIES & EQUITY</span>
                  <span>{formatRupiah(balanceSheet.total_liabilities_equity)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderCashFlow = () => {
    if (!cashFlow) return null

    return (
      <div className="space-y-6">
        <div className="card p-6">
          <h3 className="text-xl font-semibold mb-4">💰 Cash Flow Statement - {selectedYear}</h3>
          
          <div className="space-y-6">
            {/* Operating Activities */}
            <div className="border-b pb-4">
              <h4 className="font-semibold text-blue-700 mb-3">OPERATING ACTIVITIES</h4>
              <div className="ml-4 space-y-2">
                <div className="flex justify-between">
                  <span>Kas Masuk</span>
                  <span>{formatRupiah(cashFlow.operating_activities.cash_in)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kas Keluar</span>
                  <span>({formatRupiah(cashFlow.operating_activities.cash_out)})</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2 bg-blue-50 p-2 rounded">
                  <span>Net Cash from Operations</span>
                  <span className="text-blue-600">{formatRupiah(cashFlow.operating_activities.net_cash_from_operations)}</span>
                </div>
              </div>
            </div>

            {/* Investing Activities */}
            <div className="border-b pb-4">
              <h4 className="font-semibold text-green-700 mb-3">INVESTING ACTIVITIES</h4>
              <div className="ml-4 space-y-2">
                <div className="flex justify-between font-semibold border-t pt-2 bg-green-50 p-2 rounded">
                  <span>Net Cash from Investing</span>
                  <span className="text-green-600">{formatRupiah(cashFlow.investing_activities.net_cash_from_investing)}</span>
                </div>
                {cashFlow.investing_activities.net_cash_from_investing === 0 && (
                  <p className="text-xs text-gray-400 italic">Belum ada transaksi investasi (pembelian/penjualan aset tetap) yang tercatat ke GL.</p>
                )}
              </div>
            </div>

            {/* Financing Activities */}
            <div className="border-b pb-4">
              <h4 className="font-semibold text-purple-700 mb-3">FINANCING ACTIVITIES</h4>
              <div className="ml-4 space-y-2">
                <div className="flex justify-between font-semibold border-t pt-2 bg-purple-50 p-2 rounded">
                  <span>Net Cash from Financing</span>
                  <span className="text-purple-600">{formatRupiah(cashFlow.financing_activities.net_cash_from_financing)}</span>
                </div>
                {cashFlow.financing_activities.net_cash_from_financing === 0 && (
                  <p className="text-xs text-gray-400 italic">Belum ada transaksi pendanaan (pinjaman/dividen) yang tercatat ke GL.</p>
                )}
              </div>
            </div>

            {/* Net Change */}
            <div className="space-y-2">
              <div className="flex justify-between font-bold text-lg">
                <span>Net Change in Cash</span>
                <span className={cashFlow.net_change_in_cash >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatRupiah(cashFlow.net_change_in_cash)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Beginning Cash</span>
                <span>{formatRupiah(cashFlow.beginning_cash)}</span>
              </div>
              <div className="flex justify-between font-bold text-xl bg-indigo-50 p-3 rounded">
                <span>ENDING CASH</span>
                <span className="text-indigo-600">{formatRupiah(cashFlow.ending_cash)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Laporan Keuangan</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Comprehensive financial statements and analysis</p>
        </div>
        <div className="flex gap-3">
          <select
            className="input"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button 
            onClick={async () => {
              const reportName = activeReport === 'income' ? 'Income Statement' : 
                               activeReport === 'balance' ? 'Balance Sheet' : 'Cash Flow Statement'
              
              try {
                let reportData
                if (activeReport === 'income') {
                  reportData = incomeStatement ? [
                    { Item: 'Sales Revenue', Amount: incomeStatement.revenue?.sales_revenue || 0 },
                    { Item: 'Other Income', Amount: incomeStatement.revenue?.other_income || 0 },
                    { Item: 'Total Revenue', Amount: incomeStatement.revenue?.total_revenue || 0 },
                    { Item: 'Direct Materials', Amount: -(incomeStatement.cost_of_sales?.direct_materials || 0) },
                    { Item: 'Direct Labor', Amount: -(incomeStatement.cost_of_sales?.direct_labor || 0) },
                    { Item: 'Manufacturing Overhead', Amount: -(incomeStatement.cost_of_sales?.manufacturing_overhead || 0) },
                    { Item: 'Gross Profit', Amount: incomeStatement.gross_profit || 0 },
                    { Item: 'Operating Expenses', Amount: -(incomeStatement.operating_expenses?.total_operating_expenses || 0) },
                    { Item: 'Net Income', Amount: incomeStatement.net_income || 0 }
                  ] : []
                } else if (activeReport === 'balance') {
                  reportData = balanceSheet ? [
                    { Category: 'Current Assets', Item: 'Cash', Amount: balanceSheet.assets?.current_assets?.cash || 0 },
                    { Category: 'Current Assets', Item: 'Accounts Receivable', Amount: balanceSheet.assets?.current_assets?.accounts_receivable || 0 },
                    { Category: 'Current Assets', Item: 'Inventory', Amount: balanceSheet.assets?.current_assets?.inventory || 0 },
                    { Category: 'Fixed Assets', Item: 'Property Plant Equipment', Amount: balanceSheet.assets?.fixed_assets?.property_plant_equipment || 0 },
                    { Category: 'Current Liabilities', Item: 'Accounts Payable', Amount: balanceSheet.liabilities?.current_liabilities?.accounts_payable || 0 },
                    { Category: 'Current Liabilities', Item: 'Short Term Debt', Amount: balanceSheet.liabilities?.current_liabilities?.short_term_debt || 0 },
                    { Category: 'Equity', Item: 'Common Stock', Amount: balanceSheet.equity?.common_stock || 0 },
                    { Category: 'Equity', Item: 'Retained Earnings', Amount: balanceSheet.equity?.retained_earnings || 0 }
                  ] : []
                } else {
                  reportData = cashFlow ? [
                    { Activity: 'Operating Activities', Item: 'Kas Masuk', Amount: cashFlow.operating_activities?.cash_in || 0 },
                    { Activity: 'Operating Activities', Item: 'Kas Keluar', Amount: cashFlow.operating_activities?.cash_out || 0 },
                    { Activity: 'Operating Activities', Item: 'Net Cash from Operations', Amount: cashFlow.operating_activities?.net_cash_from_operations || 0 },
                    { Activity: 'Investing Activities', Item: 'Net Cash from Investing', Amount: cashFlow.investing_activities?.net_cash_from_investing || 0 },
                    { Activity: 'Financing Activities', Item: 'Net Cash from Financing', Amount: cashFlow.financing_activities?.net_cash_from_financing || 0 }
                  ] : []
                }
                
                await generatePDFReport(`${activeReport}-statement-${selectedYear}`, {
                  title: `${reportName} - ${selectedYear}`,
                  data: reportData,
                  company: 'ERP System',
                  period: selectedYear
                })
              } catch (error) {
                console.error('Export error:', error)
              }
            }}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="card">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveReport('income')}
              className={`py-4 px-1 border-b-2 font-medium text-sm inline-flex items-center gap-2 ${
                activeReport === 'income'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <ChartBarIcon className="h-5 w-5" />
              Income Statement
            </button>
            <button
              onClick={() => setActiveReport('balance')}
              className={`py-4 px-1 border-b-2 font-medium text-sm inline-flex items-center gap-2 ${
                activeReport === 'balance'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <ClipboardDocumentListIcon className="h-5 w-5" />
              Balance Sheet
            </button>
            <button
              onClick={() => setActiveReport('cashflow')}
              className={`py-4 px-1 border-b-2 font-medium text-sm inline-flex items-center gap-2 ${
                activeReport === 'cashflow'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BanknotesIcon className="h-5 w-5" />
              Cash Flow
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeReport === 'income' && renderIncomeStatement()}
          {activeReport === 'balance' && renderBalanceSheet()}
          {activeReport === 'cashflow' && renderCashFlow()}
        </div>
      </div>
    </div>
  )
}

export default FinancialReports
