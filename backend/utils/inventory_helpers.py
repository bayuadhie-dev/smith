VALID_STOCK_STATUSES = {'available', 'released', 'quarantine', 'reject'}


def record_inventory_transaction(
    transaction_type, direction, quantity,
    product_id=None, material_id=None,
    from_location_id=None, to_location_id=None,
    batch_number=None, lot_number=None,
    reference_type=None, reference_id=None, reference_number=None,
    work_order_id=None, machine_id=None, shift=None, production_record_id=None,
    unit_cost=None, total_cost=None,
    balance_before=None, balance_after=None,
    status='completed', notes=None, created_by=None,
    accounting_entry_number=None, accounting_entry_status=None,
):
    """Single entry point for writing to InventoryTransaction - the unified
    stock ledger (2026-09-21 migration, replaces the old per-module
    InventoryMovement() constructor calls scattered across 18 files).

    direction must be 'in' or 'out'. transaction_type is free text (the
    column has no DB-level enum constraint) - use a value that describes the
    actual business action (e.g. 'goods_receipt', 'material_issue',
    'transfer', 'qc_disposition', 'wo_cancellation_reversal') rather than
    forcing everything into the handful of types the model docstring lists.

    accounting_entry_number/status (Fase 2, 2026-09-21): ONLY pass these when
    the caller posted (or queued) the real journal entry for this SAME
    business event in the SAME function call, and therefore actually knows
    the number - never guess or backfill it from reference_number matching
    (proven unreliable, see plan.md). Leave both None (the default) for
    every call site where the journal posts later from a separate document -
    that's the normal case for most of this app's stock movements.

    Returns the created (uncommitted) InventoryTransaction - caller adds it
    to the session (this function does that) and commits as part of its own
    transaction, same contract as apply_qc_disposition_splits() below.
    """
    from models import db
    from models.wms_advanced import InventoryTransaction
    from utils.helpers import generate_number
    from utils.timezone import get_local_now

    txn = InventoryTransaction(
        transaction_number=generate_number('TXN', InventoryTransaction, 'transaction_number'),
        transaction_type=transaction_type,
        transaction_date=get_local_now(),
        product_id=product_id,
        material_id=material_id,
        quantity=quantity,
        direction=direction,
        from_location_id=from_location_id,
        to_location_id=to_location_id,
        batch_number=batch_number,
        lot_number=lot_number,
        reference_type=reference_type,
        reference_id=reference_id,
        reference_number=reference_number,
        work_order_id=work_order_id,
        machine_id=machine_id,
        shift=shift,
        production_record_id=production_record_id,
        unit_cost=unit_cost,
        total_cost=total_cost,
        balance_before=balance_before,
        balance_after=balance_after,
        status=status,
        notes=notes,
        created_by=created_by,
        accounting_entry_number=accounting_entry_number,
        accounting_entry_status=accounting_entry_status,
    )
    db.session.add(txn)
    return txn


def apply_qc_disposition_splits(inventory_id, splits, user_id, reference_type=None, reference_id=None, notes=None):
    """Move part or all of a batch's quantity from its current stock_status to
    one or more destination statuses - the MB1A/MB1B-style partial QC
    disposition pattern (2026-09-11), replacing the earlier whole-row status
    flip. E.g. a 10,000pcs quarantined batch can be split into 9,900 released
    + 100 rejected in one call, each split logged as its own InventoryMovement
    with quantity + status_before/status_after, rather than one all-or-nothing
    status change losing the fact that only part of the batch was bad.

    Args:
        inventory_id: source Inventory.id (the row currently holding the
            quantity to be dispositioned - its own stock_status is
            status_before for every split).
        splits: list of {'status': str, 'quantity': float}. status must be one
            of VALID_STOCK_STATUSES. Sum of quantities must not exceed the
            source row's quantity_on_hand.
        user_id: acting user, stamped on each InventoryMovement.
        reference_type/reference_id: e.g. 'qc_inspection'/inspection.id, for
            traceability from the movement back to what triggered it.
        notes: optional free-text, applied to every resulting movement.

    Returns:
        list of created InventoryMovement objects (not yet committed - caller
        commits as part of its own transaction).

    Raises:
        ValueError: invalid split status, non-positive quantity, or total
            requested quantity exceeds what's actually on hand.
    """
    from models import db
    from models.warehouse import Inventory
    from utils.timezone import get_local_now

    source = db.session.get(Inventory, inventory_id)
    if not source:
        raise ValueError(f'Inventory {inventory_id} not found')

    if not splits:
        raise ValueError('No disposition splits provided')

    total_requested = 0.0
    for split in splits:
        status = split.get('status')
        quantity = float(split.get('quantity') or 0)
        if status not in VALID_STOCK_STATUSES:
            raise ValueError(f"Invalid disposition status '{status}'")
        if quantity <= 0:
            raise ValueError('Disposition quantity must be greater than 0')
        total_requested += quantity

    available_on_hand = float(source.quantity_on_hand or 0)
    if total_requested > available_on_hand + 0.001:
        raise ValueError(
            f'Total disposisi ({total_requested}) melebihi quantity_on_hand batch ini ({available_on_hand})'
        )

    status_before = source.stock_status
    movements = []

    for split in splits:
        status = split['status']
        quantity = float(split['quantity'])

        # Deduct from the source row.
        source.quantity_on_hand = float(source.quantity_on_hand or 0) - quantity
        source.quantity_available = max(0.0, float(source.quantity_available or 0) - quantity)
        source.updated_at = get_local_now()

        # Find-or-create the destination row for this batch/status at the
        # same location - never merge across locations or batch numbers.
        dest = Inventory.query.filter_by(
            material_id=source.material_id,
            product_id=source.product_id,
            location_id=source.location_id,
            batch_number=source.batch_number,
            stock_status=status,
        ).first()
        if dest and dest.id != source.id:
            dest.quantity_on_hand = float(dest.quantity_on_hand or 0) + quantity
            if status in ('available', 'released'):
                dest.quantity_available = float(dest.quantity_available or 0) + quantity
            dest.updated_at = get_local_now()
        elif dest is None:
            dest = Inventory(
                material_id=source.material_id,
                product_id=source.product_id,
                location_id=source.location_id,
                batch_number=source.batch_number,
                quantity_on_hand=quantity,
                quantity_available=quantity if status in ('available', 'released') else 0,
                stock_status=status,
                is_active=True,
            )
            db.session.add(dest)
            db.session.flush()
        # else: dest is source itself (status unchanged) - no row movement
        # needed, quantity simply isn't deducted/re-added (net zero), but we
        # still log the movement below for audit purposes if a caller ever
        # passes a same-status split (harmless no-op on Inventory, real
        # record in history).

        movement = record_inventory_transaction(
            transaction_type='qc_disposition',
            direction='out' if status == 'reject' else 'in',
            quantity=quantity,
            product_id=source.product_id,
            material_id=source.material_id,
            from_location_id=source.location_id,
            to_location_id=source.location_id,
            batch_number=source.batch_number,
            reference_type=reference_type,
            reference_id=reference_id,
            notes=notes or f'QC disposition: {status_before} -> {status}',
            created_by=user_id,
        )
        movements.append(movement)

    return movements


def resolve_initial_stock_status(requested_status, product=None, material=None):
    """If the item (Product/Material) has erp_approval=True, a newly created batch
    must be born 'quarantine' - it needs manual QC release before it's usable.

    QC is also now MANDATORY for every finished-goods Product regardless of
    erp_approval (2026-09-09 decision) - previously a finished-goods batch
    could reach 'released' (sellable) the moment it opted out of the
    erp_approval flag, meaning a WO's auto-received output skipped QC
    entirely whenever that one boolean on the product's master data wasn't
    set. Material-type items and non-finished-goods products are unaffected -
    only the erp_approval check still applies to them.

    Otherwise, use whatever status the caller requested (normally 'released' for
    products / 'available' for materials, per each call site's own convention)."""
    item = product or material
    if item is not None and getattr(item, 'erp_approval', False):
        return 'quarantine'
    if product is not None and (getattr(product, 'material_type', '') or '').strip().lower() == 'finished_goods':
        return 'quarantine'
    return requested_status
