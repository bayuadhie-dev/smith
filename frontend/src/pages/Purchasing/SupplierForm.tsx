import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLanguage } from '../../contexts/LanguageContext';
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  useGetSupplierQuery, 
  useCreateSupplierMutation, 
  useUpdateSupplierMutation,
  useGetSupplierTypesQuery
} from '../../services/api' 
import NumberInput from '../../components/ui/NumberInput'
interface SupplierFormData {
  code: string
  name: string
  contact_person: string
  email: string
  phone: string
  mobile: string
  address: string
  tax_address: string
  city: string
  postal_code: string
  country: string
  tax_id: string
  payment_terms: string
  supplier_type?: string
  supplier_subtype?: string
  currency?: string
  ppn_code?: string
  credit_limit: number
  is_active: boolean
  notes: string
}

export default function SupplierForm() {
    const { t } = useLanguage();

const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  
  const { data: supplier, isLoading } = useGetSupplierQuery(id, { skip: !id })
  const [createSupplier, { isLoading: isCreating }] = useCreateSupplierMutation()
  const [updateSupplier, { isLoading: isUpdating }] = useUpdateSupplierMutation()
  const { data: typesData } = useGetSupplierTypesQuery(undefined)
  const baseTypes = ['PACKAGING', 'SPAREPART', 'CHEMICAL', 'BAHAN BAKU', 'BAHAN PEMBANTU', 'ANGKUTAN', 'KALIBRASI', 'LAIN-LAIN']
  const typeOptions = Array.from(new Set([...(typesData?.types || []), ...baseTypes])).filter((t: string) => !['EMP', 'KARYAWAN'].includes(t) || (typesData?.types || []).includes(t))

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<SupplierFormData>({
    defaultValues: {
      code: '',
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      mobile: '',
      address: '',
      tax_address: '',
      city: '',
      postal_code: '',
      country: 'Indonesia',
      tax_id: '',
      payment_terms: '30',
      supplier_type: '',
      supplier_subtype: '',
      currency: 'IDR',
      ppn_code: '',
      credit_limit: 0,
      is_active: true,
      notes: ''
    }
  })

  useEffect(() => {
    if (supplier) {
      reset({
        code: supplier.code || '',
        name: supplier.name || '',
        contact_person: supplier.contact_person || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        mobile: supplier.mobile || '',
        address: supplier.address || '',
        tax_address: supplier.tax_address || '',
        city: supplier.city || '',
        postal_code: supplier.postal_code || '',
        country: supplier.country || 'Indonesia',
        tax_id: supplier.tax_id || '',
        payment_terms: supplier.payment_terms || '30',
        supplier_type: supplier.supplier_type || '',
        supplier_subtype: supplier.supplier_subtype || '',
        currency: supplier.currency || 'IDR',
        ppn_code: supplier.ppn_code || '',
        credit_limit: supplier.credit_limit || 0,
        is_active: supplier.is_active !== false,
        notes: supplier.notes || ''
      })
    }
  }, [supplier, reset])

  const onSubmit = async (data: SupplierFormData) => {
    try {
      if (isEdit && id) {
        await updateSupplier({ id, ...data }).unwrap()
        toast.success('Pemasok diperbarui')
      } else {
        await createSupplier(data).unwrap()
        toast.success('Pemasok dibuat')
      }
      navigate('/app/purchasing/suppliers')
    } catch (error: any) {
      toast.error(error?.data?.error || error?.data?.message || 'Gagal menyimpan pemasok')
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isEdit ? 'Ubah Pemasok' : 'Pemasok Baru'}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {isEdit ? 'Perbarui data pemasok' : 'Tambah data pemasok baru'}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Informasi Dasar</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nomor Pemasok
              </label>
              <input
                type="text"
                {...register('code')}
                placeholder={isEdit ? '' : 'Kosongkan untuk nomor otomatis (SUP-001, ...)'}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Isi sendiri bila pemasok sudah punya nomor di Accurate atau sistem lain, supaya tidak ganda.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nama Pemasok *
              </label>
              <input
                type="text"
                {...register('name', { required: 'Nama pemasok wajib diisi' })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nama Kontak
              </label>
              <input
                type="text"
                {...register('contact_person')}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                {...register('email', { 
                  pattern: {
                    value: /^\S+@\S+$/i,
                    message: 'Invalid email format'
                  }
                })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Telepon Kantor
              </label>
              <input
                type="text"
                {...register('phone')}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                No. HP / WhatsApp
              </label>
              <input
                type="text"
                inputMode="tel"
                {...register('mobile')}
                placeholder="08xxxxxxxxxx"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Alamat</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Alamat Perusahaan
              </label>
              <textarea
                {...register('address')}
                rows={3}
                placeholder="Alamat kantor atau pabrik pemasok"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Alamat Pajak
                </label>
                <button
                  type="button"
                  onClick={() => setValue('tax_address', watch('address') || '', { shouldDirty: true })}
                  className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  Samakan dengan alamat perusahaan
                </button>
              </div>
              <textarea
                {...register('tax_address')}
                rows={3}
                placeholder="Alamat sesuai NPWP / faktur pajak"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Dipakai untuk faktur pajak dan dokumen pajak. Boleh berbeda dari alamat perusahaan.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Kota
                </label>
                <input
                  type="text"
                  {...register('city')}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Kode Pos
                </label>
                <input
                  type="text"
                  {...register('postal_code')}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Negara
                </label>
                <input
                  type="text"
                  {...register('country')}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Informasi Bisnis</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                NPWP
              </label>
              <input
                type="text"
                {...register('tax_id')}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Kategori Pemasok</label>
              <input
                list="supplier-type-options"
                {...register('supplier_type')}
                placeholder="Pilih atau ketik kategori baru"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <datalist id="supplier-type-options">
                {typeOptions.map((t: string) => <option key={t} value={t} />)}
              </datalist>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Memudahkan procurement mencari pemasok (mis. PACKAGING, SPAREPART, CHEMICAL).</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Jenis (rinci, opsional)</label>
              <input
                {...register('supplier_subtype')}
                placeholder="Mis. STICKER, CARTON BOX, PHMB, BEARING"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mata Uang Utama</label>
              <select
                {...register('currency')}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="IDR">IDR - Rupiah</option>
                <option value="USD">USD - Dolar AS</option>
                <option value="CNY">CNY - Yuan</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">PO baru ke pemasok ini otomatis memakai mata uang ini, dengan kurs terbaru.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Termin Pembayaran (hari)
              </label>
              <select
                {...register('payment_terms')}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="0">Tunai (COD)</option>
                <option value="7">7 hari</option>
                <option value="14">14 hari</option>
                <option value="30">30 hari</option>
                <option value="45">45 hari</option>
                <option value="60">60 hari</option>
                <option value="90">90 hari</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Jenis PPN
              </label>
              <select
                {...register('ppn_code')}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Belum diatur (dianggap Y)</option>
                <option value="Y">Y - 11%</option>
                <option value="A">A - 1,1%</option>
                <option value="B">B - 1,2%</option>
                <option value="L">L - 12%</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Batas Kredit
              </label>
              <NumberInput
                step="0.01"
                {...register('credit_limit', { valueAsNumber: true })}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                {...register('is_active')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:text-blue-400"
              />
              <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Pemasok aktif
              </label>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                
            </label>
            <textarea
              {...register('notes')}
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Catatan tambahan tentang pemasok"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/app/purchasing/suppliers')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >{t('common.cancel')}</button>
          <button
            type="submit"
            disabled={isCreating || isUpdating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating || isUpdating ? 'Menyimpan...' : (isEdit ? 'Simpan Perubahan' : 'Simpan Pemasok')}
          </button>
        </div>
      </form>
    </div>
  )
}
