import { Link, useLocation } from 'react-router-dom';
import { HomeIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useTrail } from './BreadcrumbTrail';

interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
  go?: () => void;
}

// Route to label mapping
const routeLabels: Record<string, string> = {
  'app': 'Home',
  'dashboard': 'Dashboard',
  // Products
  'products': 'Products',
  'bom': 'Bill of Materials',
  'categories': 'Categories',
  'lifecycle': 'Lifecycle',
  'calculator': 'Cost Calculator',
  'analytics': 'Analytics',
  // Warehouse
  'warehouse': 'Inventory',
  'inventory': 'Inventory',
  'materials': 'Materials',
  'stock-input': 'Stock Input',
  'locations': 'Lokasi Gudang',
  'zones': 'Master Gudang',
  'movements': 'Mutasi Stok',
  'transfers': 'Pemindahan & Penerimaan Barang',
  'receive': 'Penerimaan Barang',
  'item-stock': 'Stok Barang',
  'gudang': 'Gudang',
  'adjustments': 'Penyesuaian Stok',
  // Production
  'production': 'Production',
  'work-orders': 'SPK',
  'scheduling': 'Scheduling',
  'mrp': 'MRP',
  'demand-planning': 'Demand Planning',
  'capacity-planning': 'Capacity Planning',
  'efficiency': 'Efficiency',
  'traceability': 'Traceability',
  // Quality
  'quality': 'Quality Control',
  'tests': 'Quality Tests',
  // Purchasing
  'purchasing': 'Purchasing',
  'suppliers': 'Suppliers',
  'orders': 'Orders',
  'rfq': 'RFQ',
  'contracts': 'Contracts',
  'price-comparison': 'Price Comparison',
  'supplier-integration': 'Supplier Integration',
  // Sales
  'sales': 'Sales',
  // Shipping
  'shipping': 'Shipping',
  'tracking': 'Tracking',
  'providers': 'Providers',
  // Finance
  'finance': 'Finance',
  'accounting': 'Accounting',
  'budget': 'Budget',
  'cash-flow': 'Cash Flow',
  'wip-ledger': 'WIP Ledger',
  'reports': 'Reports',
  'approval': 'Approvals',
  // HR
  'hr': 'Human Resources',
  'employees': 'Employees',
  'attendance': 'Attendance',
  'leaves': 'Leave Management',
  'payroll': 'Payroll',
  'appraisal': 'Performance',
  'training': 'Training',
  'roster': 'Work Roster',
  // Maintenance
  'maintenance': 'Maintenance',
  'records': 'SPK',
  'schedules': 'Schedule',
  'request': 'Request',
  // R&D
  'rd': 'R&D',
  'projects': 'Projects',
  'experiments': 'Experiments',
  // 'materials': 'Materials', // already defined
  // 'products': 'Products', // already defined
  // 'reports': 'Reports', // already defined
  // Others
  'waste': 'Waste Management',
  'returns': 'Returns',
  'oee': 'OEE Monitoring',
  'tv-display': 'TV Display',
  'documents': 'Documents',
  'settings': 'Settings',
  // Actions
  'new': 'New',
  'edit': 'Edit',
  'details': 'Details',
  'list': 'List',
  'executive': 'Eksekutif',
  'production-monitoring': 'Production Monitoring',
  'pre-shift-checklist': 'Pre-Shift Checklist',
  'live-monitoring': 'Patroli Mesin',
  'petty-cash': 'Kas Kecil',
  'inventory-mutation': 'Nilai Persediaan',
  'inventory-by-warehouse': 'Kuantitas Barang per Gudang',
};

// Jalur induk yang tidak punya halaman sendiri: tampil sebagai teks, bukan tautan
const NO_PAGE = new Set([
  '/app/chat/server', '/app/debug', '/app/executive', '/app/finance/payments', '/app/finance/recurring-payment-transactions',
  '/app/finance/reports/ledger', '/app/finance/reports/statement', '/app/hr/appraisal/cycles', '/app/hr/leaves/request',
  '/app/hr/payroll/periods', '/app/integration', '/app/manual/category', '/app/oee/machines', '/app/production/batches',
  '/app/production/live-monitoring/view', '/app/production/planning/edit', '/app/production/pre-shift-checklist/view',
  '/app/production/quality-checks', '/app/production/schedules', '/app/production/weekly-plans', '/app/quality-enhanced',
  '/app/quality/objective', '/app/reports/generate', '/app/warehouse/gudang', '/app/warehouse/item-stock',
]);

const Breadcrumb = () => {
  const location = useLocation();
  const trail = useTrail();
  const pathnames = location.pathname.split('/').filter((x) => x);

  // Generate breadcrumb items
  const breadcrumbItems: BreadcrumbItem[] = pathnames.map((segment, index) => {
    const href = `/${pathnames.slice(0, index + 1).join('/')}`;
    
    // Check if segment is a number (ID)
    const isId = /^\d+$/.test(segment);
    
    // Get label from mapping or format the segment
    let label = routeLabels[segment] || segment.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    if (isId) {
      label = `#${segment}`;
    }

    return {
      label,
      href: index < pathnames.length - 1 && !NO_PAGE.has(href) ? href : undefined,
      current: index === pathnames.length - 1,
    };
  });

  // Rantai drill-down dari halaman: crumb rute terakhir menjadi tautan kembali ke tingkat awal halaman
  const routeItems = breadcrumbItems.slice(1);
  const shown: BreadcrumbItem[] = trail && trail.items.length
    ? [
        ...routeItems.map((it, i) => (i === routeItems.length - 1 ? { ...it, href: undefined, current: false, go: trail.root } : it)),
        ...trail.items.map((t, i) => ({ label: t.label, go: t.go, current: i === trail.items.length - 1 })),
      ]
    : routeItems;

  // Don't show breadcrumb on home page
  if (pathnames.length <= 1) {
    return null;
  }

  return (
    <nav className="mb-6" aria-label="Breadcrumb">
      <div className="bg-white dark:bg-gray-800 dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 px-4 py-3">
        <ol className="flex items-center flex-wrap gap-1 text-sm">
          {/* Home */}
          <li>
            <Link
              to="/app"
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-slate-500 hover:text-primary-600 hover:bg-primary-50 dark:text-slate-400 dark:hover:text-primary-400 dark:hover:bg-slate-700 transition-all"
            >
              <HomeIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
          </li>

          {shown.map((item, index) => (
            <li key={index} className="flex items-center">
              <ChevronRightIcon className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-0.5" />
              {item.go ? (
                <button
                  type="button"
                  onClick={item.go}
                  className="px-2 py-1 rounded-md text-slate-600 hover:text-primary-600 hover:bg-primary-50 dark:text-slate-400 dark:hover:text-primary-400 dark:hover:bg-slate-700 transition-all font-medium"
                >
                  {item.label}
                </button>
              ) : item.href ? (
                <Link
                  to={item.href}
                  className="px-2 py-1 rounded-md text-slate-600 hover:text-primary-600 hover:bg-primary-50 dark:text-slate-400 dark:hover:text-primary-400 dark:hover:bg-slate-700 transition-all font-medium"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={item.current ? 'page' : undefined}
                  className={item.current
                    ? 'px-2 py-1 rounded-md bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-semibold'
                    : 'px-2 py-1 rounded-md text-slate-500 dark:text-slate-400 font-medium'}
                >
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
};

export default Breadcrumb;
