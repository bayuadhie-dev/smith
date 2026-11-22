import React, { useState } from 'react'
import { Link } from 'react-router-dom';
import { KpiStrip, PageHeader, StatusPill } from '../../components/ui/PageKit'
import { useLanguage } from '../../contexts/LanguageContext';
import {
  BuildingStorefrontIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon
,
  TrashIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast'
import { confirmDialog } from '../../components/ui';
import {
  useGetWarehouseZonesQuery,
  useCreateWarehouseZoneMutation,
  useUpdateWarehouseZoneMutation,
  useDeleteWarehouseZoneMutation
} from '../../services/api';
import NumberInput from '../../components/ui/NumberInput'
export default function WarehouseZones() {
    const { t } = useLanguage();

const [showModal, setShowModal] = useState(false)
  const [editingZone, setEditingZone] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  const { data: zones, isLoading: zonesLoading, refetch } = useGetWarehouseZonesQuery({})
  const [createZone] = useCreateWarehouseZoneMutation()
  const [updateZone] = useUpdateWarehouseZoneMutation()
  const [deleteZone] = useDeleteWarehouseZoneMutation()

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    material_type: 'finished_goods',
    capacity: '',
    capacity_uom: 'KG'
  })

  const materialTypes = [
    { value: 'finished_goods', label: 'Barang jadi' },
    { value: 'raw_materials', label: 'Bahan baku' },
    { value: 'packaging_materials', label: 'Bahan kemas' },
    { value: 'chemical_materials', label: 'Bahan kimia' }
  ]

  const uomOptions = ['KG', 'TON', 'M3', 'PALLET', 'UNIT']

  const openCreateModal = () => {
    setEditingZone(null)
    setFormData({
      code: '',
      name: '',
      description: '',
      material_type: 'finished_goods',
      capacity: '',
      capacity_uom: 'KG'
    })
    setShowModal(true)
  }

  const openEditModal = (zone: any) => {
    setEditingZone(zone)
    setFormData({
      code: zone.code,
      name: zone.name,
      description: zone.description || '',
      material_type: zone.material_type,
      capacity: zone.capacity?.toString() || '',
      capacity_uom: zone.capacity_uom || 'KG'
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const payload = {
        ...formData,
        capacity: formData.capacity ? parseFloat(formData.capacity) : null
      }

      if (editingZone) {
        await updateZone({ id: editingZone.id, ...payload }).unwrap()
        toast.success('Zone updated successfully!')
      } else {
        await createZone(payload).unwrap()
        toast.success('Zone created successfully!')
      }

      setShowModal(false)
      refetch()
    } catch (error: any) {
      toast.error(error.data?.error || t('messages.operation_failed'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (zone: any) => {
    if (!(await confirmDialog(`Are you sure you want to delete zone "${zone.name}"?`))) return

    try {
      await deleteZone(zone.id).unwrap()
      toast.success('Zone deleted successfully!')
      refetch()
    } catch (error: any) {
      toast.error(error.data?.error || 'Delete failed')
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="GUDANG · MASTER"
        title="Master Gudang"
        subtitle="Daftar gudang dan area penyimpanannya"
        actions={
          <button onClick={openCreateModal} className="btn-primary">
            <PlusIcon className="h-4 w-4" />
            Tambah gudang
          </button>
        }
      />

      <KpiStrip
        items={materialTypes.map((type) => ({
          label: type.label,
          value: (zones?.zones?.filter((z: any) => z.material_type === type.value) || []).length,
          hint: 'gudang',
        }))}
      />

      {/* Zones Grid */}
      {zonesLoading ? (
        <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">Memuat gudang...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {zones?.zones?.map((zone: any) => (
            <div key={zone.id} className="card p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/30">
                    <BuildingStorefrontIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white"><Link to={`/app/warehouse/gudang/${zone.id}`} className="hover:text-emerald-700 hover:underline" title="Lihat stok, lokasi, dan mutasi gudang">{zone.name}</Link></h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{zone.code}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => openEditModal(zone)}
                    className="text-gray-400 hover:text-blue-600"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(zone)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="fn-label">Jenis barang</span>
                  <StatusPill tone="muted" dot={false}>
                    {materialTypes.find(t => t.value === zone.material_type)?.label || 'Campuran'}
                  </StatusPill>
                </div>

                <div className="flex items-center justify-between">
                  <span className="fn-label">Lokasi</span>
                  <div className="flex items-center gap-1">
                    <MapPinIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium">{zone.location_count}</span>
                  </div>
                </div>

                {zone.capacity && (
                  <div className="flex items-center justify-between">
                    <span className="fn-label">Kapasitas</span>
                    <span className="text-sm font-medium">
                      {zone.capacity.toLocaleString()} {zone.capacity_uom}
                    </span>
                  </div>
                )}

                <div className="pt-3 border-t">
                  <Link
                    to={`/app/warehouse/zones/${zone.id}/locations`}
                    className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
                  >
                    Lihat lokasi →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!zonesLoading && (!zones?.zones || zones.zones.length === 0) && (
        <div className="text-center py-12">
          <BuildingStorefrontIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Belum ada gudang</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Mulai dengan menambahkan satu gudang.</p>
          <div className="mt-6">
            <button onClick={openCreateModal} className="btn-primary">
              <PlusIcon className="h-4 w-4" />
              Tambah gudang
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingZone ? 'Edit Zone' : 'Create New Zone'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Zone Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => handleInputChange('code', e.target.value)}
                    className="input-field"
                    placeholder="e.g., FG-A"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Zone Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="input-field"
                    placeholder="e.g., Finished Goods Area A"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Material Type *</label>
                <select
                  value={formData.material_type}
                  onChange={(e) => handleInputChange('material_type', e.target.value)}
                  className="input-field"
                  required
                >
                  {materialTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t('common.description')}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="input-field"
                  rows={3}
                  placeholder="Zone description..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Capacity</label>
                  <NumberInput
                    step="0.01"
                    value={formData.capacity}
                    onChange={(e) => handleInputChange('capacity', e.target.value)}
                    className="input-field"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">UOM</label>
                  <select
                    value={formData.capacity_uom}
                    onChange={(e) => handleInputChange('capacity_uom', e.target.value)}
                    className="input-field"
                  >
                    {uomOptions.map((uom) => (
                      <option key={uom} value={uom}>{uom}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                  disabled={isLoading}
                >{t('common.cancel')}</button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : editingZone ? [t('common.update')] : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
