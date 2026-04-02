import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftIcon,
  CubeIcon
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid'
import { 
  useGetMachineChecklistItemsQuery,
  useSubmitPreShiftChecklistMutation,
  useGetProductsQuery
} from '../../services/api'
import SearchableSelect from '../../components/SearchableSelect'

interface ChecklistItem {
  id: number
  category: string
  item_code: string
  item_name: string
  description?: string
  sort_order: number
  is_applicable: boolean
}

interface AnswerState {
  [itemId: number]: {
    status: 'OK' | 'NG' | 'NA'
    catatan: string
  }
}

const SHIFT_CONFIG: { [key: string]: { name: string; time: string; color: string; bg: string; border: string } } = {
  '1': { name: 'Shift 1', time: '07:00 - 15:00', color: 'text-blue-700', bg: 'bg-blue-100', border: 'border-blue-300' },
  '2': { name: 'Shift 2', time: '15:00 - 23:00', color: 'text-purple-700', bg: 'bg-purple-100', border: 'border-purple-300' },
  '3': { name: 'Shift 3', time: '23:00 - 07:00', color: 'text-indigo-700', bg: 'bg-indigo-100', border: 'border-indigo-300' },
}

const PreShiftChecklistForm = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const machineId = searchParams.get('machine')
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const shiftParam = searchParams.get('shift') || '1'
  
  const [operatorName, setOperatorName] = useState('')
  const [productId, setProductId] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [answers, setAnswers] = useState<AnswerState>({})
  const [activeTab, setActiveTab] = useState<'KONDISI_MESIN' | 'MANPOWER'>('KONDISI_MESIN')
  
  const { data, isLoading } = useGetMachineChecklistItemsQuery(Number(machineId), {
    skip: !machineId
  })
  
  const { data: productsData } = useGetProductsQuery({})
  
  const [submitChecklist, { isLoading: isSubmitting }] = useSubmitPreShiftChecklistMutation()
  
  // Transform products for SearchableSelect
  const productOptions = productsData?.products?.map((p: any) => ({
    id: p.id,
    code: p.code,
    name: p.name
  })) || []

  useEffect(() => {
    if (data?.items) {
      const initialAnswers: AnswerState = {}
      data.items.forEach((item: ChecklistItem) => {
        if (item.is_applicable) {
          initialAnswers[item.id] = { status: 'OK', catatan: '' }
        }
      })
      setAnswers(initialAnswers)
    }
  }, [data])

  const shiftConfig = SHIFT_CONFIG[shiftParam] || SHIFT_CONFIG['1']

  const handleAnswerChange = (itemId: number, status: 'OK' | 'NG' | 'NA') => {
    setAnswers(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], status }
    }))
  }

  const handleCatatanChange = (itemId: number, catatan: string) => {
    setAnswers(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], catatan }
    }))
  }

  const handleSubmit = async () => {
    if (!operatorName.trim()) {
      alert('Nama operator harus diisi')
      return
    }

    const answersArray = Object.entries(answers).map(([itemId, answer]) => ({
      item_id: Number(itemId),
      status: answer.status,
      catatan: answer.catatan || null
    }))

    try {
      await submitChecklist({
        machine_id: Number(machineId),
        product_id: productId,
        tanggal: dateParam,
        shift: Number(shiftParam),
        operator_name: operatorName,
        notes,
        answers: answersArray
      }).unwrap()
      
      navigate('/app/production/pre-shift-checklist')
    } catch (error) {
      console.error('Error submitting checklist:', error)
      alert('Gagal menyimpan checklist')
    }
  }

  const filterItemsByCategory = (category: string) => {
    return data?.items?.filter((item: ChecklistItem) => 
      item.category === category && item.is_applicable
    ) || []
  }

  const kondisiMesinItems = filterItemsByCategory('KONDISI_MESIN')
  const manpowerItems = filterItemsByCategory('MANPOWER')

  const getProgress = () => {
    const totalItems = kondisiMesinItems.length + manpowerItems.length
    const answeredItems = Object.keys(answers).length
    return totalItems > 0 ? Math.round((answeredItems / totalItems) * 100) : 0
  }

  const getNGCount = () => {
    return Object.values(answers).filter(a => a.status === 'NG').length
  }

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
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => navigate('/app/production/pre-shift-checklist')}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  <ArrowLeftIcon className="w-5 h-5 text-white" />
                </button>
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <ClipboardDocumentCheckIcon className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Form Pre-Shift Checklist</h1>
                  <p className="text-blue-100 text-sm mt-1">Isi checklist sebelum memulai produksi</p>
                </div>
              </div>
              
              {/* Progress Indicator */}
              <div className="text-right">
                <div className="text-white/80 text-sm">Progress</div>
                <div className="text-3xl font-bold text-white">{getProgress()}%</div>
              </div>
            </div>
          </div>
          
          {/* Info Grid */}
          <div className="p-6 bg-gray-50 border-b border-gray-100">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* Machine */}
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <CogIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Mesin</p>
                    <p className="text-sm font-bold text-gray-900">{data?.machine?.name}</p>
                    <p className="text-xs text-gray-500">{data?.machine?.code}</p>
                  </div>
                </div>
              </div>
              
              {/* Date */}
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CalendarIcon className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Tanggal</p>
                    <p className="text-sm font-bold text-gray-900">
                      {new Date(dateParam).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(dateParam).toLocaleDateString('id-ID', { weekday: 'long' })}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Shift */}
              <div className={`rounded-xl p-4 border shadow-sm ${shiftConfig.bg} ${shiftConfig.border}`}>
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${shiftConfig.bg}`}>
                    <ClockIcon className={`w-5 h-5 ${shiftConfig.color}`} />
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${shiftConfig.color}`}>Shift</p>
                    <p className={`text-sm font-bold ${shiftConfig.color}`}>{shiftConfig.name}</p>
                    <p className="text-xs text-gray-600">{shiftConfig.time}</p>
                  </div>
                </div>
              </div>
              
              {/* Operator Input */}
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <UserIcon className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 font-medium mb-1">Nama Operator *</p>
                    <input
                      type="text"
                      value={operatorName}
                      onChange={(e) => setOperatorName(e.target.value)}
                      placeholder="Masukkan nama"
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
              
              {/* Product Select */}
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm md:col-span-2">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <CubeIcon className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 font-medium mb-1">Nama Produk</p>
                    <SearchableSelect
                      options={productOptions}
                      value={productId}
                      onChange={(val) => setProductId(val as number | null)}
                      placeholder="Pilih produk..."
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('KONDISI_MESIN')}
              className={`flex-1 flex items-center justify-center space-x-2 py-4 px-6 font-medium transition-colors ${
                activeTab === 'KONDISI_MESIN'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <CogIcon className="w-5 h-5" />
              <span>Kondisi Mesin</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'KONDISI_MESIN' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {kondisiMesinItems.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('MANPOWER')}
              className={`flex-1 flex items-center justify-center space-x-2 py-4 px-6 font-medium transition-colors ${
                activeTab === 'MANPOWER'
                  ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <UserGroupIcon className="w-5 h-5" />
              <span>Man Power</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'MANPOWER' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {manpowerItems.length}
              </span>
            </button>
          </div>
          
          {/* Checklist Items */}
          <div className="divide-y divide-gray-100">
            {(activeTab === 'KONDISI_MESIN' ? kondisiMesinItems : manpowerItems).map((item: ChecklistItem, index: number) => {
              const currentStatus = answers[item.id]?.status || 'OK'
              const isNG = currentStatus === 'NG'
              
              return (
                <div 
                  key={item.id} 
                  className={`p-4 transition-colors ${isNG ? 'bg-red-50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Number */}
                    <div className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center font-bold text-sm ${
                      activeTab === 'KONDISI_MESIN' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {index + 1}
                    </div>
                    
                    {/* Item Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">{item.item_name}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">{item.item_code}</p>
                        </div>
                        
                        {/* Status Buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAnswerChange(item.id, 'OK')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                              currentStatus === 'OK'
                                ? 'bg-green-600 text-white shadow-md scale-105'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            <CheckCircleIcon className="w-4 h-4" />
                            OK
                          </button>
                          <button
                            onClick={() => handleAnswerChange(item.id, 'NG')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                              currentStatus === 'NG'
                                ? 'bg-red-600 text-white shadow-md scale-105'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                          >
                            <XCircleIcon className="w-4 h-4" />
                            NG
                          </button>
                          <button
                            onClick={() => handleAnswerChange(item.id, 'NA')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                              currentStatus === 'NA'
                                ? 'bg-gray-600 text-white shadow-md scale-105'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <MinusCircleIcon className="w-4 h-4" />
                            N/A
                          </button>
                        </div>
                      </div>
                      
                      {/* Catatan Input - Show always but highlight if NG */}
                      <div className="mt-3">
                        <div className="relative">
                          <ChatBubbleLeftIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={answers[item.id]?.catatan || ''}
                            onChange={(e) => handleCatatanChange(item.id, e.target.value)}
                            placeholder={isNG ? "Catatan wajib diisi untuk item NG" : "Catatan (opsional)"}
                            className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm border transition-colors ${
                              isNG 
                                ? 'border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500' 
                                : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Notes & Submit */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6">
            <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
              <DocumentCheckIcon className="w-5 h-5 text-gray-500" />
              <span>Catatan Umum</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan untuk checklist ini... (opsional)"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>
          
          {/* Warning if NG exists */}
          {getNGCount() > 0 && (
            <div className="mx-6 mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start space-x-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Perhatian: {getNGCount()} item berstatus NG</p>
                  <p className="text-xs text-amber-700 mt-1">Pastikan sudah mengisi catatan untuk setiap item yang NG.</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Submit Actions */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                <span className="font-medium text-gray-700">{kondisiMesinItems.length + manpowerItems.length}</span> item checklist
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => navigate('/app/production/pre-shift-checklist')}
                  className="px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !operatorName.trim()}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-lg shadow-blue-500/30 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircleSolid className="w-5 h-5" />
                      <span>Submit Checklist</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PreShiftChecklistForm
