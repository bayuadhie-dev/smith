import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import axiosInstance from '../../utils/axiosConfig'
import { toast } from 'react-hot-toast'
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  ClockIcon,
  CogIcon
} from '@heroicons/react/24/outline'

/* ═══════════ Types ═══════════ */
interface Machine { id: number; code: string; name: string; machine_type: string }
interface SlittingRow { no_roll: string; width: number; weight: number; length: number; thick: number; slitting: number[]; loss: number; total_length: number; total_weight: number }
interface PerforatingRow { no_roll: string; width: number; weight: number; length: number; repeat_length: number; repeat_width: number }
interface FoldingRow { no_roll: string; no_slitting: string; weight: number; length: number }
interface CuttingRow { no_roll: string; width: number; weight: number; length: number; repeat_length: number; repeat_width: number }
interface LaminasiRow { no: number; time_start: string; time_end: string; total_minutes: number; date: string; product_name: string; film_type: string; film_gsm: number; nonwoven_type: string; nonwoven_gsm: number; winding_width: number; winding_length: number; gsm_total: number; speed: number; lem_type: string; lem_usage: number }
interface BagmakerRow { no: number; plan_downtime: string; unplan_downtime: string; total_minutes: number; no_roll: string; roll_weight: number; roll_length: number; output_grade_a: number; output_grade_c: number }
interface AxisSettings { initial_torque: number; setting_tension: number; actual_tension: number; actual_torque: number; actual_diameter: number; initial_diameter: number; rate_coating: number; rewind_angle: number }

interface DowntimeEntry {
  id: number;
  reason: string;
  duration_minutes: number;
  frequency: number;
  category: string;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  idle: ['tunggu', 'listrik', 'mati lampu', 'padam', 'menunggu'],
  operator: ['operator', 'makan', 'toilet', 'istirahat', 'sholat', 'sakit', 'izin', 'absent', 'ganti shift'],
  material: ['kain', 'benang', 'habis', 'lem', 'stiker', 'baku', 'roll', 'bahan'],
  design: ['changeover', 'ganti produk', 'ganti ukuran', 'ganti pola', 'trial', 'sample'],
  mesin: ['setting', 'rusak', 'error', 'trouble', 'macet', 'sparepart', 'pisau', 'sensor', 'suhu', 'seal', 'inkjet', 'belt', 'rantai', 'motor']
};

const DOWNTIME_CATEGORIES = {
  mesin: { label: 'Mesin', color: 'red', bgColor: 'bg-red-50', borderColor: 'border-red-300', textColor: 'text-red-700' },
  operator: { label: 'Operator', color: 'orange', bgColor: 'bg-orange-50', borderColor: 'border-orange-300', textColor: 'text-orange-700' },
  material: { label: 'Raw Material', color: 'yellow', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-300', textColor: 'text-yellow-700' },
  design: { label: 'Design Change', color: 'blue', bgColor: 'bg-blue-50', borderColor: 'border-blue-300', textColor: 'text-blue-700' },
  idle: { label: 'Idle Time', color: 'orange', bgColor: 'bg-orange-50', borderColor: 'border-orange-300', textColor: 'text-orange-700' },
  others: { label: 'Others', color: 'gray', bgColor: 'bg-gray-50', borderColor: 'border-gray-200', textColor: 'text-gray-600' }
};

const detectCategory = (reason: string, isFirstEntry: boolean = false): string => {
  const lowerReason = reason.toLowerCase();
  
  if (lowerReason.includes('setting mc') || lowerReason.includes('setting mesin')) {
    return isFirstEntry ? 'design' : 'mesin';
  }

  const categoryOrder = ['idle', 'operator', 'material', 'mesin', 'design'];
  for (const category of categoryOrder) {
    const keywords = CATEGORY_KEYWORDS[category];
    for (const keyword of keywords) {
      if (lowerReason.includes(keyword)) {
        return category;
      }
    }
  }
  return 'others';
};

const getDowntimeBgClass = (reason: string, defaultClass: string = '') => {
  if (!reason || !reason.trim()) return defaultClass;
  const cat = detectCategory(reason, false);
  const catColors: Record<string, string> = {
    mesin: 'bg-red-50 text-red-900 border-red-300 focus:ring-red-500 focus:border-red-500',
    operator: 'bg-orange-50 text-orange-900 border-orange-300 focus:ring-orange-500 focus:border-orange-500',
    material: 'bg-blue-50 text-blue-900 border-blue-300 focus:ring-blue-500 focus:border-blue-500',
    design: 'bg-purple-50 text-purple-900 border-purple-300 focus:ring-purple-500 focus:border-purple-500',
    idle: 'bg-yellow-50 text-yellow-900 border-yellow-300 focus:ring-yellow-500 focus:border-yellow-500',
    others: 'bg-gray-50 text-gray-900 border-gray-200 focus:ring-gray-500 focus:border-gray-500'
  };
  return catColors[cat] || defaultClass;
};

/* ═══════════ Helpers ═══════════ */
const mkSlit = (): SlittingRow => ({ no_roll: '', width: 0, weight: 0, length: 0, thick: 0, slitting: Array(10).fill(0), loss: 0, total_length: 0, total_weight: 0 })
const mkPerf = (): PerforatingRow => ({ no_roll: '', width: 0, weight: 0, length: 0, repeat_length: 0, repeat_width: 0 })
const mkFold = (): FoldingRow => ({ no_roll: '', no_slitting: '', weight: 0, length: 0 })
const mkCut = (): CuttingRow => ({ no_roll: '', width: 0, weight: 0, length: 0, repeat_length: 0, repeat_width: 0 })
const mkLam = (n: number): LaminasiRow => ({ no: n, time_start: '', time_end: '', total_minutes: 0, date: new Date().toISOString().split('T')[0], product_name: '', film_type: '', film_gsm: 0, nonwoven_type: '', nonwoven_gsm: 0, winding_width: 0, winding_length: 0, gsm_total: 0, speed: 0, lem_type: '', lem_usage: 0 })
const mkBag = (n: number): BagmakerRow => ({ no: n, plan_downtime: '', unplan_downtime: '', total_minutes: 0, no_roll: '', roll_weight: 0, roll_length: 0, output_grade_a: 0, output_grade_c: 0 })
const mkAxis = (): AxisSettings => ({ initial_torque: 0, setting_tension: 0, actual_tension: 0, actual_torque: 0, actual_diameter: 0, initial_diameter: 0, rate_coating: 0, rewind_angle: 0 })

const ic = 'w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none'
const lc = 'block text-sm font-medium text-slate-700 mb-1'
const sc = 'bg-white rounded-xl shadow-sm p-5 mb-4'
const N = (v: any) => parseFloat(v) || 0
const thc = 'px-2 py-2 text-xs font-semibold text-slate-600 bg-slate-50 border-b whitespace-nowrap'
const tdc = 'px-1 py-1 border-b border-slate-100'

const typeLabels: Record<string, string> = { perforating: 'Perforating', slitting: 'Slitting', laminasi: 'Laminasi Kain', bagmaker: 'Bagmaker', folding: 'Folding', cutting: 'Cutting' }

/* ═══════════ Component ═══════════ */
export default function ConvertingInput() {
  const navigate = useNavigate()
  const [machines, setMachines] = useState<Machine[]>([])
  const [machineId, setMachineId] = useState<number | ''>('')
  const [submitting, setSubmitting] = useState(false)

  const [productionDate, setProductionDate] = useState(new Date().toISOString().split('T')[0])
  const [shift, setShift] = useState(1)
  const [njo, setNjo] = useState('')
  const [productName, setProductName] = useState('')
  const [specification, setSpecification] = useState('')
  const [operatorName, setOperatorName] = useState('')
  const [notes, setNotes] = useState('')
  const [gradeA, setGradeA] = useState(0)
  const [gradeB, setGradeB] = useState(0)
  const [lossKg, setLossKg] = useState(0)

  const [slitRows, setSlitRows] = useState<SlittingRow[]>([mkSlit()])
  const [perfRows, setPerfRows] = useState<PerforatingRow[]>([mkPerf()])
  const [foldRows, setFoldRows] = useState<FoldingRow[]>([mkFold()])
  const [cutRows, setCutRows] = useState<CuttingRow[]>([mkCut()])
  const [filmAxis, setFilmAxis] = useState<AxisSettings>(mkAxis())
  const [nwAxis, setNwAxis] = useState<AxisSettings>(mkAxis())
  const [lamRows, setLamRows] = useState<LaminasiRow[]>([mkLam(1)])
  const [prodHourMin, setProdHourMin] = useState(0)
  const [downtimeMin, setDowntimeMin] = useState(0)
  const [machineSpeed, setMachineSpeed] = useState(0)
  const [bagRows, setBagRows] = useState<BagmakerRow[]>([mkBag(1)])
  const [downtimeEntries, setDowntimeEntries] = useState<DowntimeEntry[]>([])

  const machine = machines.find(m => m.id === machineId)
  const mtype = machine?.machine_type || ''

  const machinesByType = useMemo(() => {
    const g: Record<string, Machine[]> = {}
    machines.forEach(m => { if (!g[m.machine_type]) g[m.machine_type] = []; g[m.machine_type].push(m) })
    return g
  }, [machines])

  useEffect(() => {
    axiosInstance.get('/api/converting/machines').then(r => setMachines(r.data.machines || [])).catch(() => toast.error('Gagal memuat daftar mesin'))
  }, [])

  const addDowntimeEntry = () => {
    setDowntimeEntries(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        reason: '',
        duration_minutes: 0,
        frequency: 1,
        category: 'others'
      }
    ]);
  };

  const removeDowntimeEntry = (id: number) => {
    setDowntimeEntries(prev => prev.filter(e => e.id !== id));
  };

  const updateDowntimeEntry = (id: number, field: keyof DowntimeEntry, value: any) => {
    setDowntimeEntries(prev => prev.map((entry, index) => {
      if (entry.id !== id) return entry;
      const updated = { ...entry, [field]: value };
      if (field === 'reason') {
        updated.category = detectCategory(value, index === 0);
      }
      return updated;
    }));
  };

  /* ─── Submit ─── */
  const handleSubmit = async () => {
    if (!machineId) { toast.error('Pilih mesin terlebih dahulu'); return }
    if (!productionDate) { toast.error('Tanggal wajib diisi'); return }
    setSubmitting(true)
    try {
      const totalDowntime = downtimeEntries.reduce((sum, e) => sum + (N(e.duration_minutes) * N(e.frequency)), 0)
      
      let machine_data: any = {}
      let fA = gradeA, fB = gradeB, fL = lossKg
      if (mtype === 'slitting') { machine_data = { rows: slitRows }; fA = 0; fB = 0; fL = 0 }
      else if (mtype === 'perforating') { machine_data = { rows: perfRows } }
      else if (mtype === 'folding') { machine_data = { rows: foldRows } }
      else if (mtype === 'cutting') { machine_data = { rows: cutRows } }
      else if (mtype === 'laminasi') { machine_data = { film_axis: filmAxis, nonwoven_axis: nwAxis, rows: lamRows }; fA = 0; fB = 0; fL = 0 }
      else if (mtype === 'bagmaker') {
        const tA = bagRows.reduce((s, r) => s + N(r.output_grade_a), 0)
        const tC = bagRows.reduce((s, r) => s + N(r.output_grade_c), 0)
        
        // Extract downtime entries from rows
        const extractedEntries: any[] = []
        bagRows.forEach(row => {
          const rowMinutes = N(row.total_minutes)
          if (rowMinutes > 0) {
            const reason = (row.plan_downtime || row.unplan_downtime || '').trim()
            if (reason) {
              extractedEntries.push({
                reason: reason,
                duration_minutes: rowMinutes,
                frequency: 1,
                category: detectCategory(reason, false)
              })
            }
          }
        })
        const totalDowntime = extractedEntries.reduce((s, e) => s + e.duration_minutes, 0)

        machine_data = { 
          production_hour_minutes: prodHourMin, 
          machine_speed: machineSpeed, 
          rows: bagRows, 
          total_grade_a: tA, 
          total_grade_c: tC,
          downtime_minutes: totalDowntime,
          downtime_entries: extractedEntries
        }
        fA = tA; fB = tC; fL = 0
      }
      
      // Inject downtime details for other machine types
      if (mtype !== 'bagmaker') {
        machine_data.downtime_minutes = totalDowntime || downtimeMin
        machine_data.downtime_entries = downtimeEntries.map(e => ({
          reason: e.reason,
          duration_minutes: N(e.duration_minutes),
          frequency: N(e.frequency),
          category: e.category
        }))
      }
      
      await axiosInstance.post('/api/converting/production', { 
        production_date: productionDate, 
        shift, 
        machine_id: machineId, 
        njo, 
        product_name: productName, 
        specification, 
        grade_a: fA, 
        grade_b: fB, 
        loss_kg: fL, 
        operator_name: operatorName, 
        notes, 
        machine_data 
      })
      toast.success('Data produksi berhasil disimpan')
      navigate('/app/production/converting')
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Gagal menyimpan') } finally { setSubmitting(false) }
  }

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="min-h-screen bg-slate-100 p-6">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/app/production/converting')} className="p-2 hover:bg-white dark:hover:bg-gray-700 dark:bg-gray-800 rounded-lg"><ArrowLeftIcon className="h-5 w-5" /></button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Input Produksi Converting</h1>
          {machine && <p className="text-sm text-slate-500">{machine.name} ({machine.code})</p>}
        </div>
      </div>

      {/* Common header */}
      <div className={sc}>
        <h3 className="font-semibold text-slate-800 mb-4">Informasi Umum</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className={lc}>Mesin <span className="text-red-500">*</span></label>
            <select value={machineId} onChange={e => setMachineId(e.target.value ? Number(e.target.value) : '')} className={ic}>
              <option value="">-- Pilih Mesin --</option>
              {Object.entries(machinesByType).map(([t, ms]) => (
                <optgroup key={t} label={typeLabels[t] || t}>{ms.map(m => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}</optgroup>
              ))}
            </select>
          </div>
          <div><label className={lc}>Tanggal <span className="text-red-500">*</span></label><input type="date" value={productionDate} onChange={e => setProductionDate(e.target.value)} className={ic} /></div>
          <div><label className={lc}>Shift <span className="text-red-500">*</span></label><select value={shift} onChange={e => setShift(Number(e.target.value))} className={ic}><option value={1}>Shift 1</option><option value={2}>Shift 2</option><option value={3}>Shift 3</option></select></div>
          <div><label className={lc}>NJO</label><input value={njo} onChange={e => setNjo(e.target.value)} className={ic} placeholder="No. Job Order" /></div>
          <div><label className={lc}>Nama Produk</label><input value={productName} onChange={e => setProductName(e.target.value)} className={ic} placeholder="Nama produk" /></div>
          <div><label className={lc}>Spesifikasi</label><input value={specification} onChange={e => setSpecification(e.target.value)} className={ic} placeholder="Spesifikasi" /></div>
          <div><label className={lc}>Operator</label><input value={operatorName} onChange={e => setOperatorName(e.target.value)} className={ic} placeholder="Nama operator" /></div>
          <div><label className={lc}>Catatan</label><input value={notes} onChange={e => setNotes(e.target.value)} className={ic} placeholder="Catatan" /></div>
        </div>
      </div>

      {/* PLACEHOLDER: machine-specific forms will be inserted here */}
      {mtype === 'slitting' && (
        <div className={sc}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Data Slitting</h3>
            <button type="button" onClick={() => setSlitRows(r => [...r, mkSlit()])} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><PlusIcon className="h-4 w-4" /> Baris</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className={thc}>#</th>
                  <th className={thc}>No Roll</th>
                  <th className={thc}>Width (cm)</th>
                  <th className={thc}>Weight (kg)</th>
                  <th className={thc}>Length (m)</th>
                  <th className={thc}>Thick (mm)</th>
                  {[1,2,3,4,5,6,7,8,9,10].map(i => <th key={i} className={thc}>S{i} (kg)</th>)}
                  <th className={thc}>Loss (kg)</th>
                  <th className={thc}>Tot Length (m)</th>
                  <th className={thc}>Tot Weight (kg)</th>
                  <th className={thc}></th>
                </tr>
              </thead>
              <tbody>
                {slitRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className={`${tdc} text-center text-xs text-slate-400`}>{idx + 1}</td>
                    <td className={tdc}><input value={row.no_roll} onChange={e => setSlitRows(rs => rs.map((r, i) => i === idx ? { ...r, no_roll: e.target.value } : r))} className={`${ic} w-20`} /></td>
                    <td className={tdc}><input type="number" step="0.01" value={row.width || ''} onChange={e => setSlitRows(rs => rs.map((r, i) => i === idx ? { ...r, width: N(e.target.value) } : r))} className={`${ic} w-16`} /></td>
                    <td className={tdc}><input type="number" step="0.01" value={row.weight || ''} onChange={e => setSlitRows(rs => rs.map((r, i) => i === idx ? { ...r, weight: N(e.target.value) } : r))} className={`${ic} w-16`} /></td>
                    <td className={tdc}><input type="number" step="0.01" value={row.length || ''} onChange={e => setSlitRows(rs => rs.map((r, i) => i === idx ? { ...r, length: N(e.target.value) } : r))} className={`${ic} w-16`} /></td>
                    <td className={tdc}><input type="number" step="0.01" value={row.thick || ''} onChange={e => setSlitRows(rs => rs.map((r, i) => i === idx ? { ...r, thick: N(e.target.value) } : r))} className={`${ic} w-16`} /></td>
                    {row.slitting.map((sv, si) => (
                      <td key={si} className={tdc}>
                        <input type="number" step="0.01" value={sv || ''} onChange={e => setSlitRows(rs => rs.map((r, i) => { if (i !== idx) return r; const s = [...r.slitting]; s[si] = N(e.target.value); return { ...r, slitting: s } }))} className={`${ic} w-14`} />
                      </td>
                    ))}
                    <td className={tdc}><input type="number" step="0.01" value={row.loss || ''} onChange={e => setSlitRows(rs => rs.map((r, i) => i === idx ? { ...r, loss: N(e.target.value) } : r))} className={`${ic} w-16`} /></td>
                    <td className={tdc}><input type="number" step="0.01" value={row.total_length || ''} onChange={e => setSlitRows(rs => rs.map((r, i) => i === idx ? { ...r, total_length: N(e.target.value) } : r))} className={`${ic} w-16`} /></td>
                    <td className={tdc}><input type="number" step="0.01" value={row.total_weight || ''} onChange={e => setSlitRows(rs => rs.map((r, i) => i === idx ? { ...r, total_weight: N(e.target.value) } : r))} className={`${ic} w-16`} /></td>
                    <td className={tdc}>
                      {slitRows.length > 1 && <button onClick={() => setSlitRows(rs => rs.filter((_, i) => i !== idx))} className="p-1 text-red-400 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {mtype === 'perforating' && (<>
        <div className={sc}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Data Perforating</h3>
            <button type="button" onClick={() => setPerfRows(r => [...r, mkPerf()])} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><PlusIcon className="h-4 w-4" /> Baris</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className={thc}>#</th>
                  <th className={thc}>No Roll</th>
                  <th className={thc}>Width (cm)</th>
                  <th className={thc}>Weight (kg)</th>
                  <th className={thc}>Length (m)</th>
                  <th className={`${thc} bg-amber-50`}>Repeat Length</th>
                  <th className={`${thc} bg-amber-50`}>Repeat Width</th>
                  <th className={thc}></th>
                </tr>
              </thead>
              <tbody>
                {perfRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className={`${tdc} text-center text-xs text-slate-400`}>{idx + 1}</td>
                    <td className={tdc}><input value={row.no_roll} onChange={e => setPerfRows(rs => rs.map((r, i) => i === idx ? { ...r, no_roll: e.target.value } : r))} className={`${ic} w-24`} /></td>
                    <td className={tdc}><input type="number" step="0.01" value={row.width || ''} onChange={e => setPerfRows(rs => rs.map((r, i) => i === idx ? { ...r, width: N(e.target.value) } : r))} className={`${ic} w-20`} /></td>
                    <td className={tdc}><input type="number" step="0.01" value={row.weight || ''} onChange={e => setPerfRows(rs => rs.map((r, i) => i === idx ? { ...r, weight: N(e.target.value) } : r))} className={`${ic} w-20`} /></td>
                    <td className={tdc}><input type="number" step="0.01" value={row.length || ''} onChange={e => setPerfRows(rs => rs.map((r, i) => i === idx ? { ...r, length: N(e.target.value) } : r))} className={`${ic} w-20`} /></td>
                    <td className={`${tdc} bg-amber-50/30`}><input type="number" step="0.01" value={row.repeat_length || ''} onChange={e => setPerfRows(rs => rs.map((r, i) => i === idx ? { ...r, repeat_length: N(e.target.value) } : r))} className={`${ic} w-20`} /></td>
                    <td className={`${tdc} bg-amber-50/30`}><input type="number" step="0.01" value={row.repeat_width || ''} onChange={e => setPerfRows(rs => rs.map((r, i) => i === idx ? { ...r, repeat_width: N(e.target.value) } : r))} className={`${ic} w-20`} /></td>
                    <td className={tdc}>{perfRows.length > 1 && <button onClick={() => setPerfRows(rs => rs.filter((_, i) => i !== idx))} className="p-1 text-red-400 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className={sc}>
          <h3 className="font-semibold text-slate-800 mb-4">Production Result</h3>
          <div className="grid grid-cols-3 gap-4">
            <div><label className={lc}>Grade A (kg)</label><input type="number" step="0.01" value={gradeA || ''} onChange={e => setGradeA(N(e.target.value))} className={ic} /></div>
            <div><label className={lc}>Grade B (kg)</label><input type="number" step="0.01" value={gradeB || ''} onChange={e => setGradeB(N(e.target.value))} className={ic} /></div>
            <div><label className={lc}>Loss (kg)</label><input type="number" step="0.01" value={lossKg || ''} onChange={e => setLossKg(N(e.target.value))} className={ic} /></div>
          </div>
        </div>
      </>)}
      {mtype === 'folding' && (<>
        <div className={sc}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Data Folding — {machine?.name}</h3>
            <button type="button" onClick={() => setFoldRows(r => [...r, mkFold()])} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><PlusIcon className="h-4 w-4" /> Baris</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className={thc}>#</th>
                  <th className={thc}>No Roll</th>
                  <th className={thc}>No Slitting</th>
                  <th className={thc}>Weight (kg)</th>
                  <th className={thc}>Length (m)</th>
                  <th className={thc}></th>
                </tr>
              </thead>
              <tbody>
                {foldRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className={`${tdc} text-center text-xs text-slate-400`}>{idx + 1}</td>
                    <td className={tdc}><input value={row.no_roll} onChange={e => setFoldRows(rs => rs.map((r, i) => i === idx ? { ...r, no_roll: e.target.value } : r))} className={`${ic} w-24`} /></td>
                    <td className={tdc}><input value={row.no_slitting} onChange={e => setFoldRows(rs => rs.map((r, i) => i === idx ? { ...r, no_slitting: e.target.value } : r))} className={`${ic} w-24`} /></td>
                    <td className={tdc}><input type="number" step="0.01" value={row.weight || ''} onChange={e => setFoldRows(rs => rs.map((r, i) => i === idx ? { ...r, weight: N(e.target.value) } : r))} className={`${ic} w-24`} /></td>
                    <td className={tdc}><input type="number" step="0.01" value={row.length || ''} onChange={e => setFoldRows(rs => rs.map((r, i) => i === idx ? { ...r, length: N(e.target.value) } : r))} className={`${ic} w-24`} /></td>
                    <td className={tdc}>{foldRows.length > 1 && <button onClick={() => setFoldRows(rs => rs.filter((_, i) => i !== idx))} className="p-1 text-red-400 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className={sc}>
          <h3 className="font-semibold text-slate-800 mb-4">Production Result (pcs)</h3>
          <div className="grid grid-cols-3 gap-4">
            <div><label className={lc}>Grade A (pcs)</label><input type="number" step="1" value={gradeA || ''} onChange={e => setGradeA(N(e.target.value))} className={ic} /></div>
            <div><label className={lc}>Grade B (pcs)</label><input type="number" step="1" value={gradeB || ''} onChange={e => setGradeB(N(e.target.value))} className={ic} /></div>
            <div><label className={lc}>Loss (kg)</label><input type="number" step="0.01" value={lossKg || ''} onChange={e => setLossKg(N(e.target.value))} className={ic} /></div>
          </div>
        </div>
      </>)}
      {mtype === 'cutting' && (<>
        <div className={sc}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Data Cutting</h3>
            <button type="button" onClick={() => setCutRows(r => [...r, mkCut()])} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><PlusIcon className="h-4 w-4" /> Baris</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className={thc}>#</th>
                  <th className={thc}>No Roll</th>
                  <th className={thc}>Width (cm)</th>
                  <th className={thc}>Weight (kg)</th>
                  <th className={thc}>Length (m)</th>
                  <th className={`${thc} bg-amber-50`}>Repeat Length</th>
                  <th className={`${thc} bg-amber-50`}>Repeat Width</th>
                  <th className={thc}></th>
                </tr>
              </thead>
              <tbody>
                {cutRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className={`${tdc} text-center text-xs text-slate-400`}>{idx + 1}</td>
                    <td className={tdc}><input value={row.no_roll} onChange={e => setCutRows(rs => rs.map((r, i) => i === idx ? { ...r, no_roll: e.target.value } : r))} className={`${ic} w-24`} /></td>
                    <td className={tdc}><input type="number" step="0.01" value={row.width || ''} onChange={e => setCutRows(rs => rs.map((r, i) => i === idx ? { ...r, width: N(e.target.value) } : r))} className={`${ic} w-20`} /></td>
                    <td className={tdc}><input type="number" step="0.01" value={row.weight || ''} onChange={e => setCutRows(rs => rs.map((r, i) => i === idx ? { ...r, weight: N(e.target.value) } : r))} className={`${ic} w-20`} /></td>
                    <td className={tdc}><input type="number" step="0.01" value={row.length || ''} onChange={e => setCutRows(rs => rs.map((r, i) => i === idx ? { ...r, length: N(e.target.value) } : r))} className={`${ic} w-20`} /></td>
                    <td className={`${tdc} bg-amber-50/30`}><input type="number" step="0.01" value={row.repeat_length || ''} onChange={e => setCutRows(rs => rs.map((r, i) => i === idx ? { ...r, repeat_length: N(e.target.value) } : r))} className={`${ic} w-20`} /></td>
                    <td className={`${tdc} bg-amber-50/30`}><input type="number" step="0.01" value={row.repeat_width || ''} onChange={e => setCutRows(rs => rs.map((r, i) => i === idx ? { ...r, repeat_width: N(e.target.value) } : r))} className={`${ic} w-20`} /></td>
                    <td className={tdc}>{cutRows.length > 1 && <button onClick={() => setCutRows(rs => rs.filter((_, i) => i !== idx))} className="p-1 text-red-400 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className={sc}>
          <h3 className="font-semibold text-slate-800 mb-4">Production Result</h3>
          <div className="grid grid-cols-3 gap-4">
            <div><label className={lc}>Grade A (kg)</label><input type="number" step="0.01" value={gradeA || ''} onChange={e => setGradeA(N(e.target.value))} className={ic} /></div>
            <div><label className={lc}>Grade B (kg)</label><input type="number" step="0.01" value={gradeB || ''} onChange={e => setGradeB(N(e.target.value))} className={ic} /></div>
            <div><label className={lc}>Loss (kg)</label><input type="number" step="0.01" value={lossKg || ''} onChange={e => setLossKg(N(e.target.value))} className={ic} /></div>
          </div>
        </div>
      </>)}
      {mtype === 'laminasi' && (<>
        {/* Film Axis Settings */}
        <div className={sc}>
          <h3 className="font-semibold text-slate-800 mb-4">Film Axis</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div><label className={lc}>Initial Torque (%)</label><input type="number" step="0.1" value={filmAxis.initial_torque || ''} onChange={e => setFilmAxis(a => ({ ...a, initial_torque: N(e.target.value) }))} className={ic} /></div>
            <div><label className={lc}>Setting Tension (kg)</label><input type="number" step="0.1" value={filmAxis.setting_tension || ''} onChange={e => setFilmAxis(a => ({ ...a, setting_tension: N(e.target.value) }))} className={ic} /></div>
            <div><label className={lc}>Actual Tension (kg)</label><input type="number" step="0.1" value={filmAxis.actual_tension || ''} onChange={e => setFilmAxis(a => ({ ...a, actual_tension: N(e.target.value) }))} className={ic} /></div>
            <div><label className={lc}>Actual Torque (%)</label><input type="number" step="0.1" value={filmAxis.actual_torque || ''} onChange={e => setFilmAxis(a => ({ ...a, actual_torque: N(e.target.value) }))} className={ic} /></div>
            <div><label className={lc}>Actual Diameter (mm)</label><input type="number" step="0.1" value={filmAxis.actual_diameter || ''} onChange={e => setFilmAxis(a => ({ ...a, actual_diameter: N(e.target.value) }))} className={ic} /></div>
            <div><label className={lc}>Initial Diameter (mm)</label><input type="number" step="0.1" value={filmAxis.initial_diameter || ''} onChange={e => setFilmAxis(a => ({ ...a, initial_diameter: N(e.target.value) }))} className={ic} /></div>
            <div><label className={lc}>Rate Coating (%)</label><input type="number" step="0.1" value={filmAxis.rate_coating || ''} onChange={e => setFilmAxis(a => ({ ...a, rate_coating: N(e.target.value) }))} className={ic} /></div>
          </div>
        </div>
        {/* Non Woven Axis Settings */}
        <div className={sc}>
          <h3 className="font-semibold text-slate-800 mb-4">Non Woven Axis</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div><label className={lc}>Initial Torque (%)</label><input type="number" step="0.1" value={nwAxis.initial_torque || ''} onChange={e => setNwAxis(a => ({ ...a, initial_torque: N(e.target.value) }))} className={ic} /></div>
            <div><label className={lc}>Setting Tension (kg)</label><input type="number" step="0.1" value={nwAxis.setting_tension || ''} onChange={e => setNwAxis(a => ({ ...a, setting_tension: N(e.target.value) }))} className={ic} /></div>
            <div><label className={lc}>Actual Tension (kg)</label><input type="number" step="0.1" value={nwAxis.actual_tension || ''} onChange={e => setNwAxis(a => ({ ...a, actual_tension: N(e.target.value) }))} className={ic} /></div>
            <div><label className={lc}>Actual Torque (%)</label><input type="number" step="0.1" value={nwAxis.actual_torque || ''} onChange={e => setNwAxis(a => ({ ...a, actual_torque: N(e.target.value) }))} className={ic} /></div>
            <div><label className={lc}>Actual Diameter (mm)</label><input type="number" step="0.1" value={nwAxis.actual_diameter || ''} onChange={e => setNwAxis(a => ({ ...a, actual_diameter: N(e.target.value) }))} className={ic} /></div>
            <div><label className={lc}>Initial Diameter (mm)</label><input type="number" step="0.1" value={nwAxis.initial_diameter || ''} onChange={e => setNwAxis(a => ({ ...a, initial_diameter: N(e.target.value) }))} className={ic} /></div>
            <div><label className={lc}>Rewind Angle (%)</label><input type="number" step="0.1" value={nwAxis.rewind_angle || ''} onChange={e => setNwAxis(a => ({ ...a, rewind_angle: N(e.target.value) }))} className={ic} /></div>
          </div>
        </div>
        {/* Laminasi Rows */}
        <div className={sc}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Data Produksi Laminasi</h3>
            <button type="button" onClick={() => setLamRows(r => [...r, mkLam(r.length + 1)])} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><PlusIcon className="h-4 w-4" /> Baris</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className={thc}>No</th>
                  <th className={`${thc} bg-blue-50`} colSpan={3}>Time</th>
                  <th className={thc}>Date</th>
                  <th className={thc}>Product</th>
                  <th className={`${thc} bg-green-50`} colSpan={2}>Film Axis</th>
                  <th className={`${thc} bg-purple-50`} colSpan={2}>Non Woven</th>
                  <th className={`${thc} bg-amber-50`} colSpan={4}>Winding</th>
                  <th className={`${thc} bg-pink-50`} colSpan={2}>Lem</th>
                  <th className={thc}></th>
                </tr>
                <tr>
                  <th className={thc}></th>
                  <th className={`${thc} bg-blue-50`}>Mulai</th>
                  <th className={`${thc} bg-blue-50`}>Akhir</th>
                  <th className={`${thc} bg-blue-50`}>Menit</th>
                  <th className={thc}></th>
                  <th className={thc}></th>
                  <th className={`${thc} bg-green-50`}>Type</th>
                  <th className={`${thc} bg-green-50`}>GSM</th>
                  <th className={`${thc} bg-purple-50`}>Type Kain</th>
                  <th className={`${thc} bg-purple-50`}>GSM</th>
                  <th className={`${thc} bg-amber-50`}>Width (cm)</th>
                  <th className={`${thc} bg-amber-50`}>Length (m)</th>
                  <th className={`${thc} bg-amber-50`}>GSM Total</th>
                  <th className={`${thc} bg-amber-50`}>Speed</th>
                  <th className={`${thc} bg-pink-50`}>Type</th>
                  <th className={`${thc} bg-pink-50`}>Usage</th>
                  <th className={thc}></th>
                </tr>
              </thead>
              <tbody>
                {lamRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className={`${tdc} text-center text-xs text-slate-400`}>{row.no}</td>
                    <td className={`${tdc} bg-blue-50/20`}><input type="time" value={row.time_start} onChange={e => setLamRows(rs => rs.map((r, i) => i === idx ? { ...r, time_start: e.target.value } : r))} className={`${ic} w-24`} /></td>
                    <td className={`${tdc} bg-blue-50/20`}><input type="time" value={row.time_end} onChange={e => setLamRows(rs => rs.map((r, i) => i === idx ? { ...r, time_end: e.target.value } : r))} className={`${ic} w-24`} /></td>
                    <td className={`${tdc} bg-blue-50/20`}><input type="number" value={row.total_minutes || ''} onChange={e => setLamRows(rs => rs.map((r, i) => i === idx ? { ...r, total_minutes: N(e.target.value) } : r))} className={`${ic} w-16`} /></td>
                    <td className={tdc}><input type="date" value={row.date} onChange={e => setLamRows(rs => rs.map((r, i) => i === idx ? { ...r, date: e.target.value } : r))} className={`${ic} w-32`} /></td>
                    <td className={tdc}><input value={row.product_name} onChange={e => setLamRows(rs => rs.map((r, i) => i === idx ? { ...r, product_name: e.target.value } : r))} className={`${ic} w-28`} /></td>
                    <td className={`${tdc} bg-green-50/20`}><input value={row.film_type} onChange={e => setLamRows(rs => rs.map((r, i) => i === idx ? { ...r, film_type: e.target.value } : r))} className={`${ic} w-24`} /></td>
                    <td className={`${tdc} bg-green-50/20`}><input type="number" step="0.1" value={row.film_gsm || ''} onChange={e => setLamRows(rs => rs.map((r, i) => i === idx ? { ...r, film_gsm: N(e.target.value) } : r))} className={`${ic} w-16`} /></td>
                    <td className={`${tdc} bg-purple-50/20`}><input value={row.nonwoven_type} onChange={e => setLamRows(rs => rs.map((r, i) => i === idx ? { ...r, nonwoven_type: e.target.value } : r))} className={`${ic} w-24`} /></td>
                    <td className={`${tdc} bg-purple-50/20`}><input type="number" step="0.1" value={row.nonwoven_gsm || ''} onChange={e => setLamRows(rs => rs.map((r, i) => i === idx ? { ...r, nonwoven_gsm: N(e.target.value) } : r))} className={`${ic} w-16`} /></td>
                    <td className={`${tdc} bg-amber-50/20`}><input type="number" step="0.1" value={row.winding_width || ''} onChange={e => setLamRows(rs => rs.map((r, i) => i === idx ? { ...r, winding_width: N(e.target.value) } : r))} className={`${ic} w-16`} /></td>
                    <td className={`${tdc} bg-amber-50/20`}><input type="number" step="0.1" value={row.winding_length || ''} onChange={e => setLamRows(rs => rs.map((r, i) => i === idx ? { ...r, winding_length: N(e.target.value) } : r))} className={`${ic} w-16`} /></td>
                    <td className={`${tdc} bg-amber-50/20`}><input type="number" step="0.1" value={row.gsm_total || ''} onChange={e => setLamRows(rs => rs.map((r, i) => i === idx ? { ...r, gsm_total: N(e.target.value) } : r))} className={`${ic} w-16`} /></td>
                    <td className={`${tdc} bg-amber-50/20`}><input type="number" step="0.1" value={row.speed || ''} onChange={e => setLamRows(rs => rs.map((r, i) => i === idx ? { ...r, speed: N(e.target.value) } : r))} className={`${ic} w-16`} /></td>
                    <td className={`${tdc} bg-pink-50/20`}><input value={row.lem_type} onChange={e => setLamRows(rs => rs.map((r, i) => i === idx ? { ...r, lem_type: e.target.value } : r))} className={`${ic} w-24`} /></td>
                    <td className={`${tdc} bg-pink-50/20`}><input type="number" step="0.01" value={row.lem_usage || ''} onChange={e => setLamRows(rs => rs.map((r, i) => i === idx ? { ...r, lem_usage: N(e.target.value) } : r))} className={`${ic} w-16`} /></td>
                    <td className={tdc}>{lamRows.length > 1 && <button onClick={() => setLamRows(rs => rs.filter((_, i) => i !== idx).map((r, i) => ({ ...r, no: i + 1 })))} className="p-1 text-red-400 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>)}
      {mtype === 'bagmaker' && (<>
        {/* Bagmaker Header */}
        <div className={sc}>
          <h3 className="font-semibold text-slate-800 mb-4">Info Bagmaker</h3>
          <div className="grid grid-cols-3 gap-4">
            <div><label className={lc}>Production Hour (menit)</label><input type="number" value={prodHourMin || ''} onChange={e => setProdHourMin(N(e.target.value))} className={ic} placeholder="0" /></div>
            <div><label className={lc}>Downtime (menit)</label><input type="number" value={downtimeMin || ''} onChange={e => setDowntimeMin(N(e.target.value))} className={ic} placeholder="0" /></div>
            <div><label className={lc}>Speed Mesin</label><input type="number" value={machineSpeed || ''} onChange={e => setMachineSpeed(N(e.target.value))} className={ic} placeholder="0" /></div>
          </div>
        </div>
        {/* Bagmaker Rows */}
        <div className={sc}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Data Downtime & Output</h3>
            <button type="button" onClick={() => setBagRows(r => [...r, mkBag(r.length + 1)])} className="flex items-center gap-1 text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><PlusIcon className="h-4 w-4" /> Baris</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className={thc}>No</th>
                  <th className={`${thc} bg-yellow-50`}>Plan Downtime</th>
                  <th className={`${thc} bg-red-50`}>Unplan Downtime</th>
                  <th className={thc}>Total (mnt)</th>
                  <th className={thc}>No Roll</th>
                  <th className={thc}>Berat Roll (kg)</th>
                  <th className={thc}>Panjang (m)</th>
                  <th className={`${thc} bg-green-50`}>Output Grade A</th>
                  <th className={`${thc} bg-orange-50`}>Output Grade C</th>
                  <th className={thc}></th>
                </tr>
              </thead>
              <tbody>
                {bagRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className={`${tdc} text-center text-xs text-slate-400`}>{row.no}</td>
                    <td className={`${tdc} bg-yellow-50/20`}><input value={row.plan_downtime} onChange={e => setBagRows(rs => rs.map((r, i) => i === idx ? { ...r, plan_downtime: e.target.value } : r))} className={`${ic} w-28 ${getDowntimeBgClass(row.plan_downtime)}`} placeholder="Keterangan" /></td>
                    <td className={`${tdc} bg-red-50/20`}><input value={row.unplan_downtime} onChange={e => setBagRows(rs => rs.map((r, i) => i === idx ? { ...r, unplan_downtime: e.target.value } : r))} className={`${ic} w-28 ${getDowntimeBgClass(row.unplan_downtime)}`} placeholder="Keterangan" /></td>
                    <td className={tdc}><input type="number" value={row.total_minutes || ''} onChange={e => setBagRows(rs => rs.map((r, i) => i === idx ? { ...r, total_minutes: N(e.target.value) } : r))} className={`${ic} w-16`} /></td>
                    <td className={tdc}><input value={row.no_roll} onChange={e => setBagRows(rs => rs.map((r, i) => i === idx ? { ...r, no_roll: e.target.value } : r))} className={`${ic} w-24`} /></td>
                    <td className={tdc}><input type="number" step="0.01" value={row.roll_weight || ''} onChange={e => setBagRows(rs => rs.map((r, i) => i === idx ? { ...r, roll_weight: N(e.target.value) } : r))} className={`${ic} w-20`} /></td>
                    <td className={tdc}><input type="number" step="0.01" value={row.roll_length || ''} onChange={e => setBagRows(rs => rs.map((r, i) => i === idx ? { ...r, roll_length: N(e.target.value) } : r))} className={`${ic} w-20`} /></td>
                    <td className={`${tdc} bg-green-50/20`}><input type="number" step="1" value={row.output_grade_a || ''} onChange={e => setBagRows(rs => rs.map((r, i) => i === idx ? { ...r, output_grade_a: N(e.target.value) } : r))} className={`${ic} w-20`} /></td>
                    <td className={`${tdc} bg-orange-50/20`}><input type="number" step="1" value={row.output_grade_c || ''} onChange={e => setBagRows(rs => rs.map((r, i) => i === idx ? { ...r, output_grade_c: N(e.target.value) } : r))} className={`${ic} w-20`} /></td>
                    <td className={tdc}>{bagRows.length > 1 && <button onClick={() => setBagRows(rs => rs.filter((_, i) => i !== idx).map((r, i) => ({ ...r, no: i + 1 })))} className="p-1 text-red-400 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={7} className="px-2 py-2 text-right text-sm text-slate-600">Total Output:</td>
                  <td className="px-2 py-2 text-sm text-green-700">{bagRows.reduce((s, r) => s + N(r.output_grade_a), 0).toLocaleString()}</td>
                  <td className="px-2 py-2 text-sm text-orange-700">{bagRows.reduce((s, r) => s + N(r.output_grade_c), 0).toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </>)}

      {/* SECTION INPUT DOWNTIME (SAMA DENGAN INPUT PRODUKSI UTAMA) */}
      {machineId && mtype !== 'bagmaker' && (
        <div className={sc}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-slate-500" />
              <h3 className="font-semibold text-slate-800">Input Downtime</h3>
            </div>
            <button
              type="button"
              onClick={addDowntimeEntry}
              className="flex items-center gap-1 text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <PlusIcon className="h-4 w-4" /> Tambah Downtime
            </button>
          </div>

          {downtimeEntries.length === 0 ? (
            <div className="text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <ClockIcon className="h-8 w-8 mx-auto text-slate-400 mb-2" />
              <p className="text-slate-500 text-sm">Tidak ada downtime</p>
            </div>
          ) : (
            <div className="space-y-3">
              {downtimeEntries.map((entry, index) => {
                const catConfig = DOWNTIME_CATEGORIES[entry.category as keyof typeof DOWNTIME_CATEGORIES] || DOWNTIME_CATEGORIES.others;
                return (
                  <div key={entry.id} className={`p-4 rounded-lg border ${catConfig.bgColor} ${catConfig.borderColor}`}>
                    <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${catConfig.textColor} bg-white border border-current`}>
                        {index + 1}
                      </div>
                      
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Alasan Downtime</label>
                        <input
                          type="text"
                          value={entry.reason}
                          onChange={(e) => updateDowntimeEntry(entry.id, 'reason', e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          placeholder="Contoh: setting pisau, ganti kain..."
                          required
                        />
                      </div>

                      <div className="w-28">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Durasi (menit)</label>
                        <input
                          type="number"
                          value={entry.duration_minutes || ''}
                          onChange={(e) => updateDowntimeEntry(entry.id, 'duration_minutes', N(e.target.value))}
                          className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-center"
                          placeholder="0"
                          min="1"
                          required
                        />
                      </div>

                      <div className="w-24">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Frekuensi</label>
                        <input
                          type="number"
                          value={entry.frequency || ''}
                          onChange={(e) => updateDowntimeEntry(entry.id, 'frequency', N(e.target.value))}
                          className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-center"
                          placeholder="1"
                          min="1"
                        />
                      </div>

                      <div className="w-32">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Kategori (Auto)</label>
                        <span className={`inline-block w-full text-center px-3 py-1.5 rounded text-xs font-semibold border ${catConfig.textColor} bg-white ${catConfig.borderColor}`}>
                          {catConfig.label}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeDowntimeEntry(entry.id)}
                        className="p-2 text-red-500 hover:text-red-700 self-end md:self-center"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              
              <div className="text-right pt-2 border-t font-semibold text-slate-700">
                Total Downtime: {downtimeEntries.reduce((sum, e) => sum + (N(e.duration_minutes) * N(e.frequency)), 0)} menit
              </div>
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      {machineId && (
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => navigate('/app/production/converting')} className="px-6 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">Batal</button>
          <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {submitting ? 'Menyimpan...' : 'Simpan Data Produksi'}
          </button>
        </div>
      )}

      {!machineId && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
          <p className="text-slate-400 text-lg">Pilih mesin untuk mulai input data produksi</p>
        </div>
      )}
    </div>
  )
}
