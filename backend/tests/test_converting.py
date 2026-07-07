import pytest
from datetime import date
from models import db, ConvertingMachine, ConvertingProduction

def test_converting_properties(app):
    """Test OEE hybrid/dynamic properties on ConvertingProduction model"""
    with app.app_context():
        # 1. Create a test converting machine
        machine = ConvertingMachine(
            code='TEST-MC-01',
            name='Test Machine',
            machine_type='bagmaker',
            default_speed=50.0,
            target_efficiency=70
        )
        db.session.add(machine)
        db.session.commit()

        # 2. Create a converting production record with JSON machine data
        prod = ConvertingProduction(
            production_date=date(2026, 7, 3),
            shift=1,
            machine_id=machine.id,
            grade_a=100.0,
            grade_b=10.0,
            loss_kg=5.0
        )
        prod.set_machine_data({
            'production_hour_minutes': 480,
            'downtime_minutes': 30,
            'idle_time': 10,
            'machine_speed': 5.0
        })
        db.session.add(prod)
        db.session.commit()

        # 3. Verify OEE dynamic properties
        assert prod.good_quantity == 100.0
        assert prod.reject_quantity == 10.0
        assert prod.actual_quantity == 110.0
        assert prod.planned_runtime == 480
        assert prod.downtime_minutes == 30
        assert prod.idle_time == 10
        assert prod.actual_runtime == 440
        assert prod.machine_speed == 5.0
        assert prod.quality_rate == round((100.0 / 110.0) * 100, 2)
        
        # Expected quantity = speed * runtime = 5 * 440 = 2200
        # Efficiency rate = (good_quantity / expected) * 100 = (100 / 2200) * 100 = 4.5454 -> 4.55%
        assert prod.efficiency_rate == 4.55

        # 4. Clean up
        db.session.delete(prod)
        db.session.delete(machine)
        db.session.commit()


def test_converting_monthly_summary_endpoint(client, app, auth_headers):
    """Test GET /api/converting/monthly-summary endpoint response and logic"""
    with app.app_context():
        # 1. Setup mock machine and records
        machine = ConvertingMachine(
            code='TEST-MC-02',
            name='Test Machine 2',
            machine_type='slitting',
            default_speed=120,
            target_efficiency=60
        )
        db.session.add(machine)
        db.session.commit()

        p1 = ConvertingProduction(
            production_date=date(2026, 5, 4), # Monday, first week of May 2026
            shift=1,
            machine_id=machine.id,
            grade_a=500.0,
            grade_b=50.0,
            loss_kg=10.0
        )
        p2 = ConvertingProduction(
            production_date=date(2026, 5, 20), # Outside first week
            shift=2,
            machine_id=machine.id,
            grade_a=800.0,
            grade_b=0.0,
            loss_kg=5.0
        )
        db.session.add_all([p1, p2])
        db.session.commit()

        # 2. Test monthly view
        res = client.get('/api/converting/monthly-summary?year=2026&month=5&view=monthly', headers=auth_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data['success'] is True
        assert data['summary']['total_output'] == 1350.0 # 550 + 800
        assert data['summary']['total_good'] == 1300.0 # 500 + 800
        assert data['summary']['total_reject'] == 50.0 # 50 + 0
        assert len(data['daily_records']) == 2
        
        # Verify production_records serialization
        assert 'production_records' in data['daily_records'][0]
        p_records = data['daily_records'][0]['production_records']
        assert len(p_records) == 1
        assert p_records[0]['machine_name'] == 'Test Machine 2'
        assert p_records[0]['good_quantity'] in [500.0, 800.0]

        # 3. Test weekly view (Week 1 of May 2026 starts first Monday May 4 to May 10)
        res_wk = client.get('/api/converting/monthly-summary?year=2026&month=5&view=weekly&week=1', headers=auth_headers)
        assert res_wk.status_code == 200
        data_wk = res_wk.get_json()
        assert data_wk['success'] is True
        assert data_wk['summary']['total_output'] == 550.0 # Only p1
        assert len(data_wk['daily_records']) == 1
        assert data_wk['daily_records'][0]['date'] == '2026-05-04'

        # 4. Cleanup
        db.session.delete(p1)
        db.session.delete(p2)
        db.session.delete(machine)
        db.session.commit()


def test_converting_downtime_categorization_and_properties(client, app, auth_headers):
    """Test detailed downtime entries, auto-categorization, and model properties in Converting"""
    with app.app_context():
        # 1. Create a test machine
        machine = ConvertingMachine(
            code='TEST-MC-DT-01',
            name='Test Machine Downtime',
            machine_type='cutting',
            default_speed=80.0,
            target_efficiency=80.0
        )
        db.session.add(machine)
        db.session.commit()

        # 2. Test create endpoint with downtime entries
        payload = {
            'production_date': '2026-07-06',
            'shift': 2,
            'machine_id': machine.id,
            'grade_a': 200,
            'grade_b': 10,
            'operator_name': 'Operator Test',
            'notes': 'Test downtime',
            'downtime_entries': [
                {'reason': 'pisau cutting rusak', 'duration_minutes': 15, 'frequency': 2}, # mesin: 30 mins
                {'reason': 'tunggu kain dari warehouse', 'duration_minutes': 10, 'frequency': 1}, # idle: 10 mins
                {'reason': 'kesalahan operator', 'duration_minutes': 5, 'frequency': 1} # operator: 5 mins
            ]
        }
        res = client.post('/api/converting/production', json=payload, headers=auth_headers)
        assert res.status_code == 201
        
        # 3. Load record and assert on dynamic model properties
        prod = ConvertingProduction.query.filter_by(machine_id=machine.id).first()
        assert prod is not None
        assert prod.downtime_minutes == 45 # 15*2 + 10 + 5
        assert prod.downtime_mesin == 30
        assert prod.downtime_idle == 10
        assert prod.downtime_operator == 5
        assert prod.downtime_material == 0
        assert prod.downtime_design == 0
        assert len(prod.downtime_entries) == 3
        
        # Verify detected categories in array
        assert prod.downtime_entries[0]['category'] == 'mesin'
        assert prod.downtime_entries[1]['category'] == 'idle'
        assert prod.downtime_entries[2]['category'] == 'operator'

        # 4. Clean up
        db.session.delete(prod)
        db.session.delete(machine)
        db.session.commit()


