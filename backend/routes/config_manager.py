import os
import json
from functools import wraps
from flask import Blueprint, request, jsonify, render_template, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.user import User
from models.settings import SystemSetting
from models.settings_extended import AuditLog
from sqlalchemy import text
from datetime import datetime
from utils.timezone import get_local_now

config_manager_bp = Blueprint('config_manager', __name__, template_folder='../templates')

_configs_seeded = False

def require_super_admin(f):
    @wraps(f)
    @jwt_required()
    def decorated(*args, **kwargs):
        try:
            user_id = get_jwt_identity()
            user = User.query.get(int(user_id))
            if not user or not user.is_super_admin:
                return jsonify({'success': False, 'message': 'Forbidden: Akses khusus Super Admin'}), 403
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'success': False, 'message': f'Authentication error: {str(e)}'}), 401
    return decorated


def get_project_root():
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ============================================================
# MASTER CONFIG REGISTRY
# All configurable parameters across every module.
# Format: key, category, name, value, type, description
# ============================================================
MASTER_CONFIGS = [

    # ────────────────────────────────────────────────────────
    # GENERAL
    # ────────────────────────────────────────────────────────
    {'key': 'general.system_name',          'category': 'general',      'name': 'System Name',                       'value': 'SMITH ERP',     'type': 'string',  'description': 'Nama aplikasi yang tampil di header dan email.'},
    {'key': 'general.system_version',       'category': 'general',      'name': 'System Version',                    'value': '1.0.0',         'type': 'string',  'description': 'Versi rilis aplikasi (readonly, isi manual saat deploy).'},
    {'key': 'general.company_currency',     'category': 'general',      'name': 'Default Currency',                  'value': 'IDR',           'type': 'string',  'description': 'Kode mata uang default (ISO 4217, misal IDR, USD).'},
    {'key': 'general.timezone',             'category': 'general',      'name': 'Timezone',                          'value': 'Asia/Jakarta',  'type': 'string',  'description': 'Zona waktu server (misal Asia/Jakarta, Asia/Makassar).'},
    {'key': 'general.date_format',          'category': 'general',      'name': 'Date Format',                       'value': 'DD/MM/YYYY',    'type': 'string',  'description': 'Format tampilan tanggal di seluruh aplikasi.'},
    {'key': 'general.language',             'category': 'general',      'name': 'Default Language',                  'value': 'id',            'type': 'string',  'description': 'Kode bahasa default (id = Indonesia, en = English).'},
    {'key': 'general.fiscal_year_start',    'category': 'general',      'name': 'Fiscal Year Start Month',           'value': '1',             'type': 'integer', 'description': 'Bulan awal tahun fiskal (1 = Januari, 4 = April, dst).'},

    # ────────────────────────────────────────────────────────
    # DATABASE
    # ────────────────────────────────────────────────────────
    {'key': 'database.connection_pool_size',   'category': 'database', 'name': 'Connection Pool Size',      'value': '10', 'type': 'integer', 'description': 'Jumlah koneksi database pool yang dibuka secara paralel.'},
    {'key': 'database.connection_timeout',     'category': 'database', 'name': 'Connection Timeout (s)',    'value': '30', 'type': 'integer', 'description': 'Batas waktu koneksi ke database sebelum dianggap gagal (detik).'},
    {'key': 'database.query_timeout',          'category': 'database', 'name': 'Query Timeout (s)',         'value': '60', 'type': 'integer', 'description': 'Batas waktu eksekusi satu query database (detik).'},
    {'key': 'database.backup_retention_days',  'category': 'database', 'name': 'Backup Retention (days)',   'value': '30', 'type': 'integer', 'description': 'Durasi penyimpanan file backup database sebelum dihapus otomatis (hari).'},

    # ────────────────────────────────────────────────────────
    # SECURITY
    # ────────────────────────────────────────────────────────
    {'key': 'security.session_timeout',          'category': 'security', 'name': 'Session Timeout (s)',             'value': '3600', 'type': 'integer', 'description': 'Durasi sesi user aktif sebelum auto-logout (detik). Default: 3600 = 1 jam.'},
    {'key': 'security.password_min_length',      'category': 'security', 'name': 'Min Password Length',             'value': '8',    'type': 'integer', 'description': 'Panjang minimum karakter password user baru.'},
    {'key': 'security.password_require_special', 'category': 'security', 'name': 'Require Special Characters',      'value': 'true', 'type': 'boolean', 'description': 'Wajibkan minimal 1 karakter khusus (!@#$...) pada password.'},
    {'key': 'security.max_login_attempts',       'category': 'security', 'name': 'Max Failed Login Attempts',       'value': '5',    'type': 'integer', 'description': 'Batas percobaan login gagal sebelum akun dikunci sementara.'},
    {'key': 'security.account_lockout_duration', 'category': 'security', 'name': 'Account Lockout Duration (s)',    'value': '900',  'type': 'integer', 'description': 'Durasi akun terkunci setelah melebihi batas login gagal (detik). Default: 900 = 15 menit.'},
    {'key': 'security.jwt_expiry_hours',         'category': 'security', 'name': 'JWT Token Expiry (hours)',        'value': '24',   'type': 'integer', 'description': 'Durasi token JWT sebelum kedaluwarsa (jam).'},

    # ────────────────────────────────────────────────────────
    # PERFORMANCE & CACHE
    # ────────────────────────────────────────────────────────
    {'key': 'performance.cache_enabled',    'category': 'performance', 'name': 'Cache Enabled',          'value': 'true', 'type': 'boolean', 'description': 'Aktifkan Redis cache untuk mempercepat respon API.'},
    {'key': 'performance.cache_timeout',    'category': 'performance', 'name': 'Cache Timeout (s)',      'value': '300',  'type': 'integer', 'description': 'Durasi data tersimpan di cache sebelum diperbarui (detik).'},
    {'key': 'performance.pagination_size',  'category': 'performance', 'name': 'Default Page Size',      'value': '20',   'type': 'integer', 'description': 'Jumlah baris data per halaman di semua tabel dan daftar.'},
    {'key': 'performance.max_file_size_mb', 'category': 'performance', 'name': 'Max Upload File Size (MB)', 'value': '10', 'type': 'integer', 'description': 'Ukuran maksimum file yang dapat diupload ke server (MB).'},

    # ────────────────────────────────────────────────────────
    # LOGGING
    # ────────────────────────────────────────────────────────
    {'key': 'logging.log_level',         'category': 'logging', 'name': 'Log Level',               'value': 'INFO',  'type': 'string',  'description': 'Level log aplikasi: DEBUG, INFO, WARNING, ERROR, CRITICAL.'},
    {'key': 'logging.log_retention_days','category': 'logging', 'name': 'Log Retention (days)',    'value': '90',    'type': 'integer', 'description': 'Durasi penyimpanan file log sistem sebelum dibersihkan (hari).'},
    {'key': 'logging.audit_enabled',     'category': 'logging', 'name': 'Audit Logging Enabled',  'value': 'true',  'type': 'boolean', 'description': 'Aktifkan pencatatan riwayat semua aktivitas user (Audit Trail).'},
    {'key': 'logging.debug_mode',        'category': 'logging', 'name': 'Debug Mode',              'value': 'false', 'type': 'boolean', 'description': 'Tampilkan pesan error detail di response API (hanya untuk dev).'},

    # ────────────────────────────────────────────────────────
    # PRODUKSI (Modul Production)
    # ────────────────────────────────────────────────────────
    {'key': 'production.fallback_dry_weight',      'category': 'production', 'name': 'Fallback Dry Weight/Pack (kg)',    'value': '0.8',  'type': 'float',   'description': 'Berat kering default per pack (kg) jika spesifikasi kemasan tidak ditemukan di database.'},
    {'key': 'production.fallback_liquid_volume',   'category': 'production', 'name': 'Fallback Liquid Volume/Pack (L)',  'value': '0.5',  'type': 'float',   'description': 'Volume cairan default per pack (Liter) jika spesifikasi kemasan tidak ditemukan.'},
    {'key': 'production.fallback_final_weight',    'category': 'production', 'name': 'Fallback Final Weight/Pack (kg)', 'value': '1.2',  'type': 'float',   'description': 'Berat akhir default per pack (kg) jika spesifikasi kemasan tidak ditemukan.'},
    {'key': 'production.shift1_runtime_regular',   'category': 'production', 'name': 'Shift 1 Runtime - Regular (min)', 'value': '510',  'type': 'integer', 'description': 'Waktu produksi efektif Shift 1 hari biasa (Senin–Kamis) dalam menit. Default: 510 = 8.5 jam.'},
    {'key': 'production.shift1_runtime_friday',    'category': 'production', 'name': 'Shift 1 Runtime - Friday (min)',  'value': '540',  'type': 'integer', 'description': 'Waktu produksi efektif Shift 1 hari Jumat dalam menit. Default: 540 = 9 jam.'},
    {'key': 'production.shift2_runtime',           'category': 'production', 'name': 'Shift 2 Runtime (min)',           'value': '480',  'type': 'integer', 'description': 'Waktu produksi efektif Shift 2 dalam menit. Default: 480 = 8 jam.'},
    {'key': 'production.shift3_runtime',           'category': 'production', 'name': 'Shift 3 Runtime (min)',           'value': '450',  'type': 'integer', 'description': 'Waktu produksi efektif Shift 3 dalam menit. Default: 450 = 7.5 jam.'},

    # ────────────────────────────────────────────────────────
    # JOB COSTING (Modul WIP / Production Costing)
    # ────────────────────────────────────────────────────────
    {'key': 'job_costing.labor_rate',            'category': 'job_costing', 'name': 'Direct Labor Rate/Hour (Rp)',          'value': '25000',  'type': 'integer', 'description': 'Tarif biaya upah tenaga kerja langsung per jam (Rupiah). Digunakan saat menghitung labor cost WIP.'},
    {'key': 'job_costing.overhead_rate',         'category': 'job_costing', 'name': 'Machine Overhead Rate/Hour (Rp)',      'value': '50000',  'type': 'integer', 'description': 'Tarif biaya overhead mesin per jam (Rupiah). Digunakan saat menghitung overhead cost WIP.'},
    {'key': 'job_costing.material_cost_per_unit','category': 'job_costing', 'name': 'Fallback Material Cost/Unit (Rp)',     'value': '50000',  'type': 'integer', 'description': 'Estimasi biaya bahan per unit jika tidak ada definisi BOM (Rupiah). Hanya digunakan sebagai fallback.'},

    # ────────────────────────────────────────────────────────
    # HR & PAYROLL (Modul HR Payroll)
    # ────────────────────────────────────────────────────────
    {'key': 'hr.working_hours_divisor',       'category': 'hr', 'name': 'Monthly Working Hours Divisor',     'value': '173',    'type': 'integer', 'description': 'Pembagi jam kerja bulanan untuk hitung tarif per jam. Standar Indonesia = 173 jam/bulan (Kepmenaker).'},
    {'key': 'hr.overtime_multiplier',         'category': 'hr', 'name': 'Overtime Rate Multiplier',          'value': '1.5',    'type': 'float',   'description': 'Pengali tarif lembur terhadap gaji per jam normal. Standar = 1.5x (150%).'},
    {'key': 'hr.bpjs_kesehatan_employee',     'category': 'hr', 'name': 'BPJS Kesehatan - Employee Share (%)', 'value': '1.0',  'type': 'float',   'description': 'Iuran BPJS Kesehatan yang ditanggung karyawan (%). Regulasi saat ini = 1%.'},
    {'key': 'hr.bpjs_kesehatan_max_base',     'category': 'hr', 'name': 'BPJS Kesehatan - Max Salary Base (Rp)', 'value': '12000000', 'type': 'integer', 'description': 'Batas atas gaji sebagai dasar perhitungan iuran BPJS Kesehatan (Rp). Sesuai regulasi saat ini.'},
    {'key': 'hr.bpjs_jht_employee',          'category': 'hr', 'name': 'BPJS JHT - Employee Share (%)',     'value': '2.0',    'type': 'float',   'description': 'Iuran BPJS Ketenagakerjaan (JHT) yang ditanggung karyawan (%). Regulasi = 2%.'},
    {'key': 'hr.bpjs_jht_employer',          'category': 'hr', 'name': 'BPJS JHT - Employer Share (%)',     'value': '3.7',    'type': 'float',   'description': 'Iuran BPJS JHT yang ditanggung perusahaan (%). Regulasi = 3.7%.'},
    {'key': 'hr.bpjs_jp_employee',           'category': 'hr', 'name': 'BPJS JP - Employee Share (%)',      'value': '1.0',    'type': 'float',   'description': 'Iuran BPJS Pensiun yang ditanggung karyawan (%). Regulasi = 1%.'},
    {'key': 'hr.bpjs_jp_employer',           'category': 'hr', 'name': 'BPJS JP - Employer Share (%)',      'value': '2.0',    'type': 'float',   'description': 'Iuran BPJS Pensiun yang ditanggung perusahaan (%). Regulasi = 2%.'},
    {'key': 'hr.annual_leave_days',          'category': 'hr', 'name': 'Annual Leave Entitlement (days)',   'value': '12',     'type': 'integer', 'description': 'Jatah cuti tahunan yang diberikan ke setiap karyawan (hari). Standar UU Ketenagakerjaan = 12 hari.'},
    {'key': 'hr.probation_period_months',    'category': 'hr', 'name': 'Probation Period (months)',         'value': '3',      'type': 'integer', 'description': 'Durasi masa percobaan (probation) karyawan baru (bulan).'},
    {'key': 'hr.pph21_borne_by_company',     'category': 'hr', 'name': 'PPh 21 Borne by Company',          'value': 'true',   'type': 'boolean', 'description': 'Jika true, PPh 21 ditanggung perusahaan dan tidak dipotong dari gaji karyawan.'},

    # ────────────────────────────────────────────────────────
    # ATTENDANCE (Modul Absensi)
    # ────────────────────────────────────────────────────────
    {'key': 'attendance.office_start_time',     'category': 'attendance', 'name': 'Office Start Time',           'value': '08:00', 'type': 'string',  'description': 'Jam masuk kerja standar kantor. Format HH:MM (24 jam).'},
    {'key': 'attendance.office_end_time',       'category': 'attendance', 'name': 'Office End Time',             'value': '17:00', 'type': 'string',  'description': 'Jam pulang kerja standar kantor. Format HH:MM (24 jam).'},
    {'key': 'attendance.late_tolerance_minutes','category': 'attendance', 'name': 'Late Tolerance (minutes)',    'value': '30',    'type': 'integer', 'description': 'Toleransi keterlambatan masuk sebelum dihitung terlambat (menit). Default = 30 menit.'},
    {'key': 'attendance.check_in_window_hours', 'category': 'attendance', 'name': 'Check-in Window (hours)',     'value': '2',     'type': 'integer', 'description': 'Rentang waktu sebelum jam masuk di mana absen check-in masih diperbolehkan (jam).'},
    {'key': 'attendance.face_recognition_required', 'category': 'attendance', 'name': 'Face Recognition Required', 'value': 'true', 'type': 'boolean', 'description': 'Wajibkan face recognition untuk absensi masuk dan pulang.'},
    {'key': 'attendance.work_days_per_week',    'category': 'attendance', 'name': 'Working Days Per Week',       'value': '5',     'type': 'integer', 'description': 'Jumlah hari kerja dalam seminggu (5 = Senin–Jumat, 6 = termasuk Sabtu).'},

    # ────────────────────────────────────────────────────────
    # WAREHOUSE & INVENTORY (Modul Gudang)
    # ────────────────────────────────────────────────────────
    {'key': 'warehouse.low_stock_multiplier',    'category': 'warehouse', 'name': 'Low Stock Threshold Multiplier', 'value': '1.0',  'type': 'float',   'description': 'Pengali dari minimum_stock untuk menentukan batas warning "stok rendah". 1.0 = tepat di minimum, 1.2 = 20% di atas minimum.'},
    {'key': 'warehouse.fifo_enabled',            'category': 'warehouse', 'name': 'FIFO Method Enabled',            'value': 'true', 'type': 'boolean', 'description': 'Aktifkan metode FIFO (First In First Out) untuk pengeluaran stok gudang.'},
    {'key': 'warehouse.auto_reorder_enabled',    'category': 'warehouse', 'name': 'Auto Reorder Enabled',           'value': 'false','type': 'boolean', 'description': 'Aktifkan pembuatan Purchase Request otomatis ketika stok mencapai reorder point.'},
    {'key': 'warehouse.default_lead_time_days',  'category': 'warehouse', 'name': 'Default Lead Time (days)',       'value': '7',    'type': 'integer', 'description': 'Estimasi waktu pengiriman material dari supplier (hari) jika tidak didefinisikan per-material.'},
    {'key': 'warehouse.stock_opname_frequency',  'category': 'warehouse', 'name': 'Stock Opname Frequency (days)', 'value': '90',   'type': 'integer', 'description': 'Frekuensi pengecekan stok opname yang disarankan (hari). Default = tiap 90 hari.'},

    # ────────────────────────────────────────────────────────
    # PURCHASING (Modul Pembelian)
    # ────────────────────────────────────────────────────────
    {'key': 'purchasing.po_approval_limit',         'category': 'purchasing', 'name': 'PO Auto-Approve Limit (Rp)',     'value': '5000000',  'type': 'integer', 'description': 'Nilai Purchase Order di bawah batas ini disetujui otomatis tanpa approval manual (Rupiah).'},
    {'key': 'purchasing.po_validity_days',          'category': 'purchasing', 'name': 'PO Validity Period (days)',      'value': '30',       'type': 'integer', 'description': 'Masa berlaku Purchase Order setelah diterbitkan sebelum dinyatakan kedaluwarsa (hari).'},
    {'key': 'purchasing.default_payment_terms_days','category': 'purchasing', 'name': 'Default Payment Terms (days)',   'value': '30',       'type': 'integer', 'description': 'Jangka waktu pembayaran default ke supplier jika tidak didefinisikan di kontrak (hari).'},
    {'key': 'purchasing.pr_auto_approve_limit',     'category': 'purchasing', 'name': 'PR Auto-Approve Limit (Rp)',     'value': '1000000',  'type': 'integer', 'description': 'Nilai Purchase Request di bawah batas ini disetujui otomatis (Rupiah).'},
    {'key': 'purchasing.max_vendor_quote_days',     'category': 'purchasing', 'name': 'Max Vendor Quote Wait (days)',   'value': '7',        'type': 'integer', 'description': 'Waktu maksimum menunggu penawaran harga dari vendor sebelum eskalasi (hari).'},

    # ────────────────────────────────────────────────────────
    # SALES (Modul Penjualan)
    # ────────────────────────────────────────────────────────
    {'key': 'sales.so_approval_limit',          'category': 'sales', 'name': 'SO Auto-Approve Limit (Rp)',    'value': '10000000', 'type': 'integer', 'description': 'Nilai Sales Order di bawah ini disetujui otomatis tanpa approval (Rupiah).'},
    {'key': 'sales.default_payment_terms_days', 'category': 'sales', 'name': 'Default Payment Terms (days)', 'value': '30',       'type': 'integer', 'description': 'Jangka waktu pembayaran default dari customer (hari).'},
    {'key': 'sales.so_validity_days',           'category': 'sales', 'name': 'Quotation Validity (days)',     'value': '14',       'type': 'integer', 'description': 'Masa berlaku penawaran harga/quotation ke customer (hari).'},
    {'key': 'sales.credit_check_enabled',       'category': 'sales', 'name': 'Credit Check Enabled',         'value': 'true',     'type': 'boolean', 'description': 'Aktifkan pengecekan batas kredit customer sebelum SO dikonfirmasi.'},
    {'key': 'sales.min_margin_percent',         'category': 'sales', 'name': 'Minimum Sales Margin (%)',      'value': '10',       'type': 'float',   'description': 'Batas minimum margin keuntungan penjualan (%). SO di bawah ini memerlukan approval khusus.'},

    # ────────────────────────────────────────────────────────
    # QUALITY CONTROL (Modul QC)
    # ────────────────────────────────────────────────────────
    {'key': 'quality.accept_rate_threshold',     'category': 'quality', 'name': 'Min Acceptance Rate (%)',       'value': '95.0',  'type': 'float',   'description': 'Persentase minimum produk yang harus lolos QC agar batch diterima (%).'},
    {'key': 'quality.reject_rate_alert',         'category': 'quality', 'name': 'Reject Rate Alert Threshold (%)','value': '5.0',  'type': 'float',   'description': 'Persentase reject yang memicu alert/notifikasi ke supervisor QC (%).'},
    {'key': 'quality.spc_warning_sigma',         'category': 'quality', 'name': 'SPC Warning Sigma Level',       'value': '2.0',   'type': 'float',   'description': 'Level sigma peringatan pada grafik kontrol SPC (biasanya 2σ = warning, 3σ = control limit).'},
    {'key': 'quality.spc_control_sigma',         'category': 'quality', 'name': 'SPC Control Limit Sigma',       'value': '3.0',   'type': 'float',   'description': 'Batas kontrol sigma pada grafik SPC. Titik di luar batas ini dianggap out-of-control.'},
    {'key': 'quality.inspection_sample_percent', 'category': 'quality', 'name': 'Inspection Sample Rate (%)',    'value': '10',    'type': 'float',   'description': 'Persentase unit yang diambil sebagai sampel inspeksi dari total produksi per batch (%).'},
    {'key': 'quality.auto_hold_on_fail',         'category': 'quality', 'name': 'Auto Hold Batch on QC Fail',    'value': 'true',  'type': 'boolean', 'description': 'Tahan batch secara otomatis jika hasil QC gagal memenuhi kriteria acceptance rate.'},
    {'key': 'quality.calibration_alert_days',    'category': 'quality', 'name': 'Calibration Alert (days before)', 'value': '30', 'type': 'integer', 'description': 'Kirim alert kalibrasi alat ukur berapa hari sebelum jadwal kalibrasi jatuh tempo.'},

    # ────────────────────────────────────────────────────────
    # OEE (Overall Equipment Effectiveness)
    # ────────────────────────────────────────────────────────
    {'key': 'oee.world_class_target',     'category': 'oee', 'name': 'World Class OEE Target (%)',      'value': '85.0',  'type': 'float',   'description': 'Target OEE kelas dunia (world class). Umumnya = 85%. Digunakan sebagai garis referensi di dashboard.'},
    {'key': 'oee.warning_threshold',      'category': 'oee', 'name': 'OEE Warning Threshold (%)',       'value': '70.0',  'type': 'float',   'description': 'Nilai OEE di bawah ini memunculkan status warning (kuning) pada dashboard mesin.'},
    {'key': 'oee.critical_threshold',     'category': 'oee', 'name': 'OEE Critical Threshold (%)',      'value': '60.0',  'type': 'float',   'description': 'Nilai OEE di bawah ini memunculkan status critical (merah) dan notifikasi ke supervisor produksi.'},
    {'key': 'oee.availability_target',    'category': 'oee', 'name': 'Availability Target (%)',         'value': '90.0',  'type': 'float',   'description': 'Target availability (ketersediaan mesin) yang ingin dicapai (%). Komponen pertama OEE.'},
    {'key': 'oee.performance_target',     'category': 'oee', 'name': 'Performance Target (%)',          'value': '95.0',  'type': 'float',   'description': 'Target performance (kecepatan produksi vs ideal) yang ingin dicapai (%). Komponen kedua OEE.'},
    {'key': 'oee.quality_target',         'category': 'oee', 'name': 'Quality Rate Target (%)',         'value': '99.5',  'type': 'float',   'description': 'Target quality rate (produk good vs total produksi) yang ingin dicapai (%). Komponen ketiga OEE.'},

    # ────────────────────────────────────────────────────────
    # MAINTENANCE (Modul Pemeliharaan Mesin)
    # ────────────────────────────────────────────────────────
    {'key': 'maintenance.pm_alert_days_before',  'category': 'maintenance', 'name': 'PM Alert Lead Time (days)',     'value': '7',    'type': 'integer', 'description': 'Kirim notifikasi Preventive Maintenance berapa hari sebelum jadwal jatuh tempo.'},
    {'key': 'maintenance.overdue_escalation_days','category': 'maintenance', 'name': 'Overdue Escalation (days)',    'value': '3',    'type': 'integer', 'description': 'Eskalasi WO Maintenance yang terlambat ke manajer setelah berapa hari melewati deadline.'},
    {'key': 'maintenance.mttr_target_hours',      'category': 'maintenance', 'name': 'MTTR Target (hours)',          'value': '4',    'type': 'float',   'description': 'Target Mean Time To Repair mesin (jam). Perbaikan di atas nilai ini dianggap terlalu lama.'},
    {'key': 'maintenance.mtbf_target_hours',      'category': 'maintenance', 'name': 'MTBF Target (hours)',          'value': '720',  'type': 'float',   'description': 'Target Mean Time Between Failures mesin (jam). Default 720 = 30 hari.'},
    {'key': 'maintenance.auto_create_wo',         'category': 'maintenance', 'name': 'Auto Create WO from Schedule', 'value': 'true', 'type': 'boolean', 'description': 'Buat Work Order maintenance otomatis berdasarkan jadwal PM yang terdaftar.'},

    # ────────────────────────────────────────────────────────
    # DCC — Document Control & Compliance
    # ────────────────────────────────────────────────────────
    {'key': 'dcc.expiry_alert_days',    'category': 'dcc', 'name': 'Document Expiry Alert (days before)', 'value': '120', 'type': 'integer', 'description': 'Tampilkan dokumen dalam daftar "akan kedaluwarsa" berapa hari sebelum tanggal expired. Default = 120 hari.'},
    {'key': 'dcc.review_cycle_days',   'category': 'dcc', 'name': 'Default Review Cycle (days)',          'value': '365', 'type': 'integer', 'description': 'Siklus review dokumen default jika tidak ditentukan per-dokumen (hari). Default = 1 tahun.'},
    {'key': 'dcc.require_approval',    'category': 'dcc', 'name': 'Require Approval for New Revision',    'value': 'true','type': 'boolean', 'description': 'Setiap revisi dokumen baru memerlukan approval dari Document Controller sebelum efektif.'},

    # ────────────────────────────────────────────────────────
    # FINANCE & ACCOUNTING
    # ────────────────────────────────────────────────────────
    {'key': 'finance.default_tax_rate',        'category': 'finance', 'name': 'Default Tax Rate - PPN (%)',     'value': '11',     'type': 'float',   'description': 'Tarif PPN (Pajak Pertambahan Nilai) default yang digunakan dalam invoice penjualan dan pembelian (%).'},
    {'key': 'finance.invoice_due_days',        'category': 'finance', 'name': 'Default Invoice Due (days)',     'value': '30',     'type': 'integer', 'description': 'Jangka waktu default jatuh tempo pembayaran invoice (hari sejak tanggal invoice).'},
    {'key': 'finance.early_payment_discount',  'category': 'finance', 'name': 'Early Payment Discount (%)',     'value': '2',      'type': 'float',   'description': 'Diskon yang diberikan ke customer jika membayar lebih awal dari jatuh tempo (%).'},
    {'key': 'finance.late_payment_penalty',    'category': 'finance', 'name': 'Late Payment Penalty (%/month)','value': '1.5',    'type': 'float',   'description': 'Denda keterlambatan pembayaran per bulan dari nilai invoice yang belum dibayar (%).'},
    {'key': 'finance.petty_cash_limit',        'category': 'finance', 'name': 'Petty Cash Limit (Rp)',          'value': '5000000','type': 'integer', 'description': 'Batas maksimum kas kecil (petty cash) yang boleh dicairkan tanpa approval direktur (Rupiah).'},
    {'key': 'finance.currency_rounding',       'category': 'finance', 'name': 'Currency Rounding (digits)',     'value': '0',      'type': 'integer', 'description': 'Jumlah digit di belakang koma untuk pembulatan nilai mata uang. 0 = bulat ke rupiah terdekat.'},

    # ────────────────────────────────────────────────────────
    # MRP (Material Requirements Planning)
    # ────────────────────────────────────────────────────────
    {'key': 'mrp.planning_horizon_days',    'category': 'mrp', 'name': 'Planning Horizon (days)',          'value': '30',   'type': 'integer', 'description': 'Rentang waktu ke depan yang dicakup dalam perhitungan MRP (hari).'},
    {'key': 'mrp.safety_stock_days',        'category': 'mrp', 'name': 'Safety Stock Coverage (days)',     'value': '7',    'type': 'integer', 'description': 'Jumlah hari konsumsi yang harus selalu tersedia sebagai safety stock.'},
    {'key': 'mrp.auto_generate_pr',         'category': 'mrp', 'name': 'Auto Generate Purchase Request',  'value': 'false','type': 'boolean', 'description': 'Otomatis buat Purchase Request dari hasil kalkulasi MRP tanpa konfirmasi manual.'},
    {'key': 'mrp.batch_size_rounding',      'category': 'mrp', 'name': 'Batch Size Rounding',             'value': 'true', 'type': 'boolean', 'description': 'Bulatkan kuantitas order MRP sesuai minimum order quantity (MOQ) supplier.'},

    # ────────────────────────────────────────────────────────
    # R&D (Modul Research & Development)
    # ────────────────────────────────────────────────────────
    {'key': 'rd.trial_approval_required',   'category': 'rd', 'name': 'Trial Approval Required',          'value': 'true', 'type': 'boolean', 'description': 'Percobaan R&D baru memerlukan approval manajer R&D sebelum dapat dieksekusi di lini produksi.'},
    {'key': 'rd.min_trial_batches',         'category': 'rd', 'name': 'Minimum Trial Batches',            'value': '3',    'type': 'integer', 'description': 'Jumlah minimum percobaan batch yang harus berhasil sebelum formula divalidasi untuk produksi massal.'},
    {'key': 'rd.formula_validity_days',     'category': 'rd', 'name': 'Formula Validity Period (days)',   'value': '365',  'type': 'integer', 'description': 'Masa berlaku formula yang sudah divalidasi sebelum perlu review ulang (hari).'},

    # ────────────────────────────────────────────────────────
    # SHIPPING & DELIVERY
    # ────────────────────────────────────────────────────────
    {'key': 'shipping.default_carrier',         'category': 'shipping', 'name': 'Default Carrier',              'value': '',     'type': 'string',  'description': 'Nama carrier/jasa pengiriman default jika tidak dipilih per-order.'},
    {'key': 'shipping.delivery_lead_time_days', 'category': 'shipping', 'name': 'Delivery Lead Time (days)',    'value': '3',    'type': 'integer', 'description': 'Estimasi waktu pengiriman default ke customer (hari kerja).'},
    {'key': 'shipping.auto_confirm_delivery',   'category': 'shipping', 'name': 'Auto Confirm Delivery',       'value': 'false','type': 'boolean', 'description': 'Konfirmasi pengiriman otomatis ketika ekspedisi melaporkan status diterima.'},

    # ────────────────────────────────────────────────────────
    # CONVERTING (Modul Konversi Produk)
    # ────────────────────────────────────────────────────────
    {'key': 'converting.min_grade_a_percent',  'category': 'converting', 'name': 'Min Grade A Output (%)',       'value': '80',   'type': 'float',   'description': 'Persentase minimum output Grade A dari proses converting. Jika di bawah ini, proses dievaluasi ulang (%).'},
    {'key': 'converting.max_loss_percent',     'category': 'converting', 'name': 'Max Acceptable Loss (%)',      'value': '5',    'type': 'float',   'description': 'Batas maksimum losses yang diperbolehkan dalam proses converting (%). Loss di atas ini memerlukan laporan khusus.'},

    # ────────────────────────────────────────────────────────
    # NOTIFICATIONS & EMAIL
    # ────────────────────────────────────────────────────────
    {'key': 'notifications.email_enabled',       'category': 'notifications', 'name': 'Email Notifications Enabled', 'value': 'true',  'type': 'boolean', 'description': 'Aktifkan pengiriman notifikasi melalui email.'},
    {'key': 'notifications.push_enabled',        'category': 'notifications', 'name': 'Push Notifications Enabled',  'value': 'true',  'type': 'boolean', 'description': 'Aktifkan notifikasi push di dalam aplikasi (in-app notifications).'},
    {'key': 'notifications.digest_frequency',    'category': 'notifications', 'name': 'Email Digest Frequency',      'value': 'daily', 'type': 'string',  'description': 'Frekuensi pengiriman email rangkuman: realtime, daily, atau weekly.'},
    {'key': 'notifications.low_stock_email',     'category': 'notifications', 'name': 'Low Stock Email Alert',       'value': 'true',  'type': 'boolean', 'description': 'Kirim email alert ketika ada material/produk yang mencapai batas stok rendah.'},
    {'key': 'notifications.production_summary',  'category': 'notifications', 'name': 'Daily Production Summary Email','value': 'true', 'type': 'boolean', 'description': 'Kirim email ringkasan produksi harian ke supervisor dan manajer produksi.'},

    # ────────────────────────────────────────────────────────
    # FINANCE — Dashboard Estimation Ratios
    # Digunakan sebagai fallback saat data akuntansi nyata belum ada.
    # ────────────────────────────────────────────────────────
    {'key': 'finance.default_tax_rate',          'category': 'finance', 'name': 'Default PPN Rate (%)',            'value': '11',    'type': 'float',   'description': 'Tarif PPN yang digunakan dalam invoice penjualan dan pembelian (%).'},
    {'key': 'finance.invoice_due_days',          'category': 'finance', 'name': 'Default Invoice Due (days)',      'value': '30',    'type': 'integer', 'description': 'Jangka waktu jatuh tempo pembayaran invoice (hari sejak tanggal invoice).'},
    {'key': 'finance.early_payment_discount',    'category': 'finance', 'name': 'Early Payment Discount (%)',      'value': '2',     'type': 'float',   'description': 'Diskon yang diberikan ke customer jika membayar lebih awal dari jatuh tempo (%).'},
    {'key': 'finance.late_payment_penalty',      'category': 'finance', 'name': 'Late Payment Penalty (%/month)', 'value': '1.5',   'type': 'float',   'description': 'Denda keterlambatan pembayaran per bulan dari nilai invoice yang belum dibayar (%).'},
    {'key': 'finance.petty_cash_limit',          'category': 'finance', 'name': 'Petty Cash Limit (Rp)',           'value': '5000000','type':'integer',  'description': 'Batas maksimum kas kecil yang boleh dicairkan tanpa approval direktur (Rupiah).'},
    {'key': 'finance.fallback_expense_ratio',    'category': 'finance', 'name': 'Fallback Expense Ratio (%)',      'value': '77',    'type': 'float',   'description': '[Dashboard Fallback] Persentase biaya dari total pendapatan saat data aktual tidak tersedia (%). Default = 77%.'},
    {'key': 'finance.fallback_cogs_ratio',       'category': 'finance', 'name': 'Fallback COGS Ratio (% of expenses)', 'value': '60', 'type': 'float', 'description': '[Dashboard Fallback] Persentase HPP dari total biaya saat tidak ada data nyata (%). Default = 60%.'},
    {'key': 'finance.fallback_opex_ratio',       'category': 'finance', 'name': 'Fallback OpEx Ratio (% of expenses)', 'value': '35', 'type': 'float', 'description': '[Dashboard Fallback] Persentase biaya operasional dari total biaya (%). Default = 35%.'},
    {'key': 'finance.assumed_monthly_growth',    'category': 'finance', 'name': 'Assumed Monthly Revenue Growth (%)','value': '8',  'type': 'float',   'description': '[Dashboard Fallback] Asumsi pertumbuhan pendapatan bulanan untuk proyeksi (%). Default = 8%.'},
    {'key': 'finance.kpi_expense_ratio',         'category': 'finance', 'name': 'KPI Expense Ratio (%)',           'value': '76',    'type': 'float',   'description': '[Dashboard KPI] Estimasi persentase biaya dari pendapatan untuk card KPI ringkasan (%).'},
    {'key': 'finance.kpi_profit_ratio',          'category': 'finance', 'name': 'KPI Profit Ratio (%)',            'value': '24',    'type': 'float',   'description': '[Dashboard KPI] Estimasi persentase margin keuntungan dari pendapatan untuk card KPI (%).'},
    {'key': 'finance.cash_conversion_cycle_days','category': 'finance', 'name': 'Cash Conversion Cycle (days)',   'value': '45',    'type': 'integer', 'description': '[Dashboard KPI] Estimasi siklus konversi kas (hari). Digunakan saat data AR/AP/Inventory tidak lengkap.'},
    {'key': 'finance.forecast_cash_out_ratio',   'category': 'finance', 'name': 'Forecast Cash Out Ratio (%)',    'value': '85',    'type': 'float',   'description': '[Cash Flow Forecast] Persentase arus kas keluar dari arus kas masuk dalam proyeksi mingguan (%).'},

    # ────────────────────────────────────────────────────────
    # FINANCE — Expense Breakdown (Dashboard Stacked Chart Fallback)
    # ────────────────────────────────────────────────────────
    {'key': 'finance.expense_pct_raw_materials', 'category': 'finance', 'name': 'Expense Breakdown: Raw Materials (%)', 'value': '36.8', 'type': 'float', 'description': '[Chart Fallback] Porsi bahan baku dalam breakdown biaya total untuk grafik dashboard (%).'},
    {'key': 'finance.expense_pct_labor',         'category': 'finance', 'name': 'Expense Breakdown: Labor (%)',         'value': '29.5', 'type': 'float', 'description': '[Chart Fallback] Porsi biaya tenaga kerja dalam breakdown biaya total (%).'},
    {'key': 'finance.expense_pct_manufacturing', 'category': 'finance', 'name': 'Expense Breakdown: Manufacturing (%)', 'value': '15.8', 'type': 'float', 'description': '[Chart Fallback] Porsi overhead manufacturing dalam breakdown biaya total (%).'},
    {'key': 'finance.expense_pct_marketing',     'category': 'finance', 'name': 'Expense Breakdown: Marketing (%)',     'value': '8.9',  'type': 'float', 'description': '[Chart Fallback] Porsi biaya pemasaran dalam breakdown biaya total (%).'},
    {'key': 'finance.expense_pct_admin',         'category': 'finance', 'name': 'Expense Breakdown: Admin (%)',         'value': '5.5',  'type': 'float', 'description': '[Chart Fallback] Porsi biaya administrasi dalam breakdown biaya total (%).'},
    {'key': 'finance.expense_pct_other',         'category': 'finance', 'name': 'Expense Breakdown: Other (%)',         'value': '3.5',  'type': 'float', 'description': '[Chart Fallback] Porsi biaya lain-lain dalam breakdown biaya total (%).'},

    # ────────────────────────────────────────────────────────
    # MRP — Demand Scenario Multipliers
    # ────────────────────────────────────────────────────────
    {'key': 'mrp.planning_horizon_days',         'category': 'mrp', 'name': 'Default Planning Horizon (days)',     'value': '30',  'type': 'integer', 'description': 'Rentang waktu ke depan yang dicakup dalam kalkulasi MRP (hari).'},
    {'key': 'mrp.safety_stock_days',             'category': 'mrp', 'name': 'Safety Stock Coverage (days)',        'value': '7',   'type': 'integer', 'description': 'Jumlah hari konsumsi yang wajib tersedia sebagai safety stock minimum.'},
    {'key': 'mrp.conservative_demand_multiplier','category': 'mrp', 'name': 'Conservative Scenario Multiplier',   'value': '1.1', 'type': 'float',   'description': 'Pengali permintaan untuk skenario konservatif MRP (+10% buffer dari baseline).'},
    {'key': 'mrp.high_demand_multiplier',        'category': 'mrp', 'name': 'High Demand Scenario Multiplier',    'value': '1.25','type': 'float',   'description': 'Pengali permintaan untuk skenario high demand MRP (+25% dari baseline).'},
    {'key': 'mrp.low_demand_multiplier',         'category': 'mrp', 'name': 'Low Demand Scenario Multiplier',     'value': '0.8', 'type': 'float',   'description': 'Pengali permintaan untuk skenario low demand MRP (-20% dari baseline).'},
    {'key': 'mrp.demand_trend_threshold_pct',    'category': 'mrp', 'name': 'Demand Trend Threshold (%)',         'value': '5',   'type': 'float',   'description': 'Variasi permintaan minimal (%) yang memicu perubahan label tren menjadi "naik" atau "turun".'},
    {'key': 'mrp.bottleneck_utilization_pct',    'category': 'mrp', 'name': 'Bottleneck Utilization Threshold (%)','value': '95', 'type': 'float',   'description': 'Persentase utilisasi mesin di atas nilai ini dianggap sebagai bottleneck kapasitas (%).'},
    {'key': 'mrp.planned_utilization_pct',       'category': 'mrp', 'name': 'Default Planned Utilization (%)',    'value': '70',  'type': 'float',   'description': 'Persentase utilisasi kapasitas mesin yang direncanakan (default 70%). Digunakan di kalkulasi kapasitas.'},
    {'key': 'mrp.auto_generate_pr',             'category': 'mrp', 'name': 'Auto Generate Purchase Request',     'value': 'false','type':'boolean',  'description': 'Otomatis buat Purchase Request dari hasil kalkulasi MRP tanpa konfirmasi manual.'},

    # ────────────────────────────────────────────────────────
    # MAINTENANCE — Estimation Heuristics
    # ────────────────────────────────────────────────────────
    {'key': 'maintenance.pm_alert_days_before',     'category': 'maintenance', 'name': 'PM Alert Lead Time (days)',         'value': '7',   'type': 'integer', 'description': 'Kirim notifikasi Preventive Maintenance berapa hari sebelum jadwal jatuh tempo.'},
    {'key': 'maintenance.overdue_escalation_days',  'category': 'maintenance', 'name': 'Overdue Escalation (days)',         'value': '3',   'type': 'integer', 'description': 'Eskalasi WO Maintenance yang terlambat ke manajer setelah berapa hari melewati deadline.'},
    {'key': 'maintenance.default_mtbf_hours',       'category': 'maintenance', 'name': 'Default MTBF (hours)',              'value': '168', 'type': 'float',   'description': 'Nilai MTBF (Mean Time Between Failures) default per mesin jika belum ada data historis (jam). Default = 168 jam = 1 minggu.'},
    {'key': 'maintenance.default_duration_hours',   'category': 'maintenance', 'name': 'Default Maintenance Duration (hours)','value': '4', 'type': 'float',   'description': 'Estimasi durasi perbaikan default jika tidak didefinisikan di WO maintenance (jam).'},
    {'key': 'maintenance.uptime_reduction_per_wo',  'category': 'maintenance', 'name': 'Uptime Reduction per WO (%)',       'value': '2.0', 'type': 'float',   'description': 'Persentase pengurangan uptime mesin per 1 Work Order maintenance yang tercatat. Digunakan untuk estimasi dashboard.'},
    {'key': 'maintenance.auto_create_wo',           'category': 'maintenance', 'name': 'Auto Create WO from PM Schedule',  'value': 'true','type': 'boolean', 'description': 'Buat Work Order maintenance otomatis dari jadwal Preventive Maintenance yang sudah diatur.'},
    {'key': 'maintenance.spare_parts_location_id',  'category': 'maintenance', 'name': 'Spare Parts Inventory Location ID', 'value': '2',  'type': 'integer', 'description': 'ID lokasi gudang yang digunakan untuk pengambilan spare parts saat eksekusi WO maintenance.'},

    # ────────────────────────────────────────────────────────
    # CONVERTING — Machine Defaults
    # ────────────────────────────────────────────────────────
    {'key': 'converting.default_target_efficiency', 'category': 'converting', 'name': 'Default Machine Efficiency Target (%)', 'value': '60', 'type': 'float',   'description': 'Target efisiensi mesin converting default yang digunakan saat mesin baru dibuat (%).'},
    {'key': 'converting.min_grade_a_percent',       'category': 'converting', 'name': 'Min Grade A Output (%)',                'value': '80', 'type': 'float',   'description': 'Persentase minimum output Grade A yang harus dicapai per proses converting (%).'},
    {'key': 'converting.max_loss_percent',          'category': 'converting', 'name': 'Max Acceptable Loss (%)',               'value': '5',  'type': 'float',   'description': 'Batas maksimum losses yang diperbolehkan dalam proses converting (%). Melebihi ini memerlukan laporan khusus.'},

    # ────────────────────────────────────────────────────────
    # DCC — Document Control
    # ────────────────────────────────────────────────────────
    {'key': 'dcc.expiry_alert_days',    'category': 'dcc', 'name': 'Document Expiry Alert Lead Time (days)', 'value': '120', 'type': 'integer', 'description': 'Tampilkan dokumen dalam list "akan kadaluwarsa" berapa hari sebelum expired. Default = 120 hari.'},
    {'key': 'dcc.review_cycle_days',   'category': 'dcc', 'name': 'Default Document Review Cycle (days)',   'value': '365', 'type': 'integer', 'description': 'Siklus review ulang dokumen jika tidak ditentukan per-dokumen (hari). Default = 1 tahun.'},
    {'key': 'dcc.require_approval',    'category': 'dcc', 'name': 'Require Approval for New Revision',      'value': 'true','type': 'boolean', 'description': 'Setiap revisi dokumen baru memerlukan approval Document Controller sebelum dapat digunakan.'},
]



VALIDATION_RULES = {
    'security.session_timeout': {'min': 60, 'max': 86400},
    'security.password_min_length': {'min': 4, 'max': 32},
    'security.max_login_attempts': {'min': 1, 'max': 20},
    'security.account_lockout_duration': {'min': 30, 'max': 86400},
    'security.jwt_expiry_hours': {'min': 1, 'max': 168},
    'logging.log_level': {'allowed_values': ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']},
    'hr.working_hours_divisor': {'min': 100, 'max': 300},
    'hr.overtime_multiplier': {'min': 1.0, 'max': 5.0},
    'hr.bpjs_kesehatan_employee': {'min': 0.0, 'max': 5.0},
    'hr.bpjs_kesehatan_max_base': {'min': 1000000, 'max': 50000000},
    'hr.bpjs_jht_employee': {'min': 0.0, 'max': 10.0},
    'attendance.late_tolerance_minutes': {'min': 0, 'max': 180},
    'quality.accept_rate_threshold': {'min': 50.0, 'max': 100.0},
    'converting.min_grade_a_percent': {'min': 50.0, 'max': 100.0},
    'converting.max_loss_percent': {'min': 0.0, 'max': 50.0},
    'finance.default_tax_rate': {'min': 0.0, 'max': 50.0},
    'finance.fallback_expense_ratio': {'min': 0.0, 'max': 100.0},
    'finance.fallback_cogs_ratio': {'min': 0.0, 'max': 100.0},
    'finance.fallback_opex_ratio': {'min': 0.0, 'max': 100.0},
}

def validate_config_value(key, val, data_type):
    """Validate config values based on pre-defined validation rules"""
    rules = VALIDATION_RULES.get(key)
    if not rules:
        return True, ""
    
    try:
        if data_type == 'integer':
            typed_val = int(val)
        elif data_type == 'float':
            typed_val = float(val)
        elif data_type == 'boolean':
            if str(val).lower() not in ['true', 'false', '1', '0', 'yes', 'no']:
                return False, f"Nilai '{val}' bukan boolean yang valid."
            return True, ""
        else:
            typed_val = str(val)
    except ValueError:
        return False, f"Nilai '{val}' tidak sesuai dengan tipe data '{data_type}'."

    if 'allowed_values' in rules and typed_val not in rules['allowed_values']:
        allowed_str = ", ".join(map(str, rules['allowed_values']))
        return False, f"Nilai harus salah satu dari: {allowed_str}."

    if 'min' in rules and typed_val < rules['min']:
        return False, f"Nilai tidak boleh kurang dari {rules['min']}."

    if 'max' in rules and typed_val > rules['max']:
        return False, f"Nilai tidak boleh lebih dari {rules['max']}."

    return True, ""


def seed_default_configs():
    """Seed all default configuration settings if they do not exist"""
    global _configs_seeded
    if _configs_seeded:
        return
    try:
        inserted = 0
        for ds in MASTER_CONFIGS:
            setting = SystemSetting.query.filter_by(setting_key=ds['key']).first()
            if not setting:
                new_setting = SystemSetting(
                    setting_key=ds['key'],
                    setting_category=ds['category'],
                    setting_name=ds['name'],
                    setting_value=ds['value'],
                    data_type=ds['type'],
                    description=ds['description'],
                    is_editable=True
                )
                db.session.add(new_setting)
                inserted += 1
        db.session.commit()
        _configs_seeded = True
        if inserted > 0:
            print(f"✓ Seeded {inserted} new configuration settings.")
    except Exception as e:
        db.session.rollback()
        print(f"Error seeding default configurations: {e}")

@config_manager_bp.route('/')
def index():
    """Serve the configuration manager GUI"""
    template_path = os.path.join(get_project_root(), 'templates', 'config_manager.html')
    if os.path.exists(template_path):
        return send_file(template_path)
    return render_template('config_manager.html')

@config_manager_bp.route('/api/configs', methods=['GET'])
@require_super_admin
def get_configs():
    """Retrieve all editable system configurations"""
    try:
        seed_default_configs()
        settings = SystemSetting.query.order_by(SystemSetting.setting_category, SystemSetting.setting_key).all()

        result = []
        for s in settings:
            result.append({
                'id': s.id,
                'key': s.setting_key,
                'category': s.setting_category,
                'name': s.setting_name or s.setting_key.split('.')[-1].replace('_', ' ').title(),
                'value': s.setting_value,
                'type': s.data_type or 'string',
                'description': s.description or '',
                'is_editable': s.is_editable
            })

        return jsonify({
            'success': True,
            'configs': result,
            'total': len(result)
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@config_manager_bp.route('/api/configs', methods=['POST', 'PUT'])
@require_super_admin
def update_configs():
    """Update configuration values with validation and audit logging"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        updates = data.get('updates', [])

        if not updates and isinstance(data, dict):
            updates = [{'key': k, 'value': str(v)} for k, v in data.items() if k != 'updates']

        # 1. First Pass: Validate all updates
        validated_items = []
        for item in updates:
            key = item.get('key')
            val = item.get('value')

            setting = SystemSetting.query.filter_by(setting_key=key).first()
            if not setting or not setting.is_editable:
                continue

            # Format/clean value for validation
            if setting.data_type == 'boolean':
                val_str = 'true' if str(val).lower() in ['true', '1', 'yes', 'checked'] else 'false'
            else:
                val_str = str(val).strip()

            is_valid, err_msg = validate_config_value(key, val_str, setting.data_type or 'string')
            if not is_valid:
                return jsonify({'success': False, 'message': f'Validasi gagal pada {setting.setting_name or key}: {err_msg}'}), 400

            validated_items.append((setting, val_str))

        # 2. Second Pass: Apply changes and create Audit Logs
        updated_count = 0
        for setting, new_val in validated_items:
            old_val = setting.setting_value
            if old_val == new_val:
                continue

            setting.setting_value = new_val
            setting.updated_at = get_local_now()
            updated_count += 1

            # Log this change to the Audit Log table
            log_entry = AuditLog(
                user_id=int(user_id),
                action='update',
                resource_type='system_setting',
                resource_id=str(setting.id),
                resource_name=setting.setting_key,
                old_values=json.dumps({'value': old_val}),
                new_values=json.dumps({'value': new_val}),
                ip_address=request.remote_addr,
                user_agent=request.headers.get('User-Agent', '')[:500],
                request_method=request.method,
                request_url=request.url,
                status='success',
                timestamp=get_local_now()
            )
            db.session.add(log_entry)

        db.session.commit()
        return jsonify({
            'success': True,
            'message': f'Berhasil memperbarui {updated_count} pengaturan.'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

