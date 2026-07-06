import sys
import os

# Set system path to import app and models
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from models.settings import SystemSetting
from models.converting import ConvertingMachine

def migrate():
    app = create_app()
    with app.app_context():
        # 1. Update system setting default_target_efficiency
        setting = SystemSetting.query.filter_by(setting_key='converting.default_target_efficiency').first()
        if setting:
            setting.setting_value = '80.0'
            print("✓ Updated system setting converting.default_target_efficiency to 80.0")
        else:
            db.session.add(SystemSetting(
                setting_key='converting.default_target_efficiency',
                setting_category='converting',
                setting_name='Converting Default Target Efficiency',
                setting_value='80.0',
                data_type='float',
                is_editable=True
            ))
            print("✓ Added system setting converting.default_target_efficiency with value 80.0")

        # 2. Update target_efficiency for all active converting machines to 80.0
        machines = ConvertingMachine.query.all()
        updated_count = 0
        for m in machines:
            m.target_efficiency = 80.0
            updated_count += 1
            
        db.session.commit()
        print(f"✓ Updated target_efficiency to 80.0 for {updated_count} converting machines.")

if __name__ == '__main__':
    migrate()
