import io


def test_attachment_roundtrip(client, auth_headers):
    r = client.post('/api/attachments', data={'entity_type': 'payment', 'entity_id': '1',
                    'file': (io.BytesIO(b'hello'), 'bukti.pdf')}, headers=auth_headers, content_type='multipart/form-data')
    assert r.status_code == 201, r.get_json()
    aid = r.get_json()['id']
    assert client.get('/api/attachments?entity_type=payment&entity_id=1', headers=auth_headers).get_json()['attachments']
    assert client.get(f'/api/attachments/{aid}/file', headers=auth_headers).data == b'hello'
    bad = client.post('/api/attachments', data={'entity_type': 'payment', 'entity_id': '1',
                      'file': (io.BytesIO(b'x'), 'a.exe')}, headers=auth_headers, content_type='multipart/form-data')
    assert bad.status_code == 400
    assert client.delete(f'/api/attachments/{aid}', headers=auth_headers).status_code == 200
