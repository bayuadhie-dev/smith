from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, date
from models import db
from models.purchasing import PurchaseRequisition, PRItem, PurchaseOrder, PurchaseOrderItem, Supplier
from models.user import User
from utils import generate_number

pr_bp = Blueprint('purchase_requisition', __name__)


def generate_pr_number():
    today = date.today()
    prefix = f"PR-{today.strftime('%Y%m')}-"
    last = PurchaseRequisition.query.filter(
        PurchaseRequisition.pr_number.like(f"{prefix}%")
    ).order_by(PurchaseRequisition.pr_number.desc()).first()
    seq = 1
    if last:
        try:
            seq = int(last.pr_number.split('-')[-1]) + 1
        except ValueError:
            pass
    return f"{prefix}{seq:04d}"


def format_pr(pr):
    return {
        'id': pr.id,
        'pr_number': pr.pr_number,
        'requested_by': pr.requested_by,
        'requester_name': pr.requester.full_name if pr.requester else None,
        'department': pr.department,
        'request_date': pr.request_date.isoformat() if pr.request_date else None,
        'required_date': pr.required_date.isoformat() if pr.required_date else None,
        'purpose': pr.purpose,
        'status': pr.status,
        'priority': pr.priority,
        'approved_by': pr.approved_by,
        'approver_name': pr.approver.full_name if pr.approver else None,
        'approved_at': pr.approved_at.isoformat() if pr.approved_at else None,
        'rejection_reason': pr.rejection_reason,
        'converted_to_po_id': pr.converted_to_po_id,
        'converted_po_number': pr.converted_po.po_number if pr.converted_po else None,
        'notes': pr.notes,
        'created_at': pr.created_at.isoformat() if pr.created_at else None,
        'items': [format_pr_item(i) for i in pr.items],
        'total_estimated': float(sum(
            float(i.estimated_total or 0) for i in pr.items
        )),
    }


def format_pr_item(item):
    return {
        'id': item.id,
        'pr_id': item.pr_id,
        'line_number': item.line_number,
        'material_id': item.material_id,
        'product_id': item.product_id,
        'item_name': item.item_name,
        'item_code': item.item_code,
        'quantity': float(item.quantity),
        'uom': item.uom,
        'estimated_unit_price': float(item.estimated_unit_price) if item.estimated_unit_price else None,
        'estimated_total': float(item.estimated_total) if item.estimated_total else None,
        'preferred_supplier_id': item.preferred_supplier_id,
        'preferred_supplier_name': item.preferred_supplier.company_name if item.preferred_supplier else None,
        'notes': item.notes,
    }


# ─── LIST ────────────────────────────────────────────────────────────────────

@pr_bp.route('/purchase-requisitions', methods=['GET'])
@jwt_required()
def list_prs():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        status = request.args.get('status')
        priority = request.args.get('priority')
        requested_by = request.args.get('requested_by', type=int)
        search = request.args.get('search', '').strip()

        q = PurchaseRequisition.query
        if status:
            q = q.filter(PurchaseRequisition.status == status)
        if priority:
            q = q.filter(PurchaseRequisition.priority == priority)
        if requested_by:
            q = q.filter(PurchaseRequisition.requested_by == requested_by)
        if search:
            q = q.filter(PurchaseRequisition.pr_number.ilike(f'%{search}%'))

        q = q.order_by(PurchaseRequisition.created_at.desc())
        paginated = q.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'requisitions': [format_pr(pr) for pr in paginated.items],
            'total': paginated.total,
            'pages': paginated.pages,
            'current_page': page,
        }), 200
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'detail': traceback.format_exc()}), 500


# ─── GET ONE ─────────────────────────────────────────────────────────────────

@pr_bp.route('/purchase-requisitions/<int:pr_id>', methods=['GET'])
@jwt_required()
def get_pr(pr_id):
    pr = db.session.get(PurchaseRequisition, pr_id)
    if not pr:
        return jsonify({'error': 'Purchase Requisition not found'}), 404
    return jsonify(format_pr(pr)), 200


# ─── CREATE ──────────────────────────────────────────────────────────────────

@pr_bp.route('/purchase-requisitions', methods=['POST'])
@jwt_required()
def create_pr():
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json()

        pr = PurchaseRequisition(
            pr_number=generate_pr_number(),
            requested_by=data.get('requested_by', user_id),
            department=data.get('department'),
            request_date=datetime.strptime(data['request_date'], '%Y-%m-%d').date() if data.get('request_date') else date.today(),
            required_date=datetime.strptime(data['required_date'], '%Y-%m-%d').date() if data.get('required_date') else None,
            purpose=data.get('purpose'),
            status='draft',
            priority=data.get('priority', 'normal'),
            notes=data.get('notes'),
        )
        db.session.add(pr)
        db.session.flush()

        for idx, item_data in enumerate(data.get('items', []), start=1):
            qty = float(item_data.get('quantity', 0))
            unit_price = float(item_data.get('estimated_unit_price') or 0)
            item = PRItem(
                pr_id=pr.id,
                line_number=idx,
                material_id=item_data.get('material_id'),
                product_id=item_data.get('product_id'),
                item_name=item_data['item_name'],
                item_code=item_data.get('item_code'),
                quantity=qty,
                uom=item_data.get('uom', 'pcs'),
                estimated_unit_price=unit_price or None,
                estimated_total=qty * unit_price if unit_price else None,
                preferred_supplier_id=item_data.get('preferred_supplier_id'),
                notes=item_data.get('notes'),
            )
            db.session.add(item)

        db.session.commit()
        return jsonify(format_pr(pr)), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ─── UPDATE ──────────────────────────────────────────────────────────────────

@pr_bp.route('/purchase-requisitions/<int:pr_id>', methods=['PUT'])
@jwt_required()
def update_pr(pr_id):
    try:
        pr = db.session.get(PurchaseRequisition, pr_id)
        if not pr:
            return jsonify({'error': 'Purchase Requisition not found'}), 404
        if pr.status not in ('draft',):
            return jsonify({'error': 'Hanya PR berstatus draft yang bisa diedit'}), 400

        data = request.get_json()
        if 'department' in data:
            pr.department = data['department']
        if 'required_date' in data:
            pr.required_date = datetime.strptime(data['required_date'], '%Y-%m-%d').date() if data['required_date'] else None
        if 'purpose' in data:
            pr.purpose = data['purpose']
        if 'priority' in data:
            pr.priority = data['priority']
        if 'notes' in data:
            pr.notes = data['notes']

        if 'items' in data:
            PRItem.query.filter_by(pr_id=pr.id).delete()
            for idx, item_data in enumerate(data['items'], start=1):
                qty = float(item_data.get('quantity', 0))
                unit_price = float(item_data.get('estimated_unit_price') or 0)
                item = PRItem(
                    pr_id=pr.id,
                    line_number=idx,
                    material_id=item_data.get('material_id'),
                    product_id=item_data.get('product_id'),
                    item_name=item_data['item_name'],
                    item_code=item_data.get('item_code'),
                    quantity=qty,
                    uom=item_data.get('uom', 'pcs'),
                    estimated_unit_price=unit_price or None,
                    estimated_total=qty * unit_price if unit_price else None,
                    preferred_supplier_id=item_data.get('preferred_supplier_id'),
                    notes=item_data.get('notes'),
                )
                db.session.add(item)

        db.session.commit()
        return jsonify(format_pr(pr)), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ─── SUBMIT FOR APPROVAL ─────────────────────────────────────────────────────

@pr_bp.route('/purchase-requisitions/<int:pr_id>/submit', methods=['POST'])
@jwt_required()
def submit_pr(pr_id):
    try:
        pr = db.session.get(PurchaseRequisition, pr_id)
        if not pr:
            return jsonify({'error': 'Purchase Requisition not found'}), 404
        if pr.status != 'draft':
            return jsonify({'error': 'Hanya PR berstatus draft yang bisa diajukan'}), 400
        if not pr.items:
            return jsonify({'error': 'PR harus memiliki minimal 1 item'}), 400

        pr.status = 'submitted'
        db.session.commit()
        return jsonify({'message': 'PR berhasil diajukan untuk approval', 'pr': format_pr(pr)}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ─── APPROVE / REJECT ────────────────────────────────────────────────────────

@pr_bp.route('/purchase-requisitions/<int:pr_id>/approve', methods=['POST'])
@jwt_required()
def approve_pr(pr_id):
    try:
        user_id = int(get_jwt_identity())
        pr = db.session.get(PurchaseRequisition, pr_id)
        if not pr:
            return jsonify({'error': 'Purchase Requisition not found'}), 404
        if pr.status != 'submitted':
            return jsonify({'error': 'Hanya PR berstatus submitted yang bisa di-approve'}), 400

        data = request.get_json() or {}
        action = data.get('action', 'approve')  # approve or reject

        if action == 'approve':
            pr.status = 'approved'
            pr.approved_by = user_id
            pr.approved_at = datetime.utcnow()
            pr.rejection_reason = None
            msg = 'PR berhasil di-approve'
        else:
            pr.status = 'rejected'
            pr.approved_by = user_id
            pr.approved_at = datetime.utcnow()
            pr.rejection_reason = data.get('rejection_reason', '')
            msg = 'PR ditolak'

        db.session.commit()
        return jsonify({'message': msg, 'pr': format_pr(pr)}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ─── CONVERT TO PO ───────────────────────────────────────────────────────────

@pr_bp.route('/purchase-requisitions/<int:pr_id>/convert-to-po', methods=['POST'])
@jwt_required()
def convert_pr_to_po(pr_id):
    try:
        user_id = int(get_jwt_identity())
        pr = db.session.get(PurchaseRequisition, pr_id)
        if not pr:
            return jsonify({'error': 'Purchase Requisition not found'}), 404
        if pr.status != 'approved':
            return jsonify({'error': 'Hanya PR yang sudah di-approve yang bisa dikonversi ke PO'}), 400
        if pr.converted_to_po_id:
            return jsonify({'error': 'PR ini sudah pernah dikonversi ke PO', 'po_id': pr.converted_to_po_id}), 400

        data = request.get_json() or {}
        supplier_id = data.get('supplier_id')
        if not supplier_id:
            return jsonify({'error': 'supplier_id wajib diisi'}), 400

        # Generate PO number
        po_number = generate_number('PO', PurchaseOrder, 'po_number')

        po = PurchaseOrder(
            po_number=po_number,
            supplier_id=supplier_id,
            order_date=date.today(),
            required_date=pr.required_date,
            status='draft',
            payment_terms=data.get('payment_terms'),
            notes=f"Dibuat dari PR {pr.pr_number}. {pr.notes or ''}".strip(),
            created_by=user_id,
        )
        db.session.add(po)
        db.session.flush()

        for idx, item in enumerate(pr.items, start=1):
            po_item = PurchaseOrderItem(
                po_id=po.id,
                line_number=idx,
                material_id=item.material_id,
                product_id=item.product_id,
                item_name=item.item_name,
                item_code=item.item_code,
                quantity=float(item.quantity),
                uom=item.uom,
                unit_price=float(item.estimated_unit_price or 0),
                total_price=float(item.estimated_total or 0),
                notes=item.notes,
            )
            db.session.add(po_item)

        pr.converted_to_po_id = po.id
        pr.status = 'converted'
        db.session.commit()

        return jsonify({
            'message': f'PR berhasil dikonversi ke {po.po_number}',
            'po_id': po.id,
            'po_number': po.po_number,
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ─── DELETE (draft only) ─────────────────────────────────────────────────────

@pr_bp.route('/purchase-requisitions/<int:pr_id>', methods=['DELETE'])
@jwt_required()
def delete_pr(pr_id):
    try:
        pr = db.session.get(PurchaseRequisition, pr_id)
        if not pr:
            return jsonify({'error': 'Purchase Requisition not found'}), 404
        if pr.status != 'draft':
            return jsonify({'error': 'Hanya PR berstatus draft yang bisa dihapus'}), 400

        db.session.delete(pr)
        db.session.commit()
        return jsonify({'message': 'PR berhasil dihapus'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
