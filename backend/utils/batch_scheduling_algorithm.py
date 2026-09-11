"""
Batch Scheduling — Algoritma Alokasi (Fase 3, §5) + Penomoran Batch (§6).

Dipanggil dari endpoint POST /api/batch-scheduling/generate-replan (routes/batch_scheduling.py).
Semua logic murni di sini supaya endpoint tetap tipis dan gampang diuji lewat API langsung
(sesuai instruksi fase: "backend dulu, diuji lewat API langsung sebelum UI").
"""
from datetime import timedelta, datetime, time
from decimal import Decimal

from models import db
from models.production import WorkOrder, Machine
from models.batch_scheduling import ProductionRecipe, ProductionBatch
from routes.batch_scheduling import resolve_effective_calendar
from utils.timezone import get_local_today

MAX_DAYS_AHEAD = 365
MONTH_LETTER = {m: chr(ord('A') + m - 1) for m in range(1, 13)}


def _batch_number(machine_number, sequence_in_shift, shift_number, d):
    return f"{machine_number}{sequence_in_shift}{shift_number} {d.day}{MONTH_LETTER[d.month]} {d.year % 100:02d}"


def _recipe_duration_hours(recipe, qty):
    rate = Decimal(str(recipe.rate_per_hour))
    if rate <= 0:
        return 0.0
    return float(Decimal(str(qty)) / rate)


def _build_timeline(machine_id, start_date, max_days=MAX_DAYS_AHEAD):
    """List of working slots {date, shift, capacity, remaining} for a machine, chronological."""
    timeline = []
    cursor = start_date
    for _ in range(max_days):
        cal = resolve_effective_calendar(machine_id, cursor)
        if cal['is_working_day'] and cal['shift_count']:
            duration = float(cal['shift_duration_hours'] or 0)
            for shift in range(1, cal['shift_count'] + 1):
                timeline.append({'date': cursor, 'shift': shift, 'capacity': duration, 'remaining': duration})
        cursor += timedelta(days=1)
    return timeline


def _slot_index(timeline, target_date, target_shift):
    for i, slot in enumerate(timeline):
        if slot['date'] == target_date and slot['shift'] == target_shift:
            return i
    return None


def _consume(timeline, start_index, hours_needed):
    """Walk timeline forward from start_index consuming hours_needed of remaining capacity.
    Returns (end_index, ok). ok=False if timeline ran out (caller must mark unplaceable)."""
    idx = start_index
    remaining_need = hours_needed
    while remaining_need > 1e-9:
        if idx >= len(timeline):
            return idx, False
        take = min(timeline[idx]['remaining'], remaining_need)
        timeline[idx]['remaining'] -= take
        remaining_need -= take
        if remaining_need > 1e-9:
            idx += 1
    return idx, True


def run_generate_replan(user_id):
    """Full re-plan per §5: release all draft batches, rebuild queue, reallocate per machine.
    Wrapped by caller in a transaction with an advisory lock (see routes/batch_scheduling.py).
    Returns a summary dict.
    """
    today = get_local_today()

    # 1. Lepas semua batch draft (dihapus, qty-nya kembali ke antrian lewat WorkOrder di bawah)
    released_count = ProductionBatch.query.filter_by(status='draft').delete(synchronize_session=False)
    db.session.flush()

    # 2. Kumpulkan kebutuhan: tiap WorkOrder aktif, qty belum tercakup batch approved/in_progress/completed
    # WorkOrder.status='completed' DIKECUALIKAN di sini secara sengaja: WO completed sudah tidak
    # ada sisa produksi by definition. Banyak WO lama (sebelum modul Batch Scheduling ada) completed
    # tanpa pernah punya ProductionBatch sama sekali - kalau ikut masuk sini, locked_qty selalu 0
    # sehingga seluruh quantity historisnya salah dianggap "belum dijadwalkan" dan di-generate ulang.
    locked_statuses = ('approved', 'in_progress', 'completed')
    work_orders = WorkOrder.query.filter(
        WorkOrder.status.notin_(['cancelled', 'completed']),
        WorkOrder.machine_id.isnot(None),
    ).all()

    needs = []  # {work_order, machine_id, recipe, remaining_qty, required_date}
    skipped_no_recipe = []
    for wo in work_orders:
        locked_qty = db.session.query(db.func.coalesce(db.func.sum(ProductionBatch.planned_qty), 0)).filter(
            ProductionBatch.work_order_id == wo.id,
            ProductionBatch.status.in_(locked_statuses),
        ).scalar()
        remaining = Decimal(str(wo.quantity)) - Decimal(str(locked_qty))
        if remaining <= 0:
            continue
        # Product+machine no longer forced to a single recipe - if several active
        # recipes match, prefer the one marked is_default, else the most recently
        # created one.
        recipe = ProductionRecipe.query.filter_by(
            product_id=wo.product_id, machine_id=wo.machine_id, is_active=True
        ).order_by(ProductionRecipe.is_default.desc(), ProductionRecipe.id.desc()).first()
        if not recipe:
            skipped_no_recipe.append({'work_order_id': wo.id, 'wo_number': wo.wo_number, 'product_id': wo.product_id, 'machine_id': wo.machine_id})
            continue
        needs.append({
            'work_order': wo,
            'machine_id': wo.machine_id,
            'recipe': recipe,
            'remaining_qty': remaining,
            'required_date': wo.required_date,
        })

    # 3. Kelompokkan per mesin, urutkan urgency (required_date terdekat duluan, null di akhir)
    by_machine = {}
    for n in needs:
        by_machine.setdefault(n['machine_id'], []).append(n)
    for machine_id, lst in by_machine.items():
        lst.sort(key=lambda n: (n['required_date'] is None, n['required_date'] or today))

    created_batches = []
    unplaceable = []
    over_capacity_warnings = []

    for machine_id, machine_needs in by_machine.items():
        machine = Machine.query.get(machine_id)
        if not machine or not machine.machine_number:
            for n in machine_needs:
                unplaceable.append({
                    'work_order_id': n['work_order'].id, 'wo_number': n['work_order'].wo_number,
                    'reason': 'Mesin belum punya machine_number — isi dulu di data mesin.',
                })
            continue

        timeline = _build_timeline(machine_id, today)

        # 3a. Kunci kapasitas yang sudah dipakai batch approved/in_progress/completed
        locked_batches = ProductionBatch.query.filter(
            ProductionBatch.machine_id == machine_id,
            ProductionBatch.status.in_(locked_statuses),
            ProductionBatch.scheduled_date.isnot(None),
        ).order_by(ProductionBatch.scheduled_date, ProductionBatch.shift_number, ProductionBatch.sequence_in_shift).all()

        seq_counters = {}  # (date, shift) -> highest sequence_in_shift used so far
        for b in locked_batches:
            key = (b.scheduled_date, b.shift_number)
            seq_counters[key] = max(seq_counters.get(key, 0), b.sequence_in_shift or 0)
            start_idx = _slot_index(timeline, b.scheduled_date, b.shift_number)
            if start_idx is None:
                continue  # kalender berubah setelah batch ini dikunci; tidak diutak-atik (approved tidak digeser)
            duration = _recipe_duration_hours(b.recipe, b.planned_qty)
            _consume(timeline, start_idx, duration)

        # 3b. Tempatkan kebutuhan baru, urut urgency, dari awal timeline
        cursor_idx = 0
        # geser cursor ke slot pertama yang masih punya sisa kapasitas
        while cursor_idx < len(timeline) and timeline[cursor_idx]['remaining'] <= 1e-9:
            cursor_idx += 1

        for n in machine_needs:
            wo = n['work_order']
            recipe = n['recipe']
            batch_size = Decimal(str(recipe.batch_size))
            remaining_qty = n['remaining_qty']

            while remaining_qty > 0:
                # geser cursor kalau slot sekarang sudah habis
                while cursor_idx < len(timeline) and timeline[cursor_idx]['remaining'] <= 1e-9:
                    cursor_idx += 1
                if cursor_idx >= len(timeline):
                    unplaceable.append({
                        'work_order_id': wo.id, 'wo_number': wo.wo_number,
                        'reason': f'Kapasitas mesin {machine.code} penuh untuk {MAX_DAYS_AHEAD} hari ke depan — cek data kalender mesin ini.',
                    })
                    break

                planned_qty = min(batch_size, remaining_qty)
                duration = _recipe_duration_hours(recipe, planned_qty)

                start_slot = timeline[cursor_idx]
                end_idx, ok = _consume(timeline, cursor_idx, duration)
                if not ok:
                    unplaceable.append({
                        'work_order_id': wo.id, 'wo_number': wo.wo_number,
                        'reason': f'Kapasitas mesin {machine.code} penuh untuk {MAX_DAYS_AHEAD} hari ke depan — cek data kalender mesin ini.',
                    })
                    break
                end_slot = timeline[min(end_idx, len(timeline) - 1)]

                key = (start_slot['date'], start_slot['shift'])
                seq = seq_counters.get(key, 0) + 1
                seq_counters[key] = seq

                batch_number = _batch_number(machine.machine_number, seq, start_slot['shift'], start_slot['date'])

                is_over_capacity = bool(wo.required_date and end_slot['date'] > wo.required_date)
                if is_over_capacity:
                    over_capacity_warnings.append({'work_order_id': wo.id, 'wo_number': wo.wo_number, 'end_date': end_slot['date'].isoformat()})

                batch = ProductionBatch(
                    batch_number=batch_number,
                    work_order_id=wo.id,
                    machine_id=machine_id,
                    recipe_id=recipe.id,
                    scheduled_date=start_slot['date'],
                    shift_number=start_slot['shift'],
                    sequence_in_shift=seq,
                    planned_qty=planned_qty,
                    realized_qty=0,
                    # Kalender tidak simpan jam mulai shift, jadi datetime dipakai cuma sebagai
                    # penanda tanggal mulai/selesai (midnight anchor), bukan jam presisi.
                    planned_start_datetime=datetime.combine(start_slot['date'], time.min),
                    planned_end_datetime=datetime.combine(end_slot['date'], time.min),
                    status='draft',
                    is_over_capacity_warning=is_over_capacity,
                    created_by=user_id,
                )
                db.session.add(batch)
                created_batches.append(batch)
                remaining_qty -= planned_qty
                cursor_idx = end_idx

    db.session.flush()

    return {
        'released_draft_count': released_count,
        'created_count': len(created_batches),
        'created_batch_ids': [b.id for b in created_batches],
        'unplaceable': unplaceable,
        'skipped_no_recipe': skipped_no_recipe,
        'over_capacity_warnings': over_capacity_warnings,
    }
