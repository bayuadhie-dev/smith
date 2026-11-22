import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  UserGroupIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { useUrlFilter } from '../../hooks/useUrlState'
import { PageHeader, KpiStrip, Segmented, StatusPill } from '../../components/ui/PageKit';
import type { Tone } from '../../components/ui/PageKit';

interface ApprovalStats {
  pending_review: number;
  pending_approval: number;
  approved: number;
  rejected: number;
  my_pending: number;
}

interface Workflow {
  id: number;
  transaction_type: string;
  transaction_number: string;
  status: string;
  current_step: string;
  submitted_by: string;
  submitted_at: string;
  reviewer: string | null;
  approver: string | null;
}

export default function ApprovalDashboard() {
  const [stats, setStats] = useState<ApprovalStats>({
    pending_review: 0,
    pending_approval: 0,
    approved: 0,
    rejected: 0,
    my_pending: 0
  });
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useUrlFilter<string>('saring', 'my_tasks')

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load statistics
      const statsRes = await axiosInstance.get('/api/approval/dashboard');
      setStats(statsRes.data.statistics);
      
      // Load workflows
      const params: any = {};
      if (filter === 'my_tasks') {
        params.my_tasks = 'true';
      } else if (filter !== 'all') {
        params.status = filter;
      }
      
      const workflowsRes = await axiosInstance.get('/api/approval/workflows', { params });
      setWorkflows(workflowsRes.data.workflows);
      
    } catch (error) {
      console.error('Error loading approval data:', error);
    } finally {
      setLoading(false);
    }
  };

  const STATUS_LABEL: Record<string, string> = {
    pending_review: 'Menunggu tinjauan',
    pending_approval: 'Menunggu persetujuan',
    approved: 'Disetujui',
    rejected: 'Ditolak',
  };

  const STATUS_TONE: Record<string, Tone> = {
    pending_review: 'warn',
    pending_approval: 'info',
    approved: 'ok',
    rejected: 'bad',
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      sales_order: 'Pesanan Penjualan',
      purchase_order: 'Pesanan Pembelian',
      production: 'Produksi',
      inventory_adjustment: 'Penyesuaian Stok',
      stock_transfer: 'Transfer Stok',
      stock_opname: 'Stok Opname',
      expense: 'Biaya',
      payment: 'Pembayaran'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // 2026-10-07: Axion bento-grid restyle (tier-1 module landing page,
  // #12 of 17). Sub-pages (workflow detail) are intentionally left
  // as-is - only this landing dashboard is in scope.
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="PERSETUJUAN · RINGKASAN"
        title="Persetujuan Transaksi"
        subtitle="Dokumen yang menunggu tinjauan dan persetujuan."
      />

      <KpiStrip
        items={[
          { label: 'Menunggu tinjauan', value: stats.pending_review, tone: stats.pending_review > 0 ? 'warn' : null },
          { label: 'Menunggu persetujuan', value: stats.pending_approval, tone: stats.pending_approval > 0 ? 'warn' : null },
          { label: 'Disetujui', value: stats.approved, tone: 'good' },
          { label: 'Ditolak', value: stats.rejected, tone: stats.rejected > 0 ? 'bad' : null },
          { label: 'Tugas saya', value: stats.my_pending },
        ]}
      />

      {/* Filter Tabs */}
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'my_tasks', label: `Tugas saya (${stats.my_pending})` },
          { value: 'pending_review', label: 'Menunggu tinjauan' },
          { value: 'pending_approval', label: 'Menunggu persetujuan' },
          { value: 'all', label: 'Semua' },
        ]}
      />

      {/* Workflows List */}
      <div className="fn-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Transaksi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Jenis
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Diajukan oleh
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Peninjau
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Penyetuju
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {workflows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <ChartBarIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p>Belum ada dokumen yang perlu disetujui</p>
                  </td>
                </tr>
              ) : (
                workflows.map((workflow) => (
                  <tr key={workflow.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {workflow.transaction_number}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(workflow.submitted_at).toLocaleDateString('id-ID')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {getTransactionTypeLabel(workflow.transaction_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusPill tone={STATUS_TONE[workflow.status] || 'muted'}>
                        {STATUS_LABEL[workflow.status] || workflow.status}
                      </StatusPill>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {workflow.submitted_by}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {workflow.reviewer || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {workflow.approver || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link
                        to={`/app/approval/${workflow.id}`}
                        className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400"
                      >
                        Lihat rincian
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
