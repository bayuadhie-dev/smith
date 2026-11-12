import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  BuildingOfficeIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  DocumentTextIcon,
  UsersIcon,
  BanknotesIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import {
  useGetSuppliersQuery,
  useGetPurchaseOrdersQuery,
  useGetContractsQuery,
  useGetQuotesQuery
} from '../../services/api';
import { PageHeader, KpiStrip, QuickLinks } from '../../components/ui/PageKit';
import { formatRupiah } from '../../utils/currencyUtils';

export default function Purchasing() {
  const [activeTab, setActiveTab] = useState('overview')
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([])
  
  // Get summary data
  const { data: suppliersData } = useGetSuppliersQuery({ per_page: 5 })
  const { data: purchaseOrdersData } = useGetPurchaseOrdersQuery({ per_page: 5 })
  const { data: contractsData } = useGetContractsQuery({ per_page: 5 })
  const { data: quotesData } = useGetQuotesQuery({ per_page: 5 })
  
  // Build recent activities from real data
  useEffect(() => {
    const activities: any[] = [];
    
    // Add recent POs
    if (purchaseOrdersData?.purchase_orders) {
      purchaseOrdersData.purchase_orders.slice(0, 2).forEach((po: any) => {
        activities.push({
          id: `po-${po.id}`,
          type: 'po_created',
          title: `PO ${po.po_number}`,
          description: po.supplier?.name || 'Supplier',
          time: po.created_at ? new Date(po.created_at).toLocaleDateString('id-ID') : '-',
          icon: DocumentTextIcon,
          color: 'text-blue-600 dark:text-blue-400'
        });
      });
    }
    
    // Add recent suppliers
    if (suppliersData?.suppliers) {
      suppliersData.suppliers.slice(0, 2).forEach((supplier: any) => {
        activities.push({
          id: `sup-${supplier.id}`,
          type: 'supplier_added',
          title: supplier.name,
          description: supplier.contact_person || 'Supplier baru',
          time: supplier.created_at ? new Date(supplier.created_at).toLocaleDateString('id-ID') : '-',
          icon: BuildingOfficeIcon,
          color: 'text-green-600 dark:text-green-400'
        });
      });
    }
    
    setRecentActivities(activities.slice(0, 4));
  }, [purchaseOrdersData, suppliersData]);
  
  // Build pending approvals from real data
  useEffect(() => {
    const approvals: any[] = [];
    
    if (purchaseOrdersData?.purchase_orders) {
      purchaseOrdersData.purchase_orders
        .filter((po: any) => po.status === 'pending' || po.status === 'draft')
        .slice(0, 3)
        .forEach((po: any) => {
          approvals.push({
            id: po.id,
            type: 'purchase_order',
            title: po.po_number,
            description: `Pesanan pembelian - ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(po.total_amount || 0)}`,
            supplier: po.supplier?.name || 'Supplier',
            amount: po.total_amount || 0,
            priority: po.priority || 'normal'
          });
        });
    }
    
    setPendingApprovals(approvals);
  }, [purchaseOrdersData]);

  const tabs = [
    { id: 'overview', name: 'Ringkasan', icon: ChartBarIcon },
    { id: 'suppliers', name: 'Supplier', icon: BuildingOfficeIcon },
    { id: 'purchase-orders', name: 'Pesanan Pembelian', icon: DocumentTextIcon },
    { id: 'quotes', name: 'Penawaran & RFQ', icon: BanknotesIcon },
    { id: 'contracts', name: 'Kontrak', icon: ClipboardDocumentListIcon },
    { id: 'price-comparison', name: 'Analisis Harga', icon: ChartBarIcon },
  ]

  const stats = [
    {
      name: 'Supplier aktif',
      value: suppliersData?.total || 0,
      icon: UsersIcon,
      gradient: 'from-primary-600 to-primary-700',
      link: '/app/purchasing/suppliers',
      span: true,
    },
    {
      name: 'Pesanan Pembelian',
      value: purchaseOrdersData?.total || 0,
      icon: DocumentTextIcon,
      gradient: 'from-teal-500 to-teal-600',
      link: '/app/purchasing/purchase-orders'
    },
    {
      name: 'Kontrak aktif',
      value: contractsData?.contracts?.filter((c: any) => c.status === 'active').length || 0,
      icon: ClipboardDocumentListIcon,
      gradient: 'from-violet-500 to-violet-600',
      link: '/app/purchasing/contracts'
    },
    {
      name: 'Penawaran menunggu',
      value: quotesData?.quotes?.filter((q: any) => q.status === 'submitted').length || 0,
      icon: BanknotesIcon,
      gradient: 'from-cta-500 to-cta-700',
      link: '/app/purchasing/quotes'
    },
  ]

  // 2026-10-07: Axion bento-grid restyle (tier-1 module landing page,
  // #4 of 4). Sub-pages (Suppliers list, PO list, Contracts, etc) are
  // intentionally left as-is - only this landing dashboard is in scope.
  return (
    <div className="space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen p-6">
      <PageHeader
        title="Dashboard Pembelian"
        subtitle="Pemasok, permintaan, pesanan, dan kontrak pembelian"
        actions={
          <>
            <Link to="/app/purchasing/price-comparison" className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">Analisis Harga</Link>
            <Link to="/app/purchasing/suppliers/new" className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">Tambah Supplier</Link>
            <Link to="/app/purchasing/purchase-orders/new" className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800">Buat PO</Link>
          </>
        }
      />

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5" />
                {tab.name}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <KpiStrip
            items={stats.map((st) => ({ label: st.name, value: Number(st.value).toLocaleString('id-ID'), to: st.link }))}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Aktivitas terbaru */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Aktivitas terbaru</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {recentActivities.map((activity) => {
                    const Icon = activity.icon
                    return (
                      <div key={activity.id} className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-700`}>
                          <Icon className={`h-4 w-4 ${activity.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{activity.title}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{activity.description}</p>
                          <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Menunggu persetujuan */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Menunggu persetujuan</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {pendingApprovals.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-md">
                      <div className="flex items-center space-x-3">
                        <ClockIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{item.supplier}</p>
                          <p className="text-xs text-gray-400">{item.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatRupiah(item.amount)}
                        </p>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}>
                          {item.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <Link
                    to="/app/purchasing/purchase-orders?status=pending_approval"
                    className="text-sm text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 font-medium"
                  >
                    Lihat semua yang menunggu →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <QuickLinks
            title="Pintasan"
            links={[
              { to: '/app/purchasing/suppliers/new', label: 'Tambah supplier' },
              { to: '/app/purchasing/rfqs/new', label: 'Buat RFQ' },
              { to: '/app/purchasing/contracts/new', label: 'Kontrak baru' },
              { to: '/app/purchasing/requisitions/new', label: 'Buat permintaan pembelian (PR)' },
              { to: '/app/purchasing/price-comparison', label: 'Analisis harga' },
            ]}
          />
        </div>
      )}

      {/* Other tab contents would be rendered here based on activeTab */}
      {activeTab === 'suppliers' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center">
            <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Pengelolaan supplier</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Buka halaman lengkapnya lewat tombol di bawah.
            </p>
            <div className="mt-6">
              <Link
                to="/app/purchasing/suppliers"
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white font-medium rounded-md hover:bg-emerald-800 text-sm"
              >
                Lihat semua supplier
              </Link>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'purchase-orders' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Pengelolaan pesanan pembelian</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Buka halaman lengkapnya lewat tombol di bawah.
            </p>
            <div className="mt-6">
              <Link
                to="/app/purchasing/purchase-orders"
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white font-medium rounded-md hover:bg-emerald-800 text-sm"
              >
                Lihat semua pesanan pembelian
              </Link>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'contracts' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center">
            <ClipboardDocumentListIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Pengelolaan kontrak</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Buka halaman lengkapnya lewat tombol di bawah.
            </p>
            <div className="mt-6">
              <Link
                to="/app/purchasing/contracts"
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white font-medium rounded-md hover:bg-emerald-800 text-sm"
              >
                Lihat semua kontrak
              </Link>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'price-comparison' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center">
            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Analisis harga</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Buka halaman lengkapnya lewat tombol di bawah.
            </p>
            <div className="mt-6">
              <Link
                to="/app/purchasing/price-comparison"
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white font-medium rounded-md hover:bg-emerald-800 text-sm"
              >
                Mulai analisis harga
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
