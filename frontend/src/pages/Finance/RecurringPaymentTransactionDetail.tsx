import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from '../../lib/axios';

interface JournalLine {
  id: number;
  entry_number: string;
  account_id: number;
  account_code: string;
  account_name: string;
  debit_amount: number;
  credit_amount: number;
  description: string;
}

interface DetailResponse {
  transaction: {
    id: number;
    transaction_number: string;
    payment_date: string | null;
    period_label: string | null;
    amount: number;
    notes: string | null;
    created_at: string | null;
  };
  recurring_payment: {
    id: number;
    name: string;
    category: string;
    vendor_name: string | null;
  } | null;
  journal_lines: JournalLine[];
}

const CATEGORY_LABELS: Record<string, string> = {
  electricity: 'Listrik',
  water: 'Air',
  internet: 'Internet/WiFi',
  other: 'Lainnya',
};

/**
 * Single-record detail page for one RecurringPaymentTransaction - the
 * per-transaction drill-down target linked from the account detail modal
 * in AccountingManagement.tsx (via reference_type='recurring_payment',
 * reference_id=transaction.id, fixed 2026-08-17 to point at the specific
 * transaction rather than its master).
 */
const RecurringPaymentTransactionDetail: React.FC = () => {
  const { masterId, txId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get(`/finance/recurring-payments/${masterId}/transactions/${txId}`)
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Gagal memuat detail transaksi.');
        setLoading(false);
      });
  }, [masterId, txId]);

  if (loading) {
    return <div className="p-6 text-gray-500">Memuat...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error || 'Transaksi tidak ditemukan.'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary-600 hover:underline">
          &larr; Kembali
        </button>
      </div>
    );
  }

  const { transaction, recurring_payment, journal_lines } = data;

  return (
    <div className="p-6 max-w-2xl">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4">
        &larr; Kembali
      </button>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        {transaction.transaction_number}
      </h1>
      {recurring_payment && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          <Link to="/app/finance/recurring-payments" className="text-primary-600 hover:underline">
            {recurring_payment.name}
          </Link>
          {' · '}
          {CATEGORY_LABELS[recurring_payment.category] || recurring_payment.category}
          {recurring_payment.vendor_name && ` · ${recurring_payment.vendor_name}`}
        </p>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500 dark:text-gray-400">Tanggal Bayar</div>
            <div className="font-medium text-gray-900 dark:text-white">
              {transaction.payment_date ? new Date(transaction.payment_date).toLocaleDateString('id-ID') : '-'}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Periode</div>
            <div className="font-medium text-gray-900 dark:text-white">{transaction.period_label || '-'}</div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Jumlah</div>
            <div className="font-medium text-gray-900 dark:text-white">
              Rp{transaction.amount.toLocaleString('id-ID')}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Dicatat</div>
            <div className="font-medium text-gray-900 dark:text-white">
              {transaction.created_at ? new Date(transaction.created_at).toLocaleString('id-ID') : '-'}
            </div>
          </div>
        </div>
        {transaction.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="text-gray-500 dark:text-gray-400 text-sm">Catatan</div>
            <div className="text-gray-900 dark:text-white text-sm">{transaction.notes}</div>
          </div>
        )}
      </div>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Jurnal yang Diposting</h2>
      {journal_lines.length === 0 ? (
        <p className="text-sm text-gray-500">Tidak ada baris jurnal ditemukan untuk transaksi ini.</p>
      ) : (
        <table className="w-full text-sm bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="p-3">Akun</th>
              <th className="p-3 text-right">Debit</th>
              <th className="p-3 text-right">Kredit</th>
            </tr>
          </thead>
          <tbody>
            {journal_lines.map((line) => (
              <tr key={line.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-3">
                  {line.account_code} - {line.account_name}
                </td>
                <td className="p-3 text-right">
                  {line.debit_amount > 0 ? `Rp${line.debit_amount.toLocaleString('id-ID')}` : '-'}
                </td>
                <td className="p-3 text-right">
                  {line.credit_amount > 0 ? `Rp${line.credit_amount.toLocaleString('id-ID')}` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default RecurringPaymentTransactionDetail;
