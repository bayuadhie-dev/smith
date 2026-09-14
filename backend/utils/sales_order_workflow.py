"""Shared core logic for SO confirm + production-trigger, reused by 3 call sites:
routes/sales.py confirm_order(), routes/workflow_complete.py trigger_complete_workflow(),
and the new atomic routes/sales.py confirm_and_start_production(). Extracted 2026-08-24 so
the new atomic endpoint can run both steps in one DB transaction (single commit) without
duplicating the business logic - these functions do NOT commit/rollback, the caller owns
the transaction.
"""
from datetime import timedelta, date as _date
from decimal import Decimal

from models import db
from models.sales import SalesOrder, SalesOrderItem
from utils.business_rules import BusinessRules, SALES_ORDER_TRANSITIONS
from utils.timezone import get_local_now, get_local_today
from utils import generate_number
from utils.atp_helper import check_atp

# Nama header forecast otomatis dipakai _bump_forecast_for_so_item() sebagai wadah demand
# yang murni datang dari SO tanpa forecast yang cocok sama sekali - lihat docstring fungsi itu.
AUTO_FORECAST_HEADER_NAME = 'Demand dari SO (Auto)'


class SOWorkflowError(Exception):
    """Raised when a step's precondition isn't met. Carries (message, http_status, extra_body)
    so callers can format the same error response they already return today."""
    def __init__(self, message, status=400, extra=None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.extra = extra or {}


def _bump_forecast_for_so_item(product_id, period_month, user_id):
    """'Grid forecast harus hidup' (masukan user 2026-08-26): SO yang confirmed adalah demand
    riil, jadi forecast harus bereaksi ke kenyataan - tapi TIDAK dengan cara "tiap SO nambah
    penuh ke target". Koreksi 2026-08-26 (user: "forecast produk A 4000 tapi di SO 5000,
    berarti forecast tidak tercapai" - maksudnya forecast KELEWATAN oleh demand riil, bukan
    berarti tiap SO baru harus ditambahkan mentah-mentah ke target sampai membengkak tanpa
    batas): target forecast cuma naik kalau TOTAL demand SO riil (kumulatif, semua SO
    confirmed untuk produk+bulan itu, TERMASUK SO yang baru saja confirmed ini) sudah
    MELAMPAUI target yang ada sekarang - dan kalau naik, target di-set SAMA DENGAN total
    kumulatif itu (bukan ditambah lagi di atas kumulatif). Kalau kumulatif SO masih di
    bawah/sama dengan target, forecast sudah cukup mewakili demand, tidak diubah sama sekali.
    Tidak ada tombol/approval manual di sini (beda dari fitur WIP-shortage-ke-WO yang sengaja
    tetap manual) karena ini cuma menaikkan angka rencana, bukan mengeksekusi produksi apa pun.

    ForecastHeader itu jendela rolling 12 bulan (period_start s/d property period_end), dan
    manajemen SENGAJA mengizinkan banyak header tumpang tindih periode yang sama (multi-skenario)
    - lihat routes/sales.py sekitar baris 2321. Jadi "baris forecast yang cocok" untuk 1
    produk+bulan bisa ada 0, 1, atau lebih dari 1 ForecastLine (di header berbeda). Aturan
    pemilihan header (disepakati user 2026-08-26):
      - Cocok tepat 1 -> pakai itu.
      - Cocok 0 -> bikin forecast baru di header otomatis khusus (AUTO_FORECAST_HEADER_NAME),
        supaya tetap kelihatan &amp; bisa direview PPIC di halaman Forecast biasa, bukan diam-diam.
      - Cocok 2+ (multi-skenario) -> pakai header yang PALING BARU dibuat (asumsi: skenario
        terbaru yang paling relevan).
    Does NOT commit - caller (confirm_order_core) sudah dalam 1 transaksi bersama flip status SO
    (SO yang baru di-confirm ini HARUS sudah ke-flush dengan status='confirmed' sebelum fungsi
    ini dipanggil, supaya ikut terhitung di query kumulatif di bawah).
    Returns dict info (buat notifikasi/log) atau None kalau product_id kosong / tidak ada
    perubahan (kumulatif masih di bawah target)."""
    from sqlalchemy import func
    from dateutil.relativedelta import relativedelta
    from models.sales import ForecastHeader, ForecastLine, ForecastLineMonth

    if not product_id:
        return None

    next_month = period_month + relativedelta(months=1)
    period_col = func.coalesce(SalesOrder.required_date, SalesOrder.order_date)
    cumulative_so_qty = db.session.query(func.coalesce(func.sum(SalesOrderItem.quantity), 0)).join(
        SalesOrder, SalesOrder.id == SalesOrderItem.order_id
    ).filter(
        SalesOrderItem.product_id == product_id,
        SalesOrder.status.notin_(['draft', 'cancelled']),
        period_col >= period_month,
        period_col < next_month,
    ).scalar()
    cumulative_so_qty = Decimal(str(cumulative_so_qty or 0))

    candidates = []
    headers = ForecastHeader.query.filter(ForecastHeader.period_start <= period_month).all()
    for h in headers:
        if h.period_end >= period_month:
            line = ForecastLine.query.filter_by(header_id=h.id, product_id=product_id).first()
            if line:
                candidates.append((h, line))

    multi_match = len(candidates) > 1
    if candidates:
        header, line = max(candidates, key=lambda hl: hl[0].created_at) if multi_match else candidates[0]
    else:
        header = ForecastHeader.query.filter_by(
            name=AUTO_FORECAST_HEADER_NAME, period_start=period_month
        ).first()
        if not header:
            auto_headers = ForecastHeader.query.filter(
                ForecastHeader.name == AUTO_FORECAST_HEADER_NAME,
                ForecastHeader.period_start <= period_month,
            ).all()
            header = next((h for h in auto_headers if h.period_end >= period_month), None)
        if not header:
            header = ForecastHeader(
                period_start=period_month,
                name=AUTO_FORECAST_HEADER_NAME,
                status='draft',
                created_by=user_id,
            )
            db.session.add(header)
            db.session.flush()
        line = ForecastLine.query.filter_by(header_id=header.id, product_id=product_id).first()
        if not line:
            line = ForecastLine(header_id=header.id, product_id=product_id)
            db.session.add(line)
            db.session.flush()

    month_row = ForecastLineMonth.query.filter_by(line_id=line.id, period=period_month).first()
    if not month_row:
        month_row = ForecastLineMonth(line_id=line.id, period=period_month, quantity=0)
        db.session.add(month_row)

    current_target = Decimal(str(month_row.quantity or 0))
    if cumulative_so_qty <= current_target:
        # Demand SO riil masih tertampung di target yang ada - forecast sudah cukup
        # mewakili kenyataan, tidak perlu diubah.
        return None

    month_row.quantity = cumulative_so_qty
    month_row.so_bumped_at = get_local_now()

    return {
        'header_id': header.id,
        'header_name': header.name,
        'line_id': line.id,
        'period': period_month.isoformat(),
        'old_target': float(current_target),
        'new_target': float(cumulative_so_qty),
        'multi_match': multi_match,
        'match_count': len(candidates),
    }


def confirm_order_core(order, user_id):
    """Validates the draft->confirmed transition, checks inventory, flips status, dan
    menaikkan saldo Forecast yang cocok (lihat _bump_forecast_for_so_item) untuk tiap item.
    Does NOT commit. Returns inventory_warnings (list, possibly empty).
    Raises SOWorkflowError on invalid transition (mirrors confirm_order()'s existing 400)."""
    status_check = BusinessRules.validate_status_transition(
        current_status=order.status,
        new_status='confirmed',
        allowed_transitions=SALES_ORDER_TRANSITIONS
    )
    if not status_check['valid']:
        raise SOWorkflowError('Invalid status transition', status=400, extra={'details': status_check})

    # Status difilip & di-flush DULU (sebelum loop forecast-bump di bawah) supaya query
    # kumulatif SO di _bump_forecast_for_so_item() ikut menghitung SO ini sendiri sebagai
    # 'confirmed', bukan cuma SO-SO lain yang sudah confirmed sebelumnya.
    order.status = 'confirmed'
    order.approved_by = user_id
    order.approved_at = get_local_now()
    db.session.flush()

    inventory_warnings = []
    for item in order.items:
        try:
            # ATP (SAP SD concept, 2026-09-14) - the old validate_inventory_availability()
            # check only looked at Inventory.quantity_available, blind to OTHER open SOs
            # for the same product confirmed earlier (FG stock is never actually reserved
            # anywhere on SO confirm - see utils/atp_helper.py docstring for the full
            # finding). Still warning-only for now (Sales already has real live usage,
            # unlike Purchasing's Source List - flipping this into a hard block is a
            # separate decision, not made yet), but now the warning is actually accurate
            # about competing commitments instead of silently blind to them.
            atp = check_atp(product_id=item.product_id, quantity_needed=item.quantity, exclude_order_id=order.id)
            if not atp['available']:
                inventory_warnings.append({
                    'product_id': item.product_id,
                    'product_name': item.product.name if item.product else 'Unknown',
                    'required': atp['required'],
                    'available': atp['free_to_promise'],
                    'shortage': atp['shortage'],
                    'on_hand': atp['on_hand'],
                    'committed_elsewhere': atp['committed_elsewhere'],
                    'competing_orders': atp['competing_orders'],
                })
        except Exception as inv_error:
            print(f"Inventory check warning: {inv_error}")

        period_source = order.required_date or order.order_date
        period_month = _date(period_source.year, period_source.month, 1)
        try:
            _bump_forecast_for_so_item(item.product_id, period_month, user_id)
        except Exception as forecast_bump_error:
            print(f"Forecast auto-bump warning: {forecast_bump_error}")

    return inventory_warnings


def trigger_production_from_so_core(sales_order, user_id):
    """Per confirmed-SO-item: resolve active BOM, create ProductionPlan (released) + WorkOrder
    via the same _create_work_order() helper the manual 'generate work orders from plan'
    endpoint uses. Does NOT commit, does NOT flip sales_order.status (caller decides that,
    since the atomic endpoint needs to know 'created' before committing the status change).
    Raises SOWorkflowError if sales_order isn't 'confirmed' or has no items.
    Returns (created, failed) lists - same shape trigger_complete_workflow() already returns."""
    from models.production import ProductionPlan, BillOfMaterials
    from models.batch_scheduling import ProductionRecipe
    from routes.production_planning import _create_work_order

    if sales_order.status != 'confirmed':
        raise SOWorkflowError(
            f"Sales Order harus berstatus 'confirmed' untuk memulai Production Workflow (saat ini: '{sales_order.status}')",
            status=400
        )

    items = SalesOrderItem.query.filter_by(order_id=sales_order.id).all()
    if not items:
        raise SOWorkflowError('Sales Order ini tidak punya item', status=400)

    created = []
    failed = []

    for item in items:
        bom = BillOfMaterials.query.filter_by(product_id=item.product_id, is_active=True).first()
        if not bom:
            product_name = item.product.name if item.product else f'produk ID {item.product_id}'
            failed.append({
                'product_id': item.product_id,
                'product_name': product_name,
                'reason': f"Produk {product_name} belum punya BOM aktif - buat BOM dulu sebelum SO ini bisa masuk ke Planning Produksi."
            })
            continue

        period_start = get_local_today()
        period_end = sales_order.required_date if sales_order.required_date else (period_start + timedelta(days=7))
        if period_end < period_start:
            period_end = period_start

        # WO tanpa machine_id difilter keluar total dari run_generate_replan() (Batch Planning) -
        # tanpa ini, WO hasil SO diam-diam tidak pernah masuk penjadwalan mesin sama sekali
        # (ditemukan saat audit "2 pintu produksi paralel" - lihat memory project_spk_workorder_batch_planning).
        # Isi dari resep default produk, sama pola dengan create_work_order() di routes/production.py.
        default_recipe = ProductionRecipe.query.filter_by(product_id=item.product_id, is_default=True, is_active=True).first()

        plan_number = generate_number('PP', ProductionPlan, 'plan_number')
        plan = ProductionPlan(
            plan_number=plan_number,
            plan_name=f'Auto - {sales_order.order_number} - {item.product.name if item.product else item.product_id}',
            plan_type='weekly',
            period_start=period_start,
            period_end=period_end,
            sales_order_id=sales_order.id,
            based_on='sales_order',
            product_id=item.product_id,
            machine_id=default_recipe.machine_id if default_recipe else None,
            planned_quantity=item.quantity,
            uom=item.uom,
            status='approved',
            priority=sales_order.priority or 'normal',
            approved_by=user_id,
            approved_at=get_local_now(),
            notes=f'Dibuat otomatis dari Sales Order {sales_order.order_number}',
            created_by=user_id
        )
        db.session.add(plan)
        db.session.flush()

        wo = _create_work_order(plan, plan.planned_quantity, plan.period_start, user_id)
        db.session.flush()
        plan.status = 'released'

        created.append({
            'product_id': item.product_id,
            'plan_id': plan.id,
            'plan_number': plan.plan_number,
            'wo_id': wo.id,
            'wo_number': wo.wo_number,
            'has_recipe': default_recipe is not None
        })

    if not created:
        raise SOWorkflowError(
            'Tidak ada item yang berhasil masuk Planning Produksi.',
            status=400,
            extra={'failed_items': failed}
        )

    return created, failed
