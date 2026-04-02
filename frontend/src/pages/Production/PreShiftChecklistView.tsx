import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { 
  ClipboardDocumentCheckIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  MinusCircleIcon,
  CogIcon,
  UserGroupIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  PencilSquareIcon,
  PrinterIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftEllipsisIcon
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolid, XCircleIcon as XCircleSolid } from '@heroicons/react/24/solid'
import { useGetPreShiftChecklistSubmissionQuery, useAddSupervisorNoteMutation } from '../../services/api'

const SHIFT_CONFIG: { [key: number]: { name: string; time: string; color: string; bg: string; border: string; gradient: string } } = {
  1: { name: 'Shift 1', time: '07:00 - 15:00', color: 'text-blue-700', bg: 'bg-blue-100', border: 'border-blue-300', gradient: 'from-blue-600 to-blue-700' },
  2: { name: 'Shift 2', time: '15:00 - 23:00', color: 'text-purple-700', bg: 'bg-purple-100', border: 'border-purple-300', gradient: 'from-purple-600 to-purple-700' },
  3: { name: 'Shift 3', time: '23:00 - 07:00', color: 'text-indigo-700', bg: 'bg-indigo-100', border: 'border-indigo-300', gradient: 'from-indigo-600 to-indigo-700' },
}

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent', color: 'bg-red-600 text-white' },
  { value: 'high', label: 'Tinggi', color: 'bg-orange-500 text-white' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-500 text-white' },
  { value: 'low', label: 'Rendah', color: 'bg-gray-400 text-white' },
]

const PreShiftChecklistView = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  
  const [editingNgItem, setEditingNgItem] = useState<number | null>(null)
  const [supervisorNote, setSupervisorNote] = useState('')
  const [priority, setPriority] = useState('normal')
  
  const { data: submission, isLoading, refetch } = useGetPreShiftChecklistSubmissionQuery(Number(id), {
    skip: !id
  })
  
  const [addSupervisorNote, { isLoading: isSaving }] = useAddSupervisorNoteMutation()

  const shiftConfig = submission ? SHIFT_CONFIG[submission.shift] || SHIFT_CONFIG[1] : SHIFT_CONFIG[1]

  const groupAnswersByCategory = () => {
    if (!submission?.answers) return {}
    
    const grouped: { [key: string]: any[] } = {}
    submission.answers.forEach((answer: any) => {
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

  const getStats = () => {
    if (!submission?.answers) return { ok: 0, ng: 0, na: 0, total: 0 }
    
    const stats = { ok: 0, ng: 0, na: 0, total: submission.answers.length }
    submission.answers.forEach((a: any) => {
      if (a.status === 'OK') stats.ok++
      else if (a.status === 'NG') stats.ng++
      else stats.na++
    })
    return stats
  }

  // Get NG items for quick reference
  const getNGItems = () => {
    if (!submission?.answers) return []
    return submission.answers.filter((a: any) => a.status === 'NG')
  }

  const handleEditNgItem = (item: any) => {
    setEditingNgItem(item.id)
    setSupervisorNote(item.corrective_action?.supervisor_note || '')
    setPriority(item.corrective_action?.priority || 'normal')
  }

  const handleSaveSupervisorNote = async (answerId: number) => {
    try {
      await addSupervisorNote({
        answerId,
        supervisor_note: supervisorNote,
        priority
      }).unwrap()
      setEditingNgItem(null)
      refetch()
    } catch (error) {
      console.error('Error saving supervisor note:', error)
      alert('Gagal menyimpan catatan')
    }
  }

  const getPriorityBadge = (priorityValue: string) => {
    const opt = PRIORITY_OPTIONS.find(p => p.value === priorityValue)
    return opt || PRIORITY_OPTIONS[2] // default normal
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    )
  }

  if (!submission) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <XCircleIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">Data tidak ditemukan</p>
        </div>
      </div>
    )
  }

  const groupedAnswers = groupAnswersByCategory()
  const stats = getStats()
  const ngItems = getNGItems()

  return (
    <div className="bg-white p-4 print:p-2">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-4 print:mb-2">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => navigate('/app/production/pre-shift-checklist')}
            className="p-1.5 hover:bg-gray-100 rounded-lg print:hidden"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <ClipboardDocumentCheckIcon className="w-6 h-6 text-blue-600" />
          <h1 className="text-lg font-bold text-gray-900">Pre-Shift Checklist</h1>
        </div>
        <div className="flex items-center space-x-2 print:hidden">
          <button onClick={() => window.print()} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Print">
            <PrinterIcon className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={() => navigate(`/app/production/pre-shift-checklist/form?machine=${submission.machine_id}&date=${submission.tanggal}&shift=${submission.shift}`)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            <PencilSquareIcon className="w-4 h-4" />
            <span>Edit</span>
          </button>
        </div>
      </div>

      {/* Info Bar - Single Row */}
      <div className={`rounded-lg p-3 mb-4 print:mb-2 border ${shiftConfig.bg} ${shiftConfig.border}`}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center space-x-2">
            <CogIcon className="w-4 h-4 text-gray-600" />
            <span className="font-semibold">{submission.machine_name}</span>
          </div>
          <div className="flex items-center space-x-2">
            <CalendarIcon className="w-4 h-4 text-gray-600" />
            <span>{new Date(submission.tanggal).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
          <div className="flex items-center space-x-2">
            <ClockIcon className={`w-4 h-4 ${shiftConfig.color}`} />
            <span className={`font-semibold ${shiftConfig.color}`}>{shiftConfig.name} ({shiftConfig.time})</span>
          </div>
          <div className="flex items-center space-x-2">
            <UserIcon className="w-4 h-4 text-gray-600" />
            <span>{submission.operator_name || '-'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircleSolid className="w-4 h-4 text-green-600" />
            <span className="text-gray-600">
              {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex items-center justify-center gap-6 mb-4 print:mb-2 py-2 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-2">
          <CheckCircleSolid className="w-6 h-6 text-green-600" />
          <span className="text-xl font-bold text-green-600">{stats.ok}</span>
          <span className="text-sm text-gray-500">OK</span>
        </div>
        <div className="w-px h-6 bg-gray-300"></div>
        <div className="flex items-center space-x-2">
          <XCircleSolid className="w-6 h-6 text-red-600" />
          <span className="text-xl font-bold text-red-600">{stats.ng}</span>
          <span className="text-sm text-gray-500">NG</span>
        </div>
        <div className="w-px h-6 bg-gray-300"></div>
        <div className="flex items-center space-x-2">
          <MinusCircleIcon className="w-6 h-6 text-gray-400" />
          <span className="text-xl font-bold text-gray-600">{stats.na}</span>
          <span className="text-sm text-gray-500">N/A</span>
        </div>
        <div className="w-px h-6 bg-gray-300"></div>
        <div className="flex items-center space-x-2">
          <DocumentCheckIcon className="w-6 h-6 text-blue-600" />
          <span className="text-xl font-bold text-blue-600">{stats.total}</span>
          <span className="text-sm text-gray-500">Total</span>
        </div>
      </div>

      {/* NG Items Alert - Only show if there are NG items */}
      {ngItems.length > 0 && (
        <div className="mb-4 print:mb-2 p-3 bg-red-50 border border-red-200 rounded-lg print:hidden">
          <div className="flex items-start space-x-2">
            <XCircleSolid className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-red-700 text-sm mb-2">Item NG - Perlu Tindakan (Klik untuk tambah keterangan):</p>
              <div className="space-y-2">
                {ngItems.map((item: any, i: number) => {
                  const ca = item.corrective_action;
                  const statusLabel = ca ? (
                    ca.repair_status === 'completed' ? '✅ Selesai' :
                    ca.repair_status === 'in_progress' ? '🔧 Dikerjakan' :
                    ca.repair_status === 'cannot_repair' ? '❌ Tidak bisa' :
                    ca.repair_status === 'deferred' ? '⏳ Ditunda' : '⏳ Menunggu'
                  ) : '⏳ Menunggu';
                  
                  const isEditing = editingNgItem === item.id;
                  const priorityBadge = ca?.priority ? getPriorityBadge(ca.priority) : null;
                  
                  return (
                    <div key={i} className="bg-white rounded-lg border border-red-200 p-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 flex-1">
                          <span className="text-red-600 font-medium text-sm">
                            {item.item?.item_name}
                          </span>
                          {item.catatan && (
                            <span className="text-gray-500 text-xs">({item.catatan})</span>
                          )}
                          {priorityBadge && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${priorityBadge.color}`}>
                              {priorityBadge.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                            ca?.repair_status === 'completed' ? 'bg-green-100 text-green-700' :
                            ca?.repair_status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                            ca?.repair_status === 'cannot_repair' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {statusLabel}
                          </span>
                          {!isEditing && (
                            <button
                              onClick={() => handleEditNgItem(item)}
                              className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                            >
                              <ChatBubbleLeftEllipsisIcon className="w-4 h-4 inline mr-1" />
                              Tambah Keterangan
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Supervisor Note Display */}
                      {ca?.supervisor_note && !isEditing && (
                        <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200">
                          <div className="flex items-start space-x-2">
                            <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 mt-0.5" />
                            <div className="text-xs">
                              <span className="font-medium text-amber-800">Catatan Supervisor:</span>
                              <span className="text-amber-700 ml-1">{ca.supervisor_note}</span>
                              {ca.supervisor_name && (
                                <span className="text-gray-500 ml-1">- {ca.supervisor_name}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Edit Form */}
                      {isEditing && (
                        <div className="mt-2 p-2 bg-gray-50 rounded border">
                          <div className="space-y-2">
                            <div>
                              <label className="text-xs font-medium text-gray-700">Prioritas:</label>
                              <div className="flex space-x-1 mt-1">
                                {PRIORITY_OPTIONS.map(opt => (
                                  <button
                                    key={opt.value}
                                    onClick={() => setPriority(opt.value)}
                                    className={`text-xs px-2 py-1 rounded ${
                                      priority === opt.value ? opt.color : 'bg-gray-200 text-gray-600'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-700">Keterangan untuk Maintenance:</label>
                              <textarea
                                value={supervisorNote}
                                onChange={(e) => setSupervisorNote(e.target.value)}
                                placeholder="Contoh: Harus segera diperbaiki sebelum shift berikutnya..."
                                className="w-full mt-1 px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-blue-500"
                                rows={2}
                              />
                            </div>
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => setEditingNgItem(null)}
                                className="text-xs px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                              >
                                Batal
                              </button>
                              <button
                                onClick={() => handleSaveSupervisorNote(item.id)}
                                disabled={isSaving}
                                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                              >
                                {isSaving ? 'Menyimpan...' : 'Simpan'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Maintenance Repair Notes */}
              {ngItems.some((item: any) => item.corrective_action?.repair_notes) && (
                <div className="mt-3 pt-2 border-t border-red-200">
                  <p className="text-xs font-medium text-red-700 mb-1">Catatan Perbaikan dari Maintenance:</p>
                  {ngItems.filter((item: any) => item.corrective_action?.repair_notes).map((item: any, i: number) => (
                    <p key={i} className="text-xs text-gray-700">
                      <span className="font-medium">{item.item?.item_name}:</span> {item.corrective_action.repair_notes}
                      {item.corrective_action.handled_by_name && (
                        <span className="text-gray-500"> - oleh {item.corrective_action.handled_by_name}</span>
                      )}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compact Table Layout */}
      {Object.entries(groupedAnswers).map(([category, answers]) => (
        <div key={category} className="mb-3 print:mb-2">
          <div className="flex items-center space-x-2 mb-1">
            {category === 'KONDISI_MESIN' && <CogIcon className="w-4 h-4 text-blue-600" />}
            {category === 'MANPOWER' && <UserGroupIcon className="w-4 h-4 text-purple-600" />}
            <h3 className="text-sm font-bold text-gray-800">{getCategoryLabel(category)}</h3>
            <span className="text-xs text-gray-500">({answers.length} item)</span>
          </div>
          
          {/* Grid Layout - 2 columns for compact view */}
          <div className="grid grid-cols-2 gap-1 text-xs">
            {answers.map((answer: any, index: number) => {
              const isNG = answer.status === 'NG'
              const isNA = answer.status === 'NA'
              
              return (
                <div 
                  key={answer.id}
                  className={`flex items-center justify-between p-1.5 rounded border ${
                    isNG ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <span className={`w-5 h-5 flex-shrink-0 rounded flex items-center justify-center text-xs font-bold ${
                      isNG ? 'bg-red-200 text-red-700' : isNA ? 'bg-gray-200 text-gray-600' : 'bg-green-200 text-green-700'
                    }`}>
                      {index + 1}
                    </span>
                    <span className={`truncate ${isNG ? 'text-red-700 font-medium' : 'text-gray-700'}`}>
                      {answer.item?.item_name}
                    </span>
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    {answer.status === 'OK' && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-600 text-white text-xs font-bold">OK</span>
                    )}
                    {answer.status === 'NG' && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-600 text-white text-xs font-bold">NG</span>
                    )}
                    {answer.status === 'NA' && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-500 text-white text-xs font-bold">N/A</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Notes */}
      {submission.notes && (
        <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <span className="font-semibold text-amber-800">Catatan: </span>
          <span className="text-amber-700">{submission.notes}</span>
        </div>
      )}

      {/* Footer - Print Info */}
      <div className="mt-4 pt-2 border-t border-gray-200 text-xs text-gray-400 print:block hidden">
        Dicetak: {new Date().toLocaleString('id-ID')}
      </div>
    </div>
  )
}

export default PreShiftChecklistView
