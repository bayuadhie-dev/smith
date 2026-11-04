import base64
import io
import os

from datetime import date

PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')


def _po(db_session, test_user, approved):
    from models.purchasing import Supplier, PurchaseOrder, PurchaseOrderItem
    s = Supplier(code='SUP-SIG', company_name='Pemasok TTD')
    db_session.add(s); db_session.commit()
    po = PurchaseOrder(po_number='PO-SIG-1', supplier_id=s.id, order_date=date.today(), status='approved' if approved else 'draft',
                       subtotal=1000, tax_amount=0, total_amount=1000, created_by=test_user.id,
                       approved_by=test_user.id if approved else None)
    db_session.add(po); db_session.commit()
    db_session.add(PurchaseOrderItem(po_id=po.id, line_number=1, description='Barang', quantity=1, unit_price=1000, total_price=1000, uom='PCS'))
    db_session.commit()
    return po


def _doc(client, headers, po):
    from models.document_management import Document
    r = client.post(f'/api/documents/generate-from-purchase-order/{po.id}', headers=headers)
    assert r.status_code == 201, r.get_json()
    return Document.query.filter_by(reference_type='purchase_order', reference_id=po.id).order_by(Document.id.desc()).first()


def test_upload_validation_and_owner_only(client, auth_headers, app):
    app.config['UPLOAD_FOLDER'] = os.path.join(app.root_path, 'uploads_test')
    assert client.put('/api/signatures/me', headers=auth_headers, json={}).status_code == 400
    assert client.put('/api/signatures/me', headers=auth_headers, json={'image': 'data:image/png;base64,' + base64.b64encode(b'bukan gambar').decode()}).status_code == 400
    big = PNG + b'0' * (1024 * 1024 + 10)
    r = client.put('/api/signatures/me', headers=auth_headers, data={'file': (io.BytesIO(big), 'a.png')}, content_type='multipart/form-data')
    assert r.status_code == 400
    ok = client.put('/api/signatures/me', headers=auth_headers, json={'image': 'data:image/png;base64,' + base64.b64encode(PNG).decode()})
    assert ok.status_code == 200, ok.get_json()
    assert client.get('/api/signatures/me', headers=auth_headers).get_json()['has_signature'] is True
    img = client.get('/api/signatures/me/image', headers=auth_headers)
    assert img.status_code == 200 and img.data == PNG and img.mimetype == 'image/png'
    assert client.get('/api/signatures/me/image').status_code in (401, 422)
    assert client.get('/api/signatures/999999/image', headers=auth_headers).status_code in (403, 404)
    assert client.delete('/api/signatures/me', headers=auth_headers).status_code == 200
    assert client.get('/api/signatures/me', headers=auth_headers).get_json()['has_signature'] is False


def test_signature_appears_on_approved_po_and_is_frozen(client, auth_headers, db_session, test_user, app):
    app.config['UPLOAD_FOLDER'] = os.path.join(app.root_path, 'uploads_test')
    client.put('/api/signatures/me', headers=auth_headers, json={'image': 'data:image/png;base64,' + base64.b64encode(PNG).decode()})
    po = _po(db_session, test_user, approved=True)
    doc = _doc(client, auth_headers, po)
    sig = doc.document_data['signature']
    assert sig['approved_by']['image'].startswith('data:image/png;base64,') and sig['created_by']['name']
    assert sig['approved_by']['image'] in doc.html_content
    frozen = doc.html_content
    client.delete('/api/signatures/me', headers=auth_headers)   # menghapus/ganti belakangan tidak mengubah dokumen lama
    from models.document_management import Document
    assert Document.query.get(doc.id).html_content == frozen


def test_unapproved_po_has_blank_approver_and_missing_image_never_breaks_print(client, auth_headers, db_session, test_user, app):
    from models import UserSignature
    app.config['UPLOAD_FOLDER'] = os.path.join(app.root_path, 'uploads_test')
    client.put('/api/signatures/me', headers=auth_headers, json={'image': 'data:image/png;base64,' + base64.b64encode(PNG).decode()})
    po = _po(db_session, test_user, approved=False)
    d = _doc(client, auth_headers, po).document_data['signature']
    assert d['approved_by']['image'] == '' and d['created_by']['image']
    row = UserSignature.query.filter_by(user_id=test_user.id).first()
    os.remove(os.path.join(app.config['UPLOAD_FOLDER'], 'signatures', row.file_path))   # berkas hilang
    d2 = _doc(client, auth_headers, po).document_data['signature']
    assert d2['created_by']['image'] == ''
