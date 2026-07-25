import { NavLink, useNavigate } from 'react-router-dom'
import { usePermissions } from '../../contexts/PermissionContext'
import { useState } from 'react'
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
  superAdminOnly?: boolean
  directLink?: boolean
}

const colorClasses = {
  blue: {
    gradient: 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600',
    hover: 'hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700',
    glow: 'group-hover:shadow-blue-500/50',
    icon: 'bg-blue-400/20',
  },
  green: {
    gradient: 'bg-gradient-to-br from-green-500 via-green-600 to-emerald-600',
    hover: 'hover:from-green-600 hover:via-green-700 hover:to-emerald-700',
    glow: 'group-hover:shadow-green-500/50',
    icon: 'bg-green-400/20',
  },
  purple: {
    gradient: 'bg-gradient-to-br from-purple-500 via-purple-600 to-violet-600',
    hover: 'hover:from-purple-600 hover:via-purple-700 hover:to-violet-700',
    glow: 'group-hover:shadow-purple-500/50',
    icon: 'bg-purple-400/20',
  },
  orange: {
    gradient: 'bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600',
    hover: 'hover:from-orange-600 hover:via-orange-700 hover:to-amber-700',
    glow: 'group-hover:shadow-orange-500/50',
    icon: 'bg-orange-400/20',
  },
  red: {
    gradient: 'bg-gradient-to-br from-red-500 via-red-600 to-rose-600',
    hover: 'hover:from-red-600 hover:via-red-700 hover:to-rose-700',
    glow: 'group-hover:shadow-red-500/50',
    icon: 'bg-red-400/20',
  },
  indigo: {
    gradient: 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-600',
    hover: 'hover:from-indigo-600 hover:via-indigo-700 hover:to-blue-700',
    glow: 'group-hover:shadow-indigo-500/50',
    icon: 'bg-indigo-400/20',
  },
  pink: {
    gradient: 'bg-gradient-to-br from-pink-500 via-pink-600 to-rose-600',
    hover: 'hover:from-pink-600 hover:via-pink-700 hover:to-rose-700',
    glow: 'group-hover:shadow-pink-500/50',
    icon: 'bg-pink-400/20',
  },
  teal: {
    gradient: 'bg-gradient-to-br from-teal-500 via-teal-600 to-cyan-600',
    hover: 'hover:from-teal-600 hover:via-teal-700 hover:to-cyan-700',
    glow: 'group-hover:shadow-teal-500/50',
    icon: 'bg-teal-400/20',
  },
  yellow: {
    gradient: 'bg-gradient-to-br from-yellow-500 via-yellow-600 to-amber-600',
    hover: 'hover:from-yellow-600 hover:via-yellow-700 hover:to-amber-700',
    glow: 'group-hover:shadow-yellow-500/50',
    icon: 'bg-yellow-400/20',
  },
  gray: {
    gradient: 'bg-gradient-to-br from-gray-500 via-gray-600 to-slate-600',
    hover: 'hover:from-gray-600 hover:via-gray-700 hover:to-slate-700',
    glow: 'group-hover:shadow-gray-500/50',
    icon: 'bg-gray-400/20',
  },
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
  stats,
  superAdminOnly = false,
  directLink = false,
}: ModuleCardProps) {
  const { hasPermission, isAdmin, isSuperAdmin, isLoading } = usePermissions()
  const navigate = useNavigate()
  const [isHovered, setIsHovered] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  // Check permission
  const canView = isLoading || (
    superAdminOnly
      ? isSuperAdmin
      : (isAdmin || isSuperAdmin || !permission || hasPermission(`${permission}.view`))
  )
  
  if (!canView) {
    return null
  }

  // Direct route mapping for modules (bypassing workspace)
  const getModuleDirectPath = (moduleName: string) => {
    const routeMap: Record<string, string> = {
      'Production': '/app/production',
      'Sales': '/app/sales',
      'Purchasing': '/app/purchasing',
      'Warehouse': '/app/warehouse',
      'Quality Control': '/app/quality',
      'Quality': '/app/quality',
      'Maintenance': '/app/maintenance',
      'Human Resources': '/app/hr',
      'Finance': '/app/finance',
      'Accounting': '/app/finance',
      'Document Control': '/app/dcc',
      'Products': '/app/products',
      'OEE Monitoring': '/app/oee',
      'Shipping': '/app/warehouse',
      'R&D': '/app/dcc',
      'Waste Management': '/app/production'
    }
    return routeMap[moduleName] || (href && href !== '#' ? href : `/app/${moduleName.toLowerCase().replace(/\s+/g, '-')}`)
  }

  const handleCardClick = () => {
    if (directLink && href && href !== '#') {
      navigate(href)
    } else {
      const targetPath = getModuleDirectPath(name)
      navigate(targetPath)
    }
  }

  const handleMouseEnter = () => {
    setIsHovered(true)
    setShowDropdown(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    // Don't hide dropdown immediately - let the dropdown's own handler manage it
  }

  const handleDropdownLeave = () => {
    setShowDropdown(false)
    setIsHovered(false)
  }

  const colors = colorClasses[color as keyof typeof colorClasses] || colorClasses.blue

  return (
    <div className="group relative">
      <button
        onClick={handleCardClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={clsx(
          'w-full rounded-2xl p-6 text-white transition-all duration-300 transform text-left relative overflow-hidden',
          'shadow-lg hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.02]',
          colors.gradient,
          colors.hover,
          colors.glow
        )}
      >
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className={clsx(
            'absolute inset-0 transition-transform duration-700',
            isHovered ? 'scale-110' : 'scale-100'
          )}>
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id={`pattern-${name}`} x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="20" cy="20" r="1" fill="white" opacity="0.3" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#pattern-${name})`} />
            </svg>
          </div>
        </div>

        {/* Badge with pulse animation */}
        {badge && (
          <div className="absolute -top-2 -right-2 z-10">
            <span className={clsx(
              'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-lg',
              'animate-pulse',
              badge.color === 'red' && 'bg-red-100 text-red-800',
              badge.color === 'yellow' && 'bg-yellow-100 text-yellow-800',
              badge.color === 'green' && 'bg-green-100 text-green-800',
              badge.color === 'blue' && 'bg-blue-100 text-blue-800'
            )}>
              {badge.text}
            </span>
          </div>
        )}

        {/* Icon with animated background */}
        <div className="mb-4 relative">
          <div className={clsx(
            'inline-flex p-3 rounded-xl backdrop-blur-sm transition-all duration-300',
            colors.icon,
            isHovered && 'scale-110 rotate-6'
          )}>
            <Icon className={clsx(
              'h-8 w-8 transition-transform duration-300',
              isHovered && 'scale-110'
            )} />
          </div>
        </div>

        {/* Content */}
        <h3 className="text-xl font-bold mb-2 tracking-tight">{name}</h3>
        <p className="text-sm opacity-90 line-clamp-2 mb-4 leading-relaxed">{description}</p>

        {/* Stats with animated counter effect */}
        {stats && (
          <div className="mt-4 pt-4 border-t border-white/20">
            <div className="flex items-center justify-between">
              <span className="text-xs opacity-75 font-medium uppercase tracking-wide">{stats.label}</span>
              <span className="text-2xl font-bold tabular-nums">{stats.value}</span>
            </div>
          </div>
        )}

        {/* Hover shine effect */}
        <div className={clsx(
          'absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 transition-all duration-700',
          isHovered && 'opacity-20 translate-x-full'
        )} style={{ transform: 'translateX(-100%)' }} />
      </button>

      {/* Children Menu with better styling - Fixed hover issue */}
      {children && children.length > 0 && (
        <div 
          className={clsx(
            'absolute left-0 right-0 top-full z-20 mt-2 transition-all duration-200 rounded-xl bg-white dark:bg-gray-800 shadow-2xl border border-gray-100 dark:border-gray-700',
            showDropdown ? 'opacity-100 visible' : 'opacity-0 invisible'
          )}
          onMouseEnter={() => setShowDropdown(true)}
          onMouseLeave={handleDropdownLeave}
        >
          <div className="p-2">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-3 py-2">
              Quick Access
            </div>
            {children.map((child, index) => (
              <NavLink
                key={index}
                to={child.href}
                className={({ isActive }) =>
                  clsx(
                    'block px-4 py-2.5 text-sm rounded-lg transition-all duration-150',
                    'hover:pl-6',
                    isActive
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-700 dark:text-blue-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  )
                }
              >
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                  {child.name}
                </div>
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* Arrow indicator with animation */}
      <div className={clsx(
        'absolute bottom-6 right-6 transition-all duration-300',
        isHovered ? 'opacity-100 translate-x-1' : 'opacity-0 translate-x-0'
      )}>
        <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
      </div>
    </div>
  )
}
