"""Set or change one system setting (system_settings table) from the shell.

For values that differ per company, which therefore must not live in a
migration (migrations run on every server). Example: the approver name printed
on the purchase order sheet.

    python scripts/set_system_setting.py general.po_approver_name "Hizkia Wijaya"

If the key does not exist yet it is created with category 'general' and type
'string'. With no arguments the current settings are listed instead.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models import db
from models.settings import SystemSetting

app = create_app()


def main(argv):
    with app.app_context():
        if not argv:
            for s in SystemSetting.query.order_by(SystemSetting.setting_key).all():
                print(f'{s.setting_key} = {s.setting_value!r}')
            return 0
        if len(argv) != 2:
            print(__doc__)
            return 2
        key, value = argv
        row = SystemSetting.query.filter_by(setting_key=key).first()
        if row:
            print(f'{key}: {row.setting_value!r} -> {value!r}')
            row.setting_value = value
        else:
            print(f'{key}: (baru) -> {value!r}')
            db.session.add(SystemSetting(setting_key=key, setting_category='general', setting_name=key,
                                         setting_value=value, data_type='string', is_editable=True))
        db.session.commit()
        return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
