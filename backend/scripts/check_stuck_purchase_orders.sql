-- Fase 2 (fix_report_2.md, lanjutan audit 1 Okt 2026) — Cek PO "macet"
-- akibat bug pending_approvals count-after-mutate yang diperbaiki di
-- fix_report.md Fase 7 (`== 1` -> `== 0` di approve_purchase_order(),
-- routes/purchasing.py).
-- =========================================================
-- READ-ONLY. Tidak ada UPDATE/DELETE di file ini. JANGAN dijalankan
-- otomatis — pemilik yang menjalankan manual di produksi lalu memutuskan
-- tindakan lanjutan per baris yang ditemukan.
--
-- Latar belakang: sebelum fix Fase 7, approve_purchase_order() punya bug
-- di mana kondisi `pending_approvals == 1` (seharusnya `== 0`) membuat
-- PO.status TIDAK PERNAH berubah jadi 'approved' meskipun semua baris
-- PurchaseApproval terkait sudah berstatus 'approved' — dan
-- reserve_po_budget_commitment() juga tidak pernah terpanggil untuk PO
-- yang kena bug ini. PO seperti itu:
--   (a) approval-nya sendiri sudah lengkap (semua level 'approved'),
--   (b) tapi PurchaseOrder.status masih 'pending_approval' (tidak pernah
--       naik jadi 'approved'),
--   (c) dan BudgetLine.committed_amount untuk akun terkait tidak pernah
--       bertambah untuk PO itu.

-- 1. PO yang SEMUA PurchaseApproval-nya sudah 'approved', tapi
--    PurchaseOrder.status BELUM 'approved' — kandidat utama korban bug ini.
SELECT
    po.id,
    po.po_number,
    po.status AS po_status,
    po.total_amount,
    po.order_date,
    COUNT(pa.id) AS jumlah_approval,
    COUNT(pa.id) FILTER (WHERE pa.status = 'approved') AS jumlah_disetujui
FROM purchase_orders po
JOIN purchase_approvals pa ON pa.po_id = po.id
WHERE po.status != 'approved'
GROUP BY po.id, po.po_number, po.status, po.total_amount, po.order_date
HAVING COUNT(pa.id) = COUNT(pa.id) FILTER (WHERE pa.status = 'approved')
ORDER BY po.order_date DESC;

-- 2. PO yang statusnya SUDAH 'approved' (mungkin lewat jalur lain -
--    submit-approval/generic workflow, atau auto-approve threshold, yang
--    keduanya TIDAK kena bug ini) tapi budget commitment-nya 0 padahal
--    seharusnya ada BudgetLine aktif untuk akun item-itemnya. Query ini
--    lebih perkiraan (butuh join manual ke resolve_account logic yang
--    tidak bisa direplikasi murni di SQL) — dipakai untuk SPOT-CHECK, bukan
--    daftar final. Pemilik perlu verifikasi manual tiap baris yang muncul.
SELECT
    po.id,
    po.po_number,
    po.status AS po_status,
    po.approved_at,
    po.total_amount
FROM purchase_orders po
WHERE po.status = 'approved'
  AND NOT EXISTS (
      -- tidak ada satupun baris AccountingEntry/PendingJournalEntry yang
      -- mereferensikan PO ini lewat pola reference umum yang dipakai
      -- modul lain (heuristik kasar, bukan bukti pasti)
      SELECT 1 FROM pending_journal_entries pje
      WHERE pje.reference = po.po_number
  )
ORDER BY po.approved_at DESC NULLS LAST
LIMIT 200;

-- TINDAK LANJUT YANG DISARANKAN (didiskusikan dengan pemilik, BUKAN
-- otomatis):
--   - Baris dari query #1: PO tersebut aman untuk di-"approve ulang"
--     lewat endpoint yang sama SETELAH fix Fase 7 di-deploy (approval
--     rows sudah semua 'approved', jadi approve_purchase_order() untuk
--     approval level TERAKHIR yang belum "memicu" PO-approved perlu
--     dipanggil ulang sekali lagi agar pending_approvals==0 tercapai
--     dan efek sampingnya baru benar-benar jalan) — ATAU, kalau tidak mau
--     memanggil ulang endpoint, PO.status dan BudgetLine.committed_amount
--     bisa dikoreksi manual lewat query UPDATE terpisah (TIDAK disertakan
--     di sini, karena itu keputusan data yang perlu persetujuan eksplisit
--     pemilik per-baris, bukan sesuatu yang aman digeneralisasi).
--   - Baris dari query #2: false-positive mungkin tinggi (heuristik kasar)
--     — gunakan sebagai titik awal investigasi manual, bukan daftar final.
