"""
Global Search Routes - Search across all modules
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_, and_, func
from models import db, User
from models.product import Product
from models.sales import SalesOrder, Customer
from models.production import WorkOrder
from models.purchasing import PurchaseOrder, Supplier
from models.warehouse import Inventory
from models.quality import QualityInspection
from models.hr import Employee
from models.dcc import DccDocument
from models.maintenance import MaintenanceRecord
from utils.auth_decorators import _get_user_permissions

search_bp = Blueprint('search', __name__)


def _can_view(module, perms, bypass):
    """A search section is only included if the current user can view that module."""
    return bypass or f'{module}.view' in perms


# Nama jenis dokumen dalam Bahasa Indonesia (dan padanan Inggrisnya) supaya
# mengetik "surat jalan" atau "penerimaan barang" memunculkan dokumen jenis
# itu - sebelumnya kata yang diketik hanya dibandingkan dengan isi kolom,
# jadi hanya ketemu kalau orang hafal awalan nomornya (SHP-, BPB-, INV-).
_TYPE_ALIASES = {
    'products': ['produk', 'barang', 'product', 'master barang'],
    'production': ['spk', 'work order', 'wo', 'perintah kerja', 'surat perintah kerja'],
    'sales_orders': ['sales order', 'so', 'pesanan penjualan', 'order penjualan', 'pesanan'],
    'customers': ['pelanggan', 'customer', 'konsumen', 'klien'],
    'purchase_orders': ['purchase order', 'po', 'pesanan pembelian', 'order pembelian', 'pembelian'],
    'suppliers': ['pemasok', 'supplier', 'vendor'],
    'employees': ['karyawan', 'pegawai', 'employee'],
    'dcc': ['dokumen', 'document', 'dcc'],
    'invoices_sales': ['faktur penjualan', 'invoice penjualan'],
    'invoices_purchase': ['faktur pembelian', 'invoice pembelian'],
    'invoices': ['faktur', 'invoice', 'tagihan'],
    'shipping': ['surat jalan', 'sj', 'pengiriman', 'delivery order'],
    'grn': ['penerimaan barang', 'penerimaan', 'bpb', 'grn', 'terima barang'],
}

# Label jenis yang dipakai di hasil, untuk menaikkan urutan saat jenisnya
# yang diketik.
_HINT_LABELS = {
    'products': {'Product'}, 'production': {'Work Order'}, 'sales_orders': {'Sales Order'},
    'customers': {'Customer'}, 'purchase_orders': {'Purchase Order'}, 'suppliers': {'Supplier'},
    'employees': {'Employee'}, 'dcc': {'Document'}, 'shipping': {'Surat Jalan'},
    'grn': {'Penerimaan Barang'}, 'invoices': {'Faktur Penjualan', 'Faktur Pembelian'},
    'invoices_sales': {'Faktur Penjualan'}, 'invoices_purchase': {'Faktur Pembelian'},
}

# Berapa dokumen terbaru yang ditampilkan kalau yang diketik nama jenisnya.
_HINT_LIMIT = 10


def _type_hints(query):
    """Bagian mana yang diminta lewat NAMA jenisnya, bukan lewat isi kolom.

    Cocok persis (supaya singkatan pendek seperti 'so'/'po'/'sj' tidak ikut
    tiap kali orang mengetik dua huruf) atau awalan minimal 4 huruf, supaya
    "surat" sudah memunculkan Surat Jalan sebelum kata kedua diketik.
    """
    term = ' '.join(query.lower().split())
    if not term:
        return set()
    hits = set()
    for section, aliases in _TYPE_ALIASES.items():
        if any(term == a or (len(term) >= 4 and a.startswith(term)) for a in aliases):
            hits.add(section)
    return hits


def _search_rows(model, condition, hinted, limit, order_column=None):
    """Baris untuk satu bagian: dokumen terbaru kalau jenisnya yang diketik,
    selain itu pencarian biasa ke isi kolom."""
    if hinted:
        return model.query.order_by((order_column if order_column is not None else model.id).desc()).limit(min(limit, _HINT_LIMIT)).all()
    return model.query.filter(condition).limit(limit).all()


@search_bp.route('/global', methods=['GET'])
@jwt_required()
def global_search():
    """
    Global search across all modules - each section is filtered by the
    caller's own module permissions, so a user only ever sees results from
    modules they're actually allowed to view.
    """
    try:
        current_user_id = get_jwt_identity()
        current_user = db.session.get(User, int(current_user_id))
        bypass = bool(current_user and getattr(current_user, 'is_super_admin', False))  # is_admin no longer bypasses - see auth_decorators.py require_permission comment
        perms = _get_user_permissions(current_user) if current_user and not bypass else set()

        query = request.args.get('q', '').strip()
        module_filter = request.args.get('module', 'all')
        limit = int(request.args.get('limit', 50))

        if not query:
            return jsonify({
                'success': True,
                'data': {
                    'results': [],
                    'total': 0,
                    'query': query
                }
            })

        results = []
        like = f'%{query}%'
        hints = _type_hints(query)

        # Search Products
        if module_filter in ['all', 'products'] and _can_view('products', perms, bypass):
            try:
                products = _search_rows(Product, or_(
                    Product.name.ilike(like),
                    Product.code.ilike(like),
                    Product.description.ilike(like),
                ), 'products' in hints, limit)
                
                for product in products:
                    results.append({
                        'id': product.id,
                        'type': 'Product',
                        'module': 'products',
                        'title': product.name,
                        'subtitle': product.code,
                        'description': product.description or '',
                        'url': f'/app/products/{product.id}',
                        'icon': 'cube',
                        'color': 'purple',
                        'metadata': {
                            'category': product.category or 'N/A',
                            'status': 'active' if product.is_active else 'inactive'
                        }
                    })
            except Exception as e:
                print(f"Error searching products: {e}")
        
        # Search Work Orders
        if module_filter in ['all', 'production'] and _can_view('production', perms, bypass):
            try:
                work_orders = _search_rows(WorkOrder, or_(
                    WorkOrder.wo_number.ilike(like),
                    WorkOrder.notes.ilike(like),
                ), 'production' in hints, limit)
                
                for wo in work_orders:
                    results.append({
                        'id': wo.id,
                        'type': 'Work Order',
                        'module': 'production',
                        'title': wo.wo_number,
                        'subtitle': f'Status: {wo.status}',
                        'description': wo.notes or '',
                        'url': f'/app/production/work-orders/{wo.id}',
                        'icon': 'clipboard-document-list',
                        'color': 'blue',
                        'metadata': {
                            'status': wo.status,
                            'priority': wo.priority or 'normal',
                            'date': wo.created_at.strftime('%Y-%m-%d') if wo.created_at else ''
                        }
                    })
            except Exception as e:
                print(f"Error searching work orders: {e}")
        
        # Search Sales Orders
        if module_filter in ['all', 'sales'] and _can_view('sales_orders', perms, bypass):
            try:
                sales_orders = _search_rows(SalesOrder, or_(
                    SalesOrder.order_number.ilike(like),
                    SalesOrder.notes.ilike(like),
                ), 'sales_orders' in hints, limit)
                
                for so in sales_orders:
                    results.append({
                        'id': so.id,
                        'type': 'Sales Order',
                        'module': 'sales',
                        'title': so.order_number,
                        'subtitle': f'Status: {so.status}',
                        'description': so.notes or '',
                        'url': f'/app/sales/orders/{so.id}',
                        'icon': 'shopping-cart',
                        'color': 'green',
                        'metadata': {
                            'status': so.status,
                            'total': f'Rp {so.total_amount:,.0f}' if so.total_amount else 'N/A',
                            'date': so.order_date.strftime('%Y-%m-%d') if so.order_date else ''
                        }
                    })
            except Exception as e:
                print(f"Error searching sales orders: {e}")
        
        # Search Customers
        if module_filter in ['all', 'sales'] and _can_view('customers', perms, bypass):
            try:
                customers = _search_rows(Customer, or_(
                    Customer.company_name.ilike(like),
                    Customer.email.ilike(like),
                    Customer.phone.ilike(like),
                ), 'customers' in hints, limit)
                
                for customer in customers:
                    results.append({
                        'id': customer.id,
                        'type': 'Customer',
                        'module': 'sales',
                        'title': customer.company_name,
                        'subtitle': customer.email or customer.phone or '',
                        'description': customer.billing_address or '',
                        'url': f'/app/sales/customers/{customer.id}',
                        'icon': 'user',
                        'color': 'green',
                        'metadata': {
                            'type': customer.customer_type or 'N/A',
                            'status': 'active' if customer.is_active else 'inactive'
                        }
                    })
            except Exception as e:
                print(f"Error searching customers: {e}")
        
        # Search Purchase Orders
        if module_filter in ['all', 'purchasing'] and _can_view('purchase_orders', perms, bypass):
            try:
                purchase_orders = _search_rows(PurchaseOrder, or_(
                    PurchaseOrder.po_number.ilike(like),
                    PurchaseOrder.notes.ilike(like),
                ), 'purchase_orders' in hints, limit)
                
                for po in purchase_orders:
                    results.append({
                        'id': po.id,
                        'type': 'Purchase Order',
                        'module': 'purchasing',
                        'title': po.po_number,
                        'subtitle': f'Status: {po.status}',
                        'description': po.notes or '',
                        'url': f'/app/purchasing/purchase-orders/{po.id}',
                        'icon': 'shopping-bag',
                        'color': 'orange',
                        'metadata': {
                            'status': po.status,
                            'total': f'Rp {po.total_amount:,.0f}' if po.total_amount else 'N/A',
                            'date': po.order_date.strftime('%Y-%m-%d') if po.order_date else ''
                        }
                    })
            except Exception as e:
                print(f"Error searching purchase orders: {e}")
        
        # Search Suppliers
        if module_filter in ['all', 'purchasing'] and _can_view('suppliers', perms, bypass):
            try:
                suppliers = _search_rows(Supplier, or_(
                    Supplier.company_name.ilike(like),
                    Supplier.email.ilike(like),
                    Supplier.phone.ilike(like),
                ), 'suppliers' in hints, limit)
                
                for supplier in suppliers:
                    results.append({
                        'id': supplier.id,
                        'type': 'Supplier',
                        'module': 'purchasing',
                        'title': supplier.company_name,
                        'subtitle': supplier.email or supplier.phone or '',
                        'description': supplier.address or '',
                        'url': f'/app/purchasing/suppliers/{supplier.id}',
                        'icon': 'building-storefront',
                        'color': 'orange',
                        'metadata': {
                            'status': 'active' if supplier.is_active else 'inactive'
                        }
                    })
            except Exception as e:
                print(f"Error searching suppliers: {e}")
        
        # Search Employees
        if module_filter in ['all', 'hr'] and _can_view('employees', perms, bypass):
            try:
                employees = _search_rows(Employee, or_(
                    Employee.full_name.ilike(like),
                    Employee.email.ilike(like),
                    Employee.employee_number.ilike(like),
                ), 'employees' in hints, limit)
                
                for employee in employees:
                    results.append({
                        'id': employee.id,
                        'type': 'Employee',
                        'module': 'hr',
                        'title': employee.full_name,
                        'subtitle': employee.employee_number or '',
                        'description': employee.position or '',
                        'url': f'/app/hr/employees/{employee.id}',
                        'icon': 'user',
                        'color': 'indigo',
                        'metadata': {
                            'department': employee.department or 'N/A',
                            'status': employee.status or 'active'
                        }
                    })
            except Exception as e:
                print(f"Error searching employees: {e}")
        
        # Search DCC Documents
        if module_filter in ['all', 'dcc'] and _can_view('dcc', perms, bypass):
            try:
                documents = _search_rows(DccDocument, or_(
                    DccDocument.document_number.ilike(like),
                    DccDocument.title.ilike(like),
                ), 'dcc' in hints, limit)
                
                for doc in documents:
                    results.append({
                        'id': doc.id,
                        'type': 'Document',
                        'module': 'dcc',
                        'title': doc.title or doc.document_number,
                        'subtitle': doc.document_number,
                        'description': doc.document_level or '',
                        'url': f'/app/dcc?tab=documents&view={doc.id}',
                        'icon': 'document-text',
                        'color': 'red',
                        'metadata': {
                            'status': 'active' if doc.is_active else 'inactive',
                            'date': doc.created_at.strftime('%Y-%m-%d') if doc.created_at else ''
                        }
                    })
            except Exception as e:
                print(f"Error searching documents: {e}")
        
        # Dokumen transaksi lain: faktur, surat jalan, penerimaan barang
        if module_filter in ['all', 'finance'] and _can_view('invoices', perms, bypass):
            try:
                from models.finance import Invoice
                inv_q = Invoice.query
                inv_hinted = bool({'invoices', 'invoices_sales', 'invoices_purchase'} & hints)
                if 'invoices_sales' in hints:
                    inv_q = inv_q.filter(Invoice.invoice_type == 'sales')
                elif 'invoices_purchase' in hints:
                    inv_q = inv_q.filter(Invoice.invoice_type != 'sales')
                elif not inv_hinted:
                    inv_q = inv_q.filter(Invoice.invoice_number.ilike(like))
                for inv in inv_q.order_by(Invoice.id.desc()).limit(min(limit, _HINT_LIMIT) if inv_hinted else limit).all():
                    sales = inv.invoice_type == 'sales'
                    results.append({'id': inv.id, 'type': 'Faktur Penjualan' if sales else 'Faktur Pembelian', 'module': 'finance',
                                    'title': inv.invoice_number, 'subtitle': f'Status: {inv.status}',
                                    'url': f'/app/sales/invoices/{inv.id}' if sales else f'/app/purchasing/invoices/{inv.id}'})
            except Exception as e:
                print(f"Error searching invoices: {e}")
        if module_filter in ['all', 'shipping'] and _can_view('shipping', perms, bypass):
            try:
                from models.shipping import ShippingOrder
                for so in _search_rows(ShippingOrder, or_(ShippingOrder.shipping_number.ilike(like), ShippingOrder.tracking_number.ilike(like)), 'shipping' in hints, limit):
                    results.append({'id': so.id, 'type': 'Surat Jalan', 'module': 'shipping', 'title': so.shipping_number,
                                    'subtitle': f'Status: {so.status}', 'url': f'/app/shipping/orders/{so.id}'})
            except Exception as e:
                print(f"Error searching shipping: {e}")
        if module_filter in ['all', 'purchasing'] and _can_view('purchase_orders', perms, bypass):
            try:
                from models.purchasing import GoodsReceivedNote
                for g in _search_rows(GoodsReceivedNote, GoodsReceivedNote.grn_number.ilike(like), 'grn' in hints, limit):
                    results.append({'id': g.id, 'type': 'Penerimaan Barang', 'module': 'purchasing', 'title': g.grn_number,
                                    'subtitle': f'Status: {g.status}', 'url': f'/app/purchasing/grn/{g.id}'})
            except Exception as e:
                print(f"Error searching GRN: {e}")

        # Sort results by relevance (exact matches first)
        hinted_labels = set()
        for section in hints:
            hinted_labels |= _HINT_LABELS.get(section, set())

        def relevance_score(result):
            title_lower = result['title'].lower()
            query_lower = query.lower()
            if result['type'] in hinted_labels and query_lower not in title_lower:
                # Jenisnya yang diketik: taruh setelah cocok persis/awalan,
                # tapi sebelum hasil yang cuma kebetulan mengandung kata itu.
                return 2
            if title_lower == query_lower:
                return 0
            elif title_lower.startswith(query_lower):
                return 1
            elif query_lower in title_lower:
                return 2
            else:
                return 3
        
        results.sort(key=relevance_score)
        
        return jsonify({
            'success': True,
            'data': {
                'results': results[:limit],
                'total': len(results),
                'query': query,
                'module_filter': module_filter
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@search_bp.route('/suggestions', methods=['GET'])
@jwt_required()
def search_suggestions():
    """
    Get search suggestions based on partial query - filtered by the caller's
    own module permissions, same rule as /global.
    """
    try:
        current_user_id = get_jwt_identity()
        current_user = db.session.get(User, int(current_user_id))
        bypass = bool(current_user and getattr(current_user, 'is_super_admin', False))  # is_admin no longer bypasses - see auth_decorators.py require_permission comment
        perms = _get_user_permissions(current_user) if current_user and not bypass else set()

        query = request.args.get('q', '').strip()
        limit = int(request.args.get('limit', 10))

        if len(query) < 2:
            return jsonify({
                'success': True,
                'data': []
            })

        suggestions = []

        # Get suggestions from various sources
        try:
            # Products
            if _can_view('products', perms, bypass):
                products = Product.query.filter(
                    Product.name.ilike(f'%{query}%')
                ).limit(5).all()
                suggestions.extend([p.name for p in products])

            # Work Orders
            if _can_view('production', perms, bypass):
                work_orders = WorkOrder.query.filter(
                    WorkOrder.wo_number.ilike(f'%{query}%')
                ).limit(5).all()
                suggestions.extend([wo.wo_number for wo in work_orders])

            # Customers
            if _can_view('customers', perms, bypass):
                customers = Customer.query.filter(
                    Customer.company_name.ilike(f'%{query}%')
                ).limit(5).all()
                suggestions.extend([c.company_name for c in customers])

        except Exception as e:
            print(f"Error getting suggestions: {e}")
        
        # Remove duplicates and limit
        suggestions = list(set(suggestions))[:limit]
        
        return jsonify({
            'success': True,
            'data': suggestions
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
