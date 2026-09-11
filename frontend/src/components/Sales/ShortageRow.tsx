import React, { useState } from 'react'

// Shared with SalesOrderForm.tsx and SalesForecastForm.tsx - both call the
// same backend endpoint (/api/production/boms/:id/shortage-analysis), which
// already returns nested BOM-explosion data (WIP items with their own
// sub-shortages via `children`). Keep this in one place so both forms render
// the same hierarchical breakdown instead of two different views.

export interface MaterialShortage {
  item_name: string;
  item_code: string;
  required_quantity: number;
  available_quantity: number;
  shortage_quantity: number;
  is_critical: boolean;
  supplier_name: string | null;
  lead_time_days: number;
  unit_cost: number;
  is_wip?: boolean;
  has_own_bom?: boolean;
  matched_via?: string | null;
  children?: MaterialShortage[] | null;
}

const ShortageRow: React.FC<{ item: MaterialShortage; depth: number }> = ({ item, depth }) => {
  const [expanded, setExpanded] = useState(depth === 0 || item.shortage_quantity > 0)
  const hasChildren = !!item.children && item.children.length > 0

  return (
    <>
      <tr className={`border-b last:border-0 ${item.is_critical ? 'bg-red-50' : ''}`}>
        <td className="py-2" style={{ paddingLeft: depth * 20 }}>
          <div className="flex items-center gap-1">
            {hasChildren && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                {expanded ? '▾' : '▸'}
              </button>
            )}
            <span className="font-medium">{item.item_name}</span>
            {item.is_wip && (
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">WIP</span>
            )}
            {item.is_critical && (
              <span className="px-1.5 py-0.5 bg-red-600 text-white text-xs rounded">CRITICAL</span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400" style={{ paddingLeft: hasChildren ? 16 : 0 }}>{item.item_code}</p>
        </td>
        <td className="py-2 text-right">{item.required_quantity.toLocaleString()}</td>
        <td className="py-2 text-right">{item.available_quantity.toLocaleString()}</td>
        <td className="py-2 text-right font-medium text-red-600">
          {item.shortage_quantity > 0 ? item.shortage_quantity.toLocaleString() : '-'}
        </td>
        <td className="py-2">
          {item.supplier_name || '-'}
          {item.lead_time_days > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{item.lead_time_days} days</p>
          )}
        </td>
      </tr>
      {hasChildren && expanded && item.children!.map((child, i) => (
        <ShortageRow key={i} item={child} depth={depth + 1} />
      ))}
    </>
  )
}

export default ShortageRow
