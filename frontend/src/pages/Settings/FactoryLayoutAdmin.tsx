import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../../utils/axiosConfig';
import LoadingSpinner from '../../components/Common/LoadingSpinner';

interface MachineOption {
  id: number;
  code: string;
  name: string;
  alias_name: string | null;
  is_assigned: boolean;
  legacy_converting_machine_id: number | null;
}

interface NodeRow {
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
}

interface WingRow {
  id: number;
  name: string;
  subtitle: string | null;
  display_order: number;
  wing_x: number;
  wing_y: number;
  wing_oee_x: number;
  nodes: NodeRow[];
}

const ICON_TYPES = [
  'filler', 'wipes_line', 'wash_glove', 'tisu_sheet', 'alcohol_wipes',
  'bagmaking', 'banded_pack', 'fliptop', 'slitting', 'cutting', 'perforating', 'laminating', 'folding',
];

const TABS = ['Wings', 'Mesin & Icon', 'Alias'] as const;
type Tab = typeof TABS[number];

const FactoryLayoutAdmin: React.FC = () => {
  const [tab, setTab] = useState<Tab>('Wings');
  const [wings, setWings] = useState<WingRow[]>([]);
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadAll = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      axiosInstance.get('/api/executive/machine-layout/admin/wings'),
      axiosInstance.get('/api/executive/machine-layout/admin/machines'),
    ])
      .then(([wingsRes, machinesRes]) => {
        setWings(wingsRes.data.wings);
        setMachines(machinesRes.data.machines);
      })
      .catch(() => setError('Gagal memuat data. Pastikan Anda login sebagai admin.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  // ---------- Wing CRUD ----------
  const [newWing, setNewWing] = useState({ name: '', subtitle: '', display_order: 0, wing_x: 40, wing_y: 20, wing_oee_x: 420 });

  const createWing = () => {
    if (!newWing.name.trim()) return;
    axiosInstance.post('/api/executive/machine-layout/admin/wings', newWing)
      .then(() => { flash('Wing dibuat'); setNewWing({ name: '', subtitle: '', display_order: 0, wing_x: 40, wing_y: 20, wing_oee_x: 420 }); loadAll(); })
      .catch(() => setError('Gagal membuat wing'));
  };

  const updateWing = (wing: WingRow, field: string, value: string | number) => {
    axiosInstance.patch(`/api/executive/machine-layout/admin/wings/${wing.id}`, { [field]: value })
      .then(() => loadAll())
      .catch(() => setError('Gagal update wing'));
  };

  const deleteWing = (wing: WingRow) => {
    if (wing.nodes.length > 0) {
      setError(`Tidak bisa hapus wing "${wing.name}" — masih ada ${wing.nodes.length} mesin terpasang. Pindahkan/hapus dulu.`);
      return;
    }
    if (!window.confirm(`Hapus wing "${wing.name}"?`)) return;
    axiosInstance.delete(`/api/executive/machine-layout/admin/wings/${wing.id}`)
      .then(() => { flash('Wing dihapus'); loadAll(); })
      .catch(() => setError('Gagal hapus wing'));
  };

  // ---------- Node CRUD ----------
  const [newNode, setNewNode] = useState({ machine_id: 0, wing_id: 0, icon_type: 'filler', icon_variant: '' as string | number });

  const createNode = () => {
    if (!newNode.machine_id || !newNode.wing_id) {
      setError('Pilih mesin dan wing terlebih dahulu');
      return;
    }
    const payload: any = { machine_id: newNode.machine_id, wing_id: newNode.wing_id, icon_type: newNode.icon_type };
    if (newNode.icon_variant !== '') payload.icon_variant = Number(newNode.icon_variant);
    axiosInstance.post('/api/executive/machine-layout/admin/nodes', payload)
      .then(() => { flash('Mesin ditambahkan ke denah'); setNewNode({ machine_id: 0, wing_id: 0, icon_type: 'filler', icon_variant: '' }); loadAll(); })
      .catch((err) => setError(err.response?.data?.error || 'Gagal menambah mesin'));
  };

  const updateNode = (node: NodeRow, field: string, value: string | number | null) => {
    axiosInstance.patch(`/api/executive/machine-layout/admin/nodes/${node.id}`, { [field]: value })
      .then(() => loadAll())
      .catch(() => setError('Gagal update mesin'));
  };

  const deleteNode = (node: NodeRow) => {
    if (!window.confirm(`Hapus "${node.machine_name}" dari denah?`)) return;
    axiosInstance.delete(`/api/executive/machine-layout/admin/nodes/${node.id}`)
      .then(() => { flash('Mesin dihapus dari denah'); loadAll(); })
      .catch(() => setError('Gagal hapus mesin'));
  };

  // ---------- Alias CRUD ----------
  const [aliasDrafts, setAliasDrafts] = useState<Record<number, string>>({});

  const saveAlias = (machineId: number) => {
    const alias_name = aliasDrafts[machineId];
    if (!alias_name || !alias_name.trim()) return;
    axiosInstance.post('/api/executive/machine-layout/admin/aliases', { machine_id: machineId, alias_name })
      .then(() => { flash('Alias disimpan'); loadAll(); })
      .catch(() => setError('Gagal simpan alias'));
  };

  const deleteAlias = (machineId: number) => {
    if (!window.confirm('Hapus alias ini? Nama tampilan akan kembali ke nama asli mesin.')) return;
    axiosInstance.delete(`/api/executive/machine-layout/admin/aliases/${machineId}`)
      .then(() => { flash('Alias dihapus'); loadAll(); })
      .catch(() => setError('Gagal hapus alias'));
  };

  if (loading) return <div style={{ padding: 40 }}><LoadingSpinner /></div>;

  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' };
  const td: React.CSSProperties = { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid #f3f4f6' };
  const input: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 4, padding: '5px 8px', fontSize: 13, width: '100%' };
  const btn: React.CSSProperties = { background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, padding: '6px 12px', fontSize: 12, cursor: 'pointer' };
  const btnDanger: React.CSSProperties = { ...btn, background: '#dc2626' };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Factory Layout — Admin</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
        Kelola sayap (wing), penempatan mesin, icon, dan nama alias untuk halaman Denah Produksi.
      </p>

      {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {message && <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '10px 14px', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{message}</div>}

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
        {TABS.map((t) => (
          <div
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px', fontSize: 13, cursor: 'pointer',
              borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent',
              color: tab === t ? '#2563eb' : '#6b7280', fontWeight: tab === t ? 600 : 400,
            }}
          >
            {t}
          </div>
        ))}
      </div>

      {tab === 'Wings' && (
        <div>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Tambah Wing Baru</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: 8 }}>
              <input style={input} placeholder="Nama (mis. Sayap Alkes)" value={newWing.name} onChange={(e) => setNewWing({ ...newWing, name: e.target.value })} />
              <input style={input} placeholder="Subjudul" value={newWing.subtitle} onChange={(e) => setNewWing({ ...newWing, subtitle: e.target.value })} />
              <input style={input} type="number" placeholder="Urutan" value={newWing.display_order} onChange={(e) => setNewWing({ ...newWing, display_order: Number(e.target.value) })} />
              <button style={btn} onClick={createWing}>+ Tambah</button>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Nama</th><th style={th}>Subjudul</th><th style={th}>Urutan</th>
                <th style={th}>Posisi Label (X, Y)</th><th style={th}>Jumlah Mesin</th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {wings.map((w) => (
                <tr key={w.id}>
                  <td style={td}><input style={input} defaultValue={w.name} onBlur={(e) => e.target.value !== w.name && updateWing(w, 'name', e.target.value)} /></td>
                  <td style={td}><input style={input} defaultValue={w.subtitle || ''} onBlur={(e) => e.target.value !== w.subtitle && updateWing(w, 'subtitle', e.target.value)} /></td>
                  <td style={td}><input style={{ ...input, width: 60 }} type="number" defaultValue={w.display_order} onBlur={(e) => Number(e.target.value) !== w.display_order && updateWing(w, 'display_order', Number(e.target.value))} /></td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input style={{ ...input, width: 60 }} type="number" defaultValue={w.wing_x} onBlur={(e) => Number(e.target.value) !== w.wing_x && updateWing(w, 'wing_x', Number(e.target.value))} />
                      <input style={{ ...input, width: 60 }} type="number" defaultValue={w.wing_y} onBlur={(e) => Number(e.target.value) !== w.wing_y && updateWing(w, 'wing_y', Number(e.target.value))} />
                    </div>
                  </td>
                  <td style={td}>{w.nodes.length}</td>
                  <td style={td}><button style={btnDanger} onClick={() => deleteWing(w)}>Hapus</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Mesin & Icon' && (
        <div>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Tambahkan Mesin ke Denah</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr auto', gap: 8 }}>
              <select style={input} value={newNode.machine_id} onChange={(e) => setNewNode({ ...newNode, machine_id: Number(e.target.value) })}>
                <option value={0}>— Pilih mesin —</option>
                {machines.filter((m) => !m.is_assigned).map((m) => (
                  <option key={m.id} value={m.id}>{m.alias_name || m.name} ({m.code})</option>
                ))}
              </select>
              <select style={input} value={newNode.wing_id} onChange={(e) => setNewNode({ ...newNode, wing_id: Number(e.target.value) })}>
                <option value={0}>— Pilih wing —</option>
                {wings.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <select style={input} value={newNode.icon_type} onChange={(e) => setNewNode({ ...newNode, icon_type: e.target.value })}>
                {ICON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input style={input} type="number" placeholder="Variant (opsional)" value={newNode.icon_variant} onChange={(e) => setNewNode({ ...newNode, icon_variant: e.target.value })} />
              <button style={btn} onClick={createNode}>+ Tambah</button>
            </div>
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
              "Variant" hanya relevan untuk icon banded_pack (jumlah unit per band, 2-6). Kosongkan untuk icon lain.
            </p>
          </div>

          {wings.map((wing) => (
            <div key={wing.id} style={{ marginBottom: 24 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#374151' }}>{wing.name}</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Mesin</th><th style={th}>Icon Type</th><th style={th}>Variant</th>
                    <th style={th}>Posisi (X, Y)</th><th style={th}>Label Offset (X, Y)</th><th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {wing.nodes.map((node) => (
                    <tr key={node.id}>
                      <td style={td}>{node.machine_name} <span style={{ color: '#9ca3af' }}>({node.machine_code})</span></td>
                      <td style={td}>
                        <select style={input} defaultValue={node.icon_type} onBlur={(e) => e.target.value !== node.icon_type && updateNode(node, 'icon_type', e.target.value)}>
                          {ICON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td style={td}><input style={{ ...input, width: 60 }} type="number" defaultValue={node.icon_variant ?? ''} onBlur={(e) => updateNode(node, 'icon_variant', e.target.value === '' ? null : Number(e.target.value))} /></td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input style={{ ...input, width: 60 }} type="number" defaultValue={node.pos_x} onBlur={(e) => Number(e.target.value) !== node.pos_x && updateNode(node, 'pos_x', Number(e.target.value))} />
                          <input style={{ ...input, width: 60 }} type="number" defaultValue={node.pos_y} onBlur={(e) => Number(e.target.value) !== node.pos_y && updateNode(node, 'pos_y', Number(e.target.value))} />
                        </div>
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input style={{ ...input, width: 60 }} type="number" defaultValue={node.label_offset_x} onBlur={(e) => Number(e.target.value) !== node.label_offset_x && updateNode(node, 'label_offset_x', Number(e.target.value))} />
                          <input style={{ ...input, width: 60 }} type="number" defaultValue={node.label_offset_y} onBlur={(e) => Number(e.target.value) !== node.label_offset_y && updateNode(node, 'label_offset_y', Number(e.target.value))} />
                        </div>
                      </td>
                      <td style={td}><button style={btnDanger} onClick={() => deleteNode(node)}>Hapus</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {tab === 'Alias' && (
        <div>
          <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>
            Alias hanya memengaruhi tampilan di Denah Produksi. Nama asli mesin di modul lain (Daily Controller, dsb) tidak berubah.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Kode</th><th style={th}>Nama Asli</th><th style={th}>Alias</th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => (
                <tr key={m.id}>
                  <td style={td}>{m.code}</td>
                  <td style={td}>{m.name}</td>
                  <td style={td}>
                    <input
                      style={input}
                      placeholder={m.alias_name || '(pakai nama asli)'}
                      value={aliasDrafts[m.id] ?? m.alias_name ?? ''}
                      onChange={(e) => setAliasDrafts({ ...aliasDrafts, [m.id]: e.target.value })}
                    />
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={btn} onClick={() => saveAlias(m.id)}>Simpan</button>
                      {m.alias_name && <button style={btnDanger} onClick={() => deleteAlias(m.id)}>Hapus</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FactoryLayoutAdmin;
