"""
FG Conversion Helper Functions
Business logic for WIP to FG conversion process
"""

from datetime import datetime, date, timedelta
from models import db
from models.production import (
    FGConversion, FGConversionItem, FGConversionMaterial, FGConversionLossDetail,
    WorkOrder, WIPStock, BillOfMaterials, BOMItem
)
from models.product import Product, Material
from models.quality import QualityInspection


def generate_conversion_number():
    """Generate unique conversion number: FGC-YYYYMM-XXXX"""
    today = datetime.now()
    prefix = f"FGC-{today.strftime('%Y%m')}"
    
    # Get last conversion number for this month
    last_conversion = FGConversion.query.filter(
        FGConversion.conversion_number.like(f"{prefix}%")
    ).order_by(FGConversion.conversion_number.desc()).first()
    
    if last_conversion:
        last_num = int(last_conversion.conversion_number.split('-')[-1])
        new_num = last_num + 1
    else:
        new_num = 1
    
    return f"{prefix}-{new_num:04d}"


def calculate_material_requirements(fg_product_id, fg_quantity):
    """
    Calculate material requirements for FG conversion based on BOM
    Returns list of materials needed (packaging, labels, etc.)
    
    Args:
        fg_product_id: FG product ID
        fg_quantity: Quantity of FG to produce
        
    Returns:
        list of dict with material_id, quantity_required, uom, unit_cost
    """
    try:
        # Get active BOM for FG product
        bom = BillOfMaterials.query.filter_by(
            product_id=fg_product_id,
            is_active=True
        ).first()
        
        if not bom:
            return []
        
        materials = []
        
        # Get BOM items (materials only, not sub-products)
        bom_items = BOMItem.query.filter_by(
            bom_id=bom.id
        ).filter(
            BOMItem.material_id.isnot(None)
        ).all()
        
        for item in bom_items:
            # Calculate quantity needed based on FG quantity
            # BOM quantity is per batch_size, scale to fg_quantity
            batch_size = float(bom.batch_size or 1)
            quantity_per_unit = float(item.quantity) / batch_size
            quantity_required = quantity_per_unit * float(fg_quantity)
            
            # Get material cost
            material = Material.query.get(item.material_id)
            unit_cost = float(material.cost_per_unit) if material and material.cost_per_unit else 0
            
            materials.append({
                'material_id': item.material_id,
                'material_name': material.name if material else None,
                'material_code': material.code if material else None,
                'quantity_required': quantity_required,
                'uom': item.uom,
                'unit_cost': unit_cost,
                'total_cost': quantity_required * unit_cost,
                'bom_item_id': item.id
            })
        
        return materials
        
    except Exception as e:
        print(f"Error calculating material requirements: {str(e)}")
        return []


def auto_create_fg_conversion_after_qc(qc_inspection_id, user_id):
    """
    Auto-create FG conversion after QC inspection passes
    
    Args:
        qc_inspection_id: QC Inspection ID
        user_id: User ID who triggered the conversion
        
    Returns:
        (success, message, conversion_id)
    """
    try:
        # Get QC inspection
        qc = QualityInspection.query.get(qc_inspection_id)
        if not qc:
            return False, "QC Inspection not found", None
        
        # Only auto-create if QC status is 'pass'
        if qc.status != 'pass':
            return False, f"QC status is '{qc.status}', not 'pass'. Cannot auto-create conversion.", None
        
        # Get Work Order from QC
        work_order_id = qc.work_order_id
        if not work_order_id:
            return False, "QC Inspection has no Work Order linked", None
        
        wo = WorkOrder.query.get(work_order_id)
        if not wo:
            return False, "Work Order not found", None
        
        # Get batch number
        batch_number = wo.batch_number
        if not batch_number:
            return False, "Work Order has no batch number", None
        
        # Check if conversion already exists
        existing = FGConversion.query.filter_by(
            work_order_id=work_order_id,
            batch_number=batch_number
        ).first()
        
        if existing:
            return False, f"FG Conversion already exists: {existing.conversion_number}", existing.id
        
        # Get WIP product (should have "WIP" prefix)
        wip_product = wo.product
        if not wip_product:
            return False, "Work Order has no product", None
        
        # Find corresponding FG product (remove "WIP" prefix)
        fg_product_name = wip_product.name.replace("WIP ", "").replace("WIP", "").strip()
        fg_product = Product.query.filter(
            Product.name.like(f"%{fg_product_name}%"),
            ~Product.name.like("%WIP%")
        ).first()
        
        if not fg_product:
            return False, f"FG product not found for WIP product: {wip_product.name}", None
        
        # Get WIP quantity from WO
        wip_quantity = float(wo.quantity_good or wo.quantity_produced or 0)
        if wip_quantity <= 0:
            return False, "Work Order has no good quantity produced", None
        
        # For now, assume FG quantity = WIP quantity (no loss)
        # User can edit this later
        fg_quantity = wip_quantity
        
        # Calculate expiry date (example: 1 year from production)
        production_date = qc.inspection_date.date() if qc.inspection_date else date.today()
        expiry_date = production_date + timedelta(days=365)
        
        # Get pack per carton from BOM
        bom = BillOfMaterials.query.filter_by(
            product_id=fg_product.id,
            is_active=True
        ).first()
        pack_per_carton = bom.pack_per_carton if bom else 1
        
        # Create conversion
        conversion = FGConversion(
            conversion_number=generate_conversion_number(),
            work_order_id=work_order_id,
            batch_number=batch_number,
            qc_inspection_id=qc_inspection_id,
            qc_status='pass',
            qc_date=qc.inspection_date,
            conversion_date=datetime.now(),
            conversion_type='auto',
            status='draft',
            batch_validated=False,  # Will be validated when user reviews
            created_by=user_id
        )
        
        db.session.add(conversion)
        db.session.flush()  # Get conversion ID
        
        # Create conversion item
        item = FGConversionItem(
            conversion_id=conversion.id,
            wip_product_id=wip_product.id,
            wip_quantity=wip_quantity,
            fg_product_id=fg_product.id,
            fg_quantity=fg_quantity,
            loss_quantity=0,
            loss_percentage=0,
            batch_number=batch_number,
            expiry_date=expiry_date,
            production_date=production_date,
            uom='pcs',
            pack_per_carton=pack_per_carton,
            total_cartons=int(fg_quantity / pack_per_carton) if pack_per_carton > 0 else 0
        )
        
        db.session.add(item)
        
        # Calculate and add material requirements
        materials = calculate_material_requirements(fg_product.id, fg_quantity)
        
        for mat in materials:
            material = FGConversionMaterial(
                conversion_id=conversion.id,
                material_id=mat['material_id'],
                quantity_required=mat['quantity_required'],
                quantity_consumed=mat['quantity_required'],  # Default to required
                uom=mat['uom'],
                unit_cost=mat['unit_cost'],
                total_cost=mat['total_cost'],
                deducted_from_inventory=False
            )
            db.session.add(material)
        
        # Update conversion totals
        conversion.total_wip_qty = wip_quantity
        conversion.total_fg_qty = fg_quantity
        conversion.total_loss_qty = 0
        conversion.total_material_cost = sum(m['total_cost'] for m in materials)
        
        db.session.commit()
        
        return True, f"FG Conversion created successfully: {conversion.conversion_number}", conversion.id
        
    except Exception as e:
        db.session.rollback()
        print(f"Error auto-creating FG conversion: {str(e)}")
        import traceback
        traceback.print_exc()
        return False, f"Error: {str(e)}", None


def validate_batch_output(work_order_id, batch_number):
    """
    Validate batch output is within ±10% of ingredient quantity
    
    Args:
        work_order_id: Work Order ID
        batch_number: Batch number to validate
        
    Returns:
        (is_valid, message, ingredient_qty, output_qty, tolerance_pct)
    """
    try:
        from models.production import ShiftProduction
        from sqlalchemy import func
        
        wo = WorkOrder.query.get(work_order_id)
        if not wo:
            return False, "Work Order not found", 0, 0, 0
        
        # Get ingredient quantity from batch (this should come from ingredient mixing record)
        # For now, we'll use WO quantity as reference
        ingredient_qty = float(wo.quantity or 0)
        
        # Get output mesin quantity (from shift production)
        output_qty = db.session.query(func.sum(ShiftProduction.good_quantity)).filter(
            ShiftProduction.work_order_id == work_order_id,
            ShiftProduction.batch_number == batch_number
        ).scalar() or 0
        output_qty = float(output_qty)
        
        if ingredient_qty == 0:
            return False, "Ingredient quantity is zero", 0, output_qty, 0
        
        # Calculate tolerance
        tolerance_pct = abs((output_qty - ingredient_qty) / ingredient_qty * 100)
        
        if tolerance_pct <= 10:
            return True, "Batch validated successfully", ingredient_qty, output_qty, tolerance_pct
        else:
            return False, f"Output variance {tolerance_pct:.1f}% exceeds ±10% tolerance", ingredient_qty, output_qty, tolerance_pct
            
    except Exception as e:
        return False, f"Validation error: {str(e)}", 0, 0, 0


def calculate_loss_cost_impact(loss_quantity, product_id=None, material_id=None):
    """
    Calculate cost impact of loss/reject
    
    Args:
        loss_quantity: Quantity lost
        product_id: Product ID (if loss is product)
        material_id: Material ID (if loss is material)
        
    Returns:
        (unit_cost, total_cost_impact)
    """
    try:
        unit_cost = 0
        
        if product_id:
            product = Product.query.get(product_id)
            if product and product.cost:
                unit_cost = float(product.cost)
        elif material_id:
            material = Material.query.get(material_id)
            if material and material.cost_per_unit:
                unit_cost = float(material.cost_per_unit)
        
        total_cost = loss_quantity * unit_cost
        
        return unit_cost, total_cost
        
    except Exception as e:
        print(f"Error calculating loss cost: {str(e)}")
        return 0, 0


def get_wip_stock_available(wip_product_id):
    """
    Get available WIP stock for a product
    
    Args:
        wip_product_id: WIP Product ID
        
    Returns:
        dict with quantity_pcs, quantity_carton, pack_per_carton
    """
    try:
        wip_stock = WIPStock.query.filter_by(product_id=wip_product_id).first()
        
        if not wip_stock:
            return {
                'quantity_pcs': 0,
                'quantity_carton': 0,
                'pack_per_carton': 1,
                'available': False
            }
        
        return {
            'quantity_pcs': wip_stock.quantity_pcs,
            'quantity_carton': wip_stock.quantity_carton,
            'pack_per_carton': wip_stock.pack_per_carton,
            'available': wip_stock.quantity_pcs > 0
        }
        
    except Exception as e:
        print(f"Error getting WIP stock: {str(e)}")
        return {
            'quantity_pcs': 0,
            'quantity_carton': 0,
            'pack_per_carton': 1,
            'available': False
        }


def check_material_availability(materials_list):
    """
    Check if materials are available in inventory
    
    Args:
        materials_list: List of dict with material_id and quantity_required
        
    Returns:
        dict with availability status and shortage details
    """
    try:
        from models.warehouse import Inventory
        from sqlalchemy import func
        
        shortages = []
        all_available = True
        
        for mat in materials_list:
            material_id = mat.get('material_id')
            quantity_required = mat.get('quantity_required', 0)
            
            # Get total available stock
            total_available = db.session.query(
                func.sum(Inventory.quantity_available)
            ).filter(
                Inventory.material_id == material_id,
                Inventory.is_active == True
            ).scalar() or 0
            
            total_available = float(total_available)
            
            if total_available < quantity_required:
                all_available = False
                material = Material.query.get(material_id)
                shortages.append({
                    'material_id': material_id,
                    'material_name': material.name if material else None,
                    'required': quantity_required,
                    'available': total_available,
                    'shortage': quantity_required - total_available
                })
        
        return {
            'all_available': all_available,
            'shortages': shortages,
            'total_shortages': len(shortages)
        }
        
    except Exception as e:
        print(f"Error checking material availability: {str(e)}")
        return {
            'all_available': False,
            'shortages': [],
            'total_shortages': 0,
            'error': str(e)
        }
