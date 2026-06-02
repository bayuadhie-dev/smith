"""
Expense and Reimbursement API Routes
Enterprise-grade expense management with receipt tracking and approval workflow
"""

from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from datetime import datetime
import os
from sqlalchemy import func, or_, and_

from models.expense import Expense, Reimbursement
from models.hr import Employee
from models.user import User
from models.finance import Account, AccountingEntry, CostCenter
from models import db

expense_bp = Blueprint('expense', __name__)

# Allowed file extensions for receipts
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf', 'gif'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def can_view_all(user_id):
    """Return True if the user is an admin/super admin and may view all employees' expenses."""
    try:
        user = db.session.get(User, int(user_id))
        return bool(user and (user.is_admin or user.is_super_admin))
    except (TypeError, ValueError):
        return False


# ============================================================================
# EXPENSE CRUD
# ============================================================================

@expense_bp.route('', methods=['GET'])
@jwt_required()
def get_expenses():
    """Get list of expenses with filtering"""
    try:
        user_id = get_jwt_identity()

        # Check permission - TODO: Re-enable later
        # if not check_permission('expense.view'):
        #     return jsonify({'success': False, 'error': 'Permission denied'}), 403
        
        # Query parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        employee_id = request.args.get('employee_id', type=int)
        category = request.args.get('category')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        search = request.args.get('search', '')
        
        # Build query
        query = Expense.query
        
        # Filter by employee (admins see all, others see only their own expenses)
        if not can_view_all(user_id):
            employee = Employee.query.filter_by(user_id=user_id).first()
            if employee:
                query = query.filter_by(employee_id=employee.id)
            else:
                return jsonify({'success': False, 'error': 'Employee not found'}), 404

        if employee_id:
            query = query.filter_by(employee_id=employee_id)
        
        # Apply filters
        if status:
            query = query.filter_by(status=status)
        if category:
            query = query.filter(Expense.expense_category == category)
        if date_from:
            query = query.filter(Expense.expense_date >= date_from)
        if date_to:
            query = query.filter(Expense.expense_date <= date_to)
        if search:
            query = query.filter(or_(
                Expense.expense_number.ilike(f'%{search}%'),
                Expense.description.ilike(f'%{search}%'),
                Expense.vendor_name.ilike(f'%{search}%'),
                Expense.reference_number.ilike(f'%{search}%')
            ))
        
        # Pagination
        query = query.order_by(Expense.created_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Serialize
        expenses = []
        for exp in pagination.items:
            expenses.append({
                'id': exp.id,
                'expense_number': exp.expense_number,
                'employee_id': exp.employee_id,
                'employee_name': exp.employee_name,
                'expense_date': exp.expense_date.isoformat() if exp.expense_date else None,
                'expense_category': exp.expense_category,
                'expense_type': exp.expense_type,
                'description': exp.description,
                'amount': float(exp.amount) if exp.amount else 0,
                'currency': exp.currency,
                'amount_base': float(exp.amount_base) if exp.amount_base else 0,
                'receipt_file_name': exp.receipt_file_name,
                'reference_number': exp.reference_number,
                'vendor_name': exp.vendor_name,
                'status': exp.status,
                'status_display': exp.status_display,
                'submitted_at': exp.submitted_at.isoformat() if exp.submitted_at else None,
                'approved_at': exp.approved_at.isoformat() if exp.approved_at else None,
                'reimbursement_id': exp.reimbursement_id,
                'reimbursement_number': exp.reimbursement.reimbursement_number if exp.reimbursement else None,
                'created_at': exp.created_at.isoformat() if exp.created_at else None,
            })
        
        return jsonify({
            'success': True,
            'expenses': expenses,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@expense_bp.route('/<int:expense_id>', methods=['GET'])
@jwt_required()
def get_expense(expense_id):
    """Get expense detail"""
    try:
        user_id = get_jwt_identity()
        
        # Check permission
        # if not check_permission('expense.view'):
        #     return jsonify({'success': False, 'error': 'Permission denied'}), 403
        
        expense = Expense.query.get_or_404(expense_id)
        
        # Check access (admins see all, others see only their own expenses)
        if not can_view_all(user_id):
            employee = Employee.query.filter_by(user_id=user_id).first()
            if not employee or expense.employee_id != employee.id:
                return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        return jsonify({
            'success': True,
            'expense': {
                'id': expense.id,
                'expense_number': expense.expense_number,
                'employee_id': expense.employee_id,
                'employee_name': expense.employee_name,
                'expense_date': expense.expense_date.isoformat() if expense.expense_date else None,
                'expense_category': expense.expense_category,
                'expense_type': expense.expense_type,
                'description': expense.description,
                'amount': float(expense.amount) if expense.amount else 0,
                'currency': expense.currency,
                'exchange_rate': float(expense.exchange_rate) if expense.exchange_rate else 1.0,
                'amount_base': float(expense.amount_base) if expense.amount_base else 0,
                'receipt_file_path': expense.receipt_file_path,
                'receipt_file_name': expense.receipt_file_name,
                'receipt_file_type': expense.receipt_file_type,
                'receipt_file_size': expense.receipt_file_size,
                'receipt_uploaded_at': expense.receipt_uploaded_at.isoformat() if expense.receipt_uploaded_at else None,
                'reference_number': expense.reference_number,
                'vendor_name': expense.vendor_name,
                'status': expense.status,
                'status_display': expense.status_display,
                'submitted_at': expense.submitted_at.isoformat() if expense.submitted_at else None,
                'submitted_by': expense.submitted_by,
                'approved_by': expense.approved_by,
                'approved_at': expense.approved_at.isoformat() if expense.approved_at else None,
                'approval_notes': expense.approval_notes,
                'rejected_by': expense.rejected_by,
                'rejected_at': expense.rejected_at.isoformat() if expense.rejected_at else None,
                'rejection_reason': expense.rejection_reason,
                'reimbursement_id': expense.reimbursement_id,
                'reimbursement_number': expense.reimbursement.reimbursement_number if expense.reimbursement else None,
                'reimbursed_at': expense.reimbursed_at.isoformat() if expense.reimbursed_at else None,
                'cost_center_id': expense.cost_center_id,
                'account_id': expense.account_id,
                'journal_entry_id': expense.journal_entry_id,
                'posted_to_gl': expense.posted_to_gl,
                'gl_posted_at': expense.gl_posted_at.isoformat() if expense.gl_posted_at else None,
                'notes': expense.notes,
                'created_by': expense.created_by,
                'created_at': expense.created_at.isoformat() if expense.created_at else None,
                'updated_at': expense.updated_at.isoformat() if expense.updated_at else None,
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@expense_bp.route('', methods=['POST'])
@jwt_required()
def create_expense():
    """Create new expense"""
    try:
        user_id = get_jwt_identity()
        
        # Check permission
        # if not check_permission('expense.create'):
        #     return jsonify({'success': False, 'error': 'Permission denied'}), 403
        
        data = request.get_json()
        
        # Get employee info
        employee = Employee.query.get_or_404(data.get('employee_id'))
        
        # Calculate base currency amount
        amount = float(data.get('amount', 0))
        exchange_rate = float(data.get('exchange_rate', 1.0))
        amount_base = amount * exchange_rate
        
        expense = Expense(
            employee_id=employee.id,
            employee_name=employee.full_name,
            expense_date=datetime.strptime(data.get('expense_date'), '%Y-%m-%d').date(),
            expense_category=data.get('expense_category'),
            expense_type=data.get('expense_type'),
            description=data.get('description'),
            amount=amount,
            currency=data.get('currency', 'IDR'),
            exchange_rate=exchange_rate,
            amount_base=amount_base,
            reference_number=data.get('reference_number'),
            vendor_name=data.get('vendor_name'),
            cost_center_id=data.get('cost_center_id'),
            account_id=data.get('account_id'),
            notes=data.get('notes'),
            created_by=user_id,
            status='draft'
        )
        
        db.session.add(expense)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Expense created successfully',
            'expense': {
                'id': expense.id,
                'expense_number': expense.expense_number
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@expense_bp.route('/<int:expense_id>', methods=['PUT'])
@jwt_required()
def update_expense(expense_id):
    """Update expense"""
    try:
        user_id = get_jwt_identity()
        
        # Check permission
        # if not check_permission('expense.edit'):
        #     return jsonify({'success': False, 'error': 'Permission denied'}), 403
        
        expense = Expense.query.get_or_404(expense_id)
        
        # Only draft expenses can be edited
        if expense.status != 'draft':
            return jsonify({'success': False, 'error': 'Only draft expenses can be edited'}), 400
        
        data = request.get_json()
        
        # Update fields
        if 'expense_date' in data:
            expense.expense_date = datetime.strptime(data['expense_date'], '%Y-%m-%d').date()
        if 'expense_category' in data:
            expense.expense_category = data['expense_category']
        if 'expense_type' in data:
            expense.expense_type = data['expense_type']
        if 'description' in data:
            expense.description = data['description']
        if 'amount' in data:
            expense.amount = float(data['amount'])
            expense.amount_base = expense.amount * expense.exchange_rate
        if 'currency' in data:
            expense.currency = data['currency']
        if 'exchange_rate' in data:
            expense.exchange_rate = float(data['exchange_rate'])
            expense.amount_base = expense.amount * expense.exchange_rate
        if 'reference_number' in data:
            expense.reference_number = data['reference_number']
        if 'vendor_name' in data:
            expense.vendor_name = data['vendor_name']
        if 'cost_center_id' in data:
            expense.cost_center_id = data['cost_center_id']
        if 'account_id' in data:
            expense.account_id = data['account_id']
        if 'notes' in data:
            expense.notes = data['notes']
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Expense updated successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@expense_bp.route('/<int:expense_id>', methods=['DELETE'])
@jwt_required()
def delete_expense(expense_id):
    """Delete expense"""
    try:
        user_id = get_jwt_identity()
        
        # Check permission
        # if not check_permission('expense.delete'):
        #     return jsonify({'success': False, 'error': 'Permission denied'}), 403
        
        expense = Expense.query.get_or_404(expense_id)
        
        # Only draft or rejected expenses can be deleted
        if expense.status not in ['draft', 'rejected']:
            return jsonify({'success': False, 'error': 'Only draft or rejected expenses can be deleted'}), 400
        
        # Delete receipt file if exists
        if expense.receipt_file_path and os.path.exists(expense.receipt_file_path):
            os.remove(expense.receipt_file_path)
        
        db.session.delete(expense)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Expense deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================================================
# RECEIPT UPLOAD
# ============================================================================

@expense_bp.route('/<int:expense_id>/upload-receipt', methods=['POST'])
@jwt_required()
def upload_receipt(expense_id):
    """Upload receipt file for expense"""
    try:
        user_id = get_jwt_identity()
        
        # Check permission
        # if not check_permission('expense.edit'):
        #     return jsonify({'success': False, 'error': 'Permission denied'}), 403
        
        expense = Expense.query.get_or_404(expense_id)
        
        # Only draft expenses can have receipts uploaded
        if expense.status != 'draft':
            return jsonify({'success': False, 'error': 'Only draft expenses can have receipts uploaded'}), 400
        
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'success': False, 'error': 'Invalid file type. Allowed: png, jpg, jpeg, pdf, gif'}), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_FILE_SIZE:
            return jsonify({'success': False, 'error': f'File too large. Max size: {MAX_FILE_SIZE // (1024*1024)}MB'}), 400
        
        # Save file
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        new_filename = f"{expense.expense_number}_{timestamp}_{filename}"
        
        upload_dir = os.path.join(current_app.root_path, 'uploads', 'expenses')
        os.makedirs(upload_dir, exist_ok=True)
        
        file_path = os.path.join(upload_dir, new_filename)
        file.save(file_path)
        
        # Update expense
        expense.receipt_file_path = file_path
        expense.receipt_file_name = filename
        expense.receipt_file_type = file.content_type
        expense.receipt_file_size = file_size
        expense.receipt_uploaded_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Receipt uploaded successfully',
            'receipt': {
                'file_name': filename,
                'file_type': file.content_type,
                'file_size': file_size,
                'uploaded_at': expense.receipt_uploaded_at.isoformat()
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@expense_bp.route('/<int:expense_id>/receipt', methods=['GET'])
@jwt_required()
def get_receipt(expense_id):
    """Download receipt file"""
    try:
        user_id = get_jwt_identity()
        
        # Check permission
        # if not check_permission('expense.view'):
        #     return jsonify({'success': False, 'error': 'Permission denied'}), 403
        
        expense = Expense.query.get_or_404(expense_id)
        
        if not expense.receipt_file_path or not os.path.exists(expense.receipt_file_path):
            return jsonify({'success': False, 'error': 'Receipt file not found'}), 404
        
        return send_from_directory(
            os.path.dirname(expense.receipt_file_path),
            os.path.basename(expense.receipt_file_path),
            as_attachment=True,
            download_name=expense.receipt_file_name
        )
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================================================
# EXPENSE WORKFLOW
# ============================================================================

@expense_bp.route('/<int:expense_id>/submit', methods=['POST'])
@jwt_required()
def submit_expense(expense_id):
    """Submit expense for approval"""
    try:
        user_id = get_jwt_identity()
        
        # Check permission
        # if not check_permission('expense.submit'):
        #     return jsonify({'success': False, 'error': 'Permission denied'}), 403
        
        expense = Expense.query.get_or_404(expense_id)
        
        if expense.status != 'draft':
            return jsonify({'success': False, 'error': 'Only draft expenses can be submitted'}), 400
        
        # Check if employee is submitting their own expense
        employee = Employee.query.filter_by(user_id=user_id).first()
        if not employee or expense.employee_id != employee.id:
            return jsonify({'success': False, 'error': 'You can only submit your own expenses'}), 403
        
        expense.status = 'submitted'
        expense.submitted_at = datetime.utcnow()
        expense.submitted_by = user_id
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Expense submitted for approval'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@expense_bp.route('/<int:expense_id>/approve', methods=['POST'])
@jwt_required()
def approve_expense(expense_id):
    """Approve expense"""
    try:
        user_id = get_jwt_identity()
        
        # Check permission
        # if not check_permission('expense.approve'):
        #     return jsonify({'success': False, 'error': 'Permission denied'}), 403
        
        # Only admins may approve expenses
        if not can_view_all(user_id):
            return jsonify({'success': False, 'error': 'Permission denied'}), 403

        expense = Expense.query.get_or_404(expense_id)
        
        if expense.status != 'submitted':
            return jsonify({'success': False, 'error': 'Only submitted expenses can be approved'}), 400
        
        data = request.get_json() or {}
        
        expense.status = 'approved'
        expense.approved_by = user_id
        expense.approved_at = datetime.utcnow()
        expense.approval_notes = data.get('approval_notes')
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Expense approved successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@expense_bp.route('/<int:expense_id>/reject', methods=['POST'])
@jwt_required()
def reject_expense(expense_id):
    """Reject expense"""
    try:
        user_id = get_jwt_identity()
        
        # Check permission
        # if not check_permission('expense.approve'):
        #     return jsonify({'success': False, 'error': 'Permission denied'}), 403
        
        # Only admins may reject expenses
        if not can_view_all(user_id):
            return jsonify({'success': False, 'error': 'Permission denied'}), 403

        expense = Expense.query.get_or_404(expense_id)
        
        if expense.status != 'submitted':
            return jsonify({'success': False, 'error': 'Only submitted expenses can be rejected'}), 400
        
        data = request.get_json() or {}
        
        if not data.get('rejection_reason'):
            return jsonify({'success': False, 'error': 'Rejection reason is required'}), 400
        
        expense.status = 'rejected'
        expense.rejected_by = user_id
        expense.rejected_at = datetime.utcnow()
        expense.rejection_reason = data.get('rejection_reason')
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Expense rejected successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================================================
# REIMBURSEMENT
# ============================================================================

@expense_bp.route('/reimbursements', methods=['GET'])
@jwt_required()
def get_reimbursements():
    """Get list of reimbursements"""
    try:
        user_id = get_jwt_identity()
        
        # Check permission
        # if not check_permission('expense.view'):
        #     return jsonify({'success': False, 'error': 'Permission denied'}), 403
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        employee_id = request.args.get('employee_id', type=int)
        
        query = Reimbursement.query
        
        # Filter by employee (admins see all, others see only their own)
        if not can_view_all(user_id):
            employee = Employee.query.filter_by(user_id=user_id).first()
            if employee:
                query = query.filter_by(employee_id=employee.id)
            else:
                return jsonify({'success': False, 'error': 'Employee not found'}), 404

        if employee_id:
            query = query.filter_by(employee_id=employee_id)
        
        if status:
            query = query.filter_by(status=status)
        
        query = query.order_by(Reimbursement.created_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        reimbursements = []
        for reimb in pagination.items:
            reimbursements.append({
                'id': reimb.id,
                'reimbursement_number': reimb.reimbursement_number,
                'employee_id': reimb.employee_id,
                'employee_name': reimb.employee_name,
                'total_amount': float(reimb.total_amount) if reimb.total_amount else 0,
                'currency': reimb.currency,
                'payment_method': reimb.payment_method,
                'status': reimb.status,
                'status_display': reimb.status_display,
                'expense_count': reimb.expense_count,
                'submitted_at': reimb.submitted_at.isoformat() if reimb.submitted_at else None,
                'approved_at': reimb.approved_at.isoformat() if reimb.approved_at else None,
                'paid_at': reimb.paid_at.isoformat() if reimb.paid_at else None,
                'created_at': reimb.created_at.isoformat() if reimb.created_at else None,
            })
        
        return jsonify({
            'success': True,
            'reimbursements': reimbursements,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@expense_bp.route('/reimbursements', methods=['POST'])
@jwt_required()
def create_reimbursement():
    """Create new reimbursement batch"""
    try:
        user_id = get_jwt_identity()
        
        # Check permission
        # if not check_permission('expense.create'):
        #     return jsonify({'success': False, 'error': 'Permission denied'}), 403
        
        data = request.get_json()
        
        expense_ids = data.get('expense_ids', [])
        if not expense_ids:
            return jsonify({'success': False, 'error': 'No expenses provided'}), 400
        
        # Validate expenses
        expenses = Expense.query.filter(Expense.id.in_(expense_ids)).all()
        if len(expenses) != len(expense_ids):
            return jsonify({'success': False, 'error': 'Some expenses not found'}), 404
        
        # Check if all expenses are approved and not yet reimbursed
        for exp in expenses:
            if exp.status != 'approved':
                return jsonify({'success': False, 'error': f'Expense {exp.expense_number} is not approved'}), 400
            if exp.reimbursement_id:
                return jsonify({'success': False, 'error': f'Expense {exp.expense_number} is already reimbursed'}), 400
        
        # Check all expenses belong to same employee
        employee_id = expenses[0].employee_id
        if not all(exp.employee_id == employee_id for exp in expenses):
            return jsonify({'success': False, 'error': 'All expenses must belong to the same employee'}), 400
        
        employee = Employee.query.get(employee_id)
        
        # Calculate total
        total_amount = sum(exp.amount_base for exp in expenses)
        
        reimbursement = Reimbursement(
            employee_id=employee.id,
            employee_name=employee.full_name,
            total_amount=total_amount,
            currency='IDR',
            payment_method=data.get('payment_method'),
            bank_account_number=data.get('bank_account_number'),
            bank_account_name=data.get('bank_account_name'),
            bank_name=data.get('bank_name'),
            reimbursement_period_start=datetime.strptime(data.get('period_start'), '%Y-%m-%d').date() if data.get('period_start') else None,
            reimbursement_period_end=datetime.strptime(data.get('period_end'), '%Y-%m-%d').date() if data.get('period_end') else None,
            notes=data.get('notes'),
            created_by=user_id,
            status='pending'
        )
        
        db.session.add(reimbursement)
        db.session.flush()
        
        # Link expenses to reimbursement
        for exp in expenses:
            exp.reimbursement_id = reimbursement.id
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Reimbursement created successfully',
            'reimbursement': {
                'id': reimbursement.id,
                'reimbursement_number': reimbursement.reimbursement_number
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@expense_bp.route('/reimbursements/<int:reimbursement_id>/approve', methods=['POST'])
@jwt_required()
def approve_reimbursement(reimbursement_id):
    """Approve reimbursement"""
    try:
        user_id = get_jwt_identity()
        
        # Check permission
        # if not check_permission('expense.approve'):
        #     return jsonify({'success': False, 'error': 'Permission denied'}), 403
        
        # Only admins may approve reimbursements
        if not can_view_all(user_id):
            return jsonify({'success': False, 'error': 'Permission denied'}), 403

        reimbursement = Reimbursement.query.get_or_404(reimbursement_id)
        
        if reimbursement.status != 'pending':
            return jsonify({'success': False, 'error': 'Only pending reimbursements can be approved'}), 400
        
        reimbursement.status = 'approved'
        reimbursement.approved_by = user_id
        reimbursement.approved_at = datetime.utcnow()
        
        # Mark expenses as paid
        for exp in reimbursement.expenses:
            exp.status = 'paid'
            exp.reimbursed_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Reimbursement approved successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@expense_bp.route('/reimbursements/<int:reimbursement_id>/pay', methods=['POST'])
@jwt_required()
def pay_reimbursement(reimbursement_id):
    """Mark reimbursement as paid"""
    try:
        user_id = get_jwt_identity()
        
        # Check permission
        # if not check_permission('expense.payment'):
        #     return jsonify({'success': False, 'error': 'Permission denied'}), 403
        
        # Only admins may process payments
        if not can_view_all(user_id):
            return jsonify({'success': False, 'error': 'Permission denied'}), 403

        reimbursement = Reimbursement.query.get_or_404(reimbursement_id)
        
        if reimbursement.status != 'approved':
            return jsonify({'success': False, 'error': 'Only approved reimbursements can be paid'}), 400
        
        data = request.get_json() or {}
        
        reimbursement.status = 'paid'
        reimbursement.processed_by = user_id
        reimbursement.processed_at = datetime.utcnow()
        reimbursement.paid_by = user_id
        reimbursement.paid_at = datetime.utcnow()
        reimbursement.payment_reference = data.get('payment_reference')
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Reimbursement marked as paid'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================================================
# DASHBOARD & SUMMARY
# ============================================================================

@expense_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def get_expense_dashboard():
    """Get expense dashboard summary"""
    try:
        user_id = get_jwt_identity()
        
        # Check permission
        # if not check_permission('expense.view'):
        #     return jsonify({'success': False, 'error': 'Permission denied'}), 403
        
        # Filter by employee (admins see all, others see only their own)
        employee_filter = []
        if not can_view_all(user_id):
            employee = Employee.query.filter_by(user_id=user_id).first()
            if employee:
                employee_filter = [Expense.employee_id == employee.id]
        
        # Get summary
        total_expenses = db.session.query(func.sum(Expense.amount_base)).filter(*employee_filter).scalar() or 0
        pending_expenses = db.session.query(func.count(Expense.id)).filter(
            *employee_filter,
            Expense.status == 'submitted'
        ).scalar() or 0
        approved_expenses = db.session.query(func.count(Expense.id)).filter(
            *employee_filter,
            Expense.status == 'approved'
        ).scalar() or 0
        
        # This month's expenses
        from datetime import date
        this_month = date.today().replace(day=1)
        monthly_expenses = db.session.query(func.sum(Expense.amount_base)).filter(
            *employee_filter,
            Expense.expense_date >= this_month
        ).scalar() or 0
        
        # By category
        category_breakdown = db.session.query(
            Expense.expense_category,
            func.sum(Expense.amount_base)
        ).filter(*employee_filter).group_by(Expense.expense_category).all()
        
        return jsonify({
            'success': True,
            'dashboard': {
                'total_expenses': float(total_expenses),
                'pending_expenses': pending_expenses,
                'approved_expenses': approved_expenses,
                'monthly_expenses': float(monthly_expenses),
                'category_breakdown': [
                    {'category': cat, 'amount': float(amt)}
                    for cat, amt in category_breakdown
                ]
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
