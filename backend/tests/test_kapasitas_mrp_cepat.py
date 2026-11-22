"""Kalender kapasitas dimuat sekali, bukan per mesin per hari.

Halaman Perencanaan Kapasitas selalu kosong karena endpoint-nya memanggil
resolve_effective_calendar untuk tiap pasangan (mesin, tanggal) - ratusan
query berurutan, lewat dari batas waktu tunggu 10 detik di frontend.
"""
from datetime import timedelta

from utils.timezone import get_local_today


def test_cari_kalender_sama_dengan_resolver_lama(client, auth_headers, db_session):
    from models.batch_scheduling import GlobalCalendar, ExceptionCalendar, MachineCalendarOverride
    from routes.batch_scheduling import resolve_effective_calendar, muat_kalender, cari_kalender
    from models.production import Machine

    hari = get_local_today()
    db_session.add(GlobalCalendar(day_of_week=hari.weekday(), is_working_day=True,
                                  shift_count=2, shift_duration_hours=8))
    m = Machine(code='MC-KAP', name='Mesin Uji Kapasitas', machine_type='spunlace', is_active=True,
                capacity_per_hour=100, availability=90, efficiency=95)
    db_session.add(m)
    db_session.commit()

    # (1) hanya kalender global
    cache = muat_kalender([m.id], hari, hari + timedelta(days=2))
    assert cari_kalender(cache, m.id, hari) == resolve_effective_calendar(m.id, hari)

    # (2) ada pengecualian untuk tanggal itu
    db_session.add(ExceptionCalendar(exception_date=hari, is_working_day=False, reason='Libur uji'))
    db_session.commit()
    cache = muat_kalender([m.id], hari, hari + timedelta(days=2))
    assert cari_kalender(cache, m.id, hari) == resolve_effective_calendar(m.id, hari)

    # (3) ada override khusus mesin, yang paling menang
    db_session.add(MachineCalendarOverride(machine_id=m.id, override_date=hari, is_working_day=True,
                                           shift_count=3, shift_duration_hours=7, reason='Lembur uji'))
    db_session.commit()
    cache = muat_kalender([m.id], hari, hari + timedelta(days=2))
    hasil = cari_kalender(cache, m.id, hari)
    assert hasil == resolve_effective_calendar(m.id, hari)
    assert hasil['source'] == 'override' and hasil['shift_count'] == 3


def test_endpoint_kapasitas_menjawab(client, auth_headers, db_session):
    r = client.get('/api/mrp/capacity/resources', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    assert 'resources' in r.get_json()
    r2 = client.get('/api/mrp/capacity/timeline', headers=auth_headers)
    assert r2.status_code == 200, r2.get_json()
    assert len(r2.get_json()['timeline']) == 14
