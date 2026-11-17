"""Isi atau ubah satu pengaturan sistem (tabel system_settings) dari baris perintah.

Dipakai untuk nilai yang beda per perusahaan, jadi tidak boleh ditaruh di migrasi
(migrasi jalan di semua server). Contoh: nama penyetuju yang dicetak di lembar PO.

    python scripts/set_system_setting.py general.po_approver_name "Hizkia Wijaya"

Kalau kuncinya belum ada, baris baru dibuat dengan kategori 'general' dan tipe
'string'. Tanpa argumen, isi pengaturan yang ada ditampilkan saja.
"""
import sys

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
