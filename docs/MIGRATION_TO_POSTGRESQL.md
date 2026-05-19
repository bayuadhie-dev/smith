# Migration Plan: SQLite → PostgreSQL

## 📋 Overview
Migrasi database dari SQLite ke PostgreSQL untuk menyelesaikan masalah Syncthing conflict dan meningkatkan performa multi-user access.

---

## ⏱️ Estimasi Waktu
- **Persiapan**: 30 menit
- **Migrasi**: 30-60 menit
- **Testing**: 30 menit
- **Total**: 1.5 - 2 jam

---

## 🎯 Pre-Migration Checklist

### 1. Backup Database (WAJIB!)
```bash
# Backup database SQLite
cd backend
cp instance/erp_database.db instance/erp_database_backup_$(date +%Y%m%d_%H%M%S).db

# Backup semua conflict files (untuk jaga-jaga)
mkdir -p backups/sqlite_conflicts
mv instance/*.sync-conflict-*.db backups/sqlite_conflicts/

# Export data ke SQL dump
sqlite3 instance/erp_database.db .dump > backups/sqlite_dump_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Install PostgreSQL
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib python3-psycopg2

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installation
psql --version
```

### 3. Install Python Dependencies
```bash
cd backend
source venv/bin/activate
pip install psycopg2-binary alembic
```

---

## 🔧 Migration Steps

### STEP 1: Create PostgreSQL Database

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt:
CREATE DATABASE erp_production;
CREATE USER erp_admin WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE erp_production TO erp_admin;
\q
```

### STEP 2: Update Application Config

**File: `backend/.env`**
```bash
# Backup current .env
cp .env .env.sqlite.backup

# Add PostgreSQL config
cat >> .env << 'EOF'

# PostgreSQL Configuration
DATABASE_TYPE=postgresql
POSTGRES_USER=erp_admin
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=erp_production
EOF
```

**File: `backend/config.py`**
```python
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Determine database type
    DATABASE_TYPE = os.getenv('DATABASE_TYPE', 'sqlite')
    
    if DATABASE_TYPE == 'postgresql':
        # PostgreSQL configuration
        POSTGRES_USER = os.getenv('POSTGRES_USER', 'erp_admin')
        POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD')
        POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'localhost')
        POSTGRES_PORT = os.getenv('POSTGRES_PORT', '5432')
        POSTGRES_DB = os.getenv('POSTGRES_DB', 'erp_production')
        
        SQLALCHEMY_DATABASE_URI = f'postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}'
    else:
        # SQLite configuration (fallback)
        basedir = os.path.abspath(os.path.dirname(__file__))
        SQLALCHEMY_DATABASE_URI = f'sqlite:///{os.path.join(basedir, "instance", "erp_database.db")}'
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key')
```

### STEP 3: Create Migration Script

**File: `backend/migrate_to_postgresql.py`**
```python
#!/usr/bin/env python
"""
Migrate data from SQLite to PostgreSQL
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, MetaData, Table
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import time

load_dotenv()

# Source: SQLite
SQLITE_URI = 'sqlite:///instance/erp_database.db'

# Target: PostgreSQL
POSTGRES_USER = os.getenv('POSTGRES_USER', 'erp_admin')
POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD')
POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'localhost')
POSTGRES_PORT = os.getenv('POSTGRES_PORT', '5432')
POSTGRES_DB = os.getenv('POSTGRES_DB', 'erp_production')
POSTGRES_URI = f'postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}'

print("=" * 80)
print("MIGRATION: SQLite → PostgreSQL")
print("=" * 80)

# Connect to databases
print("\n1. Connecting to databases...")
sqlite_engine = create_engine(SQLITE_URI)
postgres_engine = create_engine(POSTGRES_URI)

print(f"   ✓ SQLite: {SQLITE_URI}")
print(f"   ✓ PostgreSQL: {POSTGRES_DB}@{POSTGRES_HOST}")

# Get metadata
print("\n2. Reading SQLite schema...")
sqlite_metadata = MetaData()
sqlite_metadata.reflect(bind=sqlite_engine)

table_names = list(sqlite_metadata.tables.keys())
print(f"   Found {len(table_names)} tables")

# Create tables in PostgreSQL
print("\n3. Creating tables in PostgreSQL...")
from app import create_app, db

app = create_app()
with app.app_context():
    # Set to PostgreSQL temporarily
    app.config['SQLALCHEMY_DATABASE_URI'] = POSTGRES_URI
    db.create_all()
    print("   ✓ All tables created")

# Migrate data table by table
print("\n4. Migrating data...")

SQLiteSession = sessionmaker(bind=sqlite_engine)
PostgresSession = sessionmaker(bind=postgres_engine)

sqlite_session = SQLiteSession()
postgres_session = PostgresSession()

# Order tables by dependencies (manual ordering to avoid FK conflicts)
ordered_tables = [
    'users', 'roles', 'permissions', 'user_roles',
    'departments', 'staff',
    'customers', 'suppliers',
    'products', 'materials',
    'machines', 'work_orders',
    'shift_productions', 'packing_lists', 'packing_list_items',
    'weekly_production_plans', 'weekly_production_plan_items', 'schedule_grid_items',
    'purchase_orders', 'purchase_order_items',
    'purchase_invoices', 'purchase_invoice_items',
    'purchase_returns', 'purchase_return_items',
    'inventory', 'material_inventory',
    'attendances', 'staff_faces',
    # Add other tables as needed
]

total_rows = 0

for table_name in ordered_tables:
    if table_name not in sqlite_metadata.tables:
        print(f"   ⚠ Skipping {table_name} (not found in SQLite)")
        continue
    
    try:
        table = Table(table_name, sqlite_metadata, autoload_with=sqlite_engine)
        
        # Read from SQLite
        rows = sqlite_session.execute(table.select()).fetchall()
        
        if len(rows) == 0:
            print(f"   ○ {table_name}: 0 rows (empty)")
            continue
        
        # Insert to PostgreSQL
        postgres_table = Table(table_name, MetaData(), autoload_with=postgres_engine)
        
        # Convert rows to dicts
        data = []
        for row in rows:
            data.append(dict(row._mapping))
        
        # Batch insert
        if data:
            postgres_session.execute(postgres_table.insert(), data)
            postgres_session.commit()
        
        total_rows += len(rows)
        print(f"   ✓ {table_name}: {len(rows)} rows")
        
    except Exception as e:
        print(f"   ✗ {table_name}: ERROR - {str(e)}")
        postgres_session.rollback()

# Handle remaining tables not in ordered list
remaining_tables = [t for t in table_names if t not in ordered_tables]
if remaining_tables:
    print(f"\n5. Migrating remaining tables...")
    for table_name in remaining_tables:
        try:
            table = Table(table_name, sqlite_metadata, autoload_with=sqlite_engine)
            rows = sqlite_session.execute(table.select()).fetchall()
            
            if len(rows) == 0:
                continue
            
            postgres_table = Table(table_name, MetaData(), autoload_with=postgres_engine)
            data = [dict(row._mapping) for row in rows]
            
            if data:
                postgres_session.execute(postgres_table.insert(), data)
                postgres_session.commit()
            
            total_rows += len(rows)
            print(f"   ✓ {table_name}: {len(rows)} rows")
            
        except Exception as e:
            print(f"   ✗ {table_name}: ERROR - {str(e)}")
            postgres_session.rollback()

# Update sequences (PostgreSQL auto-increment)
print("\n6. Updating sequences...")
try:
    for table_name in table_names:
        # Find primary key column (usually 'id')
        result = postgres_session.execute(f"""
            SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), 
                   COALESCE((SELECT MAX(id) FROM {table_name}), 1), true)
        """)
        print(f"   ✓ {table_name} sequence updated")
except Exception as e:
    print(f"   ⚠ Sequence update: {str(e)}")

sqlite_session.close()
postgres_session.close()

print("\n" + "=" * 80)
print(f"✅ MIGRATION COMPLETE!")
print(f"   Total rows migrated: {total_rows:,}")
print("=" * 80)
print("\nNext steps:")
print("1. Update .env: DATABASE_TYPE=postgresql")
print("2. Restart backend: python app.py")
print("3. Test all features")
print("4. If OK, remove SQLite database from Syncthing")
```

### STEP 4: Run Migration

```bash
# Stop backend server first!
# Ctrl+C to stop

# Run migration script
cd backend
python migrate_to_postgresql.py

# If successful, update .env
nano .env
# Change: DATABASE_TYPE=postgresql

# Restart backend
python app.py
```

### STEP 5: Verify Migration

```bash
# Connect to PostgreSQL
psql -U erp_admin -d erp_production -h localhost

# Check tables
\dt

# Check row counts
SELECT 'users' as table_name, COUNT(*) FROM users
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'shift_productions', COUNT(*) FROM shift_productions
UNION ALL
SELECT 'machines', COUNT(*) FROM machines;

# Exit
\q
```

---

## ✅ Post-Migration Testing

### 1. Test Critical Features
- [ ] Login/Authentication
- [ ] Production input (shift production)
- [ ] Production monitoring dashboard
- [ ] Work order management
- [ ] Inventory management
- [ ] Reports generation

### 2. Test Data Integrity
```bash
# Run verification script
python verify_migration.py
```

### 3. Performance Test
- [ ] Dashboard load time
- [ ] Query response time
- [ ] Concurrent user access

---

## 🔄 Rollback Plan (If Migration Fails)

```bash
# Stop backend
# Ctrl+C

# Restore .env
cd backend
cp .env.sqlite.backup .env

# Verify DATABASE_TYPE=sqlite (or remove the line)
nano .env

# Restart backend
python app.py
```

---

## 🔒 Security Recommendations

### 1. PostgreSQL Security
```bash
# Edit PostgreSQL config
sudo nano /etc/postgresql/*/main/pg_hba.conf

# Change from 'trust' to 'md5' for password authentication
# local   all   all   md5
# host    all   all   127.0.0.1/32   md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### 2. Firewall (if remote access needed)
```bash
# Allow PostgreSQL port (only if needed)
sudo ufw allow 5432/tcp

# Or restrict to specific IP
sudo ufw allow from 192.168.1.0/24 to any port 5432
```

### 3. Strong Password
```bash
# Change PostgreSQL password
sudo -u postgres psql
ALTER USER erp_admin WITH PASSWORD 'new_very_strong_password_here';
\q
```

---

## 📊 After Migration

### 1. Remove SQLite from Syncthing
```bash
# Add to .stignore in Syncthing folder
echo "instance/*.db" >> .stignore
echo "instance/*.db-*" >> .stignore

# Or move database out of synced folder
mkdir -p ~/erp_backups
mv instance/erp_database*.db ~/erp_backups/
```

### 2. Setup PostgreSQL Backup
```bash
# Create backup script
cat > ~/backup_postgres.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=~/erp_backups/postgres
mkdir -p $BACKUP_DIR
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U erp_admin -h localhost erp_production | gzip > $BACKUP_DIR/erp_backup_$DATE.sql.gz
# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
EOF

chmod +x ~/backup_postgres.sh

# Add to crontab (daily backup at 2 AM)
crontab -e
# Add line:
# 0 2 * * * ~/backup_postgres.sh
```

### 3. Monitor Performance
```bash
# Install pgAdmin (optional, for GUI management)
# Or use command line monitoring
psql -U erp_admin -d erp_production -h localhost -c "
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

---

## 🆘 Troubleshooting

### Issue: "psycopg2 not found"
```bash
pip install psycopg2-binary
```

### Issue: "Connection refused"
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check if listening
sudo netstat -plnt | grep 5432

# Check logs
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

### Issue: "Authentication failed"
```bash
# Reset password
sudo -u postgres psql
ALTER USER erp_admin WITH PASSWORD 'new_password';
\q

# Update .env with new password
```

### Issue: "Slow queries"
```bash
# Create indexes (after migration)
psql -U erp_admin -d erp_production -h localhost

CREATE INDEX idx_shift_prod_date ON shift_productions(production_date);
CREATE INDEX idx_shift_prod_machine ON shift_productions(machine_id);
CREATE INDEX idx_shift_prod_product ON shift_productions(product_id);
CREATE INDEX idx_work_orders_status ON work_orders(status);
```

---

## 📞 Support

Jika ada masalah saat migrasi:
1. **JANGAN PANIC** - SQLite backup masih ada
2. **Screenshot error message**
3. **Check logs**: `tail -f backend/logs/app.log`
4. **Rollback jika perlu** (lihat Rollback Plan)

---

## ✨ Benefits After Migration

✅ **No more Syncthing conflicts**
✅ **Better multi-user performance**
✅ **Centralized database**
✅ **Better data integrity**
✅ **Easier backup & restore**
✅ **Production-ready**

---

**Created**: 2026-05-11
**Status**: Ready for execution
**Estimated Downtime**: 1-2 hours
