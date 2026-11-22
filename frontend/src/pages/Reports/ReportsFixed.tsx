import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  AcademicCapIcon,
  BanknotesIcon,
  BeakerIcon,
  ChartBarIcon,
  ClockIcon,
  Cog6ToothIcon,
  CubeIcon,
  DocumentTextIcon,
  FunnelIcon,
  TruckIcon,
  UsersIcon
} from '@heroicons/react/24/outline';
interface ReportCard {
  id: string
  title: string
  description: string
  icon: any
  category: string
  frequency: string
  onClick: () => void
}

export default function Reports() {
    const { t } = useLanguage();

const [selectedCategory, setSelectedCategory] = useState('all')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Auto-select category based on URL parameter
  useEffect(() => {
    const moduleParam = searchParams.get('module')
    if (moduleParam) {
      // Map module parameters to categories
      const moduleMapping: Record<string, string> = {
        'attendance': 'hr',
        'appraisal': 'hr', 
        'training': 'hr',
        'payroll': 'hr',
        'leave': 'hr'
      }
      const category = moduleMapping[moduleParam] || moduleParam
      setSelectedCategory(category)
    }
  }, [searchParams])

  const newFeatures: ReportCard[] = [
    {
      id: 'advanced-builder',
      title: 'Perancang Laporan Lanjutan',
      description: 'Susun laporan sendiri dengan penyaring dan tampilan yang lebih rinci',
      icon: Cog6ToothIcon,
      category: 'tools',
      frequency: 'Sesuai permintaan',
      onClick: () => navigate('/app/reports/advanced-builder')
    },
    {
      id: 'scheduled-reports',
      title: 'Laporan Terjadwal',
      description: 'Laporan dibuat dan dikirim otomatis sesuai jadwal',
      icon: ClockIcon,
      category: 'tools',
      frequency: 'Otomatis',
      onClick: () => navigate('/app/reports/scheduler')
    },
    {
      id: 'executive-dashboard',
      title: 'Dashboard Eksekutif',
      description: 'Gambaran besar bisnis dan indikator kinerja utama',
      icon: ChartBarIcon,
      category: 'executive',
      frequency: 'Langsung',
      onClick: () => navigate('/app/reports/executive')
    }
  ]

  const reports: ReportCard[] = [
    {
      id: 'sales-summary',
      title: 'Ringkasan Penjualan',
      description: 'Kinerja penjualan bulanan, pelanggan teratas, dan tren omzet',
      icon: ChartBarIcon,
      category: 'sales',
      frequency: 'Bulanan',
      onClick: () => navigate('/app/reports/generate/sales-summary')
    },
    {
      id: 'production-efficiency',
      title: 'Efisiensi Produksi',
      description: 'Pemakaian mesin, waktu berhenti, dan produktivitas',
      icon: CubeIcon,
      category: 'production',
      frequency: 'Mingguan',
      onClick: () => navigate('/app/reports/generate/production-efficiency')
    },
    {
      id: 'inventory-status',
      title: 'Status Persediaan',
      description: 'Tingkat stok, titik pesan ulang, dan nilai persediaan',
      icon: DocumentTextIcon,
      category: 'inventory',
      frequency: 'Harian',
      onClick: () => navigate('/app/reports/generate/inventory-status')
    },
    {
      id: 'financial-summary',
      title: 'Ringkasan Keuangan',
      description: 'Laba rugi, arus kas, dan selisih anggaran',
      icon: BanknotesIcon,
      category: 'finance',
      frequency: 'Bulanan',
      onClick: () => navigate('/app/reports/generate/financial-summary')
    },
    {
      id: 'hr-analytics',
      title: 'HR Analytics Report',
      description: 'Employee performance, attendance, and workforce analytics',
      icon: UsersIcon,
      category: 'hr',
      frequency: 'Bulanan',
      onClick: () => navigate('/app/reports/generate/hr-analytics')
    },
    {
      id: 'quality-metrics',
      title: 'Quality Metrics Report',
      description: 'Quality control results, defect rates, and compliance tracking',
      icon: BeakerIcon,
      category: 'quality',
      frequency: 'Mingguan',
      onClick: () => navigate('/app/reports/generate/quality-metrics')
    },
    {
      id: 'shipping-performance',
      title: 'Shipping Performance Report',
      description: 'Delivery times, shipping costs, and logistics efficiency',
      icon: TruckIcon,
      category: 'shipping',
      frequency: 'Mingguan',
      onClick: () => navigate('/app/reports/generate/shipping-performance')
    },
    {
      id: 'maintenance-summary',
      title: 'Maintenance Summary Report',
      description: 'Equipment maintenance schedules, costs, and downtime analysis',
      icon: Cog6ToothIcon,
      category: 'maintenance',
      frequency: 'Bulanan',
      onClick: () => navigate('/app/reports/generate/maintenance-summary')
    },
    {
      id: 'training-progress',
      title: 'Training Progress Report',
      description: 'Employee training completion rates and skill development tracking',
      icon: AcademicCapIcon,
      category: 'hr',
      frequency: 'Bulanan',
      onClick: () => navigate('/app/reports/generate/training-progress')
    },
    {
      id: 'custom-report',
      title: 'Perancang Laporan Sendiri',
      description: 'Rakit laporan dengan parameter dan penyaring sendiri',
      icon: Cog6ToothIcon,
      category: 'custom',
      frequency: 'Sesuai permintaan',
      onClick: () => navigate('/app/reports/custom')
    }
  ]

  const namaKategori: Record<string, string> = {
    sales: 'Penjualan', production: 'Produksi', inventory: 'Persediaan',
    finance: 'Keuangan', hr: 'SDM', quality: 'Kualitas', shipping: 'Pengiriman',
    maintenance: 'Pemeliharaan', custom: 'Buatan sendiri', tools: 'Alat',
    executive: 'Eksekutif',
  }

  const categories = [
    { id: 'all', label: 'Semua laporan' },
    { id: 'sales', label: t('navigation.sales') },
    { id: 'production', label: t('navigation.production') },
    { id: 'inventory', label: 'Persediaan' },
    { id: 'finance', label: t('navigation.finance') },
    { id: 'hr', label: 'SDM' },
    { id: 'quality', label: t('navigation.quality') },
    { id: 'shipping', label: 'Pengiriman' },
    { id: 'maintenance', label: t('navigation.maintenance') },
    { id: 'custom', label: 'Buatan sendiri' },
  ]

  const filteredReports = selectedCategory === 'all' 
    ? reports 
    : reports.filter(report => report.category === selectedCategory)

  const getFrequencyBadge = (frequency: string) => {
    const badges: Record<string, string> = {
      'Harian': 'badge-success',
      'Mingguan': 'badge-info',
      'Bulanan': 'badge-warning',
      'Sesuai permintaan': 'badge-gray'
    }
    return badges[frequency] || 'badge-info'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="fn-label mb-1.5">LAPORAN · KATALOG</div>
          <h1 className="text-[28px] font-semibold text-gray-900 dark:text-white tracking-tight leading-tight">Laporan</h1>
          <p className="text-gray-600 dark:text-gray-300">Kumpulan laporan siap pakai untuk setiap modul.</p>
        </div>
        <Link
          to="/app/reports/scheduler"
          className="btn-primary"
        >
          <Cog6ToothIcon className="h-5 w-5 mr-2" />
          Atur jadwal laporan
        </Link>
      </div>

      {/* Category FunnelIcon */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === category.id
                  ? 'bg-primary-100 text-primary-700 border border-primary-200 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-800'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {/* New Features Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Alat laporan</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {newFeatures.map((feature) => {
            const IconComponent = feature.icon
            return (
              <div
                key={feature.id}
                onClick={feature.onClick}
                className="card p-6 hover:shadow-lg transition-all duration-200 cursor-pointer hover:border-green-200 group bg-gradient-to-br from-green-50 to-blue-50"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors dark:bg-green-900/30">
                    <IconComponent className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="badge badge-success">
                    {feature.frequency}
                  </span>
                </div>
                
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-green-700 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                  {feature.description}
                </p>
                
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{namaKategori[feature.category] || feature.category}</span>
                  <span className="text-green-600 font-medium dark:text-green-400">Siap dipakai</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Standard Reports Grid */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Laporan siap pakai</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.map((report) => {
            const IconComponent = report.icon
            return (
              <div
                key={report.id}
                onClick={report.onClick}
                className="card p-6 hover:shadow-lg transition-all duration-200 cursor-pointer hover:border-primary-200 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-primary-50 rounded-lg group-hover:bg-primary-100 transition-colors dark:bg-primary-900/20">
                    <IconComponent className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <span className={`badge ${getFrequencyBadge(report.frequency)}`}>
                    {report.frequency}
                  </span>
                </div>
                
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-primary-700 transition-colors">
                  {report.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                  {report.description}
                </p>

                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      {namaKategori[report.category] || report.category}
                    </span>
                    <button className="text-primary-600 hover:text-primary-700 text-sm font-medium dark:text-primary-400">
                      Buka →
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link 
            to="/app/reports/custom"
            className="btn-secondary text-center"
          >
            Custom Report Builder
          </Link>
          <Link 
            to="/app/dashboard"
            className="btn-secondary text-center"
          >
            View Analytics Dashboard
          </Link>
          <Link 
            to="/app/reports/scheduler"
            className="btn-secondary text-center"
          >
            Atur jadwal laporan
          </Link>
          <button 
            onClick={() => window.print()}
            className="btn-secondary text-center"
          >
            Print Current View
          </button>
        </div>
      </div>

      {/* Tips */}
      <div className="card p-4 bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 mb-2 dark:text-blue-200">💡 Report Tips</h4>
        <ul className="text-sm text-blue-800 space-y-1 dark:text-blue-300">
          <li>• Reports are automatically updated based on their frequency</li>
          <li>• Use filters to customize report data before generation</li>
          <li>• Schedule reports to be delivered to your email automatically</li>
          <li>• Export reports in PDF, Excel, or CSV formats</li>
          <li>• Create custom dashboards using the Custom Report Builder</li>
        </ul>
      </div>
    </div>
  )
}
