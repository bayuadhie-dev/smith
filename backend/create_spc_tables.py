import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'instance', 'erp_database.db')

print(f"Connecting to {DB_PATH}...")
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# ============================================================
# 1. spc_parameters
# ============================================================
print("\n[1/5] Creating spc_parameters...")
cursor.execute("""
    CREATE TABLE IF NOT EXISTS spc_parameters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        uom VARCHAR(50),
        parameter_type VARCHAR(50) NOT NULL DEFAULT 'variable',
        is_active BOOLEAN NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
""")
print("  + spc_parameters created")

# ============================================================
# 2. spc_product_specs
# ============================================================
print("\n[2/5] Creating spc_product_specs...")
cursor.execute("""
    CREATE TABLE IF NOT EXISTS spc_product_specs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES products(id),
        parameter_id INTEGER NOT NULL REFERENCES spc_parameters(id),
        target_value NUMERIC(15,4),
        usl NUMERIC(15,4),
        lsl NUMERIC(15,4),
        ucl NUMERIC(15,4),
        lcl NUMERIC(15,4),
        ucl_r NUMERIC(15,4),
        lcl_r NUMERIC(15,4),
        subgroup_size INTEGER NOT NULL DEFAULT 5,
        auto_calculate BOOLEAN NOT NULL DEFAULT 1,
        min_subgroups INTEGER NOT NULL DEFAULT 25,
        is_active BOOLEAN NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (product_id, parameter_id)
    )
""")
print("  + spc_product_specs created")

# ============================================================
# 3. spc_samples
# ============================================================
print("\n[3/5] Creating spc_samples...")
cursor.execute("""
    CREATE TABLE IF NOT EXISTS spc_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sample_number VARCHAR(100) UNIQUE NOT NULL,
        product_id INTEGER NOT NULL REFERENCES products(id),
        work_order_id INTEGER REFERENCES work_orders(id),
        machine_id INTEGER REFERENCES machines(id),
        shift VARCHAR(20),
        sub_shift VARCHAR(5),
        sample_date DATE NOT NULL,
        sample_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        subgroup_size INTEGER NOT NULL DEFAULT 5,
        total_inspected INTEGER,
        total_defective INTEGER,
        notes TEXT,
        sampled_by INTEGER REFERENCES users(id),
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
""")
print("  + spc_samples created")

# ============================================================
# 4. spc_measurements
# ============================================================
print("\n[4/5] Creating spc_measurements...")
cursor.execute("""
    CREATE TABLE IF NOT EXISTS spc_measurements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sample_id INTEGER NOT NULL REFERENCES spc_samples(id),
        parameter_id INTEGER NOT NULL REFERENCES spc_parameters(id),
        readings TEXT NOT NULL,
        xbar NUMERIC(15,4),
        r_value NUMERIC(15,4),
        s_value NUMERIC(15,4),
        is_out_of_control BOOLEAN NOT NULL DEFAULT 0,
        violation_rules TEXT,
        notes TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (sample_id, parameter_id)
    )
""")
print("  + spc_measurements created")

# ============================================================
# 5. spc_control_limit_history
# ============================================================
print("\n[5/5] Creating spc_control_limit_history...")
cursor.execute("""
    CREATE TABLE IF NOT EXISTS spc_control_limit_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES products(id),
        parameter_id INTEGER NOT NULL REFERENCES spc_parameters(id),
        ucl NUMERIC(15,4),
        lcl NUMERIC(15,4),
        ucl_r NUMERIC(15,4),
        lcl_r NUMERIC(15,4),
        xbar_bar NUMERIC(15,4),
        r_bar NUMERIC(15,4),
        cp NUMERIC(10,4),
        cpk NUMERIC(10,4),
        pp NUMERIC(10,4),
        ppk NUMERIC(10,4),
        subgroups_used INTEGER,
        effective_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        effective_to DATETIME,
        calculated_by INTEGER REFERENCES users(id),
        notes TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
""")
print("  + spc_control_limit_history created")

# ============================================================
# Seed default parameters
# ============================================================
print("\nSeeding default SPC parameters...")
default_params = [
    ('GSM',       'Gramasi (GSM)',           'Berat per meter persegi kain nonwoven',  'g/m²',   'variable'),
    ('CD',        'Cross Direction (CD)',    'Kekuatan tarik arah cross',              'N/5cm',  'variable'),
    ('MD',        'Machine Direction (MD)',  'Kekuatan tarik arah mesin',              'N/5cm',  'variable'),
    ('THICKNESS', 'Ketebalan',               'Ketebalan produk',                       'mm',     'variable'),
    ('MOISTURE',  'Kadar Air',               'Moisture content produk',                '%',      'variable'),
    ('PH',        'pH Level',                'Tingkat keasaman cairan',                'pH',     'variable'),
    ('DEFECT_P',  'Defect Rate (p)',         'Proporsi defect per batch',              '%',      'attribute'),
]

for code, name, desc, uom, ptype in default_params:
    try:
        cursor.execute("""
            INSERT INTO spc_parameters (code, name, description, uom, parameter_type)
            VALUES (?, ?, ?, ?, ?)
        """, (code, name, desc, uom, ptype))
        print(f"  + Seeded parameter: {code}")
    except sqlite3.IntegrityError:
        print(f"  = Parameter {code} already exists")

# ============================================================
# Create indexes
# ============================================================
print("\nCreating indexes...")
indexes = [
    "CREATE INDEX IF NOT EXISTS idx_spc_samples_product ON spc_samples(product_id)",
    "CREATE INDEX IF NOT EXISTS idx_spc_samples_wo ON spc_samples(work_order_id)",
    "CREATE INDEX IF NOT EXISTS idx_spc_samples_date ON spc_samples(sample_date)",
    "CREATE INDEX IF NOT EXISTS idx_spc_measurements_sample ON spc_measurements(sample_id)",
    "CREATE INDEX IF NOT EXISTS idx_spc_measurements_param ON spc_measurements(parameter_id)",
    "CREATE INDEX IF NOT EXISTS idx_spc_measurements_ooc ON spc_measurements(is_out_of_control)",
]
for idx in indexes:
    cursor.execute(idx)
    print(f"  + {idx.split('idx_')[1].split(' ')[0]}")

conn.commit()
conn.close()
print("\n✅ SPC migration complete!")
print("Tabel baru: spc_parameters, spc_product_specs, spc_samples, spc_measurements, spc_control_limit_history")
print("Default parameters: GSM, CD, MD, THICKNESS, MOISTURE, PH, DEFECT_P")
