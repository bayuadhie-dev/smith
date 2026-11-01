from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from utils.auth_decorators import require_permission
from models import db, SalesOrder, WorkOrder, Inventory, Machine, Product, Material, User, Customer, Supplier, PurchaseOrder
from utils.i18n import success_response, error_response, get_message
from models.oee import OEERecord, OEEAlert
from models.quality import QualityInspection
from models.maintenance import MaintenanceRecord, MaintenanceSchedule
from models.finance import Invoice, Payment
from models.hr import Employee, EmployeeRoster
from models.returns import CustomerReturn
from models.waste import WasteRecord
from models.rd import ResearchProject
from sqlalchemy import func, desc, and_
from datetime import datetime, timedelta, date
import json
from utils.timezone import get_local_now, get_local_today

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/overview', methods=['GET'])
@jwt_required()
@require_permission('dashboard.view')
def get_overview():
    try:
        # Sales metrics - simplified
        today = get_local_now().date()
        month_start = today.replace(day=1)
        
        try:
            sales_today = db.session.query(func.sum(SalesOrder.total_amount)).filter(
                func.date(SalesOrder.order_date) == today,
                SalesOrder.status.notin_(['draft', 'cancelled'])
            ).scalar() or 0
        except:
            sales_today = 0

        try:
            sales_this_month = db.session.query(func.sum(SalesOrder.total_amount)).filter(
                SalesOrder.order_date >= month_start,
                SalesOrder.status.notin_(['draft', 'cancelled'])
            ).scalar() or 0
        except:
            sales_this_month = 0
        
        # Production metrics - simplified
        try:
            active_work_orders = WorkOrder.query.filter_by(status='in_progress').count()
        except:
            active_work_orders = 0
            
        try:
            completed_today = WorkOrder.query.filter(
                func.date(WorkOrder.actual_end_date) == today,
                WorkOrder.status == 'completed'
            ).count()
        except:
            completed_today = 0
        
        # Inventory metrics - simplified to avoid complex joins
        try:
            total_products = Product.query.count()
            total_inventory = Inventory.query.count()
            low_stock_items = 0  # Simplified for now
        except:
            total_products = 0
            total_inventory = 0
            low_stock_items = 0
        
        # Machine status - simplified
        try:
            machines_running = Machine.query.filter_by(status='running').count()
            machines_idle = Machine.query.filter_by(status='idle').count()
            machines_maintenance = Machine.query.filter_by(status='maintenance').count()
        except:
            machines_running = 0
            machines_idle = 0
            machines_maintenance = 0
        
        return jsonify({
            'sales': {
                'today': float(sales_today),
                'this_month': float(sales_this_month)
            },
            'production': {
                'active_work_orders': active_work_orders,
                'completed_today': completed_today
            },
            'inventory': {
                'low_stock_items': low_stock_items,
                'total_products': total_products,
                'total_inventory': total_inventory
            },
            'machines': {
                'running': machines_running,
                'idle': machines_idle,
                'maintenance': machines_maintenance
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@dashboard_bp.route('/charts/sales', methods=['GET'])
@jwt_required()
@require_permission('dashboard.view')
def get_sales_chart():
    try:
        days = request.args.get('days', 30, type=int)
        start_date = get_local_now() - timedelta(days=days)
        
        results = db.session.query(
            func.date(SalesOrder.order_date).label('date'),
            func.sum(SalesOrder.total_amount).label('total')
        ).filter(
            SalesOrder.order_date >= start_date,
            SalesOrder.status.notin_(['draft', 'cancelled'])
        ).group_by(func.date(SalesOrder.order_date)).all()
        
        return jsonify({
            'data': [{
                'date': r.date.isoformat(),
                'total': float(r.total)
            } for r in results]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@dashboard_bp.route('/charts/production', methods=['GET'])
@jwt_required()
@require_permission('dashboard.view')
def get_production_chart():
    try:
        days = request.args.get('days', 30, type=int)
        start_date = get_local_now() - timedelta(days=days)
        
        results = db.session.query(
            func.date(WorkOrder.actual_end_date).label('date'),
            func.sum(WorkOrder.quantity_produced).label('quantity')
        ).filter(
            WorkOrder.actual_end_date >= start_date,
            WorkOrder.status == 'completed'
        ).group_by(func.date(WorkOrder.actual_end_date)).all()
        
        return jsonify({
            'data': [{
                'date': r.date.isoformat(),
                'quantity': float(r.quantity)
            } for r in results]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@dashboard_bp.route('/executive', methods=['GET'])
@jwt_required()
@require_permission('dashboard.view')
def get_executive_dashboard():
    """Comprehensive executive dashboard with all modules KPIs"""
    try:
        from models.production import ShiftProduction
        
        # Date ranges
        today = get_local_today()
        week_start = today - timedelta(days=7)
        month_start = today.replace(day=1)
        
        # Basic metrics that we know work
        sales_today = db.session.query(func.coalesce(func.sum(SalesOrder.total_amount), 0)).filter(
            func.date(SalesOrder.order_date) == today,
            SalesOrder.status.notin_(['draft', 'cancelled'])
        ).scalar() or 0

        sales_this_month = db.session.query(func.coalesce(func.sum(SalesOrder.total_amount), 0)).filter(
            SalesOrder.order_date >= month_start,
            SalesOrder.status.notin_(['draft', 'cancelled'])
        ).scalar() or 0

        # Sales orders count
        sales_orders_count = SalesOrder.query.filter(
            SalesOrder.order_date >= month_start,
            SalesOrder.status.notin_(['draft', 'cancelled'])
        ).count()
        
        active_work_orders = WorkOrder.query.filter_by(status='in_progress').count()
        completed_today = WorkOrder.query.filter(
            func.date(WorkOrder.actual_end_date) == today,
            WorkOrder.status == 'completed'
        ).count()
        
        machines_running = Machine.query.filter_by(status='running', is_active=True).count()
        total_machines = Machine.query.filter_by(is_active=True).count()
        machine_utilization = (machines_running / total_machines * 100) if total_machines > 0 else 0
        
        # OEE from ShiftProduction (more accurate)
        try:
            avg_oee = db.session.query(func.coalesce(func.avg(ShiftProduction.oee_score), 0)).filter(
                ShiftProduction.production_date >= week_start
            ).scalar() or 0
        except:
            try:
                avg_oee = db.session.query(func.coalesce(func.avg(OEERecord.oee), 0)).filter(
                    OEERecord.record_date >= week_start
                ).scalar() or 0
            except:
                avg_oee = 0
        
        # Machines with OEE below 75%
        try:
            low_oee_machines = db.session.query(func.count(func.distinct(ShiftProduction.machine_id))).filter(
                ShiftProduction.production_date >= week_start,
                ShiftProduction.oee_score < 75
            ).scalar() or 0
        except:
            low_oee_machines = 0
        
        try:
            critical_alerts = OEEAlert.query.filter(
                OEEAlert.status == 'active',
                OEEAlert.severity.in_(['high', 'critical'])
            ).count()
        except:
            critical_alerts = 0
        
        # Production output from ShiftProduction
        try:
            production_output = db.session.query(func.coalesce(func.sum(ShiftProduction.actual_quantity), 0)).filter(
                ShiftProduction.production_date >= month_start
            ).scalar() or 0
        except:
            production_output = 0
        
        # Quality pass rate - bug fixed 2026-10-07 in two stages. Stage 1
        # fixed this from computing PRODUCTION YIELD to real QC data.
        # Stage 2 (this version): QC is tracked in TWO parallel tables -
        # QualityInspection (incoming-materials QC, ~1 real row) and
        # QualityTest (finished-goods QC on completed WOs, 608 real rows)
        # - this used to only read QualityInspection, so "Quality Pass
        # Rate" was blind to the vast majority of real QC activity. Now
        # uses utils.quality_metrics.combined_pass_rate() so this figure
        # matches routes/quality_enhanced.py's own dashboard exactly,
        # instead of two different numbers under the same label.
        try:
            from utils.quality_metrics import combined_pass_rate
            quality_pass_rate, _ = combined_pass_rate(week_start, today)
        except:
            quality_pass_rate = 0

        # Quality inspections (combined across both QC tables - see above)
        try:
            from utils.quality_metrics import combined_inspection_counts
            inspections_today = combined_inspection_counts(today)
        except:
            inspections_today = 0
        
        # Inventory - low stock. Bug fixed 2026-10-07: was comparing
        # against Inventory.min_stock_level with no `> 0` guard - most
        # Inventory rows have that field left at its default of 0 (the
        # real threshold lives on Product/Material.min_stock_level
        # instead, set per-item in master data), so `0 <= 0` was true for
        # every never-configured row and inflated this into the
        # thousands. Inventory rows are backed by EITHER a Product OR a
        # Material (never both), so both thresholds must be checked.
        try:
            low_stock_products = db.session.query(Inventory).join(
                Product, Inventory.product_id == Product.id
            ).filter(
                Inventory.quantity_on_hand <= Product.min_stock_level,
                Product.min_stock_level > 0,
            ).count()
            low_stock_materials = db.session.query(Inventory).join(
                Material, Inventory.material_id == Material.id
            ).filter(
                Inventory.quantity_on_hand <= Material.min_stock_level,
                Material.min_stock_level > 0,
            ).count()
            low_stock_items = low_stock_products + low_stock_materials
        except:
            low_stock_items = 0
        
        try:
            inventory_value = db.session.query(func.coalesce(func.sum(Inventory.quantity_on_hand), 0)).scalar() or 0
        except:
            inventory_value = 0
        
        # Purchasing
        try:
            pending_po = PurchaseOrder.query.filter(
                PurchaseOrder.status.in_(['pending', 'approved'])
            ).count()
        except:
            pending_po = 0
        
        # HR
        try:
            total_employees = Employee.query.filter_by(status='active').count()
        except:
            total_employees = 0
        
        try:
            today_roster = EmployeeRoster.query.filter(
                EmployeeRoster.date == today
            ).count()
        except:
            today_roster = 0
        
        # Maintenance
        try:
            overdue_maintenance = MaintenanceSchedule.query.filter(
                MaintenanceSchedule.scheduled_date < today,
                MaintenanceSchedule.status.in_(['pending', 'scheduled'])
            ).count()
        except:
            overdue_maintenance = 0
        
        # Customers
        try:
            active_customers = Customer.query.filter_by(is_active=True).count()
        except:
            active_customers = 0
        
        try:
            returns_this_month = CustomerReturn.query.filter(
                CustomerReturn.return_date >= month_start
            ).count()
        except:
            returns_this_month = 0
        
        # R&D
        try:
            active_projects = ResearchProject.query.filter(
                ResearchProject.status.in_(['planning', 'in_progress', 'testing'])
            ).count()
        except:
            active_projects = 0
        
        # Waste
        try:
            waste_this_week = db.session.query(func.coalesce(func.sum(WasteRecord.quantity), 0)).filter(
                WasteRecord.record_date >= week_start
            ).scalar() or 0
        except:
            waste_this_week = 0
        
        # Revenue growth calculation
        prev_month_start = (month_start - timedelta(days=1)).replace(day=1)
        prev_month_end = month_start - timedelta(days=1)
        try:
            prev_month_sales = db.session.query(func.coalesce(func.sum(SalesOrder.total_amount), 0)).filter(
                SalesOrder.order_date >= prev_month_start,
                SalesOrder.order_date <= prev_month_end,
                SalesOrder.status.notin_(['draft', 'cancelled'])
            ).scalar() or 0
            revenue_growth = ((sales_this_month - prev_month_sales) / prev_month_sales * 100) if prev_month_sales > 0 else 0
        except:
            revenue_growth = 0
        
        # Outstanding invoices. Invoice.status values are actually
        # draft/sent/partial/paid/overdue/cancelled (see models/finance.py) -
        # 'pending' here never matched anything, silently undercounting by
        # excluding 'sent' and 'overdue' invoices that are genuinely unpaid.
        try:
            outstanding_invoices = db.session.query(func.coalesce(func.sum(Invoice.total_amount - Invoice.paid_amount), 0)).filter(
                Invoice.status.in_(['sent', 'partial', 'overdue'])
            ).scalar() or 0
        except:
            outstanding_invoices = 0
        
        # Simple trend data
        sales_trend = []
        for i in range(7):
            trend_date = today - timedelta(days=6-i)
            daily_sales = db.session.query(func.coalesce(func.sum(SalesOrder.total_amount), 0)).filter(
                func.date(SalesOrder.order_date) == trend_date,
                SalesOrder.status.notin_(['draft', 'cancelled'])
            ).scalar() or 0
            sales_trend.append({
                'date': trend_date.isoformat(),
                'value': float(daily_sales)
            })
        
        # Critical issues
        critical_issues = []
        if low_oee_machines > 0:
            critical_issues.append({
                'type': 'oee_alert',
                'message': f'{low_oee_machines} machines with OEE below 75%',
                'severity': 'high',
                'module': 'OEE'
            })
        if low_stock_items > 0:
            critical_issues.append({
                'type': 'inventory_alert',
                'message': f'{low_stock_items} items below minimum stock',
                'severity': 'medium',
                'module': 'Inventory'
            })
        if overdue_maintenance > 0:
            critical_issues.append({
                'type': 'maintenance_alert',
                'message': f'{overdue_maintenance} overdue maintenance schedules',
                'severity': 'high',
                'module': 'Maintenance'
            })
        
        return jsonify({
            'financial': {
                'sales_today': float(sales_today),
                'sales_this_month': float(sales_this_month),
                'revenue_growth': round(revenue_growth, 1),
                'outstanding_invoices': float(outstanding_invoices)
            },
            'production': {
                'active_work_orders': active_work_orders,
                'completed_today': completed_today,
                'efficiency': round(float(avg_oee), 1),
                'output': int(production_output)
            },
            'oee': {
                'average_oee': round(float(avg_oee), 1),
                'critical_alerts': low_oee_machines,
                'machine_utilization': round(machine_utilization, 1)
            },
            'quality': {
                'inspections_today': inspections_today,
                'pass_rate': round(quality_pass_rate, 1)
            },
            'inventory': {
                'low_stock_items': low_stock_items,
                'total_value': float(inventory_value)
            },
            'purchasing': {
                'pending_orders': pending_po
            },
            'hr': {
                'total_employees': total_employees,
                'today_roster': today_roster
            },
            'maintenance': {
                'overdue': overdue_maintenance
            },
            'customers': {
                'active_customers': active_customers,
                'returns_this_month': returns_this_month
            },
            'rd': {
                'active_projects': active_projects
            },
            'waste': {
                'this_week_kg': float(waste_this_week)
            },
            'trends': {
                'sales': sales_trend
            },
            'critical_issues': critical_issues,
            'summary': {
                'total_modules': 11,
                'last_updated': get_local_now().isoformat()
            },
            'sales_orders': {
                'count': sales_orders_count
            }
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# Ringkasan per modul untuk dashboard utama
# ---------------------------------------------------------------------------
def _module_perms(user):
    from utils.auth_decorators import _get_user_permissions
    if getattr(user, 'is_super_admin', False):
        return None
    return _get_user_permissions(user)


def _safe(fn):
    """Jalankan satu blok hitungan di savepoint; gagal => None, modul lain tidak ikut mati."""
    try:
        with db.session.begin_nested():
            return fn()
    except Exception as e:
        print(f"dashboard/modules: {fn.__name__} gagal: {e}")
        return None


@dashboard_bp.route('/modules', methods=['GET'])
@jwt_required()
def get_module_summaries():
    from flask_jwt_extended import get_jwt_identity
    user = db.session.get(User, get_jwt_identity())
    if not user:
        return jsonify({'error': 'User not found'}), 404
    perms = _module_perms(user)

    def can(module):
        return perms is None or f'{module}.view' in perms

    today = get_local_now().date()
    month_start = today.replace(day=1)
    soon = today + timedelta(days=30)
    num = lambda v: float(v or 0)
    modules, actions = [], []

    def item(key, label, value, fmt='number', tone=None):
        return {'key': key, 'label': label, 'value': value, 'format': fmt, 'tone': tone}

    def action(key, label, count, href, tone='warn'):
        if count:
            actions.append({'key': key, 'label': label, 'count': int(count), 'href': href, 'tone': tone})

    if can('production'):
        def produksi():
            wo_run = WorkOrder.query.filter(WorkOrder.status == 'in_progress').count()
            wo_plan = WorkOrder.query.filter(WorkOrder.status.in_(['planned', 'released'])).count()
            from models.production import ProductionRecord
            out = db.session.query(func.sum(ProductionRecord.quantity_good)).filter(
                func.date(ProductionRecord.production_date) == today).scalar()
            mesin_jalan = Machine.query.filter(Machine.is_active.is_(True), Machine.status == 'running').count()
            mesin_rusak = Machine.query.filter(Machine.is_active.is_(True), Machine.status == 'breakdown').count()
            return [item('wo_run', 'SPK berjalan', wo_run), item('wo_plan', 'SPK menunggu', wo_plan),
                    item('output', 'Output hari ini', num(out)), item('mesin', 'Mesin jalan', mesin_jalan),
                    item('rusak', 'Mesin rusak', mesin_rusak, tone='bad' if mesin_rusak else None)]
        r = _safe(produksi)
        if r is not None:
            modules.append({'key': 'production', 'title': 'Produksi', 'href': '/app/production', 'items': r})

    if can('warehouse'):
        def gudang():
            from models.product import Product as _P, Material as _M
            v_prod = db.session.query(func.sum(Inventory.quantity_on_hand * _P.cost)).join(
                _P, Inventory.product_id == _P.id).filter(Inventory.is_active.is_(True), Inventory.quantity_on_hand > 0).scalar()
            v_mat = db.session.query(func.sum(Inventory.quantity_on_hand * _M.cost_per_unit)).join(
                _M, Inventory.material_id == _M.id).filter(Inventory.is_active.is_(True), Inventory.quantity_on_hand > 0).scalar()
            nilai = num(v_prod) + num(v_mat)
            rendah = Inventory.query.filter(Inventory.is_active.is_(True), Inventory.min_stock_level > 0,
                                            Inventory.quantity_on_hand <= Inventory.min_stock_level).count()
            exp = Inventory.query.filter(Inventory.is_active.is_(True), Inventory.quantity_on_hand > 0,
                                         Inventory.expiry_date.isnot(None), Inventory.expiry_date <= soon).count()
            karantina = Inventory.query.filter(Inventory.is_active.is_(True), Inventory.quantity_on_hand > 0,
                                               Inventory.stock_status == 'quarantine').count()
            action('stok_rendah', 'Barang di bawah stok minimum', rendah, '/app/warehouse/stock-summary')
            action('kedaluwarsa', 'Barang kedaluwarsa dalam 30 hari', exp, '/app/warehouse/stock-summary')
            return [item('nilai', 'Nilai persediaan', num(nilai), 'currency'),
                    item('rendah', 'Di bawah minimum', rendah, tone='warn' if rendah else None),
                    item('exp', 'Hampir kedaluwarsa', exp, tone='warn' if exp else None),
                    item('karantina', 'Batch karantina', karantina)]
        r = _safe(gudang)
        if r is not None:
            modules.append({'key': 'warehouse', 'title': 'Gudang', 'href': '/app/warehouse', 'items': r})

    if can('sales'):
        def penjualan():
            omzet = db.session.query(func.sum(SalesOrder.total_amount)).filter(
                SalesOrder.order_date >= month_start, SalesOrder.status.notin_(['draft', 'cancelled'])).scalar()
            so_open = SalesOrder.query.filter(SalesOrder.status.in_(['confirmed', 'in_production', 'ready_to_ship', 'partial'])).count()
            jt = db.session.query(func.sum(Invoice.balance_due)).filter(
                Invoice.invoice_type == 'sales', Invoice.balance_due > 0, Invoice.due_date < today,
                Invoice.status.notin_(['draft', 'cancelled'])).scalar()
            jt_n = Invoice.query.filter(Invoice.invoice_type == 'sales', Invoice.balance_due > 0,
                                        Invoice.due_date < today, Invoice.status.notin_(['draft', 'cancelled'])).count()
            action('piutang_jt', 'Faktur penjualan lewat jatuh tempo', jt_n, '/app/sales/invoices')
            return [item('omzet', 'Pesanan bulan ini', num(omzet), 'currency'), item('so_open', 'Pesanan terbuka', so_open),
                    item('piutang_jt', 'Piutang lewat jatuh tempo', num(jt), 'currency', 'bad' if jt else None)]
        r = _safe(penjualan)
        if r is not None:
            modules.append({'key': 'sales', 'title': 'Penjualan', 'href': '/app/sales', 'items': r})

    if can('purchasing'):
        def pembelian():
            from models.purchasing import PurchaseRequisition
            pr = PurchaseRequisition.query.filter(PurchaseRequisition.status == 'submitted').count()
            po = PurchaseOrder.query.filter(PurchaseOrder.status == 'pending_approval').count()
            po_open = PurchaseOrder.query.filter(PurchaseOrder.status.in_(['sent', 'confirmed', 'partial'])).count()
            hutang = db.session.query(func.sum(Invoice.balance_due)).filter(
                Invoice.invoice_type == 'purchase', Invoice.balance_due > 0, Invoice.due_date < today,
                Invoice.status.notin_(['draft', 'cancelled'])).scalar()
            action('pr_approve', 'Permintaan pembelian menunggu persetujuan', pr, '/app/purchasing/requisitions')
            action('po_approve', 'PO menunggu persetujuan', po, '/app/purchasing/orders')
            return [item('pr', 'PR menunggu approve', pr, tone='warn' if pr else None),
                    item('po', 'PO menunggu approve', po, tone='warn' if po else None),
                    item('po_open', 'PO belum diterima', po_open),
                    item('hutang', 'Utang lewat jatuh tempo', num(hutang), 'currency', 'bad' if hutang else None)]
        r = _safe(pembelian)
        if r is not None:
            modules.append({'key': 'purchasing', 'title': 'Pembelian', 'href': '/app/purchasing', 'items': r})

    if can('finance'):
        def keuangan():
            from utils.finance_helpers import get_cash_balance_as_of
            kas = get_cash_balance_as_of(today)
            ar = db.session.query(func.sum(Invoice.balance_due)).filter(
                Invoice.invoice_type == 'sales', Invoice.balance_due > 0, Invoice.status.notin_(['draft', 'cancelled'])).scalar()
            ap = db.session.query(func.sum(Invoice.balance_due)).filter(
                Invoice.invoice_type == 'purchase', Invoice.balance_due > 0, Invoice.status.notin_(['draft', 'cancelled'])).scalar()
            return [item('kas', 'Saldo kas dan bank', num(kas), 'currency', 'bad' if num(kas) < 0 else None),
                    item('ar', 'Piutang usaha', num(ar), 'currency'), item('ap', 'Utang usaha', num(ap), 'currency')]
        r = _safe(keuangan)
        if r is not None:
            modules.append({'key': 'finance', 'title': 'Keuangan', 'href': '/app/finance', 'items': r})

    if can('quality'):
        def mutu():
            from models.quality import QualityInspection
            hari = QualityInspection.query.filter(func.date(QualityInspection.inspection_date) == today).count()
            tunggu = QualityInspection.query.filter(QualityInspection.status.in_(['pending', 'in_progress'])).count()
            bulan = QualityInspection.query.filter(QualityInspection.inspection_date >= month_start,
                                                   QualityInspection.status == 'completed')
            total = bulan.count()
            lolos = bulan.filter(QualityInspection.result.in_(['accepted', 'passed'])).count()
            rate = round(lolos / total * 100, 1) if total else None
            action('qc_pending', 'Inspeksi mutu belum selesai', tunggu, '/app/quality/inspections')
            return [item('hari', 'Inspeksi hari ini', hari), item('tunggu', 'Belum selesai', tunggu, tone='warn' if tunggu else None),
                    item('rate', 'Lolos bulan ini', rate, 'percent')]
        r = _safe(mutu)
        if r is not None:
            modules.append({'key': 'quality', 'title': 'Mutu', 'href': '/app/quality', 'items': r})

    if can('hr'):
        def sdm():
            from models.hr import Attendance
            aktif = Employee.query.filter(Employee.status == 'active').count()
            hadir = Attendance.query.filter(Attendance.attendance_date == today,
                                            Attendance.status.in_(['present', 'late', 'half_day'])).count()
            telat = Attendance.query.filter(Attendance.attendance_date == today, Attendance.status == 'late').count()
            return [item('aktif', 'Karyawan aktif', aktif), item('hadir', 'Hadir hari ini', hadir),
                    item('telat', 'Terlambat hari ini', telat, tone='warn' if telat else None)]
        r = _safe(sdm)
        if r is not None:
            modules.append({'key': 'hr', 'title': 'SDM', 'href': '/app/hr', 'items': r})

    if can('maintenance'):
        def perawatan():
            from models.maintenance import MaintenanceRecord
            jalan = MaintenanceRecord.query.filter(MaintenanceRecord.status == 'in_progress').count()
            lewat = MaintenanceRecord.query.filter(MaintenanceRecord.status == 'scheduled',
                                                   func.date(MaintenanceRecord.maintenance_date) < today).count()
            rusak = Machine.query.filter(Machine.is_active.is_(True), Machine.status == 'breakdown').count()
            action('pm_lewat', 'Jadwal perawatan lewat tanggal', lewat, '/app/maintenance/records', 'bad')
            return [item('rusak', 'Mesin rusak', rusak, tone='bad' if rusak else None),
                    item('jalan', 'Perawatan berjalan', jalan), item('lewat', 'Jadwal lewat tanggal', lewat, tone='warn' if lewat else None)]
        r = _safe(perawatan)
        if r is not None:
            modules.append({'key': 'maintenance', 'title': 'Perawatan', 'href': '/app/maintenance', 'items': r})

    return jsonify({'success': True, 'modules': modules, 'actions': actions,
                    'generated_at': get_local_now().isoformat()}), 200
