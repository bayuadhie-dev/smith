import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import {
  XMarkIcon,
  PencilIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline'

interface QuotationItem {
  id: number
  line_number: number
  product_id: number
  product_name: string | null
  description: string | null
  quantity: number
  uom: string
  unit_price: number
  discount_percent: number
  tax_percent: number
  total_amount: number
}

interface QuotationDetail {
  id: number
  quote_number: string
  revision: number
  customer_id: number
  customer_name: string | null
  quote_date: string | null
  valid_until: string | null
  delivery_date: string | null
  payment_terms: string | null
  delivery_terms: string | null
  subtotal: number
  discount_percent: number
  discount_amount: number
  tax_percent: number
  tax_amount: number
  shipping_cost: number
  total_amount: number
  status: string
  notes: string | null
  terms_conditions: string | null
  converted_to_order_id: number | null
  items: QuotationItem[]
}

interface QuotationDetailModalProps {
  quotationId: number
  onClose: () => void
  onConvert: (quotationId: number) => void
  getStatusColor: (status: string) => string
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0)

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

const QuotationDetailModal: React.FC<QuotationDetailModalProps> = ({ quotationId, onClose, onConvert, getStatusColor }) => {
  const navigate = useNavigate()
  const [quotation, setQuotation] = useState<QuotationDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const response = await axiosInstance.get(`/api/sales/quotations/${quotationId}`)
        if (!cancelled) setQuotation(response.data.quotation)
      } catch (error) {
        console.error('Error loading quotation detail:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [quotationId])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {quotation ? quotation.quote_number : 'Quotation'}
            </h3>
            {quotation && (
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(quotation.status)}`}>
                {quotation.status}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : !quotation ? (
          <div className="p-6 text-center text-gray-400">Data quotation tidak ditemukan</div>
        ) : (
          <>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Customer</p>
                <p className="font-medium text-gray-900 dark:text-white">{quotation.customer_name || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Quote Date / Valid Until</p>
                <p className="font-medium text-gray-900 dark:text-white">{formatDate(quotation.quote_date)} — {formatDate(quotation.valid_until)}</p>
              </div>
              {quotation.payment_terms && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Payment Terms</p>
                  <p className="font-medium text-gray-900 dark:text-white">{quotation.payment_terms}</p>
                </div>
              )}
              {quotation.delivery_terms && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Delivery Terms</p>
                  <p className="font-medium text-gray-900 dark:text-white">{quotation.delivery_terms}</p>
                </div>
              )}
            </div>

            <div className="px-6">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produk</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Harga</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Disc %</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {quotation.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                        {item.product_name || `Produk #${item.product_id}`}
                        {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
                      </td>
                      <td className="px-3 py-2 text-sm text-right text-gray-700 dark:text-gray-300">{item.quantity} {item.uom}</td>
                      <td className="px-3 py-2 text-sm text-right text-gray-700 dark:text-gray-300">{formatCurrency(item.unit_price)}</td>
                      <td className="px-3 py-2 text-sm text-right text-gray-700 dark:text-gray-300">{item.discount_percent}%</td>
                      <td className="px-3 py-2 text-sm text-right font-medium text-gray-900 dark:text-white">{formatCurrency(item.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 mt-2 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <div className="w-full max-w-xs space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                  <span className="text-gray-900 dark:text-white">{formatCurrency(quotation.subtotal)}</span>
                </div>
                {quotation.discount_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Discount</span>
                    <span className="text-gray-900 dark:text-white">-{formatCurrency(quotation.discount_amount)}</span>
                  </div>
                )}
                {quotation.tax_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Tax</span>
                    <span className="text-gray-900 dark:text-white">{formatCurrency(quotation.tax_amount)}</span>
                  </div>
                )}
                {quotation.shipping_cost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Shipping</span>
                    <span className="text-gray-900 dark:text-white">{formatCurrency(quotation.shipping_cost)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700 font-semibold">
                  <span className="text-gray-900 dark:text-white">Total</span>
                  <span className="text-gray-900 dark:text-white">{formatCurrency(quotation.total_amount)}</span>
                </div>
              </div>
            </div>

            {(quotation.notes || quotation.terms_conditions) && (
              <div className="px-6 pb-4 space-y-2 text-sm">
                {quotation.notes && (
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Notes</p>
                    <p className="text-gray-700 dark:text-gray-300">{quotation.notes}</p>
                  </div>
                )}
                {quotation.terms_conditions && (
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Terms & Conditions</p>
                    <p className="text-gray-700 dark:text-gray-300">{quotation.terms_conditions}</p>
                  </div>
                )}
              </div>
            )}

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => navigate(`/app/sales/quotations/${quotation.id}/edit`)}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <PencilIcon className="h-4 w-4" /> Edit
              </button>
              {quotation.status === 'accepted' && !quotation.converted_to_order_id && (
                <button
                  onClick={() => onConvert(quotation.id)}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <ArrowsRightLeftIcon className="h-4 w-4" /> Convert to Order
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default QuotationDetailModal
