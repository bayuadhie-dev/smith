/** Nama jenis hasil pencarian (dari /api/search/global) dalam Bahasa Indonesia. */
export const TYPE_LABEL: Record<string, string> = {
  'Work Order': 'SPK',
  'Sales Order': 'Sales Order',
  'Purchase Order': 'Purchase Order',
  Product: 'Produk',
  Customer: 'Pelanggan',
  Supplier: 'Pemasok',
  Employee: 'Karyawan',
  Document: 'Dokumen',
}

/** Dokumen transaksi lebih dulu, baru data master. */
export const TYPE_ORDER = [
  'Sales Order', 'Purchase Order', 'Faktur Penjualan', 'Faktur Pembelian', 'Surat Jalan',
  'Penerimaan Barang', 'Work Order', 'Product', 'Customer', 'Supplier', 'Employee', 'Document',
]

export const typeLabel = (t: string) => TYPE_LABEL[t] || t

export const typeRank = (t: string) => {
  const i = TYPE_ORDER.indexOf(t)
  return i < 0 ? TYPE_ORDER.length : i
}

/** Kata yang bisa diketik untuk memanggil satu jenis dokumen (cermin _TYPE_ALIASES di backend/routes/search.py). */
export const TYPE_HINTS = ['surat jalan', 'faktur penjualan', 'faktur pembelian', 'penerimaan barang', 'sales order', 'purchase order', 'SPK', 'produk', 'pelanggan', 'pemasok']
