import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import axiosInstance from '../../utils/axiosConfig';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardDocumentListIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlayIcon,
  WrenchScrewdriverIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface WorkOrder {
  id: number;
  wo_number: string;
  product_name: string;
  product_code?: string;
  machine_name?: string;
  machine_id?: number;
  quantity: number;
  quantity_produced: number;
  quantity_good: number;
  uom: string;
  status: string;
  priority: string;
  required_date?: string;
  scheduled_start_date?: string;
  actual_start_date?: string;
  created_at: string;
  notes?: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  headerBg: string;
  items: WorkOrder[];
}

const COLUMNS_CONFIG: Omit<KanbanColumn, 'items'>[] = [
  {
    id: 'planned',
    title: 'Planned',
    icon: <ClipboardDocumentListIcon className="h-5 w-5" />,
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-300',
    headerBg: 'bg-gradient-to-r from-slate-100 to-slate-200',
  },
  {
    id: 'released',
    title: 'Released',
    icon: <PlayIcon className="h-5 w-5" />,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    headerBg: 'bg-gradient-to-r from-blue-100 to-blue-200',
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    icon: <WrenchScrewdriverIcon className="h-5 w-5" />,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
    headerBg: 'bg-gradient-to-r from-amber-100 to-amber-200',
  },
  {
    id: 'completed',
    title: 'Completed',
    icon: <CheckCircleIcon className="h-5 w-5" />,
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
    headerBg: 'bg-gradient-to-r from-green-100 to-green-200',
  },
  {
    id: 'cancelled',
    title: 'Cancelled',
    icon: <XCircleIcon className="h-5 w-5" />,
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
    headerBg: 'bg-gradient-to-r from-red-100 to-red-200',
  },
];

const PRIORITY_STYLES: Record<string, { badge: string; dot: string }> = {
  urgent: { badge: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
  high: { badge: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  normal: { badge: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  low: { badge: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  planned: ['released', 'cancelled'],
  released: ['in_progress', 'planned', 'cancelled'],
  in_progress: ['completed', 'released'],
  completed: [],
  cancelled: ['planned'],
};

const WorkOrderKanban: React.FC = () => {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [allWorkOrders, setAllWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [machineFilter, setMachineFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [machines, setMachines] = useState<{ id: number; name: string }[]>([]);
  const [dragError, setDragError] = useState<string | null>(null);
  const [updatingWO, setUpdatingWO] = useState<number | null>(null);
  const navigate = useNavigate();

  const buildColumns = useCallback(
    (workOrders: WorkOrder[], search: string, machine: string, priority: string) => {
      let filtered = workOrders;
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(
          (wo) =>
            wo.wo_number.toLowerCase().includes(s) ||
            wo.product_name.toLowerCase().includes(s) ||
            (wo.machine_name && wo.machine_name.toLowerCase().includes(s))
        );
      }
      if (machine) {
        filtered = filtered.filter((wo) => String(wo.machine_id) === machine);
      }
      if (priority) {
        filtered = filtered.filter((wo) => wo.priority === priority);
      }

      const newColumns: KanbanColumn[] = COLUMNS_CONFIG.map((col) => ({
        ...col,
        items: filtered
          .filter((wo) => wo.status === col.id)
          .sort((a, b) => {
            const order: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
            return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
          }),
      }));
      setColumns(newColumns);
    },
    []
  );

  const fetchWorkOrders = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const response = await axiosInstance.get('/api/production/work-orders', {
          params: { per_page: 500 },
        });

        const raw = response.data.work_orders || response.data || [];
        const workOrders: WorkOrder[] = raw.map((wo: any) => ({
          id: wo.id,
          wo_number: wo.wo_number,
          product_name: wo.product_name || wo.product?.name || 'N/A',
          product_code: wo.product_code || wo.product?.code,
          machine_name: wo.machine_name || wo.machine?.name,
          machine_id: wo.machine_id,
          quantity: parseFloat(wo.quantity) || 0,
          quantity_produced: parseFloat(wo.quantity_produced) || 0,
          quantity_good: parseFloat(wo.quantity_good) || 0,
          uom: wo.uom || 'pcs',
          status: wo.status,
          priority: wo.priority || 'normal',
          required_date: wo.required_date,
          scheduled_start_date: wo.scheduled_start_date,
          actual_start_date: wo.actual_start_date,
          created_at: wo.created_at,
          notes: wo.notes,
        }));

        const uniqueMachines = workOrders
          .filter((wo) => wo.machine_name && wo.machine_id)
          .reduce((acc: { id: number; name: string }[], wo) => {
            if (!acc.find((m) => m.id === wo.machine_id)) {
              acc.push({ id: wo.machine_id!, name: wo.machine_name! });
            }
            return acc;
          }, [])
          .sort((a, b) => a.name.localeCompare(b.name));

        setMachines(uniqueMachines);
        setAllWorkOrders(workOrders);
        buildColumns(workOrders, searchTerm, machineFilter, priorityFilter);
      } catch (error) {
        console.error('Error fetching work orders:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [buildColumns, searchTerm, machineFilter, priorityFilter]
  );

  useEffect(() => {
    fetchWorkOrders();
    const interval = setInterval(() => fetchWorkOrders(true), 60000);
    return () => clearInterval(interval);
  }, [fetchWorkOrders]);

  useEffect(() => {
    buildColumns(allWorkOrders, searchTerm, machineFilter, priorityFilter);
  }, [searchTerm, machineFilter, priorityFilter, allWorkOrders, buildColumns]);

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    setDragError(null);

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const srcColId = source.droppableId;
    const dstColId = destination.droppableId;
    const woId = parseInt(draggableId.replace('wo-', ''));

    // Same column reorder
    if (srcColId === dstColId) {
      setColumns((prev) => {
        const updated = prev.map((col) => {
          if (col.id !== srcColId) return col;
          const items = [...col.items];
          const [moved] = items.splice(source.index, 1);
          items.splice(destination.index, 0, moved);
          return { ...col, items };
        });
        return updated;
      });
      return;
    }

    // Validate transition
    const validTargets = VALID_TRANSITIONS[srcColId] || [];
    if (!validTargets.includes(dstColId)) {
      setDragError(`Tidak bisa pindah dari "${srcColId}" ke "${dstColId}"`);
      setTimeout(() => setDragError(null), 3000);
      return;
    }

    // Optimistic update
    setColumns((prev) => {
      const newCols = prev.map((col) => ({ ...col, items: [...col.items] }));
      const srcCol = newCols.find((c) => c.id === srcColId)!;
      const dstCol = newCols.find((c) => c.id === dstColId)!;
      const [moved] = srcCol.items.splice(source.index, 1);
      moved.status = dstColId;
      dstCol.items.splice(destination.index, 0, moved);
      return newCols;
    });

    // API call
    setUpdatingWO(woId);
    try {
      await axiosInstance.put(`/api/production/work-orders/${woId}/status`, {
        status: dstColId,
      });
      // Update allWorkOrders
      setAllWorkOrders((prev) =>
        prev.map((wo) => (wo.id === woId ? { ...wo, status: dstColId } : wo))
      );
    } catch (error: any) {
      console.error('Error updating status:', error);
      setDragError(error.response?.data?.error || 'Gagal update status Work Order');
      setTimeout(() => setDragError(null), 4000);
      // Revert
      fetchWorkOrders(true);
    } finally {
      setUpdatingWO(null);
    }
  };

  const getProgressPercent = (wo: WorkOrder) => {
    if (wo.quantity <= 0) return 0;
    return Math.min(100, Math.round((wo.quantity_produced / wo.quantity) * 100));
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    } catch {
      return null;
    }
  };

  const isOverdue = (wo: WorkOrder) => {
    if (!wo.required_date || wo.status === 'completed' || wo.status === 'cancelled') return false;
    return new Date(wo.required_date) < new Date();
  };

  const totalCount = columns.reduce((sum, col) => sum + col.items.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat Work Orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardDocumentListIcon className="h-7 w-7 text-blue-600" />
            Work Order Kanban Board
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Drag & drop untuk mengubah status Work Order &middot; {totalCount} items
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchWorkOrders(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => navigate('/app/production/work-orders/new')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Work Order Baru
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari WO number, produk, mesin..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <select
          value={machineFilter}
          onChange={(e) => setMachineFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Semua Mesin</option>
          {machines.map((m) => (
            <option key={m.id} value={String(m.id)}>
              {m.name}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Semua Priority</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>

        {(searchTerm || machineFilter || priorityFilter) && (
          <button
            onClick={() => {
              setSearchTerm('');
              setMachineFilter('');
              setPriorityFilter('');
            }}
            className="px-3 py-2 text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Reset Filter
          </button>
        )}
      </div>

      {/* Drag Error */}
      {dragError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 text-sm animate-pulse">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
          {dragError}
        </div>
      )}

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
          {columns.map((column) => (
            <div
              key={column.id}
              className={`flex flex-col rounded-xl border-2 ${column.borderColor} ${column.bgColor} min-w-[280px] w-[280px] flex-shrink-0`}
            >
              {/* Column Header */}
              <div className={`px-4 py-3 ${column.headerBg} rounded-t-lg`}>
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 ${column.color} font-semibold`}>
                    {column.icon}
                    <span>{column.title}</span>
                  </div>
                  <span
                    className={`inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-bold rounded-full ${column.color} bg-white/70`}
                  >
                    {column.items.length}
                  </span>
                </div>
              </div>

              {/* Droppable Area */}
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 p-2 space-y-2 overflow-y-auto transition-colors ${
                      snapshot.isDraggingOver ? 'bg-white/50 ring-2 ring-inset ring-blue-300' : ''
                    }`}
                    style={{ maxHeight: 'calc(100vh - 320px)' }}
                  >
                    {column.items.length === 0 && !snapshot.isDraggingOver && (
                      <div className="text-center py-8 text-gray-400 text-sm">
                        <ClipboardDocumentListIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        Tidak ada Work Order
                      </div>
                    )}

                    {column.items.map((wo, index) => (
                      <Draggable
                        key={`wo-${wo.id}`}
                        draggableId={`wo-${wo.id}`}
                        index={index}
                        isDragDisabled={
                          updatingWO === wo.id ||
                          (VALID_TRANSITIONS[wo.status] || []).length === 0
                        }
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`bg-white rounded-lg border shadow-sm p-3 transition-all cursor-grab active:cursor-grabbing ${
                              snapshot.isDragging
                                ? 'shadow-lg ring-2 ring-blue-400 rotate-1 scale-105'
                                : 'hover:shadow-md border-gray-200'
                            } ${updatingWO === wo.id ? 'opacity-60' : ''} ${
                              isOverdue(wo) ? 'border-l-4 border-l-red-500' : ''
                            }`}
                          >
                            {/* Card Header */}
                            <div className="flex items-start justify-between mb-2">
                              <button
                                onClick={() => navigate(`/app/production/work-orders/${wo.id}`)}
                                className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {wo.wo_number}
                              </button>
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                                  PRIORITY_STYLES[wo.priority]?.badge || PRIORITY_STYLES.normal.badge
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    PRIORITY_STYLES[wo.priority]?.dot || PRIORITY_STYLES.normal.dot
                                  }`}
                                />
                                {wo.priority.toUpperCase()}
                              </span>
                            </div>

                            {/* Product */}
                            <p className="text-sm text-gray-900 font-medium truncate" title={wo.product_name}>
                              {wo.product_name}
                            </p>

                            {/* Machine */}
                            {wo.machine_name && (
                              <p className="text-xs text-gray-500 mt-1 truncate">
                                🏭 {wo.machine_name}
                              </p>
                            )}

                            {/* Progress */}
                            {wo.status === 'in_progress' && (
                              <div className="mt-2">
                                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                  <span>
                                    {wo.quantity_produced.toLocaleString()}/{wo.quantity.toLocaleString()} {wo.uom}
                                  </span>
                                  <span className="font-medium">{getProgressPercent(wo)}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full transition-all ${
                                      getProgressPercent(wo) >= 100
                                        ? 'bg-green-500'
                                        : getProgressPercent(wo) >= 50
                                        ? 'bg-blue-500'
                                        : 'bg-amber-500'
                                    }`}
                                    style={{ width: `${getProgressPercent(wo)}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Quantity for non-in_progress */}
                            {wo.status !== 'in_progress' && (
                              <p className="text-xs text-gray-500 mt-1">
                                Target: {wo.quantity.toLocaleString()} {wo.uom}
                              </p>
                            )}

                            {/* Footer */}
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                {wo.required_date && (
                                  <span className={isOverdue(wo) ? 'text-red-500 font-medium' : ''}>
                                    {isOverdue(wo) ? '⚠ ' : '📅 '}
                                    {formatDate(wo.required_date)}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => navigate(`/app/production/work-orders/${wo.id}`)}
                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                title="Detail"
                              >
                                <ChevronRightIcon className="h-4 w-4" />
                              </button>
                            </div>

                            {updatingWO === wo.id && (
                              <div className="absolute inset-0 bg-white/60 rounded-lg flex items-center justify-center">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500 bg-white p-3 rounded-lg border border-gray-200">
        <span className="font-medium text-gray-700">Transisi valid:</span>
        <span>Planned → Released → In Progress → Completed</span>
        <span className="text-gray-300">|</span>
        <span>Planned / Released → Cancelled</span>
        <span className="text-gray-300">|</span>
        <span>Cancelled → Planned</span>
        <span className="text-gray-300">|</span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-2 border-l-2 border-l-red-500 bg-gray-100 rounded-sm" />
          Overdue
        </span>
      </div>
    </div>
  );
};

export default WorkOrderKanban;
