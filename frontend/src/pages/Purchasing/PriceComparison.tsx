import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatRupiah } from '../../utils/currencyUtils';
import { useComparePricesMutation, useGetProductsQuery } from '../../services/api';
import { format } from 'date-fns';
import {
  ArrowDownIcon,
  CalendarIcon,
  ChartBarIcon,
  MagnifyingGlassIcon 
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function PriceComparison() {
    const { t } = useLanguage();

    const [selectedProduct, setSelectedProduct] = useState('')
    const [quantity, setQuantity] = useState(1)
    const [comparisonData, setComparisonData] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(false)
  
  const { data: products } = useGetProductsQuery({})
  const [comparePrices] = useComparePricesMutation()

  const handleCompare = async () => {
    if (!selectedProduct) {
      toast.error('Please select a product')
      return
    }

    setIsLoading(true)
    try {
      const result = await comparePrices({
        product_id: parseInt(selectedProduct),
        quantity
      }).unwrap()
      
      setComparisonData(result)
    } catch (error: any) {
      toast.error(error?.data?.error || 'Failed to compare prices')
    } finally {
      setIsLoading(false)
    }
  }

  const formatRupiah = (amount: number, currency: string = 'IDR') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Price Comparison</h1>
        <p className="text-gray-600 dark:text-gray-300">Compare supplier prices and analyze market trends</p>
      </div>

      {/* Search Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Search Product Prices</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('production.product')}</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a product...</option>
              {products?.products?.map((product: any) => (
                <option key={product.id} value={product.id}>
                  {product.code} - {product.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('common.quantity')}</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={handleCompare}
              disabled={isLoading || !selectedProduct}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
              {isLoading ? 'Comparing...' : 'Compare Prices'}
            </button>
          </div>
        </div>
      </div>

      {/* Comparison Results */}
      {comparisonData && (
        <div className="space-y-6">
          {/* Price Analysis Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <ChartBarIcon className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Price Analysis</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <ArrowDownIcon className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Lowest Price</span>
                </div>
                <div className="text-2xl font-bold text-green-900 mt-1">
                  {comparisonData.analysis.lowest_price ? 
                    formatRupiah(comparisonData.analysis.lowest_price) : 'N/A'}
                </div>
              </div>
              
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <ArrowDownIcon className="h-5 w-5 text-red-600" />
                  <span className="text-sm font-medium text-red-800">Highest Price</span>
                </div>
                <div className="text-2xl font-bold text-red-900 mt-1">
                  {comparisonData.analysis.highest_price ? 
                    formatRupiah(comparisonData.analysis.highest_price) : 'N/A'}
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <ChartBarIcon className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Average Price</span>
                </div>
                <div className="text-2xl font-bold text-blue-900 mt-1">
                  {comparisonData.analysis.average_price ? 
                    formatRupiah(comparisonData.analysis.average_price) : 'N/A'}
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100">Suppliers</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {comparisonData.analysis.suppliers_count || 0}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Quotes */}
          {comparisonData.recent_quotes && comparisonData.recent_quotes.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Quotes</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Quote Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.price')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Lead Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {comparisonData.recent_quotes.map((quote: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {quote.supplier_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm text-gray-900 dark:text-white">{quote.quote_number}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {format(new Date(quote.quote_date), 'dd MMM yyyy')}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {formatRupiah(quote.unit_price, quote.currency)}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              Qty: {quote.quantity.toLocaleString()}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {quote.lead_time_days ? `${quote.lead_time_days} days` : 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            quote.status === 'accepted' ? 'bg-green-100 text-green-800' :
                            quote.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {quote.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Price History */}
          {comparisonData.price_history && comparisonData.price_history.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Price History</h3>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.date')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.price')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.quantity')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {comparisonData.price_history.map((history: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {format(new Date(history.price_date), 'dd MMM yyyy')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">{history.supplier_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatRupiah(history.unit_price, history.currency)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {history.quantity ? history.quantity.toLocaleString() : 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            history.source_type === 'po' ? 'bg-blue-100 text-blue-800' :
                            history.source_type === 'quote' ? 'bg-green-100 text-green-800' :
                            history.source_type === 'contract' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {history.source_type.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!comparisonData && !isLoading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No comparison data</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Select a product and click "Compare Prices" to see price analysis.</p>
        </div>
      )}
    </div>
  )
}
