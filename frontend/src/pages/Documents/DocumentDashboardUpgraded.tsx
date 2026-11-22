import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import toast from 'react-hot-toast';
import { confirmDialog } from '../../components/ui';
import {
  DocumentTextIcon,
  DocumentDuplicateIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  TrashIcon,
  PencilIcon,
  ClockIcon,
  CheckCircleIcon,
  PaperAirplaneIcon,
  FolderIcon,
  ChartBarIcon,
  CalendarIcon,
  EllipsisVerticalIcon,
  DocumentArrowDownIcon,
  TableCellsIcon,
  TruckIcon,
  WrenchScrewdriverIcon,
  BanknotesIcon,
  ShoppingCartIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  ReceiptPercentIcon
} from '@heroicons/react/24/outline';
import { useUrlFilter } from '../../hooks/useUrlState'
import { PageHeader, KpiStrip } from '../../components/ui/PageKit';

interface Document {
  id: number;
  document_number: string;
  document_title: string;
  document_type: string;
  reference_type?: string;
  reference_number?: string;
  reference_id?: number;
  status: string;
  document_date: string;
  print_count: number;
  created_at: string;
  created_by_name?: string;
}

interface Template {
  id: number;
  template_name: string;
  template_code: string;
  document_type: string;
  is_default: boolean;
}

interface DashboardStats {
  total_documents: number;
  total_templates: number;
  documents_today: number;
  documents_this_month: number;
  by_type: Array<{ type: string; count: number }>;
  by_status: Array<{ status: string; count: number }>;
  recent_activity: Array<{ action: string; document: string; date: string }>;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draf', generated: 'Dibuat', printed: 'Dicetak', sent: 'Dikirim', approved: 'Disetujui',
};

// Jenis yang bisa dibuat dari tombol "Buat cepat".
const documentTypes = [
  { value: 'surat_jalan', label: 'Surat Jalan', Icon: TruckIcon },
  { value: 'spk', label: 'Surat Perintah Kerja', Icon: WrenchScrewdriverIcon },
  { value: 'invoice', label: 'Faktur', Icon: BanknotesIcon },
  { value: 'purchase_order', label: 'Pesanan Pembelian', Icon: ShoppingCartIcon },
  { value: 'delivery_note', label: 'Nota Pengiriman', Icon: ClipboardDocumentListIcon },
  { value: 'work_order', label: 'SPK Produksi', Icon: Cog6ToothIcon },
  { value: 'quotation', label: 'Penawaran', Icon: DocumentTextIcon },
  { value: 'receipt', label: 'Kuitansi', Icon: ReceiptPercentIcon }
];

// Jenis lain yang hanya muncul di daftar (dibuat otomatis oleh modul lain),
// supaya kolom Jenis tidak menampilkan nama mentah seperti "purchase_invoice".
const extraTypes = [
  { value: 'spk_batch', label: 'SPK Batch', Icon: Cog6ToothIcon },
  { value: 'purchase_invoice', label: 'Faktur Pembelian', Icon: BanknotesIcon },
  { value: 'kwitansi', label: 'Kuitansi', Icon: ReceiptPercentIcon },
  { value: 'three_way_match', label: 'Three-way Match', Icon: ClipboardDocumentListIcon },
];

const allTypes = [...documentTypes, ...extraTypes];

export default function DocumentDashboardUpgraded() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total_documents: 0,
    total_templates: 0,
    documents_today: 0,
    documents_this_month: 0,
    by_type: [],
    by_status: [],
    recent_activity: []
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useUrlFilter<string>('cari', '')
  const [typeFilter, setTypeFilter] = useUrlFilter<string>('tipe', '')
  const [statusFilter, setStatusFilter] = useUrlFilter<string>('status', '')
  const [dateFilter, setDateFilter] = useUrlFilter<string>('tanggal', '')
  const [viewMode, setViewMode] = useUrlFilter<'grid' | 'table'>('tampilan', 'table')
  const [showActions, setShowActions] = useState<number | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<number[]>([]);

  useEffect(() => {
    loadData();
  }, [typeFilter, statusFilter, dateFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load dashboard stats
      const statsRes = await axiosInstance.get('/api/documents/dashboard');
      if (statsRes.data.statistics) {
        setStats({
          ...stats,
          ...statsRes.data.statistics
        });
      }
      
      // Load templates
      const templatesRes = await axiosInstance.get('/api/documents/templates');
      setTemplates(templatesRes.data.templates || []);
      
      // Load documents with filters
      const params: any = {};
      if (typeFilter) params.document_type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      if (dateFilter) params.date_range = dateFilter;
      
      const docsRes = await axiosInstance.get('/api/documents', { params });
      setDocuments(docsRes.data.documents || []);
      
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocuments = useMemo(() => {
    if (!searchTerm) return documents;
    const term = searchTerm.toLowerCase();
    return documents.filter(doc => 
      doc.document_number.toLowerCase().includes(term) ||
      doc.document_title?.toLowerCase().includes(term) ||
      doc.reference_number?.toLowerCase().includes(term)
    );
  }, [documents, searchTerm]);

  const handlePreview = async (id: number) => {
    try {
      const res = await axiosInstance.get(`/api/documents/${id}/preview`);
      const htmlContent = res.data.document?.html_content || res.data.html_content;
      
      const previewWindow = window.open('', '_blank');
      if (previewWindow && htmlContent) {
        previewWindow.document.write(htmlContent);
        previewWindow.document.close();
      }
    } catch (error) {
      toast.error('Failed to preview document');
    }
  };

  const handleDownloadPDF = async (id: number, documentNumber: string) => {
    try {
      toast.loading('Generating PDF...');
      const response = await axiosInstance.get(`/api/documents/${id}/pdf`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${documentNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.dismiss();
      toast.success('PDF downloaded');
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to download PDF');
    }
  };

  const handleDownloadExcel = async (id: number, documentNumber: string) => {
    try {
      toast.loading('Generating Excel...');
      const response = await axiosInstance.get(`/api/documents/${id}/excel`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${documentNumber}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.dismiss();
      toast.success('Excel downloaded');
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to download Excel');
    }
  };

  const handlePrint = async (id: number) => {
    try {
      const res = await axiosInstance.get(`/api/documents/${id}/preview`);
      const htmlContent = res.data.document?.html_content || res.data.html_content;
      
      const printWindow = window.open('', '_blank');
      if (printWindow && htmlContent) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.print();
        
        // Update print count
        await axiosInstance.post(`/api/documents/${id}/print`);
        loadData();
      }
    } catch (error) {
      toast.error('Failed to print document');
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirmDialog('Are you sure you want to delete this document?'))) return;
    try {
      await axiosInstance.delete(`/api/documents/${id}`);
      toast.success('Document deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const handleBulkDownload = async () => {
    if (selectedDocs.length === 0) {
      toast.error('Please select documents to download');
      return;
    }
    toast.loading('Preparing bulk download...');
    for (const id of selectedDocs) {
      const doc = documents.find(d => d.id === id);
      if (doc) {
        await handleDownloadPDF(id, doc.document_number);
      }
    }
    toast.dismiss();
    setSelectedDocs([]);
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; bgColor: string; icon: any }> = {
      draft: { color: 'text-gray-600 dark:text-gray-300', bgColor: 'bg-gray-100 border-gray-200 dark:bg-gray-700 dark:border-gray-700', icon: ClockIcon },
      generated: { color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800', icon: DocumentTextIcon },
      printed: { color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 border-green-200 dark:bg-green-900/30 dark:border-green-800', icon: PrinterIcon },
      sent: { color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 border-purple-200 dark:bg-purple-900/30 dark:border-purple-800', icon: PaperAirplaneIcon },
      approved: { color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800', icon: CheckCircleIcon }
    };
    return configs[status] || configs.draft;
  };

  const getDocumentTypeConfig = (type: string) => {
    return allTypes.find(t => t.value === type) || { value: type, label: type, Icon: DocumentTextIcon };
  };

  if (loading && documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="DOKUMEN · RINGKASAN"
        title="Dokumen"
        subtitle="Buat, kelola, dan lacak dokumen bisnis."
        actions={
          <>
            <button
              onClick={loadData}
              className="fn-press rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              title="Muat ulang"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </button>
            <Link
              to="/app/documents/templates"
              className="fn-press inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <DocumentDuplicateIcon className="h-4 w-4" />
              Template
            </Link>
            <Link
              to="/app/documents/generate"
              className="fn-press inline-flex items-center gap-2 rounded-lg bg-cta-600 px-4 py-2 text-sm font-medium text-white hover:bg-cta-700"
            >
              <PlusIcon className="h-4 w-4" />
              Buat dokumen
            </Link>
          </>
        }
      />

      <KpiStrip
        items={[
          { label: 'Total dokumen', value: stats.total_documents },
          { label: 'Template', value: stats.total_templates, to: '/app/documents/templates' },
          { label: 'Hari ini', value: stats.documents_today || 0 },
          { label: 'Bulan ini', value: stats.documents_this_month || 0 },
        ]}
      />

      {/* Quick Generate Cards */}
      <div className="fn-card hover:shadow-lg transition-shadow duration-200 p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">Buat cepat</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
          {documentTypes.map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => navigate(`/app/documents/generate?type=${value}`)}
              className="fn-press rounded-xl border border-gray-200 p-4 text-center hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <Icon className="mx-auto mb-2 h-6 w-6 text-gray-400" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="fn-card hover:shadow-lg transition-shadow duration-200 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nomor dokumen, judul, atau acuan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Semua jenis</option>
            {documentTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Semua status</option>
            <option value="draft">Draf</option>
            <option value="generated">Dibuat</option>
            <option value="printed">Dicetak</option>
            <option value="sent">Dikirim</option>
            <option value="approved">Disetujui</option>
          </select>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Semua waktu</option>
            <option value="today">Hari ini</option>
            <option value="week">Minggu ini</option>
            <option value="month">Bulan ini</option>
            <option value="year">Tahun ini</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm dark:bg-gray-800' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              <TableCellsIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm dark:bg-gray-800' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              <FolderIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedDocs.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 flex-wrap">
            <span className="text-sm text-gray-600 dark:text-gray-300">{selectedDocs.length} selected</span>
            <button
              onClick={handleBulkDownload}
              className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 dark:text-indigo-400"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Download All
            </button>
            <button
              onClick={() => setSelectedDocs([])}
              className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-100 dark:hover:text-white"
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>

      {/* Documents Table View */}
      {viewMode === 'table' && (
        <div className="fn-card hover:shadow-lg transition-shadow duration-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDocs(filteredDocuments.map(d => d.id));
                        } else {
                          setSelectedDocs([]);
                        }
                      }}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Dokumen</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Jenis</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acuan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cetak</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <DocumentTextIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">No documents found</p>
                      <Link
                        to="/app/documents/generate"
                        className="mt-4 inline-flex items-center text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                      >
                        <PlusIcon className="h-4 w-4 mr-1" />
                        Generate your first document
                      </Link>
                    </td>
                  </tr>
                ) : (
                  filteredDocuments.map((doc) => {
                    const statusConfig = getStatusConfig(doc.status);
                    const typeConfig = getDocumentTypeConfig(doc.document_type);
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors">
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedDocs.includes(doc.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedDocs([...selectedDocs, doc.id]);
                              } else {
                                setSelectedDocs(selectedDocs.filter(id => id !== doc.id));
                              }
                            }}
                            className="rounded border-gray-300 dark:border-gray-600"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{doc.document_number}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{doc.document_title || '-'}</div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <typeConfig.Icon className="h-4 w-4 text-gray-400" />
                            {typeConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                          {doc.reference_number || '-'}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                          {new Date(doc.document_date).toLocaleDateString('id-ID')}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusConfig.bgColor} ${statusConfig.color}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {STATUS_LABEL[doc.status] || doc.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                            <PrinterIcon className="h-4 w-4 mr-1 text-gray-400" />
                            {doc.print_count}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              onClick={() => handlePreview(doc.id)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors dark:text-blue-400"
                              title="Preview"
                            >
                              <EyeIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handlePrint(doc.id)}
                              className="p-1.5 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 rounded-lg transition-colors dark:text-gray-300"
                              title="Print"
                            >
                              <PrinterIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDownloadPDF(doc.id, doc.document_number)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:text-red-400"
                              title="Download PDF"
                            >
                              <DocumentArrowDownIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDownloadExcel(doc.id, doc.document_number)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors dark:text-green-400"
                              title="Download Excel"
                            >
                              <TableCellsIcon className="h-5 w-5" />
                            </button>
                            <div className="relative">
                              <button
                                onClick={() => setShowActions(showActions === doc.id ? null : doc.id)}
                                className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 rounded-lg transition-colors"
                              >
                                <EllipsisVerticalIcon className="h-5 w-5" />
                              </button>
                              {showActions === doc.id && (
                                <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                                  <button
                                    onClick={() => {
                                      navigate(`/app/documents/${doc.id}/edit`);
                                      setShowActions(null);
                                    }}
                                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 dark:text-gray-200"
                                  >
                                    <PencilIcon className="h-4 w-4 mr-2" />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleDelete(doc.id);
                                      setShowActions(null);
                                    }}
                                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400"
                                  >
                                    <TrashIcon className="h-4 w-4 mr-2" />
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Documents Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDocuments.length === 0 ? (
            <div className="fn-card col-span-full text-center py-12">
              <DocumentTextIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No documents found</p>
            </div>
          ) : (
            filteredDocuments.map((doc) => {
              const statusConfig = getStatusConfig(doc.status);
              const typeConfig = getDocumentTypeConfig(doc.document_type);
              const StatusIcon = statusConfig.icon;
              
              return (
                <div
                  key={doc.id}
                  className="fn-card hover:shadow-lg transition-shadow duration-200 p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <typeConfig.Icon className="h-7 w-7 text-gray-400" />
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusConfig.bgColor} ${statusConfig.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {STATUS_LABEL[doc.status] || doc.status}
                    </span>
                  </div>
                  
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{doc.document_number}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 truncate">{doc.document_title || typeConfig.label}</p>
                  
                  <div className="text-xs text-gray-400 mb-4">
                    <div className="flex items-center gap-1 mb-1">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {new Date(doc.document_date).toLocaleDateString('id-ID')}
                    </div>
                    {doc.reference_number && (
                      <div className="flex items-center gap-1">
                        <FolderIcon className="h-3.5 w-3.5" />
                        {doc.reference_number}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <PrinterIcon className="h-3.5 w-3.5 mr-1" />
                      {doc.print_count} prints
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        onClick={() => handlePreview(doc.id)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg dark:text-blue-400"
                        title="Preview"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadPDF(doc.id, doc.document_number)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg dark:text-red-400"
                        title="Download PDF"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handlePrint(doc.id)}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 rounded-lg dark:text-gray-300"
                        title="Print"
                      >
                        <PrinterIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
