import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import toast from 'react-hot-toast';
import { confirmDialog } from '../../components/ui';
import {
  DocumentDuplicateIcon, PlusIcon, PencilIcon, TrashIcon, ArrowLeftIcon,
  CheckCircleIcon, DocumentTextIcon, StarIcon, ClockIcon, XMarkIcon, EyeIcon,
  ArrowDownTrayIcon, LockClosedIcon, GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

interface Template {
  id: number;
  template_name: string;
  template_code: string;
  document_type: string;
  is_default: boolean;
  is_active: boolean;
  access_scope: 'all' | 'role' | 'user';
  access_role_ids: number[] | null;
  access_user_ids: number[] | null;
  current_version_id: number | null;
  current_version_number: number | null;
  current_version_status: string | null;
  version_count: number;
  updated_at: string | null;
}

interface RoleOption {
  id: number;
  name: string;
}

interface VersionRow {
  id: number;
  version_number: number;
  status: string;
  change_note: string | null;
  published_at: string | null;
  created_at: string | null;
}

const DOCUMENT_TYPES = [
  { value: 'spk', label: 'SPK (SPK)' },
  { value: 'spk_batch', label: 'SPK (Batch)' },
  { value: 'surat_jalan', label: 'Surat Jalan' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'faktur', label: 'Faktur' },
  { value: 'kwitansi', label: 'Kwitansi' },
];

const STATUS_BADGE: Record<string, string> = {
  published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  draft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  archived: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export default function TemplateList() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<{ template_name: string; template_code: string; document_type: string; access_scope: 'all' | 'role' | 'user'; access_role_ids: number[] }>(
    { template_name: '', template_code: '', document_type: 'spk', access_scope: 'all', access_role_ids: [] }
  );
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [accessTemplate, setAccessTemplate] = useState<Template | null>(null);
  const [accessDraft, setAccessDraft] = useState<{ access_scope: 'all' | 'role' | 'user'; access_role_ids: number[] }>({ access_scope: 'all', access_role_ids: [] });
  const [savingAccess, setSavingAccess] = useState(false);

  useEffect(() => {
    axiosInstance.get('/api/settings/roles').then((res) => setRoles(res.data.roles || [])).catch(() => {});
  }, []);

  useEffect(() => { loadTemplates(); }, [typeFilter]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (typeFilter) params.document_type = typeFilter;
      const response = await axiosInstance.get('/api/documents/templates', { params });
      setTemplates(response.data.templates || []);
    } catch (error) {
      toast.error('Gagal memuat daftar template');
    } finally {
      setLoading(false);
    }
  };

  const toggleHistory = async (id: number) => {
    if (expanded === id) { setExpanded(null); return; }
    try {
      const res = await axiosInstance.get(`/api/documents/templates/${id}`);
      setVersions(res.data.template.versions || []);
      setExpanded(id);
    } catch (e) {
      toast.error('Gagal memuat riwayat versi');
    }
  };

  const handleRollback = async (templateId: number, versionId: number) => {
    if (!(await confirmDialog('Rollback ke versi ini? Versi yang sekarang live akan diarsipkan (tidak dihapus).'))) return;
    try {
      await axiosInstance.post(`/api/documents/templates/${templateId}/versions/${versionId}/rollback`);
      toast.success('Rollback berhasil');
      loadTemplates();
      toggleHistory(templateId); // refresh
      setExpanded(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Gagal rollback');
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await axiosInstance.put(`/api/documents/templates/${id}`, { is_default: true });
      toast.success('Default template diperbarui');
      loadTemplates();
    } catch (error) {
      toast.error('Gagal set default');
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirmDialog('Hapus template ini? Semua riwayat versinya ikut terhapus. Tidak bisa dilakukan kalau ada dokumen yang sudah pakai template ini.'))) return;
    try {
      await axiosInstance.delete(`/api/documents/templates/${id}`);
      toast.success('Template dihapus');
      loadTemplates();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Gagal menghapus template');
    }
  };

  const handlePreview = async (template: Template) => {
    if (!template.current_version_id) {
      toast.error('Template ini belum punya versi live untuk di-preview.');
      return;
    }
    setPreviewTemplate(template);
    setPreviewLoading(true);
    try {
      const res = await axiosInstance.post(
        `/api/documents/templates/${template.id}/versions/${template.current_version_id}/preview-pdf`,
        {},
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      setPreviewUrl((prev) => { if (prev) window.URL.revokeObjectURL(prev); return url; });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Gagal membuat preview PDF');
      setPreviewTemplate(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewTemplate(null);
    if (previewUrl) { window.URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
  };

  const handleEdit = async (template: Template) => {
    if (template.current_version_id && template.current_version_status === 'draft') {
      navigate(`/app/documents/templates/${template.id}/versions/${template.current_version_id}/edit`);
      return;
    }
    // Live/archived (or no version at all) - start a fresh draft to edit, copying the live design if there is one.
    try {
      const res = await axiosInstance.post(`/api/documents/templates/${template.id}/versions`, {
        copy_from_version_id: template.current_version_id,
      });
      navigate(`/app/documents/templates/${template.id}/versions/${res.data.version_id}/edit`);
    } catch (e) {
      toast.error('Gagal membuat draft baru untuk diedit');
    }
  };

  const handleCreate = async () => {
    if (!form.template_name || !form.template_code || !form.document_type) {
      toast.error('Semua field wajib diisi');
      return;
    }
    setCreating(true);
    try {
      const res = await axiosInstance.post('/api/documents/templates', form);
      setShowCreateModal(false);
      navigate(`/app/documents/templates/${res.data.template_id}/versions/${res.data.version_id}/edit`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Gagal membuat template');
    } finally {
      setCreating(false);
    }
  };

  const openAccessEditor = (template: Template) => {
    setAccessTemplate(template);
    setAccessDraft({ access_scope: template.access_scope || 'all', access_role_ids: template.access_role_ids || [] });
  };

  const toggleAccessRole = (roleId: number) => {
    setAccessDraft((prev) => ({
      ...prev,
      access_role_ids: prev.access_role_ids.includes(roleId)
        ? prev.access_role_ids.filter((id) => id !== roleId)
        : [...prev.access_role_ids, roleId],
    }));
  };

  const handleSaveAccess = async () => {
    if (!accessTemplate) return;
    if (accessDraft.access_scope === 'role' && accessDraft.access_role_ids.length === 0) {
      toast.error('Pilih minimal 1 role, atau ganti ke "Semua User".');
      return;
    }
    setSavingAccess(true);
    try {
      await axiosInstance.put(`/api/documents/templates/${accessTemplate.id}`, accessDraft);
      toast.success('Akses template diperbarui');
      setAccessTemplate(null);
      loadTemplates();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Gagal menyimpan akses');
    } finally {
      setSavingAccess(false);
    }
  };

  const getDocumentTypeLabel = (type: string) => DOCUMENT_TYPES.find((t) => t.value === type)?.label || type;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/app/documents')} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <DocumentDuplicateIcon className="h-8 w-8" />
                Print Template Designer
              </h1>
              <p className="text-purple-100 mt-1">Kelola desain cetak dokumen (SPK, Invoice, Surat Jalan, dst)</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition-colors shadow-md"
          >
            <PlusIcon className="h-5 w-5 mr-2" /> Template Baru
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setTypeFilter('')} className={`px-4 py-2 rounded-lg font-medium transition-colors ${typeFilter === '' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200'}`}>
            Semua Tipe
          </button>
          {DOCUMENT_TYPES.map((type) => (
            <button key={type.value} onClick={() => setTypeFilter(type.value)} className={`px-4 py-2 rounded-lg font-medium transition-colors ${typeFilter === type.value ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200'}`}>
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <DocumentDuplicateIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">Belum ada template</p>
            <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center text-indigo-600 hover:text-indigo-800">
              <PlusIcon className="h-4 w-4 mr-1" /> Buat template pertama
            </button>
          </div>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                    <DocumentTextIcon className="h-8 w-8 text-indigo-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    {template.is_default && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                        <StarSolidIcon className="h-3 w-3" /> Default
                      </span>
                    )}
                    {template.current_version_status && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[template.current_version_status] || ''}`}>
                        {template.current_version_status === 'published' ? 'Live' : template.current_version_status === 'draft' ? 'Draft' : 'Arsip'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-5">
                <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-1">{template.template_name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{getDocumentTypeLabel(template.document_type)}</p>

                <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                  <span>Kode: {template.template_code}</span>
                  <span>{template.version_count} versi</span>
                  {template.current_version_number && <span>v{template.current_version_number} live</span>}
                </div>

                <button
                  onClick={() => openAccessEditor(template)}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full mb-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  title="Atur siapa yang bisa lihat/edit template ini"
                >
                  {template.access_scope === 'all' ? <GlobeAltIcon className="h-3.5 w-3.5" /> : <LockClosedIcon className="h-3.5 w-3.5" />}
                  {template.access_scope === 'all' ? 'Semua User' : `${(template.access_role_ids || []).length} Role`}
                </button>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={() => handleSetDefault(template.id)}
                    className={`p-2 rounded-lg transition-colors ${template.is_default ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'}`}
                    title={template.is_default ? 'Template Default' : 'Jadikan Default'}
                  >
                    {template.is_default ? <StarSolidIcon className="h-5 w-5" /> : <StarIcon className="h-5 w-5" />}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handlePreview(template)}
                      disabled={!template.current_version_id}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                      title={template.current_version_id ? 'Preview PDF (versi live)' : 'Belum ada versi live'}
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                    <button onClick={() => toggleHistory(template.id)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Riwayat Versi">
                      <ClockIcon className="h-5 w-5" />
                    </button>
                    <button onClick={() => handleEdit(template)} className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Edit">
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button onClick={() => handleDelete(template.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Hapus">
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {expanded === template.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-500 mb-2">Riwayat Versi</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {versions.map((v) => (
                        <div key={v.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-gray-50 dark:bg-gray-900">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">v{v.version_number}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${STATUS_BADGE[v.status] || ''}`}>{v.status}</span>
                          </div>
                          {v.status === 'archived' && (
                            <button onClick={() => handleRollback(template.id, v.id)} className="text-indigo-600 hover:underline">Rollback</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Template Baru</h3>
              <button onClick={() => setShowCreateModal(false)}><XMarkIcon className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nama Template</label>
                <input value={form.template_name} onChange={(e) => setForm({ ...form, template_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm" placeholder="mis. SPK Batch - Versi Baru" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Kode Template (unik)</label>
                <input value={form.template_code} onChange={(e) => setForm({ ...form, template_code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm" placeholder="mis. SPK_BATCH_V2" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Tipe Dokumen</label>
                <select value={form.document_type} onChange={(e) => setForm({ ...form, document_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm">
                  {DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Akses</label>
                <select
                  value={form.access_scope}
                  onChange={(e) => setForm({ ...form, access_scope: e.target.value as 'all' | 'role', access_role_ids: [] })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                >
                  <option value="all">Semua User</option>
                  <option value="role">Role Tertentu</option>
                </select>
                {form.access_scope === 'role' && (
                  <div className="mt-2 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {roles.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setForm((prev) => ({
                          ...prev,
                          access_role_ids: prev.access_role_ids.includes(r.id)
                            ? prev.access_role_ids.filter((id) => id !== r.id)
                            : [...prev.access_role_ids, r.id],
                        }))}
                        className={`px-2 py-1 text-xs rounded-full border ${form.access_role_ids.includes(r.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreateModal(false)} className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">Batal</button>
              <button onClick={handleCreate} disabled={creating} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {creating ? 'Membuat...' : 'Buat & Buka Editor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {accessTemplate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setAccessTemplate(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Atur Akses — {accessTemplate.template_name}</h3>
              <button onClick={() => setAccessTemplate(null)}><XMarkIcon className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4">Admin/Super Admin selalu bisa lihat & edit semua template, apa pun pengaturan di sini.</p>
            <div className="space-y-3">
              <select
                value={accessDraft.access_scope}
                onChange={(e) => setAccessDraft({ access_scope: e.target.value as 'all' | 'role', access_role_ids: [] })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
              >
                <option value="all">Semua User</option>
                <option value="role">Role Tertentu</option>
              </select>
              {accessDraft.access_scope === 'role' && (
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {roles.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleAccessRole(r.id)}
                      className={`px-2 py-1 text-xs rounded-full border ${accessDraft.access_role_ids.includes(r.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}
                    >
                      {r.name}
                    </button>
                  ))}
                  {roles.length === 0 && <p className="text-xs text-gray-400">Belum ada role terdaftar.</p>}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setAccessTemplate(null)} className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">Batal</button>
              <button onClick={handleSaveAccess} disabled={savingAccess} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {savingAccess ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={closePreview}>
          <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-4xl h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {previewTemplate.template_name} <span className="text-xs text-gray-400">v{previewTemplate.current_version_number} (live)</span>
              </h3>
              <div className="flex items-center gap-2">
                {previewUrl && (
                  <a
                    href={previewUrl}
                    download={`${previewTemplate.template_code}.pdf`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <ArrowDownTrayIcon className="w-3.5 h-3.5" /> Unduh
                  </a>
                )}
                <button onClick={closePreview} className="p-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100 dark:bg-gray-950 overflow-hidden">
              {previewLoading && (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">Membuat preview PDF...</div>
              )}
              {!previewLoading && previewUrl && (
                <iframe title="Preview PDF" src={previewUrl} className="w-full h-full border-0" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
