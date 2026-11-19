"""Document numbers built from a template (NumberSequence.number_format).

Finance writes purchase orders as 26-11-OLC-011 - year, month, their own text,
then a sequence that restarts every year. These tests pin the rendering, the
yearly restart, and that an existing hand-typed number is continued rather than
collided with.
"""
from datetime import datetime

from models import db
from models.finance import NumberSequence
from models.purchasing import PurchaseOrder, Supplier
from utils.helpers import (format_like_pattern, generate_from_format, peek_from_format,
                           render_number_format)


def test_render_and_like_pattern():
    now = datetime(2026, 11, 19)
    assert render_number_format('YY-MM-OLC-###', 11, now) == '26-11-OLC-011'
    assert render_number_format('YY-MM-OLC-####', 11, now) == '26-11-OLC-0011'
    # the sequence outgrowing its padding still prints, it does not get cut
    assert render_number_format('YY-MM-OLC-###', 1234, now) == '26-11-OLC-1234'
    assert render_number_format('PO/YYYY/MM/###', 7, now) == 'PO/2026/11/007'

    # a yearly counter spans every month, so the month is a wildcard when
    # looking for numbers that already exist
    assert format_like_pattern('YY-MM-OLC-###', 'year', now) == '26-%-OLC-%'
    assert format_like_pattern('YY-MM-OLC-###', 'month', now) == '26-11-OLC-%'


def test_sequence_continues_from_numbers_typed_by_hand(client, auth_headers, db_session):
    supplier = Supplier(code='SUP-FMT', company_name='PT Uji Format')
    db_session.add(supplier)
    db_session.commit()
    now = datetime(2026, 11, 19)

    # what Finance already entered manually, including an earlier month
    for no in ('26-10-OLC-007', '26-11-OLC-011'):
        db_session.add(PurchaseOrder(po_number=no, supplier_id=supplier.id, order_date=now.date(),
                                     status='draft', currency='IDR', subtotal=0, tax_amount=0,
                                     total_amount=0))
    db_session.commit()

    nxt = peek_from_format('purchase_order', 'YY-MM-OLC-###', 'year', PurchaseOrder, 'po_number', now)
    assert nxt == '26-11-OLC-012'          # continues after the highest of the year
    assert generate_from_format('purchase_order', 'YY-MM-OLC-###', 'year', PurchaseOrder, 'po_number', now) == '26-11-OLC-012'
    assert generate_from_format('purchase_order', 'YY-MM-OLC-###', 'year', PurchaseOrder, 'po_number', now) == '26-11-OLC-013'

    # next year starts again at 1, same template
    nye = datetime(2027, 1, 2)
    assert generate_from_format('purchase_order', 'YY-MM-OLC-###', 'year', PurchaseOrder, 'po_number', nye) == '27-01-OLC-001'


def test_sequence_api_validates_the_template(client, auth_headers, db_session):
    bad = client.post('/api/finance/number-sequences', headers=auth_headers,
                      json={'sequence_key': 'uji_fmt', 'prefix': 'UJI', 'number_format': 'YY-MM-OLC'})
    assert bad.status_code == 400 and '#' in bad.get_json()['error']

    ok = client.post('/api/finance/number-sequences', headers=auth_headers,
                     json={'sequence_key': 'uji_fmt', 'prefix': 'UJI', 'number_format': 'YY-MM-OLC-###',
                           'reset_period': 'year', 'description': 'Uji'})
    assert ok.status_code == 200, ok.get_json()

    rows = client.get('/api/finance/number-sequences', headers=auth_headers).get_json()['number_sequences']
    row = next(r for r in rows if r['sequence_key'] == 'uji_fmt')
    assert row['number_format'] == 'YY-MM-OLC-###' and row['reset_period'] == 'year'
    assert row['preview'].endswith('-OLC-001')

    wrong_reset = client.post('/api/finance/number-sequences', headers=auth_headers,
                              json={'sequence_key': 'uji_fmt', 'prefix': 'UJI', 'reset_period': 'harian'})
    assert wrong_reset.status_code == 400
