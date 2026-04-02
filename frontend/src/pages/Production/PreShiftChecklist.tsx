import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ClipboardDocumentCheckIcon, 
  CheckCircleIcon, 
  ClockIcon,
  ExclamationCircleIcon,
  CalendarIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CogIcon,
  UserGroupIcon,
  EyeIcon,
  PencilSquareIcon,
  TableCellsIcon
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid'
import { useGetPreShiftChecklistStatusQuery } from '../../services/api'

interface ShiftStatus {
  status: 'submitted' | 'pending'
  submission_id: number | null
  submitted_at?: string
  operator_name?: string
}

interface MachineStatus {
  machine_id: number
  machine_name: string
  machine_code: string
  shifts: {
    [key: number]: ShiftStatus
  }
}

const SHIFT_CONFIG = [
  { id: 1, name: 'Shift 1', time: '07:00 - 15:00', color: 'blue', bgLight: 'bg-blue-50', bgDark: 'bg-blue-600', text: 'text-blue-700', border: 'border-blue-200' },
  { id: 2, name: 'Shift 2', time: '15:00 - 23:00', color: 'purple', bgLight: 'bg-purple-50', bgDark: 'bg-purple-600', text: 'text-purple-700', border: 'border-purple-200' },
  { id: 3, name: 'Shift 3', time: '23:00 - 07:00', color: 'indigo', bgLight: 'bg-indigo-50', bgDark: 'bg-indigo-600', text: 'text-indigo-700', border: 'border-indigo-200' },
]

const PreShiftChecklist = () => {
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  
  const { data, isLoading, refetch, isFetching } = useGetPreShiftChecklistStatusQuery(selectedDate)

  const handleDateChange = (days: number) => {
    const current = new Date(selectedDate)
    current.setDate(current.getDate() + days)
    setSelectedDate(current.toISOString().split('T')[0])
  }

  const isToday = selectedDate === new Date().toISOString().split('T')[0]

  const handleOpenForm = (machineId: number, shift: number, submissionId?: number | null) => {
    if (submissionId) {
      navigate(`/app/production/pre-shift-checklist/view/${submissionId}`)
    } else {
      navigate(`/app/production/pre-shift-checklist/form?machine=${machineId}&date=${selectedDate}&shift=${shift}`)
    }
  }

  const calculateStats = () => {
    if (!data?.machines) return { total: 0, submitted: 0, pending: 0, percentage: 0 }
    
    let submitted = 0
    let pending = 0
    
    data.machines.forEach((machine: MachineStatus) => {
      Object.values(machine.shifts).forEach((shift: ShiftStatus) => {
        if (shift.status === 'submitted') submitted++
        else pending++
      })
    })
    
    const total = submitted + pending
    const percentage = total > 0 ? Math.round((submitted / total) * 100) : 0
    
    return { total, submitted, pending, percentage }
  }

  const stats = calculateStats()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Memuat data checklist...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <ClipboardDocumentCheckIcon className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Pre-Shift Checklist</h1>
                  <p className="text-blue-100 text-sm mt-1">Checklist kondisi mesin dan man power sebelum produksi</p>
                </div>
              </div>
              
              {/* Date Navigation */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDateChange(-1)}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  <ChevronLeftIcon className="w-5 h-5 text-white" />
                </button>
                
                <div className="flex items-center space-x-2 bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                  <CalendarIcon className="w-5 h-5 text-white" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent text-white border-none focus:ring-0 text-sm font-medium cursor-pointer"
                  />
                </div>
                
                <button
                  onClick={() => handleDateChange(1)}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  <ChevronRightIcon className="w-5 h-5 text-white" />
                </button>
                
                {!isToday && (
                  <button
                    onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                    className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors"
                  >
                    Hari Ini
                  </button>
                )}
                
                <button
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
                >
                  <ArrowPathIcon className={`w-5 h-5 text-white ${isFetching ? 'animate-spin' : ''}`} />
                </button>
                
                <button
                  onClick={() => navigate('/app/production/pre-shift-checklist/weekly')}
                  className="flex items-center space-x-2 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors"
                >
                  <TableCellsIcon className="w-5 h-5" />
                  <span>Summary Mingguan</span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Date Display */}
          <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
            <p className="text-blue-800 font-medium">
              📅 {new Date(selectedDate).toLocaleDateString('id-ID', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
              {isToday && <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">Hari Ini</span>}
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Progress Card */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 col-span-1 md:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">Progress</span>
              <span className="text-2xl font-bold text-blue-600">{stats.percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${stats.percentage}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{stats.submitted} dari {stats.total} checklist</p>
          </div>
          
          {/* Total Card */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Mesin</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{data?.machines?.length || 0}</p>
              </div>
              <div className="p-3 bg-gray-100 rounded-xl">
                <CogIcon className="w-7 h-7 text-gray-600" />
              </div>
            </div>
          </div>
          
          {/* Submitted Card */}
          <div className="bg-white rounded-xl shadow-md border border-green-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Selesai</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{stats.submitted}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <CheckCircleSolid className="w-7 h-7 text-green-600" />
              </div>
            </div>
          </div>
          
          {/* Pending Card */}
          <div className="bg-white rounded-xl shadow-md border border-amber-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Belum Diisi</p>
                <p className="text-3xl font-bold text-amber-600 mt-1">{stats.pending}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <ClockIcon className="w-7 h-7 text-amber-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Shift Legend */}
        <div className="flex items-center justify-center space-x-6 bg-white rounded-xl shadow-md border border-gray-100 py-3 px-6">
          {SHIFT_CONFIG.map((shift) => (
            <div key={shift.id} className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${shift.bgDark}`}></div>
              <span className="text-sm font-medium text-gray-700">{shift.name}</span>
              <span className="text-xs text-gray-500">({shift.time})</span>
            </div>
          ))}
        </div>

        {/* Machine Grid */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CogIcon className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Status Checklist per Mesin</h2>
              </div>
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span className="text-gray-600">Selesai</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-4 h-4 bg-amber-400 rounded"></div>
                  <span className="text-gray-600">Belum Diisi</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-64">
                    Mesin
                  </th>
                  {SHIFT_CONFIG.map((shift) => (
                    <th key={shift.id} className="px-4 py-4 text-center">
                      <div className={`inline-flex flex-col items-center px-4 py-2 rounded-lg ${shift.bgLight} ${shift.border} border`}>
                        <span className={`text-xs font-bold ${shift.text}`}>{shift.name}</span>
                        <span className="text-xs text-gray-500">{shift.time}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.machines?.map((machine: MachineStatus, index: number) => (
                  <tr key={machine.machine_id} className={`hover:bg-blue-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 flex-shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                          <span className="text-white font-bold text-sm">{machine.machine_code?.substring(0, 3) || 'MC'}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{machine.machine_name}</p>
                          <p className="text-xs text-gray-500 flex items-center">
                            <CogIcon className="w-3 h-3 mr-1" />
                            {machine.machine_code}
                          </p>
                        </div>
                      </div>
                    </td>
                    {SHIFT_CONFIG.map((shiftConfig) => {
                      const shiftData = machine.shifts[shiftConfig.id]
                      const isSubmitted = shiftData?.status === 'submitted'
                      
                      return (
                        <td key={shiftConfig.id} className="px-4 py-4">
                          <div className="flex justify-center">
                            <button
                              onClick={() => handleOpenForm(machine.machine_id, shiftConfig.id, shiftData?.submission_id)}
                              className={`group relative flex flex-col items-center justify-center w-24 h-20 rounded-xl border-2 transition-all duration-200 ${
                                isSubmitted 
                                  ? 'bg-green-50 border-green-300 hover:bg-green-100 hover:border-green-400 hover:shadow-md' 
                                  : 'bg-amber-50 border-amber-300 hover:bg-amber-100 hover:border-amber-400 hover:shadow-md'
                              }`}
                            >
                              {isSubmitted ? (
                                <>
                                  <CheckCircleSolid className="w-8 h-8 text-green-500 mb-1" />
                                  <span className="text-xs font-medium text-green-700">Selesai</span>
                                  <div className="absolute inset-0 flex items-center justify-center bg-green-600/90 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                                    <EyeIcon className="w-5 h-5 text-white mr-1" />
                                    <span className="text-xs font-medium text-white">Lihat</span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <ClockIcon className="w-8 h-8 text-amber-500 mb-1" />
                                  <span className="text-xs font-medium text-amber-700">Belum</span>
                                  <div className="absolute inset-0 flex items-center justify-center bg-amber-500/90 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                                    <PencilSquareIcon className="w-5 h-5 text-white mr-1" />
                                    <span className="text-xs font-medium text-white">Isi</span>
                                  </div>
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(!data?.machines || data.machines.length === 0) && (
            <div className="p-12 text-center">
              <ExclamationCircleIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">Tidak ada data mesin aktif</p>
              <p className="text-gray-400 text-sm mt-1">Pastikan mesin sudah ditambahkan di sistem</p>
            </div>
          )}
        </div>

        {/* Info Footer */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UserGroupIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-blue-900">Tentang Pre-Shift Checklist</h3>
              <p className="text-sm text-blue-700 mt-1">
                Checklist ini wajib diisi oleh operator sebelum memulai produksi di setiap shift. 
                Pastikan semua item Kondisi Mesin dan Man Power dicek dengan benar.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PreShiftChecklist
