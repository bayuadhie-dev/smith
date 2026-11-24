import React, { useState, useEffect } from 'react';
import ItemStockModal from '../../components/Warehouse/ItemStockModal';
import { useUrlFilter, useUrlState } from '../../hooks/useUrlState';
import { useBreadcrumbTrail } from '../../components/ui/BreadcrumbTrail';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getApiURL } from '../../utils/apiConfig'
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  BuildingOfficeIcon,
  CubeIcon,
  MapPinIcon,
  PencilIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

interface LocationData {
  id: number;
  location_code: string;
  zone_id: number;
  zone_name: string;
  zone_code: string;
  zone_material_type: string;
  rack: string;
  level: string;
  position: string;
  capacity: number;
  capacity_uom: string;
  occupied: number;
  available: number | null;
  unlimited?: boolean;
  current_utilization?: number | null;
  is_active: boolean;
  is_available: boolean;
  created_at: string | null;
  updated_at: string | null;
}

interface InventoryItem {
  id: number;
  item_type: string;
  item_name: string;
  item_code: string;
  product_id: number | null;
  material_id: number | null;
  batch_number: string | null;
  lot_number: string | null;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  stock_status: string;
  expiry_date: string | null;
  created_at: string | null;
}

type GroupedItem = InventoryItem & {
  batch_count: number;
  batch_list: string[];
  statuses: string[];
  first_in: string | null;
};

interface Movement {
  id: number;
  movement_type: string;
  direction?: string;
  item_name: string;
  quantity: number;
  batch_number: string | null;
  reference_number: string | null;
  reference_type: string | null;
  unit_cost: number | null;
  total_cost: number | null;
  notes: string | null;
  created_at: string | null;
}

const JENIS_MUTASI: Record<string, string> = {
  stock_in: 'Stok masuk', stock_out: 'Stok keluar', goods_receipt: 'Penerimaan Barang',
  transfer_in: 'Terima Barang', transfer_out: 'Pemindahan keluar', transfer: 'Pemindahan',
  material_issue: 'Permintaan Barang', adjustment: 'Penyesuaian',
  qc_disposition: 'Keputusan QC', qc_disposition_out: 'Keputusan QC (keluar)',
  production_output: 'Hasil produksi', production_consumption: 'Pemakaian produksi',
};

const LocationDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [detail, setDetail] = useState<{ kind: 'material' | 'product'; id: number; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useUrlState<'inventory' | 'movements'>('tab', 'inventory', ['inventory', 'movements']);
  // Lokasi yang belum pernah diisi tampil "Tidak ada inventory di lokasi ini" -
  // benar, tapi tidak menjawab "jadi isinya nanti apa saja". Dengan ini barang
  // sekategori gudangnya ikut tampil dengan stok nol.
  const [nolParam, setNolParam] = useUrlFilter<string>('nol', '');
  const tampilkanNol = nolParam === '1';
  useBreadcrumbTrail(activeTab === 'inventory' ? [] : [{ label: 'Riwayat Pergerakan' }]);

  useEffect(() => {
    fetchLocationDetail();
  }, [id, tampilkanNol]);

  const fetchLocationDetail = async () => {
    setLoading(true);
    try {
      const response = await fetch(getApiURL(`/api/warehouse/locations/${id}${tampilkanNol ? '?include_empty=1' : ''}`), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setLocation(data.location);
        setInventoryItems(data.inventory_items || []);
        setMovements(data.recent_movements || []);
      } else {
        console.error('Failed to fetch location:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch location:', error);
    } finally {
      setLoading(false);
    }
  };

  // Satu barang = satu baris. Material yang terbagi ke banyak batch dulu tampil
  // berulang-ulang (17 baris untuk 2 material); batch-nya cukup dihitung di sini,
  // rinciannya sudah ada di popup yang terbuka saat barisnya diklik.
  const groupedItems = React.useMemo(() => {
    const map = new Map<string, GroupedItem>()
    inventoryItems.forEach((it) => {
      const key = `${it.item_type}-${it.material_id ?? it.product_id ?? it.item_code}`
      const cur = map.get(key)
      if (!cur) {
        map.set(key, {
          ...it,
          batch_count: it.batch_number ? 1 : 0,
          batch_list: it.batch_number ? [it.batch_number] : [],
          statuses: it.stock_status ? [it.stock_status] : [],
          first_in: it.created_at,
        })
        return
      }
      cur.quantity_on_hand += it.quantity_on_hand
      cur.quantity_reserved += it.quantity_reserved
      cur.quantity_available += it.quantity_available
      if (it.batch_number && !cur.batch_list.includes(it.batch_number)) {
        cur.batch_list.push(it.batch_number)
        cur.batch_count += 1
      }
      if (it.stock_status && !cur.statuses.includes(it.stock_status)) cur.statuses.push(it.stock_status)
      if (it.created_at && (!cur.first_in || it.created_at < cur.first_in)) cur.first_in = it.created_at
    })
    // Yang ada isinya didahulukan; barang berstok nol menyusul di bawah.
    return Array.from(map.entries())
      .map(([key, v]) => ({ ...v, key }))
      .sort((a, b) => (b.quantity_on_hand || 0) - (a.quantity_on_hand || 0))
  }, [inventoryItems])

  const getUtilizationPercent = () => {
    if (!location || location.capacity <= 0) return 0;
    return (location.occupied / location.capacity) * 100;
  };

  const getUtilizationColor = (pct: number) => {
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 75) return 'bg-orange-500';
    if (pct >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'stock_in': return <ArrowDownTrayIcon className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'stock_out': return <ArrowUpTrayIcon className="h-4 w-4 text-red-600 dark:text-red-400" />;
      default: return <ClockIcon className="h-4 w-4 text-gray-400" />;
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'stock_in': return 'text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-300';
      case 'stock_out': return 'text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-300';
      case 'transfer': return 'text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300';
      case 'adjust': return 'text-orange-700 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-300';
      default: return 'text-gray-700 bg-gray-50 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'released': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'available': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'quarantine': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'on_hold': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="text-center py-12">
        <MapPinIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Lokasi tidak ditemukan</h3>
        <button onClick={() => navigate('/app/warehouse/locations')} className="mt-4 text-blue-600 hover:underline dark:text-blue-400">
          Kembali ke daftar lokasi
        </button>
      </div>
    );
  }

  const utilPct = getUtilizationPercent();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/app/warehouse/locations')}
            className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800 rounded-lg dark:hover:text-white"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <div className="fn-label mb-1.5">GUDANG · LOKASI</div>
            <h1 className="fn-num text-[28px] font-semibold leading-tight tracking-tight text-gray-900 dark:text-white">{location.location_code}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {location.zone_name}{location.zone_code ? ` · ${location.zone_code}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
            location.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
          }`}>
            {location.is_active ? <CheckCircleIcon className="h-4 w-4" /> : <ExclamationCircleIcon className="h-4 w-4" />}
            {location.is_active ? 'Aktif' : 'Nonaktif'}
          </div>
          <Link
            to={`/app/warehouse/locations/${location.id}/edit`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <PencilIcon className="h-4 w-4" />
            Edit
          </Link>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/30">
              <BuildingOfficeIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-300">Zone</span>
          </div>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{location.zone_code}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{location.zone_material_type}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg dark:bg-purple-900/30">
              <MapPinIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-300">Posisi</span>
          </div>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            R{location.rack} - L{location.level} - P{location.position}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg dark:bg-green-900/30">
              <CubeIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-300">Kapasitas</span>
          </div>
          {/* Kapasitas 0 artinya tidak dibatasi, bukan "tidak muat apa-apa". */}
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {location.capacity ? `${location.capacity.toLocaleString('id-ID')} ${location.capacity_uom || ''}` : 'Tidak dibatasi'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Terpakai: {location.occupied.toLocaleString('id-ID')}
            {location.available !== null && location.available !== undefined ? ` | Sisa: ${location.available.toLocaleString('id-ID')}` : ''}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-300">Utilisasi</span>
          </div>
          {location.capacity ? (
            <>
              <p className={`text-2xl font-bold ${
                utilPct >= 90 ? 'text-red-600 dark:text-red-400' : utilPct >= 75 ? 'text-orange-600 dark:text-orange-400' : utilPct >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'
              }`}>
                {utilPct.toFixed(1)}%
              </p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full ${getUtilizationColor(utilPct)}`}
                  style={{ width: `${Math.min(utilPct, 100)}%` }}
                ></div>
              </div>
            </>
          ) : (
            /* Tanpa batas kapasitas, persentase tidak berarti apa-apa. */
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Lokasi ini tidak dibatasi kapasitasnya. Isinya sekarang {location.occupied.toLocaleString('id-ID')}.
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'inventory'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              Inventory ({groupedItems.length})
            </button>
            <button
              onClick={() => setActiveTab('movements')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'movements'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              Riwayat Pergerakan ({movements.length})
            </button>
          </nav>
        </div>

        <div className="p-4">
          {activeTab === 'inventory' && (
            <>
              <label className="mb-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                <input type="checkbox" checked={tampilkanNol} onChange={(e) => setNolParam(e.target.checked ? '1' : '')} />
                Tampilkan barang yang stoknya nol
              </label>
              {groupedItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <CubeIcon className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                  <p>{tampilkanNol ? 'Tidak ada barang untuk kategori gudang ini.' : 'Belum ada stok di lokasi ini. Centang "Tampilkan barang yang stoknya nol" untuk melihat barang yang seharusnya di sini.'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Item</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipe</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Batch</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">On Hand</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reserved</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Available</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal Masuk</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {groupedItems.map((item) => (
                        <tr
                          key={item.key}
                          onClick={() => (item.material_id || item.product_id) && setDetail({ kind: item.material_id ? 'material' : 'product', id: (item.material_id || item.product_id) as number, name: item.item_name })}
                          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                          title="Klik untuk melihat rincian stok per batch dan mutasinya"
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{item.item_name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{item.item_code}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              item.item_type === 'product' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                            }`}>
                              {item.item_type === 'product' ? 'Produk' : 'Material'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                            {item.batch_count > 1 ? (
                              <span title={item.batch_list.join(', ')}>{item.batch_count} batch</span>
                            ) : (
                              item.batch_list[0] || '-'
                            )}
                            {item.batch_count <= 1 && item.lot_number && <span className="text-xs text-gray-400 block">Lot: {item.lot_number}</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                            {item.quantity_on_hand.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-orange-600 dark:text-orange-400">
                            {item.quantity_reserved.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-green-600 dark:text-green-400">
                            {item.quantity_available.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            {item.statuses.length > 1 ? (
                              <span
                                className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                                title={item.statuses.join(', ')}
                              >
                                campuran
                              </span>
                            ) : (
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(item.statuses[0] || item.stock_status)}`}>
                                {item.statuses[0] || item.stock_status}
                              </span>
                            )}
                          </td>
                          <td
                            className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                            title={item.batch_count > 1 ? 'Tanggal masuk batch paling awal' : undefined}
                          >
                            {item.first_in ? new Date(item.first_in).toLocaleDateString('id-ID') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {activeTab === 'movements' && (
            <>
              {movements.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <ClockIcon className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                  <p>Belum ada riwayat pergerakan</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipe</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Item</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qty</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Batch</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Referensi</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unit Cost</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Cost</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {movements.map((mv) => (
                        <tr key={mv.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {getMovementIcon(mv.movement_type)}
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getMovementColor(mv.movement_type)}`}>
                                {JENIS_MUTASI[mv.movement_type] || mv.movement_type.replace(/_/g, ' ')}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{mv.item_name || '-'}</td>
                          <td className={`px-4 py-3 text-sm text-right font-medium ${
                            mv.direction === 'out' ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-300'
                          }`}>
                            {mv.direction === 'out' ? '-' : '+'}{mv.quantity.toLocaleString('id-ID')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{mv.batch_number || '-'}</td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm text-gray-900 dark:text-white">{mv.reference_number || '-'}</p>
                              {mv.reference_type && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">{mv.reference_type.replace('_', ' ')}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-300">
                            {mv.unit_cost ? `Rp ${mv.unit_cost.toLocaleString()}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-300">
                            {mv.total_cost ? `Rp ${mv.total_cost.toLocaleString()}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {mv.created_at ? new Date(mv.created_at).toLocaleDateString('id-ID', {
                              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                            }) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {detail && (
        <ItemStockModal kind={detail.kind} itemId={detail.id} name={detail.name} onClose={() => setDetail(null)} />
      )}
    </div>
  );
};

export default LocationDetail;
