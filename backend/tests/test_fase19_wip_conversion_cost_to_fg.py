"""
Fase 19 (fix_report_3.md, 2026-10-02): direct follow-on from Fase 18.
Fase 18 made each production shift debit Persediaan Barang Dalam Proses
(WIP, 1-1300) for labor/overhead absorbed that shift - but nothing ever
credited it back out, and the Finished Goods cost basis used for COGS at
shipping stayed material-only. Fixed in auto_receive_finished_goods()
(routes/production_integration.py): fg_unit_cost/total_cost now include
WIPBatch.labor_cost+overhead_cost (conversion_cost) alongside
material_cost_total, AND a GL journal (Dr FG account / Cr WIP) discharges
WIP for that amount. Owner-confirmed design: at WO completion (Tutup SPK),
not per-shift.

Important: the cost basis fix targets InventoryTransaction.unit_cost (what
_get_inventory_unit_cost() in utils/fifo_helper.py actually reads back for
COGS), NOT Inventory.unit_cost - that column exists on the model but is
never consulted by the COGS calculation, a trap this session fell into
once already before correcting course.
"""
from models.production import Machine, WorkOrder
from routes.production_integration import auto_receive_finished_goods


def _setup_accounts(db_session):
    from models.finance import Account, GlobalAccountDefault

    fg_account = Account(account_code='TEST-F19-FG', account_name='Persediaan Barang Jadi Test F19', account_type='asset', normal_balance='debit')
    wip = Account(account_code='TEST-F19-WIP', account_name='Persediaan WIP Test F19', account_type='asset', normal_balance='debit')
    db_session.add_all([fg_account, wip])
    db_session.commit()
    db_session.add(GlobalAccountDefault(transaction_key='akun_persediaan_id', account_id=fg_account.id))
    db_session.add(GlobalAccountDefault(transaction_key='wip_persediaan', account_id=wip.id))
    db_session.commit()
    return fg_account, wip


def _setup_prod_area_location(db_session):
    from models.warehouse import WarehouseZone, WarehouseLocation

    zone = WarehouseZone(code='PROD-AREA', name='Area Produksi Test F19', material_type='finished_goods')
    db_session.add(zone)
    db_session.commit()
    location = WarehouseLocation(
        zone_id=zone.id, location_code='LOC-F19-PA', rack='R1', level='L1', position='P1',
        capacity=100000, capacity_uom='pcs', is_active=True,
    )
    db_session.add(location)
    db_session.commit()
    return location


def _make_wo(db_session, test_product, quantity=100):
    machine = Machine(code='MC-F19', name='Test Machine F19', machine_type='test', status='active')
    db_session.add(machine)
    db_session.commit()
    wo = WorkOrder(wo_number='WO-F19-001', product_id=test_product.id, quantity=quantity, uom='PCS', status='in_progress', machine_id=machine.id)
    db_session.add(wo)
    db_session.commit()
    return wo


def _make_wip_batch(db_session, wo, test_user, labor_cost=25000, overhead_cost=50000):
    from models.wip_job_costing import WIPBatch

    wip_batch = WIPBatch(
        wip_batch_no=f'WIP-F19-{wo.id}', work_order_id=wo.id, product_id=wo.product_id,
        current_stage='packing', labor_cost=labor_cost, overhead_cost=overhead_cost,
        created_by=test_user.id,
    )
    db_session.add(wip_batch)
    db_session.commit()
    return wip_batch


def test_auto_receive_folds_conversion_cost_into_fg_cost_basis(app, db_session, test_product, test_user):
    _setup_accounts(db_session)
    _setup_prod_area_location(db_session)
    wo = _make_wo(db_session, test_product, quantity=100)
    _make_wip_batch(db_session, wo, test_user, labor_cost=25000, overhead_cost=50000)

    with app.app_context():
        success, message, inventory_id = auto_receive_finished_goods(wo.id, 100)
        assert success, message

        from models.warehouse import Inventory
        from models.wms_advanced import InventoryTransaction
        inv = db_session.get(Inventory, inventory_id)
        assert float(inv.quantity_on_hand) == 100

        # _get_inventory_unit_cost() (utils/fifo_helper.py) reads this -
        # NOT Inventory.unit_cost - so this is the assertion that actually
        # matters for COGS correctness.
        txn = InventoryTransaction.query.filter_by(
            reference_type='work_order', reference_id=wo.id, direction='in',
        ).order_by(InventoryTransaction.id.desc()).first()
        assert txn is not None
        # material_cost_total is 0 here (no MaterialIssue set up) - so the
        # whole unit_cost should be conversion_cost / quantity.
        assert float(txn.unit_cost) == 750.0  # (25000+50000) / 100
        assert float(txn.total_cost) == 75000.0


def test_auto_receive_posts_wip_to_fg_gl_journal(app, db_session, test_product, test_user):
    fg_account, wip = _setup_accounts(db_session)
    _setup_prod_area_location(db_session)
    wo = _make_wo(db_session, test_product, quantity=100)
    _make_wip_batch(db_session, wo, test_user, labor_cost=25000, overhead_cost=50000)

    with app.app_context():
        success, message, inventory_id = auto_receive_finished_goods(wo.id, 100)
        assert success, message

        from models.finance import AccountingEntry
        entries = AccountingEntry.query.filter_by(reference_type='wip_conversion_to_fg', reference_id=wo.id).all()
        assert len(entries) == 2, 'harus ada 2 baris jurnal (Dr FG / Cr WIP)'

        by_account = {e.account_id: e for e in entries}
        assert float(by_account[fg_account.id].debit_amount) == 75000.0
        assert float(by_account[wip.id].credit_amount) == 75000.0
        total_debit = sum(float(e.debit_amount or 0) for e in entries)
        total_credit = sum(float(e.credit_amount or 0) for e in entries)
        assert total_debit == total_credit == 75000.0


def test_auto_receive_is_idempotent_for_wip_conversion_journal(app, db_session, test_product, test_user):
    _setup_accounts(db_session)
    _setup_prod_area_location(db_session)
    wo = _make_wo(db_session, test_product, quantity=100)
    _make_wip_batch(db_session, wo, test_user, labor_cost=25000, overhead_cost=50000)

    with app.app_context():
        success, _, _ = auto_receive_finished_goods(wo.id, 100)
        assert success
        success, _, _ = auto_receive_finished_goods(wo.id, 100)
        assert success

        from models.finance import AccountingEntry
        entries = AccountingEntry.query.filter_by(reference_type='wip_conversion_to_fg', reference_id=wo.id).all()
        assert len(entries) == 2, 'kedua kali dipanggil tidak boleh dobel posting'


def test_auto_receive_skips_gl_when_no_wip_batch(app, db_session, test_product):
    """WO tanpa WIPBatch (tidak ada shift production record) - tidak boleh
    error, dan tidak boleh posting jurnal Rp0 palsu."""
    _setup_accounts(db_session)
    _setup_prod_area_location(db_session)
    wo = _make_wo(db_session, test_product, quantity=100)

    with app.app_context():
        success, message, inventory_id = auto_receive_finished_goods(wo.id, 100)
        assert success, message

        from models.finance import AccountingEntry
        entries = AccountingEntry.query.filter_by(reference_type='wip_conversion_to_fg', reference_id=wo.id).all()
        assert len(entries) == 0
