import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as fabric from 'fabric';
import toast from 'react-hot-toast';
import axiosInstance from '../../utils/axiosConfig';
import {
  Save, UploadCloud, Eye, Undo2, Redo2, Trash2, Type, Tag, Image as ImageIcon,
  QrCode, Barcode, Minus, Square, Table2, ArrowLeft, History, ZoomIn, ZoomOut,
} from 'lucide-react';

// 1 Fabric unit = 1mm, always (design decision - see Print Template Designer
// Fase 1 plan). PX_PER_MM is ONLY the on-screen zoom factor so mm-sized
// objects are comfortably visible; it is never baked into stored coordinates -
// canvas.toJSON() always comes out in real mm because zoom lives in the
// canvas viewportTransform, not in individual object left/top/width/height.
const PX_PER_MM = 3.5;

// fontSize is a Fabric object property too, so per the "1 Fabric unit = 1mm"
// invariant above it needs to live in the same mm space as left/top/width so
// canvas.setZoom(PX_PER_MM) scales it consistently with everything else -
// otherwise text renders progressively more oversized/overlapping on the
// canvas than its box the larger PX_PER_MM is, while the backend (which
// converts stored mm back to pt for WeasyPrint, see
// template_render_engine.py) stays correct, causing editor vs PDF output
// to visibly disagree. Font size is authored/displayed to the user in pt
// (the unit everyone actually thinks in for text), converted to this mm
// space only at the Fabric object boundary.
const MM_PER_PT = 1 / 2.83465;

const PAPER_SIZES_MM: Record<string, [number, number]> = {
  A4: [210, 297], A5: [148, 210], Letter: [216, 279], Legal: [216, 356], F4: [215, 330],
};

type ElementType = 'label' | 'field' | 'image' | 'barcode' | 'qrcode' | 'line' | 'box' | 'repeating_table';

interface FieldLibraryEntry {
  path: string;
  label: string;
  type: 'scalar' | 'image' | 'list';
  columns?: { path: string; label: string }[];
}

interface FieldLibraryResponse {
  [group: string]: FieldLibraryEntry[];
}

// Custom properties Fabric must carry through toJSON()/loadFromJSON() for every
// object - this list is passed to canvas.toJSON([...]) verbatim, so anything
// the render engine (utils/template_render_engine.py) reads from an object
// MUST be registered here or it silently gets dropped on save.
const CUSTOM_PROPS = [
  'elementType', 'fieldPath', 'staticValue', 'dataSource', 'columns',
  'rowHeight', 'headerHeight', 'showHeader',
  'format', 'gridColor', 'headerBg', 'headerColor', 'zebra', 'minRows', 'tableFontSize', 'cellFill', 'flow', 'flowAfter',
];

// Field library group keys come straight from the backend's document_type
// strings (e.g. 'purchase_order', 'spk_batch') - not meant as display labels.
// Known ones get a proper Indonesian label; anything new falls back to a
// generic "replace underscore, capitalize each word" so it's never literally
// "Purchase_order" on screen.
const GROUP_LABELS: Record<string, string> = {
  company: 'Company', spk: 'SPK (SPK)', spk_batch: 'SPK (Batch)',
  surat_jalan: 'Surat Jalan', invoice: 'Invoice', purchase_order: 'Purchase Order',
  kwitansi: 'Kwitansi', faktur: 'Faktur',
};
const formatGroupLabel = (group: string) =>
  GROUP_LABELS[group] || group.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const TemplateVersionEditor: React.FC = () => {
  const { templateId, versionId } = useParams<{ templateId: string; versionId: string }>();
  const navigate = useNavigate();

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const historyRef = useRef<{ stack: any[]; index: number; suspend: boolean }>({ stack: [], index: -1, suspend: false });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [documentType, setDocumentType] = useState('');
  const [status, setStatus] = useState('draft');
  const [versionNumber, setVersionNumber] = useState(1);
  const [paperSize, setPaperSize] = useState('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [fieldLibrary, setFieldLibrary] = useState<FieldLibraryResponse>({});
  const [selected, setSelected] = useState<fabric.Object | null>(null);
  const [, forceRerender] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [changeNote, setChangeNote] = useState('');
  const [zoom, setZoom] = useState(1);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrlState] = useState<string | null>(null);

  // Revoke the blob URL when the modal is dismissed or the editor unmounts -
  // otherwise every preview leaks memory for the rest of the tab's lifetime.
  useEffect(() => {
    return () => { if (previewUrl) window.URL.revokeObjectURL(previewUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pageDimsMm = (): [number, number] => {
    const [w, h] = PAPER_SIZES_MM[paperSize] || PAPER_SIZES_MM.A4;
    return orientation === 'landscape' ? [h, w] : [w, h];
  };

  // ── Canvas lifecycle ──────────────────────────────────────────────
  // fabric.Canvas.dispose() is ASYNC (returns a Promise) in Fabric v6. React 18
  // StrictMode double-invokes this effect in dev (mount -> cleanup -> mount
  // again, synchronously) - without guarding against that, a second Canvas
  // gets created on the same <canvas> DOM node while the first instance's
  // dispose() is still rewriting that node's DOM wrapper, corrupting it (shows
  // as a solid black canvas). Fix: never reuse a canvas DOM element across
  // instances - create a fresh one imperatively inside the container on every
  // effect run, so overlapping dispose/init never touch the same node.
  useEffect(() => {
    // While `loading` is true, the component early-returns a placeholder
    // (see the `if (loading) return ...` below) - the canvas container <div>
    // this effect needs isn't in the DOM yet on that first run, so
    // canvasContainerRef.current is null and this bails out silently. `loading`
    // is listed as a dependency purely so this effect FIRES AGAIN once loading
    // flips to false and the container actually exists - without it, nothing
    // ever retries and no canvas is ever created (the bug this comment is
    // fixing: zero <canvas> elements in the DOM, no error, canvas area just
    // stays empty/black).
    if (!canvasContainerRef.current) return;
    const container = canvasContainerRef.current;
    const canvasEl = document.createElement('canvas');
    container.innerHTML = '';
    container.appendChild(canvasEl);

    const [wMm, hMm] = pageDimsMm();
    const canvas = new fabric.Canvas(canvasEl, {
      width: wMm * PX_PER_MM,
      height: hMm * PX_PER_MM,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
    });
    canvas.setZoom(PX_PER_MM);
    fabricCanvasRef.current = canvas;

    const pushHistory = () => {
      if (historyRef.current.suspend) return;
      const snapshot = canvas.toObject(CUSTOM_PROPS);
      const h = historyRef.current;
      h.stack = h.stack.slice(0, h.index + 1);
      h.stack.push(snapshot);
      h.index = h.stack.length - 1;
      setCanUndo(h.index > 0);
      setCanRedo(false);
      setIsDirty(true);
    };

    const onSelection = () => setSelected(canvas.getActiveObject() || null);
    const onSelectionCleared = () => setSelected(null);

    canvas.on('object:modified', pushHistory);
    canvas.on('object:added', pushHistory);
    canvas.on('object:removed', pushHistory);
    canvas.on('selection:created', onSelection);
    canvas.on('selection:updated', onSelection);
    canvas.on('selection:cleared', onSelectionCleared);

    return () => {
      canvas.dispose().catch(() => {});
      if (fabricCanvasRef.current === canvas) fabricCanvasRef.current = null;
      // Fabric wraps canvasEl in its own `.canvas-container` div on init, so
      // it's no longer a direct child of `container` by now - clear the whole
      // subtree rather than trying to removeChild(canvasEl) directly.
      container.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperSize, orientation, loading]);

  // ── Load version + field library ─────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes] = await Promise.all([
        axiosInstance.get(`/api/documents/templates/${templateId}/versions/${versionId}`),
      ]);
      const v = vRes.data.version;
      setDocumentType(v.document_type);
      setStatus(v.status);
      setVersionNumber(v.version_number);
      setPaperSize(v.paper_size || 'A4');
      setOrientation((v.orientation as 'portrait' | 'landscape') || 'portrait');

      const libRes = await axiosInstance.get(`/api/documents/field-library/${v.document_type}`);
      setFieldLibrary(libRes.data);

      // Canvas needs to exist first (sized to the right paper) before loading objects -
      // deferred to the next effect tick via a ref flag.
      pendingCanvasDataRef.current = v.canvas_data;
    } catch (e) {
      console.error(e);
      toast.error('Gagal memuat versi template');
    } finally {
      setLoading(false);
    }
  }, [templateId, versionId]);

  const pendingCanvasDataRef = useRef<any>(null);

  useEffect(() => { load(); }, [load]);

  // Once canvas is (re)created AND we have data pending, load it in.
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !pendingCanvasDataRef.current) return;
    const data = pendingCanvasDataRef.current;
    pendingCanvasDataRef.current = null;
    historyRef.current.suspend = true;
    canvas.loadFromJSON(data).then(() => {
      canvas.renderAll();
      historyRef.current.suspend = false;
      historyRef.current.stack = [canvas.toObject(CUSTOM_PROPS)];
      historyRef.current.index = 0;
      setCanUndo(false);
      setCanRedo(false);
      setIsDirty(false);
    });
  }, [loading, paperSize, orientation]);

  // ── Undo / Redo ───────────────────────────────────────────────────
  const applyHistoryIndex = (index: number) => {
    const canvas = fabricCanvasRef.current;
    const h = historyRef.current;
    if (!canvas || index < 0 || index >= h.stack.length) return;
    h.suspend = true;
    canvas.loadFromJSON(h.stack[index]).then(() => {
      canvas.renderAll();
      h.index = index;
      h.suspend = false;
      setCanUndo(index > 0);
      setCanRedo(index < h.stack.length - 1);
      setSelected(null);
      setIsDirty(true);
    });
  };
  const handleUndo = () => applyHistoryIndex(historyRef.current.index - 1);
  const handleRedo = () => applyHistoryIndex(historyRef.current.index + 1);

  // ── Add element helpers ───────────────────────────────────────────
  const addObject = (obj: fabric.Object) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.add(obj);
    canvas.setActiveObject(obj);
    canvas.renderAll();
  };

  const addLabel = () => {
    const obj = new fabric.Textbox('Teks label', {
      left: 10, top: 10, width: 60, fontSize: 10 * MM_PER_PT, fill: '#000000',
    });
    (obj as any).elementType = 'label';
    addObject(obj);
  };

  const addField = (field: FieldLibraryEntry) => {
    const obj = new fabric.Textbox(field.label, {
      left: 10, top: 10, width: 60, fontSize: 10 * MM_PER_PT, fill: '#000000',
    });
    (obj as any).elementType = 'field';
    (obj as any).fieldPath = field.path;
    addObject(obj);
  };

  const addImage = (field?: FieldLibraryEntry) => {
    const rect = new fabric.Rect({
      left: 10, top: 10, width: 30, height: 20, fill: '#f3f4f6', stroke: '#9ca3af', strokeWidth: 1,
    });
    const label = new fabric.FabricText(field ? field.label : 'Gambar', { fontSize: 8, fill: '#6b7280' });
    const group = new fabric.Group([rect, label], { left: 10, top: 10 });
    (group as any).elementType = 'image';
    if (field) (group as any).fieldPath = field.path;
    addObject(group);
  };

  const addCode = (kind: 'barcode' | 'qrcode', field?: FieldLibraryEntry) => {
    const size = kind === 'qrcode' ? 25 : 40;
    const rect = new fabric.Rect({
      left: 10, top: 10, width: size, height: kind === 'qrcode' ? size : 15, fill: '#f3f4f6', stroke: '#9ca3af', strokeWidth: 1,
    });
    const label = new fabric.FabricText(kind === 'qrcode' ? 'QR' : 'Barcode', { fontSize: 8, fill: '#6b7280' });
    const group = new fabric.Group([rect, label], { left: 10, top: 10 });
    (group as any).elementType = kind;
    if (field) (group as any).fieldPath = field.path;
    addObject(group);
  };

  const addLine = () => {
    const obj = new fabric.Line([0, 0, 60, 0], { left: 10, top: 10, stroke: '#000000', strokeWidth: 1 });
    (obj as any).elementType = 'line';
    addObject(obj);
  };

  const addBox = () => {
    const obj = new fabric.Rect({
      left: 10, top: 10, width: 60, height: 30, fill: 'transparent', stroke: '#000000', strokeWidth: 1,
    });
    (obj as any).elementType = 'box';
    addObject(obj);
  };

  const addRepeatingTable = (field: FieldLibraryEntry) => {
    const columns = (field.columns || []).map((c) => ({ fieldPath: c.path, label: c.label, width: 30, textAlign: 'left' }));
    const headerRect = new fabric.Rect({ left: 0, top: 0, width: 180, height: 8, fill: '#e5e7eb' });
    const headerText = new fabric.FabricText(
      `Tabel: ${field.label} (${columns.length} kolom)`,
      { left: 2, top: 1, fontSize: 8, fill: '#374151' }
    );
    const bodyRect = new fabric.Rect({ left: 0, top: 8, width: 180, height: 40, fill: '#ffffff', stroke: '#d1d5db', strokeDashArray: [4, 3] });
    const group = new fabric.Group([bodyRect, headerRect, headerText], { left: 10, top: 10 });
    (group as any).elementType = 'repeating_table';
    (group as any).dataSource = field.path;
    (group as any).columns = columns;
    (group as any).showHeader = true;
    addObject(group);
  };

  const deleteSelected = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !selected) return;
    canvas.remove(selected);
    canvas.discardActiveObject();
    canvas.renderAll();
    setSelected(null);
  };

  // ── Properties panel writes ───────────────────────────────────────
  const updateSelected = (props: Record<string, any>) => {
    if (!selected || !fabricCanvasRef.current) return;
    selected.set(props);
    selected.setCoords();
    fabricCanvasRef.current.renderAll();
    fabricCanvasRef.current.fire('object:modified');
    forceRerender((n) => n + 1);
  };

  // ── Save / Publish / Preview ──────────────────────────────────────
  const handleSaveDraft = async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const canvasData = canvas.toObject(CUSTOM_PROPS);
      await axiosInstance.put(`/api/documents/templates/${templateId}/versions/${versionId}`, {
        canvas_data: canvasData, paper_size: paperSize, orientation,
      });
      setIsDirty(false);
      toast.success('Draft disimpan');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Gagal menyimpan draft');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await handleSaveDraft();
      await axiosInstance.post(`/api/documents/templates/${templateId}/versions/${versionId}/publish`, { change_note: changeNote });
      setStatus('published');
      setShowPublishModal(false);
      toast.success('Versi ini sekarang live — dipakai untuk semua dokumen baru');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Gagal publish');
    } finally {
      setPublishing(false);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setShowPreviewModal(true);
    try {
      // Only draft versions are editable/saveable - published/archived ones are
      // frozen (the backend rejects PUT on them), so preview those as-is.
      if (status === 'draft') {
        await handleSaveDraft();
      }
      const res = await axiosInstance.post(
        `/api/documents/templates/${templateId}/versions/${versionId}/preview-pdf`,
        {},
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      setPreviewUrlState((prev) => {
        if (prev) window.URL.revokeObjectURL(prev);
        return url;
      });
    } catch (e: any) {
      setShowPreviewModal(false);
      toast.error(e?.response?.data?.error || 'Gagal membuat preview PDF');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleNewDraftFromHere = async () => {
    try {
      const res = await axiosInstance.post(`/api/documents/templates/${templateId}/versions`, {
        copy_from_version_id: versionId,
      });
      navigate(`/app/documents/templates/${templateId}/versions/${res.data.version_id}/edit`);
    } catch (e) {
      toast.error('Gagal membuat versi draft baru');
    }
  };

  const closePreviewModal = () => {
    setShowPreviewModal(false);
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
      setPreviewUrlState(null);
    }
  };

  const elementType = selected ? (selected as any).elementType as ElementType : null;
  const isTextLike = elementType === 'label' || elementType === 'field';
  const isLineOrBox = elementType === 'line' || elementType === 'box';
  const listFields: FieldLibraryEntry[] = Object.values(fieldLibrary).flat().filter((f) => f.type === 'list');

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Memuat editor...</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/app/documents/templates/${templateId}`)} className="p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {documentType} — v{versionNumber}
              <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                status === 'published' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                : status === 'archived' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              }`}>
                {status === 'published' ? 'Live' : status === 'archived' ? 'Arsip' : 'Draft'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select value={paperSize} onChange={(e) => setPaperSize(e.target.value)} disabled={status !== 'draft'}
            className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800">
            {Object.keys(PAPER_SIZES_MM).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={orientation} onChange={(e) => setOrientation(e.target.value as any)} disabled={status !== 'draft'}
            className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800">
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

          <button onClick={handleUndo} disabled={!canUndo} title="Undo" className="p-2 text-gray-500 disabled:opacity-30 hover:text-gray-800 dark:hover:text-gray-200">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={handleRedo} disabled={!canRedo} title="Redo" className="p-2 text-gray-500 disabled:opacity-30 hover:text-gray-800 dark:hover:text-gray-200">
            <Redo2 className="w-4 h-4" />
          </button>
          <button onClick={deleteSelected} disabled={!selected} title="Hapus elemen terpilih" className="p-2 text-red-500 disabled:opacity-30 hover:text-red-700">
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

          <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} title="Perkecil" className="p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} title="Perbesar" className="p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

          <button onClick={handlePreview} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
            <Eye className="w-3.5 h-3.5" /> Preview PDF
          </button>

          {status === 'draft' ? (
            <>
              <button onClick={handleSaveDraft} disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                <Save className="w-3.5 h-3.5" /> {saving ? 'Menyimpan...' : 'Simpan Draft'}
              </button>
              <button onClick={() => setShowPublishModal(true)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700">
                <UploadCloud className="w-3.5 h-3.5" /> Publish
              </button>
            </>
          ) : (
            <button onClick={handleNewDraftFromHere} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700">
              <History className="w-3.5 h-3.5" /> Buat Draft Baru dari Sini
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: palette + field library */}
        <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-y-auto p-3">
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Elemen</h4>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={addLabel} disabled={status !== 'draft'} className="flex flex-col items-center gap-1 p-2 border border-gray-200 dark:border-gray-700 rounded text-xs hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
                <Type className="w-4 h-4" /> Teks
              </button>
              <button onClick={() => addImage()} disabled={status !== 'draft'} className="flex flex-col items-center gap-1 p-2 border border-gray-200 dark:border-gray-700 rounded text-xs hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
                <ImageIcon className="w-4 h-4" /> Gambar
              </button>
              <button onClick={() => addCode('qrcode')} disabled={status !== 'draft'} className="flex flex-col items-center gap-1 p-2 border border-gray-200 dark:border-gray-700 rounded text-xs hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
                <QrCode className="w-4 h-4" /> QR Code
              </button>
              <button onClick={() => addCode('barcode')} disabled={status !== 'draft'} className="flex flex-col items-center gap-1 p-2 border border-gray-200 dark:border-gray-700 rounded text-xs hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
                <Barcode className="w-4 h-4" /> Barcode
              </button>
              <button onClick={addLine} disabled={status !== 'draft'} className="flex flex-col items-center gap-1 p-2 border border-gray-200 dark:border-gray-700 rounded text-xs hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
                <Minus className="w-4 h-4" /> Garis
              </button>
              <button onClick={addBox} disabled={status !== 'draft'} className="flex flex-col items-center gap-1 p-2 border border-gray-200 dark:border-gray-700 rounded text-xs hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
                <Square className="w-4 h-4" /> Kotak
              </button>
            </div>
          </div>

          {listFields.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Tabel Berulang</h4>
              {listFields.map((f) => (
                <button key={f.path} onClick={() => addRepeatingTable(f)} disabled={status !== 'draft'}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left border border-gray-200 dark:border-gray-700 rounded mb-1 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
                  <Table2 className="w-3.5 h-3.5 shrink-0" /> {f.label}
                </button>
              ))}
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Field Library</h4>
            {Object.entries(fieldLibrary).map(([group, fields]) => (
              <div key={group} className="mb-3">
                <div className="text-[11px] font-medium text-gray-400 mb-1">{formatGroupLabel(group)}</div>
                {fields.filter((f) => f.type !== 'list').map((f) => (
                  <button
                    key={f.path}
                    disabled={status !== 'draft'}
                    onClick={() => (f.type === 'image' ? addImage(f) : addField(f))}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
                    title={f.path}
                  >
                    {f.type === 'image' ? <ImageIcon className="w-3.5 h-3.5 shrink-0 text-gray-400" /> : <Tag className="w-3.5 h-3.5 shrink-0 text-gray-400" />}
                    {f.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Center: canvas
            justify-content:center on an overflow:auto flex container is a
            classic CSS trap: the moment the canvas (page width * zoom + this
            padding) is wider than the available pane - routine on laptop
            screens once the two side panels eat into viewport width - the
            browser clips the overflow on the LEFT by default instead of
            leaving it reachable by scrolling there, permanently hiding every
            element whose `left` put it in, say, the first ~60-80px of the
            page. That's what made the editor look like it was missing/had
            different content than the PDF: not a position-data bug, content
            was just clipped out of view. justify-start + a manual centering
            margin keeps the page reachable in full from scrollLeft 0 while
            still visually centering it when it fits. */}
        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-950 flex items-start justify-start p-8">
          <div className="shadow-lg shrink-0" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            <div ref={canvasContainerRef} />
          </div>
        </div>

        {/* Right: properties panel */}
        <div className="w-64 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-y-auto p-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Properti</h4>
          {!selected && <p className="text-xs text-gray-400">Pilih elemen di canvas untuk mengatur propertinya.</p>}
          {selected && (
            <div className="space-y-3">
              <div className="text-xs text-gray-500">Tipe: <span className="font-medium">{elementType}</span></div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-gray-500">X (mm)
                  <input type="number" value={Math.round((selected.left || 0))} onChange={(e) => updateSelected({ left: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800" />
                </label>
                <label className="text-[11px] text-gray-500">Y (mm)
                  <input type="number" value={Math.round((selected.top || 0))} onChange={(e) => updateSelected({ top: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800" />
                </label>
              </div>

              {isTextLike && (
                <>
                  {elementType === 'label' && (
                    <label className="text-[11px] text-gray-500 block">Teks
                      <input type="text" value={(selected as fabric.Textbox).text || ''} onChange={(e) => updateSelected({ text: e.target.value })}
                        className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800" />
                    </label>
                  )}
                  <label className="text-[11px] text-gray-500 block">Ukuran Font (pt)
                    <input type="number" value={Math.round(((selected as any).fontSize || 10 * MM_PER_PT) / MM_PER_PT)}
                      onChange={(e) => updateSelected({ fontSize: (parseInt(e.target.value) || 10) * MM_PER_PT })}
                      className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800" />
                  </label>
                  <label className="text-[11px] text-gray-500 block">Warna Teks
                    <input type="color" value={(selected as any).fill || '#000000'} onChange={(e) => updateSelected({ fill: e.target.value })}
                      className="w-full h-7 border border-gray-300 dark:border-gray-600 rounded" />
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-gray-500">Tebal
                      <input type="checkbox" checked={(selected as any).fontWeight === 'bold'} onChange={(e) => updateSelected({ fontWeight: e.target.checked ? 'bold' : 'normal' })} className="ml-1" />
                    </label>
                    <select value={(selected as any).textAlign || 'left'} onChange={(e) => updateSelected({ textAlign: e.target.value })}
                      className="text-xs px-1 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800">
                      <option value="left">Kiri</option>
                      <option value="center">Tengah</option>
                      <option value="right">Kanan</option>
                    </select>
                  </div>
                </>
              )}

              {isLineOrBox && (
                <>
                  <label className="text-[11px] text-gray-500 block">Warna Garis
                    <input type="color" value={(selected as any).stroke || '#000000'} onChange={(e) => updateSelected({ stroke: e.target.value })}
                      className="w-full h-7 border border-gray-300 dark:border-gray-600 rounded" />
                  </label>
                  <label className="text-[11px] text-gray-500 block">Ketebalan
                    <input type="number" value={(selected as any).strokeWidth || 1} onChange={(e) => updateSelected({ strokeWidth: parseInt(e.target.value) || 1 })}
                      className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800" />
                  </label>
                </>
              )}

              {(elementType === 'image' || elementType === 'barcode' || elementType === 'qrcode') && (
                <label className="text-[11px] text-gray-500 block">
                  Sumber Data (field dinamis)
                  <select
                    value={(selected as any).fieldPath || ''}
                    onChange={(e) => updateSelected({ fieldPath: e.target.value || undefined })}
                    className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                  >
                    <option value="">— Statis (tanpa field) —</option>
                    {Object.values(fieldLibrary).flat().filter((f) => elementType === 'image' ? f.type !== 'list' : true).map((f) => (
                      <option key={f.path} value={f.path}>{f.label}</option>
                    ))}
                  </select>
                </label>
              )}

              {elementType === 'repeating_table' ? (
                <label className="flex items-start gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                  <input type="checkbox" checked={!!(selected as any).flow} onChange={(e) => updateSelected({ flow: e.target.checked })} className="mt-0.5" />
                  <span>
                    Tabel mengikuti jumlah data (flow)
                    <span className="block text-[10px] text-gray-400">Tinggi tabel mengikuti jumlah baris. Elemen yang ditandai &quot;ikut turun&quot; berpindah tepat di bawah baris terakhir (dan lanjut ke halaman berikutnya bila data panjang). Hanya satu tabel per template yang boleh flow.</span>
                  </span>
                </label>
              ) : (
                <label className="flex items-start gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                  <input type="checkbox" checked={!!(selected as any).flowAfter} onChange={(e) => updateSelected({ flowAfter: e.target.checked })} className="mt-0.5" />
                  <span>
                    Ikut turun mengikuti tabel
                    <span className="block text-[10px] text-gray-400">Berlaku bila template punya tabel yang di-flow. Letakkan elemen di bawah tabel; saat dicetak jaraknya dari baris terakhir tetap sama dengan jarak di canvas.</span>
                  </span>
                </label>
              )}

              {elementType === 'repeating_table' && (
                <div className="text-xs text-gray-500">
                  <div>Sumber: <span className="font-medium">{(selected as any).dataSource}</span></div>
                  <div className="mt-1">{((selected as any).columns || []).length} kolom terkonfigurasi</div>
                  <p className="mt-2 text-[10px] text-gray-400">Kolom tabel diambil otomatis dari field library saat elemen ini ditambahkan. Untuk mengubah kolom, hapus dan tambahkan ulang dari panel "Tabel Berulang".</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showPublishModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowPublishModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Publish Versi {versionNumber}</h3>
            <p className="text-xs text-gray-500 mb-3">Versi ini akan jadi LIVE — dipakai untuk semua dokumen baru mulai sekarang. Versi yang sebelumnya live akan diarsipkan (tetap bisa di-rollback nanti, tidak dihapus).</p>
            <textarea
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="Catatan perubahan (opsional)"
              className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 mb-3"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowPublishModal(false)} className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300">Batal</button>
              <button onClick={handlePublish} disabled={publishing} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                {publishing ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={closePreviewModal}>
          <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-4xl h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Preview PDF</h3>
              <div className="flex items-center gap-2">
                {previewUrl && (
                  <a
                    href={previewUrl}
                    download={`preview-${documentType}-v${versionNumber}.pdf`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <Save className="w-3.5 h-3.5" /> Unduh
                  </a>
                )}
                <button onClick={closePreviewModal} className="p-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100 dark:bg-gray-950 overflow-hidden">
              {previewLoading && (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">Membuat preview PDF...</div>
              )}
              {!previewLoading && previewUrl && (
                <iframe title="Preview PDF" src={previewUrl} className="w-full h-full border-0" />
              )}
              {!previewLoading && !previewUrl && (
                <div className="h-full flex items-center justify-center text-sm text-red-500">Gagal memuat preview.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateVersionEditor;
