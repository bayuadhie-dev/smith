import RiwayatPanel from '../../components/RiwayatPanel'
import DocumentGenerateButton from '../../components/DocumentGenerateButton'
import { useAppSelector } from '../../hooks/redux'
import toast from 'react-hot-toast'
import AttachmentsPanel from '../../components/AttachmentsPanel'
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
  paid_at?: string | null;
  paid_date?: string | null;
  payment_reference?: string | null;
  paid_from_account?: string | null;
  approval_steps?: { level: number; kind: string; status: string; assigned_user_id: number; assigned_user_name: string | null; approver_name: string | null; approved_at: string | null; comments: string | null }[];
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
  const me = useAppSelector((st: any) => st.auth?.user);
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const reload = () => axiosInstance.get(`/api/expenses/reimbursements/${id}`).then((r) => setData(r.data)).catch(() => undefined);
  const act = async (level: number, action: 'approve' | 'reject') => {
    setBusy(true);
    try {
      await axiosInstance.post(`/api/expenses/reimbursements/${id}/approval-steps/${level}/action`, { action, comments: action === 'reject' ? reason : undefined });
      toast.success(action === 'approve' ? 'Disetujui' : 'Reimbursement ditolak');
      setRejecting(null); setReason('');
      await reload();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Gagal memproses');
    } finally { setBusy(false); }
  };

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
    return <div className="p-6 text-gray-500 dark:text-gray-400">Memuat...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <p className="text-red-600 dark:text-red-400">{error || 'Reimbursement tidak ditemukan.'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary-600 hover:underline dark:text-primary-400">
          &larr; Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4 dark:text-gray-400 dark:hover:text-white">
        &larr; Kembali
      </button>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{data.reimbursement_number}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{data.employee_name}</p>
      <div className="mb-6">
        {data.status === 'paid'
          ? <DocumentGenerateButton transactionType="reimbursement" transactionId={data.id} transactionNumber={data.reimbursement_number} label="Cetak Bukti" />
          : <p className="text-xs text-gray-500 dark:text-gray-400">Bukti reimbursement bisa dicetak setelah dibayar.</p>}
      </div>

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
          {data.paid_from_account && (
            <div>
              <div className="text-gray-500 dark:text-gray-400">Dibayar dari</div>
              <div className="font-medium text-gray-900 dark:text-white">{data.paid_from_account}{data.paid_date ? ` · ${data.paid_date}` : ''}{data.payment_reference ? ` · Ref ${data.payment_reference}` : ''}</div>
            </div>
          )}
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

      {(data.approval_steps || []).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Persetujuan</h2>
          <div className="space-y-2">
            {data.approval_steps!.map((st, idx) => {
              const prior = data.approval_steps!.slice(0, idx).every((x) => x.status === 'approved');
              const mine = !me || me.is_super_admin || me.id === st.assigned_user_id;
              const actionable = st.status === 'pending' && prior && mine && data.status === 'pending';
              return (
                <div key={st.level} className="rounded-md border border-gray-100 p-3 dark:border-gray-700">
                  <div className="flex items-center justify-between text-sm">
                    <span><b>{st.kind === 'mengetahui' ? 'Mengetahui' : 'Menyetujui'}</b>: {st.assigned_user_name}</span>
                    <span className={st.status === 'approved' ? 'text-emerald-700 dark:text-emerald-300' : st.status === 'rejected' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}>{st.status === 'approved' ? 'Disetujui' : st.status === 'rejected' ? 'Ditolak' : 'Menunggu'}</span>
                  </div>
                  {st.approved_at && <p className="mt-1 text-xs text-gray-400">{st.approver_name} · {new Date(st.approved_at).toLocaleString('id-ID')}{st.comments ? ` · ${st.comments}` : ''}</p>}
                  {actionable && (rejecting === st.level ? (
                    <div className="mt-2 space-y-2">
                      <textarea className="input-field" rows={2} placeholder="Alasan penolakan" value={reason} onChange={(e) => setReason(e.target.value)} />
                      <div className="flex gap-2">
                        <button type="button" disabled={busy || !reason.trim()} className="rounded bg-red-600 px-3 py-1 text-xs text-white disabled:opacity-50" onClick={() => act(st.level, 'reject')}>Konfirmasi tolak</button>
                        <button type="button" className="rounded border px-3 py-1 text-xs" onClick={() => { setRejecting(null); setReason(''); }}>Batal</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex gap-2">
                      <button type="button" disabled={busy} className="rounded bg-emerald-600 px-3 py-1 text-xs text-white disabled:opacity-50" onClick={() => act(st.level, 'approve')}>Setujui</button>
                      <button type="button" className="rounded border border-red-200 px-3 py-1 text-xs text-red-600 dark:text-red-400 dark:border-red-800" onClick={() => setRejecting(st.level)}>Tolak</button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Daftar Expense</h2>
      {data.expenses.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Tidak ada expense dalam reimbursement ini.</p>
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
      <AttachmentsPanel entityType="reimbursement" entityId={id} />
      <RiwayatPanel table="reimbursements" id={id} />
    </div>
  );
};

export default ReimbursementDetail;
