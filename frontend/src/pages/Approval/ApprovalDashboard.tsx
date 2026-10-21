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
  const [filter, setFilter] = useState('my_tasks');

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_review':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending_approval':
        return 'bg-blue-100 text-blue-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      sales_order: 'Sales Order',
      purchase_order: 'Purchase Order',
      production: 'Production',
      inventory_adjustment: 'Inventory Adjustment',
      stock_transfer: 'Transfer Stok',
      stock_opname: 'Stok Opname',
      expense: 'Expense',
      payment: 'Payment'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#059669]"></div>
      </div>
    );
  }

  // 2026-10-07: Axion bento-grid restyle (tier-1 module landing page,
  // #12 of 17). Sub-pages (workflow detail) are intentionally left
  // as-is - only this landing dashboard is in scope.
  return (
    <div className="space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-snug">Approval</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Manage transaction approvals with review and approval process</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-[#F15D2C] to-[#C73E1D] rounded-xl shadow-lg p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Pending Review</p>
              <p className="text-3xl font-bold mt-2">{stats.pending_review}</p>
            </div>
            <ClockIcon className="h-10 w-10 opacity-75" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Pending Approval</p>
              <p className="text-3xl font-bold mt-2">{stats.pending_approval}</p>
            </div>
            <DocumentTextIcon className="h-10 w-10 opacity-75" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#059669] to-[#047857] rounded-xl shadow-lg p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Approved</p>
              <p className="text-3xl font-bold mt-2">{stats.approved}</p>
            </div>
            <CheckCircleIcon className="h-10 w-10 opacity-75" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Rejected</p>
              <p className="text-3xl font-bold mt-2">{stats.rejected}</p>
            </div>
            <XCircleIcon className="h-10 w-10 opacity-75" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl shadow-lg p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">My Pending Tasks</p>
              <p className="text-3xl font-bold mt-2">{stats.my_pending}</p>
            </div>
            <UserGroupIcon className="h-10 w-10 opacity-75" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-4">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'my_tasks', label: `My Tasks (${stats.my_pending})` },
            { id: 'pending_review', label: 'Pending Review' },
            { id: 'pending_approval', label: 'Pending Approval' },
            { id: 'all', label: 'All Workflows' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                filter === tab.id
                  ? 'bg-gradient-to-br from-[#059669] to-[#047857] text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Workflows List */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Transaction
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Submitted By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Reviewer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Approver
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {workflows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <ChartBarIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p>No workflows found</p>
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
                        {new Date(workflow.submitted_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {getTransactionTypeLabel(workflow.transaction_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(workflow.status)}`}>
                        {workflow.status.replace('_', ' ').toUpperCase()}
                      </span>
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
                        View Details
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
