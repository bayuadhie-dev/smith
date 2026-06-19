import React, { useState } from 'react';
import {
  useGetSPCParametersQuery,
  useGetSPCSpecsQuery,
  useCreateSPCSampleMutation,
} from '../../../services/api';
import { useGetWorkOrdersQuery, useGetMachinesQuery } from '../../../services/api';
import { XMarkIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

interface MeasurementInput {
  parameter_id: number;
  parameter_name: string;
  parameter_code: string;
  uom: string;
  readings: string[];
}

export default function SPCSampleForm({ onClose, onSuccess }: Props) {
  const today = new Date().toISOString().split('T')[0];

  // State dari WO
  const [selectedWO, setSelectedWO] = useState<any>(null);
  const [shift, setShift] = useState('shift_1');
  const [subShift, setSubShift] = useState('a');
  const [sampleDate, setSampleDate] = useState(today);
  const [subgroupSize, setSubgroupSize] = useState(5);
  const [notes, setNotes] = useState('');
  const [measurements, setMeasurements] = useState<MeasurementInput[]>([]);
  const [filterProduct, setFilterProduct] = useState('');
  const [filterMachine, setFilterMachine] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [violations, setViolations] = useState<any[]>([]);

  // Ambil WO yang sedang berjalan
  const { data: woData } = useGetWorkOrdersQuery({ per_page: 500 });
  const { data: paramsData } = useGetSPCParametersQuery();
  const { data: specsData } = useGetSPCSpecsQuery(
    { product_id: selectedWO?.product_id },
    { skip: !selectedWO }
  );

  const [createSample, { isLoading }] = useCreateSPCSampleMutation();

  const workOrders = woData?.work_orders || [];
  const filteredWOs = workOrders.filter((wo: any) => {
    const matchProduct = !filterProduct || wo.product_name?.toLowerCase().includes(filterProduct.toLowerCase());
    const matchMachine = !filterMachine || wo.machine_name?.toLowerCase().includes(filterMachine.toLowerCase());
    const matchDate = !filterDate || wo.scheduled_start_date?.startsWith(filterDate);
    return matchProduct && matchMachine && matchDate;
  });
  const parameters = paramsData?.parameters || [];

  const handleWOSelect = (woId: string) => {
    const wo = workOrders.find((w: any) => w.id === parseInt(woId));
    if (!wo) { setSelectedWO(null); setMeasurements([]); return; }
    setSelectedWO(wo);
    setMeasurements([]);
    // Auto-set tanggal dari WO
    if (wo.scheduled_start_date) {
      setSampleDate(wo.scheduled_start_date.split('T')[0]);
    }
  };

  const addMeasurement = (param: any) => {
    if (measurements.find(m => m.parameter_id === param.id)) return;
    setMeasurements(prev => [...prev, {
      parameter_id: param.id,
      parameter_name: param.name,
      parameter_code: param.code,
      uom: param.uom,
      readings: Array(subgroupSize).fill('')
    }]);
  };

  const removeMeasurement = (parameterId: number) => {
    setMeasurements(prev => prev.filter(m => m.parameter_id !== parameterId));
  };

  const updateReading = (paramId: number, index: number, value: string) => {
    setMeasurements(prev => prev.map(m => {
      if (m.parameter_id !== paramId) return m;
      const newReadings = [...m.readings];
      newReadings[index] = value;
      return { ...m, readings: newReadings };
    }));
  };

  const handleSubgroupSizeChange = (n: number) => {
    setSubgroupSize(n);
    setMeasurements(prev => prev.map(m => ({
      ...m,
      readings: Array(n).fill('').map((_, i) => m.readings[i] ?? '')
    })));
  };

  const getSpec = (parameterId: number) => {
    return specsData?.specs?.find(
      (s: any) => s.product_id === selectedWO?.product_id && s.parameter_id === parameterId
    );
  };

  const getXbar = (readings: string[]) => {
    const nums = readings.map(Number).filter(r => !isNaN(r) && r !== 0);
    if (nums.length !== readings.length) return null;
    return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(3);
  };

  const handleSubmit = async () => {
    if (!selectedWO) return alert('Pilih Work Order terlebih dahulu');
    if (measurements.length === 0) return alert('Tambahkan minimal 1 parameter');

    const payload = {
      product_id: selectedWO.product_id,
      work_order_id: selectedWO.id,
      machine_id: selectedWO.machine_id || null,
      shift,
      sub_shift: subShift,
      sample_date: sampleDate,
      subgroup_size: subgroupSize,
      notes: notes || null,
      measurements: measurements.map(m => ({
        parameter_id: m.parameter_id,
        readings: m.readings.map(r => parseFloat(r)).filter(r => !isNaN(r)),
      })).filter(m => m.readings.length > 0)
    };

    try {
      const result = await createSample(payload).unwrap();
      if (result.violations?.length > 0) {
        setViolations(result.violations);
      } else {
        onSuccess();
      }
    } catch (e: any) {
      alert(e.data?.error || 'Gagal menyimpan sample');
    }
  };

  // Tampilkan warning violations
  if (violations.length > 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-500 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-red-600">Out of Control Detected!</h3>
              <p className="text-sm text-gray-500">Sample tersimpan, tapi ada pelanggaran SPC</p>
            </div>
          </div>
          <div className="space-y-3 mb-6">
            {violations.map((v: any, i: number) => (
              <div key={i} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  Parameter ID: {v.parameter_id} | X̄ = {v.xbar?.toFixed(4)}
                </p>
                {v.violations.map((rule: string, j: number) => (
                  <p key={j} className="text-xs text-red-600 mt-1">⚠ {rule}</p>
                ))}
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Segera lakukan investigasi dan tindakan korektif.
          </p>
          <button onClick={onSuccess} className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">
            Mengerti, Tutup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Input SPC Sample</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Pilih Work Order */}
          <div>
            {/* Filter bar */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <input
                type="text"
                placeholder="Cari produk..."
                value={filterProduct}
                onChange={(e) => setFilterProduct(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Cari mesin..."
                value={filterMachine}
                onChange={(e) => setFilterMachine(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Work Order <span className="text-red-500">*</span>
              <span className="ml-2 text-xs text-gray-400 font-normal">({filteredWOs.length} dari {workOrders.length} WO)</span>
            </label>
            <select
              onChange={(e) => handleWOSelect(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Pilih Work Order --</option>
              {filteredWOs.map((wo: any) => (
                <option key={wo.id} value={wo.id}>
                  {wo.wo_number} — {wo.product_name} | {wo.machine_name || 'Mesin ?'}
                </option>
              ))}
            </select>
          </div>

          {/* Info WO yang dipilih */}
          {selectedWO && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Produk:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">{selectedWO.product_name}</span>
                </div>
                <div>
                  <span className="text-gray-500">Mesin:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">{selectedWO.machine_name || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500">WO:</span>
                  <span className="ml-2 font-mono text-blue-700 dark:text-blue-300">{selectedWO.wo_number}</span>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    {selectedWO.status}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Sample Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Sample</label>
              <input
                type="date"
                value={sampleDate}
                onChange={(e) => setSampleDate(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subgroup Size (n)</label>
              <select
                value={subgroupSize}
                onChange={(e) => handleSubgroupSizeChange(Number(e.target.value))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {[3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <option key={n} value={n}>n = {n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shift</label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="shift_1">Shift 1</option>
                <option value="shift_2">Shift 2</option>
                <option value="shift_3">Shift 3</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sub-shift</label>
              <select
                value={subShift}
                onChange={(e) => setSubShift(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {['a', 'b', 'c'].map(s => (
                  <option key={s} value={s}>{s.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tambah Parameter — hanya tampil kalau WO dipilih */}
          {selectedWO && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Parameter yang Diukur
              </label>
              <div className="flex flex-wrap gap-2">
                {parameters.map((p: any) => {
                  const added = measurements.find(m => m.parameter_id === p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => addMeasurement(p)}
                      disabled={!!added}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        added
                          ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300 cursor-default'
                          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:text-blue-600 dark:text-gray-300'
                      }`}
                    >
                      {added ? '✓ ' : '+ '}{p.code}
                      <span className="text-xs text-gray-400 ml-1">({p.uom})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Measurement Inputs */}
          {measurements.map((m) => {
            const spec = getSpec(m.parameter_id);
            const xbar = getXbar(m.readings);
            return (
              <div key={m.parameter_id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                      {m.parameter_code}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{m.parameter_name}</span>
                    <span className="text-xs text-gray-400">({m.uom})</span>
                    {spec && (
                      <span className="text-xs text-gray-400">
                        USL: {spec.usl ?? '-'} | LSL: {spec.lsl ?? '-'} | Target: {spec.target_value ?? '-'}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeMeasurement(m.parameter_id)}
                    className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-gray-400 hover:text-red-500"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex gap-2 flex-wrap items-end">
                  {m.readings.map((r, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <label className="text-xs text-gray-400">#{i + 1}</label>
                      <input
                        type="number"
                        step="any"
                        value={r}
                        onChange={(e) => updateReading(m.parameter_id, i, e.target.value)}
                        placeholder="0.00"
                        className="w-20 border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm text-center dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}

                  {/* Live X-bar preview */}
                  {xbar && (
                    <div className="flex flex-col items-center gap-1 ml-2 border-l border-gray-200 dark:border-gray-600 pl-3">
                      <label className="text-xs text-gray-400">X̄</label>
                      <div className={`w-20 rounded px-2 py-1.5 text-sm text-center font-mono font-semibold border ${
                        spec?.ucl && spec?.lcl
                          ? parseFloat(xbar) > parseFloat(spec.ucl) || parseFloat(xbar) < parseFloat(spec.lcl)
                            ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300'
                            : 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300'
                          : 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300'
                      }`}>
                        {xbar}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Kondisi mesin, observasi khusus, dll..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !selectedWO || measurements.length === 0}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {isLoading ? 'Menyimpan...' : 'Simpan Sample'}
          </button>
        </div>
      </div>
    </div>
  );
}
