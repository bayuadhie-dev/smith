import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLanguage } from '../../contexts/LanguageContext';
import { useForm, useFieldArray } from 'react-hook-form'
import toast from 'react-hot-toast'
import SearchableSelect from '../../components/SearchableSelect'
import axiosInstance from '../../utils/axiosConfig'
import { PO_CURRENCIES, currencySymbol, formatCurrencyAmount, formatRupiah } from '../../utils/currencyUtils'
import {
  useGetSuppliersQuery,
  useGetProductsQuery,
  useGetMaterialsListQuery,
  useCreatePurchaseOrderMutation,
  useUpdatePurchaseOrderMutation,
  useGetPurchaseOrderQuery
} from '../../services/api'
import {
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
interface PurchaseOrderFormData {
  supplier_id: number
  order_date: string
  required_date?: string
  payment_terms?: string
  currency: string
  notes?: string
  items: {
    product_id: number | null
    material_id: number | null
    quantity: number
    unit_price: number
    uom: string
  }[]
}

export default function PurchaseOrderForm() {
    const { t } = useLanguage();

const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const [isLoading, setIsLoading] = useState(false)
  const [rateInfo, setRateInfo] = useState<{ rate: number | null; available: boolean; loading: boolean }>({
    rate: 1,
    available: true,
    loading: false
  })

  const { data: suppliers } = useGetSuppliersQuery({})
  const { data: products } = useGetProductsQuery({})
  const { data: materials } = useGetMaterialsListQuery({ per_page: 2000 })
  const [createPO] = useCreatePurchaseOrderMutation()
  const [updatePO] = useUpdatePurchaseOrderMutation()
  const { data: existingPO } = useGetPurchaseOrderQuery(id, { skip: !isEdit })

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<PurchaseOrderFormData>({
    defaultValues: {
      order_date: new Date().toISOString().split('T')[0],
      currency: 'IDR',
      items: [{ product_id: null, material_id: null, quantity: 1, unit_price: 0, uom: 'PCS' }]
    }
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  })

  const watchedItems = watch('items')
  const watchedCurrency = watch('currency') || 'IDR'
  const hasGrn = Boolean(existingPO?.has_grn)
  const isNotDraft = Boolean(isEdit && existingPO && existingPO.status !== 'draft')

  useEffect(() => {
    if (isEdit && existingPO) {
      reset({
        supplier_id: existingPO.supplier_id,
        order_date: existingPO.order_date,
        required_date: existingPO.required_date || '',
        payment_terms: existingPO.payment_terms || '',
        currency: existingPO.currency || 'IDR',
        notes: existingPO.notes || '',
        items: (existingPO.items || []).map((item: any) => ({
          product_id: item.product_id ?? null,
          material_id: item.material_id ?? null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          uom: item.uom || 'PCS'
        }))
      })
    }
  }, [isEdit, existingPO, reset])

  useEffect(() => {
    if (watchedCurrency === 'IDR') {
      setRateInfo({ rate: 1, available: true, loading: false })
      return
    }
    if (isNotDraft && existingPO?.exchange_rate) {
      setRateInfo({ rate: Number(existingPO.exchange_rate), available: true, loading: false })
      return
    }
    let cancelled = false
    setRateInfo(prev => ({ ...prev, loading: true }))
    axiosInstance.get('/api/purchasing/exchange-rate', { params: { currency: watchedCurrency } })
      .then(res => {
        if (!cancelled) {
          setRateInfo({
            rate: res.data.rate,
            available: Boolean(res.data.available),
            loading: false
          })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRateInfo({ rate: null, available: false, loading: false })
        }
      })
    return () => { cancelled = true }
  }, [watchedCurrency, isNotDraft, existingPO?.exchange_rate])

  const calculateTotal = () => {
    return watchedItems.reduce((total, item) => {
      return total + (item.quantity || 0) * (item.unit_price || 0)
    }, 0)
  }

  const onSubmit = async (data: PurchaseOrderFormData) => {
    setIsLoading(true)
    try {
      // Validate items - each row must reference either a product or a material
      const validItems = data.items.filter(item =>
        (item.product_id || item.material_id) && item.quantity > 0 && item.unit_price > 0
      )

      if (!hasGrn && validItems.length === 0) {
        toast.error('Please add at least one valid item')
        return
      }

      const payload: any = {
        ...data,
        supplier_id: parseInt(data.supplier_id.toString()),
        items: validItems.map(item => ({
          quantity: parseFloat(item.quantity.toString()),
          unit_price: parseFloat(item.unit_price.toString()),
          uom: item.uom,
          ...(item.product_id ? { product_id: parseInt(item.product_id.toString()) } : {}),
          ...(item.material_id ? { material_id: parseInt(item.material_id.toString()) } : {})
        }))
      }

      if (isEdit) {
        if (hasGrn) {
          // Items/supplier are locked server-side once a GRN exists - only send header fields
          delete payload.items
          delete payload.supplier_id
        }
        await updatePO({ id, ...payload }).unwrap()
        toast.success('Purchase Order updated successfully!')
      } else {
        await createPO(payload).unwrap()
        toast.success('Purchase Order created successfully!')
      }
      navigate('/app/purchasing/purchase-orders')
    } catch (error: any) {
      toast.error(error.data?.error || `Failed to ${isEdit ? 'update' : 'create'} purchase order`)
    } finally {
      setIsLoading(false)
    }
  }

  const addItem = () => {
    append({ product_id: null, material_id: null, quantity: 1, unit_price: 0, uom: 'PCS' })
  }

  const getProductById = (productId: number) => {
    return products?.products?.find((p: any) => p.id == productId)
  }

  const getMaterialById = (materialId: number) => {
    return materials?.materials?.find((m: any) => m.id == materialId)
  }

  // Combined searchable options across products (purchasable+active) and
  // materials (fix for the SAP-equivalence E2E finding, 2026-10: materials
  // only have a materials-table row, never a mirrored products row, so a
  // real PR auto-generated for a raw-material shortage could never actually
  // be put on a PO before this - the backend already accepted material_id
  // on PurchaseOrderItem, this form just never offered it) - prefixed with
  // "p-"/"m-" composite ids since SearchableSelect only supports one flat id.
  const itemOptions = [
    ...(products?.products || [])
      .filter((p: any) => p.is_purchasable && p.is_active)
      .map((product: any) => ({
        id: `p-${product.id}`,
        code: product.code,
        name: `[Produk] ${product.name}`
      })),
    ...(materials?.materials || [])
      .filter((m: any) => m.is_active)
      .map((material: any) => ({
        id: `m-${material.id}`,
        code: material.code,
        name: `[Material] ${material.name}`
      }))
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{isEdit ? 'Edit Purchase Order' : 'Create Purchase Order'}</h1>
          <p className="text-gray-600 dark:text-gray-300">
            {isEdit
              ? (hasGrn ? 'Item dan supplier terkunci karena sudah ada Penerimaan Barang (GRN)' : 'Update this purchase order')
              : 'Request materials and products from suppliers'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <button
              onClick={() => navigate(`/app/purchasing/grn/new?po_id=${id}`)}
              className="btn-primary"
            >
              Buat GRN
            </button>
          )}
          <button
            onClick={() => navigate('/app/purchasing/purchase-orders')}
            className="btn-secondary"
          >
            Back to List
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header Information */}
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Order Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Supplier *
              </label>
              <select
                {...register('supplier_id', { required: 'Supplier is required' })}
                className="input-field"
                disabled={hasGrn}
              >
                <option value="">Select a supplier</option>
                {suppliers?.suppliers?.map((supplier: any) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.code} - {supplier.company_name}
                  </option>
                ))}
              </select>
              {errors.supplier_id && (
                <p className="mt-1 text-sm text-red-600">{errors.supplier_id.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Order Date *
              </label>
              <input
                type="date"
                {...register('order_date', { required: 'Order date is required' })}
                className="input-field"
              />
              {errors.order_date && (
                <p className="mt-1 text-sm text-red-600">{errors.order_date.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Required Date
              </label>
              <input
                type="date"
                {...register('required_date')}
                className="input-field"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Payment Terms
              </label>
              <select {...register('payment_terms')} className="input-field">
                <option value="">Select payment terms</option>
                <option value="NET_30">NET 30</option>
                <option value="NET_60">NET 60</option>
                <option value="NET_90">NET 90</option>
                <option value="COD">Cash on Delivery</option>
                <option value="ADVANCE">Advance Payment</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Mata Uang (Currency) *
              </label>
              <select
                {...register('currency')}
                className="input-field"
                disabled={isNotDraft || hasGrn}
              >
                {PO_CURRENCIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {isNotDraft && (
                <p className="mt-1 text-xs text-gray-500">Mata uang terkunci karena PO sudah bukan draft.</p>
              )}
              {watchedCurrency !== 'IDR' && (
                <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                  {rateInfo.loading
                    ? 'Memuat kurs...'
                    : rateInfo.rate
                      ? `${isNotDraft ? 'Kurs terkunci' : 'Estimasi kurs saat ini'}: 1 ${watchedCurrency} = ${formatRupiah(rateInfo.rate)}`
                      : 'Kurs otomatis belum tersedia — kurs akan diminta secara manual saat Submit Approval.'}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              </label>
              <textarea
                {...register('notes')}
                rows={3}
                className="input-field"
                placeholder="Additional notes or special instructions..."
              />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="card p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Order Items</h3>
            {!hasGrn && (
              <button
                type="button"
                onClick={addItem}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                Add Item
              </button>
            )}
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => {
              const selectedProduct = getProductById(watchedItems[index]?.product_id as any)
              const selectedMaterial = getMaterialById(watchedItems[index]?.material_id as any)
              const itemRefValue = watchedItems[index]?.product_id
                ? `p-${watchedItems[index].product_id}`
                : watchedItems[index]?.material_id
                  ? `m-${watchedItems[index].material_id}`
                  : null

              return (
                <div key={field.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        Product *
                      </label>
                      <SearchableSelect
                        options={itemOptions}
                        value={itemRefValue}
                        onChange={(value) => {
                          const ref = value as string | null
                          if (!ref) {
                            setValue(`items.${index}.product_id`, null, { shouldValidate: true })
                            setValue(`items.${index}.material_id`, null, { shouldValidate: true })
                            return
                          }
                          const [kind, rawId] = ref.split('-')
                          const parsedId = parseInt(rawId, 10)
                          setValue(`items.${index}.product_id`, kind === 'p' ? parsedId : null, { shouldValidate: true })
                          setValue(`items.${index}.material_id`, kind === 'm' ? parsedId : null, { shouldValidate: true })
                        }}
                        placeholder="Select product or material"
                        disabled={hasGrn}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        {...register(`items.${index}.quantity` as const, {
                          required: 'Quantity is required',
                          min: { value: 0.01, message: 'Quantity must be greater than 0' }
                        })}
                        className="input-field"
                        disabled={hasGrn}
                      />
                      {(selectedProduct || selectedMaterial) && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {selectedProduct ? selectedProduct.primary_uom : selectedMaterial.unit_of_measure}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        Unit Price ({currencySymbol(watchedCurrency)}) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        {...register(`items.${index}.unit_price` as const, {
                          required: 'Unit price is required',
                          min: { value: 0, message: 'Price must be non-negative' }
                        })}
                        className="input-field"
                        placeholder="0.00"
                        disabled={hasGrn}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{t('common.total')}</label>
                      <div className="input-field bg-gray-50 dark:bg-gray-900">
                        {formatCurrencyAmount((watchedItems[index]?.quantity || 0) * (watchedItems[index]?.unit_price || 0), watchedCurrency)}
                      </div>
                    </div>

                    <div>
                      {fields.length > 1 && !hasGrn && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="btn-danger p-2"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Product / Material Info */}
                  {selectedProduct && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-blue-600">Category:</span>
                          <p className="font-medium">{selectedProduct.category || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-blue-600">Material Type:</span>
                          <p className="font-medium">{selectedProduct.material_type?.replace('_', ' ')}</p>
                        </div>
                        <div>
                          <span className="text-blue-600">Standard Cost:</span>
                          <p className="font-medium">Rp {selectedProduct.cost?.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {selectedMaterial && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-amber-700">Category:</span>
                          <p className="font-medium">{selectedMaterial.category || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-amber-700">Material Type:</span>
                          <p className="font-medium">{selectedMaterial.material_type?.replace('_', ' ')}</p>
                        </div>
                        <div>
                          <span className="text-amber-700">Standard Cost:</span>
                          <p className="font-medium">Rp {selectedMaterial.cost_per_unit?.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Order Summary */}
          <div className="mt-6 pt-4 border-t">
            <div className="flex justify-end">
              <div className="w-80 space-y-1">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total Amount ({watchedCurrency}):</span>
                  <span>{formatCurrencyAmount(calculateTotal(), watchedCurrency)}</span>
                </div>
                {watchedCurrency !== 'IDR' && rateInfo.rate && (
                  <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                    <span>{isNotDraft ? 'Ekuivalen IDR (kurs terkunci):' : 'Estimasi IDR:'}</span>
                    <span>≈ {formatRupiah(calculateTotal() * rateInfo.rate)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/app/purchasing/purchase-orders')}
            className="btn-secondary"
            disabled={isLoading}
          >{t('common.cancel')}</button>
          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading}
          >
            {isLoading ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save Changes' : 'Create Purchase Order')}
          </button>
        </div>
      </form>

      {/* Quick Tips */}
      <div className="card p-4 bg-green-50 border border-green-200">
        <h4 className="font-medium text-green-900 mb-2">💡 Purchasing Tips</h4>
        <ul className="text-sm text-green-800 space-y-1">
          <li>• Verify supplier information and payment terms before creating PO</li>
          <li>• Check current market prices for accurate cost estimation</li>
          <li>• Set realistic required dates considering supplier lead times</li>
          <li>• Only select products marked as "purchasable" in product master</li>
        </ul>
      </div>
    </div>
  )
}
