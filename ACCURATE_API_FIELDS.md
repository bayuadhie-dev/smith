# Referensi Field API Accurate Online (Modul Item / Barang)

Dokumen ini berisi daftar field API yang tersedia pada endpoint `/accurate/api/item/list.do` dan `/accurate/api/item/detail.do` Accurate Online.

---

### 1. Identitas Barang
* `id`
* `no`
* `name`
* `itemType`
* `itemCategory`
* `barcode`
* `suspended`
* `vendor`

---

### 2. Stok, Kuantitas & Satuan (UoM)
* `stkQuantity`
* `unitName`
* `unit1Name`
* `unit2Name`
* `unit3Name`
* `unit4Name`
* `unit1Ratio`
* `unit2Ratio`
* `unit3Ratio`
* `unit4Ratio`
* `detailBalance`

---

### 3. Harga & Biaya (Pricing & HPP)
* `unitPrice`
* `unitPrice1`
* `unitPrice2`
* `unitPrice3`
* `unitPrice4`
* `unitPrice5`
* `lastPurchaseCost`
* `cost`

---

### 4. Komponen & BOM (Tipe Grouping)
* `detailGroup`
  * `item`
  * `quantity`

---

### 5. Akun G/L (General Ledger)
* `inventoryGlAccountId`
* `salesGlAccountId`
* `salesReturnGlAccountId`
* `cogsGlAccountId`
* `purchaseReturnGlAccountId`
* `unbilledGoodsGlAccountId`
* `goodsInTransitGlAccountId`

---

### 6. Pajak & Field Kustom
* `tax1Id`
* `tax2Id`
* `customField1` s/d `customField10`
* `createDate`
* `lastUpdate`
