"""Setiap modul di paket ini mendaftarkan satu atau lebih ImportKind ke utils.import_center.REGISTRY."""
import importlib
import pkgutil
import traceback

for _m in pkgutil.iter_modules(__path__):
    try:
        importlib.import_module(f'{__name__}.{_m.name}')
    except Exception:  # satu modul rusak tidak boleh menjatuhkan aplikasi
        print(f'[imports] gagal memuat {_m.name}:')
        traceback.print_exc()
