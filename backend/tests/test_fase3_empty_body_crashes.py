"""
Fase 3 (fix_report_2.md, lanjutan audit): beberapa endpoint memanggil
`request.get_json()` tanpa `or {}`, sehingga body request kosong (atau
Content-Type yang bukan application/json) membuat `data` jadi `None` dan
baris berikutnya (`data.get(...)` atau `data[...]`) crash dengan
AttributeError/TypeError alih-alih mengembalikan error 4xx yang jelas.

Ditemukan pertama di reject_purchase_return() (routes/purchase_return.py),
lalu di-grep ke seluruh routes/purchase_return.py dan routes/returns.py -
6 lokasi total di 2 file itu. Endpoint void di routes/finance.py sudah
aman (`request.get_json(silent=True) or {}`, dari fix_report.md Fase 3).

Diverifikasi lewat endpoint HTTP asli, POST tanpa body sama sekali (bukan
body kosong `{}` - benar-benar tanpa payload/tanpa Content-Type JSON).
"""
from datetime import date


def test_reject_purchase_return_with_no_body_does_not_crash(client, auth_headers, db_session):
    from models.purchasing import Supplier
    from models.finance import Invoice
    from models.purchasing import PurchaseReturn

    supplier = Supplier(code='SUP-FASE3-01', company_name='Test Supplier Fase 3', is_active=True)
    db_session.add(supplier)
    db_session.commit()

    invoice = Invoice(
        invoice_number='PI-FASE3-001', invoice_type='purchase', invoice_date=date.today(),
        supplier_id=supplier.id, subtotal=100000, total_amount=100000, status='sent',
    )
    db_session.add(invoice)
    db_session.commit()

    pr = PurchaseReturn(
        return_number='PR-FASE3-001', invoice_id=invoice.id, supplier_id=supplier.id,
        return_date=date.today(), reason='defective', return_type='defective',
        status='draft', approval_status='pending',
    )
    db_session.add(pr)
    db_session.commit()

    # POST tanpa body sama sekali dan tanpa header Content-Type - ini yang
    # membuat Flask's request.get_json() (tanpa silent=True) return None
    # alih-alih {}, atau melempar error langsung tergantung versi Flask -
    # baik None maupun exception awal sama-sama mewakili "body kosong".
    resp = client.post(
        f'/api/purchasing/purchase-returns/{pr.id}/reject',
        headers=auth_headers,
    )
    assert resp.status_code in (200, 400), (
        f"Endpoint crash (500) saat body kosong, seharusnya 200 (berhasil, notes kosong) "
        f"atau 400 (ditolak dengan jelas): {resp.status_code} {resp.get_json()}"
    )


def test_create_purchase_return_with_no_body_returns_4xx_not_500(client, auth_headers, db_session):
    resp = client.post('/api/purchasing/purchase-returns', headers=auth_headers)
    assert resp.status_code in (400, 404), (
        f"Body kosong pada create harus 4xx yang jelas, bukan 500: {resp.status_code} {resp.get_json()}"
    )


def test_update_purchase_return_with_no_body_returns_4xx_not_500(client, auth_headers, db_session):
    from models.purchasing import Supplier
    from models.finance import Invoice
    from models.purchasing import PurchaseReturn

    supplier = Supplier(code='SUP-FASE3-02', company_name='Test Supplier Fase 3b', is_active=True)
    db_session.add(supplier)
    db_session.commit()
    invoice = Invoice(
        invoice_number='PI-FASE3-002', invoice_type='purchase', invoice_date=date.today(),
        supplier_id=supplier.id, subtotal=50000, total_amount=50000, status='sent',
    )
    db_session.add(invoice)
    db_session.commit()
    pr = PurchaseReturn(
        return_number='PR-FASE3-002', invoice_id=invoice.id, supplier_id=supplier.id,
        return_date=date.today(), reason='wrong_item', return_type='wrong_item',
        status='draft', approval_status='pending',
    )
    db_session.add(pr)
    db_session.commit()

    resp = client.put(f'/api/purchasing/purchase-returns/{pr.id}', headers=auth_headers)
    assert resp.status_code in (200, 400), (
        f"Body kosong pada update harus 200 (no-op) atau 4xx yang jelas, bukan 500: "
        f"{resp.status_code} {resp.get_json()}"
    )


def test_create_customer_return_with_no_body_returns_4xx_not_500(client, auth_headers, db_session):
    resp = client.post('/api/returns/', headers=auth_headers)
    assert resp.status_code == 400, (
        f"Body kosong pada create retur penjualan harus 400 yang jelas, bukan 500: "
        f"{resp.status_code} {resp.get_json()}"
    )


def test_create_qc_inspection_with_no_body_returns_4xx_not_500(client, auth_headers, db_session, test_customer):
    from models.returns import CustomerReturn

    cr = CustomerReturn(
        return_number='RTN-FASE3-001', customer_id=test_customer.id, return_date=date.today(),
        reason='defective', status='received',
    )
    db_session.add(cr)
    db_session.commit()

    resp = client.post(f'/api/returns/{cr.id}/qc', headers=auth_headers)
    assert resp.status_code == 400, (
        f"Body kosong pada QC inspection harus 400 yang jelas, bukan 500: {resp.status_code} {resp.get_json()}"
    )


def test_create_disposition_with_no_body_returns_4xx_not_500(client, auth_headers, db_session, test_customer):
    from models.returns import CustomerReturn

    cr = CustomerReturn(
        return_number='RTN-FASE3-002', customer_id=test_customer.id, return_date=date.today(),
        reason='defective', status='received',
    )
    db_session.add(cr)
    db_session.commit()

    resp = client.post(f'/api/returns/{cr.id}/disposition', headers=auth_headers)
    assert resp.status_code in (200, 201, 400), (
        f"Body kosong pada disposition harus 200/201/400, bukan 500: {resp.status_code} {resp.get_json()}"
    )
