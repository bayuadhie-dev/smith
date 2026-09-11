import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';

interface ExpenseDetailData {
  id: number;
  expense_number: string;
  employee_name: string;
  expense_date: string | null;
  expense_category: string;
  expense_type: string;
  description: string;
  amount: number;
  currency: string;
  vendor_name: string | null;
  reference_number: string | null;
  status: string;
  status_display: string;
  submitted_at: string | null;
  approved_at: string | null;
  approval_notes: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  reimbursement_id: number | null;
  reimbursement_number: string | null;
  posted_to_gl: boolean;
  gl_posted_at: string | null;
  notes: string | null;
  receipt_file_path: string | null;
  receipt_file_name: string | null;
}

/**
 * Read-only detail page for a single Expense - previously missing
 * (AccountingManagement.tsx's getReferenceLink() redirected reference_type
 * 'expense' straight to the edit form). Mirrors ReimbursementDetail.tsx's
 * pattern.
 */
const ExpenseDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<ExpenseDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axiosInstance
      .get(`/api/expenses/${id}`)
      .then((res) => {
        setData(res.data.expense);
        setLoading(false);
      })
      .catch(() => {
        setError('Gagal memuat detail expense.');
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-6 text-gray-500">Memuat...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error || 'Expense tidak ditemukan.'}</p>
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

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{data.expense_number}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{data.employee_name}</p>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500 dark:text-gray-400">Status</div>
            <div className="font-medium text-gray-900 dark:text-white capitalize">{data.status_display || data.status}</div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Jumlah</div>
            <div className="font-medium text-gray-900 dark:text-white">
              {data.currency} {data.amount.toLocaleString('id-ID')}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Tanggal</div>
            <div className="font-medium text-gray-900 dark:text-white">
              {data.expense_date ? new Date(data.expense_date).toLocaleDateString('id-ID') : '-'}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Kategori</div>
            <div className="font-medium text-gray-900 dark:text-white">{data.expense_category}</div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">Vendor</div>
            <div className="font-medium text-gray-900 dark:text-white">{data.vendor_name || '-'}</div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400">No. Referensi</div>
            <div className="font-medium text-gray-900 dark:text-white">{data.reference_number || '-'}</div>
          </div>
          <div className="col-span-2">
            <div className="text-gray-500 dark:text-gray-400">Deskripsi</div>
            <div className="font-medium text-gray-900 dark:text-white">{data.description || '-'}</div>
          </div>
          {data.reimbursement_number && (
            <div>
              <div className="text-gray-500 dark:text-gray-400">Reimbursement</div>
              <div className="font-medium text-gray-900 dark:text-white">{data.reimbursement_number}</div>
            </div>
          )}
          <div>
            <div className="text-gray-500 dark:text-gray-400">Diposting ke GL</div>
            <div className="font-medium text-gray-900 dark:text-white">{data.posted_to_gl ? 'Ya' : 'Belum'}</div>
          </div>
          {data.rejection_reason && (
            <div className="col-span-2">
              <div className="text-gray-500 dark:text-gray-400">Alasan Ditolak</div>
              <div className="font-medium text-red-600">{data.rejection_reason}</div>
            </div>
          )}
          {data.notes && (
            <div className="col-span-2">
              <div className="text-gray-500 dark:text-gray-400">Catatan</div>
              <div className="font-medium text-gray-900 dark:text-white">{data.notes}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExpenseDetail;
