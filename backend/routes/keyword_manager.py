"""
Downtime Keyword Manager - Flask Blueprint
Mengelola keyword downtime dari satu tempat (database),
dengan fitur sync ke semua file source code dan regenerate downtime records.

Akses di: /keywordedit
"""
import os
import re
import json
from datetime import datetime
from flask import Blueprint, request, jsonify, render_template, send_file
from models import db
from sqlalchemy import text

keyword_manager_bp = Blueprint('keyword_manager', __name__,
                                template_folder='../templates')

# ============================================================
# DATABASE HELPERS
# ============================================================

def ensure_table_exists():
    """Create downtime_keywords table if it doesn't exist"""
    db.session.execute(text('''
        CREATE TABLE IF NOT EXISTS downtime_keywords (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            keyword TEXT NOT NULL UNIQUE COLLATE NOCASE,
            category TEXT NOT NULL,
            priority INTEGER DEFAULT 0,
            notes TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    '''))
    db.session.commit()


def get_all_keywords():
    """Get all keywords from database"""
    ensure_table_exists()
    result = db.session.execute(text(
        'SELECT id, keyword, category, priority, notes, created_at, updated_at '
        'FROM downtime_keywords ORDER BY category, priority DESC, keyword'
    ))
    rows = result.fetchall()
    return [dict(row._mapping) for row in rows]


def get_keywords_by_category(category):
    """Get keywords for a specific category"""
    ensure_table_exists()
    result = db.session.execute(text(
        'SELECT id, keyword, category, priority, notes, created_at, updated_at '
        'FROM downtime_keywords WHERE category = :cat ORDER BY priority DESC, keyword'
    ), {'cat': category})
    rows = result.fetchall()
    return [dict(row._mapping) for row in rows]


def get_keywords_grouped():
    """Get all keywords grouped by category"""
    all_kw = get_all_keywords()
    grouped = {}
    for kw in all_kw:
        cat = kw['category']
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append(kw['keyword'])
    return grouped


def get_stats():
    """Get keyword count per category"""
    ensure_table_exists()
    result = db.session.execute(text(
        'SELECT category, COUNT(*) as count FROM downtime_keywords GROUP BY category ORDER BY category'
    ))
    rows = result.fetchall()
    stats = {row._mapping['category']: row._mapping['count'] for row in rows}
    total = sum(stats.values())
    return {'categories': stats, 'total': total}


# ============================================================
# IMPORT FROM EXISTING CODE
# ============================================================

def extract_keywords_from_helpers():
    """Extract all keywords from helpers.py detect_downtime_category function"""
    keywords = {}
    
    # Istirahat keywords
    keywords['istirahat'] = [
        'istirahat', 'sholat', 'solat', 'shalat', 'break',
        'toilet', 'makan', 'minum'
    ]
    
    # Idle keywords
    keywords['idle'] = [
        'tunggu kain', 'ambil kain', 'tunggu stiker', 'tunggu packaging', 'tunggu mixing',
        'tunggu bahan', 'tunggu material', 'tunggu label', 'tunggu box',
        'tunggu karton', 'tunggu lem', 'tunggu tinta', 'tunggu order',
        'tunggu obat', 'tunggu ingredient', 'tunggu produk', 'tunggu instruksi', 'tunggu approval',
        'tunggu qc', 'tunggu hasil qc', 'tunggu bahan kimia',
        'tunggu temperatur stabil', 'tunggu temperatur',
        'tunggu temperature stabil', 'tunggu temperature',
        'tunggu keranjang', 'tunggu trolley', 'tunggu troli',
        'tunggu sarung tangan', 'tunggu glove', 'tunggu gloves',
        'menunggu kain', 'menunggu stiker', 'menunggu packaging', 'menunggu mixing',
        'menunggu obat', 'menunggu tinta',
        'nunggu kain', 'nunggu stiker', 'nunggu packaging', 'nunggu mixing',
        'nunggu obat', 'nunggu tinta',
        'kain belum datang', 'stiker belum datang', 'obat belum datang',
        'packaging belum datang', 'box belum datang', 'mixing belum siap',
        'ingredient habis', 'obat habis', 'stiker habis', 'packing habis',
        'packaging habis', 'label habis', 'karton habis', 'box habis',
        'keranjang habis', 'trolley habis', 'troli habis',
        'lem habis', 'tinta habis', 'kain habis',
        'waiting for', 'idle', 'standby', 'menganggur',
        'tidak ada order', 'no order', 'menghabiskan order', 'menhabiskan order',
        'susun produk',
        'menyiapkan produk', 'siapkan produk', 'persiapan produk'
    ]
    
    # Design keywords
    keywords['design'] = [
        'design error', 'desain salah', 'pattern salah', 'pola salah',
        'ukuran salah', 'spec salah', 'spesifikasi salah', 'revisi design',
        'revisi desain', 'sample', 'prototype', 'trial', 'testing design',
        'changeover', 'ganti produk', 'ganti order', 'ganti stiker', 'ganti packaging',
        'ganti label', 'ganti karton', 'ganti', 'sanitasi',
        'cleaning', 'warmup', 'persiapan produksi',
        'repack', 'repacking', 're-pack', 're packing',
        'pasang kain', 'pasang packaging', 'pasang stiker',
        'setting dan tunggu temperatur', 'setting tunggu temperatur'
    ]
    
    # Operator keywords
    keywords['operator'] = [
        'keluar jalur (sambungan)', 'sambungan', 'salah setting', 'salah pasang',
        'operator error', 'human error', 'kesalahan operator', 'lupa', 'telat',
        'tidak fokus', 'kurang teliti', 'salah input', 'salah ukur',
        'setting'
    ]
    
    # Material keywords
    keywords['material'] = [
        'keluar jalur (kain terlalu tipis', 'keluar jalur (kain gembos',
        'keluar jalur (kain tidak sesuai', 'kain terlalu tipis', 'kain gembos',
        'kain tidak sesuai', 'material cacat', 'bahan cacat', 'kain cacat',
        'material rusak', 'bahan rusak', 'kain rusak', 'material habis',
        'bahan habis', 'material kurang', 'bahan kurang',
        'benang putus', 'benang habis', 'kualitas kain', 'kain tipis',
        'raw material', 'bahan baku'
    ]
    
    # Mesin keywords (combined with inkjet)
    keywords['mesin'] = [
        # Generic mesin
        'keluar jalur (bak mesin', 'bak mesin', 'mesin rusak', 'mesin error',
        'mesin mati', 'mesin trouble', 'mesin macet', 'breakdown', 'maintenance',
        'ganti sparepart', 'sparepart',
        # Seal issues
        'seal bocor', 'seal melipat', 'seal rapuh', 'seal samping', 'seal bawah',
        'endseal', 'end seal',
        # Temperature / suhu
        'temperature', 'suhu',
        # Lipatan kain / folding mechanism
        'lipatan', 'folding', 'penjepit',
        # Pisau / blade
        'pisau',
        # Tekanan angin / air pressure
        'tekanan angin', 'angin bocor', 'angin habis', 'angin drop',
        # MC Press
        'mc press',
        # Product getting sealed
        'terseal', 'keseal', 'ke seal',
        # Dosing mechanism
        'dosing', 'dossing',
        # Stacking mechanism
        'stacking',
        # Pound / punching
        'pound',
        # Selang / hoses
        'selang',
        # Sensor
        'sensor',
        # Perbaikan
        'perbaikan',
        # Tumpukan
        'tumpukan',
        # Menggulung
        'menggulung',
        # Electrical / mechanical
        'motor rusak', 'bearing', 'belt putus', 'overheating', 'overheat',
        'listrik mati', 'power failure', 'compressor',
        'pneumatic', 'hidrolik', 'hydraulic', 'kalibrasi', 'calibration',
        'jarum patah', 'jarum bengkok', 'tension', 'needle',
        # Stacker / conveyor
        'stacker', 'vanbelt', 'conveyor',
        # Stiker position
        'posisi stiker',
        # Kain issues (machine alignment)
        'lebar kain tidak maksimal', 'lebar kain',
        # Specific items
        'baut stacking lepas',
        'produk bocor',
        # Feeding / pusher mechanism
        'pusher', 'feeding',
        # Stability issues
        'tidak stabil', 'tidak maksimal', 'simetris',
        # Tidak rapi
        'tidak rapi',
        # Added items
        'guset', 'relay', 'simetris error', 'stiker putus',
        'kain keluar jalur', 'kain menggulung', 'exhaust error',
        # Inkjet (also mesin)
        'inkjet', 'ink jet', 'ink-jet', 'inkjet error', 'inkjet macet',
        'printer inkjet', 'head inkjet', 'tinta inkjet', 'cartridge inkjet',
        'setting inkjet',
        # Keluar jalur generic
        'keluar jalur'
    ]
    
    # Others (fallback)
    keywords['others'] = []
    
    return keywords


def import_keywords_to_db():
    """Import all keywords from code into the database"""
    ensure_table_exists()
    keywords = extract_keywords_from_helpers()
    
    imported = 0
    skipped = 0
    errors = []
    
    for category, kw_list in keywords.items():
        for kw in kw_list:
            kw = kw.strip()
            if not kw:
                continue
            try:
                # Check if already exists
                existing = db.session.execute(text(
                    'SELECT id FROM downtime_keywords WHERE keyword = :kw COLLATE NOCASE'
                ), {'kw': kw}).fetchone()
                
                if existing:
                    skipped += 1
                    continue
                
                db.session.execute(text(
                    'INSERT INTO downtime_keywords (keyword, category, priority, notes) '
                    'VALUES (:kw, :cat, 0, :notes)'
                ), {'kw': kw, 'cat': category, 'notes': f'Imported from code'})
                imported += 1
            except Exception as e:
                errors.append(f'{kw}: {str(e)}')
    
    db.session.commit()
    return {'imported': imported, 'skipped': skipped, 'errors': errors}


# ============================================================
# SYNC TO SOURCE FILES
# ============================================================

def get_project_root():
    """Get the project root directory (backend folder)"""
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def sync_helpers_py(grouped_keywords):
    """Sync keywords to backend/utils/helpers.py"""
    filepath = os.path.join(get_project_root(), 'utils', 'helpers.py')
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Generate new detect_downtime_category function
    new_func = generate_helpers_function(grouped_keywords)
    
    # Replace the function using regex
    # Match from 'def detect_downtime_category' to the end of function (next def or EOF)
    pattern = r"(def detect_downtime_category\(.*?\n).*?(\n\ndef |\Z)"
    
    # Simpler approach: find start and end
    start_marker = "def detect_downtime_category("
    start_idx = content.find(start_marker)
    
    if start_idx == -1:
        return False, "Function detect_downtime_category not found in helpers.py"
    
    # The function ends at the end of the file in this case
    new_content = content[:start_idx] + new_func + "\n"
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    return True, f"helpers.py updated successfully"


def generate_helpers_function(grouped_keywords):
    """Generate the detect_downtime_category function for helpers.py"""
    
    def format_keyword_list(keywords, indent=8):
        """Format a list of keywords as Python string literals"""
        if not keywords:
            return ""
        prefix = " " * indent
        lines = []
        line = prefix
        for i, kw in enumerate(keywords):
            item = f"'{kw}'"
            if i < len(keywords) - 1:
                item += ", "
            if len(line) + len(item) > 100:
                lines.append(line)
                line = prefix + item
            else:
                line += item
        if line.strip():
            lines.append(line)
        return "\n".join(lines)
    
    istirahat = grouped_keywords.get('istirahat', [])
    idle = grouped_keywords.get('idle', [])
    design = grouped_keywords.get('design', [])
    operator = grouped_keywords.get('operator', [])
    material = grouped_keywords.get('material', [])
    mesin = grouped_keywords.get('mesin', [])
    
    func = '''def detect_downtime_category(issue_text: str, is_first_entry: bool = False) -> str:
    """
    Auto-detect downtime category from issue description keywords.
    Returns: 'mesin', 'operator', 'material', 'design', 'idle', 'istirahat', or 'others'
    
    AUTO-GENERATED by Keyword Manager GUI - DO NOT EDIT MANUALLY
    Last synced: {timestamp}
    
    Args:
        issue_text: The downtime reason/issue description
        is_first_entry: Whether this is the first downtime entry (affects 'setting mc/mesin' categorization)
    """
    if not issue_text:
        return 'others'
    
    text_lower = issue_text.lower()
    
    # ISTIRAHAT - break/prayer time (check FIRST - highest priority)
    istirahat_keywords = [
{istirahat_kw}
    ]
    for kw in istirahat_keywords:
        if kw in text_lower:
            return 'others'
    
    # IDLE TIME keywords - waiting for materials/resources (check early - high priority)
    idle_keywords = [
{idle_kw}
    ]
    for kw in idle_keywords:
        if kw in text_lower:
            return 'idle'
    
    # DESIGN keywords - check BEFORE "setting mc" to catch changeover context
    design_keywords = [
{design_kw}
    ]
    for kw in design_keywords:
        if kw in text_lower:
            return 'design'
    
    # SPECIAL CASE: "setting mc/mesin" - depends on position
    if 'setting mc' in text_lower or 'setting mesin' in text_lower:
        return 'design' if is_first_entry else 'mesin'
    
    # OPERATOR keywords
    operator_keywords = [
{operator_kw}
    ]
    for kw in operator_keywords:
        if kw in text_lower:
            return 'operator'
    
    # MATERIAL/RAW MATERIAL keywords
    material_keywords = [
{material_kw}
    ]
    for kw in material_keywords:
        if kw in text_lower:
            return 'material'
    
    # MESIN keywords - comprehensive machine-related issues
    mesin_keywords = [
{mesin_kw}
    ]
    for kw in mesin_keywords:
        if kw in text_lower:
            return 'mesin'
    
    # Generic "keluar jalur" without specific cause -> mesin
    if 'keluar jalur' in text_lower:
        return 'mesin'
    
    return 'others'
'''.format(
        timestamp=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        istirahat_kw=format_keyword_list(istirahat),
        idle_kw=format_keyword_list(idle),
        design_kw=format_keyword_list(design),
        operator_kw=format_keyword_list(operator),
        material_kw=format_keyword_list(material),
        mesin_kw=format_keyword_list(mesin)
    )
    
    return func


def sync_oee_py(grouped_keywords):
    """Sync idle_keywords to all 3 locations in oee.py"""
    filepath = os.path.join(get_project_root(), 'routes', 'oee.py')
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    idle_kws = grouped_keywords.get('idle', [])
    
    # Find and replace all 3 idle_keywords blocks
    # Pattern: [indent]idle_keywords = [\n ... \n        ]
    pattern = r'([ \t]*)(idle_keywords\s*=\s*\[)\n.*?\n([ \t]*\])'
    
    def replacer(match):
        indent_spaces = match.group(1)
        indent_len = len(indent_spaces)
        # We don't use generate_idle_block's prefix for the first line
        # because we'll just reconstruct it using the captured indent
        
        # Generate the rest of the lines with proper indentation
        lines = []
        lines.append(f"{indent_spaces}idle_keywords = [")
        
        line = indent_spaces + "    "
        for i, kw in enumerate(idle_kws):
            item = f"'{kw}'"
            if i < len(idle_kws) - 1:
                item += ", "
            if len(line) + len(item) > 100:
                lines.append(line)
                line = indent_spaces + "    " + item
            else:
                line += item
        if line.strip():
            lines.append(line)
        lines.append(match.group(3))
        
        return '\n'.join(lines)
    
    new_content, count = re.subn(pattern, replacer, content, flags=re.DOTALL)
    
    if count == 0:
        return False, "No idle_keywords blocks found in oee.py"
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    return True, f"oee.py updated: {count} idle_keywords blocks replaced"


def generate_idle_block(idle_kws, indent=8):
    """Generate idle_keywords = [...] block with proper indentation"""
    prefix = " " * indent
    lines = [f"{prefix}idle_keywords = ["]
    
    line = prefix + "    "
    for i, kw in enumerate(idle_kws):
        item = f"'{kw}'"
        if i < len(idle_kws) - 1:
            item += ", "
        if len(line) + len(item) > 100:
            lines.append(line)
            line = prefix + "    " + item
        else:
            line += item
    if line.strip():
        lines.append(line)
    lines.append(f"{prefix}]")
    
    return "\n".join(lines)


def sync_frontend_file(filepath, grouped_keywords):
    """Sync CATEGORY_KEYWORDS to a frontend TypeScript/TSX file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Generate new CATEGORY_KEYWORDS object
    new_keywords_obj = generate_tsx_keywords(grouped_keywords)
    
    # Find and replace CATEGORY_KEYWORDS block
    # Pattern: const CATEGORY_KEYWORDS ... = {\n ... \n};
    pattern = r'const CATEGORY_KEYWORDS[^=]*=\s*\{.*?\n\};'
    
    new_content, count = re.subn(pattern, new_keywords_obj, content, flags=re.DOTALL)
    
    if count == 0:
        return False, f"CATEGORY_KEYWORDS not found in {os.path.basename(filepath)}"
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    return True, f"{os.path.basename(filepath)} updated successfully"


def generate_tsx_keywords(grouped_keywords):
    """Generate TypeScript CATEGORY_KEYWORDS object"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # Map backend categories to frontend categories
    # Frontend doesn't have 'istirahat' - it goes to 'others'
    frontend_categories = {
        'idle': grouped_keywords.get('idle', []),
        'mesin': grouped_keywords.get('mesin', []),
        'material': grouped_keywords.get('material', []),
        'design': grouped_keywords.get('design', []),
        'operator': grouped_keywords.get('operator', []),
        'others': grouped_keywords.get('others', []) + grouped_keywords.get('istirahat', [])
    }
    
    lines = [
        f'// AUTO-GENERATED by Keyword Manager GUI - DO NOT EDIT MANUALLY',
        f'// Last synced: {timestamp}',
        'const CATEGORY_KEYWORDS: Record<string, string[]> = {'
    ]
    
    category_comments = {
        'idle': '// IDLE: Menunggu material/resource - waktu tidak produktif bukan karena kerusakan',
        'mesin': '// MESIN (Machine/Equipment): Semua masalah teknis mesin dan komponen',
        'material': '// MATERIAL (Raw Material): Masalah bahan baku',
        'design': '// DESIGN CHANGE: Pergantian produk, sanitasi, cleaning',
        'operator': '// OPERATOR: Kesalahan manusia, setting, training',
        'others': '// OTHERS: Istirahat, ibadah, utilitas, dan lainnya'
    }
    
    for cat_name in ['idle', 'mesin', 'material', 'design', 'operator', 'others']:
        kws = frontend_categories.get(cat_name, [])
        comment = category_comments.get(cat_name, '')
        
        lines.append(f'  {comment}')
        lines.append(f'  {cat_name}: [')
        
        # Format keywords in rows
        line = "    "
        for i, kw in enumerate(kws):
            item = f"'{kw}'"
            if i < len(kws) - 1:
                item += ", "
            if len(line) + len(item) > 100:
                lines.append(line)
                line = "    " + item
            else:
                line += item
        if line.strip():
            lines.append(line)
        lines.append('  ],')
    
    lines.append('};')
    
    return "\n".join(lines)


def sync_all_files():
    """Sync keywords from database to all 4 source files"""
    grouped = get_keywords_grouped()
    results = []
    
    # 1. Sync helpers.py
    ok, msg = sync_helpers_py(grouped)
    results.append({'file': 'backend/utils/helpers.py', 'success': ok, 'message': msg})
    
    # 2. Sync oee.py (3 idle_keywords blocks)
    ok, msg = sync_oee_py(grouped)
    results.append({'file': 'backend/routes/oee.py', 'success': ok, 'message': msg})
    
    # 3. Sync WorkOrderProductionInput.tsx
    frontend_path1 = os.path.join(get_project_root(), '..', 'frontend', 'src', 'pages',
                                   'Production', 'WorkOrderProductionInput.tsx')
    frontend_path1 = os.path.normpath(frontend_path1)
    ok, msg = sync_frontend_file(frontend_path1, grouped)
    results.append({'file': 'frontend/.../WorkOrderProductionInput.tsx', 'success': ok, 'message': msg})
    
    # 4. Sync EditProductionRecord.tsx
    frontend_path2 = os.path.join(get_project_root(), '..', 'frontend', 'src', 'pages',
                                   'Production', 'EditProductionRecord.tsx')
    frontend_path2 = os.path.normpath(frontend_path2)
    ok, msg = sync_frontend_file(frontend_path2, grouped)
    results.append({'file': 'frontend/.../EditProductionRecord.tsx', 'success': ok, 'message': msg})
    
    return results


# ============================================================
# REGENERATE DOWNTIME
# ============================================================

def detect_from_db(issue_text, is_first_entry=False):
    """Detect downtime category using keywords from the database"""
    if not issue_text:
        return 'others'
    
    text_lower = issue_text.lower()
    
    # Get all keywords ordered by priority (descending) then category order
    category_order = ['istirahat', 'idle', 'design', 'operator', 'material', 'mesin', 'others']
    
    all_keywords = get_all_keywords()
    
    # Sort by priority desc, then by category order
    def sort_key(kw):
        cat_idx = category_order.index(kw['category']) if kw['category'] in category_order else 99
        return (-kw['priority'], cat_idx)
    
    all_keywords.sort(key=sort_key)
    
    # Special case: setting mc/mesin
    if 'setting mc' in text_lower or 'setting mesin' in text_lower:
        return 'design' if is_first_entry else 'mesin'
    
    for kw in all_keywords:
        if kw['keyword'].lower() in text_lower:
            return kw['category']
    
    # Generic keluar jalur
    if 'keluar jalur' in text_lower:
        return 'mesin'
    
    return 'others'


def regenerate_all_downtime():
    """Re-categorize all downtime entries in ShiftProduction"""
    from models.production import ShiftProduction
    
    shifts = ShiftProduction.query.filter(
        ShiftProduction.issues.isnot(None),
        ShiftProduction.issues != ''
    ).all()
    
    updated = 0
    total = len(shifts)
    errors = []
    
    for sp in shifts:
        try:
            old_issues = sp.issues
            new_issues = recategorize_issues(old_issues)
            
            if old_issues != new_issues:
                breakdown = calculate_breakdown(new_issues)
                
                sp.issues = new_issues
                sp.downtime_mesin = breakdown['downtime_mesin']
                sp.downtime_operator = breakdown['downtime_operator']
                sp.downtime_material = breakdown['downtime_material']
                sp.downtime_design = breakdown['downtime_design']
                sp.downtime_others = breakdown['downtime_others']
                if hasattr(sp, 'idle_time'):
                    sp.idle_time = breakdown['idle_time']
                
                sp.downtime_minutes = (
                    breakdown['downtime_mesin'] +
                    breakdown['downtime_operator'] +
                    breakdown['downtime_material'] +
                    breakdown['downtime_design'] +
                    breakdown['downtime_others']
                )
                
                updated += 1
        except Exception as e:
            errors.append(f"Record {sp.id}: {str(e)}")
    
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return {'total': total, 'updated': 0, 'errors': [str(e)]}
    
    return {'total': total, 'updated': updated, 'errors': errors}


def recategorize_issues(issues_str):
    """Parse and recategorize issues string"""
    if not issues_str:
        return issues_str
    
    entries = issues_str.split(';')
    updated = []
    
    for i, entry in enumerate(entries):
        entry = entry.strip()
        if not entry:
            continue
        
        match = re.match(r'(\d+)\s*menit\s*-\s*(.+?)\s*\[(\w+)\]', entry)
        if match:
            duration = match.group(1)
            description = match.group(2).strip()
            
            new_category = detect_from_db(description, is_first_entry=(i == 0))
            updated.append(f"{duration} menit - {description} [{new_category}]")
        else:
            updated.append(entry)
    
    return '; '.join(updated)


def calculate_breakdown(issues_str):
    """Calculate downtime breakdown from issues string"""
    breakdown = {
        'downtime_mesin': 0,
        'downtime_operator': 0,
        'downtime_material': 0,
        'downtime_design': 0,
        'downtime_others': 0,
        'idle_time': 0,
        'istirahat_time': 0
    }
    
    if not issues_str:
        return breakdown
    
    for entry in issues_str.split(';'):
        entry = entry.strip()
        if not entry:
            continue
        
        match = re.match(r'(\d+)\s*menit\s*-\s*(.+?)\s*\[(\w+)\]', entry)
        if match:
            duration = int(match.group(1))
            category = match.group(3)
            
            if category == 'mesin':
                breakdown['downtime_mesin'] += duration
            elif category == 'operator':
                breakdown['downtime_operator'] += duration
            elif category == 'material':
                breakdown['downtime_material'] += duration
            elif category == 'design':
                breakdown['downtime_design'] += duration
            elif category == 'idle':
                breakdown['idle_time'] += duration
            elif category == 'istirahat':
                breakdown['istirahat_time'] += duration
                breakdown['downtime_others'] += duration  # istirahat = downtime kategori others (kebijakan perusahaan)
            else:
                breakdown['downtime_others'] += duration
    
    return breakdown


# ============================================================
# ROUTES
# ============================================================

@keyword_manager_bp.route('/')
def index():
    """Serve the keyword manager GUI"""
    template_path = os.path.join(get_project_root(), 'templates', 'keyword_manager.html')
    if os.path.exists(template_path):
        return send_file(template_path)
    # Fallback to render_template
    return render_template('keyword_manager.html')


@keyword_manager_bp.route('/api/keywords', methods=['GET'])
def api_get_keywords():
    """Get all keywords, optionally filtered by category"""
    category = request.args.get('category')
    
    if category and category != 'all':
        keywords = get_keywords_by_category(category)
    else:
        keywords = get_all_keywords()
    
    # Serialize datetime objects
    for kw in keywords:
        if isinstance(kw.get('created_at'), datetime):
            kw['created_at'] = kw['created_at'].isoformat()
        if isinstance(kw.get('updated_at'), datetime):
            kw['updated_at'] = kw['updated_at'].isoformat()
    
    return jsonify({'keywords': keywords}), 200


@keyword_manager_bp.route('/api/keywords', methods=['POST'])
def api_create_keyword():
    """Create a new keyword"""
    data = request.get_json()
    
    keyword = data.get('keyword', '').strip().lower()
    category = data.get('category', '').strip()
    priority = data.get('priority', 0)
    notes = data.get('notes', '')
    
    if not keyword:
        return jsonify({'error': 'Keyword tidak boleh kosong'}), 400
    if not category:
        return jsonify({'error': 'Kategori harus dipilih'}), 400
    
    valid_categories = ['istirahat', 'idle', 'design', 'mesin', 'operator', 'material', 'others']
    if category not in valid_categories:
        return jsonify({'error': f'Kategori tidak valid. Pilih: {", ".join(valid_categories)}'}), 400
    
    ensure_table_exists()
    
    # Check duplicate
    existing = db.session.execute(text(
        'SELECT id FROM downtime_keywords WHERE keyword = :kw COLLATE NOCASE'
    ), {'kw': keyword}).fetchone()
    
    if existing:
        return jsonify({'error': f'Keyword "{keyword}" sudah ada'}), 409
    
    db.session.execute(text(
        'INSERT INTO downtime_keywords (keyword, category, priority, notes) '
        'VALUES (:kw, :cat, :pri, :notes)'
    ), {'kw': keyword, 'cat': category, 'pri': priority, 'notes': notes})
    db.session.commit()
    
    return jsonify({'message': f'Keyword "{keyword}" berhasil ditambahkan ke kategori {category}'}), 201


@keyword_manager_bp.route('/api/keywords/<int:id>', methods=['PUT'])
def api_update_keyword(id):
    """Update a keyword"""
    data = request.get_json()
    
    keyword = data.get('keyword', '').strip().lower()
    category = data.get('category', '').strip()
    priority = data.get('priority', 0)
    notes = data.get('notes', '')
    
    if not keyword:
        return jsonify({'error': 'Keyword tidak boleh kosong'}), 400
    
    ensure_table_exists()
    
    # Check exists
    existing = db.session.execute(text(
        'SELECT id FROM downtime_keywords WHERE id = :id'
    ), {'id': id}).fetchone()
    
    if not existing:
        return jsonify({'error': 'Keyword tidak ditemukan'}), 404
    
    # Check duplicate (different id, same keyword)
    dup = db.session.execute(text(
        'SELECT id FROM downtime_keywords WHERE keyword = :kw COLLATE NOCASE AND id != :id'
    ), {'kw': keyword, 'id': id}).fetchone()
    
    if dup:
        return jsonify({'error': f'Keyword "{keyword}" sudah ada di record lain'}), 409
    
    db.session.execute(text(
        'UPDATE downtime_keywords SET keyword = :kw, category = :cat, priority = :pri, '
        'notes = :notes, updated_at = CURRENT_TIMESTAMP WHERE id = :id'
    ), {'kw': keyword, 'cat': category, 'pri': priority, 'notes': notes, 'id': id})
    db.session.commit()
    
    return jsonify({'message': f'Keyword "{keyword}" berhasil diperbarui'}), 200


@keyword_manager_bp.route('/api/keywords/<int:id>', methods=['DELETE'])
def api_delete_keyword(id):
    """Delete a keyword"""
    ensure_table_exists()
    
    existing = db.session.execute(text(
        'SELECT keyword FROM downtime_keywords WHERE id = :id'
    ), {'id': id}).fetchone()
    
    if not existing:
        return jsonify({'error': 'Keyword tidak ditemukan'}), 404
    
    kw_name = existing._mapping['keyword']
    
    db.session.execute(text('DELETE FROM downtime_keywords WHERE id = :id'), {'id': id})
    db.session.commit()
    
    return jsonify({'message': f'Keyword "{kw_name}" berhasil dihapus'}), 200


@keyword_manager_bp.route('/api/import-from-code', methods=['POST'])
def api_import_from_code():
    """Import keywords from existing source code into database"""
    try:
        result = import_keywords_to_db()
        return jsonify({
            'message': f'Import selesai: {result["imported"]} ditambahkan, {result["skipped"]} sudah ada',
            'imported': result['imported'],
            'skipped': result['skipped'],
            'errors': result['errors']
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@keyword_manager_bp.route('/api/sync-to-files', methods=['POST'])
def api_sync_to_files():
    """Sync keywords from database to all source code files"""
    try:
        results = sync_all_files()
        all_success = all(r['success'] for r in results)
        return jsonify({
            'message': 'Sync selesai!' if all_success else 'Sync selesai dengan beberapa error',
            'results': results,
            'success': all_success
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@keyword_manager_bp.route('/api/regenerate', methods=['POST'])
def api_regenerate():
    """Regenerate/re-categorize all downtime records"""
    try:
        result = regenerate_all_downtime()
        return jsonify({
            'message': f'Regenerate selesai: {result["updated"]} dari {result["total"]} record diperbarui',
            'total': result['total'],
            'updated': result['updated'],
            'errors': result['errors']
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@keyword_manager_bp.route('/api/test-keyword', methods=['POST'])
def api_test_keyword():
    """Test keyword detection for a given text"""
    data = request.get_json()
    text_input = data.get('text', '')
    is_first = data.get('is_first_entry', False)
    
    if not text_input:
        return jsonify({'error': 'Text tidak boleh kosong'}), 400
    
    category = detect_from_db(text_input, is_first_entry=is_first)
    
    # Find which keyword matched
    text_lower = text_input.lower()
    matched_keyword = None
    all_kws = get_all_keywords()
    
    for kw in all_kws:
        if kw['keyword'].lower() in text_lower:
            matched_keyword = kw['keyword']
            break
    
    # Special cases
    if 'setting mc' in text_lower or 'setting mesin' in text_lower:
        matched_keyword = 'setting mc/mesin (special case)'
    if category == 'mesin' and 'keluar jalur' in text_lower and not matched_keyword:
        matched_keyword = 'keluar jalur (generic fallback)'
    
    return jsonify({
        'text': text_input,
        'category': category,
        'matched_keyword': matched_keyword,
        'is_first_entry': is_first
    }), 200


@keyword_manager_bp.route('/api/stats', methods=['GET'])
def api_stats():
    """Get keyword statistics"""
    stats = get_stats()
    return jsonify(stats), 200


@keyword_manager_bp.route('/api/keywords/bulk', methods=['POST'])
def api_bulk_create():
    """Bulk create keywords - add multiple keywords at once"""
    data = request.get_json()
    keywords_input = data.get('keywords', [])
    category = data.get('category', '')
    notes = data.get('notes', '')

    if not keywords_input or not category:
        return jsonify({'error': 'Keywords dan kategori harus diisi'}), 400

    # Accept both array and legacy text format
    if isinstance(keywords_input, str):
        kw_list = [k.strip().lower() for k in re.split(r'[,\n]', keywords_input) if k.strip()]
    else:
        kw_list = [k.strip().lower() for k in keywords_input if k.strip()]

    if not kw_list:
        return jsonify({'error': 'Tidak ada keyword yang valid'}), 400

    ensure_table_exists()

    added = []
    duplicates = []

    for kw in kw_list:
        existing = db.session.execute(text(
            'SELECT id, category FROM downtime_keywords WHERE keyword = :kw COLLATE NOCASE'
        ), {'kw': kw}).fetchone()

        if existing:
            duplicates.append({'keyword': kw, 'existing_category': existing[1]})
            continue

        db.session.execute(text(
            'INSERT INTO downtime_keywords (keyword, category, priority, notes) '
            'VALUES (:kw, :cat, 0, :notes)'
        ), {'kw': kw, 'cat': category, 'notes': notes or 'Manual input'})
        added.append(kw)

    db.session.commit()

    msg_parts = []
    if added:
        msg_parts.append(f'{len(added)} keyword berhasil ditambahkan')
    if duplicates:
        msg_parts.append(f'{len(duplicates)} sudah ada (dilewati)')

    return jsonify({
        'message': ', '.join(msg_parts) if msg_parts else 'Tidak ada perubahan',
        'added': added,
        'added_count': len(added),
        'duplicates': duplicates,
        'duplicate_count': len(duplicates),
        'success': True
    }), 200


# ============================================================
# KEYWORD USAGE ANALYTICS
# ============================================================

@keyword_manager_bp.route('/api/keyword-usage', methods=['GET'])
def api_keyword_usage():
    """
    Parse ShiftProduction.issues untuk menghitung penggunaan keyword
    per kategori, mesin, dan tanggal.

    Query params:
      - date_from : YYYY-MM-DD (opsional)
      - date_to   : YYYY-MM-DD (opsional)
      - machine   : machine_id (opsional)
      - category  : filter kategori (opsional)
      - limit     : max rows (default 200)
    """
    date_from = request.args.get('date_from', '')
    date_to   = request.args.get('date_to', '')
    machine   = request.args.get('machine', '')
    category  = request.args.get('category', '')
    limit     = int(request.args.get('limit', 500))

    try:
        from models.production import ShiftProduction, Machine

        # Build query with filters
        query = db.session.query(
            ShiftProduction.id,
            ShiftProduction.production_date,
            ShiftProduction.machine_id,
            ShiftProduction.shift,
            ShiftProduction.issues,
        ).filter(ShiftProduction.issues.isnot(None),
                 ShiftProduction.issues != '')

        if date_from:
            query = query.filter(ShiftProduction.production_date >= date_from)
        if date_to:
            query = query.filter(ShiftProduction.production_date <= date_to)
        if machine:
            query = query.filter(ShiftProduction.machine_id == int(machine))

        records = query.order_by(ShiftProduction.production_date.desc()).all()

        # Load all keywords from DB for matching
        ensure_table_exists()
        kw_rows = db.session.execute(text(
            'SELECT keyword, category FROM downtime_keywords ORDER BY priority DESC, LENGTH(keyword) DESC'
        )).fetchall()
        # Build list of (keyword_lower, category) sorted longest first (greedy match)
        kw_list = [(r[0].lower(), r[1]) for r in kw_rows]

        def match_keyword(reason_text):
            """Return (matched_keyword, category) or (None, 'others')"""
            t = reason_text.lower().strip()
            for kw, cat in kw_list:
                if kw in t:
                    return kw, cat
            return None, 'others'

        # Parse issues and aggregate
        ISSUE_RE = re.compile(r'(\d+)\s*menit\s*-\s*(.+)', re.IGNORECASE)
        CAT_TAG_RE = re.compile(r'\s*\[\w+\]\s*$')

        # { (keyword_or_reason, category, machine_id, date_str) : {count, duration, machines, dates} }
        usage = {}

        # Load machine names
        machines_map = {}
        try:
            machines = db.session.query(Machine.id, Machine.name, Machine.code).all()
            machines_map = {m.id: f"{m.code or ''} {m.name}".strip() for m in machines}
        except Exception:
            pass

        for rec in records:
            if not rec.issues:
                continue
            date_str = str(rec.production_date)[:10] if rec.production_date else ''
            machine_id = rec.machine_id
            machine_name = machines_map.get(machine_id, f'Mesin {machine_id}')

            parts = rec.issues.split(';')
            for part in parts:
                part = part.strip()
                if not part:
                    continue
                m = ISSUE_RE.match(part)
                if not m:
                    continue
                duration_val = int(m.group(1))
                reason_with_tag = m.group(2).strip()
                reason = CAT_TAG_RE.sub('', reason_with_tag).strip()

                matched_kw, matched_cat = match_keyword(reason)
                display_key = matched_kw if matched_kw else reason[:60]

                # Filter by category if requested
                if category and matched_cat != category:
                    continue

                key = (display_key, matched_cat, machine_id)
                if key not in usage:
                    usage[key] = {
                        'keyword'      : display_key,
                        'matched'      : matched_kw is not None,
                        'category'     : matched_cat,
                        'machine_id'   : machine_id,
                        'machine_name' : machine_name,
                        'count'        : 0,
                        'total_duration': 0,
                        'dates'        : set(),
                        'sample_reasons': [],
                    }
                usage[key]['count'] += 1
                usage[key]['total_duration'] += duration_val
                usage[key]['dates'].add(date_str)
                if reason not in usage[key]['sample_reasons'] and len(usage[key]['sample_reasons']) < 3:
                    usage[key]['sample_reasons'].append(reason)

        # Convert to list and sort by count desc
        rows = []
        for entry in usage.values():
            rows.append({
                'keyword'        : entry['keyword'],
                'matched'        : entry['matched'],
                'category'       : entry['category'],
                'machine_id'     : entry['machine_id'],
                'machine_name'   : entry['machine_name'],
                'count'          : entry['count'],
                'total_duration' : entry['total_duration'],
                'date_count'     : len(entry['dates']),
                'first_date'     : min(entry['dates']) if entry['dates'] else '',
                'last_date'      : max(entry['dates']) if entry['dates'] else '',
                'sample_reasons' : entry['sample_reasons'],
            })

        rows.sort(key=lambda x: x['count'], reverse=True)

        # Get machine list for filter dropdown
        machine_list = [{'id': k, 'name': v} for k, v in sorted(machines_map.items(), key=lambda x: x[1])]

        return jsonify({
            'rows'         : rows[:limit],
            'total_rows'   : len(rows),
            'total_records': len(records),
            'machines'     : machine_list,
            'filters'      : {
                'date_from': date_from,
                'date_to'  : date_to,
                'machine'  : machine,
                'category' : category,
            }
        }), 200

    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500
