"""Ubah nomor dokumen dan hapus dokumen yang belum dipakai (generik untuk PO, GRN, faktur, pembayaran, uang muka)."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, Invoice, Payment, PurchaseOrder, AccountingEntry
from models.approval_workflow import ApprovalWorkflow, ApprovalHistory, PendingJournalEntry
from models.purchasing import GoodsReceivedNote
from models.purchase_down_payment import PurchaseDownPayment, PurchaseDownPaymentAllocation
from utils.auth_decorators import require_permission

doc_actions_bp = Blueprint('doc_actions', __name__)

# type -> (model, kolom nomor, izin ubah/hapus, tipe referensi jurnal)
REGISTRY = {
    'purchase_order': (PurchaseOrder, 'po_number', 'purchase_orders.edit', 'purchase_orders.delete', ('purchase_order',)),
    'grn': (GoodsReceivedNote, 'grn_number', 'purchasing.edit', 'purchasing.delete', ('grn', 'goods_received_note')),
    'purchase_invoice': (Invoice, 'invoice_number', 'purchasing.edit', 'purchasing.delete', ('purchase_invoice', 'invoice')),
    'sales_invoice': (Invoice, 'invoice_number', 'finance.edit', 'finance.delete', ('sales_invoice', 'invoice')),
    'payment': (Payment, 'payment_number', 'finance.edit', 'finance.delete', ('payment',)),
    'purchase_down_payment': (PurchaseDownPayment, 'dp_number', 'purchasing.edit', 'purchasing.delete', ('purchase_down_payment',)),
}


def _perm_ok(user_id, perm):
    from models import User
    from utils.auth_decorators import _get_user_permissions
    u = db.session.get(User, user_id)
    return bool(u and (getattr(u, 'is_super_admin', False) or perm in _get_user_permissions(u)))


def _load(doc_type, doc_id):
    cfg = REGISTRY.get(doc_type)
    if not cfg:
        return None, None, (jsonify({'error': 'Jenis dokumen tidak dikenal'}), 404)
    obj = db.session.get(cfg[0], doc_id)
    if not obj:
        return None, None, (jsonify({'error': 'Dokumen tidak ditemukan'}), 404)
    if doc_type == 'purchase_invoice' and obj.invoice_type != 'purchase':
        return None, None, (jsonify({'error': 'Dokumen tidak ditemukan'}), 404)
    if doc_type == 'sales_invoice' and obj.invoice_type != 'sales':
        return None, None, (jsonify({'error': 'Dokumen tidak ditemukan'}), 404)
    return cfg, obj, None


def _entries(cfg, doc_id):
    refs = list(cfg[4]) + [f'void_{r}' for r in cfg[4]]
    return AccountingEntry.query.filter(AccountingEntry.reference_type.in_(refs), AccountingEntry.reference_id == doc_id)


@doc_actions_bp.route('/<doc_type>/<int:doc_id>/number', methods=['PUT'])
@jwt_required()
def change_number(doc_type, doc_id):
    cfg, obj, err = _load(doc_type, doc_id)
    if err:
        return err
    uid = get_jwt_identity()
    if not _perm_ok(int(uid), cfg[2]):
        return jsonify({'error': 'Permission denied'}), 403
    new = ((request.get_json(silent=True) or {}).get('number') or '').strip()
    if not new or len(new) > 100:
        return jsonify({'error': 'Nomor wajib diisi (maksimal 100 karakter)'}), 400
    field = cfg[1]
    old = getattr(obj, field)
    if new == old:
        return jsonify({'message': 'Nomor tidak berubah', 'number': old}), 200
    if db.session.query(cfg[0]).filter(getattr(cfg[0], field) == new).first():
        return jsonify({'error': f'Nomor {new} sudah dipakai dokumen lain'}), 400
    setattr(obj, field, new)
    for e in _entries(cfg, doc_id).all():
        if e.reference_number == old:
            e.reference_number = new
        if e.description and old in e.description:
            e.description = e.description.replace(old, new)
    if doc_type == 'purchase_order':
        for w in ApprovalWorkflow.query.filter_by(transaction_type='purchase_order', transaction_id=doc_id).all():
            w.transaction_number = new
    db.session.commit()
    return jsonify({'message': 'Nomor diubah', 'number': new, 'old_number': old}), 200


def _blockers(doc_type, obj, cfg, doc_id):
    """Alasan dokumen tidak boleh dihapus; kosong = belum terpakai."""
    out = []
    if _entries(cfg, doc_id).first():
        out.append('sudah ada jurnal terkait (batalkan/void transaksinya, jangan dihapus)')
    if doc_type == 'purchase_order':
        if obj.grn_records:
            out.append('sudah ada Penerimaan Barang (GRN)')
        if Invoice.query.filter(Invoice.purchase_order_id == doc_id, Invoice.invoice_type == 'purchase', Invoice.status != 'cancelled').first():
            out.append('sudah ada Faktur Pembelian')
        if PurchaseDownPayment.query.filter(PurchaseDownPayment.po_id == doc_id, PurchaseDownPayment.status != 'cancelled').first():
            out.append('sudah ada Uang Muka Pembelian')
    elif doc_type == 'grn':
        if Invoice.query.filter(Invoice.purchase_order_id == obj.po_id, Invoice.invoice_type == 'purchase', Invoice.status != 'cancelled').first() if obj.po_id else False:
            out.append('PO-nya sudah difakturkan')
        out.append('stok sudah bertambah (gunakan Retur Pembelian)')
    elif doc_type in ('purchase_invoice', 'sales_invoice'):
        if float(obj.paid_amount or 0) > 0:
            out.append('sudah ada pembayaran')
        if Payment.query.filter_by(invoice_id=doc_id).first():
            out.append('sudah dirujuk pembayaran')
        if PurchaseDownPaymentAllocation.query.filter_by(invoice_id=doc_id, status='active').first():
            out.append('sudah dialokasikan uang muka')
    elif doc_type == 'payment':
        if obj.allocations:
            out.append('sudah dialokasikan ke faktur')
    elif doc_type == 'purchase_down_payment':
        if PurchaseDownPaymentAllocation.query.filter_by(down_payment_id=doc_id, status='active').first():
            out.append('sudah dialokasikan ke faktur')
    return out


@doc_actions_bp.route('/<doc_type>/<int:doc_id>/can-delete', methods=['GET'])
@jwt_required()
def can_delete(doc_type, doc_id):
    cfg, obj, err = _load(doc_type, doc_id)
    if err:
        return err
    reasons = _blockers(doc_type, obj, cfg, doc_id)
    return jsonify({'can_delete': not reasons, 'reasons': reasons})


@doc_actions_bp.route('/<doc_type>/<int:doc_id>', methods=['DELETE'])
@jwt_required()
def delete_doc(doc_type, doc_id):
    cfg, obj, err = _load(doc_type, doc_id)
    if err:
        return err
    if not _perm_ok(int(get_jwt_identity()), cfg[3]):
        return jsonify({'error': 'Permission denied'}), 403
    reasons = _blockers(doc_type, obj, cfg, doc_id)
    if reasons:
        return jsonify({'error': 'Tidak bisa dihapus karena ' + '; '.join(reasons)}), 400
    try:
        if doc_type == 'purchase_order':
            if obj.status == 'approved':
                from utils.finance_helpers import release_po_budget_commitment
                release_po_budget_commitment(obj)
            for w in ApprovalWorkflow.query.filter_by(transaction_type='purchase_order', transaction_id=doc_id).all():
                PendingJournalEntry.query.filter_by(workflow_id=w.id).delete()
                ApprovalHistory.query.filter_by(workflow_id=w.id).delete()
                db.session.delete(w)
        number = getattr(obj, cfg[1])
        db.session.delete(obj)
        db.session.commit()
        return jsonify({'message': f'{number} dihapus'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Gagal menghapus: {e}'}), 500
