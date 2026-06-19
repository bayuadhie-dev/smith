"""
SPC (Statistical Process Control) Routes
Endpoint untuk sampling, measurement, kalkulasi UCL/LCL, dan Western Electric Rules
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.spc import SPCParameter, SPCProductSpec, SPCSample, SPCMeasurement, SPCControlLimitHistory
from models.product import Product
from models.production import WorkOrder, Machine
from utils.timezone import get_local_now, get_local_today
from datetime import datetime, date
from sqlalchemy import desc
import json
import math

spc_bp = Blueprint('spc', __name__)

# ─────────────────────────────────────────────
# KONSTANTA SPC (ASTM / ISO standard)
# ─────────────────────────────────────────────
# Faktor untuk X-bar R chart berdasarkan subgroup size (n)
SPC_FACTORS = {
    2:  {'A2': 1.880, 'd2': 1.128, 'D3': 0.000, 'D4': 3.267},
    3:  {'A2': 1.023, 'd2': 1.693, 'D3': 0.000, 'D4': 2.574},
    4:  {'A2': 0.729, 'd2': 2.059, 'D3': 0.000, 'D4': 2.282},
    5:  {'A2': 0.577, 'd2': 2.326, 'D3': 0.000, 'D4': 2.114},
    6:  {'A2': 0.483, 'd2': 2.534, 'D3': 0.000, 'D4': 2.004},
    7:  {'A2': 0.419, 'd2': 2.704, 'D3': 0.076, 'D4': 1.924},
    8:  {'A2': 0.373, 'd2': 2.847, 'D3': 0.136, 'D4': 1.864},
    9:  {'A2': 0.337, 'd2': 2.970, 'D3': 0.184, 'D4': 1.816},
    10: {'A2': 0.308, 'd2': 3.078, 'D3': 0.223, 'D4': 1.777},
}


# ─────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────
def calculate_stats(readings: list) -> dict:
    """Hitung xbar, range, std dev dari subgroup readings"""
    if not readings:
        return {'xbar': None, 'r_value': None, 's_value': None}
    n = len(readings)
    xbar = sum(readings) / n
    r_value = max(readings) - min(readings)
    variance = sum((x - xbar) ** 2 for x in readings) / (n - 1) if n > 1 else 0
    s_value = math.sqrt(variance)
    return {
        'xbar': round(xbar, 4),
        'r_value': round(r_value, 4),
        's_value': round(s_value, 4)
    }


def check_western_electric_rules(xbar_values: list, ucl: float, lcl: float, center: float) -> list:
    """
    Western Electric Rules untuk deteksi out-of-control.
    Returns list of violated rules.
    """
    violations = []
    n = len(xbar_values)
    sigma = (ucl - center) / 3 if ucl and center else 0

    if sigma == 0:
        return violations

    for i, val in enumerate(xbar_values):
        rules_violated = []

        # Rule 1: 1 point beyond 3-sigma
        if val > ucl or val < lcl:
            rules_violated.append('Rule 1: Beyond 3σ control limits')

        # Rule 2: 2 of 3 consecutive points beyond 2-sigma
        if i >= 2:
            zone_a = [abs(xbar_values[j] - center) > 2 * sigma for j in range(i - 2, i + 1)]
            same_side = [
                (xbar_values[j] - center) > 2 * sigma for j in range(i - 2, i + 1)
            ]
            if sum(zone_a) >= 2 and (sum(same_side) >= 2 or sum(not x for x in same_side) >= 2):
                rules_violated.append('Rule 2: 2 of 3 beyond 2σ')

        # Rule 3: 4 of 5 consecutive points beyond 1-sigma
        if i >= 4:
            zone_b = [abs(xbar_values[j] - center) > sigma for j in range(i - 4, i + 1)]
            if sum(zone_b) >= 4:
                rules_violated.append('Rule 3: 4 of 5 beyond 1σ')

        # Rule 4: 8 consecutive points on same side of center line
        if i >= 7:
            same_side_8 = [(xbar_values[j] > center) for j in range(i - 7, i + 1)]
            if all(same_side_8) or not any(same_side_8):
                rules_violated.append('Rule 4: 8 consecutive same side')

        violations.append(rules_violated)

    return violations


def calculate_capability(xbar_values: list, usl: float, lsl: float, n: int) -> dict:
    """Hitung Cp, Cpk dari data historis"""
    if not xbar_values or not usl or not lsl:
        return {'cp': None, 'cpk': None}

    mean = sum(xbar_values) / len(xbar_values)
    variance = sum((x - mean) ** 2 for x in xbar_values) / (len(xbar_values) - 1) if len(xbar_values) > 1 else 0
    sigma = math.sqrt(variance)

    if sigma == 0:
        return {'cp': None, 'cpk': None}

    cp = (usl - lsl) / (6 * sigma)
    cpu = (usl - mean) / (3 * sigma)
    cpl = (mean - lsl) / (3 * sigma)
    cpk = min(cpu, cpl)

    return {
        'cp': round(cp, 4),
        'cpk': round(cpk, 4),
        'cpu': round(cpu, 4),
        'cpl': round(cpl, 4),
        'mean': round(mean, 4),
        'sigma': round(sigma, 4)
    }



def auto_create_specs_from_product(product_id: int):
    """
    Auto-create spc_product_specs dari data produk (gramasi, cd, md)
    kalau belum ada. Toleransi ±10% dari target untuk USL/LSL.
    """
    from models.product import Product
    product = Product.query.get(product_id)
    if not product:
        return

    # Mapping: (parameter_id, field_name, toleransi_pct)
    mappings = [
        (1, 'gramasi', 0.10),   # GSM ±10%
        (2, 'cd', 0.15),        # CD ±15%
        (3, 'md', 0.15),        # MD ±15%
    ]

    for param_id, field, tol in mappings:
        # Skip kalau spec sudah ada
        existing = SPCProductSpec.query.filter_by(
            product_id=product_id,
            parameter_id=param_id
        ).first()
        if existing:
            continue

        target = getattr(product, field, None)
        if not target:
            continue

        target = float(target)
        usl = round(target * (1 + tol), 4)
        lsl = round(target * (1 - tol), 4)

        spec = SPCProductSpec(
            product_id=product_id,
            parameter_id=param_id,
            target_value=target,
            usl=usl,
            lsl=lsl,
            subgroup_size=5,
            auto_calculate=True,
            min_subgroups=25,
            is_active=True
        )
        db.session.add(spec)

def auto_calculate_control_limits(product_id: int, parameter_id: int) -> dict:
    """
    Hitung UCL/LCL otomatis dari data historis.
    Minimal 25 subgroup diperlukan.
    """
    spec = SPCProductSpec.query.filter_by(
        product_id=product_id,
        parameter_id=parameter_id,
        is_active=True
    ).first()

    if not spec or not spec.auto_calculate:
        return {}

    # Ambil semua measurements untuk produk + parameter ini
    measurements = db.session.query(SPCMeasurement).join(SPCSample).filter(
        SPCSample.product_id == product_id,
        SPCMeasurement.parameter_id == parameter_id
    ).order_by(SPCSample.sample_time).all()

    if len(measurements) < spec.min_subgroups:
        return {'status': 'insufficient_data', 'count': len(measurements), 'required': spec.min_subgroups}

    xbar_values = [float(m.xbar) for m in measurements if m.xbar is not None]
    r_values = [float(m.r_value) for m in measurements if m.r_value is not None]

    if not xbar_values or not r_values:
        return {}

    n = spec.subgroup_size
    factors = SPC_FACTORS.get(n, SPC_FACTORS[5])

    xbar_bar = sum(xbar_values) / len(xbar_values)
    r_bar = sum(r_values) / len(r_values)

    ucl = xbar_bar + factors['A2'] * r_bar
    lcl = xbar_bar - factors['A2'] * r_bar
    ucl_r = factors['D4'] * r_bar
    lcl_r = factors['D3'] * r_bar

    # Update spec
    spec.ucl = round(ucl, 4)
    spec.lcl = round(lcl, 4)
    spec.ucl_r = round(ucl_r, 4)
    spec.lcl_r = round(lcl_r, 4)

    # Capability
    capability = calculate_capability(
        xbar_values,
        float(spec.usl) if spec.usl else None,
        float(spec.lsl) if spec.lsl else None,
        n
    )

    # Simpan ke history
    history = SPCControlLimitHistory(
        product_id=product_id,
        parameter_id=parameter_id,
        ucl=round(ucl, 4),
        lcl=round(lcl, 4),
        ucl_r=round(ucl_r, 4),
        lcl_r=round(lcl_r, 4),
        xbar_bar=round(xbar_bar, 4),
        r_bar=round(r_bar, 4),
        cp=capability.get('cp'),
        cpk=capability.get('cpk'),
        subgroups_used=len(xbar_values),
        effective_from=get_local_now()
    )
    db.session.add(history)

    return {
        'status': 'calculated',
        'ucl': round(ucl, 4),
        'lcl': round(lcl, 4),
        'ucl_r': round(ucl_r, 4),
        'lcl_r': round(lcl_r, 4),
        'xbar_bar': round(xbar_bar, 4),
        'r_bar': round(r_bar, 4),
        **capability
    }


# ─────────────────────────────────────────────
# ROUTES: PARAMETERS
# ─────────────────────────────────────────────
@spc_bp.route('/parameters', methods=['GET'])
@jwt_required()
def get_parameters():
    """Get semua SPC parameters"""
    try:
        params = SPCParameter.query.filter_by(is_active=True).all()
        return jsonify({
            'parameters': [{
                'id': p.id,
                'code': p.code,
                'name': p.name,
                'uom': p.uom,
                'parameter_type': p.parameter_type,
                'description': p.description
            } for p in params]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────
# ROUTES: PRODUCT SPECS
# ─────────────────────────────────────────────
@spc_bp.route('/specs', methods=['GET'])
@jwt_required()
def get_specs():
    """Get specs per produk"""
    try:
        product_id = request.args.get('product_id', type=int)
        query = SPCProductSpec.query.filter_by(is_active=True)
        if product_id:
            query = query.filter_by(product_id=product_id)
        specs = query.all()
        return jsonify({
            'specs': [{
                'id': s.id,
                'product_id': s.product_id,
                'product_name': s.product.name if s.product else None,
                'parameter_id': s.parameter_id,
                'parameter_code': s.parameter.code if s.parameter else None,
                'parameter_name': s.parameter.name if s.parameter else None,
                'uom': s.parameter.uom if s.parameter else None,
                'target_value': float(s.target_value) if s.target_value else None,
                'usl': float(s.usl) if s.usl else None,
                'lsl': float(s.lsl) if s.lsl else None,
                'ucl': float(s.ucl) if s.ucl else None,
                'lcl': float(s.lcl) if s.lcl else None,
                'ucl_r': float(s.ucl_r) if s.ucl_r else None,
                'lcl_r': float(s.lcl_r) if s.lcl_r else None,
                'subgroup_size': s.subgroup_size,
                'auto_calculate': s.auto_calculate,
                'min_subgroups': s.min_subgroups
            } for s in specs]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@spc_bp.route('/specs', methods=['POST'])
@jwt_required()
def create_spec():
    """Buat spec baru untuk produk + parameter"""
    try:
        data = request.get_json()
        spec = SPCProductSpec(
            product_id=data['product_id'],
            parameter_id=data['parameter_id'],
            target_value=data.get('target_value'),
            usl=data.get('usl'),
            lsl=data.get('lsl'),
            ucl=data.get('ucl'),
            lcl=data.get('lcl'),
            subgroup_size=data.get('subgroup_size', 5),
            auto_calculate=data.get('auto_calculate', True),
            min_subgroups=data.get('min_subgroups', 25)
        )
        db.session.add(spec)
        db.session.commit()
        return jsonify({'message': 'Spec created', 'id': spec.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@spc_bp.route('/specs/<int:id>', methods=['PUT'])
@jwt_required()
def update_spec(id):
    """Update spec (manual override UCL/LCL)"""
    try:
        spec = SPCProductSpec.query.get_or_404(id)
        data = request.get_json()
        for field in ['target_value', 'usl', 'lsl', 'ucl', 'lcl', 'ucl_r', 'lcl_r',
                      'subgroup_size', 'auto_calculate', 'min_subgroups']:
            if field in data:
                setattr(spec, field, data[field])
        db.session.commit()
        return jsonify({'message': 'Spec updated'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────
# ROUTES: SAMPLES
# ─────────────────────────────────────────────
@spc_bp.route('/samples', methods=['GET'])
@jwt_required()
def get_samples():
    """Get samples dengan filter"""
    try:
        product_id = request.args.get('product_id', type=int)
        machine_id = request.args.get('machine_id', type=int)
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        limit = request.args.get('limit', 50, type=int)

        query = SPCSample.query
        if product_id:
            query = query.filter_by(product_id=product_id)
        if machine_id:
            query = query.filter_by(machine_id=machine_id)
        if date_from:
            query = query.filter(SPCSample.sample_date >= date_from)
        if date_to:
            query = query.filter(SPCSample.sample_date <= date_to)

        samples = query.order_by(desc(SPCSample.sample_time)).limit(limit).all()

        return jsonify({
            'samples': [{
                'id': s.id,
                'sample_number': s.sample_number,
                'product_id': s.product_id,
                'product_name': s.product.name if s.product else None,
                'work_order_id': s.work_order_id,
                'machine_id': s.machine_id,
                'machine_name': s.machine.name if s.machine else None,
                'shift': s.shift,
                'sub_shift': s.sub_shift,
                'sample_date': s.sample_date.isoformat(),
                'sample_time': s.sample_time.isoformat(),
                'subgroup_size': s.subgroup_size,
                'notes': s.notes,
                'measurement_count': len(s.measurements),
                'has_violations': any(m.is_out_of_control for m in s.measurements)
            } for s in samples]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@spc_bp.route('/samples', methods=['POST'])
@jwt_required()
def create_sample():
    """
    Input sample baru + measurements sekaligus.
    Body: { product_id, work_order_id, machine_id, shift, sub_shift, sample_date,
            subgroup_size, notes, measurements: [{parameter_id, readings: []}] }
    """
    try:
        data = request.get_json()
        user_id = int(get_jwt_identity())

        # Generate sample number
        today = get_local_today()
        count = SPCSample.query.filter(
            SPCSample.sample_date == today
        ).count()
        sample_number = f"SPC-{today.strftime('%Y%m%d')}-{count + 1:04d}"

        sample = SPCSample(
            sample_number=sample_number,
            product_id=data['product_id'],
            work_order_id=data.get('work_order_id'),
            machine_id=data.get('machine_id'),
            shift=data.get('shift'),
            sub_shift=data.get('sub_shift'),
            sample_date=date.fromisoformat(data['sample_date']) if isinstance(data['sample_date'], str) else data['sample_date'],
            sample_time=get_local_now(),
            subgroup_size=data.get('subgroup_size', 5),
            notes=data.get('notes'),
            sampled_by=user_id
        )
        db.session.add(sample)
        db.session.flush()

        # Auto-create specs dari data produk kalau belum ada
        auto_create_specs_from_product(data['product_id'])
        db.session.flush()

        violations_found = []

        for mdata in data.get('measurements', []):
            readings = mdata['readings']
            stats = calculate_stats(readings)

            measurement = SPCMeasurement(
                sample_id=sample.id,
                parameter_id=mdata['parameter_id'],
                readings=json.dumps(readings),
                xbar=stats['xbar'],
                r_value=stats['r_value'],
                s_value=stats['s_value'],
                notes=mdata.get('notes')
            )

            # Cek apakah out of control
            spec = SPCProductSpec.query.filter_by(
                product_id=data['product_id'],
                parameter_id=mdata['parameter_id'],
                is_active=True
            ).first()

            if spec and spec.ucl and spec.lcl and stats['xbar']:
                xbar = stats['xbar']
                is_ooc = xbar > float(spec.ucl) or xbar < float(spec.lcl)

                # Western Electric Rules — ambil 20 data terakhir
                recent = db.session.query(SPCMeasurement).join(SPCSample).filter(
                    SPCSample.product_id == data['product_id'],
                    SPCMeasurement.parameter_id == mdata['parameter_id']
                ).order_by(desc(SPCSample.sample_time)).limit(20).all()

                xbar_history = [float(m.xbar) for m in reversed(recent) if m.xbar] + [xbar]
                center = (float(spec.ucl) + float(spec.lcl)) / 2
                we_violations = check_western_electric_rules(
                    xbar_history, float(spec.ucl), float(spec.lcl), center
                )
                current_violations = we_violations[-1] if we_violations else []

                measurement.is_out_of_control = is_ooc or bool(current_violations)
                measurement.violation_rules = json.dumps(current_violations) if current_violations else None

                if measurement.is_out_of_control:
                    violations_found.append({
                        'parameter_id': mdata['parameter_id'],
                        'xbar': xbar,
                        'violations': current_violations
                    })

            db.session.add(measurement)

        db.session.commit()

        # Auto recalculate control limits kalau auto_calculate = True
        for mdata in data.get('measurements', []):
            result = auto_calculate_control_limits(data['product_id'], mdata['parameter_id'])
            if result.get('status') == 'calculated':
                db.session.commit()

        return jsonify({
            'message': 'Sample created',
            'sample_id': sample.id,
            'sample_number': sample_number,
            'violations': violations_found
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@spc_bp.route('/samples/<int:id>', methods=['GET'])
@jwt_required()
def get_sample_detail(id):
    """Detail sample beserta semua measurements"""
    try:
        sample = SPCSample.query.get_or_404(id)
        measurements = []

        for m in sample.measurements:
            spec = SPCProductSpec.query.filter_by(
                product_id=sample.product_id,
                parameter_id=m.parameter_id,
                is_active=True
            ).first()

            measurements.append({
                'id': m.id,
                'parameter_id': m.parameter_id,
                'parameter_code': m.parameter.code if m.parameter else None,
                'parameter_name': m.parameter.name if m.parameter else None,
                'uom': m.parameter.uom if m.parameter else None,
                'readings': json.loads(m.readings) if m.readings else [],
                'xbar': float(m.xbar) if m.xbar else None,
                'r_value': float(m.r_value) if m.r_value else None,
                's_value': float(m.s_value) if m.s_value else None,
                'is_out_of_control': m.is_out_of_control,
                'violation_rules': json.loads(m.violation_rules) if m.violation_rules else [],
                'ucl': float(spec.ucl) if spec and spec.ucl else None,
                'lcl': float(spec.lcl) if spec and spec.lcl else None,
                'usl': float(spec.usl) if spec and spec.usl else None,
                'lsl': float(spec.lsl) if spec and spec.lsl else None,
                'target': float(spec.target_value) if spec and spec.target_value else None,
            })

        return jsonify({
            'sample': {
                'id': sample.id,
                'sample_number': sample.sample_number,
                'product_id': sample.product_id,
                'product_name': sample.product.name if sample.product else None,
                'machine_name': sample.machine.name if sample.machine else None,
                'shift': sample.shift,
                'sub_shift': sample.sub_shift,
                'sample_date': sample.sample_date.isoformat(),
                'sample_time': sample.sample_time.isoformat(),
                'subgroup_size': sample.subgroup_size,
                'notes': sample.notes,
                'measurements': measurements
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────
# ROUTES: CONTROL CHART DATA
# ─────────────────────────────────────────────
@spc_bp.route('/chart-data', methods=['GET'])
@jwt_required()
def get_chart_data():
    """
    Data untuk X-bar R chart.
    Query: product_id, parameter_id, limit (default 30)
    """
    try:
        product_id = request.args.get('product_id', type=int)
        parameter_id = request.args.get('parameter_id', type=int)
        limit = request.args.get('limit', 30, type=int)

        if not product_id or not parameter_id:
            return jsonify({'error': 'product_id and parameter_id required'}), 400

        # Ambil measurements
        measurements = db.session.query(SPCMeasurement, SPCSample).join(
            SPCSample, SPCMeasurement.sample_id == SPCSample.id
        ).filter(
            SPCSample.product_id == product_id,
            SPCMeasurement.parameter_id == parameter_id
        ).order_by(SPCSample.sample_time).limit(limit).all()

        # Ambil spec untuk control limits
        spec = SPCProductSpec.query.filter_by(
            product_id=product_id,
            parameter_id=parameter_id,
            is_active=True
        ).first()

        chart_data = []
        for m, s in measurements:
            chart_data.append({
                'sample_number': s.sample_number,
                'sample_time': s.sample_time.isoformat(),
                'shift': s.shift,
                'xbar': float(m.xbar) if m.xbar else None,
                'r_value': float(m.r_value) if m.r_value else None,
                'is_out_of_control': m.is_out_of_control,
                'violations': json.loads(m.violation_rules) if m.violation_rules else []
            })

        # Hitung capability kalau ada spec lengkap
        capability = {}
        if spec and spec.usl and spec.lsl:
            xbar_values = [d['xbar'] for d in chart_data if d['xbar'] is not None]
            capability = calculate_capability(
                xbar_values,
                float(spec.usl),
                float(spec.lsl),
                spec.subgroup_size
            )

        return jsonify({
            'chart_data': chart_data,
            'control_limits': {
                'ucl': float(spec.ucl) if spec and spec.ucl else None,
                'lcl': float(spec.lcl) if spec and spec.lcl else None,
                'ucl_r': float(spec.ucl_r) if spec and spec.ucl_r else None,
                'lcl_r': float(spec.lcl_r) if spec and spec.lcl_r else None,
                'target': float(spec.target_value) if spec and spec.target_value else None,
                'usl': float(spec.usl) if spec and spec.usl else None,
                'lsl': float(spec.lsl) if spec and spec.lsl else None,
            },
            'capability': capability,
            'total_points': len(chart_data),
            'out_of_control_count': sum(1 for d in chart_data if d['is_out_of_control'])
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────
# ROUTES: DASHBOARD
# ─────────────────────────────────────────────
@spc_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard():
    """Dashboard overview SPC — semua produk semua parameter"""
    try:
        product_id = request.args.get('product_id', type=int)

        # Total samples hari ini
        today = get_local_today()
        today_samples = SPCSample.query.filter(
            SPCSample.sample_date == today
        )
        if product_id:
            today_samples = today_samples.filter_by(product_id=product_id)
        today_count = today_samples.count()

        # Out of control hari ini
        ooc_today = db.session.query(SPCMeasurement).join(SPCSample).filter(
            SPCSample.sample_date == today,
            SPCMeasurement.is_out_of_control == True
        )
        if product_id:
            ooc_today = ooc_today.filter(SPCSample.product_id == product_id)
        ooc_count = ooc_today.count()

        # Capability summary per produk per parameter
        specs = SPCProductSpec.query.filter_by(is_active=True)
        if product_id:
            specs = specs.filter_by(product_id=product_id)

        capability_summary = []
        for spec in specs.all():
            measurements = db.session.query(SPCMeasurement).join(SPCSample).filter(
                SPCSample.product_id == spec.product_id,
                SPCMeasurement.parameter_id == spec.parameter_id
            ).order_by(desc(SPCSample.sample_time)).limit(50).all()

            if not measurements:
                continue

            xbar_values = [float(m.xbar) for m in measurements if m.xbar]
            cap = calculate_capability(
                xbar_values,
                float(spec.usl) if spec.usl else None,
                float(spec.lsl) if spec.lsl else None,
                spec.subgroup_size
            )

            ooc_count_param = sum(1 for m in measurements if m.is_out_of_control)

            capability_summary.append({
                'product_id': spec.product_id,
                'product_name': spec.product.name if spec.product else None,
                'parameter_code': spec.parameter.code if spec.parameter else None,
                'parameter_name': spec.parameter.name if spec.parameter else None,
                'uom': spec.parameter.uom if spec.parameter else None,
                'cp': cap.get('cp'),
                'cpk': cap.get('cpk'),
                'sample_count': len(measurements),
                'ooc_count': ooc_count_param,
                'status': (
                    'capable' if cap.get('cpk') and cap['cpk'] >= 1.33
                    else 'marginal' if cap.get('cpk') and cap['cpk'] >= 1.0
                    else 'not_capable' if cap.get('cpk')
                    else 'insufficient_data'
                )
            })

        return jsonify({
            'today_samples': today_count,
            'today_ooc': ooc_count,
            'capability_summary': capability_summary
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─────────────────────────────────────────────
# ROUTES: RECALCULATE CONTROL LIMITS
# ─────────────────────────────────────────────
@spc_bp.route('/recalculate/<int:product_id>/<int:parameter_id>', methods=['POST'])
@jwt_required()
def recalculate_limits(product_id, parameter_id):
    """Trigger manual recalculation UCL/LCL"""
    try:
        result = auto_calculate_control_limits(product_id, parameter_id)
        db.session.commit()
        return jsonify(result), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
