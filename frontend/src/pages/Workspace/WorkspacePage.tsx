import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGetWorkspaceDataQuery } from '../../services/api'
import { usePermissions } from '../../contexts/PermissionContext'
import { ArrowLeftIcon, ChartBarIcon, DocumentTextIcon, PlusIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface WorkspaceData {
  module: {
    name: string
    description: string
    icon: string
    color: string
  }
  stats: Array<{
    label: string
    value: string | number
    change?: number
    icon: string
  }>
  quickActions: Array<{
    name: string
    description: string
    href: string
    icon: string
    permission?: string
  }>
  recentItems: Array<{
    id: string
    type: string
    name: string
    date: string
    status: string
    url: string
  }>
  reports: Array<{
    name: string
    description: string
    href: string
    icon: string
    permission?: string
  }>
}

export default function WorkspacePage() {
  const { module } = useParams<{ module: string }>()
  const navigate = useNavigate()
  const { hasModuleAccess, hasPermission, isLoading: permsLoading } = usePermissions()
  const [activeTab, setActiveTab] = useState<'overview' | 'recent' | 'reports'>('overview')

  // Check if user has access to this module
  if (!permsLoading && module && !hasModuleAccess(module)) {
    navigate('/desk')
    return null
  }

  const { data: workspaceData, isLoading, error } = useGetWorkspaceDataQuery(
    module!,
    { skip: !module || permsLoading }
  )

  if (permsLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !workspaceData || !workspaceData.data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Failed to load workspace data</p>
          <button
            onClick={() => navigate('/desk')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Desk
          </button>
        </div>
      </div>
    )
  }

  const data: WorkspaceData = workspaceData.data
  
  // Additional safety check
  if (!data || !data.module) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Invalid workspace data structure</p>
          <button
            onClick={() => navigate('/desk')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Desk
          </button>
        </div>
      </div>
    )
  }

  const getIcon = (iconName: string) => {
    // Map icon names to actual icon components
    const iconMap: Record<string, any> = {
      'chart-bar': ChartBarIcon,
      'document-text': DocumentTextIcon,
      'plus': PlusIcon,
    }
    const Icon = iconMap[iconName] || DocumentTextIcon
    return <Icon className="w-5 h-5" />
  }

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'in_progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800',
    }
    return statusColors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/desk')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeftIcon className="w-5 h-5 mr-2" />
            Back to Desk
          </button>
          
          <div className="flex items-center space-x-4">
            <div className={clsx(
              'w-16 h-16 rounded-xl flex items-center justify-center',
              `bg-${data.module.color}-100`
            )}>
              {getIcon(data.module.icon)}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{data.module.name}</h1>
              <p className="text-gray-600">{data.module.description}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={clsx(
                'py-2 px-1 border-b-2 font-medium text-sm',
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('recent')}
              className={clsx(
                'py-2 px-1 border-b-2 font-medium text-sm',
                activeTab === 'recent'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              Recent Items
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={clsx(
                'py-2 px-1 border-b-2 font-medium text-sm',
                activeTab === 'reports'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              Reports
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {(data.stats || []).map((stat, index) => (
                <div key={index} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                      <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                      {stat.change !== undefined && (
                        <p className={clsx(
                          'text-sm mt-1',
                          stat.change >= 0 ? 'text-green-600' : 'text-red-600'
                        )}>
                          {stat.change >= 0 ? '+' : ''}{stat.change}% from last month
                        </p>
                      )}
                    </div>
                    <div className="bg-blue-100 rounded-full p-3">
                      {getIcon(stat.icon)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(data.quickActions || [])
                  .filter(action => !action.permission || hasPermission(action.permission))
                  .map((action, index) => (
                    <button
                      key={index}
                      onClick={() => navigate(action.href)}
                      className="bg-white rounded-lg shadow p-6 text-left hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="bg-gray-100 rounded-lg p-2">
                          {getIcon(action.icon)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{action.name}</p>
                          <p className="text-sm text-gray-600">{action.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'recent' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Recent Items</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {(data.recentItems || []).map((item, index) => (
                <div key={index} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-600">{item.type} • {item.date}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={clsx('px-2 py-1 text-xs font-medium rounded-full', getStatusColor(item.status))}>
                        {item.status}
                      </span>
                      <button
                        onClick={() => navigate(item.url)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data.reports || [])
              .filter(report => !report.permission || hasPermission(report.permission))
              .map((report, index) => (
                <button
                  key={index}
                  onClick={() => navigate(report.href)}
                  className="bg-white rounded-lg shadow p-6 text-left hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-gray-100 rounded-lg p-2">
                      {getIcon(report.icon)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{report.name}</p>
                      <p className="text-sm text-gray-600">{report.description}</p>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
