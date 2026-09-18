import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import AccessibleModal from '../../components/ui/AccessibleModal';
import { ArrowLeftIcon, ArrowPathIcon, PrinterIcon, CubeIcon } from '@heroicons/react/24/outline';

export default function BatchRecord() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [materialModal, setMaterialModal] = useState<{ open: boolean; loading: boolean; data: any; itemName: string }>({
    open: false, loading: false, data: null, itemName: '',
  });

  useEffect(() => {
    setLoading(true);
    axiosInstance.get(`/api/production/batches/${id}/record`)
      .then(r => setRecord(r.data))
      .finally(() => setLoading(false));
  }, [id]);

  const openMaterialDrillDown = async (mat: any) => {
    if (!mat.material_id) return;
    setMaterialModal({ open: true, loading: true, data: null, itemName: mat.item_name });
    try {
      const res = await axiosInstance.get(`/api/materials/${mat.material_id}/inventory`);
      setMaterialModal({ open: true, loading: false, data: res.data, itemName: mat.item_name });
    } catch {
      setMaterialModal({ open: true, loading: false, data: null, itemName: mat.item_name });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64 text-gray-400">
        <ArrowPathIcon className="h-6 w-6 animate-spin mr-2" /> Memuat...
      </div>
    );
  }

  if (!record) {
    return <div className="p-6 text-center text-gray-500">Batch tidak ditemukan.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 print:max-w-none">
      {/* Header - hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link to={`/app/production/batches/${id}/close`} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Catatan Pengolahan Bets</h1>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-[#059669] text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
        >
          <PrinterIcon className="h-4 w-4" /> Cetak / PDF
        </button>
      </div>

      {/* Document */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-8 print:shadow-none print:rounded-none print:p-0">
        <div className="text-center border-b-2 border-gray-900 dark:border-white pb-3 mb-5">
          <h2 className="text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">Catatan Pengolahan Bets</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Batch Manufacturing Record</p>
        </div>

        {/* Identitas Batch */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-6">
          <InfoRow label="Nomor Batch" value={record.batch_number} />
          <InfoRow label="No. SPK / WO" value={record.wo_number || '-'} />
          <InfoRow label="Produk" value={`${record.product_name || '-'}${record.product_code ? ` (${record.product_code})` : ''}`} />
          <InfoRow label="Versi BOM" value={record.bom_version || '-'} />
          <InfoRow label="Tanggal Produksi" value={record.scheduled_date || '-'} />
          <InfoRow label="Mesin" value={record.machine_name || '-'} />
          <InfoRow label="Qty Rencana" value={`${record.planned_qty.toLocaleString('id-ID')}`} />
          <InfoRow label="Status Batch" value={record.status} />
        </div>

        {/* Bahan Baku */}
        <Section title="Bahan Baku Terpakai">
          {record.materials.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">Belum ada data bahan aktual untuk batch ini.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 pr-3">Nama Bahan</th>
                  <th className="pb-2 pr-3">No. Batch Aktual</th>
                  <th className="pb-2 pr-3 text-right">Rencana</th>
                  <th className="pb-2 pr-3 text-right">Aktual</th>
                  <th className="pb-2 pr-3 text-right">Varians</th>
                  <th className="pb-2">Satuan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {record.materials.map((m: any) => (
                  <tr
                    key={m.id}
                    onClick={() => openMaterialDrillDown(m)}
                    className={m.material_id ? 'cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/10 print:hover:bg-transparent' : ''}
                    title={m.material_id ? 'Klik untuk lihat stok bahan ini' : undefined}
                  >
                    <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white">
                      <span className="flex items-center gap-1.5">
                        {m.material_id && <CubeIcon className="h-3.5 w-3.5 text-[#059669] flex-shrink-0 print:hidden" />}
                        {m.item_name}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">{m.actual_batch_number || '-'}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{m.quantity_planned.toLocaleString('id-ID')}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{m.quantity_actual != null ? m.quantity_actual.toLocaleString('id-ID') : '-'}</td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${m.variance != null && m.variance !== 0 ? 'text-amber-600' : ''}`}>
                      {m.variance != null ? m.variance.toLocaleString('id-ID') : '-'}
                    </td>
                    <td className="py-2 text-gray-500 dark:text-gray-400">{m.uom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Parameter Proses & Hasil per Shift */}
        <Section title="Parameter Proses & Hasil Produksi (per Shift)">
          {record.shifts.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">Belum ada input shift untuk batch ini.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 pr-3">Tanggal</th>
                  <th className="pb-2 pr-3">Shift</th>
                  <th className="pb-2 pr-3">Operator</th>
                  <th className="pb-2 pr-3">Supervisor</th>
                  <th className="pb-2 pr-3 text-right">Target</th>
                  <th className="pb-2 pr-3 text-right">Aktual</th>
                  <th className="pb-2 pr-3 text-right">Baik</th>
                  <th className="pb-2 text-right">Reject</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {record.shifts.map((s: any) => (
                  <tr key={s.id}>
                    <td className="py-2 pr-3">{s.production_date}</td>
                    <td className="py-2 pr-3">{s.shift}{s.sub_shift ? `-${s.sub_shift}` : ''}</td>
                    <td className="py-2 pr-3">{s.operator_name || '-'}</td>
                    <td className="py-2 pr-3">{s.supervisor_name || '-'}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{s.target_quantity.toLocaleString('id-ID')}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{s.actual_quantity.toLocaleString('id-ID')}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-emerald-600">{s.good_quantity.toLocaleString('id-ID')}</td>
                    <td className="py-2 text-right tabular-nums text-red-600">{s.reject_quantity.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex justify-end gap-6 pt-3 mt-3 border-t border-gray-100 dark:border-gray-700 text-sm">
            <p><span className="text-gray-500">Total Baik:</span> <strong>{record.summary.total_good.toLocaleString('id-ID')}</strong></p>
            <p><span className="text-gray-500">Total Reject:</span> <strong>{record.summary.total_reject.toLocaleString('id-ID')}</strong></p>
            <p><span className="text-gray-500">Yield:</span> <strong>{record.summary.yield_percent != null ? `${record.summary.yield_percent}%` : '-'}</strong></p>
          </div>
        </Section>

        {/* Status QC */}
        <Section title="Status QC Hasil Produksi">
          {record.qc_status.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">Belum ada data stok/QC untuk nomor batch ini.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 pr-3">Lokasi</th>
                  <th className="pb-2 pr-3 text-right">Qty</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Tanggal QC</th>
                  <th className="pb-2">Catatan QC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {record.qc_status.map((q: any) => (
                  <tr key={q.inventory_id}>
                    <td className="py-2 pr-3">{q.location || '-'}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{q.quantity_on_hand.toLocaleString('id-ID')}</td>
                    <td className="py-2 pr-3 capitalize">{q.stock_status}</td>
                    <td className="py-2 pr-3 text-gray-500">{q.qc_date ? new Date(q.qc_date).toLocaleDateString('id-ID') : '-'}</td>
                    <td className="py-2 text-gray-500">{q.qc_notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Signoff */}
        <Section title="Penutupan & Persetujuan Batch">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <InfoRow label="Disetujui oleh" value={record.approved_by_name || '-'} />
            <InfoRow label="Tanggal Persetujuan" value={record.approved_at ? new Date(record.approved_at).toLocaleString('id-ID') : '-'} />
            <InfoRow label="Ditutup oleh" value={record.admin_closed_by_name || '-'} />
            <InfoRow label="Tanggal Penutupan" value={record.admin_closed_at ? new Date(record.admin_closed_at).toLocaleString('id-ID') : (record.admin_closed ? '-' : 'Belum ditutup')} />
          </div>
        </Section>
      </div>

      {/* Drill-down modal: material stock */}
      <AccessibleModal
        isOpen={materialModal.open}
        onClose={() => setMaterialModal(m => ({ ...m, open: false }))}
        title={`Stok - ${materialModal.itemName}`}
        description="Data stok real per lokasi/batch gudang untuk bahan ini"
        size="lg"
      >
        {materialModal.loading ? (
          <div className="flex justify-center py-8 text-gray-400"><ArrowPathIcon className="h-5 w-5 animate-spin" /></div>
        ) : !materialModal.data ? (
          <p className="text-sm text-gray-500 text-center py-6">Gagal memuat data stok.</p>
        ) : materialModal.data.locations?.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">Belum ada stok untuk bahan ini di gudang.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200 dark:border-gray-700">
                <th className="pb-2 pr-3">Lokasi</th>
                <th className="pb-2 pr-3">No. Batch</th>
                <th className="pb-2 pr-3 text-right">Qty Tersedia</th>
                <th className="pb-2 text-right">Qty Reserved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {materialModal.data.locations.map((loc: any) => (
                <tr key={loc.inventory_id}>
                  <td className="py-2 pr-3">{loc.location_code || '-'}</td>
                  <td className="py-2 pr-3 text-gray-500">{loc.batch_number || '-'}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{loc.quantity_available.toLocaleString('id-ID')}</td>
                  <td className="py-2 text-right tabular-nums">{loc.quantity_reserved.toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AccessibleModal>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide border-b border-gray-200 dark:border-gray-700 pb-1.5 mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <p className="w-40 flex-shrink-0 text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-gray-900 dark:text-white font-medium">: {value}</p>
    </div>
  );
}
