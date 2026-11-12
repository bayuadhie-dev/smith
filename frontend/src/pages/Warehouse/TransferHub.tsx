import { useLocation, useNavigate } from 'react-router-dom'
import StockTransferList from './StockTransferList'
import ReceiptsList from './ReceiptsList'

const TABS = [
  { path: '/app/warehouse/transfers', label: 'Pemindahan Barang', hint: 'Dari Permintaan Barang atau Penerimaan Barang' },
  { path: '/app/warehouse/transfers/receive', label: 'Penerimaan Barang', hint: 'Barang masuk dari GRN atau dari pemindahan (tombol Ambil)' },
]

export default function TransferHub() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const active = pathname.endsWith('/receive') ? 1 : 0
  return (
    <div>
      <div className="flex gap-1 border-b border-gray-200 px-6 pt-4 dark:border-gray-700">
        {TABS.map((t, i) => (
          <button key={t.path} type="button" title={t.hint} onClick={() => navigate(t.path)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${i === active ? 'border-primary-600 text-primary-700 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {active === 1 ? <ReceiptsList /> : <StockTransferList />}
    </div>
  )
}
