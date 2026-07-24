import React, { useState, useEffect, useRef } from 'react';
import axiosInstance from '../../utils/axiosConfig';

interface OcrPackingListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  packingListId?: number;
  productInfo?: { id: number; name: string; code?: string };
  existingItems?: any[];
}

export const OcrPackingListModal: React.FC<OcrPackingListModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  packingListId,
  productInfo,
  existingItems,
}) => {
  const [productsList, setProductsList] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [ocrPhoto, setOcrPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<any | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  // Editable preview rows
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');

  // Input refs for Camera (capture="environment") vs Gallery
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setOcrResult(null);
      setPreviewRows([]);
      setOcrPhoto(null);
      setPhotoPreview(null);
      setCustomerName('');
      setNotes('');

      if (packingListId && productInfo) {
        setSelectedProductId(String(productInfo.id));
      } else {
        setSelectedProductId('');
        fetchProducts();
      }
    }
  }, [isOpen, packingListId, productInfo]);

  const fetchProducts = async () => {
    try {
      const res = await axiosInstance.get('/api/products?per_page=500');
      setProductsList(res.data.products || res.data || []);
    } catch (err) {
      console.error('Error fetching products for OCR:', err);
      try {
        const wipRes = await axiosInstance.get('/api/packing-list/products-with-wip');
        setProductsList(wipRes.data.products || []);
      } catch (e) {
        console.error('Fallback fetch products failed:', e);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setOcrPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleProcessOcr = async () => {
    if (!selectedProductId) {
      alert('Wajib memilih Produk terlebih dahulu!');
      return;
    }
    if (!ocrPhoto) {
      alert('Wajib memilih atau mengambil foto kertas fisik Packing List!');
      return;
    }

    try {
      setOcrLoading(true);
      const formData = new FormData();
      formData.append('product_id', selectedProductId);
      formData.append('photo', ocrPhoto);

      // Endpoint selection based on mode (existing PL vs standalone new PL)
      const endpoint = packingListId
        ? `/api/packing-list/${packingListId}/ocr-weigh-preview`
        : '/api/packing-list/ocr-standalone-preview';

      const res = await axiosInstance.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000, // OCR butuh waktu lebih lama dari default 10s (proses Gemini AI)
      });

      if (res.data.success) {
        setOcrResult(res.data);
        const rows = res.data.rows || [];

        // Enrich rows with existing items info if in existing PL mode
        if (packingListId && existingItems) {
          rows.forEach((r: any) => {
            const matched = existingItems.find(it => it.carton_number === r.carton_number_full);
            if (matched) {
              r.item_id = matched.id;
              r.existing_weight = matched.weight_kg;
            } else {
              r.item_id = null;
              r.existing_weight = null;
            }
          });
        }
        setPreviewRows(rows);
      } else {
        alert(res.data.message || 'Gagal memproses OCR');
      }
    } catch (err: any) {
      console.error('Error OCR processing:', err);
      alert(err.response?.data?.message || err.message || 'Gagal memproses OCR Gemini');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleRowChange = (index: number, field: string, value: any) => {
    const updated = [...previewRows];
    updated[index][field] = value;

    // Recalculate item matching if carton_number_full is edited in existing PL mode
    if (field === 'carton_number_full' && packingListId && existingItems) {
      const numVal = parseInt(value);
      const matched = existingItems.find(it => it.carton_number === numVal);
      updated[index]['item_id'] = matched ? matched.id : null;
      updated[index]['existing_weight'] = matched ? matched.weight_kg : null;
    }

    // Auto recalculate netto if gross changes
    if (field === 'gross_kg' && ocrResult?.netto_deduction_kg !== undefined) {
      const grossVal = parseFloat(value);
      if (!isNaN(grossVal)) {
        const deduction = parseFloat(ocrResult.netto_deduction_kg);
        updated[index]['netto_kg'] = Math.max(0, Math.round((grossVal - deduction) * 100) / 100);
      }
    }
    setPreviewRows(updated);
  };

  // Duplicate check helper for Safeguard #2 (Badge Merah)
  const cartonCounts: Record<number, number> = {};
  previewRows.forEach(r => {
    if (r.carton_number_full) {
      cartonCounts[r.carton_number_full] = (cartonCounts[r.carton_number_full] || 0) + 1;
    }
  });

  const handleSaveOcrPackingList = async () => {
    if (!ocrResult || previewRows.length === 0) return;

    try {
      setSaveLoading(true);

      // MODE 1: Existing Packing List Weighing (PUT /api/packing-list/:id/items/weigh)
      if (packingListId) {
        // Safeguard #3: Overwrite Confirmation Popup
        const overwrittenItems = previewRows.filter(r => {
          const matchedItem = existingItems?.find(it => it.id === r.item_id || it.carton_number === r.carton_number_full);
          return matchedItem && matchedItem.weight_kg !== null && matchedItem.weight_kg > 0;
        });

        if (overwrittenItems.length > 0) {
          const confirmOverwrite = window.confirm(
            `⚠️ PERHATIAN: Scan ini akan MENIMPA berat ${overwrittenItems.length} karton yang sudah pernah ditimbang sebelumnya.\n\nApakah Anda yakin ingin menimpa data timbangan lama dengan hasil scan ini?`
          );
          if (!confirmOverwrite) {
            setSaveLoading(false);
            return;
          }
        }

        const primaryBatch = ocrResult.batch_numbers_detected?.[0] || null;

        const weighPayload = {
          items: previewRows.map(r => ({
            id: r.item_id,
            carton_number: r.carton_number_full,
            netto_kg: parseFloat(r.netto_kg) || 0,
            weight_kg: parseFloat(r.netto_kg) || 0,
            gross_weight: parseFloat(r.gross_kg) || 0,
            batch_mixing: r.batch_number || primaryBatch,
          })),
        };

        await axiosInstance.put(`/api/packing-list/${packingListId}/items/weigh`, weighPayload);
        alert('✅ Penimbangan karton dari OCR berhasil disimpan ke database!');
        onSuccess();
        onClose();
        return;
      }

      // MODE 2: Standalone Create New Packing List (POST /api/packing-list)
      const selectedProd = productsList.find((p) => p.id === parseInt(selectedProductId));
      const totalCarton = previewRows.length;
      const packPerCarton = selectedProd?.pack_per_carton || 1;
      const primaryBatch = ocrResult.batch_numbers_detected?.[0] || 'BATCH-OCR';

      const payload = {
        product_id: parseInt(selectedProductId),
        total_carton: totalCarton,
        pack_per_carton: packPerCarton,
        start_carton_number: previewRows[0]?.carton_number_full || 1,
        customer_name: customerName,
        batch_mixing: primaryBatch,
        notes: notes ? `[Hasil Scan OCR] ${notes}` : '[Hasil Scan OCR Gemini]',
        items: previewRows.map((r, i) => ({
          carton_number: r.carton_number_full || i + 1,
          gross_weight: parseFloat(r.gross_kg) || 0,
          net_weight: parseFloat(r.netto_kg) || 0,
          batch_mixing: r.batch_number || primaryBatch,
        })),
      };

      const createRes = await axiosInstance.post('/api/packing-list', payload);
      const newPlId = createRes.data?.packing_list?.id;
      if (newPlId) {
        const weighPayload = {
          items: previewRows.map((r) => ({
            carton_number: r.carton_number_full,
            netto_kg: parseFloat(r.netto_kg) || 0,
            weight_kg: parseFloat(r.netto_kg) || 0,
            batch_mixing: r.batch_number || primaryBatch,
          })),
        };
        await axiosInstance.put(`/api/packing-list/${newPlId}/items/weigh`, weighPayload);
      }
      alert('✅ Packing List dari OCR berhasil disimpan ke database!');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving OCR packing list:', err);
      alert(err.response?.data?.error || err.response?.data?.message || 'Gagal menyimpan Packing List');
    } finally {
      setSaveLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-gray-700">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b pb-4 dark:border-gray-700">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>📷 Scan & Input OCR Packing List</span>
              <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-800 rounded-md border border-indigo-200">
                {packingListId ? 'Mode Penimbangan PL' : 'Mode Packing List Baru'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {packingListId
                ? 'Ekstraksi Nomor Karton & Gross Weight dari foto untuk memperbarui timbangan karton.'
                : 'Ekstraksi Nomor Karton, Gross Weight, Batch Number & Membuat Dokumen Packing List Baru.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-2xl font-bold p-1"
          >
            ✕
          </button>
        </div>

        {/* Step 1: Product Selection & Photo Capture Form */}
        <div className="bg-slate-50 dark:bg-gray-900/50 p-4 rounded-xl border border-slate-200 dark:border-gray-700 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Product Info / Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                1. Produk <span className="text-red-500">*</span>
              </label>
              {packingListId && productInfo ? (
                <div className="px-3 py-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm font-bold text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
                  <span>{productInfo.name}</span>
                  <span className="text-xs bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 rounded">
                    {productInfo.code || 'PL #' + packingListId}
                  </span>
                </div>
              ) : (
                <>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border-2 border-indigo-300 dark:border-indigo-600 rounded-lg dark:bg-gray-700 dark:text-white font-semibold focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- PILIH PRODUK TERLEBIH DAHULU --</option>
                    {productsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code || 'No Code'})
                      </option>
                    ))}
                  </select>
                  {!selectedProductId && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1 flex items-center gap-1">
                      ⚠️ Wajib memilih Produk terlebih dahulu agar Netto terhitung otomatis dari aturan produk.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Dual Option: Camera vs Gallery */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                2. Ambil Foto atau Pilih Gambar Kertas Packing List <span className="text-red-500">*</span>
              </label>

              {/* Hidden Input 1: Kamera Langsung (capture="environment") */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                disabled={!selectedProductId}
                className="hidden"
              />

              {/* Hidden Input 2: Pilih dari Galeri/File */}
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={!selectedProductId}
                className="hidden"
              />

              {/* Tombol Pilihan */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={!selectedProductId}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow border border-blue-500 transition active:scale-95 disabled:opacity-50"
                >
                  <span className="text-sm">📸</span>
                  <span>Ambil Foto (Kamera)</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={!selectedProductId}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white dark:bg-gray-700 hover:bg-slate-100 dark:hover:bg-gray-600 text-slate-800 dark:text-white font-bold text-xs rounded-xl shadow-sm border border-slate-300 dark:border-gray-600 transition active:scale-95 disabled:opacity-50"
                >
                  <span className="text-sm">🖼️</span>
                  <span>Pilih dari Galeri</span>
                </button>
              </div>
            </div>
          </div>

          {/* Preview Image if uploaded */}
          {photoPreview && (
            <div className="mt-2 flex items-center gap-4 bg-white dark:bg-gray-800 p-2 rounded-lg border">
              <img src={photoPreview} alt="Preview" className="h-20 w-auto rounded object-cover border" />
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">{ocrPhoto?.name}</p>
                <p>Ukuran: {((ocrPhoto?.size || 0) / 1024).toFixed(1)} KB</p>
                <p className="text-indigo-600 dark:text-indigo-400 font-semibold">Siap diproses dengan Gemini AI</p>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="flex justify-end">
            <button
              onClick={handleProcessOcr}
              disabled={!selectedProductId || !ocrPhoto || ocrLoading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow flex items-center gap-2 disabled:opacity-50 transition"
            >
              {ocrLoading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Membaca Tulisan Tangan (Gemini AI)...</span>
                </>
              ) : (
                <>
                  <span>✨ Jalankan OCR Scan</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Step 2: OCR Preview & Interactive Verification Table */}
        {ocrResult && (
          <div className="space-y-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 flex flex-wrap justify-between items-center text-xs text-emerald-900 dark:text-emerald-300">
              <div>
                <p className="font-bold text-sm">✅ Hasil Pembacaan OCR Gemini (Selesai dalam {ocrResult.elapsed_seconds}s)</p>
                <p className="mt-0.5">
                  Produk: <strong>{ocrResult.product_name}</strong> | Aturan Potongan Netto: <strong>{ocrResult.netto_deduction_kg} kg</strong> per karton
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold">Total Karton Terdeteksi: {previewRows.length} Karton</p>
                <p className="text-emerald-700 dark:text-emerald-400">
                  Batch Terdeteksi: {ocrResult.batch_numbers_detected?.join(', ') || '-'}
                </p>
              </div>
            </div>

            {/* Additional Customer & Notes input (only for new PL creation) */}
            {!packingListId && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Customer (Opsional)</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Masukkan nama customer / PO..."
                    className="w-full px-3 py-1.5 text-xs border rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Catatan Tambahan</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Catatan packing..."
                    className="w-full px-3 py-1.5 text-xs border rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* Editable Preview Table */}
            <div className="border rounded-xl overflow-hidden shadow-sm">
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-gray-900 sticky top-0 font-bold border-b text-slate-700 dark:text-gray-300">
                    <tr>
                      <th className="px-3 py-2.5 text-center">No. Baris</th>
                      <th className="px-3 py-2.5">No. Karton (Rekonstruksi)</th>
                      <th className="px-3 py-2.5">Gross Weight (kg)</th>
                      <th className="px-3 py-2.5 text-indigo-700 dark:text-indigo-400">Netto (Otomatis)</th>
                      <th className="px-3 py-2.5">Nomor Batch</th>
                      <th className="px-3 py-2.5 text-center">Status / Match & Proteksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                    {previewRows.map((row, idx) => {
                      const isDuplicate = cartonCounts[row.carton_number_full] > 1;
                      const matchedItem = existingItems?.find(it => it.id === row.item_id || it.carton_number === row.carton_number_full);
                      const hasExistingWeight = matchedItem && matchedItem.weight_kg !== null && matchedItem.weight_kg > 0;

                      return (
                        <tr key={idx} className={isDuplicate ? 'bg-red-50/70 dark:bg-red-950/20' : hasExistingWeight ? 'bg-amber-50/70 dark:bg-amber-950/20' : ''}>
                          <td className="px-3 py-2 text-center text-slate-400 font-medium">{row.no || idx + 1}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={row.carton_number_full || ''}
                              onChange={(e) => handleRowChange(idx, 'carton_number_full', parseInt(e.target.value) || 0)}
                              className="w-24 px-2 py-1 border rounded text-xs font-bold text-blue-600 dark:bg-gray-700 dark:text-blue-400"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={row.gross_kg ?? ''}
                              onChange={(e) => handleRowChange(idx, 'gross_kg', e.target.value)}
                              className="w-24 px-2 py-1 border rounded text-xs font-bold text-slate-800 dark:bg-gray-700 dark:text-white"
                            />
                          </td>
                          <td className="px-3 py-2 font-black text-indigo-600 dark:text-indigo-400 text-sm">
                            {row.netto_kg !== undefined && row.netto_kg !== null ? `${row.netto_kg} kg` : '-'}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={row.batch_number || ''}
                              onChange={(e) => handleRowChange(idx, 'batch_number', e.target.value)}
                              className="w-36 px-2 py-1 border rounded text-xs dark:bg-gray-700 dark:text-white"
                            />
                          </td>
                          <td className="px-3 py-2 text-center text-[11px] space-y-0.5">
                            {/* SAFEGUARD #2: Badge Merah jika Duplikat */}
                            {isDuplicate && (
                              <div>
                                <span className="px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300 font-bold rounded border border-red-300">
                                  ❌ Duplikat Karton #{row.carton_number_full}!
                                </span>
                              </div>
                            )}

                            {/* SAFEGUARD #1: Badge Kuning jika Overwrite */}
                            {packingListId ? (
                              hasExistingWeight ? (
                                <div>
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 font-bold rounded border border-amber-300">
                                    ⚠️ Sudah ada timbangan ({matchedItem.weight_kg} kg) - akan ditimpa
                                  </span>
                                </div>
                              ) : row.item_id || matchedItem ? (
                                <div>
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 font-bold rounded border border-emerald-300">
                                    ✓ Matched (Karton #{row.carton_number_full})
                                  </span>
                                </div>
                              ) : (
                                <div>
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-bold rounded border border-amber-300">
                                    ⚠️ Nomor karton tidak terdaftar di PL ini
                                  </span>
                                </div>
                              )
                            ) : (
                              row.carton_number_note ? (
                                <span className="text-amber-600 dark:text-amber-400 font-semibold" title={row.carton_number_note}>
                                  ⚠️ {row.carton_number_note}
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓ OK</span>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Submit to System Button */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 border rounded-xl text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-gray-700"
              >
                Batal
              </button>
              <button
                onClick={handleSaveOcrPackingList}
                disabled={saveLoading}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow flex items-center gap-2 transition"
              >
                {saveLoading ? <span className="animate-spin">⏳</span> : '💾 Simpan Ke Database Packing List'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OcrPackingListModal;
