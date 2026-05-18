# Batch Number Flow - Dokumentasi Lengkap

## Overview
Batch number adalah nomor identifikasi unik yang melacak produk dari pencampuran bahan baku hingga pengiriman. Batch number memastikan traceability penuh dalam sistem produksi.

## Alur Batch Number

```
Ingredient Mixing → Work Order → Output Mesin → WIP → FG → Gudang → Pengiriman
      ↓                ↓              ↓          ↓     ↓      ↓         ↓
  BATCH-001        BATCH-001      BATCH-001  BATCH-001 BATCH-001 BATCH-001 BATCH-001
```

## 1. Pembuatan Batch Number

### Sumber Batch Number
Batch number dibuat saat **pencampuran bahan baku (ingredient mixing)**. Ini adalah titik awal batch tracking.

**Format**: `BATCH-YYYYMMDD-XXX`
- `YYYYMMDD`: Tanggal pencampuran
- `XXX`: Nomor urut dalam hari tersebut

**Contoh**: `BATCH-20260513-001`

### Cara Input Batch Number
Batch number diinput secara **manual** oleh operator saat:
1. Membuat Work Order
2. Mencatat hasil pencampuran bahan baku
3. Memulai produksi

## 2. Batch Number di Work Order

### Field: `work_orders.batch_number`
- **Type**: VARCHAR(100)
- **Nullable**: Yes (untuk backward compatibility)
- **Index**: Yes

### Cara Mengisi
Saat membuat Work Order, operator harus mengisi batch number:

```json
POST /api/work-orders
{
  "product_id": 123,
  "quantity": 1000,
  "batch_number": "BATCH-20260513-001",  // ← Input manual
  "scheduled_start_date": "2026-05-13",
  ...
}
```

### Update Work Order
Batch number bisa diupdate jika masih dalam status `planned` atau `released`:

```json
PUT /api/work-orders/{id}
{
  "batch_number": "BATCH-20260513-001"
}
```

## 3. Batch Number di Shift Production

### Field: `shift_productions.batch_number`
- **Type**: VARCHAR(100)
- **Nullable**: Yes
- **Index**: Yes
- **Source**: Otomatis dari Work Order

### Alur Otomatis
Saat membuat production record, batch number **otomatis diambil dari Work Order**:

```python
shift_production = ShiftProduction(
    work_order_id=wo.id,
    batch_number=wo.batch_number,  # ← Otomatis dari WO
    ...
)
```

Operator **tidak perlu input manual** di shift production.

## 4. Batch Number di WIP Stock

### Field: `wip_stock.batch_number`
- **Type**: VARCHAR(100)
- **Nullable**: Yes
- **Index**: Yes

### Alur
Saat output mesin masuk ke WIP:
1. Batch number dari ShiftProduction
2. Disimpan ke WIP Stock
3. Digunakan untuk tracking WIP

## 5. Batch Number di FG Conversion

### Field: `fg_conversions.batch_number`
- **Type**: VARCHAR(100)
- **Nullable**: No (required)
- **Index**: Yes

### Alur
Saat WIP dikonversi ke FG:
1. Batch number dari WIP Stock
2. Disimpan ke FG Conversion
3. Digunakan untuk validasi batch output (±10% tolerance)

### Validasi Batch
```python
# Cek apakah output mesin sesuai dengan ingredient quantity
ingredient_qty = 1000  # dari mixing
output_qty = 950       # dari shift production
tolerance = abs((output_qty - ingredient_qty) / ingredient_qty * 100)

if tolerance <= 10:
    # Valid - dalam toleransi ±10%
    batch_validated = True
else:
    # Invalid - di luar toleransi
    batch_validated = False
```

## 6. Batch Number di FG Inventory

### Field: `inventory.batch_number`
- **Type**: VARCHAR(100)
- **Nullable**: Yes
- **Index**: Yes

### Alur
Saat FG Conversion completed:
1. Batch number dari FG Conversion
2. Disimpan ke Inventory (Finish Good)
3. Digunakan untuk FIFO tracking

## 7. Batch Number di Quality Control

### Field: `quality_inspections.batch_number`
- **Type**: VARCHAR(100)
- **Nullable**: Yes

### Alur
Saat QC inspection:
1. Batch number dari WIP atau FG
2. Disimpan di QC record
3. Digunakan untuk tracking quality per batch

## 8. Batch Number di Shipping

### Field: `shipping_order_items.batch_number`
- **Type**: VARCHAR(100)
- **Nullable**: Yes

### Alur
Saat pengiriman:
1. Batch number dari FG Inventory (FIFO)
2. Disimpan di shipping record
3. Customer bisa trace batch number

## Best Practices

### 1. Konsistensi Format
Gunakan format yang konsisten untuk batch number:
- `BATCH-YYYYMMDD-XXX` untuk produksi harian
- `BATCH-YYYYMM-XXX` untuk produksi bulanan
- Sesuaikan dengan kebutuhan perusahaan

### 2. Validasi Input
Validasi batch number saat input:
```python
def validate_batch_number(batch_number):
    # Format: BATCH-YYYYMMDD-XXX
    import re
    pattern = r'^BATCH-\d{8}-\d{3}$'
    return re.match(pattern, batch_number) is not None
```

### 3. Unique Constraint
Pastikan batch number unik per Work Order:
```sql
CREATE UNIQUE INDEX idx_wo_batch_unique 
ON work_orders(batch_number) 
WHERE batch_number IS NOT NULL;
```

### 4. Traceability Report
Buat laporan traceability per batch:
```sql
SELECT 
    wo.batch_number,
    wo.wo_number,
    sp.production_date,
    sp.good_quantity as output_qty,
    fc.total_fg_qty,
    fc.total_loss_qty,
    inv.quantity_on_hand as stock_qty,
    so.shipped_quantity
FROM work_orders wo
LEFT JOIN shift_productions sp ON sp.work_order_id = wo.id
LEFT JOIN fg_conversions fc ON fc.batch_number = wo.batch_number
LEFT JOIN inventory inv ON inv.batch_number = wo.batch_number
LEFT JOIN shipping_orders so ON so.batch_number = wo.batch_number
WHERE wo.batch_number = 'BATCH-20260513-001';
```

## Troubleshooting

### Problem: Batch number kosong di ShiftProduction
**Solusi**: 
1. Pastikan batch_number diisi di Work Order
2. Jalankan migration: `python add_batch_number_to_shift_production.py`
3. Update existing records:
```sql
UPDATE shift_productions sp
SET batch_number = (
    SELECT wo.batch_number 
    FROM work_orders wo 
    WHERE wo.id = sp.work_order_id
)
WHERE sp.batch_number IS NULL;
```

### Problem: FG Conversion gagal karena batch number tidak ada
**Solusi**:
1. Cek Work Order apakah batch_number terisi
2. Cek ShiftProduction apakah batch_number terisi
3. Update Work Order dengan batch number yang benar

### Problem: Batch validation gagal (tolerance > 10%)
**Solusi**:
1. Cek ingredient quantity di mixing record
2. Cek output quantity di ShiftProduction
3. Investigasi penyebab selisih (loss, reject, dll)
4. Jika valid, bisa override validation dengan approval

## Summary

| Tahap | Tabel | Field | Source | Input Method |
|-------|-------|-------|--------|--------------|
| 1. Mixing | - | - | - | Manual (operator) |
| 2. Work Order | work_orders | batch_number | Manual input | Manual |
| 3. Production | shift_productions | batch_number | From WO | Otomatis |
| 4. WIP | wip_stock | batch_number | From ShiftProduction | Otomatis |
| 5. FG Conversion | fg_conversions | batch_number | From WIP | Otomatis |
| 6. FG Inventory | inventory | batch_number | From FG Conversion | Otomatis |
| 7. QC | quality_inspections | batch_number | From WIP/FG | Otomatis |
| 8. Shipping | shipping_order_items | batch_number | From Inventory (FIFO) | Otomatis |

**Key Point**: Batch number hanya diinput **1 kali secara manual** di Work Order, setelah itu mengalir otomatis ke semua tahap berikutnya.
