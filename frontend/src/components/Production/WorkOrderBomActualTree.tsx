import { useState } from 'react';
import { ChevronRightIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

export interface BomTreeItem {
  id: number;
  parent_item_id: number | null;
  depth: number;
  material_id?: number | null;
  product_id?: number | null;
  item_code: string | null;
  item_name: string;
  item_type: string; // 'material' | 'wip_sub_assembly'
  uom: string;
  quantity_planned: number;
  quantity_actual: number | null;
  suggested_actual?: number | null;
  suggested_actual_note?: string | null;
  actual_batch_number?: string | null;
}

interface Props {
  items: BomTreeItem[];
  actualValues: Record<number, string>;
  onChangeActual: (itemId: number, value: string) => void;
  onViewInventory?: (item: BomTreeItem) => void;
}

function buildChildrenMap(items: BomTreeItem[]) {
  const map: Record<string, BomTreeItem[]> = {};
  items.forEach((item) => {
    const key = item.parent_item_id === null ? 'root' : String(item.parent_item_id);
    if (!map[key]) map[key] = [];
    map[key].push(item);
  });
  return map;
}

function TreeNode({
  item,
  childrenMap,
  actualValues,
  onChangeActual,
  onViewInventory,
}: {
  item: BomTreeItem;
  childrenMap: Record<string, BomTreeItem[]>;
  actualValues: Record<number, string>;
  onChangeActual: (itemId: number, value: string) => void;
  onViewInventory?: (item: BomTreeItem) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = childrenMap[String(item.id)] || [];
  const isSubAssembly = item.item_type === 'wip_sub_assembly';

  return (
    <div>
      <div
        className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800"
        style={{ paddingLeft: `${(item.depth - 1) * 24}px` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {children.length > 0 ? (
            <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
              {expanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-4 flex-shrink-0" />
          )}
          <div className="min-w-0">
            {onViewInventory && (item.material_id || item.product_id) ? (
              <button
                type="button"
                onClick={() => onViewInventory(item)}
                className={`text-left hover:underline ${isSubAssembly ? 'font-medium text-gray-800 dark:text-gray-100' : 'text-blue-600 dark:text-blue-400'}`}
                title="Lihat stok item ini di semua lokasi"
              >
                {isSubAssembly ? '📦 ' : '• '}
                {item.item_code} - {item.item_name}
              </button>
            ) : (
              <span className={isSubAssembly ? 'font-medium text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}>
                {isSubAssembly ? '📦 ' : '• '}
                {item.item_code} - {item.item_name}
              </span>
            )}
            {isSubAssembly && <span className="ml-2 text-xs text-amber-600">(WIP - actual opsional)</span>}
            {!isSubAssembly && item.suggested_actual != null && (
              <div className="text-xs text-primary-600">
                Disarankan dari Material Issue: {item.suggested_actual.toLocaleString()} {item.uom} (sudah diisi otomatis, boleh diedit)
              </div>
            )}
            {item.suggested_actual_note && (
              <div className="text-xs text-amber-600">{item.suggested_actual_note}</div>
            )}
            {item.actual_batch_number && (
              <div className="text-xs text-gray-500 dark:text-gray-400">Batch dipakai: {item.actual_batch_number}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-sm text-gray-500 w-28 text-right">
            {item.quantity_planned.toLocaleString()} {item.uom}
          </span>
          <input
            type="number"
            step="any"
            className="input-field w-28"
            placeholder={isSubAssembly ? 'opsional' : 'wajib'}
            value={actualValues[item.id] ?? ''}
            onChange={(e) => onChangeActual(item.id, e.target.value)}
          />
        </div>
      </div>
      {expanded && children.map((child) => (
        <TreeNode key={child.id} item={child} childrenMap={childrenMap} actualValues={actualValues} onChangeActual={onChangeActual} onViewInventory={onViewInventory} />
      ))}
    </div>
  );
}

export default function WorkOrderBomActualTree({ items, actualValues, onChangeActual, onViewInventory }: Props) {
  const childrenMap = buildChildrenMap(items);
  const roots = childrenMap['root'] || [];

  if (roots.length === 0) {
    return <div className="text-sm text-gray-400">Tidak ada BOM untuk SPK ini.</div>;
  }

  return (
    <div>
      <div className="flex justify-between text-xs font-medium text-gray-500 uppercase pb-2 border-b border-gray-200 dark:border-gray-700">
        <span>Bahan</span>
        <span>Rencana / Aktual</span>
      </div>
      {roots.map((item) => (
        <TreeNode key={item.id} item={item} childrenMap={childrenMap} actualValues={actualValues} onChangeActual={onChangeActual} onViewInventory={onViewInventory} />
      ))}
    </div>
  );
}
