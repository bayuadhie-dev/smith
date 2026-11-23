import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import FlaskConical from 'lucide-react/dist/esm/icons/flask-conical'
import FolderKanban from 'lucide-react/dist/esm/icons/folder-kanban'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right'
import Beaker from 'lucide-react/dist/esm/icons/beaker'
import FileCheck from 'lucide-react/dist/esm/icons/file-check'
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up'
import Users from 'lucide-react/dist/esm/icons/users'
import axiosInstance from '../../utils/axiosConfig';
import { PageHeader, KpiStrip } from '../../components/ui/PageKit';

interface DashboardData {
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  projects_by_stage: Record<string, number>;
  pending_approvals: number;
  recent_experiments: any[];
  recent_conversions: any[];
}

const stageLabels: Record<string, string> = {
  'LAB_SCALE': 'Lab Scale',
  'PILOT_SCALE': 'Pilot Scale',
  'VALIDATION': 'Validation',
  'COMPLETION': 'Selesai',
  'CANCELLED': 'Dibatalkan'
};

const stageColors: Record<string, string> = {
  'LAB_SCALE': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'PILOT_SCALE': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'VALIDATION': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'COMPLETION': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'CANCELLED': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
};

const RNDDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await axiosInstance.get('/api/rnd/dashboard');
      setData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // 2026-10-07: Axion bento-grid restyle (tier-1 module landing page,
  // #11 of 17). Sub-pages (Projects, Approvals, etc) are intentionally
  // left as-is - only this landing dashboard is in scope.
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="R&D · RINGKASAN"
        title="Riset & Pengembangan"
        subtitle="Proyek formulasi, eksperimen, dan konversi ke produksi."
        actions={
          <Link
            to="/app/rnd/projects/new"
            className="fn-press inline-flex items-center gap-2 rounded-lg bg-cta-600 px-4 py-2 text-sm font-medium text-white hover:bg-cta-700"
          >
            <FlaskConical className="h-4 w-4" />
            Proyek Baru
          </Link>
        }
      />

      <KpiStrip
        items={[
          { label: 'Total proyek', value: data?.total_projects ?? 0, to: '/app/rnd/projects' },
          { label: 'Proyek aktif', value: data?.active_projects ?? 0, to: '/app/rnd/projects?status=active' },
          { label: 'Selesai', value: data?.completed_projects ?? 0, tone: 'good' },
          {
            label: 'Menunggu persetujuan',
            value: data?.pending_approvals ?? 0,
            tone: (data?.pending_approvals ?? 0) > 0 ? 'warn' : null,
            to: '/app/rnd/approvals',
          },
        ]}
      />

      {/* Projects by Stage */}
      <div className="fn-card hover:shadow-lg transition-shadow duration-200 p-6">
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">Proyek per Tahap</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['LAB_SCALE', 'PILOT_SCALE', 'VALIDATION', 'COMPLETION'].map((stage) => (
            <div key={stage} className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${stageColors[stage]}`}>
                {stageLabels[stage]}
              </span>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {data?.projects_by_stage?.[stage] || 0}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Experiments */}
        <div className="fn-card hover:shadow-lg transition-shadow duration-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Eksperimen Terbaru</h2>
            <Beaker className="w-5 h-5 text-gray-400" />
          </div>
          {data?.recent_experiments && data.recent_experiments.length > 0 ? (
            <div className="space-y-3">
              {data.recent_experiments.map((exp: any) => (
                <div key={exp.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{exp.experiment_number}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{exp.trial_date}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    exp.status === 'PASSED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                    exp.status === 'FAILED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                    exp.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
                  }`}>
                    {exp.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">Belum ada eksperimen</p>
          )}
        </div>

        {/* Recent Conversions */}
        <div className="fn-card hover:shadow-lg transition-shadow duration-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Konversi ke Produksi</h2>
            <FileCheck className="w-5 h-5 text-gray-400" />
          </div>
          {data?.recent_conversions && data.recent_conversions.length > 0 ? (
            <div className="space-y-3">
              {data.recent_conversions.map((conv: any) => (
                <div key={conv.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{conv.project_number}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{conv.product_name}</p>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(conv.conversion_date).toLocaleDateString('id-ID')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">Belum ada konversi</p>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/app/rnd/projects"
          className="fn-card flex items-center justify-between p-4 hover:shadow-lg transition-shadow duration-200"
        >
          <div className="flex items-center gap-3">
            <FolderKanban className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="font-medium text-gray-900 dark:text-white">Daftar Proyek</span>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400" />
        </Link>

        <Link
          to="/app/rnd/approvals"
          className="fn-card flex items-center justify-between p-4 hover:shadow-lg transition-shadow duration-200"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="font-medium text-gray-900 dark:text-white">Approval Pending</span>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400" />
        </Link>

        <Link
          to="/app/rnd/projects/new"
          className="fn-card flex items-center justify-between p-4 hover:shadow-lg transition-shadow duration-200"
        >
          <div className="flex items-center gap-3">
            <FlaskConical className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span className="font-medium text-gray-900 dark:text-white">Proyek Baru</span>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400" />
        </Link>
      </div>
    </div>
  );
};

export default RNDDashboard;
