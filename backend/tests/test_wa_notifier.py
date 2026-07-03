import pytest
from datetime import datetime, date, time
from decimal import Decimal
from models import db
from models.production import Machine, WorkOrder, ShiftProduction, DowntimeRecord
from models.product import Product
from utils.production_notifications import calculate_wo_completion_metrics, format_wo_completion_message

def test_calculate_wo_completion_metrics(app, db_session):
    """
    Test calculating Work Order completion metrics, cartons, runtimes, downtime,
    OEE, sorted downtime list, and Top 3 categories.
    """
    # 1. Setup mock product and machine
    product = Product(
        code='TEST-PACK-01',
        name='Test Tissue Wet Wipes',
        material_type='finished_goods',
        primary_uom='pack',
        is_active=True
    )
    db_session.add(product)
    
    machine = Machine(
        code='MC-LINE-01',
        name='Converting Machine Line 1',
        machine_type='converting',
        is_active=True
    )
    db_session.add(machine)
    db_session.commit()

    # 2. Setup mock Work Order
    wo = WorkOrder(
        wo_number='WO-2026-TEST',
        product_id=product.id,
        bom_id=None,
        quantity=Decimal('10000'),
        uom='pack',
        pack_per_carton=100,  # 100 packs per carton
        status='in_progress',
        machine_id=machine.id,
        created_at=datetime.utcnow()
    )
    db_session.add(wo)
    db_session.commit()

    # 3. Setup mock Shift Production records
    # Shift 1: 5000 good, 100 reject, 420 runtime, 90 downtime, 510 planned
    # Downtime: 45 min Mesin, 25 min Operator, 20 min Idle Time
    shift1 = ShiftProduction(
        production_date=date(2026, 7, 3),
        shift='shift_1',
        shift_start=time(7, 0),
        shift_end=time(15, 30),
        machine_id=machine.id,
        product_id=product.id,
        work_order_id=wo.id,
        target_quantity=Decimal('5000'),
        actual_quantity=Decimal('5100'),
        good_quantity=Decimal('5000'),
        reject_quantity=Decimal('100'),
        uom='pack',
        planned_runtime=510,
        actual_runtime=420,
        downtime_minutes=90,
        downtime_mesin=45,
        downtime_operator=25,
        downtime_material=0,
        downtime_design=0,
        downtime_others=0,
        idle_time=20,
        pack_per_carton=100,
        status='completed'
    )
    db_session.add(shift1)

    # Shift 2: 4800 good, 200 reject, 400 runtime, 80 downtime, 480 planned
    # Downtime: 30 min Mesin, 10 min Operator, 40 min Idle Time
    shift2 = ShiftProduction(
        production_date=date(2026, 7, 3),
        shift='shift_2',
        shift_start=time(15, 30),
        shift_end=time(23, 30),
        machine_id=machine.id,
        product_id=product.id,
        work_order_id=wo.id,
        target_quantity=Decimal('5000'),
        actual_quantity=Decimal('5000'),
        good_quantity=Decimal('4800'),
        reject_quantity=Decimal('200'),
        uom='pack',
        planned_runtime=480,
        actual_runtime=400,
        downtime_minutes=80,
        downtime_mesin=30,
        downtime_operator=10,
        downtime_material=0,
        downtime_design=0,
        downtime_others=0,
        idle_time=40,
        pack_per_carton=100,
        status='completed'
    )
    db_session.add(shift2)
    db_session.commit()

    # 4. Setup mock Downtime Records for the shifts
    dt1 = DowntimeRecord(
        shift_production_id=shift1.id,
        machine_id=machine.id,
        downtime_date=date(2026, 7, 3),
        start_time=datetime(2026, 7, 3, 8, 0),
        end_time=datetime(2026, 7, 3, 8, 45),
        duration_minutes=45,
        downtime_type='unplanned',
        downtime_category='breakdown',
        downtime_reason='Sensor kemasan mati'
    )
    db_session.add(dt1)

    dt2 = DowntimeRecord(
        shift_production_id=shift1.id,
        machine_id=machine.id,
        downtime_date=date(2026, 7, 3),
        start_time=datetime(2026, 7, 3, 9, 30),
        end_time=datetime(2026, 7, 3, 9, 55),
        duration_minutes=25,
        downtime_type='unplanned',
        downtime_category='operator_break',
        downtime_reason='Serah terima shift'
    )
    db_session.add(dt2)

    dt3 = DowntimeRecord(
        shift_production_id=shift2.id,
        machine_id=machine.id,
        downtime_date=date(2026, 7, 3),
        start_time=datetime(2026, 7, 3, 16, 0),
        end_time=datetime(2026, 7, 3, 16, 30),
        duration_minutes=30,
        downtime_type='unplanned',
        downtime_category='breakdown',
        downtime_reason='Mesin macet'
    )
    db_session.add(dt3)

    db_session.commit()

    # 5. Run Aggregator Function
    metrics = calculate_wo_completion_metrics(wo.id)
    
    assert metrics is not None
    assert metrics['wo_number'] == 'WO-2026-TEST'
    assert metrics['product_name'] == 'Test Tissue Wet Wipes'
    assert metrics['machine_name'] == 'Converting Machine Line 1'
    
    # Check aggregations
    # Total good = 5000 + 4800 = 9800
    assert metrics['total_grade_a'] == 9800.0
    # Total scrap = 100 + 200 = 300
    assert metrics['total_scrap'] == 300.0
    # Cartons = 9800 / 100 = 98.0
    assert metrics['total_cartons'] == 98.0
    # Total runtime = 420 + 400 = 820 min
    assert metrics['total_runtime_mins'] == 820
    # Total downtime = 90 + 80 = 170 min
    assert metrics['total_downtime_mins'] == 170
    
    # OEE efficiency = 820 / 990 * 100 = 82.82% -> 82.8%
    assert metrics['oee_efficiency_pct'] == 82.8

    # Downtime items:
    # Sensor kemasan mati = 45 min
    # Mesin macet = 30 min
    # Serah terima shift = 25 min
    downtime_list = metrics['downtime_items']
    assert len(downtime_list) == 3
    assert downtime_list[0] == ('Sensor kemasan mati', 45)
    assert downtime_list[1] == ('Mesin macet', 30)
    assert downtime_list[2] == ('Serah terima shift', 25)

    # Top 3 Categories:
    # Machine = 45 + 30 = 75 min
    # Idle Time = 20 + 40 = 60 min
    # Operator = 25 + 10 = 35 min
    top_cats = metrics['top_categories']
    assert len(top_cats) == 3
    assert top_cats[0] == ('Mesin (Breakdown/PM)', 75)
    assert top_cats[1] == ('Idle Time', 60)
    assert top_cats[2] == ('Operator', 35)

    # 6. Test Formatted Message Generation
    message = format_wo_completion_message(metrics)
    assert "📢 *NOTIFIKASI WORK ORDER SELESAI* 📢" in message
    assert "No. WO: *WO-2026-TEST*" in message
    assert "Sensor kemasan mati" in message
    assert "Mesin (Breakdown/PM)" in message
    print("\n✓ Aggregated Message Output:")
    print(message)

def test_trigger_twilio_notification(app, db_session, mocker):
    """
    Test triggering Twilio WhatsApp completion notifications by mocking HTTP requests.
    """
    from utils.production_notifications import trigger_wo_completion_whatsapp_notification
    import requests
    
    # Mock environment variables to ensure test isolation from developer's .env
    mocker.patch.dict('os.environ', {
        'TWILIO_TARGET_PHONES': '6281234567890',
        'TWILIO_ACCOUNT_SID': 'ACmocked123',
        'TWILIO_AUTH_TOKEN': 'auth_token_secret',
        'TWILIO_FROM_NUMBER': '+14155238886'
    })
    
    # Mock settings
    mocker.patch('utils.production_notifications.get_setting_value', side_effect=lambda key, default=None: {
        'notifications.whatsapp_enabled': 'true',
        'notifications.whatsapp_provider': 'twilio',
        'notifications.twilio_account_sid': 'ACxxxx', # Default placeholder triggers env fallback
        'notifications.twilio_auth_token': 'xxxxxx',
        'notifications.twilio_from_number': '+14155238886',
        'notifications.whatsapp_target_phones': '6281234567890'
    }.get(key, default))
    
    # Mock metrics calculation
    mock_metrics = {
        'wo_number': 'WO-2026-MOCK',
        'product_name': 'Mock Product',
        'machine_name': 'Mock Machine',
        'total_grade_a': 1000.0,
        'total_scrap': 50.0,
        'total_cartons': 10.0,
        'total_runtime_mins': 120,
        'total_downtime_mins': 10,
        'oee_efficiency_pct': 92.3,
        'downtime_items': [('Setup', 10)],
        'top_categories': [('Setup', 10)]
    }
    mocker.patch('utils.production_notifications.calculate_wo_completion_metrics', return_value=mock_metrics)
    
    # Mock requests.post
    mock_response = mocker.Mock()
    mock_response.status_code = 201
    mock_response.json.return_value = {'sid': 'SM123456'}
    mock_post = mocker.patch('requests.post', return_value=mock_response)
    
    # Trigger notification
    success = trigger_wo_completion_whatsapp_notification(99) # mock WO ID
    
    assert success is True
    
    # Verify post parameters
    mock_post.assert_called_once()
    call_args = mock_post.call_args
    url = call_args[0][0]
    kwargs = call_args[1]
    
    assert "ACmocked123" in url
    assert kwargs['auth'].username == 'ACmocked123'
    assert kwargs['auth'].password == 'auth_token_secret'
    assert kwargs['data']['From'] == 'whatsapp:+14155238886'
    assert kwargs['data']['To'] == 'whatsapp:6281234567890'
    assert "Mock Product" in kwargs['data']['Body']

