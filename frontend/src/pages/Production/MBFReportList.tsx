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
import axiosInstance from '../../utils/axiosConfig';
import { format } from 'date-fns';
import axios from 'axios';
import { confirmDialog } from '../../components/ui';
import { useListTools, type ListColumn } from '../../hooks/useListTools';
import { ListToolbar, SortTh } from '../../components/ui/ListTools';
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

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', pending_review: 'Dalam Review', approved: 'Disetujui', rejected: 'Ditolak' };
const COLUMNS: ListColumn<MBFReportItem>[] = [
  { key: 'report_number', label: 'No. Laporan', value: (r) => r.report_number },
  { key: 'delivery_date', label: 'Tgl Pengiriman', value: (r) => r.delivery_date, type: 'date' },
  { key: 'period_start', label: 'Periode Mulai', value: (r) => r.period_start, type: 'date' },
  { key: 'period_end', label: 'Periode Selesai', value: (r) => r.period_end, type: 'date', sortable: false },
  { key: 'total_target', label: 'Target', value: (r) => r.total_target, type: 'number' },
  { key: 'total_actual', label: 'Aktual', value: (r) => r.total_actual, type: 'number' },
  { key: 'achievement_percentage', label: 'Pencapaian (%)', value: (r) => r.achievement_percentage, type: 'number' },
  { key: 'status', label: 'Status', value: (r) => r.status, exportValue: (r) => STATUS_LABEL[r.status] || r.status },
];

const MBFReportList: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<MBFReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchReports();
  }, [statusFilter]);

  const tools = useListTools<MBFReportItem>(reports, COLUMNS, { filename: 'Laporan_MBF', initialSort: { key: 'delivery_date', dir: 'desc' } });

  const fetchReports = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ page: '1', per_page: '1000' });
      if (statusFilter) params.append('status', statusFilter);

      const response = await axiosInstance.get(`/api/mbf-report/reports?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReports(response.data.reports);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal memuat laporan');
    } finally {
      setLoading(false);
    }
  };

  const deleteReport = async (id: number, reportNumber: string) => {
    if (!(await confirmDialog(`Hapus laporan ${reportNumber}? Tindakan ini tidak bisa dibatalkan.`))) return;
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
      case 'approved': return <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case 'rejected': return <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case 'pending_review': return <ClockIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
      default: return <DocumentTextIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100',
      pending_review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };
    const labels: Record<string, string> = {
      draft: 'Draft',
      pending_review: 'Dalam Review',
      approved: 'Disetujui',
      rejected: 'Ditolak',
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Laporan MBF
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Mahakam Beta Farma — Octenic & Gloveclean
          </p>
        </div>
        <button
          onClick={() => navigate('/app/production/mbf-report/new')}
          className="flex items-center px-4 py-2 bg-cta-600 text-white rounded-lg hover:bg-cta-700 shadow-sm"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Buat Laporan Baru
        </button>
      </div>

      <div className="mb-4"><ListToolbar tools={tools} placeholder="Cari nomor laporan, status" /></div>

      {/* Filter */}
      <div className="mb-4 flex space-x-2">
        {['', 'draft', 'pending_review', 'approved', 'rejected'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200'
            }`}
          >
            {status === '' ? 'Semua' : status === 'draft' ? 'Draft' : status === 'pending_review' ? 'Dalam Review' : status === 'approved' ? 'Disetujui' : 'Ditolak'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        ) : tools.rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-gray-400">
            <DocumentTextIcon className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-lg font-medium">{tools.total === 0 ? 'Belum ada laporan' : 'Tidak ada laporan yang cocok'}</p>
            {tools.total === 0 && <p className="text-sm">Klik "Buat Laporan Baru" untuk memulai</p>}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <SortTh tools={tools} col="report_number" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. Laporan</SortTh>
                <SortTh tools={tools} col="delivery_date" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tgl Pengiriman</SortTh>
                <SortTh tools={tools} col="period_start" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Periode</SortTh>
                <SortTh tools={tools} col="total_target" align="right" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Target</SortTh>
                <SortTh tools={tools} col="total_actual" align="right" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aktual</SortTh>
                <SortTh tools={tools} col="achievement_percentage" align="right" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Pencapaian</SortTh>
                <SortTh tools={tools} col="status" align="center" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</SortTh>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {tools.rows.map(report => (
                <tr
                  key={report.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 cursor-pointer transition-colors"
                  onClick={() => navigate(`/app/production/mbf-report/${report.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(report.status)}
                      <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">{report.report_number}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {format(new Date(report.delivery_date), 'dd MMM yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {format(new Date(report.period_start), 'dd MMM')} — {format(new Date(report.period_end), 'dd MMM yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white font-medium">
                    {report.total_target.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white font-medium">
                    {report.total_actual.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <span className={`font-bold ${
                      report.achievement_percentage >= 100 ? 'text-green-600 dark:text-green-400' :
                      report.achievement_percentage >= 80 ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
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
                        className="text-primary-600 hover:text-primary-800 text-sm font-medium dark:text-primary-400"
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

      </div>
    </div>
  );
};

export default MBFReportList;
