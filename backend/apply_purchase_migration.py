#!/usr/bin/env python
"""Manual migration script to apply PurchaseInvoice and PurchaseReturn tables"""
from app import create_app
from models import db

def apply_manual_migration():
    app = create_app()
    with app.app_context():
        try:
            # Create purchase_invoices table
            db.session.execute('''
                CREATE TABLE IF NOT EXISTS purchase_invoices (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    invoice_number VARCHAR(100) NOT NULL UNIQUE,
                    po_id INTEGER NOT NULL,
                    supplier_id INTEGER NOT NULL,
                    invoice_date DATE NOT NULL,
                    due_date DATE,
                    supplier_invoice_number VARCHAR(100),
                    supplier_invoice_date DATE,
                    status VARCHAR(50) NOT NULL DEFAULT 'draft',
                    payment_status VARCHAR(50) NOT NULL DEFAULT 'unpaid',
                    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
                    exchange_rate DECIMAL(10, 4),
                    payment_terms VARCHAR(100),
                    payment_method VARCHAR(50),
                    subtotal DECIMAL(15, 2),
                    tax_amount DECIMAL(15, 2),
                    discount_amount DECIMAL(15, 2),
                    shipping_amount DECIMAL(15, 2),
                    other_charges DECIMAL(15, 2),
                    total_amount DECIMAL(15, 2),
                    amount_paid DECIMAL(15, 2),
                    balance_due DECIMAL(15, 2),
                    notes TEXT,
                    internal_notes TEXT,
                    received_by INTEGER,
                    posted_by INTEGER,
                    posted_at DATETIME,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
                    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
                    FOREIGN KEY (posted_by) REFERENCES users(id),
                    FOREIGN KEY (received_by) REFERENCES users(id)
                )
            ''')
            
            db.session.execute('CREATE INDEX IF NOT EXISTS ix_purchase_invoices_invoice_date ON purchase_invoices(invoice_date)')
            
            # Create purchase_invoice_items table
            db.session.execute('''
                CREATE TABLE IF NOT EXISTS purchase_invoice_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    invoice_id INTEGER NOT NULL,
                    po_item_id INTEGER NOT NULL,
                    line_number INTEGER NOT NULL,
                    product_id INTEGER,
                    material_id INTEGER,
                    description TEXT,
                    quantity DECIMAL(15, 2) NOT NULL,
                    uom VARCHAR(20) NOT NULL,
                    unit_price DECIMAL(15, 2) NOT NULL,
                    discount_percent DECIMAL(5, 2),
                    discount_amount DECIMAL(15, 2),
                    tax_percent DECIMAL(5, 2),
                    tax_amount DECIMAL(15, 2),
                    total_price DECIMAL(15, 2) NOT NULL,
                    quantity_returned DECIMAL(15, 2),
                    notes TEXT,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
                    FOREIGN KEY (material_id) REFERENCES materials(id),
                    FOREIGN KEY (po_item_id) REFERENCES purchase_order_items(id),
                    FOREIGN KEY (product_id) REFERENCES products(id),
                    UNIQUE (invoice_id, line_number)
                )
            ''')
            
            # Create purchase_returns table
            db.session.execute('''
                CREATE TABLE IF NOT EXISTS purchase_returns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    return_number VARCHAR(100) NOT NULL UNIQUE,
                    invoice_id INTEGER NOT NULL,
                    supplier_id INTEGER NOT NULL,
                    return_date DATE NOT NULL,
                    reason VARCHAR(255) NOT NULL,
                    return_type VARCHAR(50) NOT NULL,
                    status VARCHAR(50) NOT NULL DEFAULT 'draft',
                    approval_status VARCHAR(50) NOT NULL DEFAULT 'pending',
                    currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
                    exchange_rate DECIMAL(10, 4),
                    subtotal DECIMAL(15, 2),
                    tax_amount DECIMAL(15, 2),
                    discount_amount DECIMAL(15, 2),
                    total_amount DECIMAL(15, 2),
                    credit_note_number VARCHAR(100),
                    credit_note_date DATE,
                    notes TEXT,
                    internal_notes TEXT,
                    created_by INTEGER,
                    approved_by INTEGER,
                    approved_at DATETIME,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (approved_by) REFERENCES users(id),
                    FOREIGN KEY (created_by) REFERENCES users(id),
                    FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id),
                    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
                )
            ''')
            
            db.session.execute('CREATE INDEX IF NOT EXISTS ix_purchase_returns_return_date ON purchase_returns(return_date)')
            
            # Create purchase_return_items table
            db.session.execute('''
                CREATE TABLE IF NOT EXISTS purchase_return_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    return_id INTEGER NOT NULL,
                    invoice_item_id INTEGER NOT NULL,
                    line_number INTEGER NOT NULL,
                    product_id INTEGER,
                    material_id INTEGER,
                    description TEXT,
                    quantity DECIMAL(15, 2) NOT NULL,
                    uom VARCHAR(20) NOT NULL,
                    unit_price DECIMAL(15, 2) NOT NULL,
                    discount_percent DECIMAL(5, 2),
                    discount_amount DECIMAL(15, 2),
                    tax_percent DECIMAL(5, 2),
                    tax_amount DECIMAL(15, 2),
                    total_price DECIMAL(15, 2) NOT NULL,
                    reason TEXT,
                    notes TEXT,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (invoice_item_id) REFERENCES purchase_invoice_items(id),
                    FOREIGN KEY (material_id) REFERENCES materials(id),
                    FOREIGN KEY (product_id) REFERENCES products(id),
                    FOREIGN KEY (return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
                    UNIQUE (return_id, line_number)
                )
            ''')
            
            # Update alembic_version table to mark migration as applied
            db.session.execute('''
                INSERT OR REPLACE INTO alembic_version (version_num)
                VALUES ('7889c902bbc1')
            ''')
            
            db.session.commit()
            print('✓ Manual migration applied successfully!')
            print('✓ Created tables: purchase_invoices, purchase_invoice_items, purchase_returns, purchase_return_items')
            print('✓ Updated alembic_version to 7889c902bbc1')
            
        except Exception as e:
            db.session.rollback()
            print(f'✗ Error applying manual migration: {e}')
            import traceback
            traceback.print_exc()
            raise

if __name__ == '__main__':
    apply_manual_migration()
