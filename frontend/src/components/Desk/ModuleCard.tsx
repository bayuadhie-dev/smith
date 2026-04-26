import { NavLink, useNavigate } from 'react-router-dom'
import { usePermissions } from '../../contexts/PermissionContext'
import clsx from 'clsx'

interface ModuleCardProps {
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  color?: string
  badge?: {
    text: string
    color: string
  }
  permission?: string
  children?: Array<{
    name: string
    href: string
    description?: string
  }>
  stats?: {
    label: string
    value: string | number
  }
}

const colorClasses = {
  blue: 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
  green: 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
  purple: 'bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
  orange: 'bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700',
  red: 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700',
  indigo: 'bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700',
  pink: 'bg-gradient-to-br from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700',
  teal: 'bg-gradient-to-br from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700',
  yellow: 'bg-gradient-to-br from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700',
  gray: 'bg-gradient-to-br from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700',
}

export default function ModuleCard({
  name,
  description,
  icon: Icon,
  href,
  color = 'blue',
  badge,
  permission,
  children,
  stats
}: ModuleCardProps) {
  const { hasPermission, isAdmin, isSuperAdmin, isLoading } = usePermissions()
  const navigate = useNavigate()

  // Check permission
  const canView = isLoading || isAdmin || isSuperAdmin || !permission || hasPermission(`${permission}.view`)
  
  if (!canView) {
    return null
  }

  // Convert module name to workspace key
  const getWorkspaceKey = (moduleName: string) => {
    const moduleMap: Record<string, string> = {
      'Production': 'production',
      'Sales': 'sales',
      'Purchasing': 'purchasing',
      'Warehouse': 'inventory',
      'Quality': 'quality',
      'Maintenance': 'maintenance',
      'Human Resources': 'hr',
      'Finance': 'finance',
      'Accounting': 'finance',
      'Document Control': 'dcc'
    }
    return moduleMap[moduleName] || moduleName.toLowerCase()
  }

  const handleCardClick = () => {
    // Navigate directly to module's main page
    navigate(href)
  }

  return (
    <div className="group relative">
      <button
        onClick={handleCardClick}
        className={clsx(
          'w-full rounded-xl p-6 text-white transition-all duration-200 transform text-left',
          'shadow-lg hover:shadow-xl hover:-translate-y-1',
          colorClasses[color as keyof typeof colorClasses]
        )}
      >
        {/* Badge */}
        {badge && (
          <div className="absolute -top-2 -right-2">
            <span className={clsx(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold',
              badge.color === 'red' && 'bg-red-100 text-red-800',
              badge.color === 'yellow' && 'bg-yellow-100 text-yellow-800',
              badge.color === 'green' && 'bg-green-100 text-green-800',
              badge.color === 'blue' && 'bg-blue-100 text-blue-800'
            )}>
              {badge.text}
            </span>
          </div>
        )}

        {/* Icon */}
        <div className="mb-4">
          <Icon className="h-10 w-10" />
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold mb-1">{name}</h3>
        <p className="text-sm opacity-90 line-clamp-2 mb-3">{description}</p>

        {/* Stats */}
        {stats && (
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs opacity-75">{stats.label}</span>
              <span className="text-sm font-bold">{stats.value}</span>
            </div>
          </div>
        )}
      </button>

      {/* Children Menu */}
      {children && children.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-2 hidden rounded-lg bg-white shadow-lg group-hover:block">
          <div className="p-2">
            {children.map((child, index) => (
              <NavLink
                key={index}
                to={child.href}
                className={({ isActive }) =>
                  `block px-4 py-2 text-sm rounded-md transition-colors ${
                    isActive
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`
                }
              >
                {child.name}
              </NavLink>
            ))}
          </div>
        </div>
      )}
      {/* Arrow indicator */}
      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  )
}
