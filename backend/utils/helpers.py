"""
Utility helper functions
"""
import random
import re
import string
from datetime import datetime


def generate_number(prefix, model=None, field_name='number', style='compact'):
    """Generate sequential number for entities.
    style='compact': PREFIX-YYYYMM-00001 (bawaan). style='dashed': PREFIX-YYYY-MM-0001 (PI-2026-11-001); style='slash': PREFIX-YY/MM/0001 (BPB-26/11/001)."""
    if model is None:
        # Fallback to old behavior for backward compatibility
        length = field_name if isinstance(field_name, int) else 6
        number_part = ''.join(random.choices(string.digits, k=length))
        timestamp = datetime.now().strftime("%y%m%d")
        
        if prefix:
            return f"{prefix}{timestamp}{number_part}"
        else:
            return f"{timestamp}{number_part}"
    
    # New behavior for database models
    from models import db
    from models.finance import NumberSequenceCounter
    from sqlalchemy.exc import IntegrityError
    year = datetime.now().strftime('%Y')
    month = datetime.now().strftime('%m')
    period = f"{year}{month}"

    # Concurrency-safe counter (2026-10-16): a plain SELECT-max-then-INSERT
    # here used to race under concurrent requests (two staff creating e.g.
    # 2 shipping orders in the same second could compute the same "next"
    # number). SELECT ... FOR UPDATE on a dedicated counter row serializes
    # concurrent callers for the same prefix+period instead. The counter
    # row itself is created lazily; a nested transaction (SAVEPOINT) around
    # that first-insert handles the remaining race of two callers BOTH
    # trying to create the counter row for the first time simultaneously -
    # without a savepoint, the IntegrityError from that race would poison
    # the caller's entire outer transaction (whatever PO/WO/etc it was
    # about to also insert), not just this counter lookup.
    counter = NumberSequenceCounter.query.filter_by(prefix=prefix, period=period).with_for_update().first()
    if not counter:
        nested = db.session.begin_nested()
        try:
            counter = NumberSequenceCounter(prefix=prefix, period=period, last_seq=0)
            db.session.add(counter)
            db.session.flush()
            nested.commit()
        except IntegrityError:
            nested.rollback()
            counter = NumberSequenceCounter.query.filter_by(prefix=prefix, period=period).with_for_update().first()

    # Seed from any pre-existing rows the first time this (prefix, period)
    # counter is created, so numbering continues from real data (e.g. rows
    # inserted before this fix shipped, or ones seeded outside this
    # function) instead of restarting at 1 and colliding with the unique
    # constraint on the very first insert.
    if counter.last_seq == 0:
        field = getattr(model, field_name)
        like_pattern = (f"{prefix}/{year[2:]}/{month}/%" if style == 'slashed' else
                        f"{prefix}-{year[2:]}/{month}/%" if style == 'slash' else
                        f"{prefix}-{year}-{month}-%" if style == 'dashed' else f"{prefix}-{period}-%")
        existing_numbers = db.session.query(field).filter(field.like(like_pattern)).all()
        for (value,) in existing_numbers:
            try:
                seq = int(re.split(r'[-/]', value)[-1])
                if seq > counter.last_seq:
                    counter.last_seq = seq
            except (ValueError, AttributeError):
                continue

    counter.last_seq += 1
    new_seq = counter.last_seq
    db.session.flush()

    if style == 'slashed':
        return f"{prefix}/{year[2:]}/{month}/{new_seq:03d}"
    if style == 'slash':
        return f"{prefix}-{year[2:]}/{month}/{new_seq:03d}"
    if style == 'dashed':
        return f"{prefix}-{year}-{month}-{new_seq:03d}"
    return f"{prefix}-{period}-{new_seq:05d}"


def peek_number(prefix, model, field_name, style='compact'):
    """Next number generate_number() WOULD return, without consuming it
    (for form previews; the real number is only assigned on save)."""
    from models import db
    from models.finance import NumberSequenceCounter
    period = datetime.now().strftime('%Y%m')
    counter = NumberSequenceCounter.query.filter_by(prefix=prefix, period=period).first()
    last = counter.last_seq if counter else 0
    if last == 0:
        field = getattr(model, field_name)
        pat = (f"{prefix}/{period[2:4]}/{period[4:]}/%" if style == 'slashed' else
               f"{prefix}-{period[2:4]}/{period[4:]}/%" if style == 'slash' else
               f"{prefix}-{period[:4]}-{period[4:]}-%" if style == 'dashed' else f"{prefix}-{period}-%")
        for (value,) in db.session.query(field).filter(field.like(pat)).all():
            try:
                last = max(last, int(re.split(r'[-/]', value)[-1]))
            except (ValueError, AttributeError):
                continue
    if style == 'slashed':
        return f"{prefix}/{period[2:4]}/{period[4:]}/{last + 1:03d}"
    if style == 'slash':
        return f"{prefix}-{period[2:4]}/{period[4:]}/{last + 1:03d}"
    if style == 'dashed':
        return f"{prefix}-{period[:4]}-{period[4:]}-{last + 1:03d}"
    return f"{prefix}-{period}-{last + 1:05d}"


# ---------------------------------------------------------------------------
# Full number templates (2026-11-19)
#
# Finance writes purchase orders as 26-11-OLC-011: year, month, their own text,
# then a sequence that restarts every year. A prefix cannot express that, so a
# NumberSequence row may carry a whole template instead. Tokens: YYYY, YY, MM,
# DD, and a run of '#' for the sequence - the number of '#' is the MINIMUM
# padding, so the format survives the day the counter outgrows it (Finance
# asked for 3 digits in 2026 and 4 in 2027; 1000 simply prints as 1000).
# ---------------------------------------------------------------------------

_TOKEN_RE = re.compile(r'(YYYY|YY|MM|DD|#+)')


def _format_parts(fmt, now=None):
    now = now or datetime.now()
    values = {'YYYY': now.strftime('%Y'), 'YY': now.strftime('%y'),
              'MM': now.strftime('%m'), 'DD': now.strftime('%d')}
    return values


def render_number_format(fmt, seq, now=None):
    """Turn 'YY-MM-OLC-###' + 11 into '26-11-OLC-011'."""
    values = _format_parts(fmt, now)

    def sub(m):
        t = m.group(0)
        if t.startswith('#'):
            return str(seq).zfill(len(t))
        return values[t]

    return _TOKEN_RE.sub(sub, fmt)


def format_like_pattern(fmt, reset_period, now=None):
    """SQL LIKE pattern for numbers that share one counter.

    For a yearly counter the month varies inside the same sequence, so MM/DD
    become wildcards; for a monthly counter only the day does. Used to seed the
    counter from numbers that already exist (Finance typed theirs by hand
    before this), so the next one continues instead of colliding at 001.
    """
    values = _format_parts(fmt, now)
    wild = {'DD'}
    if reset_period == 'year':
        wild |= {'MM'}
    elif reset_period == 'never':
        wild |= {'MM', 'YY', 'YYYY'}

    def sub(m):
        t = m.group(0)
        if t.startswith('#'):
            return '%'
        return '%' if t in wild else values[t]

    return _TOKEN_RE.sub(sub, fmt)


def _counter_period(reset_period, now=None):
    now = now or datetime.now()
    if reset_period == 'year':
        return now.strftime('%Y')
    if reset_period == 'never':
        return 'ALL'
    return now.strftime('%Y%m')


def _format_counter_key(sequence_key):
    # Kept apart from the plain-prefix counters so switching a document to a
    # template never reuses (or disturbs) the old PO-YYYYMM counter.
    return f'fmt:{sequence_key}'[:50]


def _seq_from_number(value, fmt):
    """Read the sequence back out of an existing number."""
    m = re.search(r'(\d+)\s*$', str(value or ''))
    return int(m.group(1)) if m else 0


def generate_from_format(sequence_key, fmt, reset_period, model, field_name, now=None):
    """Next number for a template-based sequence, row-locked like the rest."""
    from models import db
    from models.finance import NumberSequenceCounter
    from sqlalchemy.exc import IntegrityError

    period = _counter_period(reset_period, now)
    key = _format_counter_key(sequence_key)
    counter = NumberSequenceCounter.query.filter_by(prefix=key, period=period).with_for_update().first()
    if not counter:
        nested = db.session.begin_nested()
        try:
            counter = NumberSequenceCounter(prefix=key, period=period, last_seq=0)
            db.session.add(counter)
            db.session.flush()
            nested.commit()
        except IntegrityError:
            nested.rollback()
            counter = NumberSequenceCounter.query.filter_by(prefix=key, period=period).with_for_update().first()

    if counter.last_seq == 0 and model is not None:
        field = getattr(model, field_name)
        pattern = format_like_pattern(fmt, reset_period, now)
        for (value,) in db.session.query(field).filter(field.like(pattern)).all():
            counter.last_seq = max(counter.last_seq, _seq_from_number(value, fmt))

    counter.last_seq += 1
    db.session.flush()
    return render_number_format(fmt, counter.last_seq, now)


def peek_from_format(sequence_key, fmt, reset_period, model, field_name, now=None):
    """What generate_from_format() would return, without consuming it."""
    from models import db
    from models.finance import NumberSequenceCounter

    period = _counter_period(reset_period, now)
    counter = NumberSequenceCounter.query.filter_by(prefix=_format_counter_key(sequence_key), period=period).first()
    last = counter.last_seq if counter else 0
    if last == 0 and model is not None:
        field = getattr(model, field_name)
        pattern = format_like_pattern(fmt, reset_period, now)
        for (value,) in db.session.query(field).filter(field.like(pattern)).all():
            last = max(last, _seq_from_number(value, fmt))
    return render_number_format(fmt, last + 1, now)


def generate_number_v2(sequence_key, default_prefix, model=None, field_name='number', style='compact'):
    """
    Same numbering scheme as generate_number() ({prefix}-{year}{month}-{seq}),
    but the prefix can be overridden via the NumberSequence table (editable
    from Settings) instead of being hardcoded at every call site.

    Per Bayu's 2026-08-16 decision, this is purely ADDITIVE: it does not
    replace generate_number(), which dozens of existing call sites already
    use with hardcoded prefixes and continue to work unchanged. Only NEW
    call sites should use generate_number_v2() going forward.

    Args:
        sequence_key (str): lookup key in NumberSequence, e.g. 'invoice'.
        default_prefix (str): prefix to use if no NumberSequence row exists
            for this key yet (so this never hard-fails just because the
            config table is empty).
        model, field_name: same as generate_number() - the model/column to
            check for the last-used sequence number.

    Restored 2026-08-24: this function existed in an orphaned WIP checkpoint
    commit (328f657, never merged to main) but was missing from utils/helpers.py
    on main despite utils/__init__.py and 24 call sites across 9 route files
    already depending on it - masked until now by stale __pycache__. See
    git commit 328f657 for the original.
    """
    from models.finance import NumberSequence

    seq_config = NumberSequence.query.filter_by(sequence_key=sequence_key).first()
    fmt = (getattr(seq_config, 'number_format', None) or '').strip() if seq_config else ''
    if fmt and model is not None:
        return generate_from_format(sequence_key, fmt, getattr(seq_config, 'reset_period', 'month') or 'month',
                                    model, field_name)
    prefix = seq_config.prefix if seq_config else default_prefix

    return generate_number(prefix, model=model, field_name=field_name, style=style)


def peek_number_v2(sequence_key, default_prefix, model, field_name='number', style='compact'):
    """Preview of the next number for a sequence that may use a template."""
    from models.finance import NumberSequence

    seq_config = NumberSequence.query.filter_by(sequence_key=sequence_key).first()
    fmt = (getattr(seq_config, 'number_format', None) or '').strip() if seq_config else ''
    if fmt:
        return peek_from_format(sequence_key, fmt, getattr(seq_config, 'reset_period', 'month') or 'month',
                                model, field_name)
    return peek_number(seq_config.prefix if seq_config else default_prefix, model, field_name, style=style)


def generate_code(prefix: str = "", length: int = 8) -> str:
    """
    Generate a unique alphanumeric code
    
    Args:
        prefix: Optional prefix for the code
        length: Length of the random part
    
    Returns:
        Generated code string
    """
    # Generate random alphanumeric part
    random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))
    
    if prefix:
        return f"{prefix}{random_part}"
    else:
        return random_part


def format_currency(amount: float, currency: str = "IDR") -> str:
    """
    Format currency amount
    
    Args:
        amount: Amount to format
        currency: Currency code (default IDR)
    
    Returns:
        Formatted currency string
    """
    if currency == "IDR":
        return f"Rp {amount:,.0f}"
    else:
        return f"{currency} {amount:,.2f}"


def validate_email(email: str) -> bool:
    """
    Simple email validation
    """
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename by removing invalid characters
    """
    import re
    # Remove invalid characters
    sanitized = re.sub(r'[<>:"/\\|?*]', '_', filename)
    # Remove multiple underscores
    sanitized = re.sub(r'_+', '_', sanitized)
    return sanitized.strip('_')


def calculate_percentage(part: float, total: float) -> float:
    """
    Calculate percentage safely
    """
    if total == 0:
        return 0.0
    return round((part / total) * 100, 2)


def truncate_string(text: str, max_length: int = 50) -> str:
    """
    Truncate string with ellipsis if too long
    """
    if len(text) <= max_length:
        return text
    return text[:max_length-3] + "..."


def get_setting_value(key, default_value):
    """Retrieve system configuration value by key with a default fallback"""
    try:
        from models.settings import SystemSetting
        setting = SystemSetting.query.filter_by(setting_key=key).first()
        if setting:
            value = setting.setting_value
            if setting.data_type == 'boolean':
                return value.lower() in ['true', '1', 'yes']
            elif setting.data_type == 'integer':
                return int(value)
            elif setting.data_type == 'float':
                return float(value)
            return value
    except Exception as e:
        print(f"Error reading setting {key}: {e}")
    return default_value


def detect_downtime_category(issue_text: str, is_first_entry: bool = False) -> str:
    """
    Auto-detect downtime category from issue description keywords.
    Returns: 'mesin', 'operator', 'material', 'design', 'idle', 'istirahat', or 'others'
    
    AUTO-GENERATED by Keyword Manager GUI - DO NOT EDIT MANUALLY
    Last synced: 2026-10-07 13:27:10
    
    Args:
        issue_text: The downtime reason/issue description
        is_first_entry: Whether this is the first downtime entry (affects 'setting mc/mesin' categorization)
    """
    if not issue_text:
        return 'others'
    
    text_lower = issue_text.lower()
    
    # ISTIRAHAT - break/prayer time (check FIRST - highest priority)
    istirahat_keywords = [
        'break', 'istirahat', 'makan', 'minum', 'shalat', 'sholat', 'solat', 'toilet'
    ]
    for kw in istirahat_keywords:
        if kw in text_lower:
            return 'others'
    
    # IDLE TIME keywords - waiting for materials/resources (check early - high priority)
    idle_keywords = [
        'ambil kain', 'box belum datang', 'box habis', 'idle', 'ingredient habis', 
        'kain belum datang', 'kain habis', 'karton habis', 'keranjang habis', 'label habis', 
        'lem habis', 'menganggur', 'menghabiskan order', 'menhabiskan order', 'menunggu kain', 
        'menunggu mixing', 'menunggu obat', 'menunggu packaging', 'menunggu stiker', 
        'menunggu tinta', 'menyiapkan produk', 'mixing belum siap', 'no order', 'nunggu kain', 
        'nunggu mixing', 'nunggu obat', 'nunggu packaging', 'nunggu stiker', 'nunggu tinta', 
        'obat belum datang', 'obat habis', 'packaging belum datang', 'packaging habis', 
        'packing habis', 'persiapan produk', 'siapkan produk', 'standby', 'stiker belum datang', 
        'stiker habis', 'susun produk', 'tidak ada order', 'tinta habis', 'troli habis', 
        'trolley habis', 'tunggu approval', 'tunggu bahan', 'tunggu bahan kimia', 'tunggu box', 
        'tunggu glove', 'tunggu gloves', 'tunggu hasil qc', 'tunggu ingredient', 
        'tunggu instruksi', 'tunggu kain', 'tunggu karton', 'tunggu keranjang', 'tunggu label', 
        'tunggu lem', 'tunggu material', 'tunggu mixing', 'tunggu obat', 'tunggu order', 
        'tunggu packaging', 'tunggu produk', 'tunggu qc', 'tunggu sarung tangan', 'tunggu stiker', 
        'tunggu temperatur', 'tunggu temperatur stabil', 'tunggu temperature', 
        'tunggu temperature stabil', 'tunggu tinta', 'tunggu troli', 'tunggu trolley', 'waiting for'
    ]
    for kw in idle_keywords:
        if kw in text_lower:
            return 'idle'
    
    # DESIGN keywords - check BEFORE "setting mc" to catch changeover context
    design_keywords = [
        'changeover', 'cleaning', 'desain salah', 'design error', 'ganti', 'ganti karton', 
        'ganti label', 'ganti order', 'ganti packaging', 'ganti produk', 'ganti stiker', 
        'pasang kain', 'pasang packaging', 'pasang stiker', 'pattern salah', 'persiapan produksi', 
        'pola salah', 'prototype', 're packing', 're-pack', 'repack', 'repacking', 'revisi desain', 
        'revisi design', 'sample', 'sanitasi', 'setting dan tunggu temperatur', 
        'setting tunggu temperatur', 'spec salah', 'spesifikasi salah', 'testing design', 'trial', 
        'ukuran salah', 'warmup'
    ]
    for kw in design_keywords:
        if kw in text_lower:
            return 'design'
    
    # SPECIAL CASE: "setting mc/mesin" - depends on position
    if 'setting mc' in text_lower or 'setting mesin' in text_lower:
        return 'design' if is_first_entry else 'mesin'
    
    # OPERATOR keywords
    operator_keywords = [
        'human error', 'keluar jalur (sambungan)', 'kesalahan operator', 'kurang teliti', 'lupa', 
        'operator error', 'salah input', 'salah pasang', 'salah setting', 'salah ukur', 
        'sambungan', 'setting', 'telat', 'tidak fokus'
    ]
    for kw in operator_keywords:
        if kw in text_lower:
            return 'operator'
    
    # MATERIAL/RAW MATERIAL keywords
    material_keywords = [
        'bahan baku', 'bahan cacat', 'bahan habis', 'bahan kurang', 'bahan rusak', 'benang habis', 
        'benang putus', 'kain cacat', 'kain gembos', 'kain rusak', 'kain terlalu tipis', 
        'kain tidak sesuai', 'kain tipis', 'keluar jalur (kain gembos', 
        'keluar jalur (kain terlalu tipis', 'keluar jalur (kain tidak sesuai', 'kualitas kain', 
        'material cacat', 'material habis', 'material kurang', 'material rusak', 'raw material'
    ]
    for kw in material_keywords:
        if kw in text_lower:
            return 'material'
    
    # MESIN keywords - comprehensive machine-related issues
    mesin_keywords = [
        'angin bocor', 'angin drop', 'angin habis', 'bak mesin', 'baut stacking lepas', 'bearing', 
        'belt putus', 'breakdown', 'calibration', 'cartridge inkjet', 'compressor', 'conveyor', 
        'dosing', 'dossing', 'end seal', 'endseal', 'exhaust error', 'feeding', 'folding', 
        'ganti sparepart', 'guset', 'head inkjet', 'hidrolik', 'hydraulic', 'ink jet', 'ink-jet', 
        'inkjet', 'inkjet error', 'inkjet macet', 'jarum bengkok', 'jarum patah', 
        'kain keluar jalur', 'kain menggulung', 'kalibrasi', 'ke seal', 'keluar jalur', 
        'keluar jalur (bak mesin', 'keseal', 'lebar kain', 'lebar kain tidak maksimal', 'lipatan', 
        'listrik mati', 'maintenance', 'mc press', 'menggulung', 'mesin error', 'mesin macet', 
        'mesin mati', 'mesin rusak', 'mesin trouble', 'motor rusak', 'needle', 'overheat', 
        'overheating', 'penjepit', 'perbaikan', 'pisau', 'pneumatic', 'posisi stiker', 'pound', 
        'power failure', 'printer inkjet', 'produk bocor', 'pusher', 'relay', 'seal bawah', 
        'seal bocor', 'seal melipat', 'seal rapuh', 'seal samping', 'selang', 'sensor', 
        'setting inkjet', 'simetris', 'simetris error', 'sparepart', 'stacker', 'stacking', 
        'stiker putus', 'suhu', 'tekanan angin', 'temperature', 'tension', 'terseal', 
        'tidak maksimal', 'tidak rapi', 'tidak stabil', 'tinta inkjet', 'tumpukan', 'vanbelt'
    ]
    for kw in mesin_keywords:
        if kw in text_lower:
            return 'mesin'
    
    # Generic "keluar jalur" without specific cause -> mesin
    if 'keluar jalur' in text_lower:
        return 'mesin'
    
    return 'others'

