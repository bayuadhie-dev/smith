import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import axiosInstance from '../../utils/axiosConfig';

interface ApprovedExpense {
  id: number;
  expense_number: string;
  employee_name: string;
  expense_date: string;
  expense_category: string;
  description: string;
  amount: number;
  reimbursement_number: string | null;
}

const ReimbursementForm: React.FC = () => {
  const navigate = useNavigate();

  const [expenses, setExpenses] = useState<ApprovedExpense[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    payment_method: 'bank_transfer',
    bank_name: '',
    bank_account_number: '',
    bank_account_name: '',
    period_start: '',
    period_end: '',
    notes: '',
  });

  useEffect(() => {
    fetchApprovedExpenses();
  }, []);

  const fetchApprovedExpenses = async () => {
    try {
      setLoading(true);
      const { data } = await axiosInstance.get('/api/expenses?status=approved&per_page=100');
      // Only show approved expenses that are not yet linked to a reimbursement
      const available = (data.expenses || []).filter(
        (e: ApprovedExpense) => !e.reimbursement_number
      );
      setExpenses(available);
    } catch (error) {
      toast.error('Gagal memuat expense yang disetujui');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpense = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectedExpenses = expenses.filter((e) => selectedIds.includes(e.id));
  const totalAmount = selectedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // All selected expenses must belong to the same employee (backend requirement)
  const distinctEmployees = Array.from(
    new Set(selectedExpenses.map((e) => e.employee_name))
  );
  const sameEmployee = distinctEmployees.length <= 1;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedIds.length === 0) {
      toast.error('Pilih minimal satu expense');
      return;
    }
    if (!sameEmployee) {
      toast.error('Semua expense harus milik karyawan yang sama');
      return;
    }
    if (form.payment_method === 'bank_transfer' && !form.bank_account_number.trim()) {
      toast.error('Nomor rekening wajib diisi untuk transfer bank');
      return;
    }

    try {
      setSubmitting(true);
      await axiosInstance.post('/api/expenses/reimbursements', {
        expense_ids: selectedIds,
        payment_method: form.payment_method,
        bank_name: form.bank_name || null,
        bank_account_number: form.bank_account_number || null,
        bank_account_name: form.bank_account_name || null,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
        notes: form.notes || null,
      });
      toast.success('Reimbursement berhasil dibuat');
      navigate('/app/finance/reimbursements');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Gagal membuat reimbursement');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) =>
    `IDR ${(amount || 0).toLocaleString('id-ID')}`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Reimbursement</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Buat batch reimbursement dari expense yang telah disetujui
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Approved Expense Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Pilih Expense yang Disetujui
          </h3>

          {!sameEmployee && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span>Semua expense yang dipilih harus milik karyawan yang sama.</span>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-500">Memuat data...</div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Tidak ada expense yang disetujui dan belum di-reimburse.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                    <th className="px-3 py-2 w-10"></th>
                    <th className="px-3 py-2">Number</th>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {expenses.map((exp) => (
                    <tr
                      key={exp.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => toggleExpense(exp.id)}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(exp.id)}
                          onChange={() => toggleExpense(exp.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white">
                        {exp.expense_number}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                        {exp.employee_name}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                        {exp.expense_date}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                        {exp.expense_category}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                        {exp.description}
                      </td>
                      <td className="px-3 py-2 text-sm text-right text-gray-900 dark:text-white">
                        {formatCurrency(exp.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-6 text-sm">
            <span className="text-gray-600 dark:text-gray-300">
              Dipilih: <strong>{selectedIds.length}</strong> expense
            </span>
            <span className="text-gray-900 dark:text-white">
              Total: <strong>{formatCurrency(totalAmount)}</strong>
            </span>
          </div>
        </div>

        {/* Payment Details */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Detail Pembayaran</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Metode Pembayaran *
              </label>
              <select
                name="payment_method"
                value={form.payment_method}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Nama Bank
              </label>
              <input
                type="text"
                name="bank_name"
                value={form.bank_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Nomor Rekening
              </label>
              <input
                type="text"
                name="bank_account_number"
                value={form.bank_account_number}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Nama Pemilik Rekening
              </label>
              <input
                type="text"
                name="bank_account_name"
                value={form.bank_account_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Periode Mulai
              </label>
              <input
                type="date"
                name="period_start"
                value={form.period_start}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Periode Selesai
              </label>
              <input
                type="date"
                name="period_end"
                value={form.period_end}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Catatan
            </label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/app/finance/reimbursements')}
            className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <X className="inline h-4 w-4 mr-2" />
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting || selectedIds.length === 0 || !sameEmployee}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="inline h-4 w-4 mr-2" />
            {submitting ? 'Menyimpan...' : 'Buat Reimbursement'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReimbursementForm;
