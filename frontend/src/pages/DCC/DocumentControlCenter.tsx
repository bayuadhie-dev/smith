import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, AlertTriangle, Mail, Trash2, BarChart3, Plus, Search, Eye, Upload, CheckCircle, Clock, XCircle, ChevronDown, ChevronRight, RefreshCw, Filter, Download, Edit, MessageSquare, Send, ClipboardList, BookOpen, Archive } from 'lucide-react';

// ============================================================
// TypeScript Interfaces
// ============================================================
interface DccDocumentItem {
  id: number;
  document_number: string;
  title: string;
  document_level: string;
  level_name: string;
  department_code: string;
  retention_period_years: number | null;
  is_active: boolean;
  created_at: string | null;
  created_by: string | null;
  current_revision: RevisionSummary | null;
  total_revisions: number;
}

interface RevisionSummary {
  id: number;
  revision_number: number;
  status: string;
  effective_date: string | null;
}

interface RevisionDetail extends RevisionSummary {
  change_reason: string | null;
  change_type: string | null;
  originator: string | null;
  originator_signed_at: string | null;
  reviewer: string | null;
  reviewer_signed_at: string | null;
  reviewer_status: string | null;
  required_reviewers: number;
  reviewer2: string | null;
  reviewer2_signed_at: string | null;
  reviewer2_status: string | null;
  reviewer2_notes: string | null;
  approver: string | null;
  approver_signed_at: string | null;
  approver_status: string | null;
  pdf_file_path: string | null;
  docx_file_path: string | null;
  created_at: string | null;
}

interface CapaItem {
  id: number;
  capa_number: string;
  capa_type: string;
  capa_source: string | null;
  issue_description: string;
  product_affected: string | null;
  status: string;
  raised_by: string | null;
  raised_date: string | null;
  assigned_department: string | null;
  supplier_name: string | null;
  due_date: string | null;
  closed_at: string | null;
  is_overdue: boolean;
  has_investigation: boolean;
  has_verification: boolean;
}

interface MemoItem {
  id: number;
  memo_number: string;
  subject: string;
  category: string;
  status: string;
  published_by: string | null;
  published_date: string | null;
  read_count: number;
  total_recipients: number;
  created_at: string | null;
}

interface DestructionItem {
  id: number;
  destruction_number: string;
  document_type: string;
  destruction_date: string | null;
  document_form: string;
  method_physical: string | null;
  method_digital: string | null;
  reason: string;
  destroyed_by: string | null;
  witnessed_by: string | null;
  witness_confirmed: boolean;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
}

interface QualityRecordItem {
  id: number;
  record_number: string;
  title: string;
  record_type: string;
  revision_number: number;
  department: string;
  storage_location: string | null;
  retention_period: string | null;
  is_confidential: boolean;
  status: string;
  published_date: string | null;
  holder: string | null;
  created_by: string | null;
}

interface DistributionItem {
  id: number;
  revision_id: number;
  copy_number: number;
  copy_type: string;
  department_target: string;
  distributed_at: string | null;
  distributed_by: string | null;
  received_by: string | null;
  received_at: string | null;
  is_acknowledged: boolean;
  old_copy_returned: boolean;
}

interface ExpiringDoc {
  document_id: number;
  document_number: string;
  title: string;
  revision_number: number;
  expiry_date: string | null;
  days_remaining: number | null;
}

interface DashboardStats {
  statistics: {
    total_documents: number;
    capa_open: number;
    capa_closed: number;
    capa_overdue: number;
    total_memos: number;
    total_destructions: number;
  };
  recent_capa: CapaItem[];
}

interface Department {
  code: string;
  name: string;
}

const API_BASE = '/api/dcc';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
};

const fetchApi = async (url: string, options?: RequestInit) => {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options?.headers || {}) },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

const downloadFile = async (url: string, filename: string) => {
  const res = await fetch(`${API_BASE}${url}`, { headers: getAuthHeaders() });
  if (!res.ok) { alert('Download gagal: ' + (await res.text())); return; }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

// Status badges
const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
    reviewing: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Reviewing' },
    pending_approval: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending Approval' },
    active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
    obsolete: { bg: 'bg-red-100', text: 'text-red-700', label: 'Obsolete' },
    open: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Open' },
    investigation: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Investigation' },
    action_progress: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'In Progress' },
    verifying: { bg: 'bg-cyan-100', text: 'text-cyan-700', label: 'Verifying' },
    closed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Closed' },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Cancelled' },
    published: { bg: 'bg-green-100', text: 'text-green-700', label: 'Published' },
  };
  const c = config[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>{c.label}</span>;
};

// ============================================================
// DOCUMENT LIST TAB
// ============================================================
const DocumentListTab = () => {
  const [docs, setDocs] = useState<DccDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [formData, setFormData] = useState({ document_number: '', title: '', document_level: 'II', department_code: 'DCC', retention_period_years: 5, required_reviewers: 1, assigned_reviewer_id: '', assigned_reviewer2_id: '', assigned_approver_id: '' });
  const [userList, setUserList] = useState<{id: number; full_name: string; department: string; position: string}[]>([]);
  const [sortCol, setSortCol] = useState<string>('document_number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const sortedDocs = [...docs].sort((a, b) => {
    let va: any, vb: any;
    switch (sortCol) {
      case 'document_number': va = a.document_number; vb = b.document_number; break;
      case 'title': va = a.title; vb = b.title; break;
      case 'level': va = a.document_level; vb = b.document_level; break;
      case 'dept': va = a.department_code; vb = b.department_code; break;
      case 'revision': va = a.current_revision?.revision_number ?? -1; vb = b.current_revision?.revision_number ?? -1; break;
      case 'status': va = a.current_revision?.status || ''; vb = b.current_revision?.status || ''; break;
      default: return 0;
    }
    if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb as string).toLowerCase(); }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const SortHeader = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <th className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors"
      onClick={() => handleSort(col)}>
      <div className="flex items-center gap-1">
        {children}
        <span className="text-xs">{sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </div>
    </th>
  );

  useEffect(() => {
    fetchApi('/users').then(d => setUserList(d.users || [])).catch(() => {});
  }, []);

  const handleDelete = async (e: React.MouseEvent, docId: number, docNumber: string) => {
    e.stopPropagation();
    if (!confirm(`Hapus dokumen ${docNumber} beserta semua revisi dan distribusinya?`)) return;
    try {
      await fetchApi(`/documents/${docId}`, { method: 'DELETE' });
      loadDocs();
    } catch (err: any) { alert('Error: ' + err.message); }
  };

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (levelFilter) params.set('level', levelFilter);
      const data = await fetchApi(`/documents?${params}`);
      setDocs(data.documents || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [search, levelFilter]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleCreate = async () => {
    try {
      await fetchApi('/documents', { method: 'POST', body: JSON.stringify(formData) });
      setShowForm(false);
      setFormData({ document_number: '', title: '', document_level: 'II', department_code: 'DCC', retention_period_years: 5, required_reviewers: 1, assigned_reviewer_id: '', assigned_reviewer2_id: '', assigned_approver_id: '' });
      loadDocs();
    } catch (e: any) { alert('Error: ' + e.message); }
  };

  const levels = [
    { value: 'I', label: 'Level I - Quality Manual' },
    { value: 'II', label: 'Level II - Quality Procedure (QP)' },
    { value: 'III', label: 'Level III - Work Instruction (WI)' },
    { value: 'IV', label: 'Level IV - Form / Standard' },
  ];

  const departments = [
    { code: 'MRE', name: 'Manajemen Review' },
    { code: 'DCC', name: 'Document Control Centre' },
    { code: 'MKT', name: 'Marketing & Sales' },
    { code: 'PRC', name: 'Purchasing' },
    { code: 'RND', name: 'Research And Development' },
    { code: 'HRD', name: 'Human Resource Department' },
    { code: 'EPD', name: 'End Product' },
    { code: 'QAS', name: 'Quality Assurance' },
    { code: 'PIC', name: 'Production, Planning & Inventory Control' },
    { code: 'MTC', name: 'Maintenance' },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 items-center flex-1 min-w-[200px]">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Cari dokumen..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Semua Level</option>
            {levels.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Tambah Dokumen
        </button>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Tambah Dokumen Baru</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Dokumen</label>
                <input type="text" value={formData.document_number} onChange={e => setFormData({ ...formData, document_number: e.target.value })}
                  placeholder="cth: QP-DCC-01" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Judul Dokumen</label>
                <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Control of Document" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Level Dokumen</label>
                  <select value={formData.document_level} onChange={e => setFormData({ ...formData, document_level: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    {levels.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departemen</label>
                  <select value={formData.department_code} onChange={e => setFormData({ ...formData, department_code: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    {departments.map(d => <option key={d.code} value={d.code}>{d.code} - {d.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Masa Retensi (tahun)</label>
                  <input type="number" value={formData.retention_period_years} onChange={e => setFormData({ ...formData, retention_period_years: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Checker / Pengkaji</label>
                  <select value={formData.required_reviewers} onChange={e => setFormData({ ...formData, required_reviewers: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value={1}>1 Checker</option>
                    <option value={2}>2 Checker</option>
                  </select>
                </div>
              </div>
              <div className="border-t pt-3 mt-2">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Pilih Checker & Approver</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Checker 1 (Pemeriksa)</label>
                    <select value={formData.assigned_reviewer_id} onChange={e => setFormData({ ...formData, assigned_reviewer_id: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="">-- Bebas (sesuai role) --</option>
                      {userList.map(u => <option key={u.id} value={u.id}>{u.full_name}{u.position ? ` (${u.position})` : ''}</option>)}
                    </select>
                  </div>
                  {formData.required_reviewers >= 2 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Checker 2</label>
                      <select value={formData.assigned_reviewer2_id} onChange={e => setFormData({ ...formData, assigned_reviewer2_id: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm">
                        <option value="">-- Bebas (sesuai role) --</option>
                        {userList.map(u => <option key={u.id} value={u.id}>{u.full_name}{u.position ? ` (${u.position})` : ''}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Approver (Pengesah)</label>
                    <select value={formData.assigned_approver_id} onChange={e => setFormData({ ...formData, assigned_approver_id: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="">-- Bebas (sesuai role) --</option>
                      {userList.map(u => <option key={u.id} value={u.id}>{u.full_name}{u.position ? ` (${u.position})` : ''}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Document Detail Modal */}
      {selectedDoc && <DocumentDetailModal docId={selectedDoc} onClose={() => { setSelectedDoc(null); loadDocs(); }} />}

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <SortHeader col="document_number">No. Dokumen</SortHeader>
              <SortHeader col="title">Judul</SortHeader>
              <SortHeader col="level">Level</SortHeader>
              <SortHeader col="dept">Dept</SortHeader>
              <SortHeader col="revision">Revisi</SortHeader>
              <SortHeader col="status">Status</SortHeader>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-500">Memuat...</td></tr>
            ) : sortedDocs.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Belum ada dokumen</td></tr>
            ) : sortedDocs.map(doc => (
              <tr key={doc.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedDoc(doc.id)}>
                <td className="px-4 py-3 font-mono font-medium text-blue-600">{doc.document_number}</td>
                <td className="px-4 py-3">{doc.title}</td>
                <td className="px-4 py-3"><span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{doc.level_name}</span></td>
                <td className="px-4 py-3">{doc.department_code}</td>
                <td className="px-4 py-3">Rev {doc.current_revision?.revision_number?.toString().padStart(2, '0') ?? '00'}</td>
                <td className="px-4 py-3"><StatusBadge status={doc.current_revision?.status || 'draft'} /></td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button className="text-blue-600 hover:text-blue-800" title="Lihat Detail"><Eye className="w-4 h-4" /></button>
                    <button onClick={(e) => handleDelete(e, doc.id, doc.document_number)} className="text-red-400 hover:text-red-600" title="Hapus">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Document Detail Modal
const DocumentDetailModal = ({ docId, onClose }: { docId: number; onClose: () => void }) => {
  const [detail, setDetail] = useState<{ document: DccDocumentItem; revisions: RevisionDetail[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'revisions' | 'distribution'>('revisions');
  const [distributions, setDistributions] = useState<DistributionItem[]>([]);
  const [showDistForm, setShowDistForm] = useState(false);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [passwordDialog, setPasswordDialog] = useState<{revId: number; action: string; notes: string} | null>(null);
  const [signPassword, setSignPassword] = useState('');
  const [signError, setSignError] = useState('');
  const [changeNotices, setChangeNotices] = useState<any[]>([]);
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revFormData, setRevFormData] = useState({ change_notice_id: '', change_reason: '', change_type: 'content_change', required_reviewers: 1, assigned_reviewer_id: '', assigned_reviewer2_id: '', assigned_approver_id: '' });
  const [revUserList, setRevUserList] = useState<{id: number; full_name: string; position: string}[]>([]);

  const departments = [
    { code: 'MRE', name: 'Manajemen Review' }, { code: 'DCC', name: 'Document Control Centre' },
    { code: 'MKT', name: 'Marketing & Sales' }, { code: 'PRC', name: 'Purchasing' },
    { code: 'RND', name: 'Research And Development' }, { code: 'HRD', name: 'Human Resource Department' },
    { code: 'EPD', name: 'End Product' }, { code: 'QAS', name: 'Quality Assurance' },
    { code: 'PIC', name: 'Production, Planning & Inventory Control' }, { code: 'MTC', name: 'Maintenance' },
  ];

  const loadAll = async () => {
    try {
      const [docData, distData, dcnData, userData] = await Promise.all([
        fetchApi(`/documents/${docId}`),
        fetchApi(`/documents/${docId}/distributions`),
        fetchApi(`/documents/${docId}/change-notices`),
        fetchApi(`/users`),
      ]);
      setDetail(docData);
      setDistributions(distData.distributions || []);
      setChangeNotices(dcnData.change_notices || []);
      setRevUserList(userData.users || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [docId]);

  const openSignDialog = (revId: number, action: string) => {
    const notes = action.includes('reject') ? prompt('Alasan penolakan:') || '' : '';
    setPasswordDialog({ revId, action, notes });
    setSignPassword('');
    setSignError('');
  };

  const handleConfirmSign = async () => {
    if (!passwordDialog) return;
    if (!signPassword) { setSignError('Password wajib diisi'); return; }
    try {
      const res = await fetch(`${API_BASE}/revisions/${passwordDialog.revId}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: passwordDialog.action, notes: passwordDialog.notes, password: signPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setSignError(data.error || 'Gagal'); return; }
      setPasswordDialog(null);
      setSignPassword('');
      loadAll();
    } catch (e: any) { setSignError(e.message); }
  };

  // DCN yang approved dan belum punya revisi
  const availableDcns = changeNotices.filter((n: any) => n.status === 'approved' && !n.resulting_revision_id);
  const canCreateRevision = availableDcns.length > 0;

  const openRevisionForm = () => {
    const firstDcn = availableDcns[0];
    setRevFormData({
      change_notice_id: firstDcn?.id?.toString() || '',
      change_reason: firstDcn ? `[${firstDcn.request_number}] ${firstDcn.change_description}` : '',
      change_type: firstDcn?.change_type || 'content_change',
      required_reviewers: 1,
      assigned_reviewer_id: '',
      assigned_reviewer2_id: '',
      assigned_approver_id: '',
    });
    setShowRevisionForm(true);
  };

  const handleNewRevision = async () => {
    if (!revFormData.change_notice_id) { alert('Pilih Change Notice'); return; }
    try {
      const payload: any = { ...revFormData, change_notice_id: Number(revFormData.change_notice_id) };
      if (payload.assigned_reviewer_id) payload.assigned_reviewer_id = Number(payload.assigned_reviewer_id);
      else delete payload.assigned_reviewer_id;
      if (payload.assigned_reviewer2_id) payload.assigned_reviewer2_id = Number(payload.assigned_reviewer2_id);
      else delete payload.assigned_reviewer2_id;
      if (payload.assigned_approver_id) payload.assigned_approver_id = Number(payload.assigned_approver_id);
      else delete payload.assigned_approver_id;

      await fetchApi(`/documents/${docId}/revisions`, { method: 'POST', body: JSON.stringify(payload) });
      setShowRevisionForm(false);
      loadAll();
    } catch (e: any) { alert('Error: ' + e.message); }
  };

  const handleFileUpload = async (revId: number, accept: string = '.pdf,.docx,.doc,.xlsx,.xls') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      const token = localStorage.getItem('token');
      try {
        const res = await fetch(`${API_BASE}/revisions/${revId}/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
        const data = await res.json();
        if (!res.ok) { alert(data.error || 'Upload gagal'); return; }
        loadAll();
      } catch (e: any) { alert('Error: ' + e.message); }
    };
    input.click();
  };

  const handleDistribute = async () => {
    if (selectedDepts.length === 0) return alert('Pilih minimal 1 departemen');
    const activeRev = detail?.revisions?.find((r: any) => r.status === 'active');
    if (!activeRev) return alert('Tidak ada revisi aktif untuk didistribusikan');
    try {
      await fetchApi(`/documents/${docId}/distribute`, {
        method: 'POST', body: JSON.stringify({ revision_id: activeRev.id, departments: selectedDepts, copy_type: 'controlled' })
      });
      setShowDistForm(false);
      setSelectedDepts([]);
      loadAll();
    } catch (e: any) { alert('Error: ' + e.message); }
  };

  const handleAcknowledge = async (distId: number) => {
    try {
      await fetchApi(`/distribution/${distId}/acknowledge`, { method: 'POST', body: JSON.stringify({ old_copy_returned: true }) });
      loadAll();
    } catch (e: any) { alert('Error: ' + e.message); }
  };

  if (loading) return <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-xl p-8">Memuat...</div></div>;
  if (!detail) return null;

  const { document: doc, revisions } = detail;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-lg font-semibold">{doc.document_number}</h3>
            <p className="text-sm text-gray-500">{doc.title}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={openRevisionForm} disabled={!canCreateRevision}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${canCreateRevision ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              title={canCreateRevision ? `${availableDcns.length} DCN siap diproses` : 'Ajukan & setujui Change Notice (DCN) terlebih dahulu'}>
              <Plus className="w-3 h-3" /> Revisi Baru {canCreateRevision && <span className="bg-blue-500 text-white text-[10px] px-1.5 rounded-full">{availableDcns.length}</span>}
            </button>
            <button onClick={() => setShowDistForm(true)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
              <Send className="w-3 h-3" /> Distribusi
            </button>
            <button onClick={onClose} className="px-3 py-1.5 border rounded-lg text-sm">Tutup</button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Info */}
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-500">Level:</span> <span className="font-medium">{doc.level_name}</span></div>
            <div><span className="text-gray-500">Dept:</span> <span className="font-medium">{doc.department_code}</span></div>
            <div><span className="text-gray-500">Retensi:</span> <span className="font-medium">{doc.retention_period_years ? `${doc.retention_period_years} tahun` : '-'}</span></div>
            <div><span className="text-gray-500">Dibuat oleh:</span> <span className="font-medium">{doc.created_by || '-'}</span></div>
          </div>

          {/* Section tabs */}
          <div className="flex border-b">
            <button onClick={() => setActiveSection('revisions')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 ${activeSection === 'revisions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
              Revisi & Approval
            </button>
            <button onClick={() => setActiveSection('distribution')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 flex items-center gap-1 ${activeSection === 'distribution' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500'}`}>
              Distribusi <span className="text-xs bg-gray-100 px-1.5 rounded-full">{distributions.length}</span>
            </button>
          </div>

          {/* REVISIONS & APPROVAL SECTION */}
          {activeSection === 'revisions' && (
            <div>
              <h4 className="font-semibold mb-3">Riwayat Revisi & Approval</h4>
              <div className="space-y-3">
                {revisions.map((rev: any) => (
                  <div key={rev.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold">Rev {rev.revision_number.toString().padStart(2, '0')}</span>
                        <StatusBadge status={rev.status} />
                      </div>
                      <button onClick={() => downloadFile(`/revisions/${rev.id}/export-pdf`, `${doc.document_number}_Rev${rev.revision_number.toString().padStart(2,'0')}_Controlled.pdf`)}
                        className="flex items-center gap-1 text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 font-medium">
                        <FileText className="w-3 h-3" /> Export Controlled PDF
                      </button>
                    </div>

                    {/* File Management */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase self-center mr-1">Files:</span>
                      {/* Upload */}
                      <button onClick={() => handleFileUpload(rev.id, '.pdf')} className="flex items-center gap-1 text-[11px] px-2 py-1 border border-dashed rounded hover:bg-gray-50 text-gray-500">
                        <Upload className="w-3 h-3" /> Upload PDF
                      </button>
                      <button onClick={() => handleFileUpload(rev.id, '.docx,.doc')} className="flex items-center gap-1 text-[11px] px-2 py-1 border border-dashed rounded hover:bg-gray-50 text-gray-500">
                        <Upload className="w-3 h-3" /> Upload .docx
                      </button>
                      <button onClick={() => handleFileUpload(rev.id, '.xlsx,.xls')} className="flex items-center gap-1 text-[11px] px-2 py-1 border border-dashed rounded hover:bg-gray-50 text-gray-500">
                        <Upload className="w-3 h-3" /> Upload .xlsx
                      </button>
                      <span className="border-l mx-1" />
                      {/* Download */}
                      {rev.pdf_file_path && (
                        <button onClick={() => downloadFile(`/revisions/${rev.id}/download?type=pdf`, `${doc.document_number}_Rev${rev.revision_number.toString().padStart(2,'0')}.pdf`)}
                          className="flex items-center gap-1 text-[11px] px-2 py-1 bg-red-50 border border-red-200 rounded hover:bg-red-100 text-red-700 font-medium">
                          <Download className="w-3 h-3" /> PDF
                        </button>
                      )}
                      {rev.docx_file_path && (
                        <button onClick={() => downloadFile(`/revisions/${rev.id}/download?type=docx`, `${doc.document_number}_Rev${rev.revision_number.toString().padStart(2,'0')}.docx`)}
                          className="flex items-center gap-1 text-[11px] px-2 py-1 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 text-blue-700 font-medium">
                          <Download className="w-3 h-3" /> .docx
                        </button>
                      )}
                      {rev.xlsx_file_path && (
                        <button onClick={() => downloadFile(`/revisions/${rev.id}/download?type=xlsx`, `${doc.document_number}_Rev${rev.revision_number.toString().padStart(2,'0')}.xlsx`)}
                          className="flex items-center gap-1 text-[11px] px-2 py-1 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 text-emerald-700 font-medium">
                          <Download className="w-3 h-3" /> .xlsx
                        </button>
                      )}
                    </div>

                    {rev.change_reason && <p className="text-sm text-gray-600 mb-1">Alasan: {rev.change_reason}</p>}
                    <div className="flex gap-3 text-xs text-gray-500">
                      {rev.change_type && <span>Jenis: <span className="font-medium text-gray-700">{rev.change_type === 'content_change' ? 'Perubahan Isi' : rev.change_type === 'format_change' ? 'Perubahan Format' : rev.change_type === 'new_document' ? 'Dokumen Baru' : rev.change_type}</span></span>}
                      {rev.effective_date && <span>Efektif: <span className="font-medium text-gray-700">{rev.effective_date}</span></span>}
                      {rev.created_at && <span>Dibuat: <span className="font-medium text-gray-700">{new Date(rev.created_at).toLocaleDateString('id-ID')}</span></span>}
                    </div>

                    {/* 3-tier Approval Chain */}
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Approval Chain (Sesuai QP-DCC-01)</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className={`p-3 rounded-lg ${rev.originator_signed_at ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-200'} border`}>
                          <div className="font-semibold text-gray-700">1. Pembuat</div>
                          <div className="mt-1">{rev.originator || '-'}</div>
                          {rev.originator_signed_at ? (
                            <><div className="text-green-700 mt-1 font-medium">✓ Ditandatangani</div>
                            <div className="text-gray-500 mt-0.5" style={{fontSize:'9px'}}>{new Date(rev.originator_signed_at).toLocaleString('id-ID', {timeZone:'Asia/Jakarta', day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})} WIB</div></>
                          ) : rev.status === 'draft' ? (
                            <button onClick={() => openSignDialog(rev.id, 'sign')} className="mt-2 w-full py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700">
                              Tandatangani
                            </button>
                          ) : <div className="text-gray-400 mt-1">Menunggu...</div>}
                        </div>

                        <div className={`p-3 rounded-lg ${rev.reviewer_signed_at ? 'bg-green-50 border-green-300' : rev.status === 'reviewing' ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-200'} border`}>
                          <div className="font-semibold text-gray-700">2. Pemeriksa / Pengkaji</div>
                          {rev.assigned_reviewer && !rev.reviewer_signed_at && <div className="text-xs text-blue-600 mt-0.5">Ditugaskan: {rev.assigned_reviewer}</div>}
                          <div className="mt-1">{rev.reviewer || '-'}</div>
                          {rev.reviewer_signed_at ? (
                            <><div className={`mt-1 font-medium ${rev.reviewer_status === 'approved' ? 'text-green-700' : 'text-red-600'}`}>
                              {rev.reviewer_status === 'approved' ? '✓ Disetujui' : '✗ Ditolak'}
                            </div>
                            <div className="text-gray-500 mt-0.5" style={{fontSize:'9px'}}>{new Date(rev.reviewer_signed_at).toLocaleString('id-ID', {timeZone:'Asia/Jakarta', day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})} WIB</div></>
                          ) : rev.status === 'reviewing' ? (
                            <div className="flex gap-1 mt-2">
                              <button onClick={() => openSignDialog(rev.id, 'review_approve')} className="flex-1 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700">✓ Setujui</button>
                              <button onClick={() => openSignDialog(rev.id, 'review_reject')} className="flex-1 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700">✗ Tolak</button>
                            </div>
                          ) : <div className="text-gray-400 mt-1">Menunggu...</div>}
                        </div>

                        {/* Reviewer 2 (jika required_reviewers >= 2) */}
                        {(rev.required_reviewers || 1) >= 2 && (
                          <div className={`p-3 rounded-lg ${rev.reviewer2_signed_at ? 'bg-green-50 border-green-300' : rev.status === 'reviewing' ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-200'} border`}>
                            <div className="font-semibold text-gray-700">2b. Pengkaji 2</div>
                            {rev.assigned_reviewer2 && !rev.reviewer2_signed_at && <div className="text-xs text-blue-600 mt-0.5">Ditugaskan: {rev.assigned_reviewer2}</div>}
                            <div className="mt-1">{rev.reviewer2 || '-'}</div>
                            {rev.reviewer2_signed_at ? (
                              <><div className={`mt-1 font-medium ${rev.reviewer2_status === 'approved' ? 'text-green-700' : 'text-red-600'}`}>
                                {rev.reviewer2_status === 'approved' ? '✓ Disetujui' : '✗ Ditolak'}
                              </div>
                              <div className="text-gray-500 mt-0.5" style={{fontSize:'9px'}}>{new Date(rev.reviewer2_signed_at).toLocaleString('id-ID', {timeZone:'Asia/Jakarta', day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})} WIB</div></>
                            ) : rev.status === 'reviewing' ? (
                              <div className="flex gap-1 mt-2">
                                <button onClick={() => openSignDialog(rev.id, 'review2_approve')} className="flex-1 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700">✓ Setujui</button>
                                <button onClick={() => openSignDialog(rev.id, 'review2_reject')} className="flex-1 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700">✗ Tolak</button>
                              </div>
                            ) : <div className="text-gray-400 mt-1">Menunggu...</div>}
                          </div>
                        )}

                        <div className={`p-3 rounded-lg ${rev.approver_signed_at ? 'bg-green-50 border-green-300' : rev.status === 'pending_approval' ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-200'} border`}>
                          <div className="font-semibold text-gray-700">{(rev.required_reviewers || 1) >= 2 ? '4' : '3'}. Pengesah</div>
                          {rev.assigned_approver && !rev.approver_signed_at && <div className="text-xs text-blue-600 mt-0.5">Ditugaskan: {rev.assigned_approver}</div>}
                          <div className="mt-1">{rev.approver || '-'}</div>
                          {rev.approver_signed_at ? (
                            <><div className={`mt-1 font-medium ${rev.approver_status === 'approved' ? 'text-green-700' : 'text-red-600'}`}>
                              {rev.approver_status === 'approved' ? '✓ Disahkan' : '✗ Ditolak'}
                            </div>
                            <div className="text-gray-500 mt-0.5" style={{fontSize:'9px'}}>{new Date(rev.approver_signed_at).toLocaleString('id-ID', {timeZone:'Asia/Jakarta', day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})} WIB</div></>
                          ) : rev.status === 'pending_approval' ? (
                            <div className="flex gap-1 mt-2">
                              <button onClick={() => openSignDialog(rev.id, 'approve')} className="flex-1 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700">✓ Sahkan</button>
                              <button onClick={() => openSignDialog(rev.id, 'reject')} className="flex-1 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700">✗ Tolak</button>
                            </div>
                          ) : <div className="text-gray-400 mt-1">Menunggu...</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DISTRIBUTION SECTION — FRM-DCC-04 + FRM-DCC-01 */}
          {activeSection === 'distribution' && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold">Distribusi Dokumen (FRM-DCC-04)</h4>
                <button onClick={() => setShowDistForm(true)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                  <Send className="w-3 h-3" /> Distribusikan
                </button>
              </div>

              {distributions.length === 0 ? (
                <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg">Belum ada distribusi</div>
              ) : (
                <div className="space-y-2">
                  {distributions.map((d: any) => (
                    <div key={d.id} className={`flex items-center justify-between p-3 rounded-lg border ${d.is_acknowledged ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${d.is_acknowledged ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                          #{d.copy_number}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{d.department_target}</div>
                          <div className="text-xs text-gray-500">
                            {d.copy_type === 'controlled' ? '🔒 Controlled Copy' : '📄 Uncontrolled'}
                            {d.distributed_at && ` · Dikirim: ${d.distributed_at.split('T')[0]}`}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {d.is_acknowledged ? (
                          <div>
                            <div className="text-xs text-green-700 font-medium">✓ Diterima</div>
                            <div className="text-xs text-gray-500">{d.received_by} · {d.received_at?.split('T')[0]}</div>
                            {d.old_copy_returned && <div className="text-xs text-blue-600">Revisi lama dikembalikan</div>}
                          </div>
                        ) : (
                          <button onClick={() => handleAcknowledge(d.id)}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700">
                            Terima Dokumen (FRM-DCC-01)
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Revision Form Modal */}
        {showRevisionForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[85vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-1">Buat Revisi Baru</h3>
              <p className="text-sm text-gray-500 mb-4">Revisi baru berdasarkan Change Notice yang telah disetujui</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Change Notice (DCN) *</label>
                  <select value={revFormData.change_notice_id}
                    onChange={e => {
                      const dcn = availableDcns.find((n: any) => n.id === Number(e.target.value));
                      setRevFormData({
                        ...revFormData,
                        change_notice_id: e.target.value,
                        change_reason: dcn ? `[${dcn.request_number}] ${dcn.change_description}` : '',
                        change_type: dcn?.change_type || 'content_change',
                      });
                    }}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">-- Pilih DCN --</option>
                    {availableDcns.map((n: any) => (
                      <option key={n.id} value={n.id}>{n.request_number} — {n.change_description?.substring(0, 60)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alasan Perubahan</label>
                  <textarea value={revFormData.change_reason} onChange={e => setRevFormData({ ...revFormData, change_reason: e.target.value })}
                    rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Otomatis terisi dari DCN" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Perubahan</label>
                    <select value={revFormData.change_type} onChange={e => setRevFormData({ ...revFormData, change_type: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="content_change">Perubahan Isi</option>
                      <option value="format_change">Perubahan Format</option>
                      <option value="new_document">Dokumen Baru</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Checker</label>
                    <select value={revFormData.required_reviewers} onChange={e => setRevFormData({ ...revFormData, required_reviewers: Number(e.target.value) })}
                      className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value={1}>1 Checker</option>
                      <option value={2}>2 Checker</option>
                    </select>
                  </div>
                </div>

                <div className="border-t pt-3 mt-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Pilih Checker & Approver</p>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Checker 1 (Pemeriksa)</label>
                      <select value={revFormData.assigned_reviewer_id} onChange={e => setRevFormData({ ...revFormData, assigned_reviewer_id: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm">
                        <option value="">-- Bebas (sesuai role) --</option>
                        {revUserList.map(u => <option key={u.id} value={u.id}>{u.full_name}{u.position ? ` (${u.position})` : ''}</option>)}
                      </select>
                    </div>
                    {revFormData.required_reviewers >= 2 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Checker 2</label>
                        <select value={revFormData.assigned_reviewer2_id} onChange={e => setRevFormData({ ...revFormData, assigned_reviewer2_id: e.target.value })}
                          className="w-full border rounded-lg px-3 py-2 text-sm">
                          <option value="">-- Bebas (sesuai role) --</option>
                          {revUserList.map(u => <option key={u.id} value={u.id}>{u.full_name}{u.position ? ` (${u.position})` : ''}</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Approver (Pengesah)</label>
                      <select value={revFormData.assigned_approver_id} onChange={e => setRevFormData({ ...revFormData, assigned_approver_id: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm">
                        <option value="">-- Bebas (sesuai role) --</option>
                        {revUserList.map(u => <option key={u.id} value={u.id}>{u.full_name}{u.position ? ` (${u.position})` : ''}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowRevisionForm(false)} className="flex-1 px-4 py-2.5 border rounded-lg text-sm">Batal</button>
                <button onClick={handleNewRevision} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  Buat Revisi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Password Signing Dialog */}
        {passwordDialog && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
              <div className="text-center mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Edit className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold">Konfirmasi Tanda Tangan</h3>
                <p className="text-sm text-gray-500 mt-1">Masukkan password Anda untuk menandatangani dokumen ini</p>
              </div>
              <div className="mb-3">
                <div className="text-xs text-gray-500 mb-2 bg-gray-50 p-2 rounded">
                  Aksi: <span className="font-medium text-gray-700">
                    {passwordDialog.action === 'sign' ? 'Tandatangani sebagai Pembuat' :
                     passwordDialog.action === 'review_approve' ? 'Setujui sebagai Pemeriksa 1' :
                     passwordDialog.action === 'review2_approve' ? 'Setujui sebagai Pemeriksa 2' :
                     passwordDialog.action === 'approve' ? 'Sahkan sebagai Pengesah' :
                     passwordDialog.action.includes('reject') ? 'Tolak dokumen' : passwordDialog.action}
                  </span>
                </div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" value={signPassword} onChange={e => { setSignPassword(e.target.value); setSignError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleConfirmSign()}
                  placeholder="Masukkan password akun Anda"
                  className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" autoFocus />
                {signError && <p className="text-red-600 text-xs mt-1.5 font-medium">{signError}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setPasswordDialog(null); setSignPassword(''); }} className="flex-1 px-4 py-2.5 border rounded-lg text-sm">Batal</button>
                <button onClick={handleConfirmSign} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  Tandatangani
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Distribution Form Modal */}
        {showDistForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
              <h3 className="text-lg font-semibold mb-3">Distribusi Dokumen ke Departemen</h3>
              <p className="text-sm text-gray-500 mb-4">Pilih departemen penerima salinan terkendali (Controlled Copy)</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {departments.map(dept => (
                  <label key={dept.code} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={selectedDepts.includes(dept.code)}
                      onChange={e => {
                        if (e.target.checked) setSelectedDepts([...selectedDepts, dept.code]);
                        else setSelectedDepts(selectedDepts.filter(d => d !== dept.code));
                      }}
                      className="w-4 h-4 rounded" />
                    <div>
                      <span className="font-medium text-sm">{dept.code}</span>
                      <span className="text-gray-500 text-sm ml-2">{dept.name}</span>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex justify-between items-center mt-4 pt-4 border-t">
                <span className="text-sm text-gray-500">{selectedDepts.length} departemen dipilih</span>
                <div className="flex gap-2">
                  <button onClick={() => { setShowDistForm(false); setSelectedDepts([]); }} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
                  <button onClick={handleDistribute} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                    Distribusikan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// CAPA TAB
// ============================================================
const CapaTab = () => {
  const [capas, setCapas] = useState<CapaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedCapa, setSelectedCapa] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    capa_type: 'CPAR', capa_source: 'PM', deviation_ref_number: '', issue_description: '', product_affected: '',
    assigned_department: '', due_date: '', supplier_id: null as number | null,
  });

  const loadCapas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      const data = await fetchApi(`/capa?${params}`);
      setCapas(data.capa_list || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [typeFilter, statusFilter, search]);

  useEffect(() => { loadCapas(); }, [loadCapas]);

  const handleCreate = async () => {
    try {
      await fetchApi('/capa', { method: 'POST', body: JSON.stringify(formData) });
      setShowForm(false);
      loadCapas();
    } catch (e: any) { alert('Error: ' + e.message); }
  };

  const sources = [
    { value: 'AI', label: 'Audit Internal' },
    { value: 'AE', label: 'Audit External' },
    { value: 'MR', label: 'Management Review' },
    { value: 'PM', label: 'Penyimpangan Mutu' },
    { value: 'KP', label: 'Keluhan Pelanggan' },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 items-center flex-1 min-w-[200px]">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Cari CAPA..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Semua Tipe</option>
            <option value="CPAR">CPAR</option>
            <option value="SCAR">SCAR</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Semua Status</option>
            <option value="open">Open</option>
            <option value="investigation">Investigation</option>
            <option value="action_progress">In Progress</option>
            <option value="verifying">Verifying</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-700">
          <Plus className="w-4 h-4" /> Buat CAPA
        </button>
      </div>

      {/* Create CAPA Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Buat CAPA Baru</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipe</label>
                  <select value={formData.capa_type} onChange={e => setFormData({ ...formData, capa_type: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="CPAR">CPAR (Internal)</option>
                    <option value="SCAR">SCAR (Supplier)</option>
                    <option value="CCHF">CCHF (Customer Complaint)</option>
                  </select>
                </div>
                {(formData.capa_type === 'CPAR') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sumber</label>
                    <select value={formData.capa_source} onChange={e => setFormData({ ...formData, capa_source: e.target.value, deviation_ref_number: '' })}
                      className="w-full border rounded-lg px-3 py-2 text-sm">
                      {sources.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
              {(formData.capa_type === 'CPAR' && formData.capa_source === 'PM') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">No. Referensi Penyimpangan Mutu</label>
                  <input type="text" value={formData.deviation_ref_number} onChange={e => setFormData({ ...formData, deviation_ref_number: e.target.value })}
                    placeholder="Masukkan nomor dokumen penyimpangan mutu" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi Masalah</label>
                <textarea value={formData.issue_description} onChange={e => setFormData({ ...formData, issue_description: e.target.value })}
                  rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Produk yang Terpengaruh</label>
                <input type="text" value={formData.product_affected} onChange={e => setFormData({ ...formData, product_affected: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departemen PIC</label>
                  <select value={formData.assigned_department} onChange={e => setFormData({ ...formData, assigned_department: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">-- Pilih Departemen --</option>
                    {[{c:'MRE',n:'Manajemen Review'},{c:'DCC',n:'Document Control Centre'},{c:'MKT',n:'Marketing & Sales'},{c:'PRC',n:'Purchasing'},{c:'RND',n:'Research And Development'},{c:'HRD',n:'Human Resource Department'},{c:'EPD',n:'End Product'},{c:'QAS',n:'Quality Assurance'},{c:'PIC',n:'Production, Planning & Inventory Control'},{c:'MTC',n:'Maintenance'}].map(d => (
                      <option key={d.c} value={d.c}>{d.c} - {d.n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input type="date" value={formData.due_date} onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* CAPA Detail */}
      {selectedCapa && <CapaDetailModal capaId={selectedCapa} onClose={() => { setSelectedCapa(null); loadCapas(); }} />}

      {/* List */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">No. CAPA</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tipe</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Deskripsi</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">PIC</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Due Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">Memuat...</td></tr>
            ) : capas.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Belum ada CAPA</td></tr>
            ) : capas.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedCapa(c.id)}>
                <td className="px-4 py-3 font-mono font-medium text-orange-600">{c.capa_number}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.capa_type === 'CPAR' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {c.capa_type}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-[300px] truncate">{c.issue_description}</td>
                <td className="px-4 py-3">{c.assigned_department || '-'}</td>
                <td className="px-4 py-3">
                  <span className={c.is_overdue ? 'text-red-600 font-medium' : ''}>{c.due_date || '-'}</span>
                  {c.is_overdue && <span className="ml-1 text-xs text-red-500">OVERDUE</span>}
                </td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// CAPA Detail Modal
const CapaDetailModal = ({ capaId, onClose }: { capaId: number; onClose: () => void }) => {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'info' | 'investigation' | 'verification'>('info');
  const [invForm, setInvForm] = useState({
    root_cause_method: 'five_why', root_cause_analysis: '', five_why_data: { why1: '', why2: '', why3: '', why4: '', why5: '' },
    temporary_action: '', corrective_action: '', preventive_action: '', action_due_date: '', pic_name: '', pic_department: '',
  });
  const [verForm, setVerForm] = useState({ verification_notes: '', is_effective: true, follow_up_action: '' });

  const loadDetail = useCallback(async () => {
    try {
      const data = await fetchApi(`/capa/${capaId}`);
      setDetail(data);
      if (data.investigation) {
        setInvForm({
          root_cause_method: data.investigation.root_cause_method || 'five_why',
          root_cause_analysis: data.investigation.root_cause_analysis || '',
          five_why_data: data.investigation.five_why_data || { why1: '', why2: '', why3: '', why4: '', why5: '' },
          temporary_action: data.investigation.temporary_action || '',
          corrective_action: data.investigation.corrective_action || '',
          preventive_action: data.investigation.preventive_action || '',
          action_due_date: data.investigation.action_due_date || '',
          pic_name: data.investigation.pic_name || '',
          pic_department: data.investigation.pic_department || '',
        });
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [capaId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const saveInvestigation = async () => {
    try {
      await fetchApi(`/capa/${capaId}/investigation`, { method: 'POST', body: JSON.stringify(invForm) });
      loadDetail();
      alert('Investigasi berhasil disimpan');
    } catch (e: any) { alert('Error: ' + e.message); }
  };

  const saveVerification = async () => {
    try {
      await fetchApi(`/capa/${capaId}/verification`, { method: 'POST', body: JSON.stringify(verForm) });
      loadDetail();
      alert('Verifikasi berhasil disimpan');
    } catch (e: any) { alert('Error: ' + e.message); }
  };

  if (loading) return <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-xl p-8">Memuat...</div></div>;
  if (!detail) return null;

  const { capa, investigation, verification } = detail;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold font-mono">{capa.capa_number}</h3>
              <StatusBadge status={capa.status} />
            </div>
            <p className="text-sm text-gray-500">{capa.capa_type} - {capa.capa_source || ''}</p>
          </div>
          <div className="flex gap-2">
            {capa.status !== 'closed' && capa.status !== 'cancelled' && (
              <button onClick={async () => {
                const reason = prompt('Alasan pembatalan CAPA:');
                if (!reason) return;
                try { await fetchApi(`/capa/${capaId}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }); loadDetail(); }
                catch (e: any) { alert('Error: ' + e.message); }
              }} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200">
                Batalkan CAPA
              </button>
            )}
            <button onClick={onClose} className="px-3 py-1.5 border rounded-lg text-sm">Tutup</button>
          </div>
        </div>

        {/* Tab buttons */}
        <div className="flex border-b px-6">
          {(['info', 'investigation', 'verification'] as const).map(s => (
            <button key={s} onClick={() => setActiveSection(s)}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${activeSection === s ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {s === 'info' ? 'Informasi' : s === 'investigation' ? 'Investigasi & RCA' : 'Verifikasi'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Info Tab */}
          {activeSection === 'info' && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-gray-500">Diajukan oleh:</span> <span className="font-medium">{capa.raised_by}</span></div>
                <div><span className="text-gray-500">Tanggal:</span> <span className="font-medium">{capa.raised_date}</span></div>
                <div><span className="text-gray-500">Dept PIC:</span> <span className="font-medium">{capa.assigned_department || '-'}</span></div>
                <div><span className="text-gray-500">Due Date:</span> <span className="font-medium">{capa.due_date || '-'}</span></div>
              </div>
              <div>
                <span className="text-gray-500">Deskripsi Masalah:</span>
                <p className="mt-1 p-3 bg-gray-50 rounded-lg">{capa.issue_description}</p>
              </div>
              {capa.product_affected && (
                <div><span className="text-gray-500">Produk Terpengaruh:</span> <span className="font-medium">{capa.product_affected}</span></div>
              )}
            </div>
          )}

          {/* Investigation Tab */}
          {activeSection === 'investigation' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Metode RCA</label>
                <select value={invForm.root_cause_method} onChange={e => setInvForm({ ...invForm, root_cause_method: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="five_why">5 Why</option>
                  <option value="fishbone">Fishbone Diagram</option>
                </select>
              </div>

              {invForm.root_cause_method === 'five_why' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">5 Why Analysis</label>
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm font-medium w-16">Why {i}:</span>
                      <input type="text"
                        value={(invForm.five_why_data as any)[`why${i}`] || ''}
                        onChange={e => setInvForm({ ...invForm, five_why_data: { ...invForm.five_why_data, [`why${i}`]: e.target.value } })}
                        className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hasil Analisis Root Cause</label>
                <textarea value={invForm.root_cause_analysis} onChange={e => setInvForm({ ...invForm, root_cause_analysis: e.target.value })}
                  rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tindakan Sementara (Temporary Action)</label>
                <textarea value={invForm.temporary_action} onChange={e => setInvForm({ ...invForm, temporary_action: e.target.value })}
                  rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tindakan Korektif (Corrective Action)</label>
                <textarea value={invForm.corrective_action} onChange={e => setInvForm({ ...invForm, corrective_action: e.target.value })}
                  rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tindakan Pencegahan (Preventive Action)</label>
                <textarea value={invForm.preventive_action} onChange={e => setInvForm({ ...invForm, preventive_action: e.target.value })}
                  rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PIC</label>
                  <input type="text" value={invForm.pic_name} onChange={e => setInvForm({ ...invForm, pic_name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dept PIC</label>
                  <input type="text" value={invForm.pic_department} onChange={e => setInvForm({ ...invForm, pic_department: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deadline Tindakan</label>
                  <input type="date" value={invForm.action_due_date} onChange={e => setInvForm({ ...invForm, action_due_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <button onClick={saveInvestigation} className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Simpan Investigasi
              </button>
            </div>
          )}

          {/* Verification Tab */}
          {activeSection === 'verification' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan Verifikasi</label>
                <textarea value={verForm.verification_notes} onChange={e => setVerForm({ ...verForm, verification_notes: e.target.value })}
                  rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Apakah Tindakan Efektif?</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={verForm.is_effective === true} onChange={() => setVerForm({ ...verForm, is_effective: true })} />
                    <span className="text-sm text-green-700 font-medium">Ya, Efektif</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={verForm.is_effective === false} onChange={() => setVerForm({ ...verForm, is_effective: false })} />
                    <span className="text-sm text-red-700 font-medium">Tidak Efektif</span>
                  </label>
                </div>
              </div>
              {!verForm.is_effective && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tindakan Lanjutan</label>
                  <textarea value={verForm.follow_up_action} onChange={e => setVerForm({ ...verForm, follow_up_action: e.target.value })}
                    rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              )}
              <button onClick={saveVerification} className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                Simpan Verifikasi {verForm.is_effective ? '& Tutup CAPA' : ''}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// INTERNAL MEMO TAB
// ============================================================
const MemoTab = () => {
  const [memos, setMemos] = useState<MemoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ subject: '', content: '', category: 'lainnya' });
  const [publishMemoId, setPublishMemoId] = useState<number | null>(null);
  const [publishDepts, setPublishDepts] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const deptList = [
    { code: 'MRE', name: 'Manajemen Review' }, { code: 'DCC', name: 'Document Control Centre' },
    { code: 'MKT', name: 'Marketing & Sales' }, { code: 'PRC', name: 'Purchasing' },
    { code: 'RND', name: 'Research And Development' }, { code: 'HRD', name: 'Human Resource Department' },
    { code: 'EPD', name: 'End Product' }, { code: 'QAS', name: 'Quality Assurance' },
    { code: 'PIC', name: 'Production, Planning & Inventory Control' }, { code: 'MTC', name: 'Maintenance' },
  ];

  const loadMemos = useCallback(async () => {
    setLoading(true);
    try {
      const [memosData, unreadData] = await Promise.all([
        fetchApi('/memos'),
        fetchApi('/memos/unread').catch(() => ({ unread: [] })),
      ]);
      setMemos(memosData.memos || []);
      setUnreadCount(unreadData.unread?.length || 0);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadMemos(); }, [loadMemos]);

  const handleCreate = async () => {
    try {
      await fetchApi('/memos', { method: 'POST', body: JSON.stringify(formData) });
      setShowForm(false);
      setFormData({ subject: '', content: '', category: 'lainnya' });
      loadMemos();
    } catch (e: any) { alert('Error: ' + e.message); }
  };

  const categories = [
    { value: 'kebijakan_mutu', label: 'Kebijakan Mutu' },
    { value: 'jadwal_produksi', label: 'Jadwal Produksi' },
    { value: 'kebutuhan_bahan', label: 'Kebutuhan Bahan' },
    { value: 'maklum_balas', label: 'Maklum Balas Pelanggan' },
    { value: 'audit', label: 'Audit' },
    { value: 'lainnya', label: 'Lainnya' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">Internal Memo</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">{unreadCount} belum dibaca</span>
          )}
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
          <Plus className="w-4 h-4" /> Buat Memo
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Buat Memo Internal Baru</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subjek</label>
                <input type="text" value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Isi Memo</label>
                <textarea value={formData.content} onChange={e => setFormData({ ...formData, content: e.target.value })}
                  rows={5} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Simpan</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading ? <p className="text-center py-8 text-gray-500">Memuat...</p> :
          memos.length === 0 ? <p className="text-center py-8 text-gray-400">Belum ada memo</p> :
            memos.map(m => (
              <div key={m.id} className="bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-gray-500">{m.memo_number}</span>
                      <StatusBadge status={m.status} />
                    </div>
                    <h4 className="font-medium mt-1">{m.subject}</h4>
                    <p className="text-sm text-gray-500 mt-1">{m.published_by} · {m.published_date || m.created_at?.split('T')[0]}</p>
                  </div>
                  <div className="text-right">
                    {m.status === 'draft' ? (
                      <button onClick={() => { setPublishMemoId(m.id); setPublishDepts([]); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                        <Send className="w-3 h-3" /> Publish
                      </button>
                    ) : (
                      <p className="text-sm text-gray-500">{m.read_count}/{m.total_recipients} dibaca</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
      </div>

      {/* Publish Memo Dialog */}
      {publishMemoId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Publish Memo</h3>
            <p className="text-sm text-gray-500 mb-4">Pilih departemen tujuan distribusi memo</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {deptList.map(dept => (
                <label key={dept.code} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={publishDepts.includes(dept.code)}
                    onChange={e => {
                      if (e.target.checked) setPublishDepts([...publishDepts, dept.code]);
                      else setPublishDepts(publishDepts.filter(d => d !== dept.code));
                    }} className="w-4 h-4 rounded" />
                  <span className="text-sm"><span className="font-medium">{dept.code}</span> — {dept.name}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <button onClick={() => setPublishDepts(deptList.map(d => d.code))} className="text-xs text-blue-600 underline">Pilih Semua</button>
              <div className="flex gap-2">
                <button onClick={() => setPublishMemoId(null)} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
                <button onClick={async () => {
                  if (publishDepts.length === 0) return alert('Pilih minimal 1 departemen');
                  try {
                    await fetchApi(`/memos/${publishMemoId}/publish`, { method: 'POST', body: JSON.stringify({ departments: publishDepts }) });
                    setPublishMemoId(null);
                    loadMemos();
                  } catch (e: any) { alert('Error: ' + e.message); }
                }} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                  Publish ({publishDepts.length} dept)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// DESTRUCTION TAB
// ============================================================
const DestructionTab = () => {
  const [logs, setLogs] = useState<DestructionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    document_type: 'document_revision', destruction_date: new Date().toISOString().split('T')[0],
    document_form: 'physical', method_physical: 'shredder', reason: 'expired_retention', notes: '',
  });

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApi('/destructions');
      setLogs(data.destructions || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleCreate = async () => {
    try {
      await fetchApi('/destructions', { method: 'POST', body: JSON.stringify(formData) });
      setShowForm(false);
      loadLogs();
    } catch (e: any) { alert('Error: ' + e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Berita Acara Pemusnahan Dokumen</h3>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700">
          <Plus className="w-4 h-4" /> Buat BA Pemusnahan
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Berita Acara Pemusnahan Dokumen</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Dokumen</label>
                  <select value={formData.document_type} onChange={e => setFormData({ ...formData, document_type: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="document_revision">Dokumen Revisi</option>
                    <option value="quality_record">Rekaman Mutu</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Pemusnahan</label>
                  <input type="date" value={formData.destruction_date} onChange={e => setFormData({ ...formData, destruction_date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bentuk Dokumen</label>
                  <select value={formData.document_form} onChange={e => setFormData({ ...formData, document_form: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="physical">Fisik</option>
                    <option value="digital">Digital</option>
                    <option value="both">Keduanya</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Metode Pemusnahan</label>
                  <select value={formData.method_physical} onChange={e => setFormData({ ...formData, method_physical: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="shredder">Shredder</option>
                    <option value="burn">Dibakar</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alasan Pemusnahan</label>
                <select value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="expired_retention">Masa Retensi Habis</option>
                  <option value="obsolete">Obsolete</option>
                  <option value="not_relevant">Tidak Relevan</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
                <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Simpan</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">No. BA</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tanggal</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Bentuk</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Metode</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Alasan</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Pelaksana</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Saksi</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Verifikasi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-500">Memuat...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">Belum ada data</td></tr>
            ) : logs.map(l => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-sm">{l.destruction_number}</td>
                <td className="px-4 py-3">{l.destruction_date}</td>
                <td className="px-4 py-3 capitalize">{l.document_form}</td>
                <td className="px-4 py-3 capitalize">{l.method_physical || l.method_digital || '-'}</td>
                <td className="px-4 py-3">{l.reason?.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3">{l.destroyed_by || '-'}</td>
                <td className="px-4 py-3">
                  {l.witness_confirmed ? <span className="text-green-600">✓ {l.witnessed_by}</span> : (
                    <button onClick={async () => {
                      try { await fetchApi(`/destructions/${l.id}/witness`, { method: 'POST' }); loadLogs(); }
                      catch (e: any) { alert('Error: ' + e.message); }
                    }} className="px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600">Witness</button>
                  )}
                </td>
                <td className="px-4 py-3">
                  {l.verified_at ? <span className="text-green-600">✓ {l.verified_by}</span> : (
                    l.witness_confirmed ? (
                      <button onClick={async () => {
                        try { await fetchApi(`/destructions/${l.id}/verify`, { method: 'POST' }); loadLogs(); }
                        catch (e: any) { alert('Error: ' + e.message); }
                      }} className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Verify</button>
                    ) : <span className="text-gray-400">Tunggu saksi</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================
// QUALITY RECORDS TAB — FRM-DCC-03
// ============================================================
const QualityRecordsTab = () => {
  const [records, setRecords] = useState<QualityRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ record_number: '', title: '', record_type: 'smm', department: 'DCC', storage_location: '', retention_period: '5 tahun', is_confidential: false, published_date: '' });

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try { const data = await fetchApi('/quality-records'); setRecords(data.quality_records || []); } catch (e) { console.error(e); }
    setLoading(false);
  }, []);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  const handleCreate = async () => {
    try {
      await fetchApi('/quality-records', { method: 'POST', body: JSON.stringify(formData) });
      setShowForm(false); loadRecords();
    } catch (e: any) { alert('Error: ' + e.message); }
  };

  const departments = [
    { code: 'MRE', name: 'Manajemen Review' }, { code: 'DCC', name: 'Document Control Centre' },
    { code: 'MKT', name: 'Marketing & Sales' }, { code: 'PRC', name: 'Purchasing' },
    { code: 'RND', name: 'Research And Development' }, { code: 'HRD', name: 'Human Resource Department' },
    { code: 'EPD', name: 'End Product' }, { code: 'QAS', name: 'Quality Assurance' },
    { code: 'PIC', name: 'Production, Planning & Inventory Control' }, { code: 'MTC', name: 'Maintenance' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Daftar Induk Rekaman Mutu (FRM-DCC-03)</h3>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Tambah Rekaman
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Tambah Rekaman Mutu</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Rekaman</label>
                  <input type="text" value={formData.record_number} onChange={e => setFormData({ ...formData, record_number: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipe</label>
                  <select value={formData.record_type} onChange={e => setFormData({ ...formData, record_type: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="smm">Rekaman SMM</option>
                    <option value="product">Rekaman Mutu Produk</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Judul</label>
                <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departemen</label>
                  <select value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {departments.map(d => <option key={d.code} value={d.code}>{d.code} - {d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Masa Simpan</label>
                  <input type="text" value={formData.retention_period} onChange={e => setFormData({ ...formData, retention_period: e.target.value })} placeholder="cth: 5 tahun" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi Penyimpanan</label>
                <input type="text" value={formData.storage_location} onChange={e => setFormData({ ...formData, storage_location: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.is_confidential} onChange={e => setFormData({ ...formData, is_confidential: e.target.checked })} />
                <span className="text-sm">Bersifat Rahasia</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Simpan</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">No. Rekaman</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Judul</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tipe</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Dept</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Lokasi</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Masa Simpan</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? <tr><td colSpan={7} className="text-center py-8 text-gray-500">Memuat...</td></tr> :
              records.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">Belum ada rekaman mutu</td></tr> :
              records.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium">{r.record_number}</td>
                  <td className="px-4 py-3">{r.title}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded ${r.record_type === 'smm' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{r.record_type === 'smm' ? 'SMM' : 'Produk'}</span></td>
                  <td className="px-4 py-3">{r.department}</td>
                  <td className="px-4 py-3">{r.storage_location || '-'}</td>
                  <td className="px-4 py-3">{r.retention_period || '-'}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================
// CHANGE NOTICE TAB — FRM-DCC-05
// ============================================================
const ChangeNoticeTab = () => {
  const [docs, setDocs] = useState<DccDocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ change_description: '', reason: '', change_type: 'content_change' });

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApi('/documents');
      setDocs(data.documents || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const loadNotices = useCallback(async (docId: number) => {
    try {
      const data = await fetchApi(`/documents/${docId}/change-notices`);
      setNotices(data.change_notices || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { if (selectedDocId) loadNotices(selectedDocId); }, [selectedDocId, loadNotices]);

  const handleCreate = async () => {
    if (!selectedDocId) return alert('Pilih dokumen terlebih dahulu');
    try {
      await fetchApi(`/documents/${selectedDocId}/change-notice`, { method: 'POST', body: JSON.stringify(formData) });
      setShowForm(false);
      setFormData({ change_description: '', reason: '', change_type: 'content_change' });
      loadNotices(selectedDocId);
    } catch (e: any) { alert('Error: ' + e.message); }
  };

  const handleApprove = async (noticeId: number, action: string) => {
    const reason = action === 'rejected' ? prompt('Alasan penolakan:') || '' : '';
    try {
      await fetchApi(`/change-notices/${noticeId}/approve`, { method: 'POST', body: JSON.stringify({ action, rejection_reason: reason }) });
      if (selectedDocId) loadNotices(selectedDocId);
    } catch (e: any) { alert('Error: ' + e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Change Notice — FRM-DCC-05</h3>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Ajukan Perubahan
        </button>
      </div>

      {/* Select document */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Dokumen</label>
        <select value={selectedDocId || ''} onChange={e => setSelectedDocId(Number(e.target.value) || null)}
          className="w-full border rounded-lg px-3 py-2 text-sm max-w-md">
          <option value="">-- Pilih dokumen --</option>
          {docs.map(d => <option key={d.id} value={d.id}>{d.document_number} — {d.title}</option>)}
        </select>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Ajukan Perubahan Dokumen</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dokumen</label>
                <select value={selectedDocId || ''} onChange={e => setSelectedDocId(Number(e.target.value) || null)}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">-- Pilih --</option>
                  {docs.map(d => <option key={d.id} value={d.id}>{d.document_number} — {d.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Perubahan</label>
                <select value={formData.change_type} onChange={e => setFormData({ ...formData, change_type: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="format_change">Format</option>
                  <option value="content_change">Konten</option>
                  <option value="both">Format & Konten</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Uraian Perubahan</label>
                <textarea value={formData.change_description} onChange={e => setFormData({ ...formData, change_description: e.target.value })}
                  rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Jelaskan perubahan yang diinginkan..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alasan Perubahan</label>
                <textarea value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Mengapa perlu diubah..." />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Ajukan</button>
            </div>
          </div>
        </div>
      )}

      {/* Notices list */}
      {selectedDocId && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">No. DCN</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tipe</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Uraian Perubahan</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Diajukan</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {notices.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Belum ada change notice untuk dokumen ini</td></tr>
              ) : notices.map((n: any) => (
                <tr key={n.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{n.request_number}</td>
                  <td className="px-4 py-3 capitalize text-xs">{n.change_type?.replace('_', ' ')}</td>
                  <td className="px-4 py-3 max-w-[250px] truncate">{n.change_description}</td>
                  <td className="px-4 py-3 text-xs">{n.requested_by}<br />{n.requested_at?.split('T')[0]}</td>
                  <td className="px-4 py-3"><StatusBadge status={n.status} /></td>
                  <td className="px-4 py-3 text-center">
                    {n.status === 'pending' && (
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => handleApprove(n.id, 'approved')} className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">Approve</button>
                        <button onClick={() => handleApprove(n.id, 'rejected')} className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">Reject</button>
                      </div>
                    )}
                    {n.status === 'approved' && <span className="text-xs text-green-600">✓ {n.approved_by}</span>}
                    {n.status === 'rejected' && <span className="text-xs text-red-600">✗ Ditolak</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ============================================================
// DOCUMENT REVIEW TAB — FRM-DCC-10
// ============================================================
const DocumentReviewTab = () => {
  const [docs, setDocs] = useState<DccDocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ review_result: 'still_relevant', review_notes: '', next_review_date: '' });

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApi('/documents');
      setDocs(data.documents || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const loadReviews = useCallback(async (docId: number) => {
    try {
      const data = await fetchApi(`/documents/${docId}/reviews`);
      setReviews(data.reviews || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { if (selectedDocId) loadReviews(selectedDocId); }, [selectedDocId, loadReviews]);

  const handleSubmit = async () => {
    if (!selectedDocId) return alert('Pilih dokumen terlebih dahulu');
    try {
      await fetchApi(`/documents/${selectedDocId}/review`, { method: 'POST', body: JSON.stringify(formData) });
      setShowForm(false);
      setFormData({ review_result: 'still_relevant', review_notes: '', next_review_date: '' });
      loadReviews(selectedDocId);
    } catch (e: any) { alert('Error: ' + e.message); }
  };

  const resultLabels: Record<string, { label: string; color: string }> = {
    still_relevant: { label: 'Masih Relevan', color: 'bg-green-100 text-green-700' },
    needs_revision: { label: 'Perlu Revisi', color: 'bg-yellow-100 text-yellow-700' },
    obsolete: { label: 'Obsolete', color: 'bg-red-100 text-red-700' },
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Kaji Ulang Dokumen — FRM-DCC-10</h3>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Kaji Ulang Baru
        </button>
      </div>

      {/* Select document */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Dokumen</label>
        <select value={selectedDocId || ''} onChange={e => setSelectedDocId(Number(e.target.value) || null)}
          className="w-full border rounded-lg px-3 py-2 text-sm max-w-md">
          <option value="">-- Pilih dokumen --</option>
          {docs.map(d => <option key={d.id} value={d.id}>{d.document_number} — {d.title}</option>)}
        </select>
      </div>

      {/* Create Review Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Form Kaji Ulang Dokumen</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dokumen</label>
                <select value={selectedDocId || ''} onChange={e => setSelectedDocId(Number(e.target.value) || null)}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">-- Pilih --</option>
                  {docs.map(d => <option key={d.id} value={d.id}>{d.document_number} — {d.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hasil Kaji Ulang</label>
                <div className="space-y-2">
                  {[
                    { value: 'still_relevant', label: 'Masih Relevan — dokumen tetap berlaku', icon: '✓' },
                    { value: 'needs_revision', label: 'Perlu Revisi — dokumen harus diperbarui', icon: '⚠' },
                    { value: 'obsolete', label: 'Obsolete — dokumen tidak berlaku lagi', icon: '✗' },
                  ].map(opt => (
                    <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${formData.review_result === opt.value ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <input type="radio" name="review_result" value={opt.value} checked={formData.review_result === opt.value}
                        onChange={e => setFormData({ ...formData, review_result: e.target.value })} className="w-4 h-4" />
                      <span className="text-sm">{opt.icon} {opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catatan Kaji Ulang</label>
                <textarea value={formData.review_notes} onChange={e => setFormData({ ...formData, review_notes: e.target.value })}
                  rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Catatan hasil review..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Kaji Ulang Berikutnya</label>
                <input type="date" value={formData.next_review_date} onChange={e => setFormData({ ...formData, next_review_date: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
              <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Review history */}
      {selectedDocId && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tanggal Review</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Hasil</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Catatan</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Reviewer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Next Review</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reviews.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Belum ada riwayat kaji ulang</td></tr>
              ) : reviews.map((r: any) => {
                const res = resultLabels[r.review_result] || { label: r.review_result, color: 'bg-gray-100 text-gray-700' };
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{r.review_date}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${res.color}`}>{res.label}</span></td>
                    <td className="px-4 py-3 max-w-[250px]">{r.review_notes || '-'}</td>
                    <td className="px-4 py-3">{r.reviewed_by || '-'}</td>
                    <td className="px-4 py-3">{r.next_review_date || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ============================================================
// MAIN DCC PAGE
// ============================================================
type TabKey = 'dashboard' | 'documents' | 'quality_records' | 'capa' | 'memos' | 'change_notice' | 'review' | 'destruction';
const VALID_TABS: TabKey[] = ['dashboard', 'documents', 'quality_records', 'capa', 'memos', 'change_notice', 'review', 'destruction'];

const DocumentControlCenter = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'dashboard';

  const setActiveTab = (tab: TabKey) => {
    setSearchParams({ tab });
  };
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [expiringDocs, setExpiringDocs] = useState<ExpiringDoc[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [dashData, expData] = await Promise.all([
          fetchApi('/dashboard'),
          fetchApi('/documents/expiring'),
        ]);
        setStats(dashData);
        setExpiringDocs(expData.expiring || []);
      } catch (e) { console.error(e); }
    })();
  }, []);

  const tabs = [
    { key: 'dashboard', label: 'Dashboard', icon: BarChart3, color: 'text-blue-600' },
    { key: 'documents', label: 'Daftar Induk Dokumen', icon: FileText, color: 'text-indigo-600' },
    { key: 'change_notice', label: 'Change Notice', icon: Edit, color: 'text-cyan-600' },
    { key: 'review', label: 'Kaji Ulang', icon: BookOpen, color: 'text-teal-600' },
    { key: 'quality_records', label: 'Rekaman Mutu', icon: Archive, color: 'text-purple-600' },
    { key: 'capa', label: 'CAPA', icon: AlertTriangle, color: 'text-orange-600' },
    { key: 'memos', label: 'Komunikasi Internal', icon: Mail, color: 'text-green-600' },
    { key: 'destruction', label: 'Pemusnahan', icon: Trash2, color: 'text-red-600' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Document Control Center</h1>
        <p className="text-sm text-gray-500 mt-1">Centralized DCC</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon className={`w-4 h-4 ${activeTab === tab.key ? tab.color : ''}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Dashboard */}
      {activeTab === 'dashboard' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Dokumen', value: stats.statistics.total_documents, icon: FileText, color: 'bg-blue-50 text-blue-700' },
              { label: 'CAPA Open', value: stats.statistics.capa_open, icon: AlertTriangle, color: 'bg-orange-50 text-orange-700' },
              { label: 'CAPA Closed', value: stats.statistics.capa_closed, icon: CheckCircle, color: 'bg-green-50 text-green-700' },
              { label: 'CAPA Overdue', value: stats.statistics.capa_overdue, icon: Clock, color: 'bg-red-50 text-red-700' },
              { label: 'Memo', value: stats.statistics.total_memos, icon: Mail, color: 'bg-indigo-50 text-indigo-700' },
              { label: 'Pemusnahan', value: stats.statistics.total_destructions, icon: Trash2, color: 'bg-gray-50 text-gray-700' },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className={`rounded-xl p-4 ${s.color}`}>
                  <Icon className="w-5 h-5 mb-2" />
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs mt-1 opacity-80">{s.label}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {stats.recent_capa?.length > 0 && (
              <div className="bg-white rounded-xl border p-4">
                <h3 className="font-semibold mb-3">CAPA Terbaru</h3>
                <div className="space-y-2">
                  {stats.recent_capa.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                      onClick={() => setActiveTab('capa')}>
                      <div>
                        <span className="font-mono text-sm font-medium">{c.capa_number}</span>
                        <p className="text-sm text-gray-600 mt-0.5">{c.issue_description}</p>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {expiringDocs.length > 0 && (
              <div className="bg-white rounded-xl border p-4 border-yellow-200">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-600" /> Dokumen Mendekati Expired
                </h3>
                <div className="space-y-2">
                  {expiringDocs.map((d: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <div>
                        <span className="font-mono text-sm font-medium">{d.document_number}</span>
                        <p className="text-sm text-gray-600 mt-0.5">{d.title}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${d.days_remaining <= 30 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {d.days_remaining} hari lagi
                        </span>
                        <p className="text-xs text-gray-500 mt-1">Exp: {d.expiry_date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'documents' && <DocumentListTab />}
      {activeTab === 'change_notice' && <ChangeNoticeTab />}
      {activeTab === 'review' && <DocumentReviewTab />}
      {activeTab === 'quality_records' && <QualityRecordsTab />}
      {activeTab === 'capa' && <CapaTab />}
      {activeTab === 'memos' && <MemoTab />}
      {activeTab === 'destruction' && <DestructionTab />}
    </div>
  );
};

export default DocumentControlCenter;
