import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';
import SearchableSelect from '../../components/SearchableSelect';
import { showSuccess, showError, showWarning } from '../../components/ui/Toast';
import { Save, Plus, Trash2, ChevronDown, ChevronRight, ChevronLeft, Layers, CalendarRange, Factory, PackageCheck, AlertTriangle, Search, ArrowUpDown, ClipboardPaste, Pencil, Lock, TrendingUp } from 'lucide-react';
import PeriodSelectModal from './PeriodSelectModal';
import { periodLabel, shiftPeriod } from './forecastPeriod';

interface ForecastLine {
  id: number;
  product_id: number;
  product_name: string;
  product_code: string;
  qty_by_period: Record<string, number>;
  converted_qty_by_period: Record<string, number>;
  // Bulan-bulan yang qty-nya naik otomatis karena demand SO real melampaui target (2026-08-26)
  so_bumped_periods?: Record<string, string>;
}

interface ForecastHeaderDetail {
  id: number;
  period_start: string;
  period_end: string;
  name: string | null;
  status: string;
  window_start: string;
  window_months: string[]; // "YYYY-MM"[]
  earliest_period: string | null;
  latest_period: string | null;
  lines: ForecastLine[];
}

interface FgZone {
  location_id: number;
  location_name: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
}

interface WipOrder {
  wo_number: string;
  status: string;
  target_quantity: number;
  produced_quantity: number;
  remaining_quantity: number;
}

interface BomMaterial {
  material_id: number;
  material_name: string | null;
  material_code: string | null;
  uom: string;
  qty_per_unit: number;
  qty_needed: number | null;
  qty_available: number;
  shortage: number;
}

interface ComparisonRow {
  period: string; // "YYYY-MM"
  target: number;
  so_real: number;
  converted: number;
}

interface LineInventoryDetail {
  fg: FgZone[];
  wip: { total: number; work_orders: WipOrder[] };
  bom: { forecast_qty: number | null; materials: BomMaterial[] };
  comparison: ComparisonRow[];
}

interface Product { id: number; code: string; name: string; }

// Status realisasi per sel (manajemen, 2026-08-24): oranye = masih ada sisa forecast
// belum di-Work-Order-kan, abu-abu = pas sama persis, hijau = WO yang dibuat lebih dari forecast.
function realizationStatus(qty: number, convertedQty: number): 'none' | 'sisa' | 'pas' | 'lebih' {
  if (!convertedQty || convertedQty <= 0) return 'none';
  if (convertedQty < qty) return 'sisa';
  if (convertedQty > qty) return 'lebih';
  return 'pas';
}

// §7.2: SATU halaman untuk semua aksi - grid, tambah produk, edit qty, panel inventory
// per gudang - tidak ada perpindahan halaman untuk aksi-aksi ini.
// Rombak putaran 6 (2026-08-25, keputusan manajemen): grid TIDAK lagi punya window
// 12-bulan tetap per header - kolom grid = bulan KALENDER ASLI (header.window_months,
// "YYYY-MM"[] dari backend), rolling otomatis ikut hari ini kalau tidak ada ?window= di
// URL, dan bisa digeser bebas (tombol panah / dialog periode) buat lihat histori.
export default function SalesForecastGrid() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [header, setHeader] = useState<ForecastHeaderDetail | null>(null);
  const [original, setOriginal] = useState<Record<number, ForecastLine>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // §3 (masukan manajemen, 2026-08-25): begitu Simpan berhasil, grid masuk VIEW MODE
  // (angka terkunci, tombol Tambah Produk & Buat SPK disembunyikan) - klik Edit
  // buat buka kunci lagi. Mulai dari edit mode (belum pernah disimpan di sesi ini).
  const [isEditMode, setIsEditMode] = useState(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [addProductId, setAddProductId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const [expandedLine, setExpandedLine] = useState<number | null>(null);
  const [inventoryCache, setInventoryCache] = useState<Record<number, LineInventoryDetail>>({});
  const [inventoryLoading, setInventoryLoading] = useState(false);

  // §2 (masukan manajemen, 2026-08-25): input forecast cepat - copy-paste blok angka
  // langsung dari file Excel rencana marketing, plus cari/urutkan produk biar gampang
  // cocokkan urutan sama file Excel-nya.
  const [searchTerm, setSearchTerm] = useState('');
  const [sortAsc, setSortAsc] = useState<boolean | null>(null); // null = urutan asli

  // Seleksi sel ala Excel: klik=1 sel, shift+klik=perluas rentang, ctrl/cmd+klik=gabung
  // ke rentang, drag mouse=perluas rentang live. Posisi disimpan sbg index baris/kolom
  // (bukan id/period) supaya gampang dihitung rentangnya.
  const [selStart, setSelStart] = useState<{ row: number; col: number } | null>(null);
  const [selEnd, setSelEnd] = useState<{ row: number; col: number } | null>(null);
  const [isMouseSelecting, setIsMouseSelecting] = useState(false);
  // Fill handle: kotak kecil di pojok kanan-bawah rentang terpilih, ditarik buat
  // copy/tile nilai ke sel-sel di kanan/kiri/atas/bawah - snapshot nilai sumber diambil
  // begitu drag mulai supaya tidak berubah selagi ditarik.
  const [fillDrag, setFillDrag] = useState<{
    rowMin: number; rowMax: number; colMin: number; colMax: number;
    source: number[][]; targetRow: number; targetCol: number;
  } | null>(null);

  const [showPeriodPicker, setShowPeriodPicker] = useState(false);

  // §4 (rombak putaran 5/6, 2026-08-25): bulk convert - pilih 1 bulan kalender,
  // LANGSUNG semua produk yang qty-nya >0 di bulan itu jadi SPK produksi
  // (build-ahead) - tidak perlu customer/harga sama sekali.
  const [bulkPeriod, setBulkPeriod] = useState<string | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkRows, setBulkRows] = useState<Record<number, { quantity: string }>>({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const w = searchParams.get('window');
      const c = searchParams.get('count');
      if (w) params.set('window', w);
      if (c) params.set('count', c);
      const qs = params.toString();
      const res = await axiosInstance.get(`/api/sales/forecasts/${id}${qs ? `?${qs}` : ''}`);
      setHeader(res.data);
      const orig: Record<number, ForecastLine> = {};
      (res.data.lines || []).forEach((l: ForecastLine) => { orig[l.id] = { ...l, qty_by_period: { ...l.qty_by_period } }; });
      setOriginal(orig);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id, searchParams]);

  useEffect(() => { load(); }, [load]);

  // Default awal buka grid: kalau forecast sudah punya baris produk (berarti sudah
  // pernah disimpan sebelumnya), langsung tampil view mode - forecast kosong (baru
  // dibuat, belum ada produk) langsung edit mode supaya bisa langsung isi.
  const initializedEditMode = useRef(false);
  useEffect(() => {
    if (header && !initializedEditMode.current) {
      initializedEditMode.current = true;
      setIsEditMode(header.lines.length === 0);
    }
  }, [header]);

  const windowMonths = header?.window_months ?? [];

  // Kalau periode yang ditampilkan cuma 1 bulan, langsung siapkan bulk-convert utk
  // bulan itu (tidak perlu dropdown lagi karena cuma 1 pilihan) - lihat bagian render §4.
  useEffect(() => {
    setBulkPeriod(windowMonths.length === 1 ? windowMonths[0] : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowMonths.join(',')]);

  useEffect(() => {
    axiosInstance.get('/api/products?status=active&per_page=1000').then((res) => {
      setProducts(res.data.products || res.data.items || []);
    }).catch(() => {});
  }, []);

  const updateCell = (lineId: number, period: string, value: string) => {
    const num = value === '' ? 0 : parseFloat(value);
    setHeader((prev) => prev && {
      ...prev,
      lines: prev.lines.map((l) => (l.id === lineId ? { ...l, qty_by_period: { ...l.qty_by_period, [period]: isNaN(num) ? 0 : num } } : l)),
    });
  };

  // Sorted/filtered view produk - tidak mengubah urutan asli di header.lines (dipakai
  // buat cocokkan indeks paste), cuma dipakai buat render tabel + hitung posisi paste.
  const displayedLines = useMemo(() => {
    if (!header) return [];
    let lines = header.lines;
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      lines = lines.filter((l) => l.product_name?.toLowerCase().includes(q) || l.product_code?.toLowerCase().includes(q));
    }
    if (sortAsc !== null) {
      lines = [...lines].sort((a, b) => sortAsc
        ? (a.product_name || '').localeCompare(b.product_name || '')
        : (b.product_name || '').localeCompare(a.product_name || ''));
    }
    return lines;
  }, [header, searchTerm, sortAsc]);

  // Paste blok angka dari Excel (marketing sudah siapkan rencana forecast di sana) -
  // tab antar kolom (bulan), baris baru antar produk, mulai dari sel yang di-paste.
  // Urutan kolom & baris mengikuti windowMonths & displayedLines yang lagi tampil di
  // layar, supaya hasil paste sesuai apa yang user lihat (termasuk kalau sudah di-sort).
  const handlePasteCell = (e: React.ClipboardEvent<HTMLInputElement>, lineId: number, period: string) => {
    if (!isEditMode) return;
    const text = e.clipboardData.getData('text');
    if (!text || !text.includes('\t') && !text.includes('\n')) return; // 1 angka biasa: biarkan default
    e.preventDefault();
    const rows = text.replace(/\r/g, '').split('\n').filter((r, idx, arr) => !(idx === arr.length - 1 && r === ''));
    const rowStart = displayedLines.findIndex((l) => l.id === lineId);
    const colStart = windowMonths.indexOf(period);
    if (rowStart === -1 || colStart === -1) return;
    setHeader((prev) => {
      if (!prev) return prev;
      const updates: Record<number, Record<string, number>> = {};
      rows.forEach((rowText, r) => {
        const cells = rowText.split('\t');
        const targetLine = displayedLines[rowStart + r];
        if (!targetLine) return;
        cells.forEach((cellText, c) => {
          const targetPeriod = windowMonths[colStart + c];
          if (!targetPeriod) return;
          if (Number(targetLine.converted_qty_by_period?.[targetPeriod] || 0) > 0) return; // terkunci, sudah jadi WO
          const num = parseFloat(cellText.replace(/[^0-9.,-]/g, '').replace(',', '.'));
          if (isNaN(num)) return;
          updates[targetLine.id] = updates[targetLine.id] || {};
          updates[targetLine.id][targetPeriod] = num;
        });
      });
      return {
        ...prev,
        lines: prev.lines.map((l) => (updates[l.id] ? { ...l, qty_by_period: { ...l.qty_by_period, ...updates[l.id] } } : l)),
      };
    });
  };

  // Reset seleksi kalau tampilan berubah (sort/cari/ganti periode) - index baris/kolom
  // lama bisa nunjuk ke sel yang berbeda setelah tabel di-render ulang.
  useEffect(() => {
    setSelStart(null);
    setSelEnd(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, sortAsc, windowMonths.join(',')]);

  const selRect = selStart && selEnd ? {
    rowMin: Math.min(selStart.row, selEnd.row), rowMax: Math.max(selStart.row, selEnd.row),
    colMin: Math.min(selStart.col, selEnd.col), colMax: Math.max(selStart.col, selEnd.col),
  } : null;

  // Arah dominan + area yang bakal ke-isi kalau fill handle dilepas sekarang - dipakai
  // BAIK buat preview highlight yang jalan LIVE selagi drag (biar keliatan kaya nge-
  // shift-klik/drag biasa) MAUPUN buat benar-benar apply nilainya pas mouse dilepas.
  const computeFillExtension = (fd: NonNullable<typeof fillDrag>) => {
    const { rowMin, rowMax, colMin, colMax, targetRow, targetCol } = fd;
    const dRight = targetCol - colMax;
    const dLeft = colMin - targetCol;
    const dDown = targetRow - rowMax;
    const dUp = rowMin - targetRow;
    const maxD = Math.max(dRight, dLeft, dDown, dUp);
    if (maxD <= 0) return null;
    if (maxD === dRight) return { rowMin, rowMax, colMin: colMax + 1, colMax: targetCol, dir: 'right' as const };
    if (maxD === dLeft) return { rowMin, rowMax, colMin: targetCol, colMax: colMin - 1, dir: 'left' as const };
    if (maxD === dDown) return { rowMin: rowMax + 1, rowMax: targetRow, colMin, colMax, dir: 'down' as const };
    return { rowMin: targetRow, rowMax: rowMin - 1, colMin, colMax, dir: 'up' as const };
  };

  const fillPreview = fillDrag ? computeFillExtension(fillDrag) : null;

  const isCellSelected = (row: number, col: number) => !!selRect && row >= selRect.rowMin && row <= selRect.rowMax && col >= selRect.colMin && col <= selRect.colMax;
  const isCellFillPreview = (row: number, col: number) => !!fillPreview && row >= fillPreview.rowMin && row <= fillPreview.rowMax && col >= fillPreview.colMin && col <= fillPreview.colMax;
  const isFillHandleCell = (row: number, col: number) => !!selRect && row === selRect.rowMax && col === selRect.colMax && !fillDrag;

  const handleCellMouseDown = (e: React.MouseEvent, row: number, col: number) => {
    if (e.shiftKey && selStart) {
      setSelEnd({ row, col });
    } else if (e.ctrlKey || e.metaKey) {
      setSelStart((prev) => (prev ? { row: Math.min(prev.row, row), col: Math.min(prev.col, col) } : { row, col }));
      setSelEnd((prev) => (prev ? { row: Math.max(prev.row, row), col: Math.max(prev.col, col) } : { row, col }));
    } else {
      setSelStart({ row, col });
      setSelEnd({ row, col });
    }
    setIsMouseSelecting(true);
  };

  const handleCellMouseEnter = (row: number, col: number) => {
    if (isMouseSelecting) setSelEnd({ row, col });
    if (fillDrag) setFillDrag((prev) => (prev ? { ...prev, targetRow: row, targetCol: col } : prev));
  };

  const startFillDrag = (row: number, col: number) => {
    if (!selRect) return;
    const source: number[][] = [];
    for (let r = selRect.rowMin; r <= selRect.rowMax; r++) {
      const rowVals: number[] = [];
      for (let c = selRect.colMin; c <= selRect.colMax; c++) {
        const line = displayedLines[r];
        const period = windowMonths[c];
        rowVals.push(line && period ? Number(line.qty_by_period[period]) || 0 : 0);
      }
      source.push(rowVals);
    }
    setFillDrag({ rowMin: selRect.rowMin, rowMax: selRect.rowMax, colMin: selRect.colMin, colMax: selRect.colMax, source, targetRow: row, targetCol: col });
  };

  // Fill handle Excel: dari rentang sumber, tarik ke SATU arah dominan (kanan/kiri/
  // atas/bawah) - kalau nilai sumber lebih dari 1 sel, pola-nya di-tile berulang
  // (bukan cuma copy sel terakhir) persis behavior "Fill Series/Copy Cells" Excel.
  useEffect(() => {
    if (!isMouseSelecting && !fillDrag) return;
    const onUp = () => {
      setIsMouseSelecting(false);
      setFillDrag((fd) => {
        if (!fd) return null;
        const { rowMin, rowMax, colMin, colMax, source } = fd;
        const ext = computeFillExtension(fd);
        if (ext) {
          const srcH = rowMax - rowMin + 1;
          const srcW = colMax - colMin + 1;
          const updates: Record<number, Record<string, number>> = {};
          for (let r = ext.rowMin; r <= ext.rowMax; r++) {
            for (let c = ext.colMin; c <= ext.colMax; c++) {
              const line = displayedLines[r];
              const period = windowMonths[c];
              if (!line || !period) continue;
              if (Number(line.converted_qty_by_period?.[period] || 0) > 0) continue; // terkunci, sudah jadi WO
              let srcR: number, srcC: number;
              if (ext.dir === 'right' || ext.dir === 'left') {
                srcR = r - rowMin;
                const offset = ext.dir === 'right' ? (c - colMax - 1) : (colMin - c - 1);
                srcC = ((offset % srcW) + srcW) % srcW;
              } else {
                srcC = c - colMin;
                const offset = ext.dir === 'down' ? (r - rowMax - 1) : (rowMin - r - 1);
                srcR = ((offset % srcH) + srcH) % srcH;
              }
              const value = source[srcR]?.[srcC] ?? source[0][0];
              updates[line.id] = updates[line.id] || {};
              updates[line.id][period] = value;
            }
          }
          setHeader((prev) => prev && { ...prev, lines: prev.lines.map((l) => (updates[l.id] ? { ...l, qty_by_period: { ...l.qty_by_period, ...updates[l.id] } } : l)) });
          setSelStart({ row: Math.min(rowMin, ext.rowMin), col: Math.min(colMin, ext.colMin) });
          setSelEnd({ row: Math.max(rowMax, ext.rowMax), col: Math.max(colMax, ext.colMax) });
        }
        return null;
      });
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMouseSelecting, fillDrag, displayedLines, windowMonths.join(',')]);

  // Ctrl/Cmd+C dari input: kalau seleksi mencakup >1 sel, override copy bawaan browser
  // (yang cuma copy teks di 1 input itu) jadi TSV seluruh rentang - bisa di-paste balik
  // ke Excel juga.
  const handleCellCopy = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (!selRect || (selRect.rowMax === selRect.rowMin && selRect.colMax === selRect.colMin)) return;
    const tsv = [];
    for (let r = selRect.rowMin; r <= selRect.rowMax; r++) {
      const line = displayedLines[r];
      const rowVals = [];
      for (let c = selRect.colMin; c <= selRect.colMax; c++) {
        const period = windowMonths[c];
        rowVals.push(line && period ? String(Number(line.qty_by_period[period]) || 0) : '');
      }
      tsv.push(rowVals.join('\t'));
    }
    e.clipboardData.setData('text/plain', tsv.join('\n'));
    e.preventDefault();
  };

  const isLineChanged = (line: ForecastLine) => {
    const orig = original[line.id];
    if (!orig) return false;
    return windowMonths.some((p) => Number(orig.qty_by_period[p] || 0) !== Number(line.qty_by_period[p] || 0));
  };

  const changedCount = header ? header.lines.filter(isLineChanged).length : 0;

  const saveLine = async (line: ForecastLine): Promise<boolean> => {
    const updates = windowMonths.map((p) => ({ period: p, quantity: Number(line.qty_by_period[p]) || 0 }));
    try {
      await axiosInstance.put(`/api/sales/forecast-lines/${line.id}`, { updates });
      return true;
    } catch (e: any) {
      showError(e?.response?.data?.error || 'Gagal menyimpan');
      return false;
    }
  };

  const handleSaveAll = async () => {
    if (!header) return;
    setSaving(true);
    try {
      const changed = header.lines.filter(isLineChanged);
      let successCount = 0;
      for (const line of changed) {
        if (await saveLine(line)) successCount++;
      }
      if (successCount > 0) showSuccess(`${successCount} baris tersimpan`);
      load();
      setIsEditMode(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAddProduct = async () => {
    if (!addProductId || !header) return;
    setAdding(true);
    try {
      await axiosInstance.post(`/api/sales/forecasts/${header.id}/lines`, { product_id: addProductId });
      setAddProductId(null);
      load();
    } catch (e: any) {
      showError(e?.response?.data?.error || 'Gagal menambah baris produk');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteLine = async (lineId: number) => {
    if (!window.confirm('Hapus baris produk ini dari grid?')) return;
    try {
      await axiosInstance.delete(`/api/sales/forecast-lines/${lineId}`);
      load();
    } catch (e: any) {
      showError(e?.response?.data?.error || 'Gagal menghapus baris');
    }
  };

  const toggleExpand = async (line: ForecastLine) => {
    if (expandedLine === line.id) {
      setExpandedLine(null);
      return;
    }
    setExpandedLine(line.id);
    if (!inventoryCache[line.id]) {
      setInventoryLoading(true);
      try {
        // qty konteks buat cek kecukupan BOM: total qty di periode yang lagi
        // ditampilkan (1 bulan atau jumlah rentang bulan terpilih).
        const qty = periodTotal(line) || Number(line.qty_by_period[windowMonths[0]]) || 0;
        const periodsParam = windowMonths.join(',');
        const res = await axiosInstance.get(`/api/sales/forecast-lines/${line.id}/inventory?qty=${qty}&periods=${periodsParam}`);
        setInventoryCache((prev) => ({ ...prev, [line.id]: res.data }));
      } catch (e) {
        console.error(e);
      } finally {
        setInventoryLoading(false);
      }
    }
  };

  const periodTotal = (line: ForecastLine) => {
    let sum = 0;
    windowMonths.forEach((p) => { sum += Number(line.qty_by_period[p]) || 0; });
    return sum;
  };

  const periodGrandTotal = useMemo(() => {
    if (!header || windowMonths.length < 2) return 0;
    return header.lines.reduce((sum, l) => sum + periodTotal(l), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [header, windowMonths.join(',')]);

  // Sisa qty yang BELUM pernah dikirim ke Monthly Planning (qty forecast dikurangi yang
  // sudah pernah dikonversi) - bukan qty penuh. Ini yang nutup celah "kirim dobel" (masukan
  // user 2026-08-26): kalau tombol "Kirim ke Monthly Planning" diklik lagi buat bulan yang
  // sama, produk yang sudah PENUH terkonversi otomatis nggak ikut lagi (remaining=0), dan
  // yang baru SEBAGIAN terkonversi cuma ngirim sisanya, bukan qty penuh yang numpuk lagi.
  const remainingToConvert = (line: ForecastLine, period: string) => {
    const qty = Number(line.qty_by_period[period]) || 0;
    const converted = Number(line.converted_qty_by_period?.[period] || 0);
    return Math.max(qty - converted, 0);
  };

  // Semua baris yang MASIH ADA SISA di bulan terpilih - inilah yang otomatis masuk
  // Monthly Planning begitu bulk convert dijalankan. Tidak ada lagi pilih-pilih produk manual.
  const bulkLines = useMemo(() => {
    if (!header || !bulkPeriod) return [];
    return header.lines.filter((l) => remainingToConvert(l, bulkPeriod) > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [header, bulkPeriod]);

  const openBulkModal = () => {
    if (!header || !bulkPeriod) return;
    const rows: Record<number, { quantity: string }> = {};
    bulkLines.forEach((l) => {
      rows[l.id] = { quantity: String(remainingToConvert(l, bulkPeriod)) };
    });
    setBulkRows(rows);
    setBulkError(null);
    setShowBulkModal(true);
  };

  // Rombak putaran 7 (keputusan manajemen 2026-08-26): forecast dikirim ke Monthly
  // Planning (routes/schedule_grid.py::MonthlySchedule) - BUKAN langsung jadi Work
  // Order lagi. PPIC review & pecah ke Weekly Planning per minggu sebelum WO beneran
  // terbit (modul-modul itu sudah ada lengkap, tinggal disambungkan). Forecast tetap
  // agregat semua customer, jadi tidak butuh customer/harga di sini.
  const handleBulkConvert = async () => {
    if (!header || !bulkPeriod) return;
    setBulkError(null);
    const items = bulkLines.map((l) => ({
      line_id: l.id,
      quantity: parseFloat(bulkRows[l.id]?.quantity || '0'),
    }));
    if (items.some((it) => !it.quantity || it.quantity <= 0)) {
      setBulkError('Isi quantity (>0) untuk semua produk.');
      return;
    }
    setBulkSaving(true);
    try {
      const res = await axiosInstance.post(`/api/sales/forecasts/${header.id}/bulk-convert-to-order`, {
        period: bulkPeriod,
        items,
      });
      // Backend menandai produk yang belum ada Production Recipe default/mesin
      // (has_recipe) - baris Monthly Schedule-nya tetap dibuat, tapi PPIC perlu pilih
      // mesin manual sebelum lanjut di-approve/generate WO.
      const needsAttention = (res.data.schedules || []).some((w: any) => !w.has_recipe);
      if (needsAttention) {
        showWarning(res.data.message);
      } else {
        showSuccess(res.data.message);
      }
      setShowBulkModal(false);
      load();
    } catch (e: any) {
      setBulkError(e?.response?.data?.error || 'Gagal bulk convert');
    } finally {
      setBulkSaving(false);
    }
  };

  // Geser window 1 bulan (mundur = lihat histori, maju = lihat depan) tanpa buka
  // dialog - tetap pakai count yang lagi aktif.
  const shiftWindow = (delta: number) => {
    if (!header) return;
    const newWindow = shiftPeriod(header.window_start.slice(0, 7), delta);
    setSearchParams({ window: newWindow, count: String(windowMonths.length) });
  };

  if (loading) return <div className="text-center py-10 text-gray-500">Memuat...</div>;
  if (!header) return <div className="text-center py-10 text-gray-500">Forecast tidak ditemukan</div>;

  const existingProductIds = new Set(header.lines.map((l) => l.product_id));
  const productOptions = products.filter((p) => !existingProductIds.has(p.id));
  const isRolling = !searchParams.get('window'); // tidak ada ?window= eksplisit = rolling

  return (
    <div className="p-4 md:p-6 max-w-full mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div>
          <button onClick={() => navigate('/app/sales/forecasts')} className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-1">
            &larr; Semua Forecast
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {header.name}
          </h1>
        </div>
      </div>

      {/* §1 (rombak putaran 2/6): grid hanya menampilkan periode yang dipilih via dialog -
          panel ini menunjukkan periode aktif + tombol geser cepat ± 1 bulan + tombol
          untuk mengubah lewat dialog (rolling/1 bulan/rentang). */}
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300 inline-flex items-center gap-1"><CalendarRange className="w-3.5 h-3.5" /> Periode:</span>
            <button onClick={() => shiftWindow(-1)} className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300" title="Geser mundur 1 bulan">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {windowMonths.length <= 1 ? periodLabel(windowMonths[0]) : `${periodLabel(windowMonths[0])} – ${periodLabel(windowMonths[windowMonths.length - 1])}`}
            </span>
            <button onClick={() => shiftWindow(1)} className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300" title="Geser maju 1 bulan">
              <ChevronRight className="w-4 h-4" />
            </button>
            {isRolling && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">rolling</span>
            )}
            <button
              onClick={() => setShowPeriodPicker(true)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Ubah Periode
            </button>
          </div>
          {windowMonths.length > 1 && (
            <div className="text-sm">
              Total {windowMonths.length} bulan: <span className="font-semibold">{periodGrandTotal.toLocaleString('id-ID')}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-3">
          {isEditMode ? (
            <button
              onClick={handleSaveAll}
              disabled={saving || changedCount === 0}
              className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> Simpan {changedCount > 0 ? `(${changedCount})` : ''}
            </button>
          ) : (
            <>
              <span className="inline-flex items-center gap-1 px-3 py-2 text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <Lock className="w-3.5 h-3.5" /> Tersimpan - mode lihat saja
              </span>
              <button
                onClick={() => setIsEditMode(true)}
                className="inline-flex items-center gap-1 px-4 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-800"
              >
                <Pencil className="w-4 h-4" /> Edit
              </button>
            </>
          )}
        </div>
      </div>

      {isEditMode && (
        <div className="flex items-center gap-2 mb-4">
          <div className="w-72">
            <SearchableSelect
              options={productOptions.map((p) => ({ id: p.id, code: p.code, name: p.name }))}
              value={addProductId}
              onChange={(v) => setAddProductId(v as number)}
              placeholder="Cari & tambah produk..."
            />
          </div>
          <button
            onClick={handleAddProduct}
            disabled={!addProductId || adding}
            className="inline-flex items-center gap-1 px-3 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Tambah Baris
          </button>
        </div>
      )}

      {/* §2: cari produk (biar gampang cocokkan urutan sama file Excel rencana marketing).
          Urutkan nama sekarang lewat klik header kolom "Produk" di tabel, bukan di sini. */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari produk..."
            className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
          />
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
          <ClipboardPaste className="w-3.5 h-3.5" /> Ketik/paste dari Excel, drag kotak kecil di pojok sel buat isi cepat, shift/ctrl+klik buat pilih banyak sel.
        </span>
      </div>

      {/* §4 (rombak putaran 7): kirim 1 bulan penuh ke Monthly Planning - semua produk
          yang qty-nya >0 di bulan itu otomatis masuk, tidak perlu dicentang manual.
          PPIC review & pecah ke Weekly Planning dari sana (bukan langsung jadi WO lagi).
          Cuma muncul di edit mode (§3). */}
      {isEditMode && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-gray-500 flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Kirim ke Monthly Planning{windowMonths.length === 1 ? ` - ${periodLabel(windowMonths[0])}` : ':'}</span>
          {windowMonths.length > 1 && (
            <select
              value={bulkPeriod ?? ''}
              onChange={(e) => setBulkPeriod(e.target.value || null)}
              className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
            >
              <option value="">Pilih bulan...</option>
              {windowMonths.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
            </select>
          )}
          {bulkPeriod && (
            <button
              onClick={openBulkModal}
              disabled={bulkLines.length === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              Kirim {bulkLines.length > 0 ? `${bulkLines.length} ` : ''}Produk
            </button>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800/80">
                <th className="px-3 py-3 text-left font-semibold text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 w-56 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                  <button
                    onClick={() => setSortAsc((prev) => (prev === null ? true : prev === true ? false : null))}
                    className="inline-flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
                    title="Urutkan nama produk"
                  >
                    Produk
                    <ArrowUpDown className={`w-3 h-3 ${sortAsc === true ? 'text-blue-600 dark:text-blue-400' : sortAsc === false ? 'text-blue-600 dark:text-blue-400 rotate-180' : 'text-gray-300'}`} />
                  </button>
                </th>
                {windowMonths.map((period) => (
                  <th
                    key={period}
                    className={`px-1 py-3 text-center font-semibold text-[11px] uppercase tracking-wide w-24 transition-colors ${
                      bulkPeriod === period ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-900/30' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {periodLabel(period)}
                  </th>
                ))}
                {windowMonths.length > 1 && (
                  <th className="px-2 py-3 text-center font-semibold text-[11px] uppercase tracking-wide text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 w-28">
                    Total Periode
                  </th>
                )}
                <th className="px-2 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {displayedLines.map((line, rowIdx) => (
                <React.Fragment key={line.id}>
                  <tr className={`group border-t border-gray-100 dark:border-gray-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-900/10 ${rowIdx % 2 === 1 ? 'bg-gray-50/60 dark:bg-gray-800/20' : 'bg-white dark:bg-gray-900'}`}>
                    <td className={`px-3 py-2.5 sticky left-0 z-10 align-top shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] ${rowIdx % 2 === 1 ? 'bg-gray-50/60 dark:bg-gray-800/20' : 'bg-white dark:bg-gray-900'} group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/10`}>
                      <button onClick={() => toggleExpand(line)} className="flex items-center gap-2 text-left w-full">
                        {expandedLine === line.id ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-400" />}
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold shrink-0">
                          {line.product_name?.charAt(0).toUpperCase() || '?'}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium text-gray-800 dark:text-gray-100 truncate">{line.product_name}</span>
                          <span className="block text-[10px] text-gray-400 font-mono">{line.product_code}</span>
                        </span>
                      </button>
                    </td>
                    {windowMonths.map((period, colIdx) => {
                      const qty = Number(line.qty_by_period[period]) || 0;
                      const convertedQty = Number(line.converted_qty_by_period?.[period] || 0);
                      const status = realizationStatus(qty, convertedQty);
                      // "Grid forecast harus hidup" (2026-08-26): keterangan visual - bukan
                      // notifikasi terpisah - buat sel yang target-nya naik otomatis karena
                      // demand SO real melampaui forecast (lihat _bump_forecast_for_so_item).
                      const soBumpedAt = line.so_bumped_periods?.[period];
                      // §4 (masukan manajemen, 2026-08-25): sel yang sudah pernah di-Work-
                      // Order-kan (convertedQty > 0) TIDAK boleh diketik ulang lagi sama
                      // sekali - angka forecast-nya sudah "terkunci ke kenyataan produksi",
                      // jadi tampil sebagai status sisa/pas/lebih, bukan input polos lagi.
                      const isLocked = status !== 'none';
                      const isBulkCol = bulkPeriod === period;
                      const selected = isCellSelected(rowIdx, colIdx);
                      const fillPreviewCell = isCellFillPreview(rowIdx, colIdx);
                      const isHandle = isFillHandleCell(rowIdx, colIdx) && isEditMode && !isLocked;
                      return (
                        <td
                          key={period}
                          onMouseDown={(e) => handleCellMouseDown(e, rowIdx, colIdx)}
                          onMouseEnter={() => handleCellMouseEnter(rowIdx, colIdx)}
                          className={`relative px-1.5 py-2.5 align-top select-none ${isBulkCol ? 'bg-indigo-50/70 dark:bg-indigo-900/10' : ''} ${
                            selected ? 'ring-2 ring-inset ring-blue-400 bg-blue-50/50 dark:bg-blue-900/10' :
                            fillPreviewCell ? 'border-2 border-dashed border-blue-400 bg-blue-50/30 dark:bg-blue-900/5' : ''
                          }`}
                        >
                          {isLocked ? (
                            <div className={`w-full px-1.5 py-1.5 rounded-md text-center font-semibold tabular-nums border ${
                              status === 'sisa' ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800' :
                              status === 'lebih' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800' :
                              'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                            }`}>
                              {qty.toLocaleString('id-ID')}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                value={qty}
                                disabled={!isEditMode}
                                onChange={(e) => updateCell(line.id, period, e.target.value)}
                                onFocus={(e) => e.target.select()}
                                onPaste={(e) => handlePasteCell(e, line.id, period)}
                                onCopy={handleCellCopy}
                                className="w-full px-1.5 py-1.5 border border-transparent rounded-md bg-gray-50 dark:bg-gray-800 text-center font-medium tabular-nums text-gray-700 dark:text-gray-100 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition-shadow disabled:opacity-70 disabled:cursor-not-allowed"
                              />
                            </div>
                          )}
                          {status !== 'none' && (
                            <div className={`text-[10px] text-center mt-1 rounded-full px-1.5 py-0.5 font-medium ${
                              status === 'sisa' ? 'text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-900/30' :
                              status === 'lebih' ? 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30' :
                              'text-gray-500 bg-gray-100 dark:text-gray-400 dark:bg-gray-800'
                            }`}>
                              {convertedQty.toLocaleString('id-ID')}/{qty.toLocaleString('id-ID')}
                            </div>
                          )}
                          {isHandle && (
                            <div
                              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); startFillDrag(rowIdx, colIdx); }}
                              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-600 border border-white dark:border-gray-900 cursor-crosshair z-10"
                              title="Tarik buat isi cepat"
                            />
                          )}
                          {soBumpedAt && (
                            <div
                              className="absolute top-0.5 right-0.5 text-blue-500 dark:text-blue-400"
                              title={`Naik otomatis dari demand SO real (${new Date(soBumpedAt).toLocaleString('id-ID')})`}
                            >
                              <TrendingUp className="w-3 h-3" />
                            </div>
                          )}
                        </td>
                      );
                    })}
                    {windowMonths.length > 1 && (
                      <td className="px-2 py-2.5 align-top text-center font-semibold tabular-nums text-blue-700 dark:text-blue-300 bg-blue-50/40 dark:bg-blue-900/10">
                        {periodTotal(line).toLocaleString('id-ID')}
                      </td>
                    )}
                    <td className="px-2 py-2.5 align-top">
                      {isEditMode && (
                      <button
                        onClick={() => handleDeleteLine(line.id)}
                        className="w-6 h-6 flex items-center justify-center rounded-full text-gray-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Hapus baris"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      )}
                    </td>
                  </tr>
                  {expandedLine === line.id && (
                    <tr>
                      <td colSpan={15} className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-800">
                        {inventoryLoading && !inventoryCache[line.id] ? (
                          <div className="text-gray-400 text-xs">Memuat FG / WIP / BOM...</div>
                        ) : !inventoryCache[line.id] ? (
                          <div className="text-gray-400 text-xs">Gagal memuat data.</div>
                        ) : (() => {
                          const detail = inventoryCache[line.id];
                          const fgTotal = detail.fg.reduce((s, z) => s + z.quantity_available, 0);
                          const shortages = detail.bom.materials.filter((m) => m.shortage > 0);
                          return (
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
                                <span className="inline-flex items-center gap-1.5">
                                  <PackageCheck className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                  <span className="text-gray-500">Stok FG</span>
                                  <span className="font-semibold text-gray-800 dark:text-gray-100 tabular-nums">{fgTotal.toLocaleString('id-ID')}</span>
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                  <Factory className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  <span className="text-gray-500">WIP</span>
                                  <span className="font-semibold text-gray-800 dark:text-gray-100 tabular-nums">{detail.wip.total.toLocaleString('id-ID')}</span>
                                  {detail.wip.work_orders.length > 0 && (
                                    <span className="text-gray-400">({detail.wip.work_orders.length} WO)</span>
                                  )}
                                </span>
                                <span className="inline-flex items-center gap-1.5 flex-wrap">
                                  <Layers className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  <span className="text-gray-500">Bahan Baku</span>
                                  {detail.bom.materials.length === 0 ? (
                                    <span className="text-gray-400">tidak ada BOM aktif</span>
                                  ) : shortages.length === 0 ? (
                                    <span className="font-semibold text-green-600 dark:text-green-400">cukup semua</span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 flex-wrap">
                                      {shortages.map((m) => (
                                        <span key={m.material_id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-medium" title={m.material_name || ''}>
                                          <AlertTriangle className="w-3 h-3" /> {m.material_name}: kurang {m.shortage.toLocaleString('id-ID')}
                                        </span>
                                      ))}
                                    </span>
                                  )}
                                </span>
                              </div>
                              {detail.comparison && detail.comparison.length > 0 && (
                                <div className="overflow-x-auto">
                                  <table className="text-[11px] border-collapse">
                                    <thead>
                                      <tr className="text-gray-400">
                                        <th className="text-left font-medium pr-3 py-0.5">Bulan</th>
                                        <th className="text-right font-medium px-3 py-0.5">Target</th>
                                        <th className="text-right font-medium px-3 py-0.5">SO Real</th>
                                        <th className="text-right font-medium pl-3 py-0.5">Ke Monthly Planning</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detail.comparison.map((c) => (
                                        <tr key={c.period} className="border-t border-gray-200 dark:border-gray-700">
                                          <td className="pr-3 py-0.5 text-gray-500 font-mono">{c.period}</td>
                                          <td className="text-right px-3 py-0.5 tabular-nums text-gray-700 dark:text-gray-200">{c.target.toLocaleString('id-ID')}</td>
                                          <td className={`text-right px-3 py-0.5 tabular-nums font-medium ${c.so_real > c.target ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'}`}>
                                            {c.so_real.toLocaleString('id-ID')}
                                          </td>
                                          <td className="text-right pl-3 py-0.5 tabular-nums text-gray-500">{c.converted.toLocaleString('id-ID')}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {displayedLines.length === 0 && (
                <tr><td colSpan={15} className="px-4 py-10 text-center text-gray-400">
                  {header.lines.length === 0 ? 'Belum ada produk di grid ini — cari & tambah di atas.' : `Tidak ada produk yang cocok dengan "${searchTerm}".`}
                </td></tr>
              )}
            </tbody>
            {header.lines.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                  <td className="px-3 py-2.5 sticky left-0 z-10 bg-gray-50 dark:bg-gray-800/60 text-[11px] font-semibold uppercase tracking-wide text-gray-500 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                    Total
                  </td>
                  {windowMonths.map((period) => {
                    const colTotal = header.lines.reduce((sum, l) => sum + (Number(l.qty_by_period[period]) || 0), 0);
                    return (
                      <td key={period} className="px-1.5 py-2.5 text-center font-semibold tabular-nums text-gray-700 dark:text-gray-200">
                        {colTotal.toLocaleString('id-ID')}
                      </td>
                    );
                  })}
                  {windowMonths.length > 1 && (
                    <td className="px-2 py-2.5 text-center font-bold tabular-nums text-blue-700 dark:text-blue-300">
                      {periodGrandTotal.toLocaleString('id-ID')}
                    </td>
                  )}
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] text-gray-400">
        <span>Status realisasi:</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 font-medium">oranye = masih ada sisa</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 font-medium">abu-abu = pas sesuai forecast</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 font-medium">hijau = melebihi forecast</span>
      </div>

      {showPeriodPicker && (
        <PeriodSelectModal
          initialWindow={windowMonths[0]}
          initialCount={windowMonths.length}
          onClose={() => setShowPeriodPicker(false)}
          onConfirm={(newWindow, count) => {
            if (newWindow) {
              setSearchParams({ window: newWindow, count: String(count) });
            } else {
              setSearchParams({}); // rolling: biarkan backend selalu pakai bulan berjalan
            }
            setShowPeriodPicker(false);
          }}
        />
      )}

      {showBulkModal && bulkPeriod && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Kirim ke Monthly Planning</h3>
            <p className="text-sm text-gray-500 mb-4">{periodLabel(bulkPeriod)} - {bulkLines.length} produk (qty {'>'} 0) masuk sebagai rencana bulanan (draft) di halaman Monthly Production Plan, tinggal direview PPIC & dipecah ke Weekly Planning per minggu.</p>
            {bulkError && <div className="mb-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">{bulkError}</div>}
            <div className="max-h-72 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-2 py-2 text-left">Produk</th>
                    <th className="px-2 py-2 text-right w-28">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {bulkLines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-2 py-2">{l.product_code} - {l.product_name}</td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          value={bulkRows[l.id]?.quantity ?? ''}
                          onChange={(e) => setBulkRows({ ...bulkRows, [l.id]: { quantity: e.target.value } })}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-right"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn-outline" onClick={() => setShowBulkModal(false)} disabled={bulkSaving}>Batal</button>
              <button className="btn-primary" onClick={handleBulkConvert} disabled={bulkSaving}>
                {bulkSaving ? 'Memproses...' : `Kirim ${bulkLines.length} Produk`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
