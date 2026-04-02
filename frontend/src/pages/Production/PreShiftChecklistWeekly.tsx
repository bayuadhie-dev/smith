import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ClipboardDocumentCheckIcon,
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CalendarIcon,
  XCircleIcon,
  CogIcon,
  UserGroupIcon,
  CheckCircleIcon,
  MinusCircleIcon
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolid, XCircleIcon as XCircleSolid } from '@heroicons/react/24/solid'
import { useGetWeeklySummaryQuery, useGetPreShiftChecklistSubmissionQuery } from '../../services/api'

const PreShiftChecklistWeekly = () => {
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [expandedId, setExpandedId] = useState<number | null>(null)
  
  const { data, isLoading, isFetching } = useGetWeeklySummaryQuery(selectedDate)

  const handleWeekChange = (weeks: number) => {
    const current = new Date(selectedDate)
    current.setDate(current.getDate() + (weeks * 7))
    setSelectedDate(current.toISOString().split('T')[0])
  }

  const goToThisWeek = () => {
    setSelectedDate(new Date().toISOString().split('T')[0])
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  }

  const calculateStats = () => {
    if (!data?.submissions) return { total: 0, submitted: 0 }
    const submitted = data.submissions.length
    const total = (data.machines?.length || 0) * 7 * 3 // machines × days × shifts
    return { total, submitted }
  }

  const stats = calculateStats()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Memuat data mingguan...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-full mx-auto space-y-4">
        
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => navigate('/app/production/pre-shift-checklist')}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  <ArrowLeftIcon className="w-5 h-5 text-white" />
                </button>
                <div className="p-2 bg-white/20 rounded-lg">
                  <ClipboardDocumentCheckIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Summary Mingguan</h1>
                  <p className="text-indigo-100 text-sm">Pre-Shift Checklist per Mesin per Tanggal</p>
                </div>
              </div>
              
              {/* Week Navigation */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleWeekChange(-1)}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  <ChevronLeftIcon className="w-5 h-5 text-white" />
                </button>
                <div className="text-center px-4">
                  <p className="text-white font-semibold">
                    {data?.week_start && formatDate(data.week_start)} - {data?.week_end && formatDate(data.week_end)}
                  </p>
                </div>
                <button
                  onClick={() => handleWeekChange(1)}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  <ChevronRightIcon className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={goToThisWeek}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors"
                >
                  Minggu Ini
                </button>
              </div>
            </div>
          </div>
          
          {/* Stats */}
          <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <CheckCircleSolid className="w-5 h-5 text-green-600" />
                <span className="text-gray-700"><strong>{stats.submitted}</strong> Submitted</span>
              </div>
              <div className="flex items-center space-x-2">
                <CalendarIcon className="w-5 h-5 text-gray-500" />
                <span className="text-gray-700"><strong>{data?.machines?.length || 0}</strong> Mesin × 7 Hari × 3 Shift</span>
              </div>
            </div>
            {isFetching && (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent"></div>
            )}
          </div>
        </div>

        {/* Submissions List */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h3 className="font-semibold text-gray-700">Daftar Checklist yang Sudah Diinput</h3>
          </div>
          
          {data?.submissions?.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <XCircleIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p>Belum ada checklist yang diinput minggu ini</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data?.submissions?.map((submission: any) => (
                <SubmissionItem 
                  key={submission.id}
                  submission={submission}
                  isExpanded={expandedId === submission.id}
                  onToggle={() => setExpandedId(expandedId === submission.id ? null : submission.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Submission Item Component with expandable details
interface SubmissionItemProps {
  submission: any
  isExpanded: boolean
  onToggle: () => void
}

const SubmissionItem: React.FC<SubmissionItemProps> = ({ submission, isExpanded, onToggle }) => {
  const { data: detail, isLoading } = useGetPreShiftChecklistSubmissionQuery(submission.id, {
    skip: !isExpanded
  })

  const shiftColors: Record<number, string> = {
    1: 'bg-blue-100 text-blue-700',
    2: 'bg-purple-100 text-purple-700',
    3: 'bg-indigo-100 text-indigo-700'
  }
  const shiftTimes: Record<number, string> = {
    1: '07:00-15:00',
    2: '15:00-23:00',
    3: '23:00-07:00'
  }

  const groupAnswersByCategory = (answers: any[]) => {
    const grouped: { [key: string]: any[] } = {}
    answers?.forEach((answer: any) => {
      const category = answer.item?.category || 'OTHER'
      if (!grouped[category]) grouped[category] = []
      grouped[category].push(answer)
    })
    return grouped
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'KONDISI_MESIN': return 'Kondisi Mesin'
      case 'MANPOWER': return 'Man Power'
      case 'MATERIAL': return 'Kelengkapan Material'
      case 'KEAMANAN': return 'Keamanan Mesin'
      default: return category
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'KONDISI_MESIN': return <CogIcon className="w-4 h-4" />
      case 'MANPOWER': return <UserGroupIcon className="w-4 h-4" />
      default: return <CheckCircleIcon className="w-4 h-4" />
    }
  }

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      {/* Header Row - Clickable */}
      <div 
        className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
        onClick={onToggle}
      >
        <div className="flex items-center space-x-4">
          <CheckCircleSolid className="w-5 h-5 text-green-500 flex-shrink-0" />
          <div>
            <div className="font-medium text-gray-900">{submission.machine_name}</div>
            <div className="text-sm text-gray-500">
              {new Date(submission.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <span className={`px-2 py-1 rounded text-xs font-medium ${shiftColors[submission.shift]}`}>
            Shift {submission.shift} ({shiftTimes[submission.shift]})
          </span>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-700">{submission.operator_name || '-'}</div>
            {submission.product_name && (
              <div className="text-xs text-gray-500">{submission.product_name}</div>
            )}
          </div>
          {isExpanded ? (
            <ChevronUpIcon className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded Details - Compact Table */}
      {isExpanded && (
        <div className="px-4 pb-3 bg-gray-50">
          {isLoading ? (
            <div className="flex items-center justify-center py-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent"></div>
            </div>
          ) : detail?.answers ? (
            <div className="bg-white rounded border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-600 w-8">#</th>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-600">Item</th>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-600 w-20">Kategori</th>
                    <th className="px-2 py-1.5 text-center font-medium text-gray-600 w-12">Status</th>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-600">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detail.answers.map((answer: any, idx: number) => (
                    <tr key={answer.id} className={answer.status === 'NG' ? 'bg-red-50' : ''}>
                      <td className="px-2 py-1 text-gray-400">{idx + 1}</td>
                      <td className="px-2 py-1 text-gray-700">{answer.item?.item_name}</td>
                      <td className="px-2 py-1">
                        <span className="text-[10px] text-gray-500">{getCategoryLabel(answer.item?.category)}</span>
                      </td>
                      <td className="px-2 py-1 text-center">
                        {answer.status === 'OK' ? (
                          <CheckCircleSolid className="w-4 h-4 text-green-500 inline" />
                        ) : answer.status === 'NG' ? (
                          <XCircleSolid className="w-4 h-4 text-red-500 inline" />
                        ) : (
                          <MinusCircleIcon className="w-4 h-4 text-gray-400 inline" />
                        )}
                      </td>
                      <td className="px-2 py-1 text-gray-500 italic">{answer.catatan || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Summary Stats */}
              <div className="px-2 py-1.5 bg-gray-50 border-t flex items-center justify-between text-[10px]">
                <div className="flex items-center space-x-3">
                  <span className="text-green-600 font-medium">
                    ✓ OK: {detail.answers.filter((a: any) => a.status === 'OK').length}
                  </span>
                  <span className="text-red-600 font-medium">
                    ✗ NG: {detail.answers.filter((a: any) => a.status === 'NG').length}
                  </span>
                  <span className="text-gray-500">
                    N/A: {detail.answers.filter((a: any) => a.status === 'NA').length}
                  </span>
                </div>
                <span className="text-gray-400">
                  Submitted: {detail.submitted_at ? new Date(detail.submitted_at).toLocaleString('id-ID') : '-'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-2 text-xs">Tidak ada data</p>
          )}
        </div>
      )}
    </div>
  )
}

export default PreShiftChecklistWeekly
