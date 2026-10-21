-- Fase 8a (audit 29 Sept 2026) — Cek konfigurasi akun Kas
-- =========================================================
-- READ-ONLY. Tidak ada UPDATE/DELETE di file ini. Jalankan manual di
-- produksi (psql atau tool GUI apa pun) untuk MELIHAT hasilnya dulu —
-- JANGAN langsung "perbaiki" apapun berdasarkan skrip ini tanpa keputusan
-- pemilik, sesuai instruksi prompt ("Jangan ubah ACCOUNT_CODES sebelum
-- pemilik menjawab").
--
-- Latar belakang: utils/account_config.py punya dua kode akun kas terpisah
--   ACCOUNT_CODES['cash']         = '1-1000'  (Kas Umum)
--   ACCOUNT_CODES['cash_in_bank'] = '1-1010'  (Kas di Bank)
-- Transaksi Payment nyata (routes/finance.py::create_payment, dan yang
-- setara di purchase_invoice.py) memakai bank_account_id yang DIPILIH USER
-- di form — biasanya akun 1-1010 (Bank), bukan 1-1000.
--
-- Tapi 4 tempat lain di kode me-resolve akun kas lewat
-- GlobalAccountDefault dengan transaction_key='cash' (BUKAN 'cash_in_bank'):
--   routes/expense.py:950
--   routes/finance.py:2979
--   routes/asset_management.py:264
--   routes/asset_management.py:364
-- Kalau baris GlobalAccountDefault untuk transaction_key='cash' di
-- produksi diarahkan ke akun 1-1000 (Kas Umum) sementara transaksi harian
-- yang sebenarnya selalu lewat 1-1010 (Bank), maka expense/asset-disposal
-- yang lewat 4 tempat ini akan memposting ke akun yang BERBEDA dari akun
-- yang benar-benar dipakai — saldo Kas jadi terpecah dua padahal
-- seharusnya satu.

-- 1. Lihat baris GlobalAccountDefault untuk transaction_key='cash' saat ini,
--    beserta detail akun yang dirujuknya.
SELECT
    gad.id,
    gad.transaction_key,
    gad.account_id,
    a.account_code,
    a.account_name,
    a.is_cash_bank
FROM global_account_defaults gad
JOIN accounts a ON a.id = gad.account_id
WHERE gad.transaction_key = 'cash';

-- 2. Bandingkan dengan akun mana yang SEBENARNYA dipakai di Payment nyata
--    (bank_account_id yang dipilih user), untuk lihat apakah keduanya
--    konsisten atau berbeda. Kalau account_code hasil query #1 BERBEDA
--    dari account_code yang paling sering muncul di sini, itu tanda kuat
--    ada split kas yang salah.
SELECT
    a.account_code,
    a.account_name,
    COUNT(*) AS jumlah_payment
FROM payments p
JOIN accounts a ON a.id = p.bank_account_id
GROUP BY a.account_code, a.account_name
ORDER BY jumlah_payment DESC;

-- 3. Cek juga apakah ada baris GlobalAccountDefault untuk 'cash_in_bank'
--    sama sekali (kalau kosong, berarti tidak ada default eksplisit untuk
--    kunci itu — bukan berarti error, tapi berguna untuk konteks).
SELECT
    gad.id,
    gad.transaction_key,
    a.account_code,
    a.account_name
FROM global_account_defaults gad
JOIN accounts a ON a.id = gad.account_id
WHERE gad.transaction_key = 'cash_in_bank';

-- USULAN PERBAIKAN (untuk didiskusikan dengan pemilik, BUKAN dijalankan
-- otomatis oleh skrip ini):
--   a. Kalau query #1 menunjukkan transaction_key='cash' mengarah ke akun
--      YANG SAMA dengan akun yang dominan dipakai di query #2 (mis. sama-
--      sama 1-1010): tidak ada masalah nyata, cukup dicatat sebagai
--      "sudah konsisten secara kebetulan", bukan by design.
--   b. Kalau BERBEDA: opsi yang bisa dipilih pemilik —
--      (i)  Ubah baris GlobalAccountDefault transaction_key='cash' supaya
--           mengarah ke akun yang sama dengan yang dipakai Payment nyata
--           (biasanya 1-1010) — perbaikan DATA, bukan kode.
--      (ii) Atau, kalau memang sengaja ada 2 akun kas terpisah (Kas Umum
--           fisik vs Kas di Bank), pastikan 4 tempat kode yang memakai
--           transaction_key='cash' itu MEMANG seharusnya memposting ke Kas
--           Umum (bukan ke Bank) — dalam hal ini tidak perlu diubah apapun,
--           cukup didokumentasikan bahwa pemisahan itu disengaja.
--   Keputusan (i) vs (ii) adalah keputusan bisnis/akuntansi pemilik, bukan
--   sesuatu yang bisa ditebak dari kode saja — karena itu TIDAK diubah di
--   fase ini, sesuai instruksi eksplisit prompt.
