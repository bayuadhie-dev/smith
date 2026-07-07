import React, { useState, useEffect } from 'react';
import { 
  ExclamationTriangleIcon, 
  PencilIcon, 
  CheckCircleIcon,
  ClockIcon,
  PlayIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import axiosInstance from '../../utils/axiosConfig';

interface DowntimeItem {
  reason: string;
  category: string;
  total_duration: number;
  machines: string;
}

interface ActionItem {
  id: number;
  downtime_reason: string;
  machine_id: number;
  machine_name: string;
  product_id: number;
  product_name: string;
  week_number: number;
  year: number;
  month: number;
  total_duration: number;
  root_cause: string | null;
  follow_up: string | null;
  status: 'pending' | 'in_progress' | 'resolved';
  pic: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

interface DowntimeActionItemsProps {
  topUnplannedDowntime: { [productName: string]: DowntimeItem[] };
  weekNumber?: number;
  month?: number;
  year?: number;
  viewMode?: 'monthly' | 'weekly';
}

const MONTH_NAMES = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DowntimeActionItems: React.FC<DowntimeActionItemsProps> = ({
  topUnplannedDowntime,
  weekNumber,
  month,
  year,
  viewMode = 'weekly'
}) => {
  const [savedActionItems, setSavedActionItems] = useState<{ [key: string]: ActionItem }>({});
  const [loading, setLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    root_cause: '',
    follow_up: '',
    status: 'pending' as 'pending' | 'in_progress' | 'resolved',
    pic: ''
  });

  // Check if week has ended (only show action items after week is complete)
  const isWeekEnded = React.useMemo(() => {
    if (viewMode === 'monthly') return true; // Always show in monthly view
    if (!weekNumber || !month || !year) return false;
    
    // Calculate week end date
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const weekStartDay = (weekNumber - 1) * 7 + 1;
    const weekStart = new Date(year, month - 1, weekStartDay);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6); // Add 6 days to get end of week
    
    // Get current date
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to compare dates only
    
    // Week has ended if today is after week end date
    return today > weekEnd;
  }, [weekNumber, month, year, viewMode]);

  // Flatten top unplanned downtime into array with product info
  const downtimeItems = React.useMemo(() => {
    const items: Array<DowntimeItem & { product_name: string; rank: number }> = [];
    
    Object.entries(topUnplannedDowntime).forEach(([productName, downtimes]) => {
      downtimes.forEach((dt, index) => {
        items.push({
          ...dt,
          product_name: productName,
          rank: index + 1
        });
      });
    });
    
    return items;
  }, [topUnplannedDowntime]);

  useEffect(() => {
    fetchSavedActionItems();
  }, [weekNumber, month, year, viewMode]);

  const fetchSavedActionItems = async () => {
    if (!month || !year) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (viewMode === 'weekly' && weekNumber) {
        params.append('week_number', weekNumber.toString());
      }
      params.append('month', month.toString());
      params.append('year', year.toString());

      const response = await axiosInstance.get(`/api/downtime-actions/action-items?${params}`);
      
      // Index by product_name + reason for quick lookup
      const indexed: { [key: string]: ActionItem } = {};
      (response.data.action_items || []).forEach((item: ActionItem) => {
        const key = `${item.product_name}__${item.downtime_reason}`;
        indexed[key] = item;
      });
      
      setSavedActionItems(indexed);
    } catch (error) {
      console.error('Error fetching saved action items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams();
      params.append('year', (year || new Date().getFullYear()).toString());
      params.append('month', (month || (new Date().getMonth() + 1)).toString());
      params.append('view', viewMode || 'weekly');
      if (viewMode === 'weekly' && weekNumber) {
        params.append('week', weekNumber.toString());
      }
      
      const response = await axiosInstance.get(`/api/downtime-actions/export-excel?${params.toString()}`, {
        responseType: 'blob'
      });
      
      // Check if response is actually JSON error (content-type mismatch)
      const contentType = String(response.headers['content-type'] || '');
      if (contentType.includes('application/json')) {
        // Backend returned JSON error instead of file
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        alert(`Gagal mengekspor Excel: ${errorData.error || 'Unknown error'}`);
        return;
      }
      
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `downtime_action_items_${viewMode || 'weekly'}_${year}_${month}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error exporting excel:', error);
      // Try to extract error message from blob response
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const errorData = JSON.parse(text);
          alert(`Gagal mengekspor Excel: ${errorData.error || 'Server error'}`);
        } catch {
          alert('Gagal mengekspor Excel: Server error');
        }
      } else {
        alert(`Gagal mengekspor Excel: ${error.response?.data?.error || error.message || 'Unknown error'}`);
      }
    }
  };

  const handleExportPDF = async () => {
    try {
      const params = new URLSearchParams();
      params.append('year', (year || new Date().getFullYear()).toString());
      params.append('month', (month || (new Date().getMonth() + 1)).toString());
      params.append('view', viewMode || 'weekly');
      if (viewMode === 'weekly' && weekNumber) {
        params.append('week', weekNumber.toString());
      }
      
      const response = await axiosInstance.get(`/api/downtime-actions/export-pdf?${params.toString()}`, {
        responseType: 'blob'
      });
      
      // Check if response is actually JSON error
      const contentType = String(response.headers['content-type'] || '');
      if (contentType.includes('application/json')) {
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        alert(`Gagal mengekspor PDF: ${errorData.error || 'Unknown error'}`);
        return;
      }
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `downtime_action_items_${viewMode || 'weekly'}_${year}_${month}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const errorData = JSON.parse(text);
          alert(`Gagal mengekspor PDF: ${errorData.error || 'Server error'}`);
        } catch {
          alert('Gagal mengekspor PDF: Server error');
        }
      } else {
        alert(`Gagal mengekspor PDF: ${error.response?.data?.error || error.message || 'Unknown error'}`);
      }
    }
  };

  const getItemKey = (productName: string, reason: string) => {
    return `${productName}__${reason}`;
  };

  const handleEdit = (productName: string, reason: string) => {
    const key = getItemKey(productName, reason);
    const saved = savedActionItems[key];
    
    setEditingKey(key);
    setFormData({
      root_cause: saved?.root_cause || '',
      follow_up: saved?.follow_up || '',
      status: saved?.status || 'pending',
      pic: saved?.pic || ''
    });
  };

  const handleSave = async (productName: string, reason: string, totalDuration: number) => {
    const key = getItemKey(productName, reason);
    const saved = savedActionItems[key];
    
    try {
      if (saved) {
        // Update existing
        await axiosInstance.put(`/api/downtime-actions/action-items/${saved.id}`, formData);
      } else {
        // Create new
        await axiosInstance.post('/api/downtime-actions/action-items', {
          downtime_reason: reason,
          machine_id: 1, // Placeholder, will be updated
          product_id: null, // Will be looked up by product_name
          week_number: weekNumber,
          year: year,
          month: month,
          total_duration: totalDuration,
          ...formData
        });
      }
      
      await fetchSavedActionItems();
      setEditingKey(null);
    } catch (error) {
      console.error('Error saving action item:', error);
      alert('Gagal menyimpan perubahan');
    }
  };

  const handleCancel = () => {
    setEditingKey(null);
    setFormData({
      root_cause: '',
      follow_up: '',
      status: 'pending',
      pic: ''
    });
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        text: 'text-yellow-700 dark:text-yellow-400',
        icon: ClockIcon,
        label: 'Pending'
      },
      in_progress: {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-400',
        icon: PlayIcon,
        label: 'In Progress'
      },
      resolved: {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-400',
        icon: CheckCircleIcon,
        label: 'Resolved'
      }
    };

    const badge = badges[status as keyof typeof badges] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        <Icon className="h-3 w-3" />
        {badge.label}
      </span>
    );
  };

  const getRankBadge = (index: number) => {
    const colors = [
      'bg-red-500 text-white',
      'bg-orange-500 text-white',
      'bg-yellow-500 text-white'
    ];
    return (
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${colors[index] || 'bg-gray-400 text-white'}`}>
        {index + 1}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show message if week hasn't ended yet
  if (!isWeekEnded) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-8 text-center">
        <ClockIcon className="h-12 w-12 text-blue-300 dark:text-blue-600 mx-auto mb-3" />
        <p className="text-slate-600 dark:text-gray-300 font-medium">Minggu Masih Berjalan</p>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-2">
          Top 3 penyebab target tidak tercapai akan ditampilkan setelah minggu ini selesai
        </p>
        <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
          Minggu {weekNumber} - {month}/{year}
        </p>
      </div>
    );
  }

  if (downtimeItems.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-8 text-center">
        <ExclamationTriangleIcon className="h-12 w-12 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-slate-500 dark:text-gray-400">Tidak ada unplanned downtime untuk periode ini</p>
        <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
          Data akan muncul jika ada downtime kategori mesin, operator, atau material
        </p>
      </div>
    );
  }

  return (
    <div id="downtime-action-items-section" className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="h-6 w-6 text-white" />
            <div>
              <h3 className="text-lg font-bold text-white">
                {viewMode === 'monthly' ? 'Akumulasi Bulanan Unplanned Downtime' : 'Top 3 Penyebab Target Tidak Tercapai'}
              </h3>
              <p className="text-sm text-white/80">
                Unplanned Downtime - {viewMode === 'monthly' ? `${MONTH_NAMES[month || 0]} ${year}` : `Minggu {weekNumber} (${MONTH_NAMES[month || 0]} ${year})`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="export-buttons-container flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-semibold border border-white/20 transition-all cursor-pointer"
                title="Ekspor ke Excel (.xlsx)"
              >
                📥 Excel
              </button>
              <button
                onClick={handleExportPDF}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-semibold border border-white/20 transition-all cursor-pointer"
                title="Ekspor ke PDF"
              >
                📄 PDF
              </button>
            </div>
            <div className="text-right border-l border-white/20 pl-4">
              <p className="text-2xl font-bold text-white">{downtimeItems.length}</p>
              <p className="text-xs text-white/80">Downtime Items</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-gray-300">Rank</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-gray-300">Produk</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-gray-300">Penyebab Downtime</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-gray-300">Kategori</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-gray-300">Mesin</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-gray-300">Durasi</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-gray-300">Root Cause</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-gray-300">Follow Up / Solusi</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-gray-300">PIC</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-gray-300">Status</th>
              {viewMode !== 'monthly' && <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-gray-300">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
            {downtimeItems.map((item, index) => {
              const key = getItemKey(item.product_name, item.reason);
              const saved = savedActionItems[key];
              const isEditing = editingKey === key;
              
              return (
                <tr key={key} className="hover:bg-slate-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3">
                    {getRankBadge(item.rank - 1)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-800 dark:text-white">
                      {item.product_name}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-600 dark:text-gray-300">{item.reason}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      item.category === 'mesin' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      item.category === 'operator' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    }`}>
                      {item.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-600 dark:text-gray-300">{item.machines}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">
                      {item.total_duration} menit
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <textarea
                        value={formData.root_cause}
                        onChange={(e) => setFormData({ ...formData, root_cause: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        rows={2}
                        placeholder="Jelaskan akar masalah..."
                      />
                    ) : (
                      <p className="text-sm text-slate-600 dark:text-gray-300">
                        {saved?.root_cause || <span className="text-slate-400 dark:text-gray-500 italic">Belum diisi</span>}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <textarea
                        value={formData.follow_up}
                        onChange={(e) => setFormData({ ...formData, follow_up: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        rows={2}
                        placeholder="Jelaskan tindak lanjut/solusi..."
                      />
                    ) : (
                      <p className="text-sm text-slate-600 dark:text-gray-300">
                        {saved?.follow_up || <span className="text-slate-400 dark:text-gray-500 italic">Belum diisi</span>}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.pic}
                        onChange={(e) => setFormData({ ...formData, pic: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Nama PIC..."
                      />
                    ) : (
                      <p className="text-sm text-slate-600 dark:text-gray-300">
                        {saved?.pic || <span className="text-slate-400 dark:text-gray-500 italic">-</span>}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    ) : (
                      getStatusBadge(saved?.status || 'pending')
                    )}
                  </td>
                  {viewMode !== 'monthly' && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSave(item.product_name, item.reason, item.total_duration)}
                              className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
                              title="Simpan"
                            >
                              <CheckCircleIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={handleCancel}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                              title="Batal"
                            >
                              <XMarkIcon className="h-5 w-5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleEdit(item.product_name, item.reason)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title="Edit"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="bg-slate-50 dark:bg-gray-900 px-6 py-3 border-t border-slate-200 dark:border-gray-700">
        <p className="text-xs text-slate-500 dark:text-gray-400">
          💡 <strong>Catatan:</strong> {viewMode === 'monthly' ? (
            <>Data ini merupakan akumulasi bulanan unplanned downtime (top 3 per produk). Pengisian root cause dan solusi hanya dapat dilakukan di mode <strong>Mingguan (Weekly)</strong>.</>
          ) : (
            <>Data ini dihasilkan dari top 3 unplanned downtime (mesin, operator, material) per produk. Isi root cause dan follow up untuk tracking di rapat Senin.</>
          )}
        </p>
      </div>
    </div>
  );
};

export default DowntimeActionItems;
