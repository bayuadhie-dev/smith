# 📖 PANDUAN OPERASIONAL PENGGUNA (USER MANUAL) ERP
## Panduan Lengkap, Detail, dan Komprehensif Seluruh Modul & Submodul Sistem
**Penyusun:** Mochammad Bayu Adhie Nugroho  
**Status Sistem:** Operasional Produksi  
**Bahasa Panduan:** Indonesia (100%)

---

## 📌 MEKANISME NAVIGASI UTAMA (DESK & WORKSPACE)
ERP dirancang menggunakan konsep **Desk-based Navigation** untuk mengorganisasi berbagai modul secara rapi. Pengguna harus memahami alur navigasi dasar berikut sebelum mengoperasikan sistem:

1. **Halaman Utama (Desk):** Setelah berhasil *Login*, pengguna akan diarahkan ke halaman **Desk** (`/desk`). Halaman ini berfungsi sebagai beranda utama yang menampilkan kartu-kartu visual untuk setiap modul (seperti *Production*, *Warehouse*, *Quality Control*, *Sales*, dll.).
2. **Masuk ke Workspace:** Klik salah satu kartu modul (contoh: kartu **`Production`**). Pengguna akan diarahkan ke dashboard khusus modul tersebut (`/desk/production`). Secara otomatis, sidebar sebelah kiri akan memfilter menu secara dinamis hanya untuk menampilkan sub-menu dan modul pendukung yang berkaitan dengan workspace tersebut.
3. **Kembali ke Desk:** Di bagian paling atas sidebar kiri, terdapat tombol biru **`← Kembali ke Desk`** dengan ikon panah kiri. Klik tombol ini untuk kembali ke halaman Desk utama untuk berpindah ke modul/workspace lainnya.
4. **Keyboard Shortcuts (Pintasan Keyboard):**
   * `Ctrl + K` → Membuka kolom pencarian cepat (*Quick Search*) untuk mencari data atau halaman di seluruh sistem.
   * `Ctrl + N` → Membuat rekaman/data baru (*New Record*) pada halaman yang sedang aktif.
   * `Ctrl + S` → Menyimpan form data yang sedang diisi (*Save Data*).
   * `Esc` → Menutup jendela modal, pop-up detail, atau membatalkan aksi aktif.

---

## 🗂️ DETAIL SETIAP GRUP MENU, MODUL, SUB-MODUL & PANDUAN KLIK TOMBOL

---

### 📂 GRUP 1: MAIN (MONITORING UTAMA)
Grup menu utama yang digunakan oleh operator, kepala bagian, dan manajemen untuk memantau status operasional pabrik secara real-time.

#### 1. Dashboard (`/app`)
* **Keterangan Halaman:** Menampilkan ringkasan eksekutif performa pabrik secara keseluruhan. Berisi widget: nilai OEE rata-rata mesin, total volume output produksi berjalan, estimasi nilai total persediaan gudang, status pengiriman logistik, sales pipeline, target bulanan, alarm downtime aktif, serta grafik tren penjualan.
* **Klik Tombol / Panduan Interaksi:**
  * Dropdown **`Periode`** (Kanan Atas) → Klik dan pilih opsi untuk memfilter rentang waktu data (*Hari ini*, *Minggu ini*, *Bulan ini*, *Tahun ini*).
  * Tombol **`Refresh`** (Ikon Putar ⟳) → Klik untuk memperbarui semua data widget tanpa harus memuat ulang browser.
  * Kartu KPI (misal: *Total Sales*, *Total Production*) → Klik kartu untuk navigasi langsung ke halaman analisis detail modul terkait.

#### 2. Production Monitoring / Executive Dashboard (`/app/executive/production-monitoring`)
* **Keterangan Halaman:** Visualisasi grafis pencapaian target output produksi vs aktual untuk tingkat eksekutif. Menampilkan grafik batang dan garis tren per mesin / per shift.
* **Klik Tombol / Panduan Form:**
  * Dropdown **`Pilih Line/Mesin`** → Klik untuk menyaring tampilan grafik berdasarkan satu mesin spesifik (Mesin 1, Mesin 2, dst.) atau tampilkan semua.
  * Dropdown **`Periode`** → Pilih *Harian*, *Mingguan*, atau *Bulanan* untuk mengubah rentang grafik.
  * Tombol **`Export PDF`** → Klik untuk mengunduh laporan grafik sebagai dokumen PDF siap cetak.
  * Tombol **`Export Excel`** → Klik untuk mengunduh data angka mentah ke format spreadsheet (.xlsx).

#### 3. Live Monitoring (`/app/production/live-monitoring`)
* **Keterangan Halaman:** Pemantauan patrol produksi berkala yang dilakukan setiap 2 jam di lantai produksi. Menampilkan grid mesin dengan slot waktu per-2-jam.
* **Klik Tombol / Panduan Form:**
  * Input **`Tanggal`** (Date Picker) & Select Dropdown **`Shift`** (Shift 1 / Shift 2 / Shift 3) → Pilih tanggal dan shift yang sedang berjalan untuk menampilkan grid patrol yang relevan.
  * Tombol **`Mismatch`** (Merah dengan angka indikator) → Klik untuk memunculkan modal pop-up yang menampilkan daftar ketidakcocokan antara input patrol lapangan dengan target schedule mingguan.
  * Tombol **`Summary Mingguan`** → Klik untuk beralih ke halaman rekapitulasi patrol mingguan (`/app/production/live-monitoring/weekly`).
  * **Cara Input Patrol (di dalam grid):**
    1. Klik pada **Slot Waktu** (kotak 2 jam sekali di baris mesin tertentu, contoh: kotak "08:00-10:00" di baris Mesin 3).
    2. Pada pop-up modal yang muncul, isi data:
       - **Status Mesin** → Pilih radio button *Running*, *Stopped*, atau *Delayed*.
       - **Kecepatan Aktual** → Masukkan angka kecepatan mesin saat ini (meter/menit).
       - **Target Output** & **Aktual Output** → Isi jumlah target dan output yang benar-benar tercapai dalam 2 jam.
       - **Kategori Downtime** → Jika status *Stopped*, pilih kategori dari dropdown: *Mesin*, *Operator*, *Material*, *Design*, *Idle*, atau *Others*.
       - **Alasan Downtime** → Ketik deskripsi singkat penyebab berhenti (contoh: *"Roll kain habis - menunggu stocking"*).
    3. Klik tombol **`Simpan`** (biru) untuk menyimpan data patrol ke sistem.

#### 4. Pre-Shift Checklist (`/app/production/pre-shift-checklist`)
* **Keterangan Halaman:** Kalender pemeriksaan standar kondisi kelayakan mesin dan kesiapan tenaga kerja sebelum shift produksi dimulai. Satu baris per mesin, satu kolom per shift.
* **Klik Tombol / Panduan Form:**
  * Tombol **`◀ Sebelumnya`** / **`Hari Ini`** / **`Selanjutnya ▶`** → Klik untuk navigasi antar hari dalam kalender checklist.
  * Tombol **`Summary Mingguan`** → Klik untuk melihat rekapitulasi seluruh checklist dalam satu minggu.
  * **Cara Mengisi Checklist Baru:**
    1. Klik pada **kotak shift mesin** yang masih abu-abu (status *Belum Diisi*). Sistem akan membuka form input `/app/production/pre-shift-checklist/form`.
    2. Pada halaman form:
       - **Nama Operator** → Ketik nama operator penanggung jawab shift ini.
       - **Produk** → Pilih nama produk yang akan diproduksi dari dropdown.
    3. Klik tab **`KONDISI MESIN`** → Untuk setiap item pemeriksaan mesin (kebersihan, kondisi pisau, sensor, heater, dll.), klik radio button **`OK`** (normal), **`NG`** (tidak memenuhi standar), atau **`N/A`** (tidak berlaku). Jika memilih *NG*, isi kolom catatan temuan.
    4. Klik tab **`MANPOWER`** → Periksa kelengkapan APD operator (safety shoes, masker, sarung tangan), kondisi kesehatan, dan kehadiran. Klik *OK/NG/N/A*.
    5. Klik tombol **`Simpan Checklist`** (hijau). **Penting:** Jika ada poin **NG**, sistem secara otomatis mengirim notifikasi alarm ke inbox departemen Maintenance dan memblokir mesin dari menjalankan produksi sampai diperbaiki.
  * Klik **`Lihat Detail`** (pada checklist yang sudah selesai) → Membuka halaman read-only ringkasan checklist yang telah diisi sebelumnya.

---

### 📂 GRUP 2: OPERATIONS (PRODUKSI & LOGISTIK)

#### 1. Modul Products / Barang (`/app/products`)
Modul pengelolaan master data produk jadi dan formula bahan baku.

##### 1a. Semua Produk (`/app/products`)
* **Keterangan:** Database master barang jadi (Finished Goods).
* **Klik Tombol:**
  * Tombol **`+ Add Product`** → Membuka form baru. Isi kolom:
    - **SKU**: Kode unik produk (contoh: *WW-P80-100s*)
    - **Nama Produk**: Nama lengkap barang jadi
    - **Kategori**: Pilih dari dropdown (*Wet Wipes / Dry Wipes / Tissue*)
    - **Brand**: Nama merek
    - **UoM**: Satuan pengukuran (Pack / Carton)
    - **Harga Jual (IDR)**: Harga jual ke pelanggan
    - **Harga Beli / HPP (IDR)**: Harga pokok produksi
    - **Berat per Unit (gram)**: Berat 1 unit barang
    - **Dimensi (P × L × T cm)**: Ukuran fisik kemasan
    - **Shelf Life (hari)**: Masa kadaluarsa dari tanggal produksi
    - Klik **`Save`** untuk menyimpan.
  * Tombol **`Edit`** (ikon pensil ✏️) di baris tabel → Membuka form edit spesifikasi produk yang sudah ada.
  * Tombol **`Hapus`** (ikon tempat sampah 🗑️) → Menghapus produk. **Catatan:** Hanya dapat dihapus jika produk belum pernah digunakan dalam transaksi WO/SO apapun.
  * Tombol **`Versions`** → Melihat sejarah revisi spesifikasi produk dari waktu ke waktu.
  * Tombol **`Compare`** → Pilih dua versi spesifikasi lalu klik tombol ini untuk membandingkan perbedaan parameter antar versi.

##### 1b. Kategori Produk (`/app/products/categories`)
* **Keterangan:** Pembagian kelompok produk untuk memudahkan pencarian.
* **Klik Tombol:** Tombol **`+ New Category`** → Isi nama kategori dan deskripsi singkat, klik **`Save`**.

##### 1c. Bill of Materials - BOM (`/app/products/bom`)
* **Keterangan:** Formula resep material penyusun setiap produk jadi.
* **Klik Tombol:**
  * Tombol **`+ New BOM`** → Membuka form baru:
    - **Pilih Produk Jadi**: Dropdown produk yang akan dibuat resepnya
    - **Nomor Versi**: Versi BOM (contoh: *v1.0*, *v2.0*)
    - **Batch Size**: Kapasitas batch standar produksi
    - **Pack per Carton**: Jumlah pack dalam 1 karton
    - Klik **`+ Add Material`**: Untuk setiap bahan baku, pilih **Nama Bahan Baku**, masukkan **Quantity** (kebutuhan per batch), **Scrap %** (toleransi pemborosan), dan centang kolom **Critical** jika bahan ini tidak boleh habis. Ulangi untuk setiap material.
    - Klik **`Save BOM`** untuk menyimpan.
  * Tombol **`Set Active`** (ikon bintang/centang) → Klik pada versi BOM tertentu untuk menjadikannya resep standar aktif yang digunakan saat Work Order dibuat.
  * Tombol **`Compare BOM`** → Pilih dua versi BOM untuk melihat perbedaan komposisi.

---

#### 2. Modul Warehouse & Inventory (`/app/warehouse`)

##### 2a. Dashboard Gudang (`/app/warehouse/dashboard`)
* **Keterangan:** Ringkasan KPI gudang: total nilai stok, persentase kapasitas terpakai, jumlah material di bawah reorder point, dan grafik pergerakan barang.
* **Interaksi:** Klik kartu KPI untuk navigasi ke halaman detail terkait.

##### 2b. Daftar Inventaris (`/app/warehouse/inventory`)
* **Keterangan:** Tampilan seluruh stok bahan baku beserta lokasi rak, jumlah stok saat ini, nilai stok, dan status ketersediaan.
* **Klik Tombol:**
  * Input **`Pencarian`** → Ketik nama material atau kode untuk menyaring daftar.
  * Dropdown **`Filter Gudang`** → Pilih gudang spesifik untuk melihat stok di gudang tertentu.
  * Tombol **`+ Add Stock`** → Penambahan stok bahan baku manual (darurat/non-PO). Isi material, gudang tujuan, jumlah stok masuk, nomor batch, nama supplier, dan harga beli. Klik **`Save`**.
  * Tombol **`Export`** → Mengunduh daftar inventaris dalam format Excel atau PDF.

##### 2c. Permintaan Barang (Material Issues) (`/app/warehouse/material-issues`)
* **Keterangan:** Pengeluaran bahan baku dari gudang ke lantai produksi berdasarkan Work Order (WO) aktif.
* **Klik Tombol:**
  * Tombol **`+ New Material Issue`** → Membuka form:
    1. **Pilih Nomor WO**: Pilih Work Order yang membutuhkan bahan baku dari dropdown.
    2. Sistem otomatis menampilkan daftar bahan baku dan kuantitas standar berdasarkan BOM aktif produk tersebut.
    3. Isi kolom **Quantity Issued** (jumlah aktual bahan yang benar-benar diserahkan ke produksi) untuk setiap material.
    4. Klik **`Post Issue`** → Stok gudang berkurang dan status biaya material bergeser ke akun WIP (Work In Progress).
  * Klik baris dokumen material issue → Membuka halaman detail menampilkan daftar item yang dikeluarkan.

##### 2d. Pemindahan Barang (Stock Movements) (`/app/warehouse/movements`)
* **Keterangan:** Transfer stok antar rak atau antar gudang di dalam area pabrik.
* **Klik Tombol:**
  * Tombol **`+ New Movement`** → Form pemindahan:
    - **Kode Material**: Pilih material yang dipindahkan
    - **Rak Asal (Source Bin)**: Pilih lokasi asal dari dropdown hierarki gudang
    - **Rak Tujuan (Target Bin)**: Pilih lokasi tujuan
    - **Quantity**: Jumlah unit yang dipindahkan
    - Klik **`Submit Movement`** → Perpindahan tercatat, saldo stok per-rak diperbarui.
  * Filter **`Tanggal`** & **`Tipe Gerakan`** → Menyaring riwayat pergerakan barang.

##### 2e. Penyesuaian Stok (Stock Input/Adjustment) (`/app/warehouse/stock-input`)
* **Keterangan:** Koreksi stok manual jika terjadi selisih antara data sistem dengan kondisi fisik gudang.
* **Klik Tombol:**
  * Tombol **`+ Stock Adjustment`** → Form penyesuaian:
    - **Material**: Pilih barang yang akan disesuaikan
    - **Tipe Adjustment**: Pilih *Tambah* (fisik lebih banyak dari sistem) atau *Kurang* (fisik lebih sedikit)
    - **Jumlah Selisih**: Masukkan selisih kuantitas
    - **Keterangan**: Tulis alasan penyesuaian (contoh: *"Bahan rusak basah karena kebocoran atap"*)
    - Klik **`Submit Adjustment`** → Sistem memposting jurnal penyesuaian persediaan secara otomatis.

##### 2f. Stock Opname (`/app/warehouse/stock-opname`)
* **Keterangan:** Penjadwalan dan pelaksanaan audit fisik perhitungan stok menyeluruh.
* **Klik Tombol:**
  * Tombol **`+ Buat Perintah Opname`** → Pilih gudang target, centang daftar material. Klik **`Mulai Opname`**. Sistem secara otomatis **membekukan** (*freeze*) seluruh mutasi keluar/masuk barang pada gudang tersebut agar angka tidak bergeser selama proses penghitungan.
  * Tombol **`Input Hasil Fisik`** (pada baris opname aktif) → Membuka form pengisian. Masukkan angka hasil hitung manual di lapangan pada kolom **Physical Count** untuk setiap material.
  * Tombol **`Simpan Hasil`** → Menyimpan hasil hitung sementara.
  * Tombol **`Submit ke Keuangan`** → Mengirimkan hasil opname ke Finance untuk dibuatkan jurnal penyesuaian selisih stok. Status opname berubah menjadi *Submitted*.

##### 2g. Lokasi & Rak Gudang (`/app/warehouse/locations`)
* **Keterangan:** Peta hierarki lokasi penyimpanan: Gudang → Zona → Rak (Bin).
* **Klik Tombol:**
  * Tombol **`+ Add Warehouse`** → Membuat gudang baru (misal: *Gudang Bahan Baku A*).
  * Tombol **`+ Add Zone`** → Menambah zona di dalam gudang (misal: *Zona Cold Storage*).
  * Tombol **`+ Add Rack/Bin`** → Menambah rak penyimpanan di dalam zona tertentu. Masukkan kode rak dan kapasitas maksimum. Klik **`Save`**.

##### 2h. Analitik Gudang (`/app/warehouse/analytics`)
* **Keterangan:** Laporan dan grafik pergerakan barang, turn-over rate, dan analisis nilai stok per kategori material.
* **Klik Tombol:**
  * Dropdown **`Periode`** → Filter rentang waktu analisis.
  * Tombol **`Export`** → Unduh data analitik ke Excel.

##### 2i. Zona Gudang (`/app/warehouse/zones`)
* **Keterangan:** Pengelolaan zona-zona penyimpanan (Reguler, Karantina QC, Cold Storage, FG Area).
* **Klik Tombol:** Tombol **`+ Add Zone`** → Buat zona baru dengan nama, deskripsi, dan tipe zona. Klik **`Save`**.

##### 2j. Peringatan Stok (Stock Alerts) (`/app/warehouse/stock-alerts`)
* **Keterangan:** Dashboard peringatan otomatis untuk material yang stoknya di bawah *Reorder Point* atau kadaluarsa.
* **Klik Tombol:**
  * Tombol **`Buat PR`** (pada baris material alert) → Langsung membuat Purchase Requisition untuk material yang stoknya kritis.

##### 2k. ABC Analysis (`/app/warehouse/abc-analysis`)
* **Keterangan:** Klasifikasi material berdasarkan nilai kontribusi terhadap total nilai persediaan (A=tinggi, B=sedang, C=rendah).
* **Interaksi:** Pilih periode analisis dari dropdown, lihat grafik dan tabel klasifikasi ABC. Gunakan hasil ini untuk menentukan prioritas pengawasan stok.

---

#### 3. Modul WMS Advanced (`/app/wms`)
Modul manajemen gudang lanjutan dengan fitur pengelolaan batch dan traceability.

##### 3a. Stok per Work Order (`/app/wms/stock-by-wo`)
* **Keterangan:** Menampilkan daftar material yang sudah di-*reserved*/diikat untuk Work Order tertentu dan tidak boleh digunakan pesanan WO lain.
* **Klik Tombol:** Tombol **`Detail WO Stock`** → Klik pada baris nomor WO untuk melihat rincian item, lokasi rak, dan kuantitas yang di-reserve.

##### 3b. Pick List (`/app/wms/pick-lists`)
* **Keterangan:** Dokumen instruksi bagi helper gudang untuk mengambil barang dari rak penyimpanan secara terurut dan efisien.
* **Klik Tombol:**
  * Tombol **`Create Pick List`** → Pilih nomor SO atau WO acuan. Sistem menyusun urutan rak yang harus dikunjungi menggunakan metode FIFO (*First In First Out*).
  * Tombol **`Print Pick List`** → Mencetak dokumen fisik beserta barcode rak untuk dipegang helper gudang.
  * Tombol **`Confirm Picked`** → Klik setelah helper selesai mengambil semua barang sesuai list untuk mengubah status menjadi *Picked*.

##### 3c. Transfer Stok (`/app/wms/transfers`)
* **Keterangan:** Eksekusi perpindahan barang antar zona besar (contoh: dari Gudang Karantina QC ke Gudang Utama setelah barang di-release QC).
* **Klik Tombol:**
  * Tombol **`Approve`** → Menyetujui draft transfer yang dibuat.
  * Tombol **`Eksekusi`** → Klik setelah helper selesai memindahkan fisik barang di lapangan untuk mengonfirmasi perpindahan stok di sistem.

##### 3d. Batch Traceability (`/app/wms/batch-traceability`)
* **Keterangan:** Penelusuran riwayat perjalanan batch bahan baku dari supplier hingga ke tangan konsumen akhir.
* **Klik Tombol:**
  * Input **`Nomor Batch / Lot`** → Ketik nomor batch yang ingin ditelusuri.
  * Tombol **`Trace`** → Klik untuk menampilkan diagram pohon grafis: dari PO pembelian mana batch diperoleh → WO produksi mana yang menggunakannya → nomor SO dan pelanggan mana yang menerima produk jadi hasil batch tersebut.

##### 3e. Reorder Points (`/app/warehouse/reorder-points`)
* **Keterangan:** Pengaturan batas minimum stok (*reorder point*) untuk setiap material.
* **Klik Tombol:**
  * Tombol **`Edit`** → Ubah nilai reorder point dan safety stock untuk material tertentu.
  * Klik **`Save`** → Nilai baru disimpan dan berlaku untuk perhitungan alert stok selanjutnya.

---

#### 4. Modul Production Management (`/app/production`)

##### 4a. Dashboard Produksi (`/app/production`)
* **Keterangan:** Ringkasan visual status produksi pabrik hari ini: jumlah WO aktif, output vs target, grafik mesin per shift.
* **Interaksi:** Klik widget angka untuk navigasi ke halaman detail.

##### 4b. Work Orders (`/app/production/work-orders`)
* **Keterangan:** Daftar semua perintah kerja produksi (Work Order) pada sistem ERP.
* **Klik Tombol / Panduan Form:**
  * Tombol **`+ New Work Order`** → Membuka form:
    - **Product**: Pilih produk dari dropdown
    - **Quantity**: Target jumlah produksi
    - **Machine/Line**: Pilih mesin yang akan digunakan
    - **Priority**: Pilih tingkat urgensi (*Low / Normal / High / Urgent*)
    - **Required Date**: Tanggal target selesai produksi
    - Klik **`Create Work Order`** → WO tersimpan dengan status `Planned`.
  * Tombol **`Start WO`** (ikon petir ⚡) → Klik pada WO berstatus *Planned* untuk merilis WO menjadi *In Progress*. Material dibutuhkan akan otomatis di-*reserve* dari gudang.
  * Tombol **`Input`** (ikon play ▶) → Klik pada WO *In Progress* untuk membuka form input hasil output per shift. Isi data produksi aktual dan tekan **`Submit`**.
  * Tombol **`Edit WO`** (ikon pensil) → Mengubah data WO yang masih berstatus *Planned*.
  * Tombol **`Selesai/Complete`** (ikon ceklis ✓ hijau) → Klik setelah target produksi WO tercapai penuh. Sistem memotong stok bahan baku aktual dan mencatatkan barang jadi ke gudang FG.
  * Tab **`Detail`** di halaman WO → Menampilkan BOM detail, status material, dan history produksi.
  * Dropdown **`Filter Status`** → Menyaring tampilan WO berdasarkan status: *All / Planned / In Progress / Completed / Cancelled*.

##### 4c. WO Monitoring / Kanban Board (`/app/production/work-orders-monitoring`)
* **Keterangan:** Tampilan Kanban visual semua Work Order dalam kolom status (Planned → Released → In Progress → Completed).
* **Klik Tombol / Interaksi:**
  * **Drag & Drop Kartu WO** → Seret kartu WO dari satu kolom ke kolom berikutnya sesuai kemajuan di lapangan.
  * Klik pada **Kartu WO** → Membuka panel detail ringkas di sisi kanan.
  * Tombol **`Lihat Detail`** (pada panel samping) → Navigasi ke halaman Work Order Detail.

##### 4d. WO Detail (`/app/production/work-orders/:id`)
* **Keterangan:** Halaman detail satu WO spesifik. Berisi tab-tab informasi lengkap.
* **Tab yang Tersedia:**
  * **`Info Umum`**: Data dasar WO (produk, mesin, tanggal, status, prioritas).
  * **`BOM`**: Daftar material yang dibutuhkan beserta status ketersediaan stok per material.
  * **`Input Produksi`**: Riwayat semua input hasil produksi per shift yang sudah dimasukkan.
  * **`Quality Check`**: Status inspeksi QC pada WO ini.
  * **`Timeline`**: Grafis waktu dari WO dibuat hingga selesai.
* **Klik Tombol:**
  * Tombol **`Edit BOM`** → Mengubah komposisi material BOM khusus untuk WO ini (override dari BOM standar).
  * Tombol **`Input Hasil`** → Langsung membuka form input produksi harian.

##### 4e. WO Production Input (`/app/production/work-orders/:id/production-input`)
* **Keterangan:** Form input data hasil produksi per shift untuk Work Order aktif. Halaman ini adalah halaman terbesar dan terpenting bagi operator di lantai produksi.
* **Klik Tombol / Panduan Form:**
  * Pilih **Shift** (Shift 1 / 2 / 3) dan **Tanggal produksi**.
  * Input **`Output Good (pcs/pack/carton)`**: Jumlah produk jadi yang lolos QC.
  * Input **`Output Reject/Scrap`**: Jumlah produk yang gagal/dibuang.
  * Input **`Kecepatan Mesin`**: Kecepatan aktual mesin saat berjalan (m/menit).
  * Input **`Jam Berjalan`**: Total jam mesin aktif berproduksi.
  * Input **`Downtime`**: Jika ada downtime, isi durasi (menit), pilih kategori, dan tulis keterangan.
  * Input **`Operator Bertugas`**: Nama operator yang menjalankan shift ini.
  * Klik **`Submit Production Data`** → Data tersimpan dan OEE shift otomatis dihitung.

##### 4f. Kanban Status WO (`/app/production/work-order-status`)
* **Keterangan:** Monitoring status ringkas semua WO aktif dalam tampilan tabel dengan filter cepat.
* **Klik Tombol:** Filter **`Status`**, **`Mesin`**, **`Tanggal`** → Menyaring tampilan WO sesuai kebutuhan.

##### 4g. WO Timeline (`/app/production/work-orders/:id/timeline`)
* **Keterangan:** Grafis garis waktu (Gantt-style) perjalanan satu WO dari dibuat hingga selesai, termasuk jeda downtime.

##### 4h. Breakdown / Downtime Input (`/app/production/downtime`)
* **Keterangan:** Form pelaporan downtime mesin secara mandiri oleh operator (di luar sistem Pre-Shift Checklist).
* **Klik Tombol:**
  * Tombol **`+ Input Downtime`** → Pilih mesin, isi waktu mulai downtime, pilih kategori, tulis deskripsi gejala. Klik **`Submit`**.

##### 4i. Efficiency Tracking (`/app/production/efficiency`)
* **Keterangan:** Halaman analisis efisiensi mesin berdasarkan kecepatan aktual vs kecepatan standar. Menampilkan grafik tren efisiensi per mesin per periode.
* **Klik Tombol:**
  * Filter **`Mesin`** & **`Periode`** → Ubah konteks grafik.
  * Tombol **`Export`** → Unduh laporan efisiensi.

##### 4j. Perencanaan Jadwal (Production Scheduling) (`/app/production/scheduling`)
* **Keterangan:** Grid interaktif perencanaan jadwal produksi mingguan per shift per mesin.
* **Klik Tombol / Panduan Form:**
  * Tombol **`+ Tambah Jadwal`** → Membuka form:
    - **Mesin**: Pilih mesin dari dropdown
    - **Produk**: Pilih produk yang akan diproduksi
    - **Order CTN**: Masukkan jumlah target dalam karton
    - **Warna**: Pilih warna blok visual untuk mesin ini di grid
    - **Shift (S1/S2/S3)**: Centang shift yang aktif untuk mesin ini
    - Klik pada kotak hari di kalender untuk menandai hari aktif. Klik **`Simpan`**.
  * Tombol **`⚡ Generate WO`** (pada baris jadwal) → Klik untuk membuat dokumen Work Order otomatis dari jadwal ini.
  * Tombol **`Generate WO Hari Ini`** (kanan atas) → Membuat WO massal untuk semua mesin yang dijadwalkan berjalan hari ini.
  * Tombol **`◀ Minggu Sebelumnya`** / **`Minggu Ini`** / **`Minggu Selanjutnya ▶`** → Navigasi antar minggu di kalender.

##### 4k. Perencanaan Mingguan Detail (`/app/production/weekly-plan`)
* **Keterangan:** Rencana produksi mingguan versi lebih lengkap dengan target per mesin per hari beserta breakdown material yang dibutuhkan.
* **Klik Tombol:**
  * Tombol **`+ New Weekly Plan`** → Pilih minggu, isi target per mesin. Klik **`Save`**.
  * Tombol **`Publish`** → Menerbitkan rencana mingguan agar dapat dilihat oleh operator.

##### 4l. Rencana Produksi Bulanan (`/app/production/monthly-plan`)
* **Keterangan:** Dashboard rencana produksi agregat per bulan per produk.
* **Klik Tombol:**
  * Tombol **`+ New Monthly Plan`** → Isi target bulanan per produk dan mesin. Klik **`Save`**.
  * Tombol **`Export`** → Unduh plan ke Excel.

##### 4m. Converting (`/app/production/converting`)
* **Keterangan:** Pencatatan proses pemotongan roll kain jumbo (*Mother Roll*) menjadi roll-roll kecil siap pakai (*Child Roll*) oleh mesin slitter.
* **Klik Tombol:**
  * Tombol **`+ New Converting`** → Isi nomor Roll Induk (Mother Roll), spesifikasi kain (lebar, GSM), jumlah child roll yang dihasilkan, dan scrap kain (kg). Klik **`Simpan`**.
  * Klik baris riwayat converting → Melihat detail hasil pemotongan sebelumnya.

##### 4n. FG Conversion (`/app/production/fg-conversion`)
* **Keterangan:** Pencatatan konversi barang setengah jadi (WIP) menjadi barang jadi (Finished Good) dengan proses tambahan.
* **Klik Tombol:**
  * Tombol **`+ New Conversion`** → Pilih WIP Asal, pilih Target Produk Jadi, isi jumlah. Klik **`Process Conversion`**. Stok WIP berkurang dan stok FG bertambah.

##### 4o. Packing List (`/app/production/packing-list`)
* **Keterangan:** Pencatatan nomor palet dan data timbangan karton barang jadi sebelum masuk ke Gudang Finished Goods.
* **Klik Tombol / Alur Penggunaan:**
  1. Tombol **`+ New Packing List`** → Pilih WO acuan, isi jumlah karton, nomor karton awal. Klik **`Create Packing List`**.
  2. Klik **`Weighing`** pada baris packing list → Letakkan karton di timbangan digital terintegrasi → Klik **`Save Weight`** (data berat otomatis ditarik dari timbangan). Ulangi untuk setiap karton.
  3. Klik **`Complete`** → Status packing list berubah menjadi *Completed*.
  4. Klik **`Print Label`** → Mencetak stiker barcode palet.

##### 4p. Changeover (`/app/production/changeovers`)
* **Keterangan:** Pencatatan durasi waktu setup/penggantian cetakan atau formula saat beralih dari satu produk ke produk lain.
* **Klik Tombol:**
  * Tombol **`+ New Changeover`** → Pilih mesin, produk lama (sebelum), dan produk baru (sesudah). Klik **`Start Changeover`** (jam mulai setup tercatat otomatis). Setelah setting mesin selesai, klik **`Complete Changeover`** (durasi setup terekam untuk analisis OEE).

##### 4q. MBF Report (`/app/production/mbf-report`)
* **Keterangan:** **MBF (Mahakam Beta Farma) Report** — laporan khusus yang digunakan **hanya untuk produk-produk Mahakam Beta Farma** (seperti Octenic dan produk MBF lainnya). Laporan ini mencatat temuan kondisi *main roll* (bahan baku gulungan besar) saat digunakan dalam proses produksi, termasuk cacat fisik, area defect, dan estimasi kerugian bahan yang perlu diinformasikan kembali ke pihak Mahakam Beta Farma sebagai supplier/principal.
* **Klik Tombol:**
  * Tombol **`+ New MBF Report`** → Isi nomor main roll yang bermasalah, pilih produk MBF terkait (contoh: *Octenic*), deskripsikan defect yang ditemukan (lubang, noda, robekan, dll.), pilih lokasi mesin, dan estimasi panjang bahan terbuang (meter). Klik **`Submit`** → Laporan tersimpan dan dapat diekspor sebagai dokumen resmi untuk dikirim ke Mahakam Beta Farma.

##### 4r. WIP Dashboard & WIP Batch (`/app/production/wip-dashboard`)
* **Keterangan:** Dashboard stok barang setengah jadi (Work In Progress) yang sedang dalam proses produksi.
* **Tab:**
  * **`WIP Stock`**: Tampilan tabel stok WIP saat ini per produk per mesin.
  * **`WIP Batch`**: Daftar batch WIP terdaftar.
* **Klik Tombol:**
  * Tombol **`+ New WIP Batch`** → Daftarkan batch WIP baru. Isi WO acuan, jumlah WIP, dan lokasi. Klik **`Save`**.

##### 4s. Remaining Stock (Sisa Stok Material WO) (`/app/production/remaining-stock`)
* **Keterangan:** Laporan material bahan baku yang tersisa dari Work Order yang telah selesai, namun belum dikembalikan ke gudang.
* **Klik Tombol:** Tombol **`Return to Warehouse`** → Mengembalikan sisa material ke stok gudang resmi.

##### 4t. Traceability (`/app/production/traceability`)
* **Keterangan:** Penelusuran produk jadi dari nomor WO atau batch tertentu ke seluruh detail material yang digunakan.
* **Klik Tombol:** Input nomor WO atau Batch → Klik **`Trace`** → Sistem menampilkan pohon traceability lengkap.

##### 4u. MRP (Material Requirements Planning) (`/app/production/mrp`)
* **Keterangan:** Kalkulator kebutuhan material otomatis berdasarkan semua rencana produksi aktif dan stok gudang berjalan.
* **Klik Tombol:**
  * Tombol **`Run MRP Analysis`** → Sistem membaca seluruh WO aktif, menghitung kebutuhan bahan baku total, mengurangi stok tersedia, dan menampilkan kekurangan (shortage) per material.
  * Tombol **`Generate PR`** → Setelah hasil MRP muncul, klik tombol ini untuk membuat Purchase Requisition otomatis ke departemen pembelian untuk semua material yang kurang.

---

### 📂 GRUP 3: QUALITY CONTROL (QC)
Grup menu inspeksi laboratorium mutu sesuai standar ISO 9001:2015.

#### 1. Dashboard Quality (`/app/quality`)
* **Keterangan:** KPI mutu: pass rate incoming, in-process, dan final inspection; jumlah defect aktif; dan tren mutu bulan berjalan.

#### 2. QC Barang Masuk (Incoming Inspection) (`/app/quality/incoming`)
* **Keterangan:** Inspeksi kualitas bahan baku dari supplier di area karantina gudang sebelum disimpan di gudang utama.
* **Klik Tombol / Panduan Form:**
  * Klik tombol **`Inspect`** pada baris dokumen GRN (Goods Receipt Note) aktif.
  * Pada form inspeksi yang terbuka, isi nilai parameter uji (contoh: nilai GSM kain, kadar kelembaban, lebar kain, hasil uji pH).
  * Klik tab / tombol **`PASS`** (hijau) → Bahan baku masuk status *Available* dan siap dipindah ke gudang utama.
  * Klik tab / tombol **`FAIL`** (merah) → Masukkan alasan penolakan di kolom teks, klik **`Save`**. Stok terkunci di gudang karantina dan instruksi retur ke supplier diterbitkan otomatis.
  * Tombol **`Print Lab Report`** → Cetak laporan hasil pengujian laboratorium.

#### 3. QC Dalam Proses (In-Process Inspection) (`/app/quality/in-process`)
* **Keterangan:** Inspeksi patrol keliling QC setiap 1 jam sekali ke mesin-mesin produksi yang sedang berjalan.
* **Klik Tombol / Panduan Form:**
  * Pilih baris mesin aktif → Klik **`Add Inspection`**.
  * Isi parameter checklist mutu: kebocoran seal kemasan, kejelasan cetakan exp date, keseragaman berat cairan tisu basah, kerapatan jahitan, dll.
  * Klik **`Save`** → Data inspeksi tersimpan. Jika ada temuan NG, sistem membuat alert ke operator.
  * Tab **`History`** → Menampilkan riwayat inspeksi in-process per mesin.

#### 4. QC Barang Jadi (Final Inspection) (`/app/quality/finish-good`)
* **Keterangan:** Inspeksi akhir produk jadi sebelum ditransfer ke gudang finished goods dan dikirim ke pelanggan.
* **Klik Tombol / Panduan Form:**
  * Klik **`Final Inspection`** pada baris WO yang telah selesai di lantai produksi.
  * Isi parameter tes visual dan fisik: tampilan kemasan, keterbacaan barcode, pengisian cairan, berat karton.
  * Klik **`Release to Warehouse`** → Menerbitkan izin transfer stok produk ke gudang FG sebagai *Available for Sale*.
  * Klik **`Reject`** → Produk dipindahkan ke zona *Rework* atau *Scrap* dan WO diberi flag gagal QC.
  * Klik **`Print QC Report`** → Cetak sertifikat inspeksi barang jadi.

#### 5. Pending QC (`/app/quality/pending`)
* **Keterangan:** Antrean produk yang sedang menunggu inspeksi QC (belum diproses oleh QC staff).
* **Klik Tombol:** Tombol **`Proses Inspeksi`** → Langsung membuka form final inspection untuk WO terpilih.

#### 6. QC Packing List (`/app/quality/packing-list`)
* **Keterangan:** Verifikasi QC pada data packing list barang jadi sebelum dikirim.
* **Klik Tombol:** Klik **`Verify`** pada baris packing list → Tandai bahwa QC telah memeriksa dan menyetujui dokumen packing.

#### 7. QC to Warehouse (`/app/quality/qc-to-warehouse`)
* **Keterangan:** Proses transfer resmi barang jadi yang sudah dinyatakan LULUS inspeksi QC dari area karantina QC ke gudang finished goods.
* **Klik Tombol:**
  * Centang item / batch yang akan ditransfer → Klik **`Transfer to Warehouse`**. Stok berpindah dari zona QC ke gudang FG.

#### 8. Quality Alerts (`/app/quality/alerts`)
* **Keterangan:** Dashboard peringatan mutu aktif: temuan NG, batch recall, serta alert batas kendali SPC yang dilanggar.
* **Klik Tombol:** Klik baris alert → Membuka detail temuan dan link ke CAPA atau WO terkait.

#### 9. Quality Analytics (`/app/quality/analytics`)
* **Keterangan:** Dashboard analisis statistik mutu komprehensif dengan grafik tren dan metrik KPI mutu.
* **Klik Tombol / Panduan Interaksi:**
  * Dropdown **`Periode`** → Pilih *Harian / Mingguan / Bulanan* untuk mengubah rentang grafik.
  * Dropdown **`Filter Produk`** → Pilih produk spesifik atau *All Products*.
  * **Kartu KPI yang Ditampilkan:** *Overall Pass Rate*, *Defect Rate*, *Jumlah Inspeksi*, *Open CAPA*.
  * **Grafik yang Tersedia:**
    - Grafik pie distribusi tipe defect
    - Grafik tren pass rate dari waktu ke waktu
    - Pareto chart temuan defect terbanyak
  * Tombol **`Export`** → Unduh data analitik ke Excel.

#### 10. Quality Audits (`/app/quality/audits`)
* **Keterangan:** Perencanaan, pelaksanaan, dan pelaporan audit mutu internal maupun eksternal.
* **Klik Tombol / Panduan Form:**
  * Filter **`Status`** (Planned / In Progress / Completed) dan **`Tipe Audit`** (Internal / External / Supplier / Customer) → Menyaring daftar audit.
  * Tombol **`+ New Audit`** → Form jadwal audit baru:
    - **Nomor Audit**: Digenerate otomatis
    - **Tipe Audit**: Internal / External / Supplier / Customer
    - **Ruang Lingkup (Scope)**: Tulis area/proses yang diaudit
    - **Tanggal Rencana**: Tanggal audit direncanakan berlangsung
    - **Lead Auditor**: Pilih nama auditor utama
    - Klik **`Save`** → Audit berstatus *Planned*.
  * Klik **`Start Audit`** → Status berubah menjadi *In Progress*.
  * Klik **`Add Finding`** → Tambahkan temuan audit: pilih *Critical / Major / Minor / Observation*, tulis deskripsi temuan, dan link ke CAPA.
  * Klik **`Complete Audit`** → Isi ringkasan hasil, nilai rating (*Excellent / Good / Satisfactory / Needs Improvement / Unsatisfactory*). Klik **`Submit`** → Status *Completed*.

#### 11. SPC (Statistical Process Control) (`/app/quality/spc`)
* **Keterangan:** Analisis statistik fluktuasi ukuran/berat produk menggunakan grafik kendali X-bar R Chart.
* **Klik Tombol / Panduan Form:**
  * **Input Subgroup Sample:**
    1. Klik **`+ Input Subgroup Sample`**.
    2. Pilih **Nomor WO** dan **Parameter Uji** (misal: gramatur tisu basah).
    3. Masukkan 5 data pengukuran sampel acak (contoh: berat 5 tisu yang diambil random).
    4. Klik **`Submit Sample`**. Sistem menghitung nilai Mean (rata-rata) dan Range. Jika data melampaui UCL atau LCL, alarm merah muncul.
  * **SPC Dashboard:**
    1. Klik tab **`SPC Dashboard`** → Pilih **Produk** dan **Parameter Uji**.
    2. Sistem merender grafik X-bar dan R-chart serta menghitung indeks kapabilitas **Cp** dan **Cpk** secara real-time.

#### 12. Downtime Analysis (`/app/quality/downtime-analysis`)
* **Keterangan:** Analisis pareto penyebab downtime mesin dari perspektif Quality untuk identifikasi penyebab defect terbesar.

---

### 📂 GRUP 4: SUPPLY CHAIN (RANTAI PASOK)

#### 1. Modul Purchasing (Pembelian) (`/app/purchasing`)

##### 1a. Dashboard Pembelian (`/app/purchasing`)
* **Keterangan:** Ringkasan KPI pembelian: jumlah PO aktif, nilai total pembelian bulan ini, PR menunggu persetujuan, dan performa supplier.

##### 1b. Supplier (`/app/purchasing/suppliers`)
* **Keterangan:** Database data induk supplier/pemasok.
* **Klik Tombol:**
  * Tombol **`+ New Supplier`** → Form data supplier baru:
    - **Nama Perusahaan Supplier**
    - **Alamat Lengkap**
    - **Nama PIC (Person In Charge)**
    - **Nomor Telepon** & **Email Resmi**
    - **Payment Terms**: Jangka waktu pembayaran (contoh: *Net 30*, *Net 60*, *COD*)
    - **Mata Uang Transaksi**: IDR / USD / EUR
    - **Nomor Rekening Bank** & **Nama Bank**
    - Klik **`Save`**.
  * Tab **`Approved Materials`** (di halaman detail supplier) → Centang material yang diizinkan dipasok oleh supplier ini (Approved Supplier List / ASL).
  * Tab **`Performance`** → Melihat riwayat on-time delivery rate dan kualitas penerimaan barang dari supplier ini.
  * Tombol **`Edit`** → Mengubah data supplier.
  * Tombol **`Nonaktifkan`** → Menonaktifkan supplier agar tidak bisa dipilih di PO baru.

##### 1c. Purchase Requisition - PR (`/app/purchasing/requisitions`)
* **Keterangan:** Dokumen pengajuan kebutuhan pembelian dari departemen.
* **Klik Tombol:**
  * Tombol **`+ New PR`** → Form:
    - Pilih **Material/Barang** yang dibutuhkan
    - **Quantity**: Jumlah yang dibutuhkan
    - **Tanggal Dibutuhkan**
    - **Prioritas**: Normal / Urgent
    - **Catatan / Justifikasi**: Alasan pembelian
    - Klik **`Submit`** → PR terkirim ke Purchasing Manager untuk disetujui.
  * Tombol **`Approve`** (pada akun Manager) → Menyetujui PR. Status berubah menjadi *Approved* dan PR siap dikonversi ke RFQ/PO.
  * Tombol **`Reject`** → Menolak PR dengan alasan.

##### 1d. RFQ (Request for Quotation) (`/app/purchasing/rfq`)
* **Keterangan:** Permintaan penawaran harga yang dikirim ke beberapa supplier sekaligus.
* **Klik Tombol:**
  * Tombol **`+ New RFQ`** → Form:
    - **Barang**: Pilih material
    - **Supplier Terpilih**: Centang minimal 3 nama supplier yang terdaftar di database
    - **Tanggal Batas Penawaran**: Deadline supplier mengirim harga
    - Klik **`Send Email RFQ`** → Sistem mengirim email undangan penawaran harga ke masing-masing supplier.
  * Klik **`View Quotes`** (pada baris RFQ) → Melihat perbandingan harga penawaran dari tiap supplier yang sudah membalas.

##### 1e. Price Comparison (`/app/purchasing/price-comparison`)
* **Keterangan:** Perbandingan harga penawaran dari berbagai supplier untuk satu material yang sama.
* **Klik Tombol:** Klik **`Select Supplier`** pada baris supplier dengan harga terbaik → Sistem langsung membuat draft PO ke supplier tersebut.

##### 1f. Purchase Orders - PO (`/app/purchasing/orders`)
* **Keterangan:** Surat pesanan resmi ke supplier yang dipilih.
* **Klik Tombol:**
  * Tombol **`+ New Purchase Order`** → Form PO:
    - **Supplier**: Pilih supplier tujuan
    - Klik **`Import dari PR/RFQ`** → Menarik daftar item dari dokumen PR atau RFQ yang sudah disetujui
    - Isi **Unit Price** (harga satuan dari penawaran supplier)
    - Isi **Tanggal Pengiriman yang Diminta**
    - Isi **Syarat Pembayaran**
    - Klik **`Submit for Approval`** → PO masuk ke antrean persetujuan.
  * **Proses Persetujuan PO berdasarkan nilai:**
    - PO < Rp 10.000.000 → Disetujui oleh *Supervisor*: Klik **`✓ Setujui`**
    - PO Rp 10 jt - Rp 50 jt → Disetujui oleh *Manager*: Klik **`✓ Setujui`**
    - PO > Rp 50.000.000 → Disetujui oleh *Director*: Klik **`✓ Setujui`**
  * Setelah disetujui, klik **`Send to Supplier`** → Sistem mengirim email konfirmasi PO ke supplier.

##### 1g. Goods Receipt Note - GRN (`/app/purchasing/grn`)
* **Keterangan:** Pencatatan penerimaan barang dari supplier di pintu kedatangan gudang.
* **Klik Tombol:**
  * Tombol **`+ New GRN`** atau klik **`Receive`** pada baris PO aktif → Form:
    - **Pilih PO**: Pilih nomor PO acuan
    - **Received Qty**: Jumlah aktual barang yang diturunkan dari truk (bisa berbeda dari PO jika pengiriman parsial)
    - **Nomor Batch Supplier**: Nomor lot/batch dari label kemasan supplier
    - **Tanggal Kedaluwarsa** (jika berlaku)
    - **Lokasi Gudang Karantina**: Pilih rak tujuan di zona karantina
    - Klik **`Submit GRN`** → Stok karantina bertambah dan status PO diperbarui. QC otomatis mendapat notifikasi untuk melakukan inspeksi incoming.

##### 1h. Supplier Quotes (`/app/purchasing/quotes`)
* **Keterangan:** Daftar dan pengelolaan penawaran harga yang masuk dari supplier.
* **Klik Tombol:**
  * Tombol **`+ New Quote`** → Memasukkan penawaran harga dari supplier secara manual (jika email tidak terintegrasi).
  * Tombol **`Accept Quote`** → Menerima penawaran dan mengkonversinya ke draft PO.

##### 1i. Invoice Matching / 3-Way Match (`/app/purchasing/invoices`)
* **Keterangan:** Verifikasi tagihan (invoice) supplier sebelum dibayar oleh Finance dengan pencocokan 3 dokumen.
* **Klik Tombol:**
  * Tombol **`+ New Invoice`** → Upload atau input data invoice dari supplier (nomor invoice, tanggal, jumlah tagihan, nomor PO acuan).
  * Tombol **`Match Invoice`** → Sistem membandingkan tiga dokumen:
    1. **Harga di PO** (Purchase Order)
    2. **Jumlah aktual diterima di GRN** (Goods Receipt Note)
    3. **Jumlah tagihan di Invoice**
    - Jika ketiganya cocok → status hijau. Klik **`Verify & Post`** → Utang dagang (Accounts Payable) diterbitkan ke Finance.
    - Jika ada ketidakcocokan → status merah. Tandai dan kirim catatan dispute ke supplier.

##### 1j. Contracts (`/app/purchasing/contracts`)
* **Keterangan:** Pengelolaan dokumen kontrak kerjasama jangka panjang dengan supplier.
* **Klik Tombol:**
  * Tombol **`+ New Contract`** → Isi data kontrak: supplier, periode berlaku, nilai kontrak, syarat dan ketentuan. Upload file PDF kontrak. Klik **`Save`**.
  * Tombol **`Renew`** (pada kontrak hampir kadaluarsa) → Membuat draft perpanjangan kontrak.

---

#### 2. Modul Sales & CRM (Penjualan) (`/app/sales`)

##### 2a. Dashboard Sales (`/app/sales`)
* **Keterangan:** KPI penjualan: total revenue bulan ini, jumlah SO aktif, pipeline value, dan grafik tren penjualan per produk.

##### 2b. Leads (`/app/sales/leads`)
* **Keterangan:** Database calon pelanggan (prospek) yang sedang dalam proses pendekatan oleh tim sales.
* **Tab yang Tersedia:**
  * **`Semua Leads`**: Daftar lengkap semua prospek.
  * **`Pipeline`**: Tampilan Kanban prospek per tahapan (New → Contacted → Qualified → Proposal → Negotiation → Won/Lost).
* **Klik Tombol:**
  * Tombol **`+ New Lead`** → Form:
    - **Nama Perusahaan / Individu**
    - **Nama PIC**: Nama kontak person
    - **Email** & **Nomor Telepon**
    - **Sumber Lead**: Pilih dari mana lead ini didapat (*Referral / Website / Exhibition / Cold Call / dll.*)
    - **Produk yang Diminati**
    - **Estimasi Nilai Potensi (IDR)**
    - **Status Lead**: New / Contacted / Qualified / dll.
    - Klik **`Save`**.
  * Tombol **`Convert to Opportunity`** → Mengubah Lead yang sudah qualified menjadi Opportunity (peluang penjualan konkret).
  * Tombol **`+ Log Activity`** → Mencatat aktivitas follow-up (telepon, email, kunjungan) beserta tanggal dan catatan hasilnya.

##### 2c. Opportunities (`/app/sales/opportunities`)
* **Keterangan:** Peluang penjualan yang sedang dinegosiasikan dengan calon pelanggan.
* **Tab:**
  * **`Daftar`**: Tabel semua peluang aktif.
  * **`Kanban`**: Visual pipeline per tahap negosiasi.
* **Klik Tombol:**
  * Tombol **`+ New Opportunity`** → Form:
    - **Nama Opportunity**
    - **Customer / Lead**: Link ke data pelanggan
    - **Estimasi Nilai Kontrak (IDR)**
    - **Probabilitas Menang (%)**
    - **Tanggal Expected Close**
    - **Produk yang Ditawarkan**
    - Klik **`Save`**.
  * Tombol **`Create Quotation`** → Langsung membuat Surat Penawaran dari opportunity ini.

##### 2d. Customers (`/app/sales/customers`)
* **Keterangan:** Database resmi pelanggan dengan data lengkap dan status kredit.
* **Klik Tombol:**
  * Tombol **`+ New Customer`** → Form:
    - **Nama Perusahaan**
    - **Alamat Penagihan (Billing Address)** & **Alamat Pengiriman (Shipping Address)**
    - **Nama PIC** & **Nomor Telepon** & **Email**
    - **Payment Terms**: Jangka waktu pembayaran (contoh: *Net 30 hari*)
    - **Credit Limit (IDR)**: Batas maksimal piutang yang diizinkan
    - Klik **`Save`**.
  * **Indikator Status Kredit (otomatis diperbarui sistem):**
    - `Good` (Hijau): Pembayaran lancar.
    - `Warning` (Kuning): Ada piutang lewat jatuh tempo 1-30 hari.
    - `Blocked` (Merah): Piutang melebihi credit limit. SO baru otomatis diblokir.
  * Tab **`Orders`** (di detail customer) → Melihat riwayat semua SO dari pelanggan ini.
  * Tab **`Invoices`** (di detail customer) → Riwayat tagihan dan status pembayaran.

##### 2e. Quotations (Surat Penawaran) (`/app/sales/quotations`)
* **Keterangan:** Pembuatan dan pengelolaan surat penawaran harga ke pelanggan.
* **Klik Tombol:**
  * Tombol **`+ New Quotation`** → Form:
    - **Customer**: Pilih pelanggan dari database
    - **Validity Date**: Tanggal masa berlaku penawaran
    - Klik **`+ Add Item`**: Pilih produk, masukkan kuantitas, harga satuan, dan diskon (%)
    - **Catatan/Syarat Khusus**
    - Klik **`Save`** → Penawaran tersimpan berstatus *Draft*.
  * Tombol **`Send to Customer`** → Mengirimkan email PDF penawaran ke pelanggan.
  * Tombol **`Convert to Sales Order`** → Jika pelanggan menyetujui, klik tombol ini untuk mengubah quotation menjadi Sales Order resmi.

##### 2f. Sales Orders (`/app/sales/orders`)
* **Keterangan:** Pesanan penjualan resmi dari pelanggan.
* **Klik Tombol:**
  * Tombol **`+ New Sales Order`** → Form:
    - **Customer**: Pilih pelanggan
    - Klik **`+ Add Product`**: Pilih produk, isi jumlah, harga, dan diskon
    - **Tanggal Pengiriman yang Diminta**
    - **Alamat Pengiriman Tujuan**
    - Klik **`Save`** → SO berstatus *Draft*.
  * Tombol **`Confirm Order`** → Mengonfirmasi pesanan. Sistem mengecek credit limit pelanggan. Jika aman → status *Confirmed* dan informasi dirilis ke bagian PPC untuk perencanaan WO.
  * Tab **`Detail`** → Rincian item, harga, dan total.
  * Tab **`Pengiriman`** → Status pengiriman dan link ke Delivery Order terkait.
  * Tab **`Invoice`** → Status tagihan dari SO ini.

##### 2g. Sales Forecast (`/app/sales/forecast`)
* **Keterangan:** Proyeksi penjualan ke depan berdasarkan data historis dan input tim sales.
* **Klik Tombol:**
  * Tombol **`+ New Forecast`** → Isi target penjualan per produk per bulan. Klik **`Save`**.
  * Tombol **`Compare Actual vs Forecast`** → Menampilkan grafik perbandingan realisasi vs target forecast.

##### 2h. Sales Activities (`/app/sales/activities`)
* **Keterangan:** Log aktivitas sales (kunjungan, telepon, demo produk, presentasi) terkait dengan Lead atau Opportunity.
* **Klik Tombol:**
  * Tombol **`+ New Activity`** → Isi tanggal, jenis aktivitas, nama kontak yang ditemui, dan ringkasan hasil. Klik **`Save`**.

---

#### 3. Modul Shipping & Logistik (`/app/shipping`)

##### 3a. Pengiriman (Orders) (`/app/shipping/orders`)
* **Keterangan:** Antrean barang jadi yang siap kirim berdasarkan SO aktif yang sudah dikonfirmasi.
* **Klik Tombol:**
  * Tombol **`Create Dispatch Note`** → Form Surat Jalan:
    - **Import dari SO**: Pilih nomor SO acuan
    - **Nama Supir** & **Nomor SIM**
    - **Nomor Plat Armada Truk**
    - **Jenis Ekspedisi** (internal / 3PL)
    - **Jumlah Palet** yang dimuat
    - Klik **`Ship`** → Status pengiriman berubah menjadi *In Transit* dan Surat Jalan siap dicetak.
  * Tombol **`Print Surat Jalan`** → Mencetak dokumen Surat Jalan.

##### 3b. Tracking Pengiriman (`/app/shipping/tracking`)
* **Keterangan:** Pemantauan status perjalanan barang yang sedang *In Transit*.
* **Klik Tombol:**
  * Tombol **`Mark Delivered`** → Klik setelah supir kembali membawa lembar Surat Jalan yang sudah ditandatangani dan distempel oleh pelanggan penerima. Status pengiriman selesai dan Sales Invoice siap diterbitkan.
  * Tombol **`Report Issue`** → Melaporkan masalah pengiriman (barang rusak, salah alamat, dll.).

---

#### 4. Modul Returns (Retur) (`/app/returns`)
* **Keterangan:** Penanganan pengembalian barang rusak dari pelanggan atau pengembalian bahan baku ke supplier.
* **Klik Tombol / Aksi:**
  * Tombol **`+ New Return`** → Form:
    - **Tipe Return**: *Customer Return* atau *Supplier Return*
    - **Dokumen Acuan**: Pilih Invoice (untuk customer return) atau GRN (untuk supplier return)
    - Klik **`+ Add Item`**: Pilih produk, isi kuantitas retur, pilih alasan (*Defect / Wrong Product / Damaged / Excess*)
    - Klik **`Submit Return`**.
  * Tombol **`QC Disposition`** → Klik pada dokumen retur yang masuk untuk menentukan nasib barang retur:
    - *Scrap*: Hancurkan/buang.
    - *Rework*: Buat WO perbaikan baru.
    - *Put back to Stock*: Kembalikan ke gudang sebagai stok tersedia.
  * Klik **`Post Disposition`** → Aksi tersimpan dan stok diperbarui sesuai pilihan.

---

### 📂 GRUP 5: FINANCE & HR (KEUANGAN & SUMBER DAYA MANUSIA)

#### 1. Modul Finance (`/app/finance`)

##### 1a. Finance Dashboard (`/app/finance`)
* **Keterangan:** Ringkasan KPI keuangan utama perusahaan secara real-time.
* **Kartu KPI yang Ditampilkan:**
  * **Total Revenue**: Total pendapatan bersih
  * **Net Profit**: Laba bersih setelah semua biaya
  * **Cash Balance**: Saldo kas dan setara kas
  * **Profit Margin (%)**: Persentase laba dari revenue
  * **Accounts Receivable**: Total piutang pelanggan outstanding
  * **Accounts Payable**: Total utang ke supplier outstanding
  * **Working Capital**: Modal kerja bersih
* **Grafik:**
  * *Cash Flow Trend* (Area Chart): Tren kas masuk dan kas keluar per bulan
  * *Expense Breakdown* (Pie Chart): Komposisi pengeluaran per kategori
  * *Revenue & Profit Trend* (Bar Chart): Perbandingan revenue, profit, dan expense per bulan
* **Quick Actions:**
  * Klik **`Accounting`** → Navigasi ke Accounting Management
  * Klik **`Budget Planning`** → Navigasi ke Budget
  * Klik **`Cash Flow`** → Navigasi ke Cash Flow Management
  * Klik **`Reports`** → Navigasi ke Laporan Keuangan

##### 1b. Budget Planning (`/app/finance/budget`)
* **Keterangan:** Pengelolaan pagu anggaran departemen dan analisis varians aktual vs anggaran.
* **Klik Tombol:**
  * Dropdown **`Pilih Periode Budget`** → Filter tampilan budget (Annual / Q4 / dsb.).
  * Tombol **`+ New Budget`** → Form:
    - **Budget Name**: Nama anggaran (contoh: *Annual Budget 2025*)
    - **Budget Period**: Periode (contoh: *2025* atau *Q1 2025*)
    - **Fiscal Year**
    - **Start Date** & **End Date**
    - **Total Budget (IDR)**: Pagu total anggaran
    - **Department**: Departemen pemilik anggaran
    - **Category**: Kategori pengeluaran (*Raw Materials / Labor / Marketing / dll.*)
    - **Description**: Deskripsi anggaran
    - Klik **`Save`** → Budget berstatus *Draft*.
  * **Variance Analysis Section:**
    - Tabel perbandingan Budget vs Actual per kategori belanja, ditampilkan selisih nominal dan persentase.
    - Status **hijau** = di bawah anggaran (efisien). Status **merah** = melebihi anggaran (over budget).

##### 1c. Expenses / Pengeluaran (`/app/finance/expenses`)
* **Keterangan:** Pengajuan dan pengelolaan klaim pengeluaran kas operasional oleh staf.
* **Klik Tombol:**
  * Tombol **`+ New Expense Claim`** → Form:
    - **Kategori Pengeluaran**: Pilih tipe (ATK / Transport / Akomodasi / Dll.)
    - **Nominal (IDR)**
    - **Keperluan**: Tulis deskripsi penggunaan
    - **Upload Receipt**: Upload foto kuitansi/struk bukti bayar (JPG/PDF)
    - **Tanggal Pengeluaran**
    - Klik **`Submit Claim`** → Klaim dikirim ke supervisor untuk disetujui.
  * Tombol **`Approve`** (pada akun Supervisor/Manager) → Menyetujui klaim. Finance memproses pembayaran.
  * Tombol **`Reject`** → Menolak klaim dengan alasan.

##### 1d. Reimbursement (`/app/finance/reimbursements`)
* **Keterangan:** Pengajuan pengembalian dana oleh karyawan yang telah mengeluarkan biaya dari kocek pribadi.
* **Klik Tombol:**
  * Tombol **`+ New Reimbursement`** → Form:
    - **Nama Karyawan**
    - **Daftar Pengeluaran**: Tambahkan item satu per satu (tanggal, keterangan, nominal)
    - **Total Reimbursement (IDR)**
    - **Nomor Rekening Tujuan Pengembalian**
    - Upload bukti-bukti pengeluaran
    - Klik **`Submit`**.
  * Tombol **`Process Payment`** (Finance) → Tandai reimbursement sudah dibayarkan.

##### 1e. Cash & Bank Management (`/app/finance/cash-bank`)
* **Keterangan:** Pengelolaan saldo rekening bank dan kas kecil perusahaan.
* **Klik Tombol:**
  * Tombol **`+ New Transaction`** → Mencatat pemasukan atau pengeluaran kas secara manual.
  * Tombol **`Reconcile`** → Membuka form rekonsiliasi saldo bank (mencocokkan saldo buku dengan laporan bank).

##### 1f. Cash Flow Management (`/app/finance/cash-flow`)
* **Keterangan:** Proyeksi dan analisis arus kas perusahaan.
* **Klik Tombol / Interaksi:**
  * Dropdown **`Pilih Tampilan`** → *Weekly View* atau *Monthly View*.
  * Tombol **`Export Report`** → Unduh laporan cash flow ke Excel/PDF.
  * **Kartu KPI:**
    - *Operating CF*: Arus kas dari kegiatan operasional
    - *Investing CF*: Arus kas dari kegiatan investasi (pembelian aset)
    - *Financing CF*: Arus kas dari kegiatan pendanaan (pinjaman)
    - *Net Cash Flow*: Arus kas bersih
    - *Cash Conversion Cycle*: Siklus konversi kas (dalam hari)
    - *Free Cash Flow*: Arus kas bebas
  * **Grafik Forecast**: Area chart proyeksi saldo kas ke depan per periode.
  * **Tabel Forecast**: Perincian Opening Balance, Cash In, Cash Out, dan Closing Balance per periode.

##### 1g. Accounts Payable / Utang Dagang (`/app/finance/payable`)
* **Keterangan:** Pengelolaan dan pembayaran tagihan utang kepada supplier.
* **Klik Tombol:**
  * Klik **`Record Payment`** pada baris tagihan → Form pembayaran:
    - **Nominal Pembayaran**: Jumlah yang dibayarkan (bisa parsial)
    - **Rekening Bank Asal**: Pilih rekening bank perusahaan yang digunakan
    - **Tanggal Pembayaran**
    - Klik **`Post Payment`** → Utang berkurang dan jurnal pencatatan kas keluar dibuat otomatis.
  * Filter **`Jatuh Tempo`** → Menampilkan tagihan yang hampir atau sudah melewati jatuh tempo.

##### 1h. Accounts Receivable / Piutang Dagang (`/app/finance/receivable`)
* **Keterangan:** Monitoring dan penagihan piutang pelanggan.
* **Klik Tombol:**
  * Tombol **`Collect Payment`** → Form pencatatan pembayaran masuk dari pelanggan:
    - **Jumlah Pembayaran**
    - **Rekening Bank Penerima**
    - **Tanggal Penerimaan**
    - **Nomor Referensi Transfer**
    - Klik **`Post Payment`** → Piutang berkurang.
  * Tab **`Aging Report`** → Laporan umur piutang: <30 hari, 31-60 hari, 61-90 hari, >90 hari.

##### 1i. Accounting Management (`/app/finance/accounting`)
* **Keterangan:** Pengelolaan bagan akun (Chart of Accounts) dan entri jurnal manual.
* **Tab yang Tersedia:**
  * **`Chart of Accounts`**: Daftar semua akun buku besar.
  * **`Journal Entries`**: Daftar semua entri jurnal yang sudah dibuat.
* **Klik Tombol:**
  * **Saat di tab "Chart of Accounts":**
    - Tombol **`Add Account`** (kanan atas) → Form akun baru:
      - **Account Code**: Kode numerik unik (contoh: *11310*)
      - **Account Type**: Asset / Liability / Equity / Revenue / Expense
      - **Account Name**: Nama akun
      - **Parent Account**: Pilih akun induk (opsional, untuk sub-akun)
      - **Description**: Keterangan penggunaan akun
      - Centang **`Active Account`** jika akun ini aktif
      - Klik **`Create Account`**.
    - Ikon **`👁 Lihat`** → Melihat detail dan mutasi akun.
    - Ikon **`✏️ Edit`** → Mengubah nama atau keterangan akun.
    - Ikon **`🗑️ Hapus`** → Menghapus akun yang belum pernah digunakan.
    - Filter **`Tipe Akun`** → Menyaring akun berdasarkan tipe (Asset / Liability / dll.).
  * **Saat di tab "Journal Entries":**
    - Tombol **`New Entry`** (kanan atas) → Form jurnal baru:
      - **Entry Date**: Tanggal transaksi
      - **Reference Number**: Nomor dokumen acuan (misal: *INV-2025-001*)
      - **Description**: Keterangan transaksi
      - **Journal Lines** (minimal 2 baris): Untuk setiap baris, pilih akun, masukkan nominal Debit atau Credit. Pastikan Total Debit = Total Credit.
      - Klik **`+ Add Line`** untuk menambah baris jurnal.
      - Klik **`Post Journal Entry`** → Jurnal dikunci ke buku besar.
    - Ikon **`👁 Lihat`** → Melihat detail jurnal.
    - Ikon **`✏️ Edit`** → Mengedit jurnal berstatus *Draft*.
    - Ikon **`🗑️ Hapus`** → Menghapus jurnal *Draft*.
  * **Kartu Ringkasan (di bagian bawah):**
    - *Total Assets*, *Total Liabilities*, *Total Equity*, *Journal Entries* (total entri yang sudah diposting).

##### 1j. General Ledger / Buku Besar (`/app/finance/general-ledger`)
* **Keterangan:** Tampilan lengkap seluruh transaksi yang sudah diposting ke buku besar beserta saldo berjalan.
* **Klik Tombol / Panduan Filter:**
  * Filter **`Akun`**: Pilih kode akun tertentu untuk melihat mutasi satu akun saja.
  * Filter **`Tanggal Mulai`** & **`Tanggal Selesai`**: Membatasi rentang tanggal entri.
  * Input **`Pencarian`**: Cari berdasarkan deskripsi atau nomor referensi transaksi.
  * Tombol **`Clear Filters`** → Menghapus semua filter.
  * Tombol **`Export`** (ikon unduhan) → Mengunduh data buku besar ke file Excel.
  * **Pagination**: Gunakan tombol **`< Sebelumnya`** / **`Selanjutnya >`** untuk berpindah halaman.
  * **Kolom Tabel:** Tanggal, Nomor Akun, Nama Akun, Deskripsi, Debit (IDR), Kredit (IDR), Saldo Berjalan (Running Balance).
  * Tombol **`+ New Entry`** → Shortcut langsung ke form Journal Entry baru.

##### 1k. Financial Reports (`/app/finance/reports`)
* **Keterangan:** Laporan keuangan standar dalam tiga format resmi.
* **Tab Laporan:**
  * **`Income Statement`** (Laporan Laba Rugi):
    - Dropdown **`Pilih Tahun`** → Pilih tahun buku yang ingin dilihat.
    - Menampilkan: Revenue (Sales + Other Income) → Cost of Sales (Material, Labor, Overhead) → Gross Profit → Operating Expenses → Operating Income → Other Expenses (Interest, Depreciation) → Net Income Before Tax → Income Tax → **Net Income**.
  * **`Balance Sheet`** (Neraca):
    - Menampilkan: **Assets** (Current Assets: Kas, Piutang, Inventori; Fixed Assets: PP&E dikurangi Akumulasi Depresiasi) vs **Liabilities** (Current: Utang Dagang, Akrual; Long-term: Utang Bank) + **Equity** (Modal + Retained Earnings).
  * **`Cash Flow`** (Laporan Arus Kas):
    - Menampilkan arus kas dari: Aktivitas Operasi, Aktivitas Investasi, Aktivitas Pendanaan, dan Net Change in Cash.
* **Klik Tombol:**
  * Tombol **`Download PDF`** → Cetak laporan ke PDF.
  * Tombol **`Download CSV`** → Unduh data ke Excel.

##### 1l. Fixed Assets / Aset Tetap (`/app/finance/fixed-assets`)
* **Keterangan:** Pendaftaran dan pengelolaan aset tetap perusahaan untuk perhitungan penyusutan.
* **Klik Tombol / Panduan Form:**
  * Filter **`Kategori`** → Menyaring daftar aset: *Machinery / Building / Vehicle / Equipment / Furniture / Computer*.
  * Input **`Pencarian`** → Cari berdasarkan nama atau kode aset.
  * Tombol **`+ Register Asset`** → Form pendaftaran aset baru:
    - **Asset Code**: Kode inventaris unik
    - **Asset Name**: Nama aset (contoh: *Forklift Crown FG 25*)
    - **Category**: Pilih dari dropdown kategori
    - **Purchase Date**: Tanggal pembelian
    - **Cost (IDR)**: Harga perolehan aset
    - **Useful Life (bulan)**: Umur ekonomis (contoh: *120 bulan = 10 tahun*)
    - **Depreciation Method**: *Straight Line* (Garis Lurus)
    - Klik **`Save`**.
  * Tombol **`Edit`** (ikon pensil) → Mengubah data aset.
  * Tombol **`Hapus`** (ikon tempat sampah) → Menghapus aset yang belum pernah didepresiasi.
  * Tombol **`Run Depreciation`** (Aksi periodik bulanan) → Klik untuk menjalankan kalkulasi depresiasi bulanan secara massal untuk semua aset aktif. Sistem memposting jurnal beban penyusutan otomatis.
  * **Kartu Ringkasan (atas):** *Total Cost*, *Total Accumulated Depreciation*, *Total Net Book Value*.
  * **Kolom Tabel:** Kode Aset, Nama, Kategori, Tanggal Beli, Harga Perolehan, Akumulasi Depresiasi, Nilai Buku Bersih (NBV), Sisa Umur, % Depresiasi.

##### 1m. Tax Management (`/app/finance/tax`)
* **Keterangan:** Pengelolaan kewajiban pajak perusahaan (PPN dan PPh).
* **Klik Tombol / Panduan:**
  * **Kartu KPI Pajak:**
    - *VAT Payable*: PPN terutang (PPN keluaran > PPN masukan)
    - *VAT Receivable*: Lebih bayar PPN (PPN masukan > PPN keluaran)
    - *Net VAT*: Selisih bersih PPN
    - *Income Tax*: Pajak Penghasilan Badan
    - *Withholding Tax*: Pajak dipotong/dipungut
    - *Total Tax Liability*: Total kewajiban pajak
  * Filter **`Periode`** → Memilih masa pajak (misal: *Januari 2025*).
  * Tombol **`+ New Tax Record`** → Mencatat transaksi pajak baru (PPN Masukan, PPN Keluaran, PPh 21, PPh 23, dll.):
    - **Tipe Pajak**: Pilih dari dropdown
    - **Tanggal Transaksi**
    - **Deskripsi**
    - **DPP (Dasar Pengenaan Pajak) / Base Amount (IDR)**
    - **Tax Rate (%)**: Tarif pajak (misal: *11%* untuk PPN)
    - **Tax Amount (IDR)**: Otomatis dihitung
    - Klik **`Save`**.
  * Tombol **`Export`** → Unduh rekap pajak ke Excel untuk dilaporkan ke SPT.
  * **Kolom Tabel Transaksi:** Tanggal, Tipe Pajak, Deskripsi, DPP, Tarif (%), Nominal Pajak, Status (*Recorded / Pending / Submitted*).

##### 1n. Costing & Controlling (`/app/finance/costing`)
* **Keterangan:** Analisis struktur biaya produksi per cost center (pusat biaya) untuk pengendalian biaya.
* **Klik Tombol / Panduan Interaksi:**
  * Dropdown **`Pilih Periode`** → *Current Month / Last Month / This Quarter / This Year*.
  * Tombol **`Table`** / **`Chart`** → Beralih antara tampilan tabel dan grafik.
  * Tombol **`Export`** → Unduh data analisis biaya ke Excel.
  * **Kartu KPI:** *Total Costs*, *Total Units Produced*, *Average Cost per Unit*, *Cost Efficiency Rate*.
  * **Cost Breakdown (Grafik Pie):** Proporsi Direct Materials, Direct Labor, dan Overhead dari total biaya.
  * **Tabel per Cost Center:** Nama Cost Center (Produksi, QC, Packaging, Gudang), Direct Materials (IDR), Direct Labor (IDR), Overhead (IDR), Total Cost (IDR), Units Produced, Cost per Unit.

##### 1o. Budget Forecasting (`/app/finance/budget-forecasting`)
* **Keterangan:** Proyeksi anggaran ke depan berdasarkan tren aktual dan asumsi pertumbuhan.
* **Klik Tombol:** Tombol **`+ New Forecast`** → Isi asumsi pertumbuhan revenue, biaya, dan inflasi. Klik **`Generate Forecast`** untuk melihat proyeksi.

##### 1p. WIP Ledger (`/app/finance/wip-ledger`)
* **Keterangan:** Buku pembantu biaya produksi berjalan yang terikat pada masing-masing Work Order (WO). Menampilkan akumulasi biaya material, tenaga kerja langsung, dan overhead per WO secara real-time.
* **Klik Tombol:** Klik **`View WIP Ledger`** pada baris nomor WO aktif → Melihat breakdown biaya WO tersebut secara detail.

---

#### 2. Modul Accounting (`/app/accounting`)
*(Lihat detail di bagian Finance 1i, 1j, dan 1k di atas - modul ini berbagi halaman dengan Finance)*

---

#### 3. Modul Human Resources (`/app/hr`)

##### 3a. HR Dashboard (`/app/hr`)
* **Keterangan:** Ringkasan KPI SDM: total karyawan aktif, tingkat kehadiran hari ini, cuti menunggu approval, dan training aktif.
* **Filter Tanggal (atas):** Ubah tanggal untuk melihat data kehadiran hari tertentu.
* **Tombol `Refresh`:** Memperbarui semua data dashboard.
* **Kartu Modul HR (panel bawah):** Klik salah satu kartu (*Data Karyawan / Absensi / Manajemen Cuti / Payroll / Training / Jadwal Kerja / Departemen / Laporan HR*) untuk navigasi langsung ke modul tersebut.
* **Quick Actions:**
  * **`Tambah Karyawan`** → Navigasi ke form karyawan baru.
  * **`Rekam Absensi`** → Navigasi ke halaman absensi wajah.
  * **`Approval Cuti`** → Navigasi ke halaman persetujuan cuti.
  * **`Proses Payroll`** → Navigasi ke halaman payroll.

##### 3b. Data Karyawan (`/app/hr/employees`)
* **Keterangan:** Database biodata dan informasi kepegawaian semua karyawan.
* **Klik Tombol:**
  * Tombol **`+ New Employee`** → Form data karyawan baru:
    - **Nama Lengkap** (Full Name)
    - **Nomor Induk Karyawan** (Employee Number)
    - **NIK KTP**
    - **NPWP** (opsional)
    - **Nomor Telepon** & **Email**
    - **Alamat Lengkap**
    - **Tanggal Lahir**
    - **Jenis Kelamin**
    - Tab **`Employment Info`**:
      - **Tanggal Bergabung**
      - **Departemen**
      - **Jabatan / Posisi**
      - **Status**: *Aktif / Kontrak / Probation / Resign*
      - **Tipe Pembayaran**: *Monthly (bulanan) / Daily (harian)*
    - Tab **`Payroll Info`**:
      - **Gaji Pokok (IDR)**
      - **Tunjangan Jabatan (IDR)**
      - **Tunjangan Transport (IDR)**
    - Klik **`Save`**.
  * Tombol **`Edit`** → Mengubah data karyawan.
  * Input **`Pencarian`** → Cari berdasarkan nama atau nomor karyawan.
  * Filter **`Departemen`** → Menyaring daftar berdasarkan departemen.

##### 3c. Departemen (`/app/hr/departments`)
* **Keterangan:** Pengelolaan struktur organisasi dan daftar departemen.
* **Klik Tombol:**
  * Tombol **`+ New Department`** → Isi nama departemen, pilih kepala departemen. Klik **`Save`**.
  * Tombol **`Edit`** → Mengubah data departemen.

##### 3d. Absensi - Sistem Pengenalan Wajah (`/app/hr/attendance`)
* **Keterangan:** Portal presensi masuk/pulang karyawan menggunakan teknologi facial recognition (pengenalan wajah).
* **Cara Penggunaan:**
  1. Karyawan membuka halaman ini di terminal presensi atau PC.
  2. Klik **`Aktifkan Kamera`** → Kamera web aktif dan sistem mulai memuat model AI pengenalan wajah.
  3. Hadapkan wajah ke kamera dengan pencahayaan yang cukup.
  4. Klik **`📷 Ambil Foto`** → Sistem memotret dan mendeteksi wajah secara otomatis. Jika wajah terdeteksi, muncul indikator hijau dengan persentase keyakinan (confidence).
  5. Klik **`Clock In`** (saat datang/masuk kerja) → Sistem mencocokkan wajah dengan database profil karyawan dan mencatat waktu masuk jika verifikasi sukses.
  6. Klik **`Clock Out`** (saat pulang) → Sama seperti Clock In namun mencatat waktu pulang. Jam kerja otomatis dihitung.
  * Bagian **`Today's Attendance`**: Menampilkan status kehadiran hari ini untuk akun yang sedang login.
  * Bagian **`Attendance History`**: Riwayat kehadiran 7 hari terakhir.

##### 3e. Manajemen Absensi (`/app/hr/attendance-management`)
* **Keterangan:** Halaman administrasi untuk HR/Admin melihat, mengkoreksi, dan mengelola semua data absensi.
* **Klik Tombol:**
  * Filter **`Tanggal`**, **`Departemen`**, **`Status`** → Menyaring data kehadiran.
  * Tombol **`+ Add Attendance Log`** → Input koreksi kehadiran manual (untuk karyawan dinas luar, lupa absen, dsb.). Isi nama karyawan, tanggal, jam masuk, jam keluar, dan keterangan.
  * Tombol **`Export`** → Unduh rekap absensi ke Excel.

##### 3f. Absensi Tidak Clock Out (`/app/hr/attendance-not-clocked-out`)
* **Keterangan:** Daftar karyawan yang sudah Clock In namun belum Clock Out (status menggantung).
* **Klik Tombol:**
  * Tombol **`Force Clock Out`** → Menutup paksa status absensi operator yang lupa scan pulang. Sistem mengisi jam pulang berdasarkan jadwal shift standar.

##### 3g. Laporan Absensi (`/app/hr/attendance-report`)
* **Keterangan:** Laporan rekapitulasi kehadiran karyawan per periode untuk keperluan payroll dan evaluasi.
* **Klik Tombol:**
  * Filter **`Bulan`** & **`Departemen`** → Menyaring laporan.
  * Tombol **`Generate Report`** → Membuat rekapitulasi.
  * Tombol **`Export Excel`** → Mengunduh data ke Excel untuk proses payroll.

##### 3h. Kalender Absensi (`/app/hr/attendance-calendar`)
* **Keterangan:** Tampilan kalender visual kehadiran karyawan (hijau=hadir, merah=absen, kuning=terlambat).
* **Klik Tombol:** Pilih nama karyawan dari dropdown → Kalender otomatis menampilkan data kehadiran karyawan tersebut.

##### 3i. Manajemen Cuti (`/app/hr/leaves`)
* **Keterangan:** Pengajuan, persetujuan, dan monitoring penggunaan cuti karyawan.
* **Tab yang Tersedia:**
  * **`My Requests`**: Pengajuan cuti milik pengguna yang sedang login.
  * **`All Requests`**: Semua pengajuan cuti dari seluruh karyawan (tampilan HR/Manager).
  * **`Leave Balance`**: Sisa kuota cuti tiap karyawan.
* **Klik Tombol:**
  * Tombol **`+ Add Leave Request`** → Form pengajuan cuti:
    - **Jenis Cuti**: Cuti Tahunan / Sakit / Melahirkan / Menikah / Duka Cita / Izin
    - **Tanggal Mulai** & **Tanggal Selesai**
    - **Jumlah Hari** (dihitung otomatis, tidak termasuk hari libur nasional)
    - **Alasan/Keterangan**
    - Upload **Surat Dokter** (wajib untuk cuti sakit lebih dari 2 hari)
    - Klik **`Submit`** → Pengajuan dikirim ke atasan untuk disetujui.
  * Tombol **`✓ Approve`** (pada akun Manager/HR) → Menyetujui pengajuan cuti. Kuota cuti tahunan karyawan otomatis berkurang.
  * Tombol **`✗ Reject`** → Menolak pengajuan cuti dengan alasan.

##### 3j. Staff Leave Management (`/app/hr/staff-leaves`)
* **Keterangan:** Pengelolaan cuti staf oleh departemen (tampilan admin HR yang lebih lengkap).
* **Klik Tombol:** Sama dengan fitur di halaman Manajemen Cuti, namun dengan akses ke seluruh karyawan lintas departemen.

##### 3k. Jadwal Kerja / Roster Mingguan (`/app/hr/roster`)
* **Keterangan:** Penjadwalan dan penugasan karyawan per shift per mesin setiap minggu, termasuk penentuan pemimpin shift (leader). Sistem ini adalah pengatur distribusi SDM di lantai produksi.
* **Shift yang Tersedia:**
  * **Shift 1**: 06:30 - 15:00
  * **Shift 2**: 15:00 - 23:00
  * **Shift 3**: 23:00 - 06:30 (dini hari berikutnya)
* **Role/Jabatan yang Dapat Ditugaskan:**
  * *Operator, Helper, Checker, Infeeding, Timbang Box* (untuk setiap mesin utama)
  * *QC IPC* (QC In-Process)
  * *QC FG* (QC Final Goods)
  * *Packing Line 1 - 5* (penugasan jalur packing manual)
  * *Distribusi* (helper distribusi antar mesin)
  * *Bag Maker, Inkjet, Fliptop* (mesin khusus)
* **Klik Tombol / Panduan:**
  * Tombol **`◀ Minggu Sebelumnya`** / **`Minggu Selanjutnya ▶`** → Navigasi antar minggu.
  * Dropdown **`Pilih Shift`** (Shift 1 / Shift 2 / Shift 3) → Menampilkan penugasan untuk shift tertentu.
  * **Penugasan Pemimpin Shift (Leader):**
    - Di bagian atas roster, klik dropdown **`Leader Shift 1`** (atau Shift 2 / Shift 3) → Pilih nama karyawan yang akan menjadi Ketua Shift minggu ini.
  * **Menugaskan Karyawan ke Mesin:**
    - Di baris mesin tertentu (misal: *Mesin 5*), klik tombol **`+ Tambah`** di kolom role (misal: *Operator*) → Muncul dropdown pencarian nama karyawan yang tersedia → Pilih nama karyawan → Klik **`Assign`**.
  * **Menghapus Penugasan:**
    - Klik ikon **`🗑️ Hapus`** di samping nama karyawan yang sudah ditugaskan → Karyawan dihapus dari slot tersebut.
  * Tombol **`Save Roster`** → Menyimpan semua perubahan penugasan minggu ini.
  * Tombol **`Publish`** → Menerbitkan roster agar dapat dilihat oleh semua karyawan yang bersangkutan.
  * Tombol **`Print Roster`** → Mencetak jadwal kerja mingguan.

##### 3l. Payroll (`/app/hr/payroll`)
* **Keterangan:** Pengolahan dan penerbitan slip gaji karyawan per periode.
* **Klik Tombol:**
  * Tombol **`+ New Payroll Period`** → Membuat periode penggajian baru:
    - **Nama Periode** (contoh: *Payroll Juni 2025*)
    - **Tanggal Mulai** & **Tanggal Selesai** periode
    - Klik **`Save`** → Periode berstatus *Draft*.
  * Tombol **`Generate Payroll`** → Sistem menghitung akumulasi gaji untuk semua karyawan aktif dalam periode ini, meliputi: Gaji Pokok + Tunjangan + Lembur - Potongan Absensi - PPh 21 - BPJS.
  * Klik nama periode yang sudah di-generate → Masuk ke halaman daftar slip gaji per karyawan.
  * Tombol **`Post & Lock Payroll`** → Memfinalisasi payroll dan menerbitkan slip gaji digital ke akun masing-masing karyawan. Status berubah menjadi *Processed* (tidak bisa diubah lagi).

##### 3m. Payroll Record / Slip Gaji (`/app/hr/payroll/:periodId/records`)
* **Keterangan:** Daftar dan detail slip gaji semua karyawan dalam satu periode payroll.
* **Klik Tombol:**
  * Input **`Pencarian`** → Cari nama karyawan.
  * Klik ikon **`👁️ Lihat Slip Gaji`** pada baris karyawan → Membuka modal pop-up slip gaji lengkap dengan rincian:
    - **Komponen Pendapatan**: Gaji Pokok, Tunjangan Jabatan, Tunjangan Transport, Lembur, Bonus
    - **Komponen Potongan**: PPh 21, BPJS Kesehatan, BPJS Ketenagakerjaan, Pinjaman, Potongan Absensi
    - **Rekap Kehadiran**: Hari Kerja, Hari Hadir, Hari Absen, Jam Lembur
    - **Gaji Bersih (Take Home Pay)**
  * Tombol **`🖨️ Print`** (di modal slip gaji) → Mencetak slip gaji karyawan bersangkutan ke printer.
  * Tombol **`Export All`** → Mengunduh semua slip gaji periode ini ke Excel.

##### 3n. Piecework Log (Log Upah Borongan) (`/app/hr/piecework-log`)
* **Keterangan:** Pencatatan produksi per unit oleh karyawan dengan sistem upah borongan (bayar per jumlah barang yang diproduksi).
* **Klik Tombol:**
  * Tombol **`+ New Log`** → Isi nama karyawan, produk, jumlah unit yang diproduksi, dan shift. Klik **`Save`**.
  * Nilai upah borongan dihitung otomatis berdasarkan rate per unit yang sudah dikonfigurasi.

##### 3o. Outsourcing Vendor (`/app/hr/outsourcing-vendors`)
* **Keterangan:** Data vendor penyedia tenaga kerja outsourcing (kontrak) yang bekerja di pabrik.
* **Klik Tombol:**
  * Tombol **`+ New Vendor`** → Isi nama perusahaan vendor, nama PIC, kontak, dan nilai kontrak. Klik **`Save`**.

##### 3p. Training Management (`/app/hr/training`)
* **Keterangan:** Pengelolaan program pelatihan dan pengembangan kompetensi karyawan.
* **Tab yang Tersedia:**
  * **`Training Sessions`**: Daftar sesi pelatihan yang sudah dijadwalkan atau sedang berjalan.
  * **`Training Programs`**: Katalog program pelatihan yang tersedia (kurikulum).
  * **`Training Requests`**: Pengajuan kebutuhan pelatihan dari departemen.
* **Klik Tombol:**
  * Tombol **`+ New Training Session`** → Membuat jadwal sesi training baru. Isi nama program, instruktur, tanggal, dan peserta. Klik **`Save`**.
  * Filter **`Status`** → *Scheduled / Ongoing / Completed / Cancelled*.
  * Filter **`Tipe`** → *Internal / External / Online / Workshop*.
  * Tombol **`Training Report`** → Navigasi ke laporan analitik training.

##### 3q. Penilaian Karyawan (Appraisal) (`/app/hr/appraisal`)
* **Keterangan:** Sistem penilaian kinerja karyawan berkala (KPI Appraisal).
* **Tab:**
  * **`Appraisal Cycles`**: Daftar siklus penilaian yang aktif.
  * **`Appraisals`**: Daftar form penilaian per karyawan.
* **Klik Tombol:**
  * Tombol **`+ New Cycle`** → Membuat siklus penilaian baru (misal: *Mid-Year 2025*). Isi periode dan template penilaian.
  * Tombol **`Start Appraisal`** → Memulai proses pengisian form penilaian.
  * Karyawan mengisi penilaian diri sendiri. Atasan mengisi penilaian dari perspektif manajemen.
  * Tombol **`Submit`** → Menyelesaikan dan mengunci form penilaian.

##### 3r. Laporan HR (`/app/hr/reports`)
* **Keterangan:** Laporan-laporan analitik SDM yang dapat diunduh.
* **Klik Tombol:**
  * Pilih **Jenis Laporan**: *Laporan Absensi / Laporan Cuti / Laporan Payroll Summary / Laporan Turnover Karyawan*.
  * Pilih **Periode**.
  * Klik **`Generate Report`** → Laporan dibuat.
  * Klik **`Export Excel`** atau **`Export PDF`** untuk mengunduh.

##### 3s. Face Admin (`/app/hr/face-admin`)
* **Keterangan:** Manajemen registrasi profil wajah karyawan untuk sistem presensi.
* **Klik Tombol:**
  * Pilih nama karyawan dari daftar.
  * Klik **`Start Registration`** → Kamera web aktif.
  * Minta karyawan menghadap ke kamera, pastikan pencahayaan baik.
  * Klik **`Capture & Save Face Profile`** → Sistem mengekstrak 128 titik landmark wajah dan menyimpan ke database facial recognition.
  * Klik **`Delete Profile`** → Menghapus profil wajah (diperlukan jika karyawan resign atau foto berubah drastis).

---

### 📂 GRUP 6: MAINTENANCE & R&D

#### 1. Modul Asset Management (EAM) (`/app/assets`)

##### 1a. Daftar Aset (`/app/assets/list`)
* **Keterangan:** Database seluruh mesin dan peralatan produksi.
* **Klik Tombol:**
  * Tombol **`+ Add Asset`** → Form aset baru:
    - **Nama Aset**, **Kode Inventaris**, **Tanggal Instalasi**, **Nomor Seri**, **Departemen Penanggung Jawab**
    - Klik **`Save`**.
  * Klik baris aset → Masuk ke halaman detail mesin.

##### 1b. Halaman Detail Mesin (`/app/assets/:id`)
* **Tab yang Tersedia:**
  * **`Info`**: Data teknis mesin (spesifikasi, nomor seri, tanggal instalasi).
  * **`Maintenance History`**: Riwayat semua WO maintenance yang pernah dilakukan.
  * **`Spare Parts`**: Daftar spare parts yang pernah digunakan untuk mesin ini.
  * **`OEE`**: Grafik OEE mesin dari waktu ke waktu.

##### 1c. Spare Parts (`/app/assets/spare-parts`)
* **Keterangan:** Inventaris suku cadang mesin yang tersedia di gudang maintenance.
* **Klik Tombol:**
  * Tombol **`+ Add Spare Part`** → Form:
    - **Nama Suku Cadang** (contoh: *Bearing 6202 Z*)
    - **Kode Part**
    - **Lokasi Rak/Laci**: Lokasi fisik penyimpanan (contoh: *Lemari A Laci 3*)
    - **Stok Saat Ini (pcs)**
    - **Stok Minimum (pcs)**: Alarm dikirim jika stok di bawah angka ini
    - **Harga per Unit (IDR)**
    - Klik **`Save`**.
  * Tombol **`Edit`** → Mengubah data spare part.
  * Tombol **`+ Adjust Stock`** → Menambah atau mengurangi stok spare part secara manual.

---

#### 2. Modul Maintenance (`/app/maintenance`)

##### 2a. Dashboard Maintenance (`/app/maintenance`)
* **Keterangan:** Ringkasan KPI: WO maintenance menunggu / berjalan / selesai, MTBF, MTTR, dan grafik tren breakdown.

##### 2b. Work Orders Maintenance (`/app/maintenance/records`)
* **Keterangan:** Perintah kerja perbaikan dan perawatan mesin bagi teknisi.
* **Klik Tombol:**
  * Tombol **`+ New Maintenance WO`** → Form WO maintenance baru:
    - **Mesin**: Pilih mesin yang akan diperbaiki
    - **Jenis WO**: *Corrective (perbaikan kerusakan) / Preventive (perawatan terjadwal)*
    - **Deskripsi Masalah**
    - **Teknisi yang Ditugaskan**
    - **Prioritas**: Normal / High / Critical
    - **Tanggal Target Selesai**
    - Klik **`Save`** → WO berstatus *Open*.
  * Tombol **`Start Repair`** → Klik untuk mengubah status WO menjadi *In Progress* (jam mulai tercatat).
  * Tombol **`Complete Repair`** → Form penutupan WO:
    - **Spare Parts Used**: Pilih spare part yang digunakan (stok laci spare parts terpotong otomatis)
    - **Catatan Tindakan Koreksi**: Tulis langkah perbaikan yang dilakukan
    - **Akar Masalah (Root Cause)**
    - Klik **`Save Maintenance Record`** → WO selesai, durasi downtime mesin tercatat untuk analisis OEE.

##### 2c. Jadwal Maintenance (Preventive Maintenance) (`/app/maintenance/schedules`)
* **Keterangan:** Kalender rencana perawatan rutin mesin (pelumasan, penggantian filter, kalibrasi, ganti oli, dll.).
* **Klik Tombol:**
  * Tombol **`+ New Schedule`** → Form jadwal PM baru:
    - **Mesin**: Pilih mesin
    - **Jenis Perawatan**: Deskripsi tugas perawatan (contoh: *Penggantian Oli Gearbox*)
    - **Frekuensi**: Pilih interval (*Harian / Mingguan / Bulanan / Triwulan / Tahunan*)
    - **Tanggal Mulai Berlaku**
    - **Teknisi Penanggung Jawab**
    - Klik **`Create`** → Jadwal aktif. Sistem akan otomatis menerbitkan WO maintenance baru saat tanggal H jadwal tercapai.
  * Klik baris jadwal → Melihat riwayat pelaksanaan PM di masa lalu.

##### 2d. Checklist NG (`/app/maintenance/checklist-ng`)
* **Keterangan:** Inbox laporan kerusakan mesin yang dilaporkan oleh operator di Pre-Shift Checklist.
* **Klik Tombol:**
  * Klik pada baris temuan kerusakan NG → Melihat detail: mesin apa, poin pemeriksaan mana, deskripsi temuan operator.
  * Klik **`Create PM Work Order`** → Sistem otomatis membuat WO perbaikan baru dengan deskripsi temuan yang sudah terisi dari laporan operator.

##### 2e. Permintaan Maintenance (Maintenance Request) (`/app/maintenance/request/new`)
* **Keterangan:** Pelaporan kerusakan mesin darurat (*breakdown*) di tengah proses produksi oleh operator/siapa saja.
* **Klik Tombol:**
  * Tombol **`+ Create Request`** → Form:
    - **Mesin**: Pilih mesin yang rusak
    - **Deskripsi Gejala**: Tulis keluhan secara detail (contoh: *"Motor conveyor berbunyi aneh dan berhenti mendadak"*)
    - **Tingkat Keparahan**: *High (mesin mati total)* / *Low (mesin masih bisa jalan tapi ada anomali)*
    - Klik **`Submit Request`** → Alarm peringatan realtime dikirim ke departemen maintenance dan WO breakdown dibuat.

##### 2f. Maintenance Analytics (`/app/maintenance/analytics`)
* **Keterangan:** Analisis data historis maintenance: MTBF, MTTR, biaya perawatan per mesin, dan Pareto breakdown terbanyak.
* **Klik Tombol:**
  * Filter **`Mesin`** & **`Periode`** → Ubah konteks analisis.
  * Tombol **`Export`** → Unduh laporan analisis maintenance.

---

#### 3. Modul R&D (Research & Development) (`/app/rnd` & `/app/rd`)

##### 3a. Proyek R&D (`/app/rnd/projects`)
* **Keterangan:** Database proyek riset dan pengembangan formula produk baru.
* **Klik Tombol:**
  * Tombol **`+ New RND Project`** → Form:
    - **Judul Proyek Riset**
    - **Nama Produk Uji Coba**
    - **Deskripsi / Tujuan Penelitian**
    - **Target Estimasi Selesai**
    - **Tim R&D yang Bertanggung Jawab**
    - Klik **`Save`** → Proyek berstatus *Active*.
  * Klik baris proyek → Masuk ke halaman detail proyek.

##### 3b. Experiments (Lab Trials) (`/app/rd/experiments`)
* **Keterangan:** Lembar catatan hasil percobaan pencampuran bahan/formula di laboratorium.
* **Klik Tombol:**
  * Tombol **`+ New Experiment`** → Form:
    - **Link ke Proyek R&D**
    - **Nomor Trial**: Urutan percobaan
    - **Komposisi Bahan**: Masukkan daftar bahan dan proporsinya
    - **Kondisi Proses**: Suhu, tekanan, waktu mixing, dll.
    - **Hasil Pengujian**: pH, kekentalah, warna, aroma, berat, ketahanan tisu, dll.
    - **Status**: *Lolos Spesifikasi / Gagal / Perlu Ulang*
    - **Catatan Peneliti**
    - Klik **`Save`**.

##### 3c. Approvals R&D (`/app/rnd/approvals`)
* **Keterangan:** Proses validasi dan persetujuan formula R&D yang siap diproduksi secara massal.
* **Klik Tombol:**
  * Tombol **`✓ Setujui`** (QA Manager) → Menyetujui hasil R&D untuk diproduksi.
  * Tombol **`Convert to Production Product`** → Klik pada proyek R&D yang sudah disetujui. Sistem **otomatis** memindahkan resep formula menjadi Master Product dan Master BOM resmi yang langsung dapat digunakan oleh bagian produksi untuk membuat Work Order.

---

#### 4. Waste Management (`/app/waste`)
* **Keterangan:** Log pencatatan volume pembuangan limbah sisa proses produksi (limbah cair, sisa potongan kain, plastik reject, kemasan rusak) untuk pelaporan lingkungan.
* **Klik Tombol:**
  * Tombol **`+ New Waste Record`** → Form:
    - **Mesin / Sumber Limbah**: Pilih mesin penghasil limbah
    - **Kategori Limbah**: Pilih tipe (*Limbah Cair / Sisa Kain / Plastik Reject / Kemasan Rusak / Lainnya*)
    - **Berat Limbah (kg)**
    - **Tanggal Pencatatan**
    - **Keterangan**
    - Klik **`Submit Record`**.
  * Tab **`History`** → Riwayat pencatatan limbah.
  * Tombol **`Export`** → Unduh rekap limbah untuk laporan lingkungan.

---

### 📂 GRUP 7: QUALITY & DCC (PENGENDALIAN DOKUMEN ISO)

#### 1. Modul Document Control Center (DCC) (`/app/dcc`)
Modul pengelolaan administrasi sistem manajemen mutu ISO 9001:2015. Semua sub-fitur diakses melalui **tab navigasi horizontal** di bagian atas halaman DCC.

##### Tab: Daftar Induk Dokumen (`/app/dcc?tab=documents`)
* **Keterangan:** Database master berkas dokumen mutu terkendali: SOP (Standard Operating Procedure), Instruksi Kerja (IK), dan Formulir (FRM).
* **Klik Tombol / Alur Kerja Dokumen:**
  1. Tombol **`+ Registrasi Dokumen`** → Form Registrasi (FRM-DCC-01):
     - **Nomor Dokumen** (contoh: *SOP-PRD-01*)
     - **Judul Dokumen**
     - **Tipe Dokumen**: SOP / Instruksi Kerja / Formulir / Kebijakan
     - **Departemen Pemilik**
     - **Revisi**: Nomor revisi awal (contoh: *Rev.00*)
     - **Upload File PDF** dokumen
     - Klik **`Simpan`** → Status dokumen: *Draft*.
  2. Klik **`Submit for Review`** → Dokumen masuk ke antrean pengkaji untuk ditandatangani.
  3. **Proses Tanda Tangan Elektronik** (pada tab **`Revisions`** dokumen terkait):
     - Pengkaji: Klik **`✓ Tandatangani / Setujui`**.
     - General Manager/Pengesah: Klik **`✓ Sahkan`** → Status berubah menjadi *Active* dan dokumen versi lama otomatis berganti menjadi *Obsolete*.
  * **Filter Tipe** & **`Pencarian`** → Menyaring daftar dokumen.
  * Tombol **`Download`** → Mengunduh PDF dokumen aktif.

##### Tab: Change Notice (`/app/dcc?tab=change_notice`)
* **Keterangan:** Pengajuan usulan revisi / perubahan isi dokumen yang sudah aktif (Formulir FRM-DCC-02).
* **Klik Tombol:**
  * Tombol **`+ New Change Notice`** → Form:
    - **Nomor Dokumen**: Pilih dokumen yang ingin direvisi
    - **Alasan Perubahan**: Tulis mengapa dokumen perlu diubah
    - **Rincian Perubahan**: Poin per poin apa yang berubah dari versi lama ke versi baru
    - Klik **`Submit`** → DCO membuat versi revisi baru dari dokumen tersebut.

##### Tab: Kaji Ulang (`/app/dcc?tab=review`)
* **Keterangan:** Log berkala peninjauan masa berlaku dan relevansi dokumen ISO (Formulir FRM-DCC-10).
* **Klik Tombol:**
  * Tombol **`+ Kaji Ulang Baru`** → Form:
    - **Pilih Dokumen**: Pilih dari daftar
    - **Hasil Kaji Ulang**: Klik radio button *Masih Relevan / Perlu Revisi / Jadikan Obsolete*
    - **Catatan Hasil Analisis**
    - **Tanggal Kaji Ulang Berikutnya**
    - Klik **`Simpan`**.

##### Tab: Rekaman Mutu (`/app/dcc?tab=quality_records`)
* **Keterangan:** Daftar lokasi penyimpanan dan masa retensi dokumen arsip (Formulir FRM-DCC-03).
* **Klik Tombol:**
  * Tombol **`+ Tambah Rekaman`** → Form:
    - **Nomor Rekaman**, **Judul Berkas**, **Departemen Pemilik**
    - **Lokasi Fisik Penyimpanan** (contoh: *Lemari Arsip QA Ruang 2 Baris B*)
    - **Masa Retensi (tahun)**: Berapa lama dokumen wajib disimpan
    - Klik **`Simpan`**.

##### Tab: CAPA (`/app/dcc?tab=capa`)
* **Keterangan:** Corrective and Preventive Action — lembar penyelesaian masalah mutu atas temuan audit atau klaim defect.
* **Klik Tombol / Alur Kerja CAPA:**
  1. Tombol **`+ Buat CAPA`** → Form:
     - **Deskripsi Temuan Ketidaksesuaian**
     - **Sumber Temuan**: Audit Internal / Audit Eksternal / Klaim Pelanggan / Proses Internal
     - **Departemen Penanggung Jawab**
     - Klik **`Simpan CAPA`** → Status: *Open*.
  2. Tab **`Investigasi`** (diisi oleh PIC departemen):
     - **Analisis Akar Masalah**: Tulis hasil metode *5-Whys* atau tuliskan hasil diagram *Fishbone*
     - **Rencana Tindakan Korektif**: Langkah perbaikan yang akan dilakukan
     - **Rencana Tindakan Preventif**: Langkah pencegahan agar masalah tidak terulang
     - **Tenggat Waktu Setiap Tindakan**
     - Klik **`Simpan Investigasi`** → Status: *Pending Verification*.
  3. Tab **`Verifikasi`** (diisi oleh QA Manager):
     - **Hasil Audit Verifikasi** di lapangan
     - Jika terbukti efektif, klik **`Simpan Verifikasi`** → Status: *Closed*.

##### Tab: Komunikasi Internal / Memo (`/app/dcc?tab=memos`)
* **Keterangan:** Pembuatan dan distribusi memo internal terkontrol untuk penyebaran informasi kebijakan mutu.
* **Klik Tombol:**
  * Tombol **`Buat Memo`** → Form:
    - **Subjek Memo**
    - **Kategori**: Kebijakan / Informasi / Prosedur / Pengumuman
    - **Isi Pesan Memo** (teks editor)
    - Klik **`Simpan`** → Memo berstatus *Draft*.
  * Tombol **`Publish`** → Centang departemen penerima → Klik **`Publish [X] Dept`**. Notifikasi real-time dikirim ke akun semua karyawan di departemen yang dipilih.

##### Tab: Pemusnahan Dokumen (`/app/dcc?tab=destruction`)
* **Keterangan:** Berita Acara Pemusnahan Dokumen (Formulir FRM-DCC-08) untuk dokumen arsip yang habis masa retensinya.
* **Klik Tombol:**
  * Tombol **`Buat BA Pemusnahan`** → Form:
    - **Pilih Dokumen Obsolete**: Centang dokumen dari daftar yang masa retensinya sudah habis
    - **Metode Pemusnahan**: Shredder (dicacah) / Dibakar / Dilebur
    - **Alasan Pemusnahan**
    - **Nama Saksi-Saksi** yang menyaksikan pemusnahan
    - Klik **`Simpan`** → Dokumen ditandai telah dimusnahkan dan tidak dapat diakses lagi.

---

### 📂 GRUP 8: REPORTS & SETTINGS (PENDUKUNG / UTILITY)

#### 1. Laporan Kustom (Reports) (`/app/reports`)
* **Keterangan:** Generator laporan kustom terpadu dari berbagai modul ERP dalam satu tempat.
* **Klik Tombol / Cara Penggunaan:**
  1. Pilih **Modul**: Finance / HR / Production / Sales / Quality / Purchasing.
  2. Pilih **Jenis Laporan** spesifik dari dropdown.
  3. Atur **Rentang Tanggal** (From - To).
  4. Klik **`Generate Report`** → Sistem mengambil dan memformat data.
  5. Klik **`Download Excel`** atau **`Download PDF`** untuk mengunduh laporan.

#### 2. Documents & Templates (`/app/documents`)
* **Templates (`/app/documents/templates`):**
  * **Keterangan:** Editor template untuk format ekspor dokumen (Invoice, PO, Slip Gaji, Surat Jalan, dll.).
  * **Klik Tombol:** Tombol **`+ New Template`** → Masukkan nama template, pilih jenis dokumen, rancang layout menggunakan tag HTML dan variabel data. Klik **`Save Template`**. Template ini digunakan saat user mencetak dokumen dari modul terkait.

#### 3. TV Display (`/app/tv-display`)
* **Keterangan:** Pengaturan konten layar monitor TV yang dipasang di dinding koridor atau lantai produksi pabrik untuk keperluan monitoring publik.
* **Klik Tombol / Cara Penggunaan:**
  1. Pilih **Tipe Layar** yang ingin ditampilkan:
     - *Production Line Monitor*: Grafis output vs target per mesin secara live
     - *Shipping Schedule Monitor*: Jadwal pengiriman hari ini
     - *Employee Attendance Roster*: Tampilan roster kehadiran karyawan
  2. Klik **`Launch TV View`** → Browser membuka tab baru dalam mode fullscreen yang memperbarui data secara otomatis setiap 30 detik.

#### 4. Group Chat (`/app/chat`)
* **Keterangan:** Layanan pesan instan internal antar karyawan sistem ERP.
* **Klik Tombol / Cara Penggunaan:**
  * Panel kiri menampilkan daftar channel diskusi (misal: *#produksi-mesin-8*, *#maintenance-team*, *#quality-control*).
  * Klik nama channel → Panel utama menampilkan riwayat percakapan.
  * Ketik teks pesan di kotak input bawah, tekan **`Enter`** atau klik **`Kirim`** (ikon pesawat kertas) untuk mengirim pesan.
  * Klik ikon **`📎 Lampiran`** → Upload file (foto, PDF, dokumen) ke dalam chat.
  * Klik nama pengguna lain → Membuka Direct Message (pesan pribadi).

#### 5. Notifications (`/app/notifications`)
* **Keterangan:** Kotak masuk notifikasi dari semua modul sistem (approval pending, alarm stok rendah, deadline maintenance, dll.).
* **Klik Tombol:**
  * Klik notifikasi → Langsung navigasi ke halaman/dokumen yang dimaksud.
  * Tombol **`Mark All as Read`** → Menandai semua notifikasi sudah dibaca.

#### 6. Settings / Pengaturan Sistem (`/app/settings`)
* **Keterangan:** Konfigurasi global sistem ERP. **🔒 Halaman ini sepenuhnya terbatas dan hanya dapat diakses oleh pengguna dengan role *Super Admin*.** Pengguna dengan role lain (Manager, Operator, Staff, dll.) tidak akan melihat menu Settings di sidebar dan tidak dapat membuka halaman ini meskipun URL diakses langsung.
* **Tab / Bagian yang Tersedia:**
  * **`Role & Permission Matrix`**: Pengelolaan hak akses per peran (role):
    - Pilih nama peran dari list (contoh: *Quality Staff*, *Production Operator*)
    - Centang atau hapus centang pada kotak hak akses modul: `view`, `create`, `edit`, `delete`, `approve`
    - Klik **`Save Permissions`** → Perubahan berlaku segera untuk semua pengguna dengan role tersebut.
  * **`User Management`**: Buat, edit, dan nonaktifkan akun pengguna sistem.
    - Tombol **`+ New User`** → Isi username, email, password awal, pilih role.
    - Tombol **`Reset Password`** → Mengirim email reset password.
  * **`Backup & Restore Database`**:
    - Klik **`Create Backup Now`** → Sistem mengompresi database menjadi file snapshot dan mengunduhnya ke komputer.
    - Tombol **`Restore`** → Upload file backup untuk mengembalikan data ke kondisi snapshot.
  * **`System Logs`**: Log aktivitas sistem dan audit trail.
  * **`General Configuration`**: Pengaturan umum seperti nama perusahaan, logo, timezone, dan format mata uang.

#### 7. Profile (`/app/profile`)
* **Keterangan:** Halaman profil dan pengaturan akun pengguna yang sedang login.
* **Klik Tombol:**
  * Tombol **`Edit Profile`** → Mengubah nama tampilan, foto profil, dan nomor telepon.
  * Tombol **`Change Password`** → Form: masukkan password lama → masukkan password baru → konfirmasi password baru → Klik **`Save`**.
  * Dropdown **`Bahasa`** → Pilih bahasa antarmuka sistem (Indonesia / English).
  * Toggle **`Dark Mode`** → Mengaktifkan/menonaktifkan tampilan gelap.

#### 8. Approval Center (`/app/approvals`)
* **Keterangan:** Pusat persetujuan terpadu untuk semua dokumen dari berbagai modul yang memerlukan tanda tangan atau persetujuan (PO, SO, Expense, Leave, dll.).
* **Klik Tombol:**
  * Filter **`Modul`** & **`Status`** → Menyaring antrean approval.
  * Tombol **`✓ Approve`** → Menyetujui dokumen.
  * Tombol **`✗ Reject`** → Menolak dokumen dengan catatan alasan.
  * Klik judul dokumen → Membuka halaman detail dokumen yang membutuhkan persetujuan sebelum mengambil keputusan.

#### 9. Search (`/app/search`)
* **Keterangan:** Mesin pencarian global yang dapat mencari data di seluruh modul sistem.
* **Cara Penggunaan:** Tekan **`Ctrl + K`** dari mana saja di sistem → Ketik kata kunci (nama produk, nomor WO, nama karyawan, nomor PO, dll.) → Tekan Enter atau pilih hasil yang relevan.

---

*📌 **Catatan:** Tampilan dan fitur menu yang tersedia bagi setiap pengguna bergantung pada **role** dan **permission** yang ditetapkan oleh Super Admin di halaman Settings > Role Permission Matrix.*