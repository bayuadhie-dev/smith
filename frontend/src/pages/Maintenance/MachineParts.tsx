import { useEffect, useState } from 'react'
import axiosInstance from '../../utils/axiosConfig'
import SearchableSelect from '../../components/SearchableSelect'
import MachinePartsPanel from '../../components/Maintenance/MachinePartsPanel'
import { PageHeader, Panel } from '../../components/ui/PageKit'
import { showError } from '../../components/ui'

interface MachineOption { id: number; code: string; name: string }

const MachineParts = () => {
  const [machines, setMachines] = useState<MachineOption[]>([])
  const [machineId, setMachineId] = useState<number | null>(null)

  useEffect(() => {
    axiosInstance.get('/api/production/machines')
      .then((res) => setMachines((res.data.machines || []).map((m: any) => ({ id: m.id, code: m.code, name: m.name }))))
      .catch((e) => showError(e.response?.data?.error || 'Daftar mesin gagal dimuat.'))
  }, [])

  return (
    <div className="space-y-4 p-6">
      <PageHeader title="Sparepart per Mesin" subtitle="Daftar sparepart yang terpasang di tiap mesin, beserta interval penggantian dan stoknya" />
      <Panel title="Pilih mesin">
        <div className="max-w-md p-4">
          <SearchableSelect
            options={machines}
            value={machineId}
            onChange={(v) => setMachineId(v ? Number(v) : null)}
            placeholder="Cari kode atau nama mesin"
          />
        </div>
      </Panel>
      {machineId ? (
        <MachinePartsPanel key={machineId} machineId={machineId} />
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">Pilih mesin untuk melihat daftar sparepart-nya.</p>
      )}
    </div>
  )
}

export default MachineParts
