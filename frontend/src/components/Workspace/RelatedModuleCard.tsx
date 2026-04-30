import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  CubeIcon,
  BuildingStorefrontIcon,
  ChartBarIcon,
  CheckBadgeIcon,
  WrenchScrewdriverIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  TruckIcon,
  BanknotesIcon,
  UsersIcon,
  DocumentChartBarIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'

interface RelatedModuleCardProps {
  module: {
    key: string
    name: string
    description: string
    icon: string
    color: string
    permission: string
    href: string
    stats?: Array<{
      label: string
      value: string | number
      icon?: string
    }>
  }
}

const iconMap: Record<string, any> = {
  'cube': CubeIcon,
  'archive-box': BuildingStorefrontIcon,
  'chart-bar': ChartBarIcon,
  'document-check': CheckBadgeIcon,
  'wrench-screwdriver': WrenchScrewdriverIcon,
  'shopping-bag': ShoppingBagIcon,
  'shopping-cart': ShoppingCartIcon,
  'truck': TruckIcon,
  'banknotes': BanknotesIcon,
  'users': UsersIcon,
  'document-chart-bar': DocumentChartBarIcon,
  'document-text': DocumentTextIcon,
}

const colorClasses: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100',
  green: 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100',
  purple: 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100',
  orange: 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100',
  red: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100',
  indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100',
  pink: 'bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100',
  teal: 'bg-teal-50 text-teal-600 border-teal-200 hover:bg-teal-100',
  yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200 hover:bg-yellow-100',
  gray: 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100',
}

export default function RelatedModuleCard({ module }: RelatedModuleCardProps) {
  const navigate = useNavigate()
  const Icon = iconMap[module.icon] || CubeIcon

  const handleClick = () => {
    navigate(module.href)
  }

  const handleWorkspaceClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`/workspace/${module.key}`)
  }

  return (
    <div
      className={clsx(
        'relative rounded-lg border-2 p-4 transition-all duration-200 cursor-pointer',
        'hover:shadow-md hover:-translate-y-0.5',
        colorClasses[module.color] || colorClasses.blue
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={clsx(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            `bg-${module.color}-100`
          )}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{module.name}</h3>
            <p className="text-xs opacity-75 line-clamp-1">{module.description}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {module.stats && module.stats.length > 0 && (
        <div className="space-y-2 mb-3">
          {module.stats.map((stat, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-xs opacity-75">{stat.label}</span>
              <span className="text-sm font-semibold">{stat.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleClick}
          className={clsx(
            'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
            `bg-${module.color}-600 text-white hover:bg-${module.color}-700`
          )}
        >
          Open Module
        </button>
        <button
          onClick={handleWorkspaceClick}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-current transition-colors hover:bg-white dark:hover:bg-gray-700 dark:bg-gray-800/50"
        >
          Workspace
        </button>
      </div>
    </div>
  )
}
