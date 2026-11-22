import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useCreateReturnMutation } from '../../services/returnsApi'
import { useLanguage } from '../../contexts/LanguageContext';
import {
  ArrowLeftIcon,
  LinkIcon
,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import NumberInput from '../../components/ui/NumberInput'
import SearchableSelect from '../../components/SearchableSelect'
import { useGetCustomersQuery, useGetProductsQuery } from '../../services/api'
interface ReturnItem {
  id: string
  product_id: number
  product_name: string
  quantity_returned: number
  unit_price: number
  condition_received: string
  defect_description?: string
  batch_number?: string
}

export default function CreateReturnForm() {
    const { t } = useLanguage();

const navigate = useNavigate()
  const [createReturn, { isLoading }] = useCreateReturnMutation()

  // Formulir ini dulu meminta ID pelanggan dan ID produk sebagai angka mentah -
  // tidak ada orang gudang yang hafal nomor itu (2026-11-22).
  const { data: customersData } = useGetCustomersQuery({ per_page: 1000 } as any)
  const { data: productsData } = useGetProductsQuery({} as any)
  const customers = ((customersData as any)?.customers || []).map((c: any) => ({ id: c.id, code: c.code, name: c.company_name || c.name || c.code }))
  const products = ((productsData as any)?.products || []).map((p: any) => ({ id: p.id, code: p.code, name: p.name }))

  const [formData, setFormData] = useState({
    customer_id: '',
    sales_order_id: '',
    return_date: new Date().toISOString().split('T')[0],
    reason: '',
    description: '',
    qc_required: true
  })

  const [items, setItems] = useState<ReturnItem[]>([
    {
      id: '1',
      product_id: 0,
      product_name: '',
      quantity_returned: 1,
      unit_price: 0,
      condition_received: 'damaged',
      defect_description: '',
      batch_number: ''
    }
  ])

  const addItem = () => {
    const newItem: ReturnItem = {
      id: Date.now().toString(),
      product_id: 0,
      product_name: '',
      quantity_returned: 1,
      unit_price: 0,
      condition_received: 'damaged',
      defect_description: '',
      batch_number: ''
    }
    setItems([...items, newItem])
  }

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const updateItem = (id: string, field: keyof ReturnItem, value: any) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const returnData = {
        customer_id: parseInt(formData.customer_id),
        sales_order_id: formData.sales_order_id ? parseInt(formData.sales_order_id) : undefined,
        return_date: formData.return_date,
        reason: formData.reason,
        description: formData.description,
        qc_required: formData.qc_required,
        items: items.map(item => ({
          product_id: item.product_id,
          quantity_returned: item.quantity_returned,
          unit_price: item.unit_price,
          condition_received: item.condition_received,
          defect_description: item.defect_description,
          batch_number: item.batch_number
        }))
      }

      const result = await createReturn(returnData).unwrap()
      navigate(`/app/returns/${result.return_id}`)
    } catch (error) {
      console.error('Failed to create return:', error)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link
          to="/app/returns"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 rounded-lg"
        >
          <ArrowLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </Link>
        <div>
          <div className="fn-label mb-1.5">PENJUALAN · RETUR</div>
          <h1 className="text-[28px] font-semibold text-gray-900 dark:text-white tracking-tight leading-tight">Retur Baru</h1>
          <p className="text-gray-600 dark:text-gray-300">Catat barang yang dikembalikan pelanggan.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Return Information */}
        <div className="fn-card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Keterangan retur</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Pelanggan *
              </label>
              <SearchableSelect
                options={customers}
                value={formData.customer_id ? Number(formData.customer_id) : null}
                onChange={(v) => setFormData({ ...formData, customer_id: v ? String(v) : '' })}
                placeholder="Cari nama atau kode pelanggan"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                ID Pesanan Penjualan (opsional)
              </label>
              <NumberInput
                value={formData.sales_order_id}
                onChange={(e) => setFormData({ ...formData, sales_order_id: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Tanggal retur *
              </label>
              <input
                type="date"
                value={formData.return_date}
                onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Alasan retur *
              </label>
              <select
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Pilih alasan</option>
                <option value="defective">Produk cacat</option>
                <option value="damaged">Rusak dalam pengiriman</option>
                <option value="wrong_item">Barang yang dikirim salah</option>
                <option value="quality_issue">Masalah kualitas</option>
                <option value="customer_request">Permintaan pelanggan</option>
                <option value="warranty_claim">Klaim garansi</option>
                <option value="other">Lainnya</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{t('common.description')}</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Keterangan tambahan soal retur ini..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.qc_required}
                  onChange={(e) => setFormData({ ...formData, qc_required: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:text-blue-400"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-200">Perlu pemeriksaan QC</span>
              </label>
            </div>
          </div>
        </div>

        {/* Return Items */}
        <div className="fn-card p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Barang yang diretur</h2>
            <button
              type="button"
              onClick={addItem}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              Tambah barang
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-md font-medium text-gray-900 dark:text-white">Barang {index + 1}</h3>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Produk *
                    </label>
                    <SearchableSelect
                      options={products}
                      value={item.product_id || null}
                      onChange={(v) => {
                        const dipilih = products.find((p: any) => p.id === Number(v))
                        updateItem(item.id, 'product_id', v ? Number(v) : 0)
                        if (dipilih) updateItem(item.id, 'product_name', dipilih.name)
                      }}
                      placeholder="Cari nama atau kode produk"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Jumlah diretur *
                    </label>
                    <NumberInput
                      value={item.quantity_returned}
                      onChange={(e) => updateItem(item.id, 'quantity_returned', parseInt(e.target.value) || 1)}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Harga satuan *
                    </label>
                    <NumberInput currency
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Kondisi saat diterima *
                    </label>
                    <select
                      value={item.condition_received}
                      onChange={(e) => updateItem(item.id, 'condition_received', e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="good">Baik</option>
                      <option value="damaged">Rusak</option>
                      <option value="defective">Cacat</option>
                      <option value="unusable">Tidak bisa dipakai</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Nomor batch
                    </label>
                    <input
                      type="text"
                      value={item.batch_number || ''}
                      onChange={(e) => updateItem(item.id, 'batch_number', e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Opsional"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Nilai total
                    </label>
                    <input
                      type="text"
                      value={`Rp ${(item.quantity_returned * item.unit_price).toLocaleString()}`}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-900"
                      disabled
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Keterangan kerusakan
                    </label>
                    <textarea
                      value={item.defect_description || ''}
                      onChange={(e) => updateItem(item.id, 'defect_description', e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={2}
                      placeholder="Jelaskan kerusakan atau masalahnya..."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Total Summary */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium text-gray-900 dark:text-white">Total Items:</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {items.reduce((sum, item) => sum + item.quantity_returned, 0)}
              </span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-lg font-medium text-gray-900 dark:text-white">Total Value:</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                Rp {items.reduce((sum, item) => sum + (item.quantity_returned * item.unit_price), 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4 flex-wrap">
          <Link
            to="/app/returns"
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
          >{t('common.cancel')}</Link>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Menyimpan...' : 'Simpan retur'}
          </button>
        </div>
      </form>
    </div>
  )
}
