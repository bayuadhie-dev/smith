import re
from datetime import datetime


def test_dashed_numbers_for_grn_and_manual_number(client, auth_headers, db_session, test_product):
    from models.purchasing import Supplier
    from models.purchasing import PurchaseOrder
    sup = Supplier(code='SUP-N1', company_name='PT N1'); db_session.add(sup); db_session.commit()
    ym = datetime.now().strftime('%Y-%m')
    nxt = client.get('/api/purchasing/grn/next-number', headers=auth_headers).get_json()['next_number']
    assert re.fullmatch(rf'BPB-{ym}-\d{{4}}', nxt), nxt


def test_generate_number_styles(app):
    from utils.helpers import generate_number, peek_number
    from models import db
    from models.purchasing import GoodsReceivedNote
    with app.app_context():
        a = generate_number('BPB', GoodsReceivedNote, 'grn_number', style='dashed')
        b = generate_number('BPB', GoodsReceivedNote, 'grn_number', style='dashed')
        ym = datetime.now().strftime('%Y-%m')
        assert a == f'BPB-{ym}-0001' and b == f'BPB-{ym}-0002'
        c = generate_number('XX', GoodsReceivedNote, 'grn_number')
        assert re.fullmatch(r'XX-\d{6}-00001', c)
        db.session.rollback()
