from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.auth_decorators import require_permission
from datetime import datetime, date
from models import db
from models.purchasing import PurchaseRequisition, PRItem, PurchaseOrder, PurchaseOrderItem, Supplier, PRApproval
from models.user import User, Role
from utils import generate_number, generate_number_v2

pr_bp = Blueprint('purchase_requisition', __name__)

# Tiered approval thresholds (2026-10-16) - amounts in Rupiah, compared
# against PR's total_estimated (sum of PRItem.estimated_total). Below the
# first threshold, PR auto-approves with no approval steps at all (reusing
# the intent of the already-registered-but-never-wired-up 'purchasing.
# pr_auto_approve_limit' setting - kept as a hardcoded constant here rather
# than reading that setting key, since that key was never actually
# consumed anywhere and this gives an explicit, auditable starting point;
# revisit if the setting needs to be admin-editable later).
PR_AUTO_APPROVE_LIMIT = 1_000_000
PR_TIER2_THRESHOLD = 50_000_000  # above this, needs Manager AND Direktur


def _pr_total_estimated(pr):
    return float(sum(float(i.estimated_total or 0) for i in pr.items))


def _create_pr_approval_levels(pr):
    """Create the PRApproval rows this PR needs based on its total estimated
    amount, and set pr.status accordingly. Does not commit - caller does."""
    total = _pr_total_estimated(pr)

    if total < PR_AUTO_APPROVE_LIMIT:
        pr.status = 'approved'
        pr.approved_by = None
        pr.approved_at = datetime.utcnow()
        pr.rejection_reason = None
        return []

    manager_role = Role.query.filter_by(name='manager').first()
    direktur_role = Role.query.filter_by(name='Direktur').first()

    levels_needed = [manager_role] if total < PR_TIER2_THRESHOLD else [manager_role, direktur_role]
    created = []
    for level_num, role in enumerate(levels_needed, start=1):
        if not role:
            continue
        step = PRApproval(pr_id=pr.id, approval_level=level_num, required_role_id=role.id, status='pending')
        db.session.add(step)
        created.append(step)

    pr.status = 'submitted'
    return created


def format_pr_approval_step(step):
    return {
        'id': step.id,
        'approval_level': step.approval_level,
        'required_role_id': step.required_role_id,
        'required_role_name': step.required_role.name if step.required_role else None,
        'approver_id': step.approver_id,
        'approver_name': step.approver.full_name if step.approver else None,
        'status': step.status,
        'comments': step.comments,
        'approved_at': step.approved_at.isoformat() if step.approved_at else None,
    }


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
        # fix_report_3.md Fase 16 (2026-10-02): traceability balik ke SO
        # yang memicu PR ini otomatis saat SO confirm mendeteksi kekurangan
        # bahan baku - lihat utils.sales_order_workflow._check_and_create_shortage_pr().
        'sales_order_id': pr.sales_order_id,
        'sales_order_number': pr.sales_order.order_number if pr.sales_order else None,
        'notes': pr.notes,
        'created_at': pr.created_at.isoformat() if pr.created_at else None,
        'items': [format_pr_item(i) for i in pr.items],
        'total_estimated': float(sum(
            float(i.estimated_total or 0) for i in pr.items
        )),
        'approval_steps': [format_pr_approval_step(s) for s in sorted(pr.approval_steps, key=lambda s: s.approval_level)],
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
        'converted_to_po_id': item.converted_to_po_id,
        'converted_po_number': item.converted_po.po_number if item.converted_po else None,
        'notes': item.notes,
    }


# ─── LIST ────────────────────────────────────────────────────────────────────

@pr_bp.route('/purchase-requisitions', methods=['GET'])
@jwt_required()
@require_permission('purchase_requests.view')
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
@require_permission('purchase_requests.view')
def get_pr(pr_id):
    pr = db.session.get(PurchaseRequisition, pr_id)
    if not pr:
        return jsonify({'error': 'Purchase Requisition not found'}), 404
    return jsonify(format_pr(pr)), 200


# ─── CREATE ──────────────────────────────────────────────────────────────────

@pr_bp.route('/purchase-requisitions', methods=['POST'])
@jwt_required()
@require_permission('purchase_requests.create')
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
@require_permission('purchase_requests.edit')
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
@require_permission('purchase_requests.create')
def submit_pr(pr_id):
    try:
        pr = db.session.get(PurchaseRequisition, pr_id)
        if not pr:
            return jsonify({'error': 'Purchase Requisition not found'}), 404
        if pr.status != 'draft':
            return jsonify({'error': 'Hanya PR berstatus draft yang bisa diajukan'}), 400
        if not pr.items:
            return jsonify({'error': 'PR harus memiliki minimal 1 item'}), 400

        # Tiered approval (2026-10-16): below PR_AUTO_APPROVE_LIMIT, this
        # auto-approves the PR right here (no approval steps created) - see
        # _create_pr_approval_levels for the full threshold logic.
        _create_pr_approval_levels(pr)
        db.session.commit()

        msg = 'PR otomatis disetujui (di bawah batas approval)' if pr.status == 'approved' else 'PR berhasil diajukan untuk approval'
        return jsonify({'message': msg, 'pr': format_pr(pr)}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ─── APPROVE / REJECT ────────────────────────────────────────────────────────

@pr_bp.route('/purchase-requisitions/<int:pr_id>/approve', methods=['POST'])
@jwt_required()
@require_permission('purchase_requests.approve')
def approve_pr(pr_id):
    """Legacy single-shot approve/reject - only usable on a PR with NO
    tiered approval steps (e.g. one submitted before 2026-10-16, or a PR
    whose amount put it in the no-approval-needed-but-not-yet-approved
    edge case). PRs with real PRApproval rows must go through
    act_on_pr_approval_step() below instead, one level at a time."""
    try:
        user_id = int(get_jwt_identity())
        pr = db.session.get(PurchaseRequisition, pr_id)
        if not pr:
            return jsonify({'error': 'Purchase Requisition not found'}), 404
        if pr.status != 'submitted':
            return jsonify({'error': 'Hanya PR berstatus submitted yang bisa di-approve'}), 400
        if pr.approval_steps:
            return jsonify({'error': 'PR ini punya approval berjenjang - gunakan endpoint approval-steps, bukan approve langsung.'}), 400

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


@pr_bp.route('/purchase-requisitions/<int:pr_id>/approval-steps/<int:level>/action', methods=['POST'])
@jwt_required()
@require_permission('purchase_requests.approve')
def act_on_pr_approval_step(pr_id, level):
    """Approve or reject ONE level of a tiered PR approval. Levels are
    sequential - level N can't be acted on until level N-1 is approved.
    The acting user must hold the role required for that level (any user
    with that role can act - this is role-gated, not a pre-assigned
    individual, same pattern as ApprovalConfiguration.approver_roles)."""
    try:
        user_id = int(get_jwt_identity())
        pr = db.session.get(PurchaseRequisition, pr_id, with_for_update=True)
        if not pr:
            return jsonify({'error': 'Purchase Requisition not found'}), 404

        # Idempotency (2026-10-17): row-locked so a genuinely concurrent
        # duplicate request can't both read status='pending' before either
        # commits - matches the same fix applied to the generic
        # ApprovalWorkflow system (routes/approval_workflow.py) the same day.
        step = PRApproval.query.filter_by(pr_id=pr_id, approval_level=level).with_for_update().first()
        if not step:
            return jsonify({'error': f'Approval level {level} tidak ditemukan untuk PR ini'}), 404
        if step.status != 'pending':
            return jsonify({'error': f'Approval level {level} sudah berstatus {step.status}'}), 400

        prior_pending = PRApproval.query.filter(
            PRApproval.pr_id == pr_id,
            PRApproval.approval_level < level,
            PRApproval.status != 'approved',
        ).first()
        if prior_pending:
            return jsonify({'error': f'Level {prior_pending.approval_level} harus di-approve dulu sebelum level {level}.'}), 400

        user = db.session.get(User, user_id)
        user_role_names = {ur.role.name for ur in user.roles if ur.role}
        if not user.is_super_admin and step.required_role.name not in user_role_names:
            return jsonify({'error': f'Approval level {level} butuh role "{step.required_role.name}" - akun Anda tidak punya role ini.'}), 403

        data = request.get_json() or {}
        action = data.get('action', 'approve')

        step.approver_id = user_id
        step.approved_at = datetime.utcnow()
        step.comments = data.get('comments')

        if action == 'approve':
            step.status = 'approved'
            remaining = PRApproval.query.filter(
                PRApproval.pr_id == pr_id, PRApproval.status != 'approved'
            ).count()
            if remaining == 0:
                pr.status = 'approved'
                pr.approved_by = user_id
                pr.approved_at = datetime.utcnow()
                pr.rejection_reason = None
            msg = f'Level {level} ({step.required_role.name}) disetujui' + (' - PR fully approved' if remaining == 0 else '')
        else:
            step.status = 'rejected'
            pr.status = 'rejected'
            pr.approved_by = user_id
            pr.approved_at = datetime.utcnow()
            pr.rejection_reason = data.get('rejection_reason', step.comments or '')
            msg = f'PR ditolak pada level {level} ({step.required_role.name})'

        db.session.commit()
        return jsonify({'message': msg, 'pr': format_pr(pr)}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ─── CONVERT TO PO ───────────────────────────────────────────────────────────

@pr_bp.route('/purchase-requisitions/<int:pr_id>/convert-to-po', methods=['POST'])
@jwt_required()
@require_permission('purchase_requests.create')
def convert_pr_to_po(pr_id):
    """Convert an approved PR into one or more Purchase Orders.

    2026-09-21: previously required ONE supplier_id for the whole PR and
    put every item into a single PO - silently wrong whenever different
    items needed different suppliers (real gap raised by QA). PRItem
    already had a `preferred_supplier_id` column (routes/purchase_requisition
    form has captured it per-line for a while) that this endpoint simply
    never read. Now: items are grouped by resolved supplier and one PO is
    created PER supplier group.

    Supplier resolution per item, in order: explicit `item_suppliers`
    override in the request -> the item's own `preferred_supplier_id` ->
    the request's fallback `supplier_id` (kept for backward compatibility
    with the single-supplier case and as a catch-all for items with no
    preference set). An item with no resolvable supplier at all fails the
    whole conversion with a clear error rather than silently guessing.
    """
    try:
        user_id = int(get_jwt_identity())
        pr = db.session.get(PurchaseRequisition, pr_id)
        if not pr:
            return jsonify({'error': 'Purchase Requisition not found'}), 404
        if pr.status != 'approved':
            return jsonify({'error': 'Hanya PR yang sudah di-approve yang bisa dikonversi ke PO'}), 400
        if pr.converted_to_po_id:
            return jsonify({'error': 'PR ini sudah pernah dikonversi ke PO', 'po_id': pr.converted_to_po_id}), 400
        if not pr.items:
            return jsonify({'error': 'PR ini tidak punya item'}), 400

        data = request.get_json() or {}
        fallback_supplier_id = data.get('supplier_id')
        item_suppliers = data.get('item_suppliers') or {}  # {pr_item_id: supplier_id}
        item_prices = data.get('item_prices') or {}  # {pr_item_id: unit_price}, unchanged from before

        # Resolve supplier per item and group.
        groups = {}  # supplier_id -> [PRItem, ...]
        unresolved = []
        for item in pr.items:
            resolved_supplier_id = (
                item_suppliers.get(str(item.id))
                or item.preferred_supplier_id
                or fallback_supplier_id
            )
            if not resolved_supplier_id:
                unresolved.append(item.item_name or item.item_code or f'item #{item.id}')
                continue
            resolved_supplier_id = int(resolved_supplier_id)
            groups.setdefault(resolved_supplier_id, []).append(item)

        if unresolved:
            return jsonify({
                'error': 'Beberapa item belum punya supplier (preferred_supplier_id kosong dan tidak ada override/fallback)',
                'items_without_supplier': unresolved,
            }), 400

        from routes.purchasing import _calculate_po_total

        created_pos = []
        for supplier_id, items in groups.items():
            po_number = generate_number_v2('purchase_order', 'PO', PurchaseOrder, 'po_number')
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

            subtotal = 0.0
            for idx, item in enumerate(items, start=1):
                unit_price = float(item_prices.get(str(item.id), item.estimated_unit_price or 0))
                line_total = unit_price * float(item.quantity)
                subtotal += line_total

                po_item = PurchaseOrderItem(
                    po_id=po.id,
                    line_number=idx,
                    material_id=item.material_id,
                    product_id=item.product_id,
                    description=item.item_name or item.item_code,
                    quantity=float(item.quantity),
                    uom=item.uom,
                    unit_price=unit_price,
                    total_price=line_total,
                    notes=item.notes,
                )
                db.session.add(po_item)
                item.converted_to_po_id = po.id

            po.subtotal = subtotal
            po.total_amount = _calculate_po_total(po, subtotal)
            created_pos.append(po)

        # PR-level converted_to_po_id stays a single FK (schema predates
        # multi-PO splitting) - points at the first PO created as the
        # "primary" reference; PRItem.converted_to_po_id above is the real,
        # authoritative per-line record of where each item actually went.
        pr.converted_to_po_id = created_pos[0].id
        pr.status = 'converted'
        db.session.commit()

        if len(created_pos) == 1:
            return jsonify({
                'message': f'PR berhasil dikonversi ke {created_pos[0].po_number}',
                'po_id': created_pos[0].id,
                'po_number': created_pos[0].po_number,
                'purchase_orders': [{'po_id': po.id, 'po_number': po.po_number, 'supplier_id': po.supplier_id} for po in created_pos],
            }), 201

        return jsonify({
            'message': f'PR berhasil dikonversi ke {len(created_pos)} PO (beda supplier per item)',
            'po_id': created_pos[0].id,
            'po_number': created_pos[0].po_number,
            'purchase_orders': [{'po_id': po.id, 'po_number': po.po_number, 'supplier_id': po.supplier_id} for po in created_pos],
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ─── DELETE (draft only) ─────────────────────────────────────────────────────

@pr_bp.route('/purchase-requisitions/<int:pr_id>', methods=['DELETE'])
@jwt_required()
@require_permission('purchase_requests.delete')
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
