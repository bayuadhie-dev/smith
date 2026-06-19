import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Upload,
  X,
  Eye,
  FileText,
  Image as ImageIcon,
  File,
} from 'lucide-react';

interface Employee {
  id: number;
  full_name: string;
}

interface CostCenter {
  id: number;
  code: string;
  name: string;
}

interface Account {
  id: number;
  code: string;
  name: string;
}

const EmployeeExpenseForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    employee_id: 0,
    expense_date: new Date().toISOString().split('T')[0],
    expense_category: '',
    expense_type: 'Cash',
    description: '',
    amount: '',
    currency: 'IDR',
    exchange_rate: '1',
    reference_number: '',
    vendor_name: '',
    cost_center_id: '',
    account_id: '',
    notes: '',
  });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [existingReceipt, setExistingReceipt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  const categories = [
    'Travel',
    'Meals',
    'Office Supplies',
    'Transportation',
    'Accommodation',
    'Communication',
    'Training',
    'Entertainment',
    'Other',
  ];

  const expenseTypes = ['Cash', 'Credit Card', 'Company Card', 'Bank Transfer'];

  useEffect(() => {
    fetchEmployees();
    fetchCostCenters();
    fetchAccounts();
    if (isEdit) {
      fetchExpense();
    }
  }, [id]);

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/hr/employees', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || data || []);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchCostCenters = async () => {
    try {
      const response = await fetch('/api/finance/cost-centers', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setCostCenters(data.cost_centers || data || []);
      }
    } catch (error) {
      console.error('Error fetching cost centers:', error);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/finance/accounts', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || data || []);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const fetchExpense = async () => {
    try {
      setFetching(true);
      const response = await fetch(`/api/expenses/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFormData({
          employee_id: data.expense.employee_id,
          expense_date: data.expense.expense_date.split('T')[0],
          expense_category: data.expense.expense_category,
          expense_type: data.expense.expense_type,
          description: data.expense.description,
          amount: data.expense.amount.toString(),
          currency: data.expense.currency,
          exchange_rate: data.expense.exchange_rate.toString(),
          reference_number: data.expense.reference_number || '',
          vendor_name: data.expense.vendor_name || '',
          cost_center_id: data.expense.cost_center_id?.toString() || '',
          account_id: data.expense.account_id?.toString() || '',
          notes: data.expense.notes || '',
        });
        if (data.expense.receipt_file_name) {
          setExistingReceipt(data.expense.receipt_file_name);
        }
      }
    } catch (error) {
      console.error('Error fetching expense:', error);
    } finally {
      setFetching(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        alert('Only JPEG, PNG, GIF, and PDF files are allowed');
        return;
      }
      setReceiptFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setReceiptPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setReceiptPreview(file.name);
      }
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const expenseData = {
        ...formData,
        amount: parseFloat(formData.amount),
        exchange_rate: parseFloat(formData.exchange_rate),
        cost_center_id: formData.cost_center_id ? parseInt(formData.cost_center_id) : null,
        account_id: formData.account_id ? parseInt(formData.account_id) : null,
      };

      const url = isEdit ? `/api/expenses/${id}` : '/api/expenses';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(expenseData),
      });

      if (!response.ok) {
        throw new Error('Failed to save expense');
      }

      const result = await response.json();
      const expenseId = isEdit ? id : result.expense.id;

      if (receiptFile) {
        const formDataUpload = new FormData();
        formDataUpload.append('file', receiptFile);

        const uploadResponse = await fetch(`/api/expenses/${expenseId}/upload-receipt`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: formDataUpload,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload receipt');
        }
      }

      alert(isEdit ? 'Expense updated successfully!' : 'Expense created successfully!');
      navigate('/app/finance/expenses');
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Failed to save expense. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/app/finance/expenses')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edit Expense' : 'New Expense'}
          </h1>
          <p className="text-gray-600">
            {isEdit ? 'Update expense claim' : 'Submit expense claim for reimbursement'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl">
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Employee *
            </label>
            <select
              required
              value={formData.employee_id}
              onChange={(e) => setFormData({ ...formData, employee_id: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Employee</option>
              {Array.isArray(employees) && employees.map((emp: any) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name || emp.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expense Date *
              </label>
              <input
                type="date"
                required
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expense Type *
              </label>
              <select
                required
                value={formData.expense_type}
                onChange={(e) => setFormData({ ...formData, expense_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {expenseTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category *
            </label>
            <select
              required
              value={formData.expense_category}
              onChange={(e) => setFormData({ ...formData, expense_category: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe the expense..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount *
              </label>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="IDR">IDR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Exchange Rate
            </label>
            <input
              type="number"
              step="0.000001"
              min="0"
              value={formData.exchange_rate}
              onChange={(e) => setFormData({ ...formData, exchange_rate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="1.0"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reference Number
              </label>
              <input
                type="text"
                value={formData.reference_number}
                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Invoice/Receipt number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vendor Name
              </label>
              <input
                type="text"
                value={formData.vendor_name}
                onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Vendor/Supplier name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cost Center
              </label>
              <select
                value={formData.cost_center_id}
                onChange={(e) => setFormData({ ...formData, cost_center_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Cost Center</option>
                {Array.isArray(costCenters) && costCenters.map((cc: any) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.code} - {cc.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account
              </label>
              <select
                value={formData.account_id}
                onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Account</option>
                {Array.isArray(accounts) && accounts.map((acc: any) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code} - {acc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Receipt (Photo/PDF)
            </label>
            {receiptPreview || existingReceipt ? (
              <div className="border border-gray-300 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">
                    {receiptPreview ? (typeof receiptPreview === 'string' && receiptPreview.startsWith('data:') ? 'Image Preview' : receiptPreview) : existingReceipt}
                  </span>
                  {existingReceipt && (
                    <button
                      type="button"
                      onClick={() => window.open(`/api/expenses/${id}/receipt`, '_blank')}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  {receiptPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveReceipt}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {typeof receiptPreview === 'string' && receiptPreview.startsWith('data:') && (
                  <img
                    src={receiptPreview}
                    alt="Receipt preview"
                    className="max-w-full h-auto max-h-64 rounded"
                  />
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  id="receipt"
                  accept="image/jpeg,image/png,image/gif,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="receipt"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">
                    Click to upload receipt (JPEG, PNG, GIF, PDF)
                  </span>
                  <span className="text-xs text-gray-400 mt-1">Max size: 5MB</span>
                </label>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/app/finance/expenses')}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEdit ? 'Update' : 'Create'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EmployeeExpenseForm;
