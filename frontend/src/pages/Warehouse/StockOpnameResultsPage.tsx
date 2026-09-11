import React from 'react';
import StockOpnameList from './StockOpnameList';

// Separate route identity for /warehouse/stock-opname/results (sidebar: "Hasil Opname") —
// reuses StockOpnameList's table/data logic via composition (not duplicated), but
// defaults to completed orders and drops the "create new order" action, since
// browsing results is a different task from issuing a new opname command
// (that's /warehouse/stock-opname, "Perintah Opname").
const StockOpnameResultsPage: React.FC = () => {
  return <StockOpnameList mode="hasil" />;
};

export default StockOpnameResultsPage;
