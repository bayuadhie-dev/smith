import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import SearchableSelect from '../../components/SearchableSelect'
import {
  useGetSuppliersQuery,
  useGetProductsQuery,
  useGetContractQuery,
  useCreateContractMutation,
  useUpdateContractMutation,
} from '../../services/api'

interface ContractItemRow {
  product_id?: number | ''
  description: string
  quantity?: number | ''
  uom: string
  unit_price: number | ''
  min_order_qty?: number | ''
  max_order_qty?: number | ''
  lead_time_days?: number | ''
}

const emptyItem: ContractItemRow = { description: '', uom: '', unit_price: '' }

export default function ContractForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const { data: suppliers } = useGetSuppliersQuery({})
  const { data: products } = useGetProductsQuery({})
  const { data: existing, isLoading: loadingExisting } = useGetContractQuery(id, { skip: !isEdit })
  const [createContract, { isLoading: creating }] = useCreateContractMutation()
  const [updateContract, { isLoading: updating }] = useUpdateContractMutation()

  const [supplierId, setSupplierId] = useState('')
  const [title, setTitle] = useState('')
  const [contractType, setContractType] = useState('framework')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [totalValue, setTotalValue] = useState<number | ''>('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [deliveryTerms, setDeliveryTerms] = useState('')
  const [penaltyClause, setPenaltyClause] = useState('')
  const [termsConditions, setTermsConditions] = useState('')
  const [autoRenewal, setAutoRenewal] = useState(false)
  const [renewalMonths, setRenewalMonths] = useState<number | ''>('')
  const [items, setItems] = useState<ContractItemRow[]>([{ ...emptyItem }])
  const [status, setStatus] = useState('draft')

  useEffect(() => {
    if (!existing) return
    setSupplierId(String(existing.supplier?.id ?? ''))
    setTitle(existing.title || '')
    setContractType(existing.contract_type || 'framework')
    setStartDate(existing.start_date || '')
    setEndDate(existing.end_date || '')
    setCurrency(existing.currency || 'USD')
    setTotalValue(existing.total_value ?? '')
    setPaymentTerms(existing.payment_terms || '')
    setDeliveryTerms(existing.delivery_terms || '')
    setPenaltyClause(existing.penalty_clause || '')
    setTermsConditions(existing.terms_conditions || '')
    setAutoRenewal(Boolean(existing.auto_renewal))
    setRenewalMonths(existing.renewal_period_months ?? '')
    setStatus(existing.status || 'draft')
    if (existing.items?.length) {
      setItems(existing.items.map((i: any) => ({
        product_id: i.product_id ?? '',
        description: i.description || '',
        quantity: i.quantity ?? '',
        uom: i.uom || '',
        unit_price: i.unit_price ?? '',
        min_order_qty: i.min_order_qty ?? '',
        max_order_qty: i.max_order_qty ?? '',
        lead_time_days: i.lead_time_days ?? '',
      })))
    }
  }, [existing])

  const locked = isEdit && (status === 'expired' || status === 'terminated')

  const updateItem = (idx: number, patch: Partial<ContractItemRow>) => {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }
  const addItem = () => setItems(prev => [...prev, { ...emptyItem }])
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplierId || !title || !contractType || !startDate || !endDate) {
      toast.error('Lengkapi field wajib: supplier, judul, jenis, tanggal mulai & selesai')
      return
    }
    const payload = {
      supplier_id: Number(supplierId),
      title,
      contract_type: contractType,
      start_date: startDate,
      end_date: endDate,
      currency,
      total_value: totalValue === '' ? undefined : Number(totalValue),
      payment_terms: paymentTerms || undefined,
      delivery_terms: deliveryTerms || undefined,
      penalty_clause: penaltyClause || undefined,
      terms_conditions: termsConditions || undefined,
      auto_renewal: autoRenewal,
      renewal_period_months: renewalMonths === '' ? undefined : Number(renewalMonths),
      items: items
        .filter(it => it.description && it.uom && it.unit_price !== '')
        .map(it => ({
          product_id: it.product_id || undefined,
          description: it.description,
          quantity: it.quantity === '' ? undefined : Number(it.quantity),
          uom: it.uom,
          unit_price: Number(it.unit_price),
          min_order_qty: it.min_order_qty === '' ? undefined : Number(it.min_order_qty),
          max_order_qty: it.max_order_qty === '' ? undefined : Number(it.max_order_qty),
          lead_time_days: it.lead_time_days === '' ? undefined : Number(it.lead_time_days),
        })),
    }
    try {
      if (isEdit) {
        await updateContract({ id, ...payload }).unwrap()
        toast.success('Kontrak berhasil diperbarui')
      } else {
        await createContract(payload).unwrap()
        toast.success('Kontrak berhasil dibuat')
      }
      navigate('/app/purchasing/contracts')
    } catch (err: any) {
      toast.error(err?.data?.error || 'Gagal menyimpan kontrak')
    }
  }

  if (isEdit && loadingExisting) {
    return <div className="p-6 text-gray-500">Memuat...</div>
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        {isEdit ? 'Edit Kontrak Supplier' : 'Kontrak Supplier Baru'}
      </h1>
      {locked && (
        <p className="text-sm text-red-600 mb-4">
          Kontrak berstatus "{status}" tidak bisa diedit lagi.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 mt-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Supplier *</label>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} disabled={locked}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white">
                <option value="">Pilih supplier...</option>
                {(suppliers?.suppliers || suppliers || []).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.company_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jenis Kontrak *</label>
              <select value={contractType} onChange={e => setContractType(e.target.value)} disabled={locked}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white">
                <option value="framework">Framework</option>
                <option value="blanket">Blanket</option>
                <option value="spot">Spot</option>
                <option value="service">Service</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Judul Kontrak *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} disabled={locked}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Mulai *</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} disabled={locked}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Selesai *</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} disabled={locked}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mata Uang</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} disabled={locked}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white">
                <option value="USD">USD</option>
                <option value="IDR">IDR</option>
                <option value="CNY">CNY</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Nilai Kontrak</label>
              <input type="number" value={totalValue} onChange={e => setTotalValue(e.target.value === '' ? '' : Number(e.target.value))} disabled={locked}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Syarat Pembayaran</label>
              <input type="text" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} disabled={locked}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Syarat Pengiriman</label>
              <input type="text" value={deliveryTerms} onChange={e => setDeliveryTerms(e.target.value)} disabled={locked}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Klausul Penalti</label>
              <textarea value={penaltyClause} onChange={e => setPenaltyClause(e.target.value)} disabled={locked} rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Syarat & Ketentuan</label>
              <textarea value={termsConditions} onChange={e => setTermsConditions(e.target.value)} disabled={locked} rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={autoRenewal} onChange={e => setAutoRenewal(e.target.checked)} disabled={locked} id="autoRenewal" />
              <label htmlFor="autoRenewal" className="text-sm text-gray-700 dark:text-gray-300">Perpanjangan Otomatis</label>
            </div>
            {autoRenewal && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Periode Perpanjangan (bulan)</label>
                <input type="number" value={renewalMonths} onChange={e => setRenewalMonths(e.target.value === '' ? '' : Number(e.target.value))} disabled={locked}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white" />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Item Kontrak</h2>
            {!locked && (
              <button type="button" onClick={addItem} className="text-sm text-primary-600 hover:underline">+ Tambah Item</button>
            )}
          </div>
          <div className="space-y-3">
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end border-b border-gray-100 dark:border-gray-700 pb-3">
                <div className="col-span-3">
                  <label className="block text-xs text-gray-500 mb-1">Produk</label>
                  <SearchableSelect
                    options={(products?.products || products || []).map((p: any) => ({ id: p.id, code: p.code, name: p.name }))}
                    value={it.product_id ?? null}
                    onChange={(value) => updateItem(idx, { product_id: value ? Number(value) : '' })}
                    placeholder="-"
                    disabled={locked}
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs text-gray-500 mb-1">Deskripsi *</label>
                  <input type="text" value={it.description} onChange={e => updateItem(idx, { description: e.target.value })} disabled={locked}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white" />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs text-gray-500 mb-1">Qty</label>
                  <input type="number" value={it.quantity ?? ''} onChange={e => updateItem(idx, { quantity: e.target.value === '' ? '' : Number(e.target.value) })} disabled={locked}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white" />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs text-gray-500 mb-1">UOM *</label>
                  <input type="text" value={it.uom} onChange={e => updateItem(idx, { uom: e.target.value })} disabled={locked}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Harga Satuan *</label>
                  <input type="number" value={it.unit_price} onChange={e => updateItem(idx, { unit_price: e.target.value === '' ? '' : Number(e.target.value) })} disabled={locked}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white" />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs text-gray-500 mb-1">Lead Time (hari)</label>
                  <input type="number" value={it.lead_time_days ?? ''} onChange={e => updateItem(idx, { lead_time_days: e.target.value === '' ? '' : Number(e.target.value) })} disabled={locked}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-white" />
                </div>
                <div className="col-span-1 flex justify-end">
                  {!locked && items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="text-red-500 text-xs hover:underline">Hapus</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/app/purchasing/contracts')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">Batal</button>
          {!locked && (
            <button type="submit" disabled={creating || updating}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {creating || updating ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Buat Kontrak'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
