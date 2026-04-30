import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDebounce } from '../../hooks/useDebounce'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ClockIcon,
  CubeIcon,
  ClipboardDocumentListIcon,
  ShoppingCartIcon,
  UserIcon,
  ShoppingBagIcon,
  BuildingStorefrontIcon,
  DocumentTextIcon,
  UsersIcon
} from '@heroicons/react/24/outline'
import axiosInstance from '../../utils/axiosConfig'

interface SearchResult {
  id: string | number
  type: string
  module: string
  title: string
  subtitle: string
  description: string
  url: string
  icon: string
  color: string
  metadata: Record<string, any>
}

const iconMap: Record<string, any> = {
  'cube': CubeIcon,
  'clipboard-document-list': ClipboardDocumentListIcon,
  'shopping-cart': ShoppingCartIcon,
  'user': UserIcon,
  'shopping-bag': ShoppingBagIcon,
  'building-storefront': BuildingStorefrontIcon,
  'document-text': DocumentTextIcon,
  'users': UsersIcon,
}

const colorMap: Record<string, string> = {
  'blue': 'bg-blue-100 text-blue-600',
  'green': 'bg-green-100 text-green-600',
  'purple': 'bg-purple-100 text-purple-600',
  'orange': 'bg-orange-100 text-orange-600',
  'red': 'bg-red-100 text-red-600',
  'indigo': 'bg-indigo-100 text-indigo-600',
  'teal': 'bg-teal-100 text-teal-600',
}

const modules = [
  { value: 'all', label: 'All Modules' },
  { value: 'products', label: 'Products' },
  { value: 'production', label: 'Production' },
  { value: 'sales', label: 'Sales' },
  { value: 'purchasing', label: 'Purchasing' },
  { value: 'hr', label: 'Human Resources' },
  { value: 'dcc', label: 'Documents' },
]

export default function GlobalSearchPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  
  const debouncedQuery = useDebounce(query, 300)

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches')
    if (saved) {
      setRecentSearches(JSON.parse(saved))
    }
  }, [])

  // Save to recent searches
  const saveToRecent = (searchQuery: string) => {
    if (!searchQuery.trim()) return
    
    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 10)
    setRecentSearches(updated)
    localStorage.setItem('recentSearches', JSON.stringify(updated))
  }

  // Perform search
  const performSearch = useCallback(async (searchQuery: string, module: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const response = await axiosInstance.get('/api/search/global', {
        params: {
          q: searchQuery,
          module: module,
          limit: 50
        }
      })

      if (response.data.success) {
        setResults(response.data.data.results)
        saveToRecent(searchQuery)
      }
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [recentSearches])

  // Search when debounced query changes
  useEffect(() => {
    if (debouncedQuery) {
      performSearch(debouncedQuery, moduleFilter)
      setSearchParams({ q: debouncedQuery })
    }
  }, [debouncedQuery, moduleFilter])

  // Initial search from URL
  useEffect(() => {
    const urlQuery = searchParams.get('q')
    if (urlQuery) {
      setQuery(urlQuery)
      performSearch(urlQuery, moduleFilter)
    }
  }, [])

  const handleResultClick = (result: SearchResult) => {
    navigate(result.url)
  }

  const handleRecentSearchClick = (recentQuery: string) => {
    setQuery(recentQuery)
    performSearch(recentQuery, moduleFilter)
  }

  const clearRecentSearches = () => {
    setRecentSearches([])
    localStorage.removeItem('recentSearches')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Escape to clear
    if (e.key === 'Escape') {
      setQuery('')
      setResults([])
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/desk')}
            className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 mb-4 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Desk
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Global Search</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Search across all modules and data</p>
        </div>

        {/* Search Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search for work orders, products, customers, documents..."
                className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery('')
                    setResults([])
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-300"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 flex items-center gap-2"
            >
              <FunnelIcon className="w-5 h-5" />
              Filters
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Filter by Module
              </label>
              <div className="flex flex-wrap gap-2">
                {modules.map((module) => (
                  <button
                    key={module.value}
                    onClick={() => setModuleFilter(module.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      moduleFilter === module.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {module.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Keyboard Shortcuts Hint */}
          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-4">
            <span>Press <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">ESC</kbd> to clear</span>
            <span>Press <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">↵</kbd> to search</span>
          </div>
        </div>

        {/* Recent Searches */}
        {!query && recentSearches.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ClockIcon className="w-5 h-5" />
                Recent Searches
              </h2>
              <button
                onClick={clearRecentSearches}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Clear All
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((recentQuery, index) => (
                <button
                  key={index}
                  onClick={() => handleRecentSearchClick(recentQuery)}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-200 transition-colors"
                >
                  {recentQuery}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-300 mt-4">Searching...</p>
          </div>
        )}

        {/* Results */}
        {!loading && query && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            {/* Results Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900">
                {results.length} {results.length === 1 ? 'Result' : 'Results'} for "{query}"
              </h2>
            </div>

            {/* Results List */}
            {results.length > 0 ? (
              <div className="divide-y">
                {results.map((result, index) => {
                  const Icon = iconMap[result.icon] || CubeIcon
                  const colorClass = colorMap[result.color] || 'bg-gray-100 text-gray-600'

                  return (
                    <button
                      key={index}
                      onClick={() => handleResultClick(result)}
                      className="w-full px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors text-left"
                    >
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                          <Icon className="w-6 h-6" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{result.title}</h3>
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs rounded-full">
                              {result.type}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">{result.subtitle}</p>
                          {result.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{result.description}</p>
                          )}
                          
                          {/* Metadata */}
                          {result.metadata && Object.keys(result.metadata).length > 0 && (
                            <div className="flex flex-wrap gap-3 mt-2">
                              {Object.entries(result.metadata).map(([key, value]) => (
                                <span key={key} className="text-xs text-gray-500 dark:text-gray-400">
                                  <span className="font-medium capitalize">{key}:</span> {value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Arrow */}
                        <div className="flex-shrink-0">
                          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <MagnifyingGlassIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-300">No results found for "{query}"</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Try different keywords or check your spelling</p>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && !query && recentSearches.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center border border-gray-200 dark:border-gray-700">
            <MagnifyingGlassIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 dark:text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Start Searching</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Search across all modules to find work orders, products, customers, and more
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full text-sm">Work Orders</span>
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full text-sm">Products</span>
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full text-sm">Customers</span>
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full text-sm">Suppliers</span>
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full text-sm">Documents</span>
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full text-sm">Employees</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
