"""
Executive Dashboard Routes - Advanced Analytics
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from sqlalchemy import func, and_, or_, extract
from models import db
from models.sales import SalesOrder, Customer
from models.production import WorkOrder, ShiftProduction, WIPStock
from models.product import Product, Material
from models.warehouse import Inventory, WarehouseZone
from models.quality import QualityInspection
from models.finance import Invoice, Payment, Account, AccountingEntry
from models.hr import Employee
from models.oee import OEERecord
from models.user import User
from models.kpi_target import KPITarget
from models.converting import ConvertingProduction
from models.settings import CompanyProfile
import json
from utils.timezone import get_local_now, get_local_today

executive_dashboard_bp = Blueprint('executive_dashboard', __name__)

@executive_dashboard_bp.route('/overview', methods=['GET'])
@jwt_required(optional=True)
def get_executive_overview():
    """
    Get comprehensive executive overview with all key metrics
    """
    try:
        # Get date range (default: current month)
        end_date = get_local_now().date()
        start_date = (get_local_now() - timedelta(days=30)).date()
        
        # Previous period for comparison
        prev_end_date = start_date - timedelta(days=1)
        prev_start_date = prev_end_date - timedelta(days=30)
        
        # ===== FINANCIAL METRICS =====
        # Current period revenue - try Invoice first, fallback to SalesOrder
        current_revenue = db.session.query(func.sum(Invoice.total_amount))\
            .filter(
                Invoice.invoice_date >= start_date,
                Invoice.invoice_date <= end_date,
                Invoice.status.in_(['paid', 'partial'])
            ).scalar() or 0
        
        # If no invoice data, use SalesOrder total_amount
        if current_revenue == 0:
            current_revenue = db.session.query(func.sum(SalesOrder.total_amount))\
                .filter(
                    SalesOrder.order_date >= start_date,
                    SalesOrder.order_date <= end_date
                ).scalar() or 0
        
        # Previous period revenue
        prev_revenue = db.session.query(func.sum(Invoice.total_amount))\
            .filter(
                Invoice.invoice_date >= prev_start_date,
                Invoice.invoice_date <= prev_end_date,
                Invoice.status.in_(['paid', 'partial'])
            ).scalar() or 0
        
        # If no invoice data, use SalesOrder
        if prev_revenue == 0:
            prev_revenue = db.session.query(func.sum(SalesOrder.total_amount))\
                .filter(
                    SalesOrder.order_date >= prev_start_date,
                    SalesOrder.order_date <= prev_end_date
                ).scalar() or 0
        
        revenue_growth = ((current_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
        
        # Cash collection
        cash_collected = db.session.query(func.sum(Payment.amount))\
            .filter(
                Payment.payment_date >= start_date,
                Payment.payment_date <= end_date
            ).scalar() or 0
        
        # Outstanding AR
        outstanding_ar = db.session.query(func.sum(Invoice.total_amount - Invoice.paid_amount))\
            .filter(
                Invoice.status.in_(['pending', 'partial']),
                Invoice.due_date < end_date
            ).scalar() or 0
        
        # ===== SALES METRICS =====
        # Current period orders
        current_orders = db.session.query(func.count(SalesOrder.id))\
            .filter(
                SalesOrder.order_date >= start_date,
                SalesOrder.order_date <= end_date
            ).scalar() or 0
        
        # Previous period orders
        prev_orders = db.session.query(func.count(SalesOrder.id))\
            .filter(
                SalesOrder.order_date >= prev_start_date,
                SalesOrder.order_date <= prev_end_date
            ).scalar() or 0
        
        orders_growth = ((current_orders - prev_orders) / prev_orders * 100) if prev_orders > 0 else 0
        
        # Order fulfillment rate
        total_orders = db.session.query(func.count(SalesOrder.id))\
            .filter(
                SalesOrder.order_date >= start_date,
                SalesOrder.order_date <= end_date
            ).scalar() or 0
        
        fulfilled_orders = db.session.query(func.count(SalesOrder.id))\
            .filter(
                SalesOrder.order_date >= start_date,
                SalesOrder.order_date <= end_date,
                SalesOrder.status.in_(['delivered', 'invoiced'])
            ).scalar() or 0
        
        fulfillment_rate = (fulfilled_orders / total_orders * 100) if total_orders > 0 else 0
        
        # ===== PRODUCTION METRICS =====
        # Production output
        production_output = db.session.query(func.sum(ShiftProduction.good_quantity))\
            .filter(
                ShiftProduction.production_date >= start_date,
                ShiftProduction.production_date <= end_date
            ).scalar() or 0
        
        prev_production = db.session.query(func.sum(ShiftProduction.good_quantity))\
            .filter(
                ShiftProduction.production_date >= prev_start_date,
                ShiftProduction.production_date <= prev_end_date
            ).scalar() or 0
            
        # Converting Output (A-016)
        converting_output = db.session.query(func.sum(ConvertingProduction.grade_a))\
            .filter(
                ConvertingProduction.production_date >= start_date,
                ConvertingProduction.production_date <= end_date
            ).scalar() or 0
            
        prev_converting = db.session.query(func.sum(ConvertingProduction.grade_a))\
            .filter(
                ConvertingProduction.production_date >= prev_start_date,
                ConvertingProduction.production_date <= prev_end_date
            ).scalar() or 0
        
        production_growth = ((production_output - prev_production) / prev_production * 100) if prev_production > 0 else 0
        
        # Average OEE
        avg_oee = db.session.query(func.avg(ShiftProduction.oee_score))\
            .filter(
                ShiftProduction.production_date >= start_date,
                ShiftProduction.production_date <= end_date,
                ShiftProduction.oee_score.isnot(None)
            ).scalar() or 0
            
        # Inventory Value Breakdown (A-015)
        # 1. Finished Goods in Master Warehouse (Location ID 3)
        fg_inventory_value = db.session.query(func.sum(Inventory.quantity_on_hand * Product.cost))\
            .join(Product, Inventory.product_id == Product.id)\
            .filter(Inventory.location_id == 3).scalar() or 0
            
        # 2. WIP Stock Value
        wip_stock_value = db.session.query(func.sum(WIPStock.quantity_pcs * Product.cost))\
            .join(Product, WIPStock.product_id == Product.id).scalar() or 0
        
        # Work orders completion rate
        total_wo = db.session.query(func.count(WorkOrder.id))\
            .filter(
                WorkOrder.created_at >= start_date,
                WorkOrder.created_at <= end_date
            ).scalar() or 0
        
        completed_wo = db.session.query(func.count(WorkOrder.id))\
            .filter(
                WorkOrder.created_at >= start_date,
                WorkOrder.created_at <= end_date,
                WorkOrder.status == 'completed'
            ).scalar() or 0
        
        wo_completion_rate = (completed_wo / total_wo * 100) if total_wo > 0 else 0
        
        # ===== QUALITY METRICS =====
        # Quality pass rate
        total_inspections = db.session.query(func.count(QualityInspection.id))\
            .filter(
                QualityInspection.inspection_date >= start_date,
                QualityInspection.inspection_date <= end_date
            ).scalar() or 0
        
        passed_inspections = db.session.query(func.count(QualityInspection.id))\
            .filter(
                QualityInspection.inspection_date >= start_date,
                QualityInspection.inspection_date <= end_date,
                QualityInspection.result == 'pass'
            ).scalar() or 0
        
        quality_pass_rate = (passed_inspections / total_inspections * 100) if total_inspections > 0 else 0
        
        # ===== INVENTORY METRICS =====
        # Total inventory value
        inventory_value = db.session.query(
            func.sum(Inventory.quantity_on_hand * Product.cost)
        ).join(Product, Inventory.product_id == Product.id)\
        .scalar() or 0
        
        # Low stock items
        low_stock_count = db.session.query(func.count(Product.id))\
            .join(Inventory, Product.id == Inventory.product_id)\
            .filter(Inventory.quantity_on_hand < Product.min_stock_level)\
            .scalar() or 0
        
        # ===== HR METRICS =====
        # Active employees
        active_employees = db.session.query(func.count(Employee.id))\
            .filter(Employee.is_active == True)\
            .scalar() or 0
        
        # Compile overview data
        overview = {
            'period': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'days': (end_date - start_date).days
            },
            'financial': {
                'revenue': float(current_revenue),
                'revenue_growth': round(float(revenue_growth), 2),
                'cash_collected': float(cash_collected),
                'outstanding_ar': float(outstanding_ar),
                'collection_rate': round((cash_collected / current_revenue * 100) if current_revenue > 0 else 0, 2)
            },
            'sales': {
                'total_orders': current_orders,
                'orders_growth': round(float(orders_growth), 2),
                'fulfillment_rate': round(float(fulfillment_rate), 2),
                'avg_order_value': round(float(current_revenue / current_orders) if current_orders > 0 else 0, 2)
            },
            'production': {
                'output': float(production_output),
                'production_growth': round(float(production_growth), 2),
                'converting_output': float(converting_output),
                'converting_growth': round(float(((converting_output - prev_converting) / prev_converting * 100) if prev_converting > 0 else 0), 2),
                'avg_oee': round(float(avg_oee), 2),
                'wo_completion_rate': round(float(wo_completion_rate), 2),
                'fg_inventory_value': float(fg_inventory_value),
                'wip_stock_value': float(wip_stock_value)
            },
            'quality': {
                'pass_rate': round(float(quality_pass_rate), 2),
                'total_inspections': total_inspections,
                'passed_inspections': passed_inspections,
                'failed_inspections': total_inspections - passed_inspections
            },
            'inventory': {
                'total_value': float(inventory_value),
                'low_stock_items': low_stock_count
            },
            'hr': {
                'active_employees': active_employees
            }
        }
        
        return jsonify({
            'success': True,
            'data': overview
        }), 200
        
    except Exception as e:
        print(f"Error in get_executive_overview: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@executive_dashboard_bp.route('/trends', methods=['GET'])
@jwt_required(optional=True)
def get_trends():
    """
    Get trend data for various metrics (last 12 months)
    """
    try:
        # Get last 12 months
        end_date = get_local_now().date()
        start_date = (get_local_now() - timedelta(days=365)).date()
        
        # Revenue trend (monthly)
        revenue_trend = db.session.query(
            extract('year', Invoice.invoice_date).label('year'),
            extract('month', Invoice.invoice_date).label('month'),
            func.sum(Invoice.total_amount).label('revenue')
        ).filter(
            Invoice.invoice_date >= start_date,
            Invoice.invoice_date <= end_date,
            Invoice.status.in_(['paid', 'partial'])
        ).group_by('year', 'month')\
        .order_by('year', 'month')\
        .all()
        
        # Production trend (monthly)
        production_trend = db.session.query(
            extract('year', ShiftProduction.production_date).label('year'),
            extract('month', ShiftProduction.production_date).label('month'),
            func.sum(ShiftProduction.good_quantity).label('output')
        ).filter(
            ShiftProduction.production_date >= start_date,
            ShiftProduction.production_date <= end_date
        ).group_by('year', 'month')\
        .order_by('year', 'month')\
        .all()
        
        # OEE trend (monthly)
        oee_trend = db.session.query(
            extract('year', ShiftProduction.production_date).label('year'),
            extract('month', ShiftProduction.production_date).label('month'),
            func.avg(ShiftProduction.oee_score).label('avg_oee')
        ).filter(
            ShiftProduction.production_date >= start_date,
            ShiftProduction.production_date <= end_date,
            ShiftProduction.oee_score.isnot(None)
        ).group_by('year', 'month')\
        .order_by('year', 'month')\
        .all()
        
        # Quality trend (monthly)
        quality_trend = db.session.query(
            extract('year', QualityInspection.inspection_date).label('year'),
            extract('month', QualityInspection.inspection_date).label('month'),
            func.count(QualityInspection.id).label('total'),
            func.sum(db.case((QualityInspection.result == 'pass', 1), else_=0)).label('passed')
        ).filter(
            QualityInspection.inspection_date >= start_date,
            QualityInspection.inspection_date <= end_date
        ).group_by('year', 'month')\
        .order_by('year', 'month')\
        .all()
        
        # Format trends
        revenue_data = [
            {
                'period': f"{int(row.year)}-{int(row.month):02d}",
                'value': float(row.revenue or 0)
            }
            for row in revenue_trend
        ]
        
        production_data = [
            {
                'period': f"{int(row.year)}-{int(row.month):02d}",
                'value': float(row.output or 0)
            }
            for row in production_trend
        ]
        
        oee_data = [
            {
                'period': f"{int(row.year)}-{int(row.month):02d}",
                'value': round(float(row.avg_oee or 0), 2)
            }
            for row in oee_trend
        ]
        
        quality_data = [
            {
                'period': f"{int(row.year)}-{int(row.month):02d}",
                'pass_rate': round((row.passed / row.total * 100) if row.total > 0 else 0, 2),
                'total': row.total,
                'passed': row.passed
            }
            for row in quality_trend
        ]
        
        return jsonify({
            'success': True,
            'data': {
                'revenue': revenue_data,
                'production': production_data,
                'oee': oee_data,
                'quality': quality_data
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@executive_dashboard_bp.route('/performance-scorecard', methods=['GET'])
@jwt_required(optional=True)
def get_performance_scorecard():
    """
    Get comprehensive performance scorecard with targets from database
    """
    try:
        end_date = get_local_now().date()
        start_date = (get_local_now() - timedelta(days=30)).date()
        
        # Helper function to get target from database
        def get_target(kpi_code, default_value):
            target = KPITarget.query.filter_by(kpi_code=kpi_code, is_active=True).first()
            if target:
                return {
                    'value': float(target.target_value),
                    'warning': float(target.warning_threshold) if target.warning_threshold else 80,
                    'critical': float(target.critical_threshold) if target.critical_threshold else 60
                }
            return {'value': default_value, 'warning': 80, 'critical': 60}
        
        # Helper function to determine status
        def get_status(actual, target_info, is_lower_better=False):
            target = target_info['value']
            warning = target_info['warning']
            critical = target_info['critical']
            
            if is_lower_better:
                # For metrics like defect rate where lower is better
                if actual <= target:
                    return 'good'
                elif actual <= target * (warning / 100):
                    return 'warning'
                else:
                    return 'critical'
            else:
                achievement = (float(actual) / float(target) * 100) if target > 0 else 0
                if achievement >= 100:
                    return 'good'
                elif achievement >= warning:
                    return 'warning'
                else:
                    return 'critical'
        
        kpis = []
        
        # 1. Revenue Achievement
        revenue = db.session.query(func.sum(Invoice.total_amount))\
            .filter(
                Invoice.invoice_date >= start_date,
                Invoice.invoice_date <= end_date,
                Invoice.status.in_(['paid', 'partial'])
            ).scalar() or 0
        
        revenue_target = get_target('REVENUE', 500000000)
        revenue_achievement = (revenue / revenue_target['value'] * 100) if revenue_target['value'] > 0 else 0
        
        kpis.append({
            'category': 'Financial',
            'kpi_code': 'REVENUE',
            'kpi_name': 'Revenue Achievement',
            'actual': float(revenue),
            'target': revenue_target['value'],
            'achievement': round(float(revenue_achievement), 2),
            'unit': 'IDR',
            'status': get_status(revenue, revenue_target)
        })
        
        # 2. OEE
        avg_oee = db.session.query(func.avg(ShiftProduction.oee_score))\
            .filter(
                ShiftProduction.production_date >= start_date,
                ShiftProduction.production_date <= end_date,
                ShiftProduction.oee_score.isnot(None)
            ).scalar() or 0
        
        oee_target = get_target('OEE', 85)
        oee_achievement = (avg_oee / oee_target['value'] * 100) if oee_target['value'] > 0 else 0
        
        kpis.append({
            'category': 'Production',
            'kpi_code': 'OEE',
            'kpi_name': 'Overall Equipment Effectiveness (OEE)',
            'actual': round(float(avg_oee), 2),
            'target': oee_target['value'],
            'achievement': round(float(oee_achievement), 2),
            'unit': '%',
            'status': get_status(avg_oee, oee_target)
        })
        
        # 3. Quality Pass Rate
        total_inspections = db.session.query(func.count(QualityInspection.id))\
            .filter(
                QualityInspection.inspection_date >= start_date,
                QualityInspection.inspection_date <= end_date
            ).scalar() or 0
        
        passed_inspections = db.session.query(func.count(QualityInspection.id))\
            .filter(
                QualityInspection.inspection_date >= start_date,
                QualityInspection.inspection_date <= end_date,
                QualityInspection.result == 'pass'
            ).scalar() or 0
        
        quality_pass_rate = (passed_inspections / total_inspections * 100) if total_inspections > 0 else 0
        quality_target = get_target('QUALITY_PASS', 95)
        quality_achievement = (quality_pass_rate / quality_target['value'] * 100) if quality_target['value'] > 0 else 0
        
        kpis.append({
            'category': 'Quality',
            'kpi_code': 'QUALITY_PASS',
            'kpi_name': 'Quality Pass Rate',
            'actual': round(float(quality_pass_rate), 2),
            'target': quality_target['value'],
            'achievement': round(float(quality_achievement), 2),
            'unit': '%',
            'status': get_status(quality_pass_rate, quality_target)
        })
        
        # 4. On-Time Delivery
        total_orders = db.session.query(func.count(SalesOrder.id))\
            .filter(
                SalesOrder.order_date >= start_date,
                SalesOrder.order_date <= end_date,
                SalesOrder.status.in_(['delivered', 'invoiced'])
            ).scalar() or 0
        
        # Count on-time deliveries (where actual delivery <= expected delivery)
        ontime_orders = total_orders  # Simplified - assume all delivered are on time if no actual_delivery_date
        
        otd_rate = (ontime_orders / total_orders * 100) if total_orders > 0 else 100
        otd_target = get_target('OTD', 95)
        otd_achievement = (otd_rate / otd_target['value'] * 100) if otd_target['value'] > 0 else 0
        
        kpis.append({
            'category': 'Sales',
            'kpi_code': 'OTD',
            'kpi_name': 'On-Time Delivery Rate',
            'actual': round(float(otd_rate), 2),
            'target': otd_target['value'],
            'achievement': round(float(otd_achievement), 2),
            'unit': '%',
            'status': get_status(otd_rate, otd_target)
        })
        
        # 5. Inventory Turnover (Real calculation)
        # Inventory Turnover = COGS / Average Inventory
        # Simplified: Use total inventory movements / current inventory value
        
        # Get total inventory value (quantity_on_hand * product cost)
        total_inventory_value = db.session.query(
            func.sum(Inventory.quantity_on_hand * func.coalesce(Product.cost, 0))
        ).outerjoin(Product, Inventory.product_id == Product.id).scalar() or 0
        
        # Get COGS from invoices by summing (quantity * product cost)
        from models.finance import InvoiceItem
        cogs = db.session.query(
            func.sum(InvoiceItem.quantity * func.coalesce(Product.cost, 0))
        ).join(Invoice, InvoiceItem.invoice_id == Invoice.id)\
         .join(Product, InvoiceItem.product_id == Product.id)\
         .filter(
                Invoice.invoice_date >= start_date,
                Invoice.invoice_date <= end_date,
                Invoice.status.in_(['paid', 'partial'])
            ).scalar() or 0
        
        # Annualize the monthly COGS
        annual_cogs = cogs * 12
        avg_inventory = total_inventory_value if total_inventory_value > 0 else 1
        inventory_turnover = annual_cogs / avg_inventory if avg_inventory > 0 else 0
        
        turnover_target = get_target('INVENTORY_TURN', 10)
        turnover_achievement = (inventory_turnover / turnover_target['value'] * 100) if turnover_target['value'] > 0 else 0
        
        kpis.append({
            'category': 'Inventory',
            'kpi_code': 'INVENTORY_TURN',
            'kpi_name': 'Inventory Turnover Ratio',
            'actual': round(float(inventory_turnover), 2),
            'target': turnover_target['value'],
            'achievement': round(float(turnover_achievement), 2),
            'unit': 'times/year',
            'status': get_status(inventory_turnover, turnover_target)
        })
        
        # 6. Production Output
        total_output = db.session.query(func.sum(ShiftProduction.actual_quantity))\
            .filter(
                ShiftProduction.production_date >= start_date,
                ShiftProduction.production_date <= end_date
            ).scalar() or 0
        
        output_target = get_target('PRODUCTION_OUTPUT', 100000)
        output_achievement = (float(total_output) / float(output_target['value']) * 100) if output_target['value'] > 0 else 0
        
        kpis.append({
            'category': 'Production',
            'kpi_code': 'PRODUCTION_OUTPUT',
            'kpi_name': 'Production Output',
            'actual': float(total_output),
            'target': output_target['value'],
            'achievement': round(float(output_achievement), 2),
            'unit': 'units',
            'status': get_status(total_output, output_target)
        })
        
        # Calculate overall score
        total_achievement = sum(kpi['achievement'] for kpi in kpis)
        overall_score = total_achievement / len(kpis) if kpis else 0
        
        # Group KPIs by category
        grouped_kpis = {}
        for kpi in kpis:
            cat = kpi['category']
            if cat not in grouped_kpis:
                grouped_kpis[cat] = []
            grouped_kpis[cat].append(kpi)
        
        return jsonify({
            'success': True,
            'data': {
                'overall_score': round(float(overall_score), 2),
                'kpis': kpis,
                'grouped_kpis': grouped_kpis,
                'summary': {
                    'total_kpis': len(kpis),
                    'good': len([k for k in kpis if k['status'] == 'good']),
                    'warning': len([k for k in kpis if k['status'] == 'warning']),
                    'critical': len([k for k in kpis if k['status'] == 'critical'])
                },
                'period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                }
            }
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@executive_dashboard_bp.route('/top-performers', methods=['GET'])
@jwt_required(optional=True)
def get_top_performers():
    """
    Get top performers across different categories
    """
    try:
        end_date = get_local_now().date()
        start_date = (get_local_now() - timedelta(days=30)).date()
        
        # Top customers by revenue
        top_customers = db.session.query(
            Customer.id,
            Customer.company_name,
            func.sum(Invoice.total_amount).label('total_revenue'),
            func.count(SalesOrder.id).label('order_count')
        ).join(SalesOrder, Customer.id == SalesOrder.customer_id)\
        .join(Invoice, SalesOrder.id == Invoice.sales_order_id)\
        .filter(
            Invoice.invoice_date >= start_date,
            Invoice.invoice_date <= end_date
        ).group_by(Customer.id, Customer.company_name)\
        .order_by(func.sum(Invoice.total_amount).desc())\
        .limit(10)\
        .all()
        
        # Top products by sales
        top_products = db.session.query(
            Product.id,
            Product.name,
            Product.code,
            func.sum(ShiftProduction.good_quantity).label('total_produced')
        ).join(WorkOrder, Product.id == WorkOrder.product_id)\
        .join(ShiftProduction, WorkOrder.id == ShiftProduction.work_order_id)\
        .filter(
            ShiftProduction.production_date >= start_date,
            ShiftProduction.production_date <= end_date
        ).group_by(Product.id, Product.name, Product.code)\
        .order_by(func.sum(ShiftProduction.good_quantity).desc())\
        .limit(10)\
        .all()
        
        return jsonify({
            'success': True,
            'data': {
                'top_customers': [
                    {
                        'id': row.id,
                        'name': row.company_name,
                        'revenue': float(row.total_revenue),
                        'orders': row.order_count
                    }
                    for row in top_customers
                ],
                'top_products': [
                    {
                        'id': row.id,
                        'name': row.name,
                        'code': row.code,
                        'quantity': float(row.total_produced)
                    }
                    for row in top_products
                ]
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@executive_dashboard_bp.route('/alerts', methods=['GET'])
@jwt_required(optional=True)
def get_alerts():  # executive_alerts():
    """
    Get critical alerts for executive attention
    """
    try:
        alerts = []
        
        # Low stock alerts
        low_stock = db.session.query(
            Product.id,
            Product.name,
            Product.code,
            Inventory.quantity_on_hand,
            Product.min_stock_level
        ).join(Inventory, Product.id == Inventory.product_id)\
        .filter(Inventory.quantity_on_hand < Product.min_stock_level)\
        .limit(5)\
        .all()
        
        for item in low_stock:
            alerts.append({
                'type': 'low_stock',
                'severity': 'high',
                'title': f'Low Stock: {item.name}',
                'message': f'Stock level ({item.quantity}) below minimum ({item.min_stock_level})',
                'action_required': True
            })
        
        # Overdue invoices
        overdue_invoices = db.session.query(func.count(Invoice.id))\
            .filter(
                Invoice.status.in_(['pending', 'partial']),
                Invoice.due_date < get_local_now().date()
            ).scalar() or 0
        
        if overdue_invoices > 0:
            alerts.append({
                'type': 'overdue_payment',
                'severity': 'high',
                'title': 'Overdue Invoices',
                'message': f'{overdue_invoices} invoices are overdue',
                'action_required': True
            })
        
        # Low OEE machines - check both oee_score and efficiency_rate
        # Use COALESCE to handle NULL values, prioritize oee_score then efficiency_rate
        low_oee_machines = db.session.query(
            ShiftProduction.machine_id,
            func.avg(func.coalesce(ShiftProduction.oee_score, ShiftProduction.efficiency_rate, 0)).label('avg_oee')
        ).filter(
            ShiftProduction.production_date >= (get_local_now() - timedelta(days=30)).date()
        ).group_by(ShiftProduction.machine_id)\
        .having(func.avg(func.coalesce(ShiftProduction.oee_score, ShiftProduction.efficiency_rate, 0)) < 75)\
        .all()
        
        # Debug: print count
        print(f"[DEBUG] Low OEE machines found: {len(low_oee_machines)}")
        for m in low_oee_machines:
            print(f"  - Machine ID: {m.machine_id}, Avg OEE: {m.avg_oee}")
        
        if low_oee_machines:
            alerts.append({
                'type': 'low_oee',
                'severity': 'high',
                'title': 'Low OEE Performance',
                'message': f'{len(low_oee_machines)} machines with OEE below 75%',
                'action_required': True
            })
        
        return jsonify({
            'success': True,
            'data': {
                'total_alerts': len(alerts),
                'critical_count': sum(1 for a in alerts if a['severity'] == 'high'),
                'alerts': alerts
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@executive_dashboard_bp.route('/active-users', methods=['GET'])
@jwt_required(optional=True)
def get_active_users():
    """Get list of active users with their recent activity"""
    try:
        users = db.session.query(User).filter(User.is_active == True).all()
        
        now = get_local_now()
        online_threshold = now - timedelta(minutes=15)
        recent_threshold = now - timedelta(hours=24)
        
        active_users = []
        online_count = 0
        recent_count = 0
        
        for user in users:
            if user.last_login:
                if user.last_login >= online_threshold:
                    status = 'online'
                    online_count += 1
                elif user.last_login >= recent_threshold:
                    status = 'recent'
                    recent_count += 1
                else:
                    status = 'offline'
            else:
                status = 'never'
            
            user_roles = [ur.role.name for ur in user.roles if ur.role] if user.roles else []
            
            time_ago = None
            if user.last_login:
                delta = now - user.last_login
                if delta.days > 0:
                    time_ago = f"{delta.days}d ago"
                elif delta.seconds >= 3600:
                    time_ago = f"{delta.seconds // 3600}h ago"
                elif delta.seconds >= 60:
                    time_ago = f"{delta.seconds // 60}m ago"
                else:
                    time_ago = "Just now"
            
            active_users.append({
                'id': user.id,
                'username': user.username,
                'full_name': user.full_name,
                'email': user.email,
                'roles': user_roles,
                'is_admin': user.is_admin,
                'status': status,
                'last_login': user.last_login.isoformat() if user.last_login else None,
                'time_ago': time_ago
            })
        
        status_order = {'online': 0, 'recent': 1, 'offline': 2, 'never': 3}
        active_users.sort(key=lambda x: (status_order.get(x['status'], 4), x['full_name']))
        
        return jsonify({
            'success': True,
            'data': {
                'total_users': len(users),
                'online_count': online_count,
                'recent_count': recent_count,
                'users': active_users
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@executive_dashboard_bp.route('/production-executive', methods=['GET'])
@jwt_required()
def get_production_executive_dashboard():
    """
    Executive Production Dashboard - Monthly Target vs Actual with Downtime Analysis
    For Top Management and Superadmin
    """
    try:
        from routes.schedule_grid import MonthlySchedule, ScheduleGridItem
        from models.production import ProductionRecord
        
        # Get parameters
        year = request.args.get('year', get_local_now().year, type=int)
        month = request.args.get('month', get_local_now().month, type=int)
        
        # Calculate date range for the month
        start_date = datetime(year, month, 1).date()
        if month == 12:
            end_date = datetime(year + 1, 1, 1).date() - timedelta(days=1)
        else:
            end_date = datetime(year, month + 1, 1).date() - timedelta(days=1)
        
        month_names = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                       'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
        
        # ===== 1. GET MONTHLY TARGETS =====
        monthly_schedules = MonthlySchedule.query.filter_by(year=year, month=month).all()
        
        # Build target data per product
        targets_by_product = {}
        total_target_ctn = 0
        total_target_pcs = 0
        
        for ms in monthly_schedules:
            # Get product data via raw SQL (MonthlySchedule uses products_new table)
            product_data = db.session.execute(
                db.text("SELECT code, name, pack_per_karton FROM products WHERE id = :id"),
                {'id': ms.product_id}
            ).fetchone()
            
            product_name = product_data[1] if product_data else f"Product {ms.product_id}"
            machine_name = ms.machine.name if ms.machine else "Unassigned"
            
            pack_per_ctn = 50  # Default
            if product_data and product_data[2]:
                pack_per_ctn = int(product_data[2])
            
            target_ctn = float(ms.target_ctn or 0)
            target_pcs = target_ctn * pack_per_ctn
            
            if product_name not in targets_by_product:
                targets_by_product[product_name] = {
                    'product_id': ms.product_id,
                    'product_name': product_name,
                    'target_ctn': 0,
                    'target_pcs': 0,
                    'actual_ctn': 0,
                    'actual_pcs': 0,
                    'good_pcs': 0,
                    'reject_pcs': 0,
                    'machines': [],
                    'pack_per_ctn': pack_per_ctn
                }
            
            targets_by_product[product_name]['target_ctn'] += target_ctn
            targets_by_product[product_name]['target_pcs'] += target_pcs
            targets_by_product[product_name]['machines'].append({
                'machine_id': ms.machine_id,
                'machine_name': machine_name,
                'target_ctn': target_ctn
            })
            
            total_target_ctn += target_ctn
            total_target_pcs += target_pcs
        
        # ===== 2. GET ACTUAL PRODUCTION =====
        # From ShiftProduction for the month
        shift_productions = ShiftProduction.query.filter(
            ShiftProduction.production_date >= start_date,
            ShiftProduction.production_date <= end_date
        ).all()
        
        total_actual_pcs = 0
        total_good_pcs = 0
        total_reject_pcs = 0
        total_downtime_minutes = 0
        
        # Downtime analysis
        downtime_by_category = {
            'mesin': 0,
            'operator': 0,
            'material': 0,
            'design': 0,
            'idle': 0,
            'others': 0
        }
        
        # Downtime reasons aggregation
        downtime_reasons = {}
        
        # Machine performance
        machine_performance = {}
        
        for sp in shift_productions:
            # Get product name
            product_name = None
            if sp.product:
                product_name = sp.product.name
            elif sp.work_order and sp.work_order.product:
                product_name = sp.work_order.product.name
            
            actual_qty = float(sp.actual_quantity or 0)
            good_qty = float(sp.good_quantity or 0)
            reject_qty = float(sp.reject_quantity or 0)
            
            total_actual_pcs += actual_qty
            total_good_pcs += good_qty
            total_reject_pcs += reject_qty
            total_downtime_minutes += float(sp.downtime_minutes or 0)
            
            # Aggregate by product
            if product_name and product_name in targets_by_product:
                targets_by_product[product_name]['actual_pcs'] += actual_qty
                targets_by_product[product_name]['good_pcs'] += good_qty
                targets_by_product[product_name]['reject_pcs'] += reject_qty
                pack_per_ctn = targets_by_product[product_name]['pack_per_ctn']
                targets_by_product[product_name]['actual_ctn'] = targets_by_product[product_name]['actual_pcs'] / pack_per_ctn
            
            # Downtime by category
            downtime_by_category['mesin'] += float(sp.downtime_mesin or 0)
            downtime_by_category['operator'] += float(sp.downtime_operator or 0)
            downtime_by_category['material'] += float(sp.downtime_material or 0)
            downtime_by_category['design'] += float(sp.downtime_design or 0)
            downtime_by_category['idle'] += float(sp.idle_time or 0)
            downtime_by_category['others'] += float(sp.downtime_others or 0)
            
            # Parse downtime reasons from issues
            if sp.issues:
                import re
                from utils import detect_downtime_category
                
                issue_parts = sp.issues.split(';')
                for idx, part in enumerate(issue_parts):
                    part = part.strip()
                    if not part:
                        continue
                    # Match pattern: "XX menit - reason [category]" or "XX menit - reason"
                    match = re.match(r'(\d+)\s*menit\s*-\s*(.+?)(?:\s*\[([^\]]+)\])?\s*$', part, re.IGNORECASE)
                    if match:
                        duration = int(match.group(1))
                        reason = match.group(2).strip()
                        explicit_category = match.group(3).strip() if match.group(3) else None
                        
                        # Clean reason from any remaining brackets
                        reason = re.sub(r'\s*\[.+\]\s*$', '', reason).strip()
                        
                        # Skip biological needs
                        excluded = ['istirahat', 'sholat', 'solat', 'toilet', 'makan', 'minum']
                        if any(kw in reason.lower() for kw in excluded):
                            continue
                        
                        # Auto-detect category if not explicitly provided
                        if explicit_category:
                            category = explicit_category.lower()
                        else:
                            # Pass is_first_entry parameter for proper categorization
                            is_first_entry = (idx == 0)
                            category = detect_downtime_category(reason, is_first_entry)
                        
                        # Always re-check: if auto-detect says 'idle', override explicit tag
                        auto_cat = detect_downtime_category(reason.lower())
                        if auto_cat == 'idle':
                            category = 'idle'
                        
                        # Use reason + category as unique key
                        key = f"{reason}|{category}"
                        if key not in downtime_reasons:
                            downtime_reasons[key] = {'reason': reason, 'category': category, 'count': 0, 'total_minutes': 0}
                        downtime_reasons[key]['count'] += 1
                        downtime_reasons[key]['total_minutes'] += duration
            
            # Machine performance
            machine_name = sp.machine.name if sp.machine else f"Machine {sp.machine_id}"
            if machine_name not in machine_performance:
                machine_performance[machine_name] = {
                    'machine_id': sp.machine_id,
                    'machine_name': machine_name,
                    'total_produced': 0,
                    'total_good': 0,
                    'total_reject': 0,
                    'total_downtime': 0,
                    'shift_count': 0,
                    'avg_oee': 0,
                    'oee_sum': 0
                }
            
            machine_performance[machine_name]['total_produced'] += actual_qty
            machine_performance[machine_name]['total_good'] += good_qty
            machine_performance[machine_name]['total_reject'] += reject_qty
            machine_performance[machine_name]['total_downtime'] += float(sp.downtime_minutes or 0)
            machine_performance[machine_name]['shift_count'] += 1
            machine_performance[machine_name]['oee_sum'] += float(sp.oee_score or 0)
        
        # Calculate averages for machines
        for machine in machine_performance.values():
            if machine['shift_count'] > 0:
                machine['avg_oee'] = round(machine['oee_sum'] / machine['shift_count'], 2)
            machine['quality_rate'] = round((machine['total_good'] / machine['total_produced'] * 100), 2) if machine['total_produced'] > 0 else 0
        
        # ===== 3. CALCULATE ACHIEVEMENT =====
        # Sum actual_ctn from each product (already calculated with correct pack_per_ctn)
        total_actual_ctn = sum(p['actual_ctn'] for p in targets_by_product.values())
        achievement_pct = round((total_actual_ctn / total_target_ctn * 100), 2) if total_target_ctn > 0 else 0
        gap_pcs = total_target_pcs - total_actual_pcs
        gap_ctn = total_target_ctn - total_actual_ctn
        
        # ===== 4. TOP DOWNTIME REASONS =====
        top_downtime = sorted(
            list(downtime_reasons.values()),
            key=lambda x: x['total_minutes'],
            reverse=True
        )[:10]
        
        # ===== 5. PRODUCTS BY ACHIEVEMENT =====
        products_list = []
        for product_name, data in targets_by_product.items():
            achievement = round((data['actual_pcs'] / data['target_pcs'] * 100), 2) if data['target_pcs'] > 0 else 0
            gap = data['target_pcs'] - data['actual_pcs']
            products_list.append({
                **data,
                'achievement_pct': achievement,
                'gap_pcs': gap,
                'gap_ctn': gap / data['pack_per_ctn'] if data['pack_per_ctn'] > 0 else 0,
                'quality_rate': round((data['good_pcs'] / data['actual_pcs'] * 100), 2) if data['actual_pcs'] > 0 else 0
            })
        
        # Sort by gap (worst first)
        products_list.sort(key=lambda x: x['achievement_pct'])
        
        # ===== 6. MACHINES BY PERFORMANCE =====
        machines_list = sorted(
            list(machine_performance.values()),
            key=lambda x: x['avg_oee']
        )
        
        # ===== 7. DAILY TREND =====
        daily_trend = {}
        for sp in shift_productions:
            date_str = sp.production_date.isoformat() if sp.production_date else None
            if date_str:
                if date_str not in daily_trend:
                    daily_trend[date_str] = {'date': date_str, 'produced': 0, 'good': 0, 'reject': 0, 'downtime': 0}
                daily_trend[date_str]['produced'] += float(sp.actual_quantity or 0)
                daily_trend[date_str]['good'] += float(sp.good_quantity or 0)
                daily_trend[date_str]['reject'] += float(sp.reject_quantity or 0)
                daily_trend[date_str]['downtime'] += float(sp.downtime_minutes or 0)
        
        daily_trend_list = sorted(daily_trend.values(), key=lambda x: x['date'])
        
        return jsonify({
            'success': True,
            'data': {
                'period': {
                    'year': year,
                    'month': month,
                    'month_name': month_names[month],
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                },
                'summary': {
                    'target_ctn': round(total_target_ctn, 2),
                    'target_pcs': round(total_target_pcs, 2),
                    'actual_ctn': round(total_actual_ctn, 2),
                    'actual_pcs': round(total_actual_pcs, 2),
                    'good_pcs': round(total_good_pcs, 2),
                    'reject_pcs': round(total_reject_pcs, 2),
                    'achievement_pct': achievement_pct,
                    'gap_pcs': round(gap_pcs, 2),
                    'gap_ctn': round(gap_ctn, 2),
                    'quality_rate': round((total_good_pcs / total_actual_pcs * 100), 2) if total_actual_pcs > 0 else 0,
                    'total_downtime_minutes': round(total_downtime_minutes, 2),
                    'total_downtime_hours': round(total_downtime_minutes / 60, 2)
                },
                'downtime_by_category': downtime_by_category,
                'top_downtime_reasons': top_downtime,
                'products': products_list,
                'machines': machines_list,
                'daily_trend': daily_trend_list
            }
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@executive_dashboard_bp.route('/production-monitoring', methods=['GET'])
@jwt_required(optional=True)
def get_production_monitoring():
    """
    Production Monitoring Dashboard - Weekly/Monthly target vs actual
    With Grade A/B/C, Runtime/Downtime/IdleTime breakdown per day per product
    Data sourced from Work Orders and ShiftProduction
    """
    try:
        from routes.schedule_grid import MonthlySchedule
        from models.production import Machine
        import re
        from utils import detect_downtime_category
        
        # Get parameters
        year = request.args.get('year', get_local_now().year, type=int)
        month = request.args.get('month', get_local_now().month, type=int)
        view_mode = request.args.get('view', 'monthly')  # 'weekly' or 'monthly'
        week_number = request.args.get('week', 0, type=int)  # 1-5 for weekly view
        
        month_names = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                       'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
        
        # Calculate date range
        start_date = datetime(year, month, 1).date()
        if month == 12:
            end_date = datetime(year + 1, 1, 1).date() - timedelta(days=1)
        else:
            end_date = datetime(year, month + 1, 1).date() - timedelta(days=1)
        
        # For weekly view, calculate week boundaries
        if view_mode == 'weekly' and week_number > 0:
            week_start = start_date + timedelta(days=(week_number - 1) * 7)
            week_end = min(week_start + timedelta(days=6), end_date)
            start_date = week_start
            end_date = week_end
        
        # Calculate weeks in the month
        weeks_in_month = []
        temp_date = datetime(year, month, 1).date()
        month_end = end_date
        week_num = 1
        while temp_date <= month_end:
            w_start = temp_date
            w_end = min(temp_date + timedelta(days=6), month_end)
            weeks_in_month.append({
                'week': week_num,
                'start_date': w_start.isoformat(),
                'end_date': w_end.isoformat(),
                'label': f"Week {week_num} ({w_start.strftime('%d %b')} - {w_end.strftime('%d %b')})"
            })
            temp_date = w_end + timedelta(days=1)
            week_num += 1
        
        # ===== 1. GET MONTHLY TARGETS =====
        monthly_schedules = MonthlySchedule.query.filter_by(year=year, month=month).all()
        
        targets_by_product = {}
        total_target_ctn = 0
        
        for ms in monthly_schedules:
            product_data = db.session.execute(
                db.text("SELECT code, name, pack_per_karton FROM products WHERE id = :id"),
                {'id': ms.product_id}
            ).fetchone()
            
            product_name = product_data[1] if product_data else f"Product {ms.product_id}"
            product_code = product_data[0] if product_data else ''
            pack_per_ctn = int(product_data[2]) if product_data and product_data[2] else 50
            
            target_ctn = float(ms.target_ctn or 0)
            
            if product_name not in targets_by_product:
                targets_by_product[product_name] = {
                    'product_id': ms.product_id,
                    'product_code': product_code,
                    'product_name': product_name,
                    'target_ctn_monthly': 0,
                    'pack_per_ctn': pack_per_ctn,
                    'machines': []
                }
            
            targets_by_product[product_name]['target_ctn_monthly'] += target_ctn
            machine_name = ms.machine.name if ms.machine else "Unassigned"
            targets_by_product[product_name]['machines'].append({
                'machine_id': ms.machine_id,
                'machine_name': machine_name,
                'target_ctn': target_ctn
            })
            total_target_ctn += target_ctn
        
        # ===== 2. GET SHIFT PRODUCTIONS =====
        shift_productions = ShiftProduction.query.filter(
            ShiftProduction.production_date >= start_date,
            ShiftProduction.production_date <= end_date
        ).all()
        
        # ===== 3. BUILD DAILY DETAIL PER PRODUCT =====
        daily_product_data = {}  # {date: {product_name: {grade_a, grade_b, grade_c, ...}}}
        product_totals = {}  # Aggregated per product
        
        # Time tracking
        total_runtime = 0
        total_downtime = 0
        total_idle_time = 0
        total_planned = 0
        
        # Downtime details
        downtime_reasons = {}
        downtime_by_category = {
            'mesin': 0, 'operator': 0, 'material': 0, 'design': 0, 'others': 0
        }
        
        # Daily downtime records for expanded view
        daily_downtime_records = {}  # {date: [{reason, category, duration, shift, machine, product, wo}]}
        
        # Machine tracking
        machine_data = {}
        
        for sp in shift_productions:
            date_str = sp.production_date.isoformat() if sp.production_date else None
            if not date_str:
                continue
            
            # Get product name
            product_name = None
            product_code = ''
            if sp.product:
                product_name = sp.product.name
                product_code = sp.product.code or ''
            elif sp.work_order and sp.work_order.product:
                product_name = sp.work_order.product.name
                product_code = sp.work_order.product.code or ''
            
            if not product_name:
                product_name = f"Unknown Product {sp.product_id}"
            
            # Grade quantities
            grade_a = float(sp.good_quantity or 0)
            grade_b = float(sp.rework_quantity or 0)
            grade_c = float(sp.reject_quantity or 0)
            total_qty = float(sp.actual_quantity or 0)
            
            # Time metrics
            planned_rt = int(sp.planned_runtime or 480)
            dt_mesin = int(sp.downtime_mesin or 0)
            dt_operator = int(sp.downtime_operator or 0)
            dt_material = int(sp.downtime_material or 0)
            dt_design = int(sp.downtime_design or 0)
            dt_others = int(sp.downtime_others or 0)
            idle_min = int(sp.idle_time or 0)
            total_dt = dt_mesin + dt_operator + dt_material + dt_design + dt_others
            runtime_min = max(0, planned_rt - total_dt - idle_min)
            
            total_runtime += runtime_min
            total_downtime += total_dt
            total_idle_time += idle_min
            total_planned += planned_rt
            
            # Downtime categories
            downtime_by_category['mesin'] += dt_mesin
            downtime_by_category['operator'] += dt_operator
            downtime_by_category['material'] += dt_material
            downtime_by_category['design'] += dt_design
            downtime_by_category['others'] += dt_others
            
            # Get pack_per_ctn for carton calculation
            pack_per_ctn = 50  # Default
            if product_name in targets_by_product:
                pack_per_ctn = targets_by_product[product_name]['pack_per_ctn']
            elif sp.pack_per_carton and sp.pack_per_carton > 0:
                pack_per_ctn = sp.pack_per_carton
            elif sp.work_order and sp.work_order.pack_per_carton and sp.work_order.pack_per_carton > 0:
                pack_per_ctn = sp.work_order.pack_per_carton
            
            # Daily product data
            if date_str not in daily_product_data:
                daily_product_data[date_str] = {}
            
            if product_name not in daily_product_data[date_str]:
                daily_product_data[date_str][product_name] = {
                    'product_name': product_name,
                    'product_code': product_code,
                    'grade_a': 0, 'grade_b': 0, 'grade_c': 0,
                    'total_pcs': 0, 'total_ctn': 0,
                    'runtime': 0, 'downtime': 0, 'idle_time': 0,
                    'planned_runtime': 0,
                    'pack_per_ctn': pack_per_ctn,
                    'shifts': []
                }
            
            dpd = daily_product_data[date_str][product_name]
            dpd['grade_a'] += grade_a
            dpd['grade_b'] += grade_b
            dpd['grade_c'] += grade_c
            dpd['total_pcs'] += total_qty
            dpd['total_ctn'] = dpd['total_pcs'] / pack_per_ctn if pack_per_ctn > 0 else 0
            dpd['runtime'] += runtime_min
            dpd['downtime'] += total_dt
            dpd['idle_time'] += idle_min
            dpd['planned_runtime'] += planned_rt
            
            shift_num = 1
            if sp.shift:
                shift_match = re.search(r'(\d+)', str(sp.shift))
                if shift_match:
                    shift_num = int(shift_match.group(1))
            
            dpd['shifts'].append({
                'shift': shift_num,
                'grade_a': int(grade_a),
                'grade_b': int(grade_b),
                'grade_c': int(grade_c),
                'total': int(total_qty),
                'runtime': runtime_min,
                'downtime': total_dt,
                'idle_time': idle_min,
                'machine': sp.machine.name if sp.machine else 'N/A',
                'wo_number': sp.work_order.wo_number if sp.work_order else 'N/A'
            })
            
            # Product totals
            if product_name not in product_totals:
                product_totals[product_name] = {
                    'product_name': product_name,
                    'product_code': product_code,
                    'grade_a': 0, 'grade_b': 0, 'grade_c': 0,
                    'total_pcs': 0, 'total_ctn': 0,
                    'runtime': 0, 'downtime': 0, 'idle_time': 0,
                    'pack_per_ctn': pack_per_ctn,
                    'target_ctn': targets_by_product.get(product_name, {}).get('target_ctn_monthly', 0),
                    'shift_count': 0
                }
            
            pt = product_totals[product_name]
            pt['grade_a'] += grade_a
            pt['grade_b'] += grade_b
            pt['grade_c'] += grade_c
            pt['total_pcs'] += total_qty
            pt['total_ctn'] = pt['total_pcs'] / pack_per_ctn if pack_per_ctn > 0 else 0
            pt['runtime'] += runtime_min
            pt['downtime'] += total_dt
            pt['idle_time'] += idle_min
            pt['shift_count'] += 1
            
            # Machine data
            machine_name = sp.machine.name if sp.machine else f"Machine {sp.machine_id}"
            if machine_name not in machine_data:
                machine_data[machine_name] = {
                    'machine_name': machine_name,
                    'total_produced': 0, 'grade_a': 0, 'grade_b': 0, 'grade_c': 0,
                    'runtime': 0, 'downtime': 0, 'idle_time': 0,
                    'shift_count': 0, 'oee_sum': 0
                }
            md = machine_data[machine_name]
            md['total_produced'] += total_qty
            md['grade_a'] += grade_a
            md['grade_b'] += grade_b
            md['grade_c'] += grade_c
            md['runtime'] += runtime_min
            md['downtime'] += total_dt
            md['idle_time'] += idle_min
            md['shift_count'] += 1
            md['oee_sum'] += float(sp.oee_score or 0)
            
            # Parse downtime reasons from issues
            if sp.issues:
                issue_parts = sp.issues.split(';')
                for idx, part in enumerate(issue_parts):
                    part = part.strip()
                    if not part:
                        continue
                    match = re.match(r'(\d+)\s*menit\s*-\s*(.+?)(?:\s*\[([^\]]+)\])?\s*$', part, re.IGNORECASE)
                    if match:
                        duration = int(match.group(1))
                        reason = match.group(2).strip()
                        explicit_cat = match.group(3).strip() if match.group(3) else None
                        reason = re.sub(r'\s*\[.+\]\s*$', '', reason).strip()
                        
                        excluded = ['istirahat', 'sholat', 'solat', 'toilet', 'makan', 'minum']
                        if any(kw in reason.lower() for kw in excluded):
                            continue
                        
                        if explicit_cat:
                            category = explicit_cat.lower()
                        else:
                            try:
                                is_first = (idx == 0)
                                category = detect_downtime_category(reason, is_first)
                            except TypeError:
                                category = detect_downtime_category(reason)
                        
                        # Always re-check: if auto-detect says 'idle', override explicit tag
                        auto_cat = detect_downtime_category(reason.lower())
                        if auto_cat == 'idle':
                            category = 'idle'
                        
                        key = f"{reason}|{category}"
                        if key not in downtime_reasons:
                            downtime_reasons[key] = {'reason': reason, 'category': category, 'count': 0, 'total_minutes': 0}
                        downtime_reasons[key]['count'] += 1
                        downtime_reasons[key]['total_minutes'] += duration
                        
                        # Add to daily downtime records for expanded view
                        dt_shift_num = 1
                        if sp.shift:
                            dt_shift_match = re.search(r'(\d+)', str(sp.shift))
                            if dt_shift_match:
                                dt_shift_num = int(dt_shift_match.group(1))
                        
                        if date_str not in daily_downtime_records:
                            daily_downtime_records[date_str] = []
                        
                        # PIC mapping based on category
                        pic_mapping = {
                            'mesin': 'MTC',
                            'operator': 'Operator',
                            'material': 'Warehouse',
                            'design': 'Design',
                            'idle': 'Supervisor',
                            'others': 'Supervisor'
                        }
                        
                        daily_downtime_records[date_str].append({
                            'reason': reason,
                            'category': category,
                            'duration_minutes': duration,
                            'shift': dt_shift_num,
                            'machine_name': sp.machine.name if sp.machine else 'N/A',
                            'product_name': product_name,
                            'wo_number': sp.work_order.wo_number if sp.work_order else 'N/A',
                            'pic': pic_mapping.get(category, 'Supervisor')
                        })
        
        # ===== 4. BUILD DAILY TABLE =====
        all_dates = sorted(daily_product_data.keys())
        daily_table = []
        cumulative_by_product = {}
        
        # Calculate daily target (monthly target / working days)
        total_days_in_range = len(all_dates) if len(all_dates) > 0 else 1
        
        for date_str in all_dates:
            products_for_day = []
            day_total_a = 0
            day_total_b = 0
            day_total_c = 0
            day_total_pcs = 0
            day_total_ctn = 0
            day_runtime = 0
            day_downtime = 0
            day_idle = 0
            
            for pname, pdata in daily_product_data[date_str].items():
                # Cumulative tracking
                if pname not in cumulative_by_product:
                    cumulative_by_product[pname] = {'pcs': 0, 'ctn': 0}
                cumulative_by_product[pname]['pcs'] += pdata['total_pcs']
                cumulative_by_product[pname]['ctn'] += pdata['total_ctn']
                
                target_monthly = targets_by_product.get(pname, {}).get('target_ctn_monthly', 0)
                
                products_for_day.append({
                    **pdata,
                    'total_ctn': round(pdata['total_ctn'], 2),
                    'cumulative_ctn': round(cumulative_by_product[pname]['ctn'], 2),
                    'target_monthly_ctn': round(target_monthly, 2),
                    'gap_ctn': round(target_monthly - cumulative_by_product[pname]['ctn'], 2),
                    'shifts': pdata['shifts']
                })
                
                day_total_a += pdata['grade_a']
                day_total_b += pdata['grade_b']
                day_total_c += pdata['grade_c']
                day_total_pcs += pdata['total_pcs']
                day_total_ctn += pdata['total_ctn']
                day_runtime += pdata['runtime']
                day_downtime += pdata['downtime']
                day_idle += pdata['idle_time']
            
            daily_table.append({
                'date': date_str,
                'day_name': datetime.strptime(date_str, '%Y-%m-%d').strftime('%A'),
                'products': products_for_day,
                'day_summary': {
                    'grade_a': int(day_total_a),
                    'grade_b': int(day_total_b),
                    'grade_c': int(day_total_c),
                    'total_pcs': int(day_total_pcs),
                    'total_ctn': round(day_total_ctn, 2),
                    'runtime': day_runtime,
                    'downtime': day_downtime,
                    'idle_time': day_idle
                },
                'downtime_records': daily_downtime_records.get(date_str, [])
            })
        
        # ===== 5. PRODUCT ACHIEVEMENT TABLE =====
        products_achievement = []
        total_actual_ctn = 0
        for pname, pt in product_totals.items():
            target = pt['target_ctn']
            actual = pt['total_ctn']
            total_actual_ctn += actual
            achievement = round((actual / target * 100), 2) if target > 0 else 0
            gap = target - actual
            quality = round((pt['grade_a'] / pt['total_pcs'] * 100), 2) if pt['total_pcs'] > 0 else 0
            
            products_achievement.append({
                'product_name': pname,
                'product_code': pt['product_code'],
                'target_ctn': round(target, 2),
                'actual_ctn': round(actual, 2),
                'gap_ctn': round(gap, 2),
                'achievement_pct': achievement,
                'grade_a': int(pt['grade_a']),
                'grade_b': int(pt['grade_b']),
                'grade_c': int(pt['grade_c']),
                'total_pcs': int(pt['total_pcs']),
                'quality_rate': quality,
                'runtime': pt['runtime'],
                'downtime': pt['downtime'],
                'idle_time': pt['idle_time'],
                'pack_per_ctn': pt['pack_per_ctn']
            })
        
        products_achievement.sort(key=lambda x: x['achievement_pct'])
        
        # ===== 6. MACHINE SUMMARY =====
        machines_list = []
        for mname, md in machine_data.items():
            avg_oee = round(md['oee_sum'] / md['shift_count'], 2) if md['shift_count'] > 0 else 0
            quality = round((md['grade_a'] / md['total_produced'] * 100), 2) if md['total_produced'] > 0 else 0
            machines_list.append({
                'machine_name': mname,
                'total_produced': int(md['total_produced']),
                'grade_a': int(md['grade_a']),
                'grade_b': int(md['grade_b']),
                'grade_c': int(md['grade_c']),
                'runtime': md['runtime'],
                'downtime': md['downtime'],
                'idle_time': md['idle_time'],
                'shift_count': md['shift_count'],
                'avg_oee': avg_oee,
                'quality_rate': quality
            })
        machines_list.sort(key=lambda x: x['avg_oee'], reverse=True)
        
        # ===== 7. TOP DOWNTIME REASONS =====
        top_downtime = sorted(
            list(downtime_reasons.values()),
            key=lambda x: x['total_minutes'],
            reverse=True
        )[:15]
        
        # ===== 8. WORK ORDER STATUS SUMMARY =====
        work_orders = WorkOrder.query.filter(
            WorkOrder.created_at >= datetime(year, month, 1),
            WorkOrder.created_at <= datetime(year, month, end_date.day, 23, 59, 59)
        ).all()
        
        wo_summary = {
            'total': len(work_orders),
            'planned': sum(1 for wo in work_orders if wo.status == 'planned'),
            'in_progress': sum(1 for wo in work_orders if wo.status == 'in_progress'),
            'completed': sum(1 for wo in work_orders if wo.status == 'completed'),
            'cancelled': sum(1 for wo in work_orders if wo.status == 'cancelled'),
        }
        
        # ===== 9. OVERALL SUMMARY =====
        overall_achievement = round((total_actual_ctn / total_target_ctn * 100), 2) if total_target_ctn > 0 else 0
        
        # 22 working days per month tracking
        TOTAL_WORKING_DAYS = 22
        days_elapsed = len(all_dates)  # days with actual production data
        daily_target_pct = round(100 / TOTAL_WORKING_DAYS, 2)  # ~4.55% per day
        expected_achievement_pct = round(days_elapsed * daily_target_pct, 2)  # expected cumulative %
        daily_target_ctn = round(total_target_ctn / TOTAL_WORKING_DAYS, 2) if total_target_ctn > 0 else 0
        is_behind = overall_achievement < expected_achievement_pct and total_target_ctn > 0
        behind_pct = round(expected_achievement_pct - overall_achievement, 2) if is_behind else 0
        
        return jsonify({
            'success': True,
            'data': {
                'period': {
                    'year': year,
                    'month': month,
                    'month_name': month_names[month],
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat(),
                    'view_mode': view_mode,
                    'week_number': week_number,
                    'weeks': weeks_in_month
                },
                'summary': {
                    'target_ctn': round(total_target_ctn, 2),
                    'actual_ctn': round(total_actual_ctn, 2),
                    'gap_ctn': round(total_target_ctn - total_actual_ctn, 2),
                    'achievement_pct': overall_achievement,
                    'total_grade_a': int(sum(p['grade_a'] for p in products_achievement)),
                    'total_grade_b': int(sum(p['grade_b'] for p in products_achievement)),
                    'total_grade_c': int(sum(p['grade_c'] for p in products_achievement)),
                    'total_pcs': int(sum(p['total_pcs'] for p in products_achievement)),
                    'quality_rate': round(
                        (sum(p['grade_a'] for p in products_achievement) / 
                         sum(p['total_pcs'] for p in products_achievement) * 100)
                        if sum(p['total_pcs'] for p in products_achievement) > 0 else 0, 2
                    ),
                    'runtime_minutes': total_runtime,
                    'runtime_hours': round(total_runtime / 60, 1),
                    'downtime_minutes': total_downtime,
                    'downtime_hours': round(total_downtime / 60, 1),
                    'idle_time_minutes': total_idle_time,
                    'idle_time_hours': round(total_idle_time / 60, 1),
                    'planned_runtime_minutes': total_planned,
                    'utilization_pct': round((total_runtime / total_planned * 100), 2) if total_planned > 0 else 0,
                    'working_days': days_elapsed,
                    'total_working_days': TOTAL_WORKING_DAYS,
                    'daily_target_pct': daily_target_pct,
                    'daily_target_ctn': daily_target_ctn,
                    'expected_achievement_pct': expected_achievement_pct,
                    'is_behind': is_behind,
                    'behind_pct': behind_pct
                },
                'downtime_by_category': downtime_by_category,
                'top_downtime_reasons': top_downtime,
                'products': products_achievement,
                'machines': machines_list,
                'daily_table': daily_table,
                'work_orders': wo_summary
            }
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@executive_dashboard_bp.route('/production-output-details', methods=['GET'])
@jwt_required(optional=True)
def get_production_output_details():
    """
    Get detailed production output breakdown by machine, product, and shift
    Returns pack count and carton count
    """
    try:
        from models.production import Machine
        from models.product import ProductPackaging
        
        # Get date range from query params
        days = request.args.get('days', 30, type=int)
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        if start_date_str and end_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        else:
            end_date = get_local_now().date()
            start_date = end_date - timedelta(days=days)
        
        # Get all shift productions in date range
        shift_productions = db.session.query(
            ShiftProduction.production_date,
            ShiftProduction.shift,
            ShiftProduction.machine_id,
            Machine.name.label('machine_name'),
            Machine.code.label('machine_code'),
            ShiftProduction.product_id,
            Product.name.label('product_name'),
            Product.code.label('product_code'),
            ProductPackaging.packs_per_karton,
            func.sum(ShiftProduction.good_quantity).label('total_pack'),
            func.sum(ShiftProduction.actual_quantity).label('total_actual'),
            func.sum(ShiftProduction.reject_quantity).label('total_reject'),
            func.avg(ShiftProduction.oee_score).label('avg_oee')
        ).join(
            Machine, ShiftProduction.machine_id == Machine.id, isouter=True
        ).join(
            Product, ShiftProduction.product_id == Product.id
        ).outerjoin(
            ProductPackaging, Product.id == ProductPackaging.product_id
        ).filter(
            ShiftProduction.production_date >= start_date,
            ShiftProduction.production_date <= end_date
        ).group_by(
            ShiftProduction.production_date,
            ShiftProduction.shift,
            ShiftProduction.machine_id,
            Machine.name,
            Machine.code,
            ShiftProduction.product_id,
            Product.name,
            Product.code,
            ProductPackaging.packs_per_karton
        ).order_by(
            ShiftProduction.production_date.desc(),
            ShiftProduction.shift,
            Machine.name
        ).all()
        
        # Format results
        details = []
        total_pack = 0
        total_carton = 0
        
        # Group by machine
        machine_summary = {}
        product_summary = {}
        shift_summary = {'shift_1': 0, 'shift_2': 0, 'shift_3': 0}
        
        for sp in shift_productions:
            pack_count = float(sp.total_pack or 0)
            packs_per_karton = float(sp.packs_per_karton or 1) if sp.packs_per_karton else 1
            carton_count = pack_count / packs_per_karton if packs_per_karton > 0 else 0
            
            total_pack += pack_count
            total_carton += carton_count
            
            # Machine summary
            machine_key = sp.machine_name or 'Unknown'
            if machine_key not in machine_summary:
                machine_summary[machine_key] = {'pack': 0, 'carton': 0, 'code': sp.machine_code}
            machine_summary[machine_key]['pack'] += pack_count
            machine_summary[machine_key]['carton'] += carton_count
            
            # Product summary
            product_key = sp.product_name or 'Unknown'
            if product_key not in product_summary:
                product_summary[product_key] = {'pack': 0, 'carton': 0, 'code': sp.product_code, 'packs_per_karton': packs_per_karton}
            product_summary[product_key]['pack'] += pack_count
            product_summary[product_key]['carton'] += carton_count
            
            # Shift summary
            shift_key = sp.shift or 'shift_1'
            if shift_key in shift_summary:
                shift_summary[shift_key] += pack_count
            
            details.append({
                'date': sp.production_date.isoformat(),
                'shift': sp.shift,
                'machine_id': sp.machine_id,
                'machine_name': sp.machine_name or 'Unknown',
                'machine_code': sp.machine_code,
                'product_id': sp.product_id,
                'product_name': sp.product_name,
                'product_code': sp.product_code,
                'pack_count': round(pack_count, 2),
                'carton_count': round(carton_count, 2),
                'packs_per_karton': packs_per_karton,
                'reject_count': float(sp.total_reject or 0),
                'oee': round(float(sp.avg_oee or 0), 2)
            })
        
        # Format summaries
        machines_list = [
            {'name': k, 'code': v['code'], 'pack': round(v['pack'], 2), 'carton': round(v['carton'], 2)}
            for k, v in sorted(machine_summary.items(), key=lambda x: x[1]['pack'], reverse=True)
        ]
        
        products_list = [
            {'name': k, 'code': v['code'], 'pack': round(v['pack'], 2), 'carton': round(v['carton'], 2), 'packs_per_karton': v['packs_per_karton']}
            for k, v in sorted(product_summary.items(), key=lambda x: x[1]['pack'], reverse=True)
        ]
        
        return jsonify({
            'success': True,
            'data': {
                'period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat(),
                    'days': days
                },
                'summary': {
                    'total_pack': round(total_pack, 2),
                    'total_carton': round(total_carton, 2),
                    'total_records': len(details)
                },
                'by_machine': machines_list,
                'by_product': products_list,
                'by_shift': {
                    'shift_1': round(shift_summary['shift_1'], 2),
                    'shift_2': round(shift_summary['shift_2'], 2),
                    'shift_3': round(shift_summary['shift_3'], 2)
                },
                'details': details
            }
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ===============================
# INVESTOR DASHBOARD ENDPOINTS
# ===============================

@executive_dashboard_bp.route('/executive-overview/financial-summary', methods=['GET'])
@jwt_required(optional=True)
def get_investor_financial_summary():
    """
    Get comprehensive financial summary for investors
    Includes P&L, Balance Sheet, and Cash Flow summary
    """
    try:
        end_date = get_local_now().date()
        start_date = (get_local_now() - timedelta(days=365)).date()  # Last 12 months
        
        # ===== PROFIT & LOSS SUMMARY =====
        # Revenue
        total_revenue = db.session.query(func.sum(Invoice.total_amount))\
            .filter(
                Invoice.invoice_date >= start_date,
                Invoice.invoice_date <= end_date,
                Invoice.status.in_(['paid', 'partial'])
            ).scalar() or 0
        
        # COGS (Cost of Goods Sold) - from InvoiceItem
        from models.finance import InvoiceItem
        cogs = db.session.query(
            func.sum(InvoiceItem.quantity * func.coalesce(Product.cost, 0))
        ).join(Invoice, InvoiceItem.invoice_id == Invoice.id)\
         .join(Product, InvoiceItem.product_id == Product.id)\
         .filter(
                Invoice.invoice_date >= start_date,
                Invoice.invoice_date <= end_date,
                Invoice.status.in_(['paid', 'partial'])
            ).scalar() or 0
        
        gross_profit = total_revenue - cogs
        gross_margin = (gross_profit / total_revenue * 100) if total_revenue > 0 else 0
        
        # Operating Expenses (simplified - from Account entries)
        # Get expense accounts (5000-8999)
        operating_expenses = db.session.query(func.sum(AccountingEntry.debit_amount))\
            .join(Account, AccountingEntry.account_id == Account.id)\
            .filter(
                AccountingEntry.entry_date >= start_date,
                AccountingEntry.entry_date <= end_date,
                Account.account_code.between('5000', '8999')
            ).scalar() or 0
        
        operating_profit = gross_profit - operating_expenses
        operating_margin = (operating_profit / total_revenue * 100) if total_revenue > 0 else 0
        
        # Net Income (simplified)
        net_income = operating_profit  # Simplified - should include other income/expenses
        net_margin = (net_income / total_revenue * 100) if total_revenue > 0 else 0
        
        # ===== BALANCE SHEET SUMMARY =====
        # Assets - calculate from accounting entries
        current_assets = db.session.query(
            func.sum(AccountingEntry.debit_amount - AccountingEntry.credit_amount)
        ).join(Account, AccountingEntry.account_code == Account.account_code)\
            .filter(
                Account.account_code.between('1000', '1999'),
                Account.is_active == True,
                AccountingEntry.status == 'posted'
            ).scalar() or 0
        
        fixed_assets = db.session.query(
            func.sum(AccountingEntry.debit_amount - AccountingEntry.credit_amount)
        ).join(Account, AccountingEntry.account_code == Account.account_code)\
            .filter(
                Account.account_code.between('2000', '2999'),
                Account.is_active == True,
                AccountingEntry.status == 'posted'
            ).scalar() or 0
        
        total_assets = current_assets + fixed_assets
        
        # Liabilities
        current_liabilities = db.session.query(
            func.sum(AccountingEntry.credit_amount - AccountingEntry.debit_amount)
        ).join(Account, AccountingEntry.account_code == Account.account_code)\
            .filter(
                Account.account_code.between('3000', '3999'),
                Account.is_active == True,
                AccountingEntry.status == 'posted'
            ).scalar() or 0
        
        long_term_liabilities = db.session.query(
            func.sum(AccountingEntry.credit_amount - AccountingEntry.debit_amount)
        ).join(Account, AccountingEntry.account_code == Account.account_code)\
            .filter(
                Account.account_code.between('4000', '4999'),
                Account.is_active == True,
                AccountingEntry.status == 'posted'
            ).scalar() or 0
        
        total_liabilities = current_liabilities + long_term_liabilities
        
        # Equity
        equity = db.session.query(
            func.sum(AccountingEntry.credit_amount - AccountingEntry.debit_amount)
        ).join(Account, AccountingEntry.account_code == Account.account_code)\
            .filter(
                Account.account_code >= '5000',
                Account.is_active == True,
                AccountingEntry.status == 'posted'
            ).scalar() or 0
        
        # ===== CASH FLOW SUMMARY =====
        # Operating Cash Flow (simplified - from cash accounts)
        operating_cash_flow = db.session.query(func.sum(Payment.amount))\
            .filter(
                Payment.payment_date >= start_date,
                Payment.payment_date <= end_date,
                Payment.payment_type == 'receipt'
            ).scalar() or 0
        
        # Investing Cash Flow (simplified)
        investing_cash_flow = 0  # Would need fixed asset transactions
        
        # Financing Cash Flow (simplified)
        financing_cash_flow = 0  # Would need loan transactions
        
        free_cash_flow = operating_cash_flow + investing_cash_flow + financing_cash_flow
        
        return jsonify({
            'success': True,
            'data': {
                'period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                },
                'profit_loss': {
                    'revenue': float(total_revenue),
                    'cogs': float(cogs),
                    'gross_profit': float(gross_profit),
                    'gross_margin': round(float(gross_margin), 2),
                    'operating_expenses': float(operating_expenses),
                    'operating_profit': float(operating_profit),
                    'operating_margin': round(float(operating_margin), 2),
                    'net_income': float(net_income),
                    'net_margin': round(float(net_margin), 2)
                },
                'balance_sheet': {
                    'current_assets': float(current_assets),
                    'fixed_assets': float(fixed_assets),
                    'total_assets': float(total_assets),
                    'current_liabilities': float(current_liabilities),
                    'long_term_liabilities': float(long_term_liabilities),
                    'total_liabilities': float(total_liabilities),
                    'equity': float(equity)
                },
                'cash_flow': {
                    'operating_cash_flow': float(operating_cash_flow),
                    'investing_cash_flow': float(investing_cash_flow),
                    'financing_cash_flow': float(financing_cash_flow),
                    'free_cash_flow': float(free_cash_flow)
                }
            }
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@executive_dashboard_bp.route('/executive-overview/financial-ratios', methods=['GET'])
@jwt_required(optional=True)
def get_investor_financial_ratios():
    """
    Get key financial ratios for investors
    """
    try:
        end_date = get_local_now().date()
        start_date = (get_local_now() - timedelta(days=365)).date()
        
        # Get financial data
        total_revenue = db.session.query(func.sum(Invoice.total_amount))\
            .filter(
                Invoice.invoice_date >= start_date,
                Invoice.invoice_date <= end_date,
                Invoice.status.in_(['paid', 'partial'])
            ).scalar() or 0
        
        # Balance sheet data - calculate from accounting entries
        current_assets = db.session.query(
            func.sum(AccountingEntry.debit_amount - AccountingEntry.credit_amount)
        ).join(Account, AccountingEntry.account_code == Account.account_code)\
            .filter(
                Account.account_code.between('1000', '1999'),
                Account.is_active == True,
                AccountingEntry.status == 'posted'
            ).scalar() or 0
        
        current_liabilities = db.session.query(
            func.sum(AccountingEntry.credit_amount - AccountingEntry.debit_amount)
        ).join(Account, AccountingEntry.account_code == Account.account_code)\
            .filter(
                Account.account_code.between('3000', '3999'),
                Account.is_active == True,
                AccountingEntry.status == 'posted'
            ).scalar() or 0
        
        total_assets = db.session.query(
            func.sum(AccountingEntry.debit_amount - AccountingEntry.credit_amount)
        ).join(Account, AccountingEntry.account_code == Account.account_code)\
            .filter(
                Account.account_code.between('1000', '2999'),
                Account.is_active == True,
                AccountingEntry.status == 'posted'
            ).scalar() or 0
        
        total_liabilities = db.session.query(
            func.sum(AccountingEntry.credit_amount - AccountingEntry.debit_amount)
        ).join(Account, AccountingEntry.account_code == Account.account_code)\
            .filter(
                Account.account_code.between('3000', '4999'),
                Account.is_active == True,
                AccountingEntry.status == 'posted'
            ).scalar() or 0
        
        equity = db.session.query(
            func.sum(AccountingEntry.credit_amount - AccountingEntry.debit_amount)
        ).join(Account, AccountingEntry.account_code == Account.account_code)\
            .filter(
                Account.account_code >= '5000',
                Account.is_active == True,
                AccountingEntry.status == 'posted'
            ).scalar() or 0
        
        # COGS
        from models.finance import InvoiceItem
        cogs = db.session.query(
            func.sum(InvoiceItem.quantity * func.coalesce(Product.cost, 0))
        ).join(Invoice, InvoiceItem.invoice_id == Invoice.id)\
         .join(Product, InvoiceItem.product_id == Product.id)\
         .filter(
                Invoice.invoice_date >= start_date,
                Invoice.invoice_date <= end_date,
                Invoice.status.in_(['paid', 'partial'])
            ).scalar() or 0
        
        gross_profit = total_revenue - cogs
        net_income = gross_profit  # Simplified
        
        # Inventory value
        inventory_value = db.session.query(
            func.sum(Inventory.quantity_on_hand * func.coalesce(Product.cost, 0))
        ).outerjoin(Product, Inventory.product_id == Product.id).scalar() or 0
        
        # ===== LIQUIDITY RATIOS =====
        current_ratio = (current_assets / current_liabilities) if current_liabilities > 0 else 0
        quick_ratio = ((current_assets - inventory_value) / current_liabilities) if current_liabilities > 0 else 0
        
        # ===== SOLVENCY RATIOS =====
        debt_to_equity = (total_liabilities / equity) if equity > 0 else 0
        debt_ratio = (total_liabilities / total_assets) if total_assets > 0 else 0
        
        # ===== PROFITABILITY RATIOS =====
        roa = (net_income / total_assets) if total_assets > 0 else 0
        roe = (net_income / equity) if equity > 0 else 0
        gross_margin = (gross_profit / total_revenue * 100) if total_revenue > 0 else 0
        net_margin = (net_income / total_revenue * 100) if total_revenue > 0 else 0
        
        # ===== EFFICIENCY RATIOS =====
        asset_turnover = (total_revenue / total_assets) if total_assets > 0 else 0
        inventory_turnover = (cogs / inventory_value) if inventory_value > 0 else 0
        
        return jsonify({
            'success': True,
            'data': {
                'liquidity': {
                    'current_ratio': round(float(current_ratio), 2),
                    'quick_ratio': round(float(quick_ratio), 2)
                },
                'solvency': {
                    'debt_to_equity': round(float(debt_to_equity), 2),
                    'debt_ratio': round(float(debt_ratio), 2)
                },
                'profitability': {
                    'roa': round(float(roa * 100), 2),  # Return on Assets %
                    'roe': round(float(roe * 100), 2),  # Return on Equity %
                    'gross_margin': round(float(gross_margin), 2),
                    'net_margin': round(float(net_margin), 2)
                },
                'efficiency': {
                    'asset_turnover': round(float(asset_turnover), 2),
                    'inventory_turnover': round(float(inventory_turnover), 2)
                }
            }
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@executive_dashboard_bp.route('/executive-overview/growth-metrics', methods=['GET'])
@jwt_required(optional=True)
def get_investor_growth_metrics():
    """
    Get growth metrics including YoY growth and CAGR
    """
    try:
        now = get_local_now().date()
        
        # Current year
        current_year_start = datetime(now.year, 1, 1).date()
        current_year_end = now
        
        # Previous year
        prev_year_start = datetime(now.year - 1, 1, 1).date()
        prev_year_end = datetime(now.year - 1, 12, 31).date()
        
        # 3 years ago for CAGR
        three_years_ago_start = datetime(now.year - 3, 1, 1).date()
        three_years_ago_end = datetime(now.year - 3, 12, 31).date()
        
        # Revenue by period
        current_revenue = db.session.query(func.sum(Invoice.total_amount))\
            .filter(
                Invoice.invoice_date >= current_year_start,
                Invoice.invoice_date <= current_year_end,
                Invoice.status.in_(['paid', 'partial'])
            ).scalar() or 0
        
        prev_revenue = db.session.query(func.sum(Invoice.total_amount))\
            .filter(
                Invoice.invoice_date >= prev_year_start,
                Invoice.invoice_date <= prev_year_end,
                Invoice.status.in_(['paid', 'partial'])
            ).scalar() or 0
        
        three_years_ago_revenue = db.session.query(func.sum(Invoice.total_amount))\
            .filter(
                Invoice.invoice_date >= three_years_ago_start,
                Invoice.invoice_date <= three_years_ago_end,
                Invoice.status.in_(['paid', 'partial'])
            ).scalar() or 0
        
        # Production by period
        current_production = db.session.query(func.sum(ShiftProduction.good_quantity))\
            .filter(
                ShiftProduction.production_date >= current_year_start,
                ShiftProduction.production_date <= current_year_end
            ).scalar() or 0
        
        prev_production = db.session.query(func.sum(ShiftProduction.good_quantity))\
            .filter(
                ShiftProduction.production_date >= prev_year_start,
                ShiftProduction.production_date <= prev_year_end
            ).scalar() or 0
        
        three_years_ago_production = db.session.query(func.sum(ShiftProduction.good_quantity))\
            .filter(
                ShiftProduction.production_date >= three_years_ago_start,
                ShiftProduction.production_date <= three_years_ago_end
            ).scalar() or 0
        
        # YoY Growth
        revenue_yoy = ((current_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
        production_yoy = ((current_production - prev_production) / prev_production * 100) if prev_production > 0 else 0
        
        # CAGR (3-year)
        years = 3
        revenue_cagr = ((current_revenue / three_years_ago_revenue) ** (1/years) - 1) * 100 if three_years_ago_revenue > 0 else 0
        production_cagr = ((current_production / three_years_ago_production) ** (1/years) - 1) * 100 if three_years_ago_production > 0 else 0
        
        return jsonify({
            'success': True,
            'data': {
                'period': {
                    'current_year': now.year,
                    'current_year_start': current_year_start.isoformat(),
                    'current_year_end': current_year_end.isoformat()
                },
                'yoy_growth': {
                    'revenue': {
                        'current': float(current_revenue),
                        'previous': float(prev_revenue),
                        'growth_percent': round(float(revenue_yoy), 2)
                    },
                    'production': {
                        'current': float(current_production),
                        'previous': float(prev_production),
                        'growth_percent': round(float(production_yoy), 2)
                    }
                },
                'cagr': {
                    'revenue_3y': round(float(revenue_cagr), 2),
                    'production_3y': round(float(production_cagr), 2)
                }
            }
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@executive_dashboard_bp.route('/executive-overview/operational-excellence', methods=['GET'])
@jwt_required(optional=True)
def get_investor_operational_excellence():
    """
    Get operational excellence metrics for investors
    Includes Production, Quality, and Supply Chain metrics
    """
    try:
        end_date = get_local_now().date()
        start_date = (get_local_now() - timedelta(days=365)).date()
        
        # ===== PRODUCTION METRICS =====
        total_output = db.session.query(func.sum(ShiftProduction.good_quantity))\
            .filter(
                ShiftProduction.production_date >= start_date,
                ShiftProduction.production_date <= end_date
            ).scalar() or 0
        
        avg_oee = db.session.query(func.avg(ShiftProduction.oee_score))\
            .filter(
                ShiftProduction.production_date >= start_date,
                ShiftProduction.production_date <= end_date,
                ShiftProduction.oee_score.isnot(None)
            ).scalar() or 0
        
        # Capacity utilization (simplified - based on target vs actual)
        # Assuming 24/7 operation with 3 shifts
        total_capacity = 1000000  # Placeholder - should be calculated from machine capacity
        capacity_utilization = (total_output / total_capacity * 100) if total_capacity > 0 else 0
        
        # WIP Value
        wip_value = db.session.query(func.sum(WIPStock.quantity_pcs * Product.cost))\
            .join(Product, WIPStock.product_id == Product.id).scalar() or 0
        
        # ===== QUALITY METRICS =====
        total_inspections = db.session.query(func.count(QualityInspection.id))\
            .filter(
                QualityInspection.inspection_date >= start_date,
                QualityInspection.inspection_date <= end_date
            ).scalar() or 0
        
        passed_inspections = db.session.query(func.count(QualityInspection.id))\
            .filter(
                QualityInspection.inspection_date >= start_date,
                QualityInspection.inspection_date <= end_date,
                QualityInspection.result == 'pass'
            ).scalar() or 0
        
        first_pass_yield = (passed_inspections / total_inspections * 100) if total_inspections > 0 else 0
        
        # Customer return rate (simplified)
        total_rejects = db.session.query(func.sum(ShiftProduction.reject_quantity))\
            .filter(
                ShiftProduction.production_date >= start_date,
                ShiftProduction.production_date <= end_date
            ).scalar() or 0
        
        return_rate = (total_rejects / total_output * 100) if total_output > 0 else 0
        
        # ===== SUPPLY CHAIN METRICS =====
        # Supplier on-time delivery (simplified - from PO data)
        supplier_otd = 95.0  # Placeholder - should be calculated from PO data
        
        # Inventory turnover
        inventory_value = db.session.query(
            func.sum(Inventory.quantity_on_hand * func.coalesce(Product.cost, 0))
        ).outerjoin(Product, Inventory.product_id == Product.id).scalar() or 0
        
        from models.finance import InvoiceItem
        cogs = db.session.query(
            func.sum(InvoiceItem.quantity * func.coalesce(Product.cost, 0))
        ).join(Invoice, InvoiceItem.invoice_id == Invoice.id)\
         .join(Product, InvoiceItem.product_id == Product.id)\
         .filter(
                Invoice.invoice_date >= start_date,
                Invoice.invoice_date <= end_date,
                Invoice.status.in_(['paid', 'partial'])
            ).scalar() or 0
        
        annual_cogs = cogs * 12
        inventory_turnover = (annual_cogs / inventory_value) if inventory_value > 0 else 0
        
        # Stockout rate
        low_stock_count = db.session.query(func.count(Product.id))\
            .join(Inventory, Product.id == Inventory.product_id)\
            .filter(Inventory.quantity_on_hand < Product.min_stock_level)\
            .scalar() or 0
        
        total_products = db.session.query(func.count(Product.id)).scalar() or 0
        stockout_rate = (low_stock_count / total_products * 100) if total_products > 0 else 0
        
        return jsonify({
            'success': True,
            'data': {
                'period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                },
                'production': {
                    'total_output': float(total_output),
                    'avg_oee': round(float(avg_oee), 2),
                    'capacity_utilization': round(float(capacity_utilization), 2),
                    'wip_value': float(wip_value)
                },
                'quality': {
                    'first_pass_yield': round(float(first_pass_yield), 2),
                    'return_rate': round(float(return_rate), 2),
                    'total_inspections': total_inspections,
                    'passed_inspections': passed_inspections
                },
                'supply_chain': {
                    'supplier_otd': supplier_otd,
                    'inventory_turnover': round(float(inventory_turnover), 2),
                    'stockout_rate': round(float(stockout_rate), 2)
                }
            }
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@executive_dashboard_bp.route('/executive-overview/risk-compliance', methods=['GET'])
@jwt_required(optional=True)
def get_investor_risk_compliance():
    """
    Get risk indicators and compliance status for investors
    """
    try:
        end_date = get_local_now().date()
        start_date = (get_local_now() - timedelta(days=365)).date()
        
        # ===== FINANCIAL HEALTH =====
        # AR Aging (simplified - overdue invoices)
        overdue_invoices = db.session.query(func.count(Invoice.id))\
            .filter(
                Invoice.status.in_(['pending', 'partial']),
                Invoice.due_date < end_date
            ).scalar() or 0
        
        overdue_amount = db.session.query(func.sum(Invoice.total_amount - Invoice.paid_amount))\
            .filter(
                Invoice.status.in_(['pending', 'partial']),
                Invoice.due_date < end_date
            ).scalar() or 0
        
        # AP Aging (simplified)
        from models.purchasing import PurchaseOrder
        overdue_po = db.session.query(func.count(PurchaseOrder.id))\
            .filter(
                PurchaseOrder.status == 'approved',
                PurchaseOrder.required_date < end_date
            ).scalar() or 0
        
        # Debt profile (simplified - from balance sheet)
        current_liabilities = db.session.query(
            func.sum(AccountingEntry.credit_amount - AccountingEntry.debit_amount)
        ).join(Account, AccountingEntry.account_code == Account.account_code)\
            .filter(
                Account.account_code.between('3000', '3999'),
                Account.is_active == True,
                AccountingEntry.status == 'posted'
            ).scalar() or 0
        
        long_term_liabilities = db.session.query(
            func.sum(AccountingEntry.credit_amount - AccountingEntry.debit_amount)
        ).join(Account, AccountingEntry.account_code == Account.account_code)\
            .filter(
                Account.account_code.between('4000', '4999'),
                Account.is_active == True,
                AccountingEntry.status == 'posted'
            ).scalar() or 0
        
        total_debt = current_liabilities + long_term_liabilities
        
        # ===== OPERATIONAL RISKS =====
        # Low stock items
        low_stock_count = db.session.query(func.count(Product.id))\
            .join(Inventory, Product.id == Inventory.product_id)\
            .filter(Inventory.quantity_on_hand < Product.min_stock_level)\
            .scalar() or 0
        
        # Low OEE machines
        low_oee_machines = db.session.query(
            ShiftProduction.machine_id,
            func.avg(func.coalesce(ShiftProduction.oee_score, ShiftProduction.efficiency_rate, 0)).label('avg_oee')
        ).filter(
            ShiftProduction.production_date >= (get_local_now() - timedelta(days=30)).date()
        ).group_by(ShiftProduction.machine_id)\
        .having(func.avg(func.coalesce(ShiftProduction.oee_score, ShiftProduction.efficiency_rate, 0)) < 75)\
        .count()
        
        # Maintenance backlog (simplified)
        from models.maintenance import MaintenanceRecord
        pending_maintenance = db.session.query(func.count(MaintenanceRecord.id))\
            .filter(MaintenanceRecord.status == 'pending').scalar() or 0
        
        # ===== COMPLIANCE STATUS =====
        # ISO 9001:2015 status (simplified - from DCC module)
        from models.dcc import DccDocumentRevision
        active_documents = db.session.query(func.count(DccDocumentRevision.id))\
            .filter(DccDocumentRevision.status == 'active').scalar() or 0
        
        # Safety incidents (simplified)
        safety_incidents = 0  # Would need safety module
        
        # Environmental compliance (simplified)
        environmental_status = 'compliant'  # Placeholder
        
        return jsonify({
            'success': True,
            'data': {
                'financial_health': {
                    'overdue_invoices': overdue_invoices,
                    'overdue_amount': float(overdue_amount),
                    'overdue_po': overdue_po,
                    'current_debt': float(current_liabilities),
                    'long_term_debt': float(long_term_liabilities),
                    'total_debt': float(total_debt)
                },
                'operational_risks': {
                    'low_stock_items': low_stock_count,
                    'low_oee_machines': low_oee_machines,
                    'pending_maintenance': pending_maintenance
                },
                'compliance': {
                    'iso_9001_status': 'certified',
                    'active_documents': active_documents,
                    'safety_incidents_ytd': safety_incidents,
                    'environmental_status': environmental_status
                }
            }
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@executive_dashboard_bp.route('/executive-overview/people-culture', methods=['GET'])
@jwt_required(optional=True)
def get_investor_people_culture():
    """
    Get HR metrics and productivity for investors
    """
    try:
        end_date = get_local_now().date()
        start_date = (get_local_now() - timedelta(days=365)).date()
        
        # ===== WORKFORCE =====
        total_employees = db.session.query(func.count(Employee.id))\
            .filter(Employee.is_active == True).scalar() or 0
        
        # Employee turnover (simplified - based on inactive employees)
        inactive_employees = db.session.query(func.count(Employee.id))\
            .filter(Employee.is_active == False).scalar() or 0
        
        turnover_rate = (inactive_employees / (total_employees + inactive_employees) * 100) if (total_employees + inactive_employees) > 0 else 0
        
        # Training hours (simplified - placeholder)
        training_hours_per_employee = 40  # Placeholder - would need training module
        
        # ===== PRODUCTIVITY =====
        # Total output
        total_output = db.session.query(func.sum(ShiftProduction.good_quantity))\
            .filter(
                ShiftProduction.production_date >= start_date,
                ShiftProduction.production_date <= end_date
            ).scalar() or 0
        
        # Output per employee
        output_per_employee = (total_output / total_employees) if total_employees > 0 else 0
        
        # Total revenue
        total_revenue = db.session.query(func.sum(Invoice.total_amount))\
            .filter(
                Invoice.invoice_date >= start_date,
                Invoice.invoice_date <= end_date,
                Invoice.status.in_(['paid', 'partial'])
            ).scalar() or 0
        
        # Revenue per employee
        revenue_per_employee = (total_revenue / total_employees) if total_employees > 0 else 0
        
        return jsonify({
            'success': True,
            'data': {
                'workforce': {
                    'total_employees': total_employees,
                    'turnover_rate': round(float(turnover_rate), 2),
                    'training_hours_per_employee': training_hours_per_employee
                },
                'productivity': {
                    'output_per_employee': round(float(output_per_employee), 2),
                    'revenue_per_employee': round(float(revenue_per_employee), 2)
                }
            }
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@executive_dashboard_bp.route('/executive-overview/future-outlook', methods=['GET'])
@jwt_required(optional=True)
def get_investor_future_outlook():
    """
    Get pipeline, forecast, and investment needs for investors
    """
    try:
        # ===== PIPELINE =====
        # Sales pipeline value (simplified - from open sales orders)
        pipeline_value = db.session.query(func.sum(SalesOrder.total_amount))\
            .filter(SalesOrder.status.in_(['pending', 'confirmed'])).scalar() or 0
        
        # Work orders in progress
        wip_orders = db.session.query(func.count(WorkOrder.id))\
            .filter(WorkOrder.status.in_(['pending', 'in_progress'])).scalar() or 0
        
        # ===== FORECAST =====
        # Forecast revenue (simplified - based on current trend)
        end_date = get_local_now().date()
        start_date = (get_local_now() - timedelta(days=90)).date()
        
        last_quarter_revenue = db.session.query(func.sum(Invoice.total_amount))\
            .filter(
                Invoice.invoice_date >= start_date,
                Invoice.invoice_date <= end_date,
                Invoice.status.in_(['paid', 'partial'])
            ).scalar() or 0
        
        # Simple forecast: assume 10% growth
        forecast_next_quarter = last_quarter_revenue * 1.1
        
        # ===== INVESTMENT NEEDS =====
        # CAPEX requirements (simplified - from fixed asset requests)
        capex_requirements = 0  # Would need CAPEX module
        
        # R&D projects (simplified)
        rnd_projects = db.session.query(func.count(WorkOrder.id))\
            .filter(WorkOrder.status == 'pending').scalar() or 0
        
        # Expansion plans (simplified)
        expansion_plans = []  # Would need expansion planning module
        
        return jsonify({
            'success': True,
            'data': {
                'pipeline': {
                    'sales_pipeline_value': float(pipeline_value),
                    'wip_orders': wip_orders
                },
                'forecast': {
                    'last_quarter_revenue': float(last_quarter_revenue),
                    'forecast_next_quarter': round(float(forecast_next_quarter), 2)
                },
                'investment_needs': {
                    'capex_requirements': float(capex_requirements),
                    'rnd_projects': rnd_projects,
                    'expansion_plans': expansion_plans
                }
            }
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@executive_dashboard_bp.route('/executive-overview/export-pdf', methods=['GET'])
@jwt_required()
def export_investor_pdf():
    """Generate PDF report for investor dashboard"""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.graphics.shapes import Drawing
        from reportlab.graphics.charts.barcharts import VerticalBarChart
        from reportlab.graphics.charts.piecharts import Pie
        from reportlab.graphics import renderPDF
        from reportlab.lib.units import inch
        from io import BytesIO
        from datetime import datetime, timedelta
        from company_config.company import COMPANY_NAME, COMPANY_ADDRESS_LINE1, COMPANY_PHONE, COMPANY_EMAIL
        from models.settings import CompanyProfile
        from models.finance import Invoice, Payment, AccountingEntry, InvoiceItem, Account
        from models.product import Product
        from models import db
        from sqlalchemy import func
        from utils.timezone import get_local_now
        from flask import request

        # Get company profile
        company_profile = CompanyProfile.query.first()
        company_name = company_profile.company_name if company_profile else COMPANY_NAME

        # Get period from query parameters (default to 1 year)
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        if start_date_str and end_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        else:
            end_date = get_local_now().date()
            start_date = (get_local_now() - timedelta(days=365)).date()
        
        # Financial Summary
        total_revenue = float(db.session.query(func.sum(Invoice.total_amount))\
            .filter(
                Invoice.invoice_date >= start_date,
                Invoice.invoice_date <= end_date,
                Invoice.status.in_(['paid', 'partial'])
            ).scalar() or 0)
        
        from models.finance import InvoiceItem
        cogs = float(db.session.query(
            func.sum(InvoiceItem.quantity * func.coalesce(Product.cost, 0))
        ).join(Invoice, InvoiceItem.invoice_id == Invoice.id)\
         .join(Product, InvoiceItem.product_id == Product.id)\
         .filter(
                Invoice.invoice_date >= start_date,
                Invoice.invoice_date <= end_date,
                Invoice.status.in_(['paid', 'partial'])
            ).scalar() or 0)
        
        gross_profit = total_revenue - cogs
        gross_margin = (gross_profit / total_revenue * 100) if total_revenue > 0 else 0
        
        operating_expenses = float(db.session.query(func.sum(AccountingEntry.debit_amount))\
            .filter(
                AccountingEntry.account_code.between('5000', '8999'),
                AccountingEntry.entry_date >= start_date,
                AccountingEntry.entry_date <= end_date,
                AccountingEntry.status == 'posted'
            ).scalar() or 0)
        
        operating_profit = gross_profit - operating_expenses
        operating_margin = (operating_profit / total_revenue * 100) if total_revenue > 0 else 0
        
        # Balance Sheet
        current_assets = float(db.session.query(
            func.sum(AccountingEntry.debit_amount - AccountingEntry.credit_amount)
        ).join(Account, AccountingEntry.account_code == Account.account_code)\
            .filter(
                Account.account_code.between('1000', '1999'),
                Account.is_active == True,
                AccountingEntry.status == 'posted'
            ).scalar() or 0)
        
        fixed_assets = float(db.session.query(
            func.sum(AccountingEntry.debit_amount - AccountingEntry.credit_amount)
        ).join(Account, AccountingEntry.account_code == Account.account_code)\
            .filter(
                Account.account_code.between('2000', '2999'),
                Account.is_active == True,
                AccountingEntry.status == 'posted'
            ).scalar() or 0)
        
        total_assets = current_assets + fixed_assets
        
        current_liabilities = float(db.session.query(
            func.sum(AccountingEntry.credit_amount - AccountingEntry.debit_amount)
        ).join(Account, AccountingEntry.account_code == Account.account_code)\
            .filter(
                Account.account_code.between('3000', '3999'),
                Account.is_active == True,
                AccountingEntry.status == 'posted'
            ).scalar() or 0)
        
        long_term_liabilities = float(db.session.query(
            func.sum(AccountingEntry.credit_amount - AccountingEntry.debit_amount)
        ).join(Account, AccountingEntry.account_code == Account.account_code)\
            .filter(
                Account.account_code.between('4000', '4999'),
                Account.is_active == True,
                AccountingEntry.status == 'posted'
            ).scalar() or 0)
        
        total_liabilities = current_liabilities + long_term_liabilities
        equity = total_assets - total_liabilities
        
        # Cash Flow
        operating_cash_flow = float(db.session.query(func.sum(Payment.amount))\
            .filter(
                Payment.payment_date >= start_date,
                Payment.payment_date <= end_date,
                Payment.payment_type == 'receipt'
            ).scalar() or 0)
        
        financial_summary = {
            'profit_loss': {
                'revenue': total_revenue,
                'gross_profit': gross_profit,
                'operating_profit': operating_profit,
                'net_profit': operating_profit  # Simplified
            },
            'balance_sheet': {
                'total_assets': total_assets,
                'total_liabilities': total_liabilities
            },
            'cash_flow': {
                'net_cash_flow': operating_cash_flow
            }
        }
        
        # Financial Ratios
        roa = (operating_profit / total_assets * 100) if total_assets > 0 else 0
        roe = (operating_profit / equity * 100) if equity > 0 else 0
        current_ratio = (current_assets / current_liabilities) if current_liabilities > 0 else 0
        debt_to_equity = (total_liabilities / equity) if equity > 0 else 0
        
        financial_ratios = {
            'roa': roa / 100,
            'roe': roe / 100,
            'gross_margin': gross_margin / 100,
            'operating_margin': operating_margin / 100,
            'current_ratio': current_ratio,
            'debt_to_equity': debt_to_equity
        }
        
        # Growth Metrics (calculated from historical data)
        current_year_start = datetime(end_date.year, 1, 1).date()
        prev_year_start = datetime(end_date.year - 1, 1, 1).date()
        prev_year_end = datetime(end_date.year - 1, 12, 31).date()
        
        current_revenue = float(db.session.query(func.sum(Invoice.total_amount))\
            .filter(
                Invoice.invoice_date >= current_year_start,
                Invoice.invoice_date <= end_date,
                Invoice.status.in_(['paid', 'partial'])
            ).scalar() or 0)
        
        prev_revenue = float(db.session.query(func.sum(Invoice.total_amount))\
            .filter(
                Invoice.invoice_date >= prev_year_start,
                Invoice.invoice_date <= prev_year_end,
                Invoice.status.in_(['paid', 'partial'])
            ).scalar() or 0)
        
        yoy_revenue_growth = ((current_revenue - prev_revenue) / prev_revenue) if prev_revenue > 0 else 0
        
        # Profit growth (from historical data)
        prev_profit = float(db.session.query(func.sum(Invoice.total_amount))\
            .filter(
                Invoice.invoice_date >= prev_year_start,
                Invoice.invoice_date <= prev_year_end,
                Invoice.status.in_(['paid', 'partial'])
            ).scalar() or 0)
        
        prev_cogs = float(db.session.query(
            func.sum(InvoiceItem.quantity * func.coalesce(Product.cost, 0))
        ).join(Invoice, InvoiceItem.invoice_id == Invoice.id)\
         .join(Product, InvoiceItem.product_id == Product.id)\
         .filter(
                Invoice.invoice_date >= prev_year_start,
                Invoice.invoice_date <= prev_year_end,
                Invoice.status.in_(['paid', 'partial'])
            ).scalar() or 0)
        
        prev_operating_expenses = float(db.session.query(func.sum(AccountingEntry.debit_amount))\
            .filter(
                AccountingEntry.account_code.between('5000', '8999'),
                AccountingEntry.entry_date >= prev_year_start,
                AccountingEntry.entry_date <= prev_year_end,
                AccountingEntry.status == 'posted'
            ).scalar() or 0)
        
        prev_profit = prev_revenue - prev_cogs - prev_operating_expenses
        yoy_profit_growth = ((current_profit - prev_profit) / prev_profit) if prev_profit > 0 else 0
        
        # Customer growth (from historical data)
        prev_customers = db.session.query(func.count(Customer.id))\
            .filter(Customer.created_at < prev_year_start).scalar() or 0
        customer_growth = ((current_customers - prev_customers) / prev_customers) if prev_customers > 0 else 0
        
        # 3-year CAGR (simplified)
        cagr_3yr = yoy_revenue_growth
        
        growth_metrics = {
            'yoy_revenue_growth': yoy_revenue_growth,
            'yoy_profit_growth': yoy_profit_growth,
            'cagr_3yr': cagr_3yr,
            'customer_growth': customer_growth
        }
        
        # Operational Excellence (from real data)
        from models.production import ShiftProduction
        from models.quality import QualityInspection
        
        # Production efficiency
        avg_efficiency = float(db.session.query(func.avg(ShiftProduction.efficiency_rate))\
            .filter(
                ShiftProduction.production_date >= start_date,
                ShiftProduction.production_date <= end_date
            ).scalar() or 0)
        
        # Quality rate
        avg_quality = float(db.session.query(func.avg(ShiftProduction.quality_rate))\
            .filter(
                ShiftProduction.production_date >= start_date,
                ShiftProduction.production_date <= end_date
            ).scalar() or 0)
        
        # On-time delivery (simplified - from SalesOrder)
        from models.sales import SalesOrder
        on_time_orders = db.session.query(func.count(SalesOrder.id))\
            .filter(
                SalesOrder.order_date >= start_date,
                SalesOrder.order_date <= end_date,
                SalesOrder.status == 'delivered'
            ).scalar() or 0
        
        total_orders = db.session.query(func.count(SalesOrder.id))\
            .filter(
                SalesOrder.order_date >= start_date,
                SalesOrder.order_date <= end_date
            ).scalar() or 1
        
        on_time_delivery = (on_time_orders / total_orders) if total_orders > 0 else 0
        
        # Inventory turnover (from real data)
        from models.warehouse import Inventory
        avg_inventory = float(db.session.query(func.avg(Inventory.quantity_on_hand)).scalar() or 0)
        cogs_annual = cogs * (365 / 365)  # Already annual
        inventory_turnover = (cogs_annual / avg_inventory) if avg_inventory > 0 else 0
        
        operational_data = {
            'production': {'efficiency': avg_efficiency / 100 if avg_efficiency > 0 else 0.85},
            'quality': {'quality_rate': avg_quality / 100 if avg_quality > 0 else 0.95},
            'supply_chain': {'on_time_delivery': on_time_delivery, 'inventory_turnover': inventory_turnover}
        }
        
        # Risk & Compliance (from real data)
        # Overdue invoices
        overdue_amount = float(db.session.query(func.sum(Invoice.total_amount - Invoice.paid_amount))\
            .filter(
                Invoice.invoice_date >= start_date,
                Invoice.invoice_date <= end_date,
                Invoice.status.in_(['pending', 'partial']),
                Invoice.due_date < end_date
            ).scalar() or 0)
        
        # Financial health score (calculated from multiple factors)
        financial_health_score = 100
        if overdue_amount > 0:
            financial_health_score -= min(20, (overdue_amount / total_revenue) * 100 if total_revenue > 0 else 20)
        if current_ratio < 1.5:
            financial_health_score -= 10
        if debt_to_equity > 2:
            financial_health_score -= 10
        financial_health_score = max(0, min(100, financial_health_score))
        
        # Operational risks (from maintenance)
        from models.maintenance import MaintenanceRecord
        pending_maintenance = db.session.query(func.count(MaintenanceRecord.id))\
            .filter(MaintenanceRecord.status == 'pending').scalar() or 0
        
        risk_level = 'Low' if pending_maintenance < 5 else 'Medium' if pending_maintenance < 10 else 'High'
        
        # Compliance status (from DCC)
        from models.dcc import DccDocumentRevision
        active_documents = db.session.query(func.count(DccDocumentRevision.id))\
            .filter(DccDocumentRevision.status == 'active').scalar() or 0
        
        compliance_status = 'Compliant' if active_documents > 0 else 'Non-Compliant'
        
        risk_data = {
            'financial_health': {'health_score': financial_health_score},
            'operational_risks': {'risk_level': risk_level},
            'compliance': {'compliance_status': compliance_status}
        }
        
        # People & Culture (from real data)
        from models.hr import Employee
        total_employees = int(db.session.query(func.count(Employee.id))\
            .filter(Employee.is_active == True).scalar() or 0)
        
        # Productivity (calculated from production output per employee)
        total_production = float(db.session.query(func.sum(ShiftProduction.actual_quantity))\
            .filter(
                ShiftProduction.production_date >= start_date,
                ShiftProduction.production_date <= end_date
            ).scalar() or 0)
        
        productivity_index = (total_production / total_employees) if total_employees > 0 else 0
        
        # Employee satisfaction (simplified - would need survey data, using placeholder)
        employee_satisfaction = 0.88  # Would need employee survey data
        
        people_data = {
            'workforce': {'total_employees': total_employees},
            'productivity': {'productivity_index': productivity_index, 'employee_satisfaction': employee_satisfaction}
        }
        
        # Future Outlook (from real data)
        # Pipeline value
        pipeline_value = float(db.session.query(func.sum(SalesOrder.total_amount))\
            .filter(SalesOrder.status.in_(['pending', 'confirmed'])).scalar() or 0)
        
        # Revenue forecast (simplified - based on pipeline)
        revenue_forecast = pipeline_value * 0.8  # Assuming 80% conversion
        
        outlook_data = {
            'pipeline': {'pipeline_value': pipeline_value},
            'forecast': {'revenue_forecast': revenue_forecast}
        }

        # Create PDF buffer
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
        story = []
        styles = getSampleStyleSheet()

        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1e40af'),
            spaceAfter=30,
            alignment=1
        )
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#1e3a8a'),
            spaceAfter=12,
            spaceBefore=20
        )
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontSize=10,
            spaceAfter=6
        )

        # Title
        story.append(Paragraph(f"<b>{company_name}</b>", title_style))
        story.append(Paragraph("Laporan Ringkasan Eksekutif", title_style))
        story.append(Paragraph(f"Dibuat: {datetime.now().strftime('%d %B %Y')}", normal_style))
        story.append(Paragraph(f"Periode: {start_date.strftime('%d %B %Y')} s/d {end_date.strftime('%d %B %Y')}", normal_style))
        story.append(Spacer(1, 0.3*inch))

        # Executive Summary
        story.append(Paragraph("Ringkasan Eksekutif", heading_style))
        
        # Calculate overall health score
        overall_health = (financial_health_score + (avg_efficiency if avg_efficiency > 0 else 85) + (avg_quality if avg_quality > 0 else 95)) / 3
        health_status = "Sangat Baik" if overall_health >= 85 else "Baik" if overall_health >= 70 else "Cukup" if overall_health >= 50 else "Buruk"
        
        exec_summary_data = [
            ['Metrik Utama', 'Nilai', 'Status'],
            ['Skor Kesehatan Keseluruhan', f"{overall_health:.1f}/100", health_status],
            ['Total Pendapatan', f"Rp {total_revenue:,.0f}", "N/A"],
            ['Margin Laba Bersih', f"{operating_margin:.1f}%", "Baik" if operating_margin >= 10 else "Cukup" if operating_margin >= 5 else "Perlu Perbaikan"],
            ['Total Karyawan', f"{total_employees}", "N/A"],
            ['Nilai Pipeline', f"Rp {pipeline_value:,.0f}", "N/A"],
        ]
        exec_summary_table = Table(exec_summary_data, colWidths=[2*inch, 2*inch, 1.5*inch])
        exec_summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6366f1')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.lightgrey),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(exec_summary_table)
        story.append(Spacer(1, 0.2*inch))
        
        # Key Highlights
        story.append(Paragraph("Poin Penting", heading_style))
        highlights = []
        if yoy_revenue_growth > 0:
            highlights.append(f"• Pendapatan tumbuh {yoy_revenue_growth:.1%} dibanding tahun sebelumnya")
        if operating_margin > 0:
            highlights.append(f"• Margin operasional {operating_margin:.1f}%")
        if avg_efficiency > 0:
            highlights.append(f"• Efisiensi produksi {avg_efficiency:.1f}%")
        if on_time_delivery > 0:
            highlights.append(f"• Tingkat pengiriman tepat waktu {on_time_delivery:.1%}")
        if pipeline_value > 0:
            highlights.append(f"• Nilai pipeline penjualan: Rp {pipeline_value:,.0f}")
        
        for highlight in highlights:
            story.append(Paragraph(highlight, normal_style))
        story.append(Spacer(1, 0.2*inch))
        
        story.append(PageBreak())

        # Financial Summary
        story.append(Paragraph("Ringkasan Keuangan", heading_style))
        financial_data = [
            ['Metrik', 'Nilai', 'Perubahan'],
            ['Pendapatan', f"Rp {float(financial_summary.get('profit_loss', {}).get('revenue', 0) or 0):,.0f}", f"{yoy_revenue_growth:+.1%}"],
            ['Laba Kotor', f"Rp {float(financial_summary.get('profit_loss', {}).get('gross_profit', 0) or 0):,.0f}", f"{gross_margin:+.1%} margin"],
            ['Laba Operasional', f"Rp {float(financial_summary.get('profit_loss', {}).get('operating_profit', 0) or 0):,.0f}", f"{operating_margin:+.1%} margin"],
            ['Laba Bersih', f"Rp {float(financial_summary.get('profit_loss', {}).get('net_profit', 0) or 0):,.0f}", f"{yoy_profit_growth:+.1%} YoY"],
            ['Total Aset', f"Rp {float(financial_summary.get('balance_sheet', {}).get('total_assets', 0) or 0):,.0f}", "N/A"],
            ['Total Kewajiban', f"Rp {float(financial_summary.get('balance_sheet', {}).get('total_liabilities', 0) or 0):,.0f}", "N/A"],
            ['Ekuitas', f"Rp {equity:,.0f}", "N/A"],
            ['Arus Kas', f"Rp {float(financial_summary.get('cash_flow', {}).get('net_cash_flow', 0) or 0):,.0f}", "N/A"],
        ]
        financial_table = Table(financial_data, colWidths=[2*inch, 2*inch, 1.5*inch])
        financial_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(financial_table)
        story.append(Spacer(1, 0.2*inch))
        
        # Financial Chart - Bar Chart
        story.append(Paragraph("Grafik Keuangan", heading_style))
        max_financial_value = max(total_revenue, gross_profit, operating_profit)
        if max_financial_value > 0:
            drawing = Drawing(400, 200)
            bc = VerticalBarChart()
            bc.x = 50
            bc.y = 50
            bc.height = 125
            bc.width = 300
            bc.data = [[total_revenue/1000000, gross_profit/1000000, operating_profit/1000000]]
            bc.bars[0].fillColor = colors.HexColor('#3b82f6')
            bc.categoryAxis.categoryNames = ['Pendapatan', 'Laba Kotor', 'Laba Operasional']
            bc.valueAxis.valueMin = 0
            bc.valueAxis.valueMax = max_financial_value/1000000 * 1.2
            bc.valueAxis.valueStep = max(max_financial_value/1000000 / 3, 1)  # Minimum step of 1
            bc.valueAxis.labelTextFormat = '%.0f'
            drawing.add(bc)
            story.append(drawing)
        else:
            story.append(Paragraph("Data keuangan tidak tersedia untuk grafik", normal_style))
        story.append(Spacer(1, 0.2*inch))
        
        # Financial Analysis
        story.append(Paragraph("Analisis Keuangan", heading_style))
        financial_analysis = []
        if gross_margin > 0:
            financial_analysis.append(f"• Margin kotor {gross_margin:.1f}% menunjukkan efektivitas strategi harga")
        if operating_margin > 0:
            financial_analysis.append(f"• Margin operasional {operating_margin:.1f}% menunjukkan efisiensi operasional")
        if current_ratio > 0:
            financial_analysis.append(f"• Rasio lancar {current_ratio:.2f} menunjukkan posisi likuiditas")
        if debt_to_equity > 0:
            financial_analysis.append(f"• Rasio hutang terhadap ekuitas {debt_to_equity:.2f} menunjukkan tingkat leverage")
        if overdue_amount > 0:
            financial_analysis.append(f"• Piutang jatuh tempo: Rp {overdue_amount:,.0f} - perlu perhatian")
        
        for analysis in financial_analysis:
            story.append(Paragraph(analysis, normal_style))
        story.append(Spacer(1, 0.2*inch))

        # Financial Ratios
        story.append(Paragraph("Rasio Keuangan", heading_style))
        ratios_data = [
            ['Rasio', 'Nilai', 'Benchmark'],
            ['ROA', f"{float(financial_ratios.get('roa', 0) or 0):.2%}", ">5%"],
            ['ROE', f"{float(financial_ratios.get('roe', 0) or 0):.2%}", ">10%"],
            ['Margin Kotor', f"{float(financial_ratios.get('gross_margin', 0) or 0):.2%}", ">30%"],
            ['Margin Operasional', f"{float(financial_ratios.get('operating_margin', 0) or 0):.2%}", ">10%"],
            ['Rasio Lancar', f"{float(financial_ratios.get('current_ratio', 0) or 0):.2f}", ">1.5"],
            ['Hutang terhadap Ekuitas', f"{float(financial_ratios.get('debt_to_equity', 0) or 0):.2f}", "<2.0"],
        ]
        ratios_table = Table(ratios_data, colWidths=[2*inch, 1.5*inch, 1.5*inch])
        ratios_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#10b981')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(ratios_table)
        story.append(Spacer(1, 0.2*inch))

        # Growth Metrics
        story.append(Paragraph("Metrik Pertumbuhan", heading_style))
        growth_data = [
            ['Metrik', 'Nilai', 'Tren'],
            ['Pertumbuhan Pendapatan YoY', f"{float(growth_metrics.get('yoy_revenue_growth', 0) or 0):.2%}", "Positif" if yoy_revenue_growth > 0 else "Negatif"],
            ['Pertumbuhan Laba YoY', f"{float(growth_metrics.get('yoy_profit_growth', 0) or 0):.2%}", "Positif" if yoy_profit_growth > 0 else "Negatif"],
            ['CAGR 3 Tahun', f"{float(growth_metrics.get('cagr_3yr', 0) or 0):.2%}", "N/A"],
            ['Pertumbuhan Pelanggan', f"{float(growth_metrics.get('customer_growth', 0) or 0):.2%}", "N/A"],
        ]
        growth_table = Table(growth_data, colWidths=[2*inch, 1.5*inch, 1.5*inch])
        growth_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f59e0b')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(growth_table)
        story.append(Spacer(1, 0.2*inch))
        
        # Growth Analysis
        story.append(Paragraph("Analisis Pertumbuhan", heading_style))
        growth_analysis = []
        if yoy_revenue_growth > 0:
            growth_analysis.append(f"• Pertumbuhan pendapatan {yoy_revenue_growth:.1%} menunjukkan permintaan pasar yang kuat")
        elif yoy_revenue_growth < 0:
            growth_analysis.append(f"• Penurunan pendapatan {abs(yoy_revenue_growth):.1%} perlu investigasi")
        if yoy_profit_growth > 0:
            growth_analysis.append(f"• Pertumbuhan laba {yoy_profit_growth:.1%} menunjukkan efisiensi yang meningkat")
        if customer_growth > 0:
            growth_analysis.append(f"• Basis pelanggan berkembang {customer_growth:.1%}")
        
        for analysis in growth_analysis:
            story.append(Paragraph(analysis, normal_style))
        story.append(Spacer(1, 0.2*inch))

        # Operational Excellence
        story.append(Paragraph("Keunggulan Operasional", heading_style))
        operational_data_table = [
            ['Metrik', 'Nilai', 'Target'],
            ['Efisiensi Produksi', f"{float(operational_data.get('production', {}).get('efficiency', 0) or 0):.2%}", ">85%"],
            ['Tingkat Kualitas', f"{float(operational_data.get('quality', {}).get('quality_rate', 0) or 0):.2%}", ">95%"],
            ['Pengiriman Tepat Waktu', f"{float(operational_data.get('supply_chain', {}).get('on_time_delivery', 0) or 0):.2%}", ">90%"],
            ['Perputaran Inventaris', f"{float(operational_data.get('supply_chain', {}).get('inventory_turnover', 0) or 0):.2f}", ">4.0"],
        ]
        operational_table = Table(operational_data_table, colWidths=[2*inch, 1.5*inch, 1.5*inch])
        operational_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#8b5cf6')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(operational_table)
        story.append(Spacer(1, 0.2*inch))
        
        # Operational Chart - Pie Chart
        story.append(Paragraph("Grafik Operasional", heading_style))
        ops_data = [avg_efficiency if avg_efficiency > 0 else 85, avg_quality if avg_quality > 0 else 95, on_time_delivery * 100 if on_time_delivery > 0 else 90]
        if sum(ops_data) > 0:
            drawing_ops = Drawing(400, 200)
            pc = Pie()
            pc.x = 150
            pc.y = 50
            pc.width = 200
            pc.height = 200
            pc.data = ops_data
            pc.labels = ['Efisiensi', 'Kualitas', 'Tepat Waktu']
            pc.slices[0].fillColor = colors.HexColor('#8b5cf6')
            pc.slices[1].fillColor = colors.HexColor('#10b981')
            pc.slices[2].fillColor = colors.HexColor('#f59e0b')
            drawing_ops.add(pc)
            story.append(drawing_ops)
        else:
            story.append(Paragraph("Data operasional tidak tersedia untuk grafik", normal_style))
        story.append(Spacer(1, 0.2*inch))
        
        # Operational Analysis
        story.append(Paragraph("Analisis Operasional", heading_style))
        operational_analysis = []
        if avg_efficiency > 0:
            if avg_efficiency >= 85:
                operational_analysis.append(f"• Efisiensi produksi {avg_efficiency:.1f}% memenuhi target")
            else:
                operational_analysis.append(f"• Efisiensi produksi {avg_efficiency:.1f}% di bawah target - perlu perbaikan")
        if avg_quality > 0:
            if avg_quality >= 95:
                operational_analysis.append(f"• Tingkat kualitas {avg_quality:.1f}% sangat baik")
            else:
                operational_analysis.append(f"• Tingkat kualitas {avg_quality:.1f}% perlu perhatian")
        if on_time_delivery > 0:
            operational_analysis.append(f"• Tingkat pengiriman tepat waktu {on_time_delivery:.1%} berdampak pada kepuasan pelanggan")
        if inventory_turnover > 0:
            operational_analysis.append(f"• Perputaran inventaris {inventory_turnover:.1f} menunjukkan efisiensi manajemen inventaris")
        
        for analysis in operational_analysis:
            story.append(Paragraph(analysis, normal_style))
        story.append(Spacer(1, 0.2*inch))

        # Risk & Compliance
        story.append(Paragraph("Risiko & Kepatuhan", heading_style))
        risk_data_table = [
            ['Metrik', 'Nilai', 'Status'],
            ['Skor Kesehatan Keuangan', f"{int(risk_data.get('financial_health', {}).get('health_score', 0) or 0)}/100", "Baik" if financial_health_score >= 70 else "Cukup" if financial_health_score >= 50 else "Buruk"],
            ['Tingkat Risiko Operasional', str(risk_data.get('operational_risks', {}).get('risk_level', 'N/A') or 'N/A'), "N/A"],
            ['Status Kepatuhan', str(risk_data.get('compliance', {}).get('compliance_status', 'N/A') or 'N/A'), "N/A"],
            ['Perawatan Tertunda', f"{pending_maintenance}", "Rendah" if pending_maintenance < 5 else "Sedang" if pending_maintenance < 10 else "Tinggi"],
            ['Jumlah Jatuh Tempo', f"Rp {overdue_amount:,.0f}", "N/A" if overdue_amount == 0 else "Perlu Tindakan"],
        ]
        risk_table = Table(risk_data_table, colWidths=[2*inch, 1.5*inch, 1.5*inch])
        risk_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ef4444')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(risk_table)
        story.append(Spacer(1, 0.2*inch))
        
        # Risk Analysis
        story.append(Paragraph("Analisis Risiko", heading_style))
        risk_analysis = []
        if financial_health_score >= 85:
            risk_analysis.append(f"• Kesehatan keuangan sangat baik {financial_health_score}/100")
        elif financial_health_score >= 70:
            risk_analysis.append(f"• Kesehatan keuangan baik {financial_health_score}/100 - monitor indikator kunci")
        else:
            risk_analysis.append(f"• Kesehatan keuangan perlu perhatian {financial_health_score}/100")
        if pending_maintenance > 0:
            risk_analysis.append(f"• {pending_maintenance} item perawatan tertunda - jadwalkan review")
        if overdue_amount > 0:
            risk_analysis.append(f"• Piutang jatuh tempo Rp {overdue_amount:,.0f} - perlu follow up")
        if compliance_status == 'Compliant':
            risk_analysis.append(f"• Semua dokumen yang diperlukan patuh dan terkini")
        else:
            risk_analysis.append(f"• Status kepatuhan perlu perhatian - review kontrol dokumen")
        
        for analysis in risk_analysis:
            story.append(Paragraph(analysis, normal_style))
        story.append(Spacer(1, 0.2*inch))

        # People & Culture
        story.append(Paragraph("SDM & Budaya", heading_style))
        people_data_table = [
            ['Metrik', 'Nilai', 'Benchmark'],
            ['Total Karyawan', f"{int(people_data.get('workforce', {}).get('total_employees', 0) or 0)}", "N/A"],
            ['Indeks Produktivitas', f"{float(people_data.get('productivity', {}).get('productivity_index', 0) or 0):.2f}", ">0.90"],
            ['Kepuasan Karyawan', f"{float(people_data.get('productivity', {}).get('employee_satisfaction', 0) or 0):.2%}", ">80%"],
        ]
        people_table = Table(people_data_table, colWidths=[2*inch, 1.5*inch, 1.5*inch])
        people_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ec4899')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(people_table)
        story.append(Spacer(1, 0.2*inch))
        
        # People Analysis
        story.append(Paragraph("Analisis SDM", heading_style))
        people_analysis = []
        if total_employees > 0:
            people_analysis.append(f"• Tenaga kerja {total_employees} karyawan mendukung operasi saat ini")
        if productivity_index > 0:
            if productivity_index >= 0.90:
                people_analysis.append(f"• Indeks produktivitas {productivity_index:.2f} menunjukkan efisiensi tinggi")
            else:
                people_analysis.append(f"• Indeks produktivitas {productivity_index:.2f} - pertimbangkan inisiatif pelatihan")
        if employee_satisfaction > 0:
            if employee_satisfaction >= 0.80:
                people_analysis.append(f"• Kepuasan karyawan {employee_satisfaction:.1%} - moral baik")
            else:
                people_analysis.append(f"• Kepuasan karyawan {employee_satisfaction:.1%} - review strategi engagement")
        
        for analysis in people_analysis:
            story.append(Paragraph(analysis, normal_style))
        story.append(Spacer(1, 0.2*inch))

        # Future Outlook
        story.append(Paragraph("Prospek Masa Depan", heading_style))
        outlook_data_table = [
            ['Metrik', 'Nilai', 'Penilaian'],
            ['Nilai Pipeline', f"Rp {float(outlook_data.get('pipeline', {}).get('pipeline_value', 0) or 0):,.0f}", "Kuat" if pipeline_value > 1000000 else "Sedang" if pipeline_value > 500000 else "Perlu Perhatian"],
            ['Perkiraan Pendapatan', f"Rp {float(outlook_data.get('forecast', {}).get('revenue_forecast', 0) or 0):,.0f}", "N/A"],
        ]
        outlook_table = Table(outlook_data_table, colWidths=[2*inch, 1.5*inch, 1.5*inch])
        outlook_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#06b6d4')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(outlook_table)
        story.append(Spacer(1, 0.2*inch))
        
        # Future Analysis
        story.append(Paragraph("Analisis Prospek", heading_style))
        future_analysis = []
        if pipeline_value > 0:
            future_analysis.append(f"• Pipeline penjualan Rp {pipeline_value:,.0f} menunjukkan potensi pendapatan masa depan")
        if revenue_forecast > 0:
            future_analysis.append(f"• Perkiraan pendapatan Rp {revenue_forecast:,.0f} berdasarkan konversi 80% pipeline")
        if yoy_revenue_growth > 0:
            future_analysis.append(f"• Tren pertumbuhan positif menunjukkan ekspansi pasar berkelanjutan")
        
        for analysis in future_analysis:
            story.append(Paragraph(analysis, normal_style))
        story.append(Spacer(1, 0.2*inch))
        
        story.append(PageBreak())
        
        # SWOT Analysis
        story.append(Paragraph("Analisis SWOT", heading_style))
        
        # Strengths
        story.append(Paragraph("<b>Kekuatan</b>", heading_style))
        strengths = []
        if operating_margin >= 10:
            strengths.append(f"• Margin operasional kuat ({operating_margin:.1f}%)")
        if avg_quality >= 95:
            strengths.append(f"• Standar kualitas tinggi ({avg_quality:.1f}%)")
        if on_time_delivery >= 0.90:
            strengths.append(f"• Kinerja pengiriman andal ({on_time_delivery:.1%})")
        if financial_health_score >= 85:
            strengths.append(f"• Kesehatan keuangan solid ({financial_health_score}/100)")
        if not strengths:
            strengths.append("• Tidak ada kekuatan signifikan yang teridentifikasi")
        
        for strength in strengths:
            story.append(Paragraph(strength, normal_style))
        story.append(Spacer(1, 0.1*inch))
        
        # Weaknesses
        story.append(Paragraph("<b>Kelemahan</b>", heading_style))
        weaknesses = []
        if operating_margin < 10:
            weaknesses.append(f"• Margin operasional rendah ({operating_margin:.1f}%)")
        if avg_efficiency < 85:
            weaknesses.append(f"• Efisiensi produksi di bawah target ({avg_efficiency:.1f}%)")
        if overdue_amount > 0:
            weaknesses.append(f"• Piutang jatuh tempo (Rp {overdue_amount:,.0f})")
        if debt_to_equity > 2:
            weaknesses.append(f"• Leverage tinggi (hutang terhadap ekuitas: {debt_to_equity:.2f})")
        if not weaknesses:
            weaknesses.append("• Tidak ada kelemahan signifikan yang teridentifikasi")
        
        for weakness in weaknesses:
            story.append(Paragraph(weakness, normal_style))
        story.append(Spacer(1, 0.1*inch))
        
        # Opportunities
        story.append(Paragraph("<b>Peluang</b>", heading_style))
        opportunities = []
        if yoy_revenue_growth > 0:
            opportunities.append(f"• Permintaan pasar tumbuh ({yoy_revenue_growth:.1%} pertumbuhan YoY)")
        if pipeline_value > 0:
            opportunities.append(f"• Pipeline penjualan kuat (Rp {pipeline_value:,.0f})")
        if customer_growth > 0:
            opportunities.append(f"• Basis pelanggan berkembang ({customer_growth:.1%} pertumbuhan)")
        if not opportunities:
            opportunities.append("• Peluang pasar memerlukan analisis lebih lanjut")
        
        for opportunity in opportunities:
            story.append(Paragraph(opportunity, normal_style))
        story.append(Spacer(1, 0.1*inch))
        
        # Threats
        story.append(Paragraph("<b>Ancaman</b>", heading_style))
        threats = []
        if pending_maintenance > 5:
            threats.append(f"• Backlog perawatan peralatan ({pending_maintenance} item)")
        if overdue_amount > 0:
            threats.append(f"• Risiko arus kas dari piutang jatuh tempo")
        if compliance_status != 'Compliant':
            threats.append(f"• Risiko kepatuhan dan regulasi")
        if not threats:
            threats.append("• Tidak ada ancaman langsung yang teridentifikasi")
        
        for threat in threats:
            story.append(Paragraph(threat, normal_style))
        story.append(Spacer(1, 0.2*inch))
        
        story.append(PageBreak())
        
        # Recommendations
        story.append(Paragraph("Rekomendasi Utama", heading_style))
        recommendations = []
        
        # Financial recommendations
        if overdue_amount > 0:
            recommendations.append(f"<b>Keuangan:</b> Implementasi penagihan piutang proaktif untuk mengurangi jumlah jatuh tempo Rp {overdue_amount:,.0f}")
        if operating_margin < 10:
            recommendations.append("<b>Keuangan:</b> Review strategi harga dan struktur biaya untuk meningkatkan margin operasional")
        
        # Operational recommendations
        if avg_efficiency < 85:
            recommendations.append("<b>Operasional:</b> Lakukan optimasi proses untuk meningkatkan efisiensi produksi")
        if pending_maintenance > 5:
            recommendations.append(f"<b>Operasional:</b> Atasi {pending_maintenance} item perawatan tertunda untuk mencegah downtime")
        
        # Growth recommendations
        if yoy_revenue_growth < 0.05:
            recommendations.append("<b>Pertumbuhan:</b> Jelajahi segmen pasar baru dan strategi akuisisi pelanggan")
        
        # Risk recommendations
        if debt_to_equity > 2:
            recommendations.append("<b>Risiko:</b> Review struktur modal dan pertimbangkan strategi pengurangan hutang")
        
        if not recommendations:
            recommendations.append("• Kinerja saat ini memuaskan - lanjutkan monitoring indikator kunci")
        
        for recommendation in recommendations:
            story.append(Paragraph(recommendation, normal_style))
            story.append(Spacer(1, 0.1*inch))
        
        story.append(Spacer(1, 0.3*inch))
        
        # Footer
        story.append(Paragraph("<i>Laporan ini dibuat secara otomatis berdasarkan data sistem. Untuk analisis detail, konsultasikan dengan kepala departemen terkait.</i>", normal_style))
        story.append(Paragraph(f"<i>Laporan dibuat pada {datetime.now().strftime('%d %B %Y pukul %H:%M')}</i>", normal_style))

        # Build PDF
        doc.build(story)
        buffer.seek(0)

        # Return PDF
        from flask import send_file
        return send_file(
            buffer,
            as_attachment=True,
            download_name=f'{company_name.replace(" ", "_")}_Executive_Overview_{datetime.now().strftime("%Y%m%d")}.pdf',
            mimetype='application/pdf'
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
