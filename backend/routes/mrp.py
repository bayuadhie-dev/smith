from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.auth_decorators import require_permission
from models import db, Material, Product, BillOfMaterials, BOMItem, WorkOrder, SalesOrder, Inventory, Machine, PurchaseOrder
from utils.forecast_helper import forecast_rows_in_range, iter_forecast_month_rows
from sqlalchemy import func
from utils.i18n import success_response, error_response, get_message
from utils.helpers import get_setting_value
from datetime import datetime, timedelta
from math import isnan, isinf
import json
from utils.timezone import get_local_now, get_local_today

mrp_bp = Blueprint('mrp', __name__)

@mrp_bp.route('/materials', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_materials():
    """Get all materials for MRP planning"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        search = request.args.get('search', '')
        material_type = request.args.get('material_type')

        query = Material.query.filter_by(is_active=True)

        if search:
            query = query.filter(
                db.or_(
                    Material.code.ilike(f'%{search}%'),
                    Material.name.ilike(f'%{search}%')
                )
            )

        if material_type:
            query = query.filter_by(material_type=material_type)

        materials = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'materials': [{
                'id': m.id,
                'code': m.code,
                'name': m.name,
                'material_type': m.material_type,
                'category': m.category,
                'primary_uom': m.primary_uom,
                'cost_per_unit': float(m.cost_per_unit),
                'min_stock_level': float(m.min_stock_level),
                'current_stock': get_current_stock(m.id),
                'supplier_name': m.supplier.company_name if m.supplier else None
            } for m in materials.items],
            'total': materials.total,
            'pages': materials.pages,
            'current_page': materials.page
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@mrp_bp.route('/bom', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_boms():
    """Get all Bills of Materials"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        product_id = request.args.get('product_id', type=int)

        query = BillOfMaterials.query.filter_by(is_active=True)

        if product_id:
            query = query.filter_by(product_id=product_id)

        boms = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'boms': [{
                'id': bom.id,
                'bom_number': bom.bom_number,
                'product_name': bom.product.name,
                'version': bom.version,
                'batch_size': float(bom.batch_size),
                'batch_uom': bom.batch_uom,
                'effective_date': bom.effective_date.isoformat() if bom.effective_date else None,
                'item_count': len(bom.items)
            } for bom in boms.items],
            'total': boms.total,
            'pages': boms.pages,
            'current_page': boms.page
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@mrp_bp.route('/bom/<int:bom_id>', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_bom_details(bom_id):
    """Get BOM details with all items"""
    try:
        bom = db.session.get(BillOfMaterials, bom_id) or abort(404)

        return jsonify({
            'id': bom.id,
            'bom_number': bom.bom_number,
            'product': {
                'id': bom.product.id,
                'code': bom.product.code,
                'name': bom.product.name
            },
            'version': bom.version,
            'batch_size': float(bom.batch_size),
            'batch_uom': bom.batch_uom,
            'items': [{
                'id': item.id,
                'line_number': item.line_number,
                'material': {
                    'id': item.material.id,
                    'code': item.material.code,
                    'name': item.material.name,
                    'material_type': item.material.material_type
                } if item.material else {
                    'id': item.product.id,
                    'code': item.product.code,
                    'name': item.product.name,
                    'material_type': item.product.material_type
                },
                'quantity': float(item.quantity),
                'uom': item.uom,
                'scrap_percent': float(item.scrap_percent),
                'is_critical': item.is_critical,
                'notes': item.notes
            } for item in bom.items]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@mrp_bp.route('/requirements', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_material_requirements():
    """Calculate material requirements based on sales orders and forecasts"""
    try:
        # Get time horizon for MRP calculation
        default_horizon = int(get_setting_value('mrp.planning_horizon_days', 30))
        days_ahead = request.args.get('days_ahead', default_horizon, type=int)
        include_forecasts = request.args.get('include_forecasts', 'true').lower() == 'true'

        start_date = get_local_now().date()
        end_date = start_date + timedelta(days=days_ahead)

        requirements = {}

        # 1. PROCESS CONFIRMED SALES ORDERS
        sales_orders = SalesOrder.query.filter(
            SalesOrder.order_date.between(start_date, end_date),
            SalesOrder.status.in_(['confirmed', 'processing'])
        ).all()

        from utils.bom_explosion import explode_bom_requirements, CircularBOMError, MaxDepthExceededError

        def _mrp_scale_fn(bom_item, parent_qty, bom):
            # Matches this endpoint's original formula exactly (no batch_size/
            # pack_per_carton division here - that's specific to
            # check_and_create_po's cartons-based convention, not this one).
            return float(parent_qty) * float(bom_item.quantity) * (1 + float(bom_item.scrap_percent or 0) / 100)

        def _merge_exploded_into_requirements(product, quantity, quantity_field, source_entry):
            """Explode `product`'s BOM (multi-layer) and merge every raw
            material - plus any leaf sub-assembly with no BOM of its own,
            to preserve this endpoint's original behavior of surfacing
            product-referenced BOM lines too, not just true materials -
            into the shared `requirements` dict. `source_entry(qty)` builds
            the per-line 'sources' dict for either the confirmed-order or
            forecast branch."""
            bom = BillOfMaterials.query.filter_by(product_id=product.id, is_active=True).first()
            if not bom:
                return
            try:
                exploded = explode_bom_requirements(product.id, quantity, _mrp_scale_fn)
            except (CircularBOMError, MaxDepthExceededError):
                return  # dashboard aggregation - skip this product rather than fail the whole report

            lines = list(exploded['materials'])
            for sub in exploded['sub_assemblies']:
                if not sub['has_own_bom']:
                    lines.append({
                        'material_id': sub['product_id'],
                        'uom': None,
                        'material_name': sub['product_name'],
                        'required_quantity': sub['shortage_quantity'],
                    })

            for line in lines:
                key = line['material_id']
                if key is None or line['required_quantity'] <= 0:
                    continue
                # Safety Stock S2: material dengan is_excluded_from_mrp=True dikecualikan
                # total dari MRP - tidak pernah masuk requirements dashboard ini.
                # (key bisa juga product_id dari sub-assembly tanpa BOM sendiri, di
                # situ Material lookup ini natural None dan tidak difilter - sama
                # seperti ambiguitas code_lookup di bawah, bukan masalah baru.)
                excluded_material = db.session.get(Material, key)
                if excluded_material and excluded_material.is_excluded_from_mrp:
                    continue
                if key not in requirements:
                    from models.product import Material as _Material, Product as _Product
                    code_lookup = db.session.get(_Material, key) or db.session.get(_Product, key)
                    requirements[key] = {
                        'material_id': key,
                        'material_code': code_lookup.code if code_lookup else None,
                        'material_name': line['material_name'],
                        'total_quantity': 0,
                        'confirmed_quantity': 0,
                        'forecast_quantity': 0,
                        'uom': line['uom'],
                        'sources': []
                    }
                qty = line['required_quantity']
                requirements[key]['total_quantity'] += qty
                requirements[key][quantity_field] += qty
                requirements[key]['sources'].append(source_entry(qty))

        for order in sales_orders:
            for item in order.items:
                product = item.product
                _merge_exploded_into_requirements(
                    product, item.quantity, 'confirmed_quantity',
                    lambda qty, order=order, product=product: {
                        'type': 'sales_order',
                        'reference': order.order_number,
                        'product_name': product.name,
                        'quantity': qty,
                        'required_date': order.required_date.isoformat() if order.required_date else None,
                        'status': 'confirmed'
                    }
                )

        # 2. PROCESS SALES FORECASTS (if enabled)
        if include_forecasts:
            forecasts = forecast_rows_in_range(start_date, end_date)

            for forecast in forecasts:
                if forecast.product_id:
                    # Get BOM for forecasted product
                    bom = BillOfMaterials.query.filter_by(
                        product_id=forecast.product_id,
                        is_active=True
                    ).first()

                    if bom:
                        # Use most likely forecast value
                        forecast_quantity = float(forecast.most_likely or 0)
                        
                        # Calculate overlap with our planning period
                        overlap_days = min(end_date, forecast.period_end) - max(start_date, forecast.period_start)
                        total_forecast_days = (forecast.period_end - forecast.period_start).days
                        
                        if total_forecast_days > 0:
                            period_ratio = overlap_days.days / total_forecast_days
                            adjusted_quantity = forecast_quantity * period_ratio

                            _merge_exploded_into_requirements(
                                forecast.product, adjusted_quantity, 'forecast_quantity',
                                lambda qty, forecast=forecast: {
                                    'type': 'sales_forecast',
                                    'reference': forecast.forecast_number,
                                    'product_name': forecast.product.name if forecast.product else 'Unknown',
                                    'quantity': qty,
                                    'forecast_period': f"{forecast.period_start.isoformat()} to {forecast.period_end.isoformat()}",
                                    'confidence': forecast.confidence_level,
                                    'status': 'forecast'
                                }
                            )

        # 3. ADD CURRENT STOCK INFORMATION
        for material_id in requirements:
            current_stock = get_current_stock(material_id)
            requirements[material_id]['current_stock'] = current_stock
            requirements[material_id]['net_requirement'] = max(0, requirements[material_id]['total_quantity'] - current_stock)

        return jsonify({
            'requirements': list(requirements.values()),
            'calculation_period': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'days_ahead': days_ahead
            },
            'settings': {
                'include_forecasts': include_forecasts,
                'total_materials': len(requirements),
                'confirmed_orders': len(sales_orders),
                'forecasts_included': len(forecasts) if include_forecasts else 0
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@mrp_bp.route('/planning', methods=['POST'])
@jwt_required()
@require_permission('mrp.view')
def create_production_plan():
    """Create production plan based on MRP requirements"""
    try:
        data = request.get_json()
        requirements = data.get('requirements', [])

        production_plan = []

        for req in requirements:
            material_id = req['material_id']
            required_quantity = req['total_quantity']

            # Get current inventory
            current_stock = get_current_stock(material_id)

            if current_stock < required_quantity:
                # Calculate production needed
                shortage = required_quantity - current_stock

                # Find BOMs that use this material
                boms_using_material = BillOfMaterials.query.join(BOMItem).filter(
                    BillOfMaterials.is_active == True,
                    BOMItem.material_id == material_id
                ).all()

                for bom in boms_using_material:
                    # Calculate how many batches to produce
                    batches_needed = shortage / bom.batch_size

                    production_plan.append({
                        'product_id': bom.product_id,
                        'product_code': bom.product.code,
                        'product_name': bom.product.name,
                        'bom_id': bom.id,
                        'batches_to_produce': float(batches_needed),
                        'total_quantity': float(shortage),
                        'priority': 'high',
                        'reason': f'Shortage of {req["material_name"]} for sales orders'
                    })

        return jsonify({
            'production_plan': production_plan,
            'total_items': len(production_plan)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@mrp_bp.route('/forecasts', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_sales_forecasts():
    """Get sales forecasts for MRP planning.
    Adapted 2026-08-24 for the Sales Forecast Matrix (ForecastHeader/ForecastLine) -
    each row here is now 1 (product, month) cell instead of 1 SalesForecast row. The
    matrix has no per-forecast customer dimension any more (it's per-year, all customers),
    so customer_name/forecast_type are dropped from the response - nothing in the frontend
    reads them here (this endpoint duplicates /api/sales/forecasts, kept for whatever
    still calls this MRP-namespaced path)."""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        status = request.args.get('status')
        product_id = request.args.get('product_id', type=int)

        status_filter = (status,) if status else ('draft', 'approved')
        rows = list(iter_forecast_month_rows(status_filter=status_filter))
        if product_id:
            rows = [r for r in rows if r.product_id == product_id]
        rows.sort(key=lambda r: r.period_start, reverse=True)

        total = len(rows)
        start = (page - 1) * per_page
        page_rows = rows[start:start + per_page]

        return jsonify({
            'forecasts': [{
                'line_id': f.line_id,
                'header_id': f.header_id,
                'forecast_number': f.forecast_number,
                'name': f.name,
                'product_name': f.product.name if f.product else 'Unknown',
                'period_start': f.period_start.isoformat(),
                'period_end': f.period_end.isoformat(),
                'qty': f.qty,
                'status': f.status,
                'created_at': f.created_at.isoformat()
            } for f in page_rows],
            'total': total,
            'pages': (total + per_page - 1) // per_page if per_page else 1,
            'current_page': page
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_current_stock(material_id):
    """Helper function to get current stock level from inventory"""
    try:
        # Sum all inventory quantities for this material/product
        total_stock = db.session.query(
            db.func.sum(Inventory.quantity_available)
        ).filter_by(product_id=material_id).scalar()
        
        return float(total_stock or 0.0)
    except Exception as e:
        print(f"Error getting stock for material {material_id}: {e}")
        return 0.0
# ===============================
# WHAT-IF SIMULATION ROUTES
# ===============================

@mrp_bp.route('/simulation/scenarios', methods=['POST'])
@jwt_required()
@require_permission('mrp.run')
def run_whatif_simulation():
    """Run What-If simulation with different scenarios"""
    try:
        data = request.get_json()
        
        # Simulation parameters
        days_ahead = data.get('days_ahead', 30)
        scenarios = data.get('scenarios', [])  # List of scenario configurations
        
        start_date = get_local_now().date()
        end_date = start_date + timedelta(days=days_ahead)
        
        simulation_results = []
        
        for scenario in scenarios:
            scenario_name = scenario.get('name', 'Unnamed Scenario')
            include_forecasts = scenario.get('include_forecasts', True)
            forecast_confidence = scenario.get('forecast_confidence', 'most_likely')  # best_case, most_likely, worst_case
            demand_multiplier = scenario.get('demand_multiplier', 1.0)  # Adjust demand by percentage
            
            # Calculate requirements for this scenario
            requirements = {}
            
            # 1. PROCESS CONFIRMED SALES ORDERS (always included)
            sales_orders = SalesOrder.query.filter(
                SalesOrder.order_date.between(start_date, end_date),
                SalesOrder.status.in_(['confirmed', 'processing'])
            ).all()

            for order in sales_orders:
                for item in order.items:
                    product = item.product
                    bom = BillOfMaterials.query.filter_by(
                        product_id=product.id,
                        is_active=True
                    ).first()

                    if bom:
                        quantity_needed = item.quantity * demand_multiplier

                        for bom_item in bom.items:
                            material_id = bom_item.material_id or bom_item.product_id

                            if material_id not in requirements:
                                requirements[material_id] = {
                                    'material_id': material_id,
                                    'material_code': bom_item.material.code if bom_item.material else bom_item.product.code,
                                    'material_name': bom_item.material.name if bom_item.material else bom_item.product.name,
                                    'confirmed_quantity': 0,
                                    'forecast_quantity': 0,
                                    'total_quantity': 0,
                                    'uom': bom_item.uom,
                                    'sources': []
                                }

                            material_qty = quantity_needed * bom_item.quantity * (1 + bom_item.scrap_percent / 100)
                            requirements[material_id]['confirmed_quantity'] += material_qty
                            requirements[material_id]['total_quantity'] += material_qty

                            requirements[material_id]['sources'].append({
                                'type': 'sales_order',
                                'reference': order.order_number,
                                'quantity': material_qty,
                                'scenario_adjusted': demand_multiplier != 1.0
                            })

            # 2. PROCESS SALES FORECASTS (if enabled in scenario)
            # NOTE: forecast_confidence (best/worst/most_likely) no longer differentiates -
            # the Matrix only stores 1 plain qty per cell (§3.1(a)), all 3 collapse to the
            # same value now. Kept the branching for response-shape compatibility.
            if include_forecasts:
                forecasts = forecast_rows_in_range(start_date, end_date)

                for forecast in forecasts:
                    if forecast.product_id:
                        bom = BillOfMaterials.query.filter_by(
                            product_id=forecast.product_id,
                            is_active=True
                        ).first()

                        if bom:
                            # Select forecast value based on confidence level
                            if forecast_confidence == 'best_case':
                                forecast_quantity = float(forecast.best_case or 0)
                            elif forecast_confidence == 'worst_case':
                                forecast_quantity = float(forecast.worst_case or 0)
                            else:  # most_likely
                                forecast_quantity = float(forecast.most_likely or 0)
                            
                            # Apply demand multiplier
                            forecast_quantity *= demand_multiplier
                            
                            # Calculate period overlap
                            overlap_days = min(end_date, forecast.period_end) - max(start_date, forecast.period_start)
                            total_forecast_days = (forecast.period_end - forecast.period_start).days
                            
                            if total_forecast_days > 0:
                                period_ratio = overlap_days.days / total_forecast_days
                                adjusted_quantity = forecast_quantity * period_ratio

                                for bom_item in bom.items:
                                    material_id = bom_item.material_id or bom_item.product_id

                                    if material_id not in requirements:
                                        requirements[material_id] = {
                                            'material_id': material_id,
                                            'material_code': bom_item.material.code if bom_item.material else bom_item.product.code,
                                            'material_name': bom_item.material.name if bom_item.material else bom_item.product.name,
                                            'confirmed_quantity': 0,
                                            'forecast_quantity': 0,
                                            'total_quantity': 0,
                                            'uom': bom_item.uom,
                                            'sources': []
                                        }

                                    material_qty = adjusted_quantity * bom_item.quantity * (1 + bom_item.scrap_percent / 100)
                                    requirements[material_id]['forecast_quantity'] += material_qty
                                    requirements[material_id]['total_quantity'] += material_qty

                                    requirements[material_id]['sources'].append({
                                        'type': 'sales_forecast',
                                        'reference': forecast.forecast_number,
                                        'quantity': material_qty,
                                        'confidence': forecast_confidence,
                                        'scenario_adjusted': demand_multiplier != 1.0
                                    })

            # 3. ADD CURRENT STOCK AND CALCULATE NET REQUIREMENTS
            total_shortage_value = 0
            critical_materials = 0
            
            for material_id in requirements:
                current_stock = get_current_stock(material_id)
                requirements[material_id]['current_stock'] = current_stock
                requirements[material_id]['net_requirement'] = max(0, requirements[material_id]['total_quantity'] - current_stock)
                
                if requirements[material_id]['net_requirement'] > 0:
                    critical_materials += 1

            # Scenario summary
            scenario_result = {
                'scenario_name': scenario_name,
                'scenario_config': {
                    'include_forecasts': include_forecasts,
                    'forecast_confidence': forecast_confidence,
                    'demand_multiplier': demand_multiplier,
                    'days_ahead': days_ahead
                },
                'summary': {
                    'total_materials': len(requirements),
                    'critical_materials': critical_materials,
                    'total_shortage_value': total_shortage_value,
                    'confirmed_orders_count': len(sales_orders),
                    'forecasts_included': len(forecasts) if include_forecasts else 0
                },
                'requirements': list(requirements.values())
            }
            
            simulation_results.append(scenario_result)

        return jsonify({
            'simulation_results': simulation_results,
            'simulation_period': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'days_ahead': days_ahead
            },
            'scenarios_count': len(scenarios)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@mrp_bp.route('/simulation/templates', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_simulation_templates():
    """Get predefined simulation scenario templates"""
    try:
        templates = [
            {
                'id': 'conservative',
                'name': 'Conservative Planning',
                'description': 'Use worst-case forecasts with safety margins',
                'config': {
                    'include_forecasts': True,
                    'forecast_confidence': 'worst_case',
                    'demand_multiplier': get_setting_value('mrp.conservative_demand_multiplier', 1.1)
                }
            },
            {
                'id': 'optimistic',
                'name': 'Optimistic Planning', 
                'description': 'Use best-case forecasts for aggressive growth',
                'config': {
                    'include_forecasts': True,
                    'forecast_confidence': 'best_case',
                    'demand_multiplier': 1.0
                }
            },
            {
                'id': 'realistic',
                'name': 'Realistic Planning',
                'description': 'Use most likely forecasts with normal demand',
                'config': {
                    'include_forecasts': True,
                    'forecast_confidence': 'most_likely',
                    'demand_multiplier': 1.0
                }
            },
            {
                'id': 'orders_only',
                'name': 'Orders Only',
                'description': 'Plan based on confirmed orders only',
                'config': {
                    'include_forecasts': False,
                    'forecast_confidence': 'most_likely',
                    'demand_multiplier': 1.0
                }
            },
            {
                'id': 'high_demand',
                'name': 'High Demand Scenario',
                'description': 'Simulate 25% increase in demand',
                'config': {
                    'include_forecasts': True,
                    'forecast_confidence': 'most_likely',
                    'demand_multiplier': get_setting_value('mrp.high_demand_multiplier', 1.25)
                }
            },
            {
                'id': 'low_demand',
                'name': 'Low Demand Scenario',
                'description': 'Simulate 20% decrease in demand',
                'config': {
                    'include_forecasts': True,
                    'forecast_confidence': 'most_likely',
                    'demand_multiplier': get_setting_value('mrp.low_demand_multiplier', 0.8)
                }
            }
        ]
        
        return jsonify({'templates': templates})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===============================
# DASHBOARD ENDPOINTS
# ===============================

@mrp_bp.route('/dashboard/metrics', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_dashboard_metrics():
    """Get MRP dashboard KPIs and metrics"""
    try:
        # Calculate real metrics from database
        total_work_orders = WorkOrder.query.count()
        pending_orders = WorkOrder.query.filter_by(status='pending').count()
        in_progress_orders = WorkOrder.query.filter_by(status='in_progress').count()
        completed_orders = WorkOrder.query.filter_by(status='completed').count()
        
        # Calculate overdue orders
        from datetime import datetime
        overdue_orders = WorkOrder.query.filter(
            WorkOrder.scheduled_end_date < get_local_now(),
            WorkOrder.status.in_(['planned', 'released', 'in_progress'])
        ).count()
        
        # Calculate material shortages (simplified for now)
        material_shortages = 0
        
        # Calculate capacity utilization (simplified)
        total_capacity = db.session.query(func.sum(Machine.capacity_per_hour)).scalar() or 0
        if total_capacity > 0:
            active_machines = Machine.query.filter_by(status='running').count()
            total_machines = Machine.query.count()
            capacity_utilization = (active_machines / total_machines * 100) if total_machines > 0 else 0
        else:
            capacity_utilization = 0
        
        # Calculate on-time delivery
        completed_on_time = WorkOrder.query.filter(
            WorkOrder.status == 'completed',
            WorkOrder.actual_end_date <= WorkOrder.scheduled_end_date
        ).count()
        on_time_delivery = (completed_on_time / completed_orders * 100) if completed_orders > 0 else 0
        
        metrics = {
            'total_work_orders': total_work_orders,
            'pending_orders': pending_orders,
            'in_progress_orders': in_progress_orders,
            'completed_orders': completed_orders,
            'overdue_orders': overdue_orders,
            'material_shortages': material_shortages,
            'capacity_utilization': round(capacity_utilization, 1),
            'on_time_delivery': round(on_time_delivery, 1)
        }
        
        return jsonify({'metrics': metrics}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@mrp_bp.route('/dashboard/demand-forecast', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_dashboard_demand_forecast():
    """Get demand forecast for dashboard"""
    try:
        from models.sales import SalesOrderItem

        # Get real demand data from sales orders and forecasts
        forecast = []

        # Products with recent sales activity, in a lookback window (default 90 days)
        lookback_days = int(get_setting_value('mrp.demand_lookback_days', 90))
        cutoff = get_local_now() - timedelta(days=lookback_days)

        sales_rows = db.session.query(
            SalesOrderItem.product_id,
            Product.name,
            func.sum(SalesOrderItem.quantity).label('total_qty')
        ).join(SalesOrder, SalesOrderItem.order_id == SalesOrder.id
        ).join(Product, SalesOrderItem.product_id == Product.id
        ).filter(SalesOrder.order_date >= cutoff
        ).group_by(SalesOrderItem.product_id, Product.name).all()

        products_with_sales = [(row.product_id, row.name) for row in sales_rows]
        current_demand_map = {row.product_id: float(row.total_qty) for row in sales_rows}

        # Latest forecast cell per product (by period_start desc) - precomputed once
        # instead of 1 query per product, since iter_forecast_month_rows() is a full scan.
        latest_forecast_by_product = {}
        for row in iter_forecast_month_rows(status_filter=('draft', 'approved')):
            existing = latest_forecast_by_product.get(row.product_id)
            if not existing or row.period_start > existing.period_start:
                latest_forecast_by_product[row.product_id] = row

        for product_id, product_name in products_with_sales:
            current_demand = current_demand_map.get(product_id, 0)

            # Get forecast data if available
            forecast_record = latest_forecast_by_product.get(product_id)

            if forecast_record:
                forecasted_demand = float(forecast_record.most_likely)
                variance = ((forecasted_demand - current_demand) / current_demand * 100) if current_demand > 0 else 0
                
                trend_threshold = get_setting_value('mrp.demand_trend_threshold_pct', 5.0)
                if variance > trend_threshold:
                    trend = 'up'
                elif variance < -trend_threshold:
                    trend = 'down'
                else:
                    trend = 'stable'
                
                forecast.append({
                    'product_name': product_name,
                    'current_demand': int(current_demand),
                    'forecasted_demand': int(forecasted_demand),
                    'variance': round(variance, 1),
                    'trend': trend
                })
        
        return jsonify({'forecast': forecast}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@mrp_bp.route('/dashboard/capacity', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_dashboard_capacity():
    """Get capacity data for dashboard"""
    try:
        # Get real capacity data from machines
        capacity = []
        
        machines = Machine.query.filter_by(is_active=True).all()
        
        for machine in machines:
            try:
                # Calculate available capacity (hours per day) - ensure valid number
                machine_capacity = getattr(machine, 'capacity_per_hour', 100) or 100
                shift_hours = float(get_setting_value('production.shift2_runtime', 480)) / 60.0 # fallback to shift 2 = 8 hours
                available_capacity = float(machine_capacity) * shift_hours
                
                # Calculate planned capacity from work orders (simplified to avoid date issues)
                planned_util_rate = float(get_setting_value('mrp.planned_utilization_pct', 70.0)) / 100.0
                planned_capacity = available_capacity * planned_util_rate
                
                # Calculate utilization percentage
                utilization_percent = (planned_capacity / available_capacity * 100) if available_capacity > 0 else 0
                
                # Ensure all values are valid numbers
                available_capacity = float(available_capacity) if not (isnan(available_capacity) or isinf(available_capacity)) else 100.0
                planned_capacity = float(planned_capacity) if not (isnan(planned_capacity) or isinf(planned_capacity)) else 70.0
                utilization_percent = float(utilization_percent) if not (isnan(utilization_percent) or isinf(utilization_percent)) else 70.0
                
                bottleneck_threshold = float(get_setting_value('mrp.bottleneck_utilization_pct', 95.0))
                bottleneck = utilization_percent > bottleneck_threshold
                
                capacity.append({
                    'resource': f"{machine.name} ({machine.code})" if hasattr(machine, 'name') and hasattr(machine, 'code') else f"Machine {machine.id}",
                    'available_capacity': round(available_capacity, 1),
                    'planned_capacity': round(planned_capacity, 1),
                    'utilization_percent': round(utilization_percent, 1),
                    'bottleneck': bottleneck
                })
            except Exception as machine_error:
                print(f"Error processing machine {machine.id}: {machine_error}")
                continue
        
        # If no machines found, return sample data
        if not capacity:
            capacity = [
                {'resource': 'Machine A', 'available_capacity': 800.0, 'planned_capacity': 560.0, 'utilization_percent': 70.0, 'bottleneck': False},
                {'resource': 'Machine B', 'available_capacity': 800.0, 'planned_capacity': 640.0, 'utilization_percent': 80.0, 'bottleneck': False},
                {'resource': 'Machine C', 'available_capacity': 800.0, 'planned_capacity': 720.0, 'utilization_percent': 90.0, 'bottleneck': False}
            ]
        
        return jsonify({'capacity': capacity}), 200
        
    except Exception as e:
        print(f"Capacity endpoint error: {str(e)}")
        # Return fallback data on error
        return jsonify({
            'capacity': [
                {'resource': 'Machine A', 'available_capacity': 800.0, 'planned_capacity': 560.0, 'utilization_percent': 70.0, 'bottleneck': False},
                {'resource': 'Machine B', 'available_capacity': 800.0, 'planned_capacity': 640.0, 'utilization_percent': 80.0, 'bottleneck': False},
                {'resource': 'Machine C', 'available_capacity': 800.0, 'planned_capacity': 720.0, 'utilization_percent': 90.0, 'bottleneck': False}
            ]
        }), 200

@mrp_bp.route('/dashboard/material-shortages', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_dashboard_material_shortages():
    """Get material shortages for dashboard"""
    try:
        # Get real material shortage data
        shortages = []
        
        # Find materials with stock below minimum level (simplified for now)
        # Note: This requires proper Material-Inventory relationship
        materials_with_shortage = []
        
        for material_id, material_name, min_stock, available_qty in materials_with_shortage:
            shortage_qty = max(0, min_stock - available_qty)
            
            # Determine impact level based on shortage percentage
            shortage_percent = (shortage_qty / min_stock * 100) if min_stock > 0 else 100
            
            if shortage_percent >= 80:
                impact_level = 'critical'
            elif shortage_percent >= 50:
                impact_level = 'high'
            elif shortage_percent >= 20:
                impact_level = 'medium'
            else:
                impact_level = 'low'
            
            # Get expected delivery from purchase orders (simplified for now)
            next_po = None
            
            expected_delivery = next_po.expected_delivery_date.isoformat() if next_po and next_po.expected_delivery_date else None
            
            shortages.append({
                'id': material_id,
                'material_name': material_name,
                'required_qty': int(min_stock),
                'available_qty': int(available_qty),
                'shortage_qty': int(shortage_qty),
                'impact_level': impact_level,
                'expected_delivery': expected_delivery
            })
        
        return jsonify({'shortages': shortages}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@mrp_bp.route('/dashboard/timeline', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_dashboard_timeline():
    """Get planning timeline for dashboard"""
    try:
        # Simplified timeline data for next 4 weeks to avoid database errors
        timeline = []
        
        # Get basic counts for realistic data
        total_work_orders = WorkOrder.query.count() or 0
        total_machines = Machine.query.filter_by(is_active=True).count() or 1
        
        for week_num in range(1, 5):
            # Generate realistic but simple timeline data
            base_production = max(50, total_work_orders * 10)
            
            timeline.append({
                'week': f'Week {week_num}',
                'planned_production': int(base_production + (week_num * 20)),
                'actual_production': int(base_production * 0.8 + (week_num * 15)),
                'material_arrivals': int(base_production * 0.6 + (week_num * 10)),
                'capacity_available': int(total_machines * 8 * 7 * 100)  # machines * hours/day * days/week * capacity/hour
            })
        
        return jsonify({'timeline': timeline}), 200
        
    except Exception as e:
        print(f"Timeline error: {str(e)}")  # Debug logging
        # Return empty timeline if there's still an error
        return jsonify({
            'timeline': [
                {'week': 'Week 1', 'planned_production': 100, 'actual_production': 80, 'material_arrivals': 60, 'capacity_available': 5600},
                {'week': 'Week 2', 'planned_production': 120, 'actual_production': 95, 'material_arrivals': 70, 'capacity_available': 5600},
                {'week': 'Week 3', 'planned_production': 140, 'actual_production': 110, 'material_arrivals': 80, 'capacity_available': 5600},
                {'week': 'Week 4', 'planned_production': 160, 'actual_production': 125, 'material_arrivals': 90, 'capacity_available': 5600}
            ]
        }), 200

# ===============================
# DEMAND PLANNING ENDPOINTS
# ===============================

@mrp_bp.route('/demand/forecast', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_demand_forecast():
    """Get demand forecasting data"""
    try:
        period = request.args.get('period', '3months')
        category = request.args.get('category', 'all')
        product = request.args.get('product', 'all')
        method = request.args.get('method', 'auto')
        
        # Get real forecast data from database
        forecasts = []
        
        try:
            forecast_records = list(iter_forecast_month_rows(status_filter=('draft', 'approved')))

            if category != 'all':
                forecast_records = [f for f in forecast_records if f.product and f.product.category == category]
            if product != 'all':
                forecast_records = [f for f in forecast_records if str(f.product_id) == str(product)]

            forecast_records.sort(key=lambda f: f.created_at or f.period_start, reverse=True)
            forecast_records = forecast_records[:20]

            for forecast in forecast_records:
                try:
                    # Use actual model fields
                    forecasted_demand = float(forecast.most_likely or 0)
                    # actual_value/accuracy_percentage tracking fields don't exist in the
                    # Matrix (ForecastLine has no actuals-tracking equivalent) - always 0,
                    # so variance/confidence_level below are not meaningful here any more.
                    current_demand = 0.0
                    
                    # Calculate variance
                    if current_demand > 0:
                        variance_percent = ((forecasted_demand - current_demand) / current_demand * 100)
                    else:
                        variance_percent = 0
                    
                    # Determine trend based on variance
                    if variance_percent > 10:
                        trend = 'up'
                    elif variance_percent < -10:
                        trend = 'down'
                    else:
                        trend = 'stable'
                    
                    # Get product info safely
                    product_name = 'Unknown Product'
                    product_code = 'N/A'
                    product_category = 'Uncategorized'
                    
                    if forecast.product:
                        product_name = forecast.product.name or 'Unknown Product'
                        product_code = forecast.product.code or 'N/A'
                        product_category = forecast.product.category or 'Uncategorized'
                    
                    forecasts.append({
                        'product_id': forecast.product_id,
                        'product_name': product_name,
                        'product_code': product_code,
                        'category': product_category,
                        'current_demand': int(current_demand),
                        'forecasted_demand': int(forecasted_demand),
                        'variance': round(variance_percent, 1),
                        'trend': trend,
                        'confidence_level': 0.0,
                        'seasonality_factor': 1.0,
                        'last_updated': forecast.created_at.isoformat() if forecast.created_at else None
                    })
                except Exception as item_error:
                    print(f"Error processing forecast item {forecast.id}: {item_error}")
                    continue
                    
        except Exception as query_error:
            print(f"Database query error: {query_error}")
            # Return empty forecasts if query fails
            forecasts = []
        
        # If no real data, return sample data for development
        if not forecasts:
            forecasts = [
                {
                    'product_id': 1,
                    'product_name': 'Sample Product A',
                    'product_code': 'SP001',
                    'category': 'Category A',
                    'current_demand': 100,
                    'forecasted_demand': 120,
                    'variance': 20.0,
                    'trend': 'up',
                    'confidence_level': 85.0,
                    'seasonality_factor': 1.1,
                    'last_updated': '2024-01-01T00:00:00'
                },
                {
                    'product_id': 2,
                    'product_name': 'Sample Product B',
                    'product_code': 'SP002',
                    'category': 'Category B',
                    'current_demand': 80,
                    'forecasted_demand': 75,
                    'variance': -6.25,
                    'trend': 'stable',
                    'confidence_level': 78.0,
                    'seasonality_factor': 0.9,
                    'last_updated': '2024-01-01T00:00:00'
                },
                {
                    'product_id': 3,
                    'product_name': 'Sample Product C',
                    'product_code': 'SP003',
                    'category': 'Category C',
                    'current_demand': 150,
                    'forecasted_demand': 130,
                    'variance': -13.33,
                    'trend': 'down',
                    'confidence_level': 72.0,
                    'seasonality_factor': 0.8,
                    'last_updated': '2024-01-01T00:00:00'
                }
            ]
        
        return jsonify({'forecasts': forecasts}), 200
        
    except Exception as e:
        print(f"Demand forecast error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@mrp_bp.route('/demand/historical', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_demand_historical():
    """Get historical demand data"""
    try:
        # Return empty historical data - to be implemented when historical tracking is needed
        historical = []
        
        return jsonify({'historical': historical}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@mrp_bp.route('/demand/seasonality', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_demand_seasonality():
    """Get seasonality patterns"""
    try:
        # Return empty seasonality data - to be implemented when seasonal analysis is needed
        seasonality = []
        
        return jsonify({'seasonality': seasonality}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@mrp_bp.route('/demand/accuracy', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_demand_accuracy():
    """Get forecast accuracy metrics"""
    try:
        # Return empty accuracy data - to be implemented when forecast accuracy tracking is needed
        accuracy = []
        
        return jsonify({'accuracy': accuracy}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@mrp_bp.route('/demand/calculate-forecast', methods=['POST'])
@jwt_required()
@require_permission('mrp.view')
def calculate_demand_forecast():
    """Calculate/recalculate demand forecast"""
    try:
        data = request.get_json()
        period = data.get('period', '3months')
        method = data.get('method', 'auto')
        
        # Return calculation status without hardcoded metrics
        result = {
            'status': 'success',
            'message': 'Forecast calculation request received',
            'calculation_details': {
                'period': period,
                'method': method,
                'products_processed': 0,
                'forecasts_updated': 0,
                'accuracy_improved': False,
                'calculation_time': '0 seconds'
            },
            'summary': {
                'total_demand_increase': 0,
                'confidence_level': 0,
                'seasonal_adjustments': 0,
                'trend_changes': 0
            }
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===============================
# CAPACITY PLANNING ENDPOINTS
# ===============================

@mrp_bp.route('/capacity/resources', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_capacity_resources():
    """Get capacity resources data"""
    try:
        # Return empty resources - to be implemented when capacity planning is needed
        resources = []
        
        return jsonify({'resources': resources}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@mrp_bp.route('/capacity/timeline', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_capacity_timeline():
    """Get capacity timeline data"""
    try:
        # Return empty timeline - to be implemented when capacity timeline tracking is needed
        timeline = []
        
        return jsonify({'timeline': timeline}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===============================
# MATERIAL REQUIREMENTS ENDPOINTS
# ===============================

@mrp_bp.route('/materials/requirements', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_materials_requirements():
    """Get material requirements data"""
    try:
        # Return empty requirements - to be implemented when material requirements planning is needed
        requirements = []
        
        return jsonify({'requirements': requirements}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@mrp_bp.route('/materials/summary', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_materials_summary():
    """Get material requirements summary"""
    try:
        # Calculate real summary from database
        total_materials = Material.query.filter_by(is_active=True).count()
        
        # Calculate shortages (simplified for now)
        shortage_items = 0
        
        summary = {
            'total_materials': total_materials,
            'total_shortage_items': shortage_items,
            'total_shortage_value': 0,  # To be calculated when cost data is available
            'critical_shortages': 0,    # To be calculated when priority system is implemented
            'avg_lead_time': 0          # To be calculated when lead time data is available
        }
        
        return jsonify({'summary': summary}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===============================
# SUPPLIER INTEGRATION ENDPOINTS
# ===============================

@mrp_bp.route('/suppliers/performance', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_suppliers_performance():
    """Get supplier performance data"""
    try:
        # Return empty suppliers - to be implemented when supplier performance tracking is needed
        suppliers = []
        
        return jsonify({'suppliers': suppliers}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@mrp_bp.route('/suppliers/capacity', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_suppliers_capacity():
    """Get supplier capacity data"""
    try:
        # Return empty capacity - to be implemented when supplier capacity tracking is needed
        capacity = []
        
        return jsonify({'capacity': capacity}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===============================
# AUTO PURCHASE ORDER FROM SHORTAGE
# ===============================

@mrp_bp.route('/create-purchase-order-from-shortage', methods=['POST'])
@jwt_required()
@require_permission('mrp.view')
def create_po_from_shortage():
    """
    Auto-generate Purchase Order from material shortage
    Used when Sales Order is created with insufficient materials
    """
    try:
        from models.purchasing import PurchaseOrder, PurchaseOrderItem, Supplier
        from models.product import Material
        from utils import generate_number_v2

        data = request.get_json()
        user_id = int(get_jwt_identity())

        shortage_items = data.get('shortage_items', [])
        reference_type = data.get('reference_type', 'sales_order')  # sales_order, sales_forecast, work_order
        reference_id = data.get('reference_id')
        reference_number = data.get('reference_number', '')
        
        if not shortage_items:
            return jsonify({'error': 'No shortage items provided'}), 400
        
        # Group items by supplier
        supplier_items = {}
        for item in shortage_items:
            supplier_id = item.get('supplier_id')
            if not supplier_id:
                # Try to get supplier from material
                material_id = item.get('material_id')
                if material_id:
                    material = db.session.get(Material, material_id)
                    if material and material.supplier_id:
                        supplier_id = material.supplier_id
            
            if not supplier_id:
                # Skip items without supplier
                continue
            
            if supplier_id not in supplier_items:
                supplier_items[supplier_id] = []
            supplier_items[supplier_id].append(item)
        
        if not supplier_items:
            return jsonify({'error': 'No items with valid suppliers found'}), 400
        
        created_pos = []
        
        # Create PO for each supplier
        for supplier_id, items in supplier_items.items():
            supplier = db.session.get(Supplier, supplier_id)
            if not supplier:
                continue
            
            po_number = generate_number_v2('purchase_order', 'PO', PurchaseOrder, 'po_number')

            po = PurchaseOrder(
                po_number=po_number,
                supplier_id=supplier_id,
                order_date=get_local_now().date(),
                required_date=get_local_now().date() + timedelta(days=supplier.lead_time_days or int(get_setting_value('warehouse.default_lead_time_days', 7))),
                status='draft',
                priority='high',  # Auto-generated POs are high priority
                notes=f'Auto-generated from {reference_type} {reference_number} due to material shortage',
                internal_notes=f'Reference: {reference_type}:{reference_id}',
                created_by=user_id
            )
            db.session.add(po)
            db.session.flush()
            
            subtotal = 0
            for idx, item in enumerate(items, 1):
                material_id = item.get('material_id')
                material = db.session.get(Material, material_id) if material_id else None
                
                quantity = float(item.get('shortage_quantity', 0))
                unit_price = float(item.get('unit_cost', 0)) or (float(material.cost_per_unit) if material else 0)
                total_price = quantity * unit_price
                
                po_item = PurchaseOrderItem(
                    po_id=po.id,
                    line_number=idx,
                    material_id=material_id,
                    description=item.get('item_name', material.name if material else 'Unknown'),
                    quantity=quantity,
                    uom=item.get('uom', material.primary_uom if material else 'PCS'),
                    unit_price=unit_price,
                    total_price=total_price,
                    notes=f'Shortage from {reference_type} {reference_number}'
                )
                db.session.add(po_item)
                subtotal += total_price
            
            po.subtotal = subtotal
            po.total_amount = subtotal
            
            created_pos.append({
                'po_id': po.id,
                'po_number': po_number,
                'supplier_name': supplier.company_name,
                'total_amount': float(subtotal),
                'items_count': len(items)
            })
        
        db.session.commit()
        
        # Create notification
        try:
            from models import Notification
            notification = Notification(
                user_id=user_id,
                notification_type='info',
                category='purchasing',
                title='Purchase Orders Auto-Generated',
                message=f'{len(created_pos)} Purchase Order(s) created from material shortage for {reference_type} {reference_number}',
                reference_type='purchase_order',
                reference_id=created_pos[0]['po_id'] if created_pos else None,
                priority='high',
                action_url='/app/purchasing/orders'
            )
            db.session.add(notification)
            db.session.commit()
        except Exception as notif_error:
            print(f"Notification error: {notif_error}")
        
        return jsonify({
            'message': f'{len(created_pos)} Purchase Order(s) created successfully',
            'purchase_orders': created_pos,
            'reference_type': reference_type,
            'reference_id': reference_id
        }), 201
        
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@mrp_bp.route('/check-and-create-po', methods=['POST'])
@jwt_required()
@require_permission('mrp.view')
def check_and_create_po():
    """
    Check material requirements for a sales order and auto-create PO if shortage
    This is called when confirming a sales order
    """
    try:
        from models.production import BillOfMaterials, BOMItem
        from models.warehouse import Inventory
        from utils.bom_explosion import explode_bom_requirements, get_current_stock as _get_stock, CircularBOMError, MaxDepthExceededError

        data = request.get_json()
        user_id = int(get_jwt_identity())

        items = data.get('items', [])  # [{product_id, quantity}, ...]
        reference_type = data.get('reference_type', 'sales_order')
        reference_id = data.get('reference_id')
        reference_number = data.get('reference_number', '')
        auto_create_po = data.get('auto_create_po', True)

        all_shortages = []

        def scale_fn(bom_item, parent_qty, bom):
            pack_per_carton = bom.pack_per_carton or 1
            cartons_needed = parent_qty / pack_per_carton
            required_qty = float(bom_item.quantity) * cartons_needed / float(bom.batch_size)
            required_qty *= (1 + float(bom_item.scrap_percent or 0) / 100)
            return required_qty

        def extra_fn(bom_item):
            return {
                'unit_cost': float(bom_item.unit_cost or 0),
                'supplier_id': bom_item.supplier_id,
                'is_critical': bom_item.is_critical,
            }

        for item in items:
            product_id = item.get('product_id')
            quantity = float(item.get('quantity', 0))

            # Get BOM for product
            bom = BillOfMaterials.query.filter_by(
                product_id=product_id,
                is_active=True
            ).first()

            if not bom:
                continue

            try:
                exploded = explode_bom_requirements(product_id, quantity, scale_fn, extra_fn=extra_fn)
            except (CircularBOMError, MaxDepthExceededError) as bom_err:
                return jsonify({'error': str(bom_err)}), 400

            for m in exploded['materials']:
                current_stock = _get_stock(material_id=m['material_id'])
                if current_stock < m['required_quantity']:
                    all_shortages.append({
                        'material_id': m['material_id'],
                        'product_id': None,
                        'item_name': m['material_name'],
                        'item_code': None,
                        'required_quantity': m['required_quantity'],
                        'available_quantity': current_stock,
                        'shortage_quantity': m['required_quantity'] - current_stock,
                        'unit_cost': m.get('unit_cost', 0),
                        'uom': m['uom'],
                        'supplier_id': m.get('supplier_id'),
                        'is_critical': m.get('is_critical', False)
                    })

            # Sub-assemblies (WIP/mixing) that are themselves short and have
            # no BOM to explode further - nothing to explode into raw
            # materials, but still worth surfacing as a shortage since it
            # can't be auto-PO'd like a material (no supplier on a product).
            for sub in exploded['sub_assemblies']:
                if sub['shortage_quantity'] > 0 and not sub['has_own_bom']:
                    all_shortages.append({
                        'material_id': None,
                        'product_id': sub['product_id'],
                        'item_name': sub['product_name'],
                        'item_code': None,
                        'required_quantity': sub['required_quantity'],
                        'available_quantity': sub['current_stock'],
                        'shortage_quantity': sub['shortage_quantity'],
                        'unit_cost': 0,
                        'uom': None,
                        'supplier_id': None,
                        'is_critical': False
                    })

        result = {
            'has_shortage': len(all_shortages) > 0,
            'total_shortage_items': len(all_shortages),
            'shortage_items': all_shortages,
            'purchase_orders': []
        }
        
        # Auto-create PO if requested and there are shortages
        if auto_create_po and all_shortages:
            # Call the create PO function
            po_result = create_po_from_shortage_internal(
                shortage_items=all_shortages,
                reference_type=reference_type,
                reference_id=reference_id,
                reference_number=reference_number,
                user_id=user_id
            )
            result['purchase_orders'] = po_result.get('purchase_orders', [])
            result['message'] = po_result.get('message', '')
        
        return jsonify(result), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


def create_po_from_shortage_internal(shortage_items, reference_type, reference_id, reference_number, user_id):
    """Internal function to create PO from shortage items"""
    from models.purchasing import PurchaseOrder, PurchaseOrderItem, Supplier
    from models.product import Material
    from utils import generate_number_v2

    # Group items by supplier
    supplier_items = {}
    for item in shortage_items:
        supplier_id = item.get('supplier_id')
        if not supplier_id:
            material_id = item.get('material_id')
            if material_id:
                material = db.session.get(Material, material_id)
                if material and material.supplier_id:
                    supplier_id = material.supplier_id
        
        if not supplier_id:
            continue
        
        if supplier_id not in supplier_items:
            supplier_items[supplier_id] = []
        supplier_items[supplier_id].append(item)
    
    if not supplier_items:
        return {'message': 'No items with valid suppliers', 'purchase_orders': []}
    
    created_pos = []
    
    for supplier_id, items in supplier_items.items():
        supplier = db.session.get(Supplier, supplier_id)
        if not supplier:
            continue
        
        po_number = generate_number_v2('purchase_order', 'PO', PurchaseOrder, 'po_number')
        
        po = PurchaseOrder(
            po_number=po_number,
            supplier_id=supplier_id,
            order_date=get_local_now().date(),
            required_date=get_local_now().date() + timedelta(days=supplier.lead_time_days or int(get_setting_value('warehouse.default_lead_time_days', 7))),
            status='draft',
            priority='high',
            notes=f'Auto-generated from {reference_type} {reference_number}',
            internal_notes=f'Reference: {reference_type}:{reference_id}',
            created_by=user_id
        )
        db.session.add(po)
        db.session.flush()
        
        subtotal = 0
        for idx, item in enumerate(items, 1):
            material_id = item.get('material_id')
            material = db.session.get(Material, material_id) if material_id else None
            
            quantity = float(item.get('shortage_quantity', 0))
            unit_price = float(item.get('unit_cost', 0)) or (float(material.cost_per_unit) if material else 0)
            total_price = quantity * unit_price
            
            po_item = PurchaseOrderItem(
                po_id=po.id,
                line_number=idx,
                material_id=material_id,
                description=item.get('item_name', material.name if material else 'Unknown'),
                quantity=quantity,
                uom=item.get('uom', material.primary_uom if material else 'PCS'),
                unit_price=unit_price,
                total_price=total_price
            )
            db.session.add(po_item)
            subtotal += total_price
        
        po.subtotal = subtotal
        po.total_amount = subtotal
        
        created_pos.append({
            'po_id': po.id,
            'po_number': po_number,
            'supplier_name': supplier.company_name,
            'total_amount': float(subtotal),
            'items_count': len(items)
        })
    
    db.session.commit()

    return {
        'message': f'{len(created_pos)} Purchase Order(s) created',
        'purchase_orders': created_pos
    }


@mrp_bp.route('/time-phased-check/<int:sales_order_id>', methods=['GET'])
@jwt_required()
@require_permission('mrp.view')
def get_time_phased_check(sales_order_id):
    """MRP time-phased check with cross-SO aggregation, for PPIC. Triggered
    automatically (notification) when a Sales Forecast is converted to a
    Sales Order - this endpoint is what the notification's action_url and
    the MRP dashboard's "Time-Phased Check" section both call. Recomputed
    fresh on every call (no snapshot/cache), so PPIC always sees the
    current picture, not what it looked like at conversion time."""
    try:
        from utils.mrp_time_phased import check_time_phased_aggregate
        result = check_time_phased_aggregate(sales_order_id)
        return jsonify({'materials': result}), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
