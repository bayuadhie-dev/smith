import React from 'react';
import InventoryListEnhanced from './InventoryListEnhanced';

// Separate route identity for /warehouse/inventory (sidebar: "Penambahan Bahan Baku") —
// reuses InventoryListEnhanced's table/data logic via composition (not duplicated),
// but defaults the item-type filter to materials only, distinct from
// /warehouse/stock-summary ("Barang per Gudang") which shows everything.
const RawMaterialStockPage: React.FC = () => {
  return <InventoryListEnhanced mode="bahan-baku" />;
};

export default RawMaterialStockPage;
