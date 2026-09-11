"""
Field Library for Print Template Designer (Fase 1, §5/§6 of the plan).

Backend-owned registry of which document_data paths are available per
document_type, replacing the old hardcoded TypeScript constant in the retired
TemplateDesigner.tsx - adding a new document type (or a new field to an
existing one) is a backend-only change now, no frontend redeploy needed.

`type` per field: 'scalar' (plain text/number), 'image' (bindable to the
editor's Image element), or 'list' (an array in document_data - the ONLY
kind eligible as a Repeating Table's `dataSource`; its sub-fields are listed
under `columns` for the editor to offer when the user configures table columns).

COMPANY_FIELDS is merged into every document_type's field list - company
profile data is available to every document, per the explicit requirement
that it must never be redesigned per-template (see utils/company_context.py).
"""

COMPANY_FIELDS = [
    {'path': 'company.name', 'label': 'Nama Perusahaan', 'type': 'scalar'},
    {'path': 'company.legal_name', 'label': 'Nama Resmi (Legal)', 'type': 'scalar'},
    {'path': 'company.address', 'label': 'Alamat', 'type': 'scalar'},
    {'path': 'company.city', 'label': 'Kota', 'type': 'scalar'},
    {'path': 'company.country', 'label': 'Negara', 'type': 'scalar'},
    {'path': 'company.phone', 'label': 'Telepon', 'type': 'scalar'},
    {'path': 'company.email', 'label': 'Email', 'type': 'scalar'},
    {'path': 'company.website', 'label': 'Website', 'type': 'scalar'},
    {'path': 'company.tax_id', 'label': 'NPWP', 'type': 'scalar'},
    {'path': 'company.logo_url', 'label': 'Logo Perusahaan', 'type': 'image'},
]

_DOCUMENT_TYPE_FIELDS = {
    'spk': [
        {'path': 'document_number', 'label': 'Nomor Dokumen', 'type': 'scalar'},
        {'path': 'document_date', 'label': 'Tanggal Dokumen', 'type': 'scalar'},
        {'path': 'work_order_number', 'label': 'Nomor WO', 'type': 'scalar'},
        {'path': 'product_name', 'label': 'Nama Produk', 'type': 'scalar'},
        {'path': 'product_code', 'label': 'Kode Produk', 'type': 'scalar'},
        {'path': 'quantity', 'label': 'Kuantitas', 'type': 'scalar'},
        {'path': 'uom', 'label': 'Satuan', 'type': 'scalar'},
        {'path': 'start_date', 'label': 'Tanggal Mulai', 'type': 'scalar'},
        {'path': 'due_date', 'label': 'Tanggal Selesai', 'type': 'scalar'},
        {'path': 'priority', 'label': 'Prioritas', 'type': 'scalar'},
        {'path': 'notes', 'label': 'Catatan', 'type': 'scalar'},
        {'path': 'machine', 'label': 'Mesin', 'type': 'scalar'},
        {'path': 'operator', 'label': 'Operator', 'type': 'scalar'},
        {'path': 'supervisor', 'label': 'Supervisor', 'type': 'scalar'},
        {'path': 'approved_by', 'label': 'Disetujui Oleh', 'type': 'scalar'},
    ],
    'spk_batch': [
        {'path': 'document_number', 'label': 'Nomor Dokumen', 'type': 'scalar'},
        {'path': 'document_date', 'label': 'Tanggal Dokumen', 'type': 'scalar'},
        {'path': 'batch_number', 'label': 'Nomor Batch', 'type': 'scalar'},
        {'path': 'work_order_number', 'label': 'Nomor WO', 'type': 'scalar'},
        {'path': 'product_name', 'label': 'Nama Produk', 'type': 'scalar'},
        {'path': 'product_code', 'label': 'Kode Produk', 'type': 'scalar'},
        {'path': 'quantity', 'label': 'Kuantitas', 'type': 'scalar'},
        {'path': 'uom', 'label': 'Satuan', 'type': 'scalar'},
        {'path': 'machine', 'label': 'Mesin', 'type': 'scalar'},
        {'path': 'scheduled_date', 'label': 'Tanggal Jadwal', 'type': 'scalar'},
        {'path': 'shift_number', 'label': 'Shift', 'type': 'scalar'},
        {'path': 'sequence_in_shift', 'label': 'Urutan di Shift', 'type': 'scalar'},
        {'path': 'operator', 'label': 'Operator', 'type': 'scalar'},
        {'path': 'supervisor', 'label': 'Supervisor', 'type': 'scalar'},
        {'path': 'approved_by', 'label': 'Disetujui Oleh', 'type': 'scalar'},
    ],
    'surat_jalan': [
        {'path': 'document_number', 'label': 'Nomor Dokumen', 'type': 'scalar'},
        {'path': 'document_date', 'label': 'Tanggal Dokumen', 'type': 'scalar'},
        {'path': 'sales_order_number', 'label': 'Nomor SO', 'type': 'scalar'},
        {'path': 'customer_name', 'label': 'Nama Customer', 'type': 'scalar'},
        {'path': 'customer_address', 'label': 'Alamat Customer', 'type': 'scalar'},
        {'path': 'customer_phone', 'label': 'Telepon Customer', 'type': 'scalar'},
        {'path': 'total_quantity', 'label': 'Total Kuantitas', 'type': 'scalar'},
        {'path': 'notes', 'label': 'Catatan', 'type': 'scalar'},
        {'path': 'prepared_by', 'label': 'Disiapkan Oleh', 'type': 'scalar'},
        {'path': 'received_by', 'label': 'Diterima Oleh', 'type': 'scalar'},
        {'path': 'driver_name', 'label': 'Nama Sopir', 'type': 'scalar'},
        {'path': 'vehicle_number', 'label': 'Nomor Kendaraan', 'type': 'scalar'},
        {'path': 'items', 'label': 'Daftar Barang', 'type': 'list', 'columns': [
            {'path': 'product_name', 'label': 'Nama Produk'},
            {'path': 'quantity', 'label': 'Qty'},
            {'path': 'uom', 'label': 'Satuan'},
            {'path': 'description', 'label': 'Keterangan'},
        ]},
    ],
    # Invoice belum pernah punya mekanisme cetak sama sekali sebelum Fase 1 ini
    # (lihat peta scope) - field di bawah dipetakan ke kolom nyata models/finance.py
    # Invoice/InvoiceItem, bukan cuma daftar konsep. tax_invoice_number/date TIDAK
    # ada kolomnya di model saat ini - sengaja tidak didaftarkan (bukan field mati).
    'invoice': [
        {'path': 'document_number', 'label': 'Nomor Invoice', 'type': 'scalar'},
        {'path': 'document_date', 'label': 'Tanggal Invoice', 'type': 'scalar'},
        {'path': 'due_date', 'label': 'Jatuh Tempo', 'type': 'scalar'},
        {'path': 'po_number', 'label': 'Nomor PO Customer', 'type': 'scalar'},
        {'path': 'ship_to', 'label': 'Alamat Kirim', 'type': 'scalar'},
        {'path': 'status', 'label': 'Status Pembayaran', 'type': 'scalar'},
        {'path': 'customer_name', 'label': 'Nama Customer', 'type': 'scalar'},
        {'path': 'customer_address', 'label': 'Alamat Customer', 'type': 'scalar'},
        {'path': 'payment_terms', 'label': 'Termin Pembayaran', 'type': 'scalar'},
        {'path': 'notes', 'label': 'Catatan', 'type': 'scalar'},
        {'path': 'subtotal', 'label': 'Subtotal', 'type': 'scalar'},
        {'path': 'tax_amount', 'label': 'PPN', 'type': 'scalar'},
        {'path': 'discount_amount', 'label': 'Diskon', 'type': 'scalar'},
        {'path': 'total_amount', 'label': 'Total', 'type': 'scalar'},
        {'path': 'balance_due', 'label': 'Sisa Tagihan', 'type': 'scalar'},
        {'path': 'line_items', 'label': 'Daftar Item', 'type': 'list', 'columns': [
            {'path': 'item_name', 'label': 'Nama Item'},
            {'path': 'quantity', 'label': 'Qty'},
            {'path': 'uom', 'label': 'Satuan'},
            {'path': 'unit_price', 'label': 'Harga Satuan'},
            {'path': 'subtotal', 'label': 'Subtotal'},
        ]},
    ],
    'purchase_order': [
        {'path': 'document_number', 'label': 'Nomor PO', 'type': 'scalar'},
        {'path': 'document_date', 'label': 'Tanggal PO', 'type': 'scalar'},
        {'path': 'required_date', 'label': 'Tanggal Dibutuhkan', 'type': 'scalar'},
        {'path': 'supplier_name', 'label': 'Nama Supplier', 'type': 'scalar'},
        {'path': 'supplier_address', 'label': 'Alamat Supplier', 'type': 'scalar'},
        {'path': 'delivery_address', 'label': 'Alamat Pengiriman', 'type': 'scalar'},
        {'path': 'payment_terms', 'label': 'Termin Pembayaran', 'type': 'scalar'},
        {'path': 'notes', 'label': 'Catatan', 'type': 'scalar'},
        {'path': 'subtotal', 'label': 'Subtotal', 'type': 'scalar'},
        {'path': 'tax_amount', 'label': 'PPN', 'type': 'scalar'},
        {'path': 'discount_amount', 'label': 'Diskon', 'type': 'scalar'},
        {'path': 'total_amount', 'label': 'Total', 'type': 'scalar'},
        {'path': 'line_items', 'label': 'Daftar Item', 'type': 'list', 'columns': [
            {'path': 'item_name', 'label': 'Nama Item'},
            {'path': 'quantity', 'label': 'Qty'},
            {'path': 'uom', 'label': 'Satuan'},
            {'path': 'unit_price', 'label': 'Harga Satuan'},
            {'path': 'subtotal', 'label': 'Subtotal'},
        ]},
    ],
    # Kwitansi = bukti pembayaran (Payment model, payment_type receipt/payment) -
    # bukan model terpisah, reuse Payment yang sudah ada.
    'kwitansi': [
        {'path': 'document_number', 'label': 'Nomor Kwitansi', 'type': 'scalar'},
        {'path': 'document_date', 'label': 'Tanggal', 'type': 'scalar'},
        {'path': 'payment_type_label', 'label': 'Jenis (Terima/Bayar)', 'type': 'scalar'},
        {'path': 'party_name', 'label': 'Nama Customer/Supplier', 'type': 'scalar'},
        {'path': 'amount', 'label': 'Jumlah', 'type': 'scalar'},
        {'path': 'payment_method', 'label': 'Metode Pembayaran', 'type': 'scalar'},
        {'path': 'reference_number', 'label': 'Nomor Referensi', 'type': 'scalar'},
        {'path': 'invoice_number', 'label': 'Nomor Invoice Terkait', 'type': 'scalar'},
        {'path': 'notes', 'label': 'Catatan', 'type': 'scalar'},
    ],
}


def get_field_library(document_type):
    """company.* selalu ikut, apa pun document_type-nya (requirement eksplisit -
    company profile tidak boleh perlu didesain ulang per template)."""
    return {
        'company': COMPANY_FIELDS,
        document_type: _DOCUMENT_TYPE_FIELDS.get(document_type, []),
    }
