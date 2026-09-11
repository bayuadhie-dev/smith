"""
Batch Scheduling - Master Data Routes (Fase 2)
Recipe, Global Calendar, Exception Calendar, Machine Calendar Override.
No allocation algorithm here yet (that's Fase 3) - pure CRUD + calendar resolution.
"""
import re
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.auth_decorators import require_permission
from datetime import datetime, date, timedelta
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from models import db, Machine, Product
from models.batch_scheduling import (
    ProductionRecipe, GlobalCalendar, ExceptionCalendar, MachineCalendarOverride, ProductionBatch
)


def _natural_sort_key(value):
    """'Mesin 10' harus setelah 'Mesin 2', bukan sebelumnya (sort alfabet biasa salah di sini)."""
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r'(\d+)', value or '')]


def _sorted_machines_by_name(machines):
    return sorted(machines, key=lambda m: _natural_sort_key(m.name))

# Kunci fisik sembarang untuk pg_advisory_xact_lock — cuma perlu unik dalam scope aplikasi ini,
# supaya 2 klik "Generate/Re-plan" hampir bersamaan tidak jalan berbarengan (§6).
GENERATE_REPLAN_LOCK_KEY = 951030

batch_scheduling_bp = Blueprint('batch_scheduling', __name__)


def _parse_date(value):
    if not value:
        return None
    return datetime.strptime(value, '%Y-%m-%d').date()


def resolve_effective_calendar(machine_id, target_date):
    """3-layer resolution per §4 of the plan: MachineCalendarOverride > ExceptionCalendar > GlobalCalendar."""
    override = MachineCalendarOverride.query.filter_by(machine_id=machine_id, override_date=target_date).first()
    if override:
        return {
            'source': 'override',
            'is_working_day': override.is_working_day,
            'shift_count': override.shift_count,
            'shift_duration_hours': float(override.shift_duration_hours) if override.shift_duration_hours else None,
            'reason': override.reason,
        }

    exception = ExceptionCalendar.query.filter_by(exception_date=target_date).first()
    if exception:
        shift_count = exception.shift_count
        shift_duration_hours = float(exception.shift_duration_hours) if exception.shift_duration_hours else None
        if exception.is_working_day and (shift_count is None or shift_duration_hours is None):
            g = GlobalCalendar.query.filter_by(day_of_week=target_date.weekday()).first()
            if shift_count is None:
                shift_count = g.shift_count if g else 0
            if shift_duration_hours is None:
                shift_duration_hours = float(g.shift_duration_hours) if g and g.shift_duration_hours else None
        return {
            'source': 'exception',
            'is_working_day': exception.is_working_day,
            'shift_count': shift_count,
            'shift_duration_hours': shift_duration_hours,
            'reason': exception.reason,
        }

    g = GlobalCalendar.query.filter_by(day_of_week=target_date.weekday()).first()
    if not g:
        return {'source': 'global', 'is_working_day': False, 'shift_count': 0, 'shift_duration_hours': None, 'reason': None}
    return {
        'source': 'global',
        'is_working_day': g.is_working_day,
        'shift_count': g.shift_count,
        'shift_duration_hours': float(g.shift_duration_hours) if g.shift_duration_hours else None,
        'reason': None,
    }


# ─────────────────────────────────────────────
# PRODUCTION RECIPES
# ─────────────────────────────────────────────
@batch_scheduling_bp.route('/recipes', methods=['GET'])
@jwt_required()
@require_permission('work_orders.view')
def get_recipes():
    try:
        query = ProductionRecipe.query
        product_id = request.args.get('product_id', type=int)
        machine_id = request.args.get('machine_id', type=int)
        active_only = request.args.get('active_only', 'true').lower() == 'true'
        if product_id:
            query = query.filter_by(product_id=product_id)
        if machine_id:
            query = query.filter_by(machine_id=machine_id)
        if active_only:
            query = query.filter_by(is_active=True)
        recipes = query.order_by(ProductionRecipe.product_id).all()
        return jsonify({
            'recipes': [{
                'id': r.id,
                'product_id': r.product_id,
                'product_name': r.product.name if r.product else None,
                'product_code': r.product.code if r.product else None,
                'machine_id': r.machine_id,
                'machine_code': r.machine.code if r.machine else None,
                'machine_name': r.machine.name if r.machine else None,
                'batch_size': float(r.batch_size),
                'rate_per_hour': float(r.rate_per_hour),
                'duration_hours': round(float(r.batch_size) / float(r.rate_per_hour), 2) if r.rate_per_hour else None,
                'is_default': r.is_default,
                'is_active': r.is_active,
            } for r in recipes]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@batch_scheduling_bp.route('/recipes', methods=['POST'])
@jwt_required()
@require_permission('work_orders.create')
def create_recipe():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        for field in ('product_id', 'machine_id', 'batch_size', 'rate_per_hour'):
            if not data.get(field):
                return jsonify({'error': f'{field} wajib diisi'}), 400

        if data.get('is_default'):
            ProductionRecipe.query.filter_by(product_id=data['product_id'], is_default=True).update({'is_default': False})

        recipe = ProductionRecipe(
            product_id=data['product_id'],
            machine_id=data['machine_id'],
            batch_size=data['batch_size'],
            rate_per_hour=data['rate_per_hour'],
            is_default=bool(data.get('is_default', False)),
            is_active=True,
            created_by=user_id,
        )
        db.session.add(recipe)
        db.session.commit()
        return jsonify({'message': 'Resep dibuat', 'id': recipe.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@batch_scheduling_bp.route('/recipes/<int:id>', methods=['PUT'])
@jwt_required()
@require_permission('work_orders.edit')
def update_recipe(id):
    try:
        recipe = db.session.get(ProductionRecipe, id)
        if not recipe:
            return jsonify({'error': 'Resep tidak ditemukan'}), 404
        data = request.get_json()

        if data.get('is_default'):
            ProductionRecipe.query.filter(
                ProductionRecipe.product_id == recipe.product_id,
                ProductionRecipe.id != recipe.id
            ).update({'is_default': False})

        for field in ('batch_size', 'rate_per_hour', 'is_default', 'is_active'):
            if field in data:
                setattr(recipe, field, data[field])
        db.session.commit()
        return jsonify({'message': 'Resep diperbarui'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@batch_scheduling_bp.route('/recipes/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('work_orders.delete')
def delete_recipe(id):
    try:
        recipe = db.session.get(ProductionRecipe, id)
        if not recipe:
            return jsonify({'error': 'Resep tidak ditemukan'}), 404
        recipe.is_active = False
        db.session.commit()
        return jsonify({'message': 'Resep dinonaktifkan'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────
# GLOBAL CALENDAR (fixed 7 rows, day_of_week 0-6)
# ─────────────────────────────────────────────
@batch_scheduling_bp.route('/calendar/global', methods=['GET'])
@jwt_required()
@require_permission('work_orders.view')
def get_global_calendar():
    try:
        rows = {g.day_of_week: g for g in GlobalCalendar.query.all()}
        result = []
        for dow in range(7):
            g = rows.get(dow)
            result.append({
                'day_of_week': dow,
                'is_working_day': g.is_working_day if g else False,
                'shift_count': g.shift_count if g else 0,
                'shift_duration_hours': float(g.shift_duration_hours) if g and g.shift_duration_hours else None,
            })
        return jsonify({'global_calendar': result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@batch_scheduling_bp.route('/calendar/global', methods=['PUT'])
@jwt_required()
@require_permission('work_orders.edit')
def update_global_calendar():
    """Body: {"days": [{day_of_week, is_working_day, shift_count, shift_duration_hours}, ...]} - upsert per row."""
    try:
        data = request.get_json()
        days = data.get('days', [])
        for d in days:
            dow = d['day_of_week']
            if dow < 0 or dow > 6:
                continue
            g = GlobalCalendar.query.filter_by(day_of_week=dow).first()
            if not g:
                g = GlobalCalendar(day_of_week=dow)
                db.session.add(g)
            g.is_working_day = d.get('is_working_day', False)
            g.shift_count = d.get('shift_count', 0)
            g.shift_duration_hours = d.get('shift_duration_hours')
        db.session.commit()
        return jsonify({'message': 'Kalender global diperbarui'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────
# EXCEPTION CALENDAR (factory-wide, per date)
# ─────────────────────────────────────────────
@batch_scheduling_bp.route('/calendar/exceptions', methods=['GET'])
@jwt_required()
@require_permission('work_orders.view')
def get_exception_calendar():
    try:
        start = _parse_date(request.args.get('start'))
        end = _parse_date(request.args.get('end'))
        query = ExceptionCalendar.query
        if start:
            query = query.filter(ExceptionCalendar.exception_date >= start)
        if end:
            query = query.filter(ExceptionCalendar.exception_date <= end)
        rows = query.order_by(ExceptionCalendar.exception_date).all()
        return jsonify({
            'exceptions': [{
                'id': e.id,
                'exception_date': e.exception_date.isoformat(),
                'is_working_day': e.is_working_day,
                'shift_count': e.shift_count,
                'shift_duration_hours': float(e.shift_duration_hours) if e.shift_duration_hours else None,
                'reason': e.reason,
            } for e in rows]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@batch_scheduling_bp.route('/calendar/exceptions', methods=['POST'])
@jwt_required()
@require_permission('work_orders.create')
def create_exception():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        exception_date = _parse_date(data.get('exception_date'))
        if not exception_date:
            return jsonify({'error': 'exception_date wajib diisi'}), 400
        if ExceptionCalendar.query.filter_by(exception_date=exception_date).first():
            return jsonify({'error': f'Tanggal {exception_date} sudah punya exception'}), 400

        exc = ExceptionCalendar(
            exception_date=exception_date,
            is_working_day=bool(data.get('is_working_day', False)),
            shift_count=data.get('shift_count'),
            shift_duration_hours=data.get('shift_duration_hours'),
            reason=data.get('reason'),
            created_by=user_id,
        )
        db.session.add(exc)
        db.session.commit()
        return jsonify({'message': 'Exception dibuat', 'id': exc.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@batch_scheduling_bp.route('/calendar/exceptions/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('work_orders.delete')
def delete_exception(id):
    try:
        exc = db.session.get(ExceptionCalendar, id)
        if not exc:
            return jsonify({'error': 'Exception tidak ditemukan'}), 404
        db.session.delete(exc)
        db.session.commit()
        return jsonify({'message': 'Exception dihapus'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────
# MACHINE CALENDAR OVERRIDE (per mesin+tanggal, R4.d weekly grid)
# ─────────────────────────────────────────────
@batch_scheduling_bp.route('/calendar/machine-override-grid', methods=['GET'])
@jwt_required()
@require_permission('work_orders.view')
def get_machine_override_grid():
    """Weekly grid: rows = active machines, cols = 7 dates starting at ?week_start=YYYY-MM-DD.
    Each cell is prefilled from resolve_effective_calendar (Global+Exception, no override applied yet)
    unless an override already exists for that (machine, date) - matches R4.d spec."""
    try:
        week_start = _parse_date(request.args.get('week_start'))
        if not week_start:
            return jsonify({'error': 'week_start wajib diisi (YYYY-MM-DD)'}), 400

        dates = [week_start + timedelta(days=i) for i in range(7)]
        machines = _sorted_machines_by_name(Machine.query.filter_by(is_active=True).all())

        overrides = {
            (o.machine_id, o.override_date): o
            for o in MachineCalendarOverride.query.filter(
                MachineCalendarOverride.override_date.in_(dates)
            ).all()
        }

        grid = []
        for m in machines:
            cells = []
            for d in dates:
                existing = overrides.get((m.id, d))
                if existing:
                    cells.append({
                        'date': d.isoformat(),
                        'has_override': True,
                        'is_working_day': existing.is_working_day,
                        'shift_count': existing.shift_count,
                        'shift_duration_hours': float(existing.shift_duration_hours) if existing.shift_duration_hours else None,
                        'reason': existing.reason,
                    })
                else:
                    resolved = resolve_effective_calendar(m.id, d)
                    cells.append({
                        'date': d.isoformat(),
                        'has_override': False,
                        'is_working_day': resolved['is_working_day'],
                        'shift_count': resolved['shift_count'],
                        'shift_duration_hours': resolved['shift_duration_hours'],
                        'reason': resolved['reason'],
                    })
            grid.append({
                'machine_id': m.id,
                'machine_code': m.code,
                'machine_name': m.name,
                'machine_number': m.machine_number,
                'cells': cells,
            })

        return jsonify({'week_start': week_start.isoformat(), 'dates': [d.isoformat() for d in dates], 'grid': grid}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@batch_scheduling_bp.route('/machines/<int:machine_id>/machine-number', methods=['PATCH'])
@jwt_required()
@require_permission('work_orders.edit')
def update_machine_number(machine_id):
    """Inline edit of Machine.machine_number from the Override Per Mesin tab."""
    try:
        machine = Machine.query.get_or_404(machine_id)
        data = request.get_json() or {}
        raw = data.get('machine_number')
        machine.machine_number = int(raw) if raw not in (None, '') else None
        db.session.commit()
        return jsonify({'machine_id': machine.id, 'machine_number': machine.machine_number}), 200
    except (TypeError, ValueError):
        return jsonify({'error': 'machine_number harus angka'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@batch_scheduling_bp.route('/calendar/machine-overrides', methods=['POST'])
@jwt_required()
@require_permission('work_orders.create')
def save_machine_overrides():
    """Body: {"overrides": [{machine_id, override_date, is_working_day, shift_count, shift_duration_hours, reason}, ...]}
    Only cells actually changed from the prefill are sent by the frontend (per R4.d - not the whole grid)."""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        items = data.get('overrides', [])
        saved = 0
        for item in items:
            machine_id = item['machine_id']
            override_date = _parse_date(item['override_date'])
            existing = MachineCalendarOverride.query.filter_by(machine_id=machine_id, override_date=override_date).first()
            if not existing:
                existing = MachineCalendarOverride(machine_id=machine_id, override_date=override_date, created_by=user_id)
                db.session.add(existing)
            existing.is_working_day = item.get('is_working_day', False)
            existing.shift_count = item.get('shift_count', 0)
            existing.shift_duration_hours = item.get('shift_duration_hours')
            existing.reason = item.get('reason')
            saved += 1
        db.session.commit()
        return jsonify({'message': f'{saved} override tersimpan'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@batch_scheduling_bp.route('/calendar/machine-overrides/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('work_orders.delete')
def delete_machine_override(id):
    try:
        override = db.session.get(MachineCalendarOverride, id)
        if not override:
            return jsonify({'error': 'Override tidak ditemukan'}), 404
        db.session.delete(override)
        db.session.commit()
        return jsonify({'message': 'Override dihapus (kembali ke kalender Global/Exception)'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@batch_scheduling_bp.route('/calendar/resolve', methods=['GET'])
@jwt_required()
@require_permission('work_orders.view')
def get_resolved_calendar():
    """Single-cell lookup: ?machine_id=&date=YYYY-MM-DD - exposes resolve_effective_calendar for debugging/preview."""
    try:
        machine_id = request.args.get('machine_id', type=int)
        target_date = _parse_date(request.args.get('date'))
        if not machine_id or not target_date:
            return jsonify({'error': 'machine_id dan date wajib diisi'}), 400
        return jsonify(resolve_effective_calendar(machine_id, target_date)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────
# MACHINES WITH machine_number (for Recipe/Override forms)
# ─────────────────────────────────────────────
@batch_scheduling_bp.route('/machines', methods=['GET'])
@jwt_required()
@require_permission('work_orders.view')
def get_machines_with_number():
    try:
        machines = _sorted_machines_by_name(Machine.query.filter_by(is_active=True).all())
        return jsonify({
            'machines': [{
                'id': m.id,
                'code': m.code,
                'name': m.name,
                'machine_number': m.machine_number,
            } for m in machines]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────
# GENERATE / RE-PLAN (Fase 3, §5 + §6)
# ─────────────────────────────────────────────
@batch_scheduling_bp.route('/generate-replan', methods=['POST'])
@jwt_required()
@require_permission('work_orders.create')
def generate_replan():
    """Hitung ulang total semua batch draft dari nol (§5). Batch approved/in_progress/completed
    tidak disentuh. Dibungkus advisory lock supaya 2 klik hampir bersamaan tidak race (§6)."""
    from utils.batch_scheduling_algorithm import run_generate_replan

    user_id = int(get_jwt_identity())
    try:
        # Lock dilepas otomatis saat transaksi commit/rollback (xact-scoped).
        db.session.execute(text('SELECT pg_advisory_xact_lock(:key)'), {'key': GENERATE_REPLAN_LOCK_KEY})
        result = run_generate_replan(user_id)
        db.session.commit()
        return jsonify(result), 200
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({'error': 'Gagal menyimpan hasil planning karena ada nomor batch bentrok. Coba klik Generate/Re-plan lagi.', 'detail': str(e.orig)}), 409
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@batch_scheduling_bp.route('/batches', methods=['GET'])
@jwt_required()
@require_permission('work_orders.view')
def get_batches():
    """List ProductionBatch untuk diuji lewat API langsung (Fase 3) sebelum UI (Fase 4) dibuat."""
    try:
        query = ProductionBatch.query
        status = request.args.get('status')
        machine_id = request.args.get('machine_id', type=int)
        work_order_id = request.args.get('work_order_id', type=int)
        if status:
            query = query.filter_by(status=status)
        if machine_id:
            query = query.filter_by(machine_id=machine_id)
        if work_order_id:
            query = query.filter_by(work_order_id=work_order_id)
        batches = query.order_by(ProductionBatch.scheduled_date, ProductionBatch.machine_id, ProductionBatch.shift_number, ProductionBatch.sequence_in_shift).all()
        return jsonify({
            'batches': [{
                'id': b.id,
                'batch_number': b.batch_number,
                'work_order_id': b.work_order_id,
                'wo_number': b.work_order.wo_number if b.work_order else None,
                'machine_id': b.machine_id,
                'machine_code': b.machine.code if b.machine else None,
                'recipe_id': b.recipe_id,
                'product_id': b.recipe.product_id if b.recipe else None,
                'product_name': b.recipe.product.name if b.recipe and b.recipe.product else None,
                'product_code': b.recipe.product.code if b.recipe and b.recipe.product else None,
                'required_date': b.work_order.required_date.isoformat() if b.work_order and b.work_order.required_date else None,
                'scheduled_date': b.scheduled_date.isoformat() if b.scheduled_date else None,
                'shift_number': b.shift_number,
                'sequence_in_shift': b.sequence_in_shift,
                'planned_qty': float(b.planned_qty) if b.planned_qty is not None else None,
                'realized_qty': float(b.realized_qty) if b.realized_qty is not None else None,
                'planned_start_datetime': b.planned_start_datetime.isoformat() if b.planned_start_datetime else None,
                'planned_end_datetime': b.planned_end_datetime.isoformat() if b.planned_end_datetime else None,
                'status': b.status,
                'is_over_capacity_warning': b.is_over_capacity_warning,
                'spk_document_id': b.spk_document_id,
                'spk_is_outdated': b.spk_is_outdated,
                'admin_closed': b.admin_closed,
            } for b in batches]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────
# BATCH TERJADWAL UNTUK DROPDOWN INPUT SHIFT (Fase 5, §8)
# ─────────────────────────────────────────────
@batch_scheduling_bp.route('/batches/available-for-shift', methods=['GET'])
@jwt_required()
@require_permission('work_orders.view')
def get_batches_available_for_shift():
    """Batch yang bisa dipilih staf saat input ShiftProduction: status approved/in_progress,
    cocok machine_id + scheduled_date + shift_number dengan konteks input saat itu (§8, §9 R9).
    Batch completed otomatis tidak muncul lagi (qty sudah terpenuhi)."""
    try:
        machine_id = request.args.get('machine_id', type=int)
        target_date = _parse_date(request.args.get('date'))
        shift_number = request.args.get('shift_number', type=int)
        if not machine_id or not target_date or not shift_number:
            return jsonify({'error': 'machine_id, date, dan shift_number wajib diisi'}), 400

        batches = ProductionBatch.query.filter(
            ProductionBatch.machine_id == machine_id,
            ProductionBatch.scheduled_date == target_date,
            ProductionBatch.shift_number == shift_number,
            ProductionBatch.status.in_(['approved', 'in_progress']),
        ).order_by(ProductionBatch.sequence_in_shift).all()

        return jsonify({
            'batches': [{
                'id': b.id,
                'batch_number': b.batch_number,
                'work_order_id': b.work_order_id,
                'wo_number': b.work_order.wo_number if b.work_order else None,
                'product_id': b.recipe.product_id if b.recipe else None,
                'product_name': b.recipe.product.name if b.recipe and b.recipe.product else None,
                'planned_qty': float(b.planned_qty) if b.planned_qty is not None else None,
                'realized_qty': float(b.realized_qty) if b.realized_qty is not None else None,
                'remaining_qty': float(b.planned_qty - b.realized_qty) if b.planned_qty is not None and b.realized_qty is not None else None,
                'status': b.status,
            } for b in batches]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────
# RESCHEDULE MANUAL, APPROVE, EDIT NOMOR, REPRINT SPK (Fase 4, §6-§7)
# ─────────────────────────────────────────────
@batch_scheduling_bp.route('/batches/<int:id>/reschedule', methods=['PUT'])
@jwt_required()
@require_permission('work_orders.edit')
def reschedule_batch(id):
    """Geser jadwal batch manual (drag). Cuma untuk batch status='draft' —
    batch approved/in_progress/completed jadwalnya dikunci (R6)."""
    try:
        batch = ProductionBatch.query.get(id)
        if not batch:
            return jsonify({'error': 'Batch tidak ditemukan'}), 404
        if batch.status != 'draft':
            return jsonify({'error': f'Batch berstatus "{batch.status}" tidak bisa digeser jadwalnya. Cuma batch draft yang boleh.'}), 400

        data = request.get_json()
        if 'recipe_id' in data:
            new_recipe = ProductionRecipe.query.get(data['recipe_id'])
            if not new_recipe:
                return jsonify({'error': 'Resep tidak ditemukan'}), 404
            current_product_id = batch.recipe.product_id if batch.recipe else None
            if current_product_id and new_recipe.product_id != current_product_id:
                return jsonify({'error': 'Resep yang dipilih untuk produk berbeda dengan produk batch ini'}), 400
            if batch.planned_qty is not None and float(batch.planned_qty) > float(new_recipe.batch_size):
                return jsonify({
                    'error': f'Quantity batch ini ({batch.planned_qty}) melebihi batch_size resep tujuan ({new_recipe.batch_size}). '
                              'Kecilkan quantity dulu atau jalankan Generate/Re-plan penuh.'
                }), 400
            batch.recipe_id = new_recipe.id
            batch.machine_id = new_recipe.machine_id
        elif 'machine_id' in data:
            batch.machine_id = data['machine_id']
        if 'scheduled_date' in data:
            batch.scheduled_date = _parse_date(data['scheduled_date'])
        if 'shift_number' in data:
            batch.shift_number = data['shift_number']
        if 'sequence_in_shift' in data:
            batch.sequence_in_shift = data['sequence_in_shift']

        db.session.commit()
        return jsonify({'message': 'Jadwal batch diperbarui'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@batch_scheduling_bp.route('/batches/approve', methods=['POST'])
@jwt_required()
@require_permission('work_orders.create')
def approve_batches():
    """Approve 1 atau banyak batch sekaligus — single-step (R10). 1 SPK diterbitkan per batch.

    2026-08-24: SPK terbit juga otomatis memicu staging bahan baku ke Gudang (MaterialIssue,
    trigger_source='spk') berdasarkan BOM produk batch ini, qty = batch.planned_qty - reuse
    _get_bom_requirements()/_create_auto_reserve_issue() dari utils/auto_reserve.py (infrastruktur
    Follow-the-Goods yang sudah ada, bukan modul staging baru). Sengaja HANYA di titik approve
    pertama kali (bukan di dalam generate_spk_from_batch() itu sendiri), supaya reprint_spk()
    (dipanggil lagi untuk batch yang SUDAH approved, setelah edit nomor batch) tidak memicu
    staging kedua untuk batch yang sama. Kalau BOM produk ini tidak ada, staging dilewati
    (bukan error - SPK tetap terbit) dan dicatat di response sebagai 'staging_skipped'.
    See SPK_STAGING_BAHAN_BAKU_RENCANA_TEKNIS.md."""
    from utils.document_generator import generate_spk_from_batch
    from utils.timezone import get_local_now
    from utils.auto_reserve import _get_bom_requirements, _create_auto_reserve_issue

    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    batch_ids = data.get('batch_ids') or []
    if not batch_ids:
        return jsonify({'error': 'batch_ids wajib diisi'}), 400

    approved = []
    errors = []
    for batch_id in batch_ids:
        try:
            batch = ProductionBatch.query.get(batch_id)
            if not batch:
                errors.append({'batch_id': batch_id, 'error': 'Batch tidak ditemukan'})
                continue
            if batch.status != 'draft':
                errors.append({'batch_id': batch_id, 'error': f'Status batch sudah "{batch.status}", tidak bisa di-approve lagi'})
                continue

            batch.status = 'approved'
            batch.approved_by = user_id
            batch.approved_at = get_local_now()
            document = generate_spk_from_batch(batch.id, user_id)

            staging_material_issue_id = None
            staging_skipped_reason = None
            product_id = batch.recipe.product_id if batch.recipe else None
            if product_id:
                requirements = _get_bom_requirements(product_id, batch.planned_qty)
                if requirements:
                    mi = _create_auto_reserve_issue(
                        requirements,
                        work_order_id=batch.work_order_id,
                        production_batch_id=batch.id,
                        requested_by=user_id,
                        trigger_source='spk',
                        notes=f'Staging otomatis dari SPK {document.document_number} (Batch {batch.batch_number})',
                    )
                    db.session.flush()
                    staging_material_issue_id = mi.id
                else:
                    staging_skipped_reason = 'Produk ini tidak punya BOM aktif - staging bahan baku dilewati'
            else:
                staging_skipped_reason = 'Batch ini tidak punya recipe/produk - staging bahan baku dilewati'

            db.session.commit()
            approved.append({
                'batch_id': batch.id,
                'batch_number': batch.batch_number,
                'spk_document_id': document.id,
                'staging_material_issue_id': staging_material_issue_id,
                'staging_skipped_reason': staging_skipped_reason,
            })
        except Exception as e:
            db.session.rollback()
            errors.append({'batch_id': batch_id, 'error': str(e)})

    return jsonify({'approved': approved, 'errors': errors}), 200


@batch_scheduling_bp.route('/batches/<int:id>/batch-number', methods=['PUT'])
@jwt_required()
@require_permission('work_orders.edit')
def edit_batch_number(id):
    """Edit nomor batch manual, boleh kapan saja apapun statusnya (R11).
    Kalau batch ini sudah punya SPK, SPK lama ditandai superseded, SPK baru TIDAK auto-generate (Opsi B)."""
    from utils.timezone import get_local_now

    user_id = int(get_jwt_identity())
    try:
        batch = ProductionBatch.query.get(id)
        if not batch:
            return jsonify({'error': 'Batch tidak ditemukan'}), 404

        data = request.get_json() or {}
        new_number = (data.get('batch_number') or '').strip()
        if not new_number:
            return jsonify({'error': 'batch_number wajib diisi'}), 400

        dup = ProductionBatch.query.filter(
            ProductionBatch.batch_number == new_number,
            ProductionBatch.id != batch.id
        ).first()
        if dup:
            return jsonify({'error': f'Nomor batch ini sudah dipakai batch #{dup.id} ({dup.batch_number})'}), 400

        old_number = batch.batch_number
        batch.batch_number = new_number

        if batch.spk_document_id:
            from models.document_management import Document, DocumentLog
            old_doc = Document.query.get(batch.spk_document_id)
            if old_doc and old_doc.status != 'superseded':
                old_doc.status = 'superseded'
                db.session.add(DocumentLog(
                    document_id=old_doc.id,
                    activity_type='superseded',
                    activity_description=f'Nomor batch berubah dari "{old_number}" ke "{new_number}" — SPK ini usang, cetak ulang diperlukan.',
                    user_id=user_id,
                ))
            batch.spk_is_outdated = True

        db.session.commit()
        return jsonify({'message': 'Nomor batch diperbarui', 'spk_is_outdated': batch.spk_is_outdated}), 200
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({'error': 'Nomor batch ini sudah dipakai batch lain (race condition), coba nomor lain.'}), 409
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@batch_scheduling_bp.route('/batches/<int:id>/reprint-spk', methods=['POST'])
@jwt_required()
@require_permission('work_orders.create')
def reprint_spk(id):
    """Terbitkan SPK baru untuk batch yang SPK-nya sudah usang (R11, tombol terpisah — Opsi B)."""
    from utils.document_generator import generate_spk_from_batch

    user_id = int(get_jwt_identity())
    try:
        batch = ProductionBatch.query.get(id)
        if not batch:
            return jsonify({'error': 'Batch tidak ditemukan'}), 404
        if batch.status not in ('approved', 'in_progress', 'completed'):
            return jsonify({'error': 'Batch ini belum di-approve, belum ada SPK untuk dicetak ulang.'}), 400

        document = generate_spk_from_batch(batch.id, user_id)
        db.session.commit()
        return jsonify({'message': 'SPK baru diterbitkan', 'spk_document_id': document.id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
