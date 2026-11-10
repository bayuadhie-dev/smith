import { useLocation, useNavigate } from 'react-router-dom'
import ExpenseList from './ExpenseList'
import ReimbursementList from './ReimbursementList'

const TABS = [
  { path: '/app/finance/expenses', label: 'Klaim Karyawan', hint: 'Nota yang diajukan karyawan' },
  { path: '/app/finance/reimbursements', label: 'Pembayaran Klaim', hint: 'Persetujuan, pembayaran, dan bukti bayar' },
]

export default function ClaimsHub() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const active = pathname.startsWith('/app/finance/reimbursements') ? 1 : 0
  return (
    <div>
      <div className="flex gap-1 border-b border-gray-200 px-6 pt-4 dark:border-gray-700">
        {TABS.map((t, i) => (
          <button
            key={t.path}
            type="button"
            title={t.hint}
            onClick={() => navigate(t.path)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              i === active
                ? 'border-primary-600 text-primary-700 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {active === 0 ? <ExpenseList /> : <ReimbursementList />}
    </div>
  )
}
