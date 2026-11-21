"""Kehadiran pengguna setelah obrolan dihapus: dibaca dari audit, bukan detak chat."""


def test_daftar_pengguna_aktif_tetap_jalan_tanpa_obrolan(client, auth_headers, db_session):
    from models.settings_extended import AuditLog
    from datetime import datetime, timedelta

    db_session.add(AuditLog(user_id=1, action='read', resource_type='test',
                            timestamp=datetime.utcnow() - timedelta(minutes=1), status='success'))
    db_session.commit()

    r = client.get('/api/executive/active-users', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    d = r.get_json()['data']
    assert d['total_users'] >= 1
    aku = [u for u in d['users'] if u['id'] == 1]
    assert aku and aku[0]['status'] in ('online', 'recent'), aku
