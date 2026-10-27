def test_flag_returned_and_cleared_on_change(client, db_session):
    from models.user import User
    u = User(username='tmpuser', email='tmp@x.com', password_hash='', full_name='Tmp', is_active=True, must_change_password=True)
    u.set_password('Temp#1234')
    db_session.add(u); db_session.commit()
    r = client.post('/api/auth/login', json={'username': 'tmpuser', 'password': 'Temp#1234'})
    assert r.status_code == 200 and r.get_json()['user']['must_change_password'] is True
    h = {'Authorization': 'Bearer ' + r.get_json()['access_token']}
    assert client.post('/api/auth/change-password', headers=h, json={'current_password': 'Temp#1234', 'new_password': 'Temp#1234'}).status_code == 400
    assert client.post('/api/auth/change-password', headers=h, json={'current_password': 'Temp#1234', 'new_password': 'Baru#56789'}).status_code == 200
    me = client.get('/api/auth/me', headers=h).get_json()['user']
    assert me['must_change_password'] is False


def test_admin_created_and_admin_reset_users_must_change(client, auth_headers):
    r = client.post('/api/settings/users', headers=auth_headers,
                    json={'username': 'newbie', 'email': 'newbie@x.com', 'password': 'Temp#1234', 'full_name': 'Newbie'})
    assert r.status_code in (200, 201), r.get_json()
    login = client.post('/api/auth/login', json={'username': 'newbie', 'password': 'Temp#1234'}).get_json()
    assert login['user']['must_change_password'] is True
    uid = login['user']['id']
    h = {'Authorization': 'Bearer ' + login['access_token']}
    client.post('/api/auth/change-password', headers=h, json={'current_password': 'Temp#1234', 'new_password': 'Baru#56789'})
    assert client.post('/api/auth/login', json={'username': 'newbie', 'password': 'Baru#56789'}).get_json()['user']['must_change_password'] is False
    r = client.put(f'/api/settings/users/{uid}', headers=auth_headers, json={'password': 'Reset#12345'})
    assert r.status_code == 200
    assert client.post('/api/auth/login', json={'username': 'newbie', 'password': 'Reset#12345'}).get_json()['user']['must_change_password'] is True


def test_admin_changing_own_password_via_settings_is_not_forced(client, auth_headers, test_user):
    r = client.put(f'/api/settings/users/{test_user.id}', headers=auth_headers, json={'password': 'Sendiri#12345'})
    assert r.status_code == 200
    d = client.post('/api/auth/login', json={'username': 'testuser', 'password': 'Sendiri#12345'}).get_json()
    assert d['user']['must_change_password'] is False
