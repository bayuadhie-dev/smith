import os
from flask import Blueprint, request, jsonify, render_template, send_file
from models import db
from models.settings import SystemSetting
from sqlalchemy import text
from datetime import datetime
from utils.timezone import get_local_now

config_manager_bp = Blueprint('config_manager', __name__, template_folder='../templates')

def get_project_root():
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def seed_default_configs():
    """Seed the default configuration settings if they do not exist"""
    default_settings = [
        {
            'key': 'job_costing.labor_rate',
            'category': 'job_costing',
            'name': 'Direct Labor Rate per Hour',
            'value': '25000',
            'type': 'integer',
            'description': 'Tarif biaya upah tenaga kerja langsung per jam (Rupiah)'
        },
        {
            'key': 'job_costing.overhead_rate',
            'category': 'job_costing',
            'name': 'Machine Overhead Rate per Hour',
            'value': '50000',
            'type': 'integer',
            'description': 'Tarif biaya overhead mesin per jam (Rupiah)'
        },
        {
            'key': 'job_costing.material_cost_per_unit',
            'category': 'job_costing',
            'name': 'Estimated Material Cost per Unit',
            'value': '50000',
            'type': 'integer',
            'description': 'Estimasi biaya bahan baku per unit produk jika tidak didefinisikan di BOM (Rupiah)'
        },
        {
            'key': 'production.fallback_dry_weight',
            'category': 'production',
            'name': 'Fallback Dry Weight per Pack',
            'value': '0.8',
            'type': 'float',
            'description': 'Berat kering default per pack (kg) jika spesifikasi produk tidak ditemukan.'
        },
        {
            'key': 'production.fallback_liquid_volume',
            'category': 'production',
            'name': 'Fallback Liquid Volume per Pack',
            'value': '0.5',
            'type': 'float',
            'description': 'Volume cairan default per pack (Liter) jika spesifikasi produk tidak ditemukan.'
        },
        {
            'key': 'production.fallback_final_weight',
            'category': 'production',
            'name': 'Fallback Final Weight per Pack',
            'value': '1.2',
            'type': 'float',
            'description': 'Berat akhir default per pack (kg) jika spesifikasi produk tidak ditemukan.'
        }
    ]
    
    try:
        for ds in default_settings:
            setting = SystemSetting.query.filter_by(setting_key=ds['key']).first()
            if not setting:
                new_setting = SystemSetting(
                    setting_key=ds['key'],
                    setting_category=ds['category'],
                    setting_name=ds['name'],
                    setting_value=ds['value'],
                    data_type=ds['type'],
                    description=ds['description'],
                    is_editable=True
                )
                db.session.add(new_setting)
        db.session.commit()
        print("✓ Default system configuration settings seeded successfully.")
    except Exception as e:
        db.session.rollback()
        print(f"Error seeding default configurations: {e}")

@config_manager_bp.route('/')
def index():
    """Serve the configuration manager GUI"""
    template_path = os.path.join(get_project_root(), 'templates', 'config_manager.html')
    if os.path.exists(template_path):
        return send_file(template_path)
    return render_template('config_manager.html')

@config_manager_bp.route('/api/configs', methods=['GET'])
def get_configs():
    """Retrieve all editable system configurations"""
    try:
        seed_default_configs() # Ensure defaults are seeded
        settings = SystemSetting.query.order_by(SystemSetting.setting_category, SystemSetting.setting_key).all()
        
        result = []
        for s in settings:
            # We want to display all settings that are editable
            result.append({
                'id': s.id,
                'key': s.setting_key,
                'category': s.setting_category,
                'name': s.setting_name or s.setting_key.split('.')[-1].replace('_', ' ').title(),
                'value': s.setting_value,
                'type': s.data_type or 'string',
                'description': s.description or '',
                'is_editable': s.is_editable
            })
            
        return jsonify({
            'success': True,
            'configs': result,
            'total': len(result)
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@config_manager_bp.route('/api/configs', methods=['POST', 'PUT'])
def update_configs():
    """Update configuration values"""
    try:
        data = request.get_json() or {}
        updates = data.get('updates', [])
        
        # If received as a simple dict mapping key to value
        if not updates and isinstance(data, dict):
            updates = [{'key': k, 'value': str(v)} for k, v in data.items() if k != 'updates']
            
        updated_count = 0
        for item in updates:
            key = item.get('key')
            val = item.get('value')
            
            # Find setting by key
            setting = SystemSetting.query.filter_by(setting_key=key).first()
            if setting and setting.is_editable:
                # Format boolean value safely
                if setting.data_type == 'boolean':
                    if isinstance(val, bool):
                        setting.setting_value = 'true' if val else 'false'
                    else:
                        setting.setting_value = 'true' if str(val).lower() in ['true', '1', 'yes'] else 'false'
                else:
                    setting.setting_value = str(val)
                
                setting.updated_at = get_local_now()
                updated_count += 1
                
        db.session.commit()
        return jsonify({
            'success': True,
            'message': f'Berhasil memperbarui {updated_count} pengaturan.'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
