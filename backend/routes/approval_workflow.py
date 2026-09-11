"""
Approval Workflow Routes
Handles multi-level approval process with review and edit capabilities
"""
from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.auth_decorators import require_permission
from models import db
from models.approval_workflow import ApprovalWorkflow, ApprovalHistory, ApprovalConfiguration, PendingJournalEntry
from models.user import User
from models.finance import AccountingEntry
from datetime import datetime
from sqlalchemy import or_, and_
from utils.timezone import get_local_now, get_local_today
from utils.finance_helpers import post_pending_journal

approval_bp = Blueprint('approval', __name__, url_prefix='/api/approval')


def apply_workflow_side_effect(workflow, action, user_id):
    """Dispatch the source-document status/side-effect update for a workflow
    transitioning to 'approved' or 'rejected'.

    Bagian 2 part 1 (2026-08-19) fix: previously approve_workflow()/
    reject_workflow() only updated ApprovalWorkflow itself — the source
    document (PurchaseOrder, SalesOrder, StockTransferOrder, StockOpnameOrder)
    never got its status flipped back, so e.g. a PO stayed stuck at
    'pending_approval' forever even after being approved. This hook closes
    that gap for every transaction_type currently routed through the generic
    ApprovalWorkflow system. action is 'approve' or 'reject'.
    """
    if workflow.transaction_type == 'purchase_order':
        from models.purchasing import PurchaseOrder
        po = db.session.get(PurchaseOrder, workflow.transaction_id)
        if po:
            po.status = 'approved' if action == 'approve' else 'rejected'

    elif workflow.transaction_type == 'sales_order':
        from models.sales import SalesOrder
        so = db.session.get(SalesOrder, workflow.transaction_id)
        if so:
            so.status = 'approved' if action == 'approve' else 'rejected'

    elif workflow.transaction_type == 'stock_transfer':
        from models.wms_advanced import StockTransferOrder
        sto = db.session.get(StockTransferOrder, workflow.transaction_id)
        if sto:
            if action == 'approve':
                sto.status = 'approved'
                sto.approved_by = user_id
                sto.approved_at = get_local_now()
            else:
                sto.status = 'draft'

    elif workflow.transaction_type == 'stock_opname':
        from models.stock_opname import StockOpnameOrder
        order = db.session.get(StockOpnameOrder, workflow.transaction_id)
        if order and action == 'approve':
            from routes.stock_opname import apply_stock_opname_adjustments
            apply_stock_opname_adjustments(order, user_id, create_adjustments=True)
        # reject: no inventory side effect, order.status stays 'completed'

    elif workflow.transaction_type == 'inventory_adjustment':
        from models.warehouse_adjustment import InventoryAdjustment
        from models.warehouse import Inventory, InventoryMovement
        adj = db.session.get(InventoryAdjustment, workflow.transaction_id)
        if adj:
            if action == 'approve':
                # Quantity mode only - value-adjustment mode leaves
                # Inventory.quantity_on_hand untouched (cost-only revaluation,
                # the journal entry created by approve_workflow()'s
                # PendingJournalEntry posting is the entire effect).
                if not adj.is_value_adjustment and adj.inventory_id:
                    inv = db.session.get(Inventory, adj.inventory_id)
                    if inv:
                        inv.quantity_on_hand = adj.physical_quantity
                        inv.quantity_available = adj.physical_quantity - inv.quantity_reserved
                        inv.last_stock_check = get_local_now()

                        movement = InventoryMovement(
                            inventory_id=inv.id,
                            product_id=inv.product_id,
                            material_id=inv.material_id,
                            location_id=inv.location_id,
                            movement_type='adjust',
                            movement_date=get_local_now().date(),
                            quantity=float(adj.adjustment_quantity),
                            reference_number=adj.adjustment_number,
                            reference_type='inventory_adjustment',
                            reference_id=adj.id,
                            batch_number=adj.batch_number,
                            notes=f'Penyesuaian stok - {adj.adjustment_number}',
                            created_by=user_id
                        )
                        db.session.add(movement)
                adj.status = 'applied'
                adj.approved_by = user_id
                adj.approved_at = get_local_now()
            else:
                adj.status = 'rejected'


def get_user_roles(user):
    """Return a set of lowercase role names for the user from the RBAC relationship.

    The User model has no scalar ``role`` column; roles are stored via the
    ``user.roles`` (UserRole) relationship plus ``is_admin``/``is_super_admin`` flags.
    """
    names = set()
    if not user:
        return names
    if getattr(user, 'is_super_admin', False) or getattr(user, 'is_admin', False):
        names.add('admin')
    try:
        for user_role in user.roles:
            if user_role.role and user_role.role.name:
                names.add(user_role.role.name.strip().lower())
    except Exception:
        pass
    return names


def user_has_any_role(user, role_names):
    """True if the user has at least one of the given role names (or is an admin)."""
    user_roles = get_user_roles(user)
    if 'admin' in user_roles:
        return True
    return bool(user_roles & {r.lower() for r in role_names})


def user_can_act_on(user, workflow, step):
    """Check whether ``user`` is allowed to review/approve ``workflow``.

    Reads the role list for the given ``step`` ('review' or 'approval') from
    ``ApprovalConfiguration.reviewer_roles`` / ``approver_roles`` for the
    workflow's ``transaction_type`` - there is no hardcoded role list here.

    Returns (allowed: bool, error_message: str | None). ``error_message`` is
    only set when ``allowed`` is False, and distinguishes "no configuration
    exists for this transaction type" (safe-fail closed) from "role not in
    the configured list" so callers can return a clear message. Admin/
    super_admin users are always allowed, matching the existing project
    convention (``user_has_any_role`` already treats 'admin' as a wildcard).
    """
    user_roles = get_user_roles(user)
    if 'admin' in user_roles:
        return True, None

    config = ApprovalConfiguration.query.filter_by(
        transaction_type=workflow.transaction_type, is_active=True
    ).first()

    if not config:
        return False, (
            f"Belum ada konfigurasi approval untuk jenis transaksi "
            f"'{workflow.transaction_type}'. Hubungi admin untuk mengatur "
            f"ApprovalConfiguration terlebih dahulu."
        )

    configured_roles = config.reviewer_roles if step == 'review' else config.approver_roles
    if not configured_roles:
        return False, (
            f"Konfigurasi approval untuk '{workflow.transaction_type}' tidak "
            f"memiliki daftar role untuk tahap {step}."
        )

    allowed_roles = {r.lower() for r in configured_roles}
    if user_roles & allowed_roles:
        return True, None

    return False, (
        f"Unauthorized - role yang diizinkan untuk tahap {step} pada "
        f"'{workflow.transaction_type}': {', '.join(configured_roles)}"
    )


@approval_bp.route('/workflows', methods=['GET'])
@jwt_required()
@require_permission('approval.view')
def get_workflows():
    """Get approval workflows with filtering"""
    try:
        current_user_id = get_jwt_identity()
        user = db.session.get(User, current_user_id)
        
        # Query parameters
        status = request.args.get('status')
        transaction_type = request.args.get('transaction_type')
        my_tasks = request.args.get('my_tasks', 'false').lower() == 'true'
        
        query = ApprovalWorkflow.query
        
        # Filter by status
        if status:
            query = query.filter_by(status=status)
        
        # Filter by transaction type
        if transaction_type:
            query = query.filter_by(transaction_type=transaction_type)
        
        # Filter by user's tasks
        if my_tasks:
            # Show workflows where user is reviewer or approver based on current step
            if user_has_any_role(user, ['production_manager', 'warehouse_manager']):
                query = query.filter(
                    or_(
                        and_(ApprovalWorkflow.status == 'pending_review', ApprovalWorkflow.reviewer_id == None),
                        ApprovalWorkflow.reviewer_id == current_user_id
                    )
                )
            elif user_has_any_role(user, ['finance', 'accounting', 'finance_manager']):
                query = query.filter(
                    or_(
                        and_(ApprovalWorkflow.status == 'pending_approval', ApprovalWorkflow.approver_id == None),
                        ApprovalWorkflow.approver_id == current_user_id
                    )
                )
        
        workflows = query.order_by(ApprovalWorkflow.created_at.desc()).all()
        
        return jsonify({
            'workflows': [{
                'id': w.id,
                'transaction_type': w.transaction_type,
                'transaction_id': w.transaction_id,
                'transaction_number': w.transaction_number,
                'status': w.status,
                'current_step': w.current_step,
                'submitted_by': w.submitter.username if w.submitter else None,
                'submitted_at': w.submitted_at.isoformat() if w.submitted_at else None,
                'reviewer': w.reviewer.username if w.reviewer else None,
                'reviewed_at': w.reviewed_at.isoformat() if w.reviewed_at else None,
                'approver': w.approver.username if w.approver else None,
                'approved_at': w.approved_at.isoformat() if w.approved_at else None,
                'created_at': w.created_at.isoformat()
            } for w in workflows]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@approval_bp.route('/workflows/<int:workflow_id>', methods=['GET'])
@jwt_required()
@require_permission('approval.view')
def get_workflow_detail(workflow_id):
    """Get workflow detail with history"""
    try:
        workflow = db.session.get(ApprovalWorkflow, workflow_id) or abort(404)
        
        # Get history
        history = ApprovalHistory.query.filter_by(workflow_id=workflow_id).order_by(ApprovalHistory.action_at.desc()).all()
        
        # Get pending journal entry if exists
        pending_journal = PendingJournalEntry.query.filter_by(workflow_id=workflow_id).first()
        
        return jsonify({
            'workflow': {
                'id': workflow.id,
                'transaction_type': workflow.transaction_type,
                'transaction_id': workflow.transaction_id,
                'transaction_number': workflow.transaction_number,
                'status': workflow.status,
                'current_step': workflow.current_step,
                'submitted_by': workflow.submitter.username if workflow.submitter else None,
                'submitted_at': workflow.submitted_at.isoformat() if workflow.submitted_at else None,
                'reviewer_id': workflow.reviewer_id,
                'reviewer': workflow.reviewer.username if workflow.reviewer else None,
                'reviewed_at': workflow.reviewed_at.isoformat() if workflow.reviewed_at else None,
                'review_notes': workflow.review_notes,
                'review_changes': workflow.review_changes,
                'approver_id': workflow.approver_id,
                'approver': workflow.approver.username if workflow.approver else None,
                'approved_at': workflow.approved_at.isoformat() if workflow.approved_at else None,
                'approval_notes': workflow.approval_notes,
                'rejected_by': workflow.rejector.username if workflow.rejector else None,
                'rejected_at': workflow.rejected_at.isoformat() if workflow.rejected_at else None,
                'rejection_reason': workflow.rejection_reason,
                'journal_entry_id': workflow.journal_entry_id,
                'created_at': workflow.created_at.isoformat()
            },
            'history': [{
                'id': h.id,
                'action': h.action,
                'action_by': h.actor.username if h.actor else None,
                'action_at': h.action_at.isoformat(),
                'old_status': h.old_status,
                'new_status': h.new_status,
                'notes': h.notes,
                'changes': h.changes
            } for h in history],
            'pending_journal': {
                'entry_date': pending_journal.entry_date.isoformat() if pending_journal else None,
                'description': pending_journal.description if pending_journal else None,
                'lines': pending_journal.lines if pending_journal else None,
                'total_debit': float(pending_journal.total_debit) if pending_journal else 0,
                'total_credit': float(pending_journal.total_credit) if pending_journal else 0
            } if pending_journal else None
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@approval_bp.route('/workflows', methods=['POST'])
@jwt_required()
@require_permission('approval.view')
def create_workflow():
    """Create new approval workflow"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        # Create workflow
        workflow = ApprovalWorkflow(
            transaction_type=data['transaction_type'],
            transaction_id=data['transaction_id'],
            transaction_number=data.get('transaction_number'),
            status='draft',
            submitted_by=current_user_id
        )
        
        db.session.add(workflow)
        db.session.flush()
        
        # Create history entry
        history = ApprovalHistory(
            workflow_id=workflow.id,
            action='create',
            action_by=current_user_id,
            old_status=None,
            new_status='draft',
            notes='Workflow created'
        )
        db.session.add(history)
        
        # Create pending journal entry if provided
        if 'journal_entry' in data:
            je_data = data['journal_entry']
            pending_journal = PendingJournalEntry(
                workflow_id=workflow.id,
                entry_date=datetime.strptime(je_data['entry_date'], '%Y-%m-%d').date(),
                description=je_data.get('description'),
                reference=je_data.get('reference'),
                lines=je_data['lines'],
                total_debit=sum(line.get('debit', 0) for line in je_data['lines']),
                total_credit=sum(line.get('credit', 0) for line in je_data['lines']),
                created_by=current_user_id
            )
            db.session.add(pending_journal)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Workflow created successfully',
            'workflow_id': workflow.id
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@approval_bp.route('/workflows/<int:workflow_id>/submit', methods=['POST'])
@jwt_required()
@require_permission('approval.view')
def submit_for_review(workflow_id):
    """Submit workflow for review"""
    try:
        current_user_id = get_jwt_identity()
        workflow = db.session.get(ApprovalWorkflow, workflow_id) or abort(404)
        
        # Check if user is the submitter
        if workflow.submitted_by != current_user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Update workflow
        old_status = workflow.status
        workflow.status = 'pending_review'
        workflow.current_step = 'review'
        workflow.submitted_at = get_local_now()
        
        # Create history
        history = ApprovalHistory(
            workflow_id=workflow_id,
            action='submit',
            action_by=current_user_id,
            old_status=old_status,
            new_status='pending_review',
            notes='Submitted for review'
        )
        db.session.add(history)
        
        db.session.commit()
        
        return jsonify({'message': 'Workflow submitted for review'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@approval_bp.route('/workflows/<int:workflow_id>/review', methods=['POST'])
@jwt_required()
@require_permission('approval.view')
def review_workflow(workflow_id):
    """Review workflow (Manager Production) - can edit data"""
    try:
        current_user_id = get_jwt_identity()
        user = db.session.get(User, current_user_id)
        data = request.get_json()

        workflow = db.session.get(ApprovalWorkflow, workflow_id) or abort(404)

        # Check if user has reviewer role for this transaction_type, per ApprovalConfiguration
        allowed, error_message = user_can_act_on(user, workflow, 'review')
        if not allowed:
            return jsonify({'error': error_message}), 403

        # Check if workflow is in pending_review status
        if workflow.status != 'pending_review':
            return jsonify({'error': 'Workflow is not pending review'}), 400
        
        # Update workflow
        old_status = workflow.status
        workflow.reviewer_id = current_user_id
        workflow.reviewed_at = get_local_now()
        workflow.review_notes = data.get('notes')
        workflow.review_changes = data.get('changes')  # Track what was edited
        workflow.status = 'pending_approval'
        workflow.current_step = 'approval'
        
        # Create history
        history = ApprovalHistory(
            workflow_id=workflow_id,
            action='review',
            action_by=current_user_id,
            old_status=old_status,
            new_status='pending_approval',
            notes=data.get('notes'),
            changes=data.get('changes')
        )
        db.session.add(history)
        
        # Update pending journal entry if changes provided
        if 'journal_changes' in data:
            pending_journal = PendingJournalEntry.query.filter_by(workflow_id=workflow_id).first()
            if pending_journal:
                je_changes = data['journal_changes']
                if 'lines' in je_changes:
                    pending_journal.lines = je_changes['lines']
                    pending_journal.total_debit = sum(line.get('debit', 0) for line in je_changes['lines'])
                    pending_journal.total_credit = sum(line.get('credit', 0) for line in je_changes['lines'])
                if 'description' in je_changes:
                    pending_journal.description = je_changes['description']
        
        db.session.commit()
        
        return jsonify({'message': 'Workflow reviewed and submitted for approval'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@approval_bp.route('/workflows/<int:workflow_id>/approve', methods=['POST'])
@jwt_required()
@require_permission('approval.approve')
def approve_workflow(workflow_id):
    """Approve workflow (Finance/Accounting) - creates journal entry"""
    try:
        current_user_id = get_jwt_identity()
        user = db.session.get(User, current_user_id)
        data = request.get_json()

        workflow = db.session.get(ApprovalWorkflow, workflow_id) or abort(404)

        # Check if user has approver role for this transaction_type, per ApprovalConfiguration
        allowed, error_message = user_can_act_on(user, workflow, 'approval')
        if not allowed:
            return jsonify({'error': error_message}), 403

        # Check if workflow is in pending_approval status
        if workflow.status != 'pending_approval':
            return jsonify({'error': 'Workflow is not pending approval'}), 400
        
        # Update workflow
        old_status = workflow.status
        workflow.approver_id = current_user_id
        workflow.approved_at = get_local_now()
        workflow.approval_notes = data.get('notes')
        workflow.status = 'approved'
        workflow.current_step = 'completed'

        # Apply the side effect on the source document (PO/SO status flip,
        # stock transfer approval, stock opname inventory adjustment, etc.)
        apply_workflow_side_effect(workflow, 'approve', current_user_id)

        # Create journal entries from pending (one AccountingEntry row per line)
        pending_journal = PendingJournalEntry.query.filter_by(workflow_id=workflow_id).first()
        if pending_journal:
            created_entries = post_pending_journal(pending_journal.id, posted_by_user_id=current_user_id)
            db.session.flush()

            # journal_entry_id historically pointed at a single AccountingEntry;
            # keep it pointing at the first line's row so existing readers of
            # workflow.journal_entry_id still resolve to a real row.
            if created_entries:
                workflow.journal_entry_id = created_entries[0].id
        
        # Create history
        history = ApprovalHistory(
            workflow_id=workflow_id,
            action='approve',
            action_by=current_user_id,
            old_status=old_status,
            new_status='approved',
            notes=data.get('notes')
        )
        db.session.add(history)
        
        db.session.commit()

        # Stock actually increased for these two types (opname variance / adjustment
        # approval) - retry any MaterialIssueItem stuck at reservation_status=
        # 'insufficient' now that new stock may cover it. Called AFTER commit
        # (own commits per MaterialIssue, must not be nested inside this
        # transaction) and best-effort - never blocks the approval response.
        if workflow.transaction_type in ('stock_opname', 'inventory_adjustment'):
            try:
                from utils.auto_reserve import requeue_insufficient_items
                requeue_insufficient_items()
            except Exception:
                pass

        return jsonify({
            'message': 'Workflow approved and journal entry created',
            'journal_entry_id': workflow.journal_entry_id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@approval_bp.route('/workflows/<int:workflow_id>/reject', methods=['POST'])
@jwt_required()
@require_permission('approval.reject')
def reject_workflow(workflow_id):
    """Reject workflow"""
    try:
        current_user_id = get_jwt_identity()
        user = db.session.get(User, current_user_id)
        data = request.get_json()
        
        workflow = db.session.get(ApprovalWorkflow, workflow_id) or abort(404)

        # Check authorization - same reviewer/approver role config as review/approve
        if workflow.status == 'pending_review':
            allowed, error_message = user_can_act_on(user, workflow, 'review')
            if not allowed:
                return jsonify({'error': error_message}), 403
        elif workflow.status == 'pending_approval':
            allowed, error_message = user_can_act_on(user, workflow, 'approval')
            if not allowed:
                return jsonify({'error': error_message}), 403
        
        # Update workflow
        old_status = workflow.status
        workflow.rejected_by = current_user_id
        workflow.rejected_at = get_local_now()
        workflow.rejection_reason = data.get('reason')
        workflow.status = 'rejected'

        # Apply the side effect on the source document (PO/SO status flip,
        # stock transfer sent back to draft, etc.)
        apply_workflow_side_effect(workflow, 'reject', current_user_id)

        # Create history
        history = ApprovalHistory(
            workflow_id=workflow_id,
            action='reject',
            action_by=current_user_id,
            old_status=old_status,
            new_status='rejected',
            notes=data.get('reason')
        )
        db.session.add(history)
        
        db.session.commit()
        
        return jsonify({'message': 'Workflow rejected'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@approval_bp.route('/configurations', methods=['GET'])
@jwt_required()
@require_permission('approval.view')
def get_configurations():
    """Get approval configurations"""
    try:
        configs = ApprovalConfiguration.query.filter_by(is_active=True).all()
        
        return jsonify({
            'configurations': [{
                'id': c.id,
                'transaction_type': c.transaction_type,
                'require_review': c.require_review,
                'require_approval': c.require_approval,
                'allow_reviewer_edit': c.allow_reviewer_edit,
                'allow_approver_edit': c.allow_approver_edit,
                'reviewer_roles': c.reviewer_roles,
                'approver_roles': c.approver_roles,
                'auto_create_journal': c.auto_create_journal,
                'amount_threshold': float(c.amount_threshold) if c.amount_threshold else None
            } for c in configs]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@approval_bp.route('/dashboard', methods=['GET'])
@jwt_required()
@require_permission('approval.view')
def get_dashboard():
    """Get approval dashboard statistics"""
    try:
        current_user_id = get_jwt_identity()
        user = db.session.get(User, current_user_id)
        
        # Count workflows by status
        pending_review = ApprovalWorkflow.query.filter_by(status='pending_review').count()
        pending_approval = ApprovalWorkflow.query.filter_by(status='pending_approval').count()
        approved = ApprovalWorkflow.query.filter_by(status='approved').count()
        rejected = ApprovalWorkflow.query.filter_by(status='rejected').count()
        
        # My pending tasks
        my_pending = 0
        if user_has_any_role(user, ['production_manager', 'warehouse_manager']):
            my_pending = ApprovalWorkflow.query.filter_by(status='pending_review').count()
        elif user_has_any_role(user, ['finance', 'accounting', 'finance_manager']):
            my_pending = ApprovalWorkflow.query.filter_by(status='pending_approval').count()
        
        return jsonify({
            'statistics': {
                'pending_review': pending_review,
                'pending_approval': pending_approval,
                'approved': approved,
                'rejected': rejected,
                'my_pending': my_pending
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
