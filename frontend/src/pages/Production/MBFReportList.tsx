import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  PlusIcon, 
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { format } from 'date-fns';

interface MBFReportItem {
  id: number;
  report_number: string;
  delivery_date: string;
  period_start: string;
  period_end: string;
  total_target: number;
  total_actual: number;
  achievement_percentage: number;
  status: string;
  approval_status: string;
  created_at: string;
}

const MBFReportList: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<MBFReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchReports();
  }, [page, statusFilter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ page: String(page), per_page: '20' });
      if (statusFilter) params.append('status', statusFilter);

      const response = await axios.get(`/api/mbf-report/reports?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReports(response.data.reports);
      setTotalPages(response.data.pages);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  const deleteReport = async (id: number, reportNumber: string) => {
    if (!window.confirm(`Hapus laporan ${reportNumber}? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/mbf-report/reports/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Laporan berhasil dihapus');
      fetchReports();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal menghapus laporan');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'rejected': return <XCircleIcon className="h-5 w-5 text-red-600" />;
      case 'pending_review': return <ClockIcon className="h-5 w-5 text-yellow-600" />;
      default: return <DocumentTextIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      pending_review: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      draft: 'Draft',
      pending_review: 'In Review',
      approved: 'Approved',
      rejected: 'Rejected',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Laporan Target & Produksi MBF
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Mahakam Beta Farma — Octenic & Gloveclean
          </p>
        </div>
        <button
          onClick={() => navigate('/app/production/mbf-report/new')}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Buat Laporan Baru
        </button>
      </div>

      {/* Filter */}
      <div className="mb-4 flex space-x-2">
        {['', 'draft', 'pending_review', 'approved', 'rejected'].map(status => (
          <button
            key={status}
            onClick={() => { setStatusFilter(status); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status === '' ? 'Semua' : status === 'draft' ? 'Draft' : status === 'pending_review' ? 'In Review' : status === 'approved' ? 'Approved' : 'Rejected'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <DocumentTextIcon className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-lg font-medium">Belum ada laporan</p>
            <p className="text-sm">Klik "Buat Laporan Baru" untuk memulai</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. Laporan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tgl Pengiriman</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periode</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Target</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aktual</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pencapaian</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reports.map(report => (
                <tr
                  key={report.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/app/production/mbf-report/${report.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(report.status)}
                      <span className="ml-2 text-sm font-medium text-gray-900">{report.report_number}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(report.delivery_date), 'dd MMM yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(report.period_start), 'dd MMM')} — {format(new Date(report.period_end), 'dd MMM yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">
                    {report.total_target.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">
                    {report.total_actual.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <span className={`font-bold ${
                      report.achievement_percentage >= 100 ? 'text-green-600' :
                      report.achievement_percentage >= 80 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {report.achievement_percentage.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {getStatusBadge(report.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/app/production/mbf-report/${report.id}`); }}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Lihat
                      </button>
                      {(report.status === 'draft' || report.status === 'rejected') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteReport(report.id, report.report_number); }}
                          className="text-red-500 hover:text-red-700 text-sm font-medium"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 bg-gray-50 border-t flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 bg-white border rounded text-sm disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <span className="text-sm text-gray-500">
              Halaman {page} dari {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 bg-white border rounded text-sm disabled:opacity-50"
            >
              Selanjutnya
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MBFReportList;
