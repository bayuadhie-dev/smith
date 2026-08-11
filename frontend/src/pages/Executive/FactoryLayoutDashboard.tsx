import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import { renderMachineIcon } from '../../components/Production/MachineLayoutIcons';

interface MachineNode {
  id: number;
  wing_id: number;
  machine_id: number;
  machine_code: string | null;
  machine_name: string | null;
  icon_type: string;
  icon_variant: number | null;
  pos_x: number;
  pos_y: number;
  label_offset_x: number;
  label_offset_y: number;
  display_order: number;
  status: 'active' | 'inactive';
  oee: number | null;
}

interface Wing {
  id: number;
  name: string;
  subtitle: string | null;
  display_order: number;
  wing_x: number;
  wing_y: number;
  wing_oee_x: number;
  nodes: MachineNode[];
  wing_oee: number | null;
}

interface LayoutResponse {
  start_date: string;
  end_date: string;
  wings: Wing[];
}

interface DetailResponse {
  machine_id: number;
  machine_code: string;
  machine_name: string;
  alias_name: string | null;
  oee: number | null;
  downtime_hours: number;
  downtime_breakdown_minutes: Record<string, number>;
  top_downtime_category: string | null;
  target_quantity: number;
  actual_quantity: number;
  quality_breakdown: Record<string, { quantity: number; pct: number }>;
  dominant_quality: string | null;
  downtime_incidents: Record<string, { reason: string; count: number; total_minutes: number }[]>;
}

const COLORS = {
  bg: '#0d1117',
  blueprint: '#0f1c2b',
  line: '#4a7fc4',
  lineDim: '#22384f',
  amber: '#e8a33d',
  green: '#4caf7d',
  red: '#d15c5c',
  grey: '#5f6b7a',
  text: '#d8e2ee',
  textDim: '#6f83a0',
  textFaint: '#3d4d63',
};

const statusColor = (node: MachineNode): string => {
  if (node.status === 'inactive' || node.oee === null) return COLORS.grey;
  if (node.oee >= 60) return COLORS.green;
  if (node.oee >= 40) return COLORS.amber;
  return COLORS.red;
};

const DOWNTIME_LABELS: Record<string, string> = {
  mesin: 'Mesin', operator: 'Operator', material: 'Material', design: 'Design', others: 'Lainnya',
};
const QUALITY_LABELS: Record<string, string> = {
  good: 'Good', reject: 'Reject', rework: 'Rework',
};

const CANVAS_W = 1300;
const CANVAS_H = 1420;

const FactoryLayoutDashboard: React.FC = () => {
  const [range, setRange] = useState<'7' | '30' | '90'>('7');
  const [layout, setLayout] = useState<LayoutResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('Internal ERP');
  const [editMode, setEditMode] = useState(false);
  const [positions, setPositions] = useState<Record<number, { x: number; y: number }>>({});
  const [dragNodeId, setDragNodeId] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<MachineNode | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const dateRangeParams = useCallback(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - parseInt(range, 10));
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { start_date: fmt(start), end_date: fmt(end) };
  }, [range]);

  useEffect(() => {
    axiosInstance.get('/api/company/public')
      .then((res) => { if (res.data?.name) setCompanyName(res.data.name); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const { start_date, end_date } = dateRangeParams();
    axiosInstance
      .get('/api/executive/machine-layout', { params: { start_date, end_date } })
      .then((res) => {
        if (!cancelled) {
          setLayout(res.data);
          const initial: Record<number, { x: number; y: number }> = {};
          (res.data.wings || []).forEach((w: Wing) => {
            w.nodes.forEach((n) => { initial[n.id] = { x: n.pos_x, y: n.pos_y }; });
          });
          setPositions(initial);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Gagal memuat data denah produksi.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateRangeParams]);

  const handleNodeClick = (node: MachineNode) => {
    setSelectedNode(node);
    setDetail(null);
    setDetailLoading(true);
    const { start_date, end_date } = dateRangeParams();
    axiosInstance
      .get(`/api/executive/machine-layout/${node.machine_id}/detail`, { params: { start_date, end_date } })
      .then((res) => setDetail(res.data))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  };

  const getSvgPoint = (evt: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const transformed = pt.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  };

  const handleDragStart = (nodeId: number, e: React.MouseEvent) => {
    if (!editMode) return;
    e.stopPropagation();
    setDragNodeId(nodeId);
  };

  useEffect(() => {
    if (dragNodeId === null) return;
    const handleMove = (e: MouseEvent) => {
      const p = getSvgPoint(e);
      setPositions((prev) => ({ ...prev, [dragNodeId]: { x: Math.round(p.x), y: Math.round(p.y) } }));
      setDirty(true);
    };
    const handleUp = () => setDragNodeId(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragNodeId]);

  const handleSaveLayout = () => {
    if (!layout) return;
    setSaving(true);
    const updates = Object.entries(positions).map(([id, pos]) => ({ id: parseInt(id, 10), pos_x: pos.x, pos_y: pos.y }));
    axiosInstance
      .post('/api/executive/machine-layout/nodes/batch-update', { updates })
      .then(() => setDirty(false))
      .catch(() => setError('Gagal menyimpan layout.'))
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <div style={{ background: COLORS.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.bg, color: COLORS.text, fontFamily: "'IBM Plex Mono', monospace", minHeight: '100vh' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 20px 60px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 16, borderBottom: `1px solid ${COLORS.lineDim}`, marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, border: `1.5px solid ${COLORS.amber}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12, color: COLORS.amber }}>S</div>
            <div>
              <div style={{ fontSize: 9, letterSpacing: '0.14em', color: COLORS.textFaint, textTransform: 'uppercase' }}>Internal ERP · Production Monitoring</div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, margin: 0 }}>Denah Produksi — Blueprint View</h1>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as '7' | '30' | '90')}
              style={{ background: COLORS.blueprint, border: `1px solid ${COLORS.lineDim}`, color: COLORS.text, fontFamily: 'inherit', fontSize: 11, padding: '7px 10px' }}
            >
              <option value="7">7 Hari Terakhir</option>
              <option value="30">30 Hari Terakhir</option>
              <option value="90">90 Hari Terakhir</option>
            </select>
            <button
              onClick={() => setEditMode((v) => !v)}
              style={{
                background: editMode ? COLORS.amber : COLORS.blueprint,
                color: editMode ? '#1a1408' : COLORS.text,
                border: `1px solid ${editMode ? COLORS.amber : COLORS.lineDim}`,
                fontFamily: 'inherit', fontSize: 11, padding: '7px 10px', cursor: 'pointer', fontWeight: editMode ? 700 : 400,
              }}
            >
              {editMode ? 'Mode Edit: ON' : 'Mode Edit'}
            </button>
            {editMode && (
              <button
                onClick={handleSaveLayout}
                disabled={!dirty || saving}
                style={{
                  background: dirty ? COLORS.green : COLORS.lineDim,
                  color: dirty ? '#0a1f14' : COLORS.textFaint,
                  border: 'none', fontFamily: 'inherit', fontSize: 11, padding: '7px 10px',
                  cursor: dirty && !saving ? 'pointer' : 'not-allowed', fontWeight: 700,
                }}
              >
                {saving ? 'Menyimpan…' : dirty ? 'Simpan Layout' : 'Tersimpan'}
              </button>
            )}
          </div>
        </header>

        <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 16, fontSize: 11, color: COLORS.textDim, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: COLORS.green, display: 'inline-block' }} /> Bagus — OEE ≥ 60%</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: COLORS.amber, display: 'inline-block' }} /> Waspada — OEE 40–59%</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: COLORS.red, display: 'inline-block' }} /> Perlu Perbaikan — OEE &lt; 40%</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: COLORS.grey, display: 'inline-block' }} /> Tidak ada data</div>
        </div>

        {error && <div style={{ color: COLORS.red, marginBottom: 16 }}>{error}</div>}

        <div style={{ background: COLORS.blueprint, border: `1px solid ${COLORS.lineDim}`, padding: 18 }}>
          <div style={{ fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: COLORS.textFaint, marginBottom: 10 }}>
            GA-DRAWING · {companyName.toUpperCase()} · <b style={{ color: COLORS.line }}>LIVE</b>
          </div>

          <svg ref={svgRef} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} width="100%" style={{ display: 'block' }}>
            <defs>
              <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#182739" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect x="0" y="0" width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" />
            <line x1={CANVAS_W / 2} y1="20" x2={CANVAS_W / 2} y2={CANVAS_H - 20} stroke={COLORS.line} strokeWidth="2.5" />
            <line x1="20" y1={CANVAS_H / 2} x2={CANVAS_W - 20} y2={CANVAS_H / 2} stroke={COLORS.line} strokeWidth="2.5" />
            <circle cx={CANVAS_W / 2} cy={CANVAS_H / 2} r="4" fill={COLORS.line} />

            {(layout?.wings ?? []).map((wing) => (
              <g key={wing.id}>
                <text x={wing.wing_x} y={wing.wing_y} fontFamily="'Space Grotesk', sans-serif" fontWeight={700} fontSize={18} fill={COLORS.text}>
                  {wing.name}
                </text>
                {wing.subtitle && (
                  <text x={wing.wing_x} y={wing.wing_y + 18} fontSize={9} fill={COLORS.textFaint}>{wing.subtitle}</text>
                )}
                {wing.wing_oee !== null && (
                  <text x={wing.wing_oee_x} y={wing.wing_y} textAnchor="end" fontFamily="'Space Grotesk', sans-serif" fontWeight={700} fontSize={21}
                    fill={wing.wing_oee >= 60 ? COLORS.green : wing.wing_oee >= 40 ? COLORS.amber : COLORS.red}>
                    {wing.wing_oee}% OEE
                  </text>
                )}

                {wing.nodes.map((node) => {
                  const color = statusColor(node);
                  const pos = positions[node.id] || { x: node.pos_x, y: node.pos_y };
                  const bendX = pos.x + node.label_offset_x;
                  const labelY = pos.y + node.label_offset_y;
                  const isDragging = dragNodeId === node.id;
                  return (
                    <g
                      key={node.id}
                      style={{ cursor: editMode ? (isDragging ? 'grabbing' : 'grab') : 'pointer' }}
                      onClick={() => { if (!editMode) handleNodeClick(node); }}
                      onMouseDown={(e) => handleDragStart(node.id, e)}
                      opacity={isDragging ? 0.7 : 1}
                    >
                      <rect x={pos.x - 20} y={pos.y - 20} width={140} height={110} fill="transparent" />
                      <g transform={`translate(${pos.x}, ${pos.y}) scale(0.55)`}>
                        {renderMachineIcon(node.icon_type, color, node.icon_variant ?? undefined)}
                      </g>
                      <circle cx={pos.x} cy={pos.y} r="3" fill={COLORS.blueprint} stroke={color} strokeWidth="1.5" />
                      <path
                        d={`M${pos.x} ${pos.y} L${bendX} ${pos.y} L${bendX} ${labelY}`}
                        stroke={color}
                        strokeWidth="1"
                        fill="none"
                      />
                      <text x={bendX + (node.label_offset_x >= 0 ? 5 : -5)} y={labelY - 4} textAnchor={node.label_offset_x >= 0 ? 'start' : 'end'}
                        fill={COLORS.text} fontSize={11} fontWeight={600} fontFamily="'Inter', sans-serif">
                        {node.machine_name || node.machine_code}
                      </text>
                      <text x={bendX + (node.label_offset_x >= 0 ? 5 : -5)} y={labelY + 10} textAnchor={node.label_offset_x >= 0 ? 'start' : 'end'}
                        fill={COLORS.textFaint} fontSize={8}>
                        {node.machine_code}
                      </text>
                      <text x={bendX + (node.label_offset_x >= 0 ? 5 : -5)} y={labelY + 28} textAnchor={node.label_offset_x >= 0 ? 'start' : 'end'}
                        fill={color} fontFamily="'Space Grotesk', sans-serif" fontWeight={700} fontSize={15}>
                        {node.status === 'active' ? `${node.oee}%` : '—'}
                      </text>
                    </g>
                  );
                })}
              </g>
            ))}
          </svg>
        </div>

        {(!layout || layout.wings.length === 0) && !error && (
          <div style={{ marginTop: 16, color: COLORS.textDim, fontSize: 12 }}>
            Belum ada wing/mesin yang dikonfigurasi untuk denah ini.
          </div>
        )}

        {selectedNode && (
          <div
            onClick={() => setSelectedNode(null)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: COLORS.blueprint, border: `1.5px solid ${COLORS.line}`, maxWidth: 640, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: `1px dashed ${COLORS.lineDim}`, position: 'sticky', top: 0, background: COLORS.blueprint }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: statusColor(selectedNode), display: 'inline-block' }} />
                  <div>
                    <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, margin: 0 }}>
                      {detail?.alias_name || selectedNode.machine_name || selectedNode.machine_code}
                    </h3>
                    <div style={{ fontSize: 9.5, color: COLORS.textFaint, marginTop: 2 }}>{selectedNode.machine_code}</div>
                  </div>
                </div>
                <div onClick={() => setSelectedNode(null)} style={{ fontSize: 10, color: COLORS.textFaint, border: `1px solid ${COLORS.lineDim}`, padding: '5px 9px', cursor: 'pointer' }}>
                  ✕ Tutup
                </div>
              </div>

              {detailLoading && <div style={{ padding: 18 }}><LoadingSpinner /></div>}

              {detail && !detailLoading && (
                <>
                  <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, background: COLORS.lineDim }}>
                    <div style={{ background: COLORS.blueprint, padding: '10px 14px' }}>
                      <div style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.08em', color: COLORS.textFaint, marginBottom: 5 }}>OEE Periode</div>
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700, color: statusColor(selectedNode) }}>
                        {detail.oee !== null ? `${detail.oee}%` : '—'}
                      </div>
                    </div>
                    <div style={{ background: COLORS.blueprint, padding: '10px 14px' }}>
                      <div style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.08em', color: COLORS.textFaint, marginBottom: 5 }}>Downtime</div>
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700, color: COLORS.red }}>
                        {detail.downtime_hours} j
                      </div>
                    </div>
                    <div style={{ background: COLORS.blueprint, padding: '10px 14px' }}>
                      <div style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.08em', color: COLORS.textFaint, marginBottom: 5 }}>Target vs Aktual</div>
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700 }}>
                        {Math.round(detail.target_quantity).toLocaleString('id-ID')} / {Math.round(detail.actual_quantity).toLocaleString('id-ID')}
                      </div>
                    </div>
                    <div style={{ background: COLORS.blueprint, padding: '10px 14px' }}>
                      <div style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.08em', color: COLORS.textFaint, marginBottom: 5 }}>Kualitas Dominan</div>
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700, color: COLORS.amber }}>
                        {detail.dominant_quality ? `${QUALITY_LABELS[detail.dominant_quality]} · ${detail.quality_breakdown[detail.dominant_quality].pct}%` : '—'}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '4px 18px 8px' }}>
                    <div style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.08em', color: COLORS.textFaint, margin: '10px 0 6px' }}>
                      Kualitas — Good / Reject / Rework
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                      {(['good', 'reject', 'rework'] as const).map((k) => (
                        <div key={k} style={{ flex: 1, background: COLORS.blueprint, border: `1px solid ${COLORS.lineDim}`, padding: '6px 10px' }}>
                          <div style={{ color: COLORS.textFaint, fontSize: 9 }}>{QUALITY_LABELS[k]}</div>
                          <div style={{ fontWeight: 700 }}>{Math.round(detail.quality_breakdown[k]?.quantity ?? 0).toLocaleString('id-ID')} <span style={{ color: COLORS.textDim, fontWeight: 400 }}>({detail.quality_breakdown[k]?.pct ?? 0}%)</span></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: '4px 18px 18px' }}>
                    <div style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.08em', color: COLORS.textFaint, margin: '10px 0 8px' }}>
                      Rincian downtime per kategori
                    </div>
                    {Object.entries(detail.downtime_incidents || {}).length === 0 && (
                      <div style={{ fontSize: 11, color: COLORS.textDim }}>Tidak ada downtime tercatat pada periode ini.</div>
                    )}
                    {Object.entries(detail.downtime_incidents || {})
                      .sort((a, b) => {
                        const totalA = a[1].reduce((s, r) => s + r.total_minutes, 0);
                        const totalB = b[1].reduce((s, r) => s + r.total_minutes, 0);
                        return totalB - totalA;
                      })
                      .map(([category, reasons]) => {
                        const total = reasons.reduce((s, r) => s + r.total_minutes, 0);
                        const top3 = reasons.slice(0, 3);
                        const rest = reasons.slice(3);
                        return (
                          <div key={category} style={{ marginBottom: 10, background: COLORS.blueprint, border: `1px solid ${COLORS.lineDim}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderBottom: `1px dashed ${COLORS.lineDim}` }}>
                              <span style={{ fontSize: 11, fontWeight: 600 }}>{DOWNTIME_LABELS[category] || category}</span>
                              <span style={{ fontSize: 11, color: COLORS.red }}>{total} menit</span>
                            </div>
                            <div style={{ padding: '6px 10px' }}>
                              {top3.map((r, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, padding: '2px 0', color: COLORS.text }}>
                                  <span>{r.reason} <span style={{ color: COLORS.textFaint }}>×{r.count}</span></span>
                                  <span style={{ color: COLORS.textDim }}>{r.total_minutes} mnt</span>
                                </div>
                              ))}
                              {rest.length > 0 && (
                                <details style={{ marginTop: 4 }}>
                                  <summary style={{ fontSize: 9.5, color: COLORS.textFaint, cursor: 'pointer' }}>+{rest.length} alasan lainnya</summary>
                                  {rest.map((r, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, padding: '2px 0 2px 4px', color: COLORS.textDim }}>
                                      <span>{r.reason} <span style={{ color: COLORS.textFaint }}>×{r.count}</span></span>
                                      <span>{r.total_minutes} mnt</span>
                                    </div>
                                  ))}
                                </details>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <footer style={{ marginTop: 26, paddingTop: 12, borderTop: `1px solid ${COLORS.lineDim}`, fontSize: 9, color: COLORS.textFaint, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span>Internal ERP — {companyName}</span>
          <span>Warna dihitung dari OEE historis per shift · bukan sensor real-time</span>
        </footer>
      </div>
    </div>
  );
};

export default FactoryLayoutDashboard;
