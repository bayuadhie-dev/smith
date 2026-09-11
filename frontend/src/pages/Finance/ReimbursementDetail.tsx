import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';

interface ExpenseLine {
  id: number;
  expense_number: string;
  expense_date: string | null;
  expense_category: string;
  description: string;
  amount: number;
}

interface ReimbursementDetailData {
  id: number;
  reimbursement_number: string;
  employee_name: string;
  total_amount: number;
  currency: string;
  payment_method: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  bank_name: string | null;
  status: string;
  submitted_at: string | null;
  approved_at: string | null;
  expenses: ExpenseLine[];
}

/**
 * Read-only detail page for a single Reimbursement - previously missing
 * (only list/new/approve/pay existed), built to fill a broken drill-down
 * link from AccountingManagement.tsx's account detail view
 * (reference_type='reimbursement').
 */
const ReimbursementDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<ReimbursementDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axiosInstance
      .get(`/api/expenses/reimbursements/${id}`)
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Gagal memuat detail reimbursement.');
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-6 text-gray-500">Memuat...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error || 'Reimbursement tidak ditemukan.'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary-600 hover:underline">
          &larr; Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4">
        &larr; Kembali
      </button>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{data.reimbursement_number}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{data.employee_name}</p>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500 dark:text-gray-400">Status</div>
            <div className="font-medium text-gray-900 dark:text-white capitalize">{data.status}</div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Total</div>
            <div className="font-medium text-gray-900 dark:text-white">
              Rp{data.total_amount.toLocaleString('id-ID')}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Metode Pembayaran</div>
            <div className="font-medium text-gray-900 dark:text-white">{data.payment_method || '-'}</div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Bank</div>
            <div className="font-medium text-gray-900 dark:text-white">
              {data.bank_name ? `${data.bank_name} - ${data.bank_account_number}` : '-'}
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Daftar Expense</h2>
      {data.expenses.length === 0 ? (
        <p className="text-sm text-gray-500">Tidak ada expense dalam reimbursement ini.</p>
      ) : (
        <table className="w-full text-sm bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="p-3">No. Expense</th>
              <th className="p-3">Tanggal</th>
              <th className="p-3">Kategori</th>
              <th className="p-3 text-right">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {data.expenses.map((exp) => (
              <tr key={exp.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-3">{exp.expense_number}</td>
                <td className="p-3">{exp.expense_date ? new Date(exp.expense_date).toLocaleDateString('id-ID') : '-'}</td>
                <td className="p-3">{exp.expense_category}</td>
                <td className="p-3 text-right">Rp{exp.amount.toLocaleString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ReimbursementDetail;
