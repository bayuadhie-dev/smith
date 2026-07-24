import React, { useState, useEffect } from 'react';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ScaleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';
import { toast } from 'react-hot-toast';

interface NettoRule {
  index: number;
  rule_type: 'pattern' | 'product_id';
  match_value: string;
  deduction_kg: number;
}

interface ProductOption {
  id: number;
  name: string;
  code: string;
}

export default function NettoDeductionRulesManager() {
  const [rules, setRules] = useState<NettoRule[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editTargetKey, setEditTargetKey] = useState<{ target_rule_type: string; target_match_value: string } | null>(null);

  // Form State
  const [formRuleType, setFormRuleType] = useState<'pattern' | 'product_id'>('pattern');
  const [formMatchValuePattern, setFormMatchValuePattern] = useState<string>('');
  const [formMatchValueProductId, setFormMatchValueProductId] = useState<string>('');
  const [formDeductionKg, setFormDeductionKg] = useState<string>('0.862');

  // Delete Confirm Modal State
  const [deleteTarget, setDeleteTarget] = useState<NettoRule | null>(null);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/api/config/netto-deductions');
      if (response.data.success) {
        setRules(response.data.rules || []);
        setProducts(response.data.products || []);
      } else {
        toast.error(response.data.message || 'Gagal memuat aturan potongan Netto');
      }
    } catch (error: any) {
      console.error('Error fetching Netto rules:', error);
      toast.error(error.response?.data?.message || 'Terjadi kesalahan saat memuat aturan');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setEditTargetKey(null);
    setFormRuleType('pattern');
    setFormMatchValuePattern('');
    setFormMatchValueProductId(products.length > 0 ? String(products[0].id) : '');
    setFormDeductionKg('0.862');
    setShowModal(true);
  };

  const openEditModal = (rule: NettoRule) => {
    setIsEditing(true);
    setEditTargetKey({
      target_rule_type: rule.rule_type,
      target_match_value: rule.match_value
    });
    setFormRuleType(rule.rule_type);
    if (rule.rule_type === 'pattern') {
      setFormMatchValuePattern(rule.match_value);
      setFormMatchValueProductId(products.length > 0 ? String(products[0].id) : '');
    } else {
      setFormMatchValuePattern('');
      setFormMatchValueProductId(rule.match_value);
    }
    setFormDeductionKg(String(rule.deduction_kg));
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const matchValue = formRuleType === 'pattern' ? formMatchValuePattern.trim() : formMatchValueProductId.trim();

    if (!matchValue) {
      toast.error(formRuleType === 'pattern' ? 'Pattern nama produk tidak boleh kosong' : 'Pilih produk dari dropdown');
      return;
    }

    const deductionVal = parseFloat(formDeductionKg);
    if (isNaN(deductionVal) || deductionVal <= 0) {
      toast.error('Nilai potongan (kg) harus berupa angka desimal positif');
      return;
    }

    try {
      setSubmitting(true);
      if (isEditing && editTargetKey) {
        const response = await axiosInstance.put('/api/config/netto-deductions', {
          target_rule_type: editTargetKey.target_rule_type,
          target_match_value: editTargetKey.target_match_value,
          rule_type: formRuleType,
          match_value: matchValue,
          deduction_kg: deductionVal
        });
        if (response.data.success) {
          toast.success('Aturan potongan Netto berhasil diperbarui');
          setRules(response.data.rules);
          setShowModal(false);
        }
      } else {
        const response = await axiosInstance.post('/api/config/netto-deductions', {
          rule_type: formRuleType,
          match_value: matchValue,
          deduction_kg: deductionVal
        });
        if (response.data.success) {
          toast.success('Aturan potongan Netto berhasil ditambahkan');
          setRules(response.data.rules);
          setShowModal(false);
        }
      }
    } catch (error: any) {
      console.error('Error saving Netto rule:', error);
      toast.error(error.response?.data?.message || 'Gagal menyimpan aturan potongan Netto');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setSubmitting(true);
      const response = await axiosInstance.delete('/api/config/netto-deductions', {
        data: {
          rule_type: deleteTarget.rule_type,
          match_value: deleteTarget.match_value
        }
      });
      if (response.data.success) {
        toast.success('Aturan potongan Netto berhasil dihapus');
        setRules(response.data.rules);
        setDeleteTarget(null);
      }
    } catch (error: any) {
      console.error('Error deleting Netto rule:', error);
      toast.error(error.response?.data?.message || 'Gagal menghapus aturan potongan Netto');
    } finally {
      setSubmitting(false);
    }
  };

  const getProductNameById = (pidStr: string) => {
    const pid = parseInt(pidStr, 10);
    const prod = products.find(p => p.id === pid);
    return prod ? `${prod.name} (${prod.code})` : `ID Produk #${pidStr}`;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700">
        <div>
          <div className="flex items-center gap-2">
            <ScaleIcon className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Manajemen Aturan Potongan Netto
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Konfigurasi potongan berat flat desimal (Netto Deduction Rules) per produk / pattern untuk kalkulasi desimal persis <code className="bg-slate-100 dark:bg-gray-700 px-1 py-0.5 rounded text-indigo-600 dark:text-indigo-300 font-mono">ROUND_HALF_UP</code>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchRules}
            disabled={loading}
            className="px-4 py-2 text-slate-700 dark:text-gray-200 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 rounded-lg flex items-center gap-2 text-sm font-medium transition disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg flex items-center gap-2 text-sm font-medium transition shadow"
          >
            <PlusIcon className="h-5 w-5" />
            Tambah Aturan Pengecualian
          </button>
        </div>
      </div>

      {/* Overview Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-xs sm:text-sm text-blue-900 dark:text-blue-200 flex items-start gap-3">
        <SparklesIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Prioritas Evaluasi Potongan Netto:</p>
          <ol className="list-decimal list-inside space-y-0.5 text-blue-800 dark:text-blue-300">
            <li><strong>Match ID Produk (`product_id`)</strong>: Aturan khusus per SKU produk spesifik.</li>
            <li><strong>Match Substring Pattern (`pattern`)</strong>: Substring nama produk (case-insensitive, misal <code>POLYMORPH</code>).</li>
            <li><strong>Fallback Default (`0.515 kg`)</strong>: Berlaku otomatis untuk seluruh produk lain (termasuk Wetkins, Octenic, dll).</li>
          </ol>
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-600" />
            <p>Memuat aturan dari `product_netto_deduction.csv`...</p>
          </div>
        ) : rules.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <p className="font-semibold text-slate-700 dark:text-slate-300">Belum ada aturan pengecualian khusus</p>
            <p className="text-xs text-slate-400">Semua produk saat ini menggunakan potongan flat default <strong>0.515 kg</strong>.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-slate-100 dark:bg-gray-900 text-slate-700 dark:text-gray-300 border-b border-slate-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3.5 font-bold w-12 text-center">No</th>
                  <th className="px-4 py-3.5 font-bold">Tipe Aturan (Rule Type)</th>
                  <th className="px-4 py-3.5 font-bold">Pencocokan Nilai (Match Value)</th>
                  <th className="px-4 py-3.5 font-bold text-right">Potongan Berat (deduction_kg)</th>
                  <th className="px-4 py-3.5 font-bold text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                {rules.map((rule, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-gray-700/50 transition">
                    <td className="px-4 py-3.5 text-center font-semibold text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        rule.rule_type === 'product_id'
                          ? 'bg-purple-100 text-purple-800 border border-purple-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {rule.rule_type === 'product_id' ? 'ID PRODUK' : 'PATTERN SUBSTRING'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {rule.rule_type === 'product_id' ? (
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {getProductNameById(rule.match_value)}
                          </p>
                          <p className="text-xs text-slate-400 font-mono">ID: {rule.match_value}</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <code className="bg-slate-100 dark:bg-gray-700 px-2 py-1 rounded text-slate-800 dark:text-slate-200 font-mono font-bold">
                            "{rule.match_value}"
                          </code>
                          <span className="text-xs text-slate-400">(Substring nama produk)</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-indigo-600 dark:text-indigo-400 text-base">
                      {rule.deduction_kg.toFixed(3)} <span className="text-xs font-normal text-slate-500">kg</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(rule)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
                          title="Edit Aturan"
                        >
                          <PencilSquareIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(rule)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                          title="Hapus Aturan"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between bg-slate-50 dark:bg-gray-900">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                {isEditing ? 'Edit Aturan Potongan Netto' : 'Tambah Aturan Potongan Netto Baru'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Tipe Aturan (Rule Type)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormRuleType('pattern')}
                    className={`py-2.5 px-3 rounded-lg border text-sm font-semibold transition ${
                      formRuleType === 'pattern'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-300 dark:border-gray-600 text-slate-600 dark:text-gray-300'
                    }`}
                  >
                    Pattern Substring
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormRuleType('product_id')}
                    className={`py-2.5 px-3 rounded-lg border text-sm font-semibold transition ${
                      formRuleType === 'product_id'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-300 dark:border-gray-600 text-slate-600 dark:text-gray-300'
                    }`}
                  >
                    ID Produk Spesifik
                  </button>
                </div>
              </div>

              {formRuleType === 'pattern' ? (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Pattern Substring Nama Produk <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formMatchValuePattern}
                    onChange={e => setFormMatchValuePattern(e.target.value)}
                    placeholder="Contoh: POLYMORPH"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm uppercase font-mono font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Akan mencocokkan setiap nama produk yang mengandung substring kata ini (case-insensitive).
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Pilih Produk Spesifik <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formMatchValueProductId}
                    onChange={e => setFormMatchValueProductId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm font-semibold"
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code}) — ID #{p.id}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Memilih produk spesifik dari tabel database `products`.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Potongan Berat Netto (kg) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={formDeductionKg}
                    onChange={e => setFormDeductionKg(e.target.value)}
                    placeholder="0.862"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm font-bold pr-12"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">kg</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Dikurangkan dari Gross Weight: <code className="bg-slate-100 dark:bg-gray-700 px-1 py-0.5 rounded text-indigo-600 dark:text-indigo-300">Netto = Gross - deduction_kg</code>.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg text-slate-700 dark:text-gray-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-gray-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 shadow"
                >
                  {submitting ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Tambah Aturan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-gray-700">
            <div className="flex items-center gap-3 text-red-600">
              <ExclamationTriangleIcon className="h-7 w-7 flex-shrink-0" />
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                Konfirmasi Hapus Aturan
              </h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-gray-300">
              Apakah Anda yakin ingin menghapus aturan potongan Netto untuk{' '}
              <strong className="text-slate-900 dark:text-white font-mono">
                [{deleteTarget.rule_type}] "{deleteTarget.match_value}"
              </strong>{' '}
              ({deleteTarget.deduction_kg} kg)?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg text-slate-700 dark:text-gray-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-gray-700"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 shadow"
              >
                {submitting ? 'Menghapus...' : 'Ya, Hapus Aturan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
