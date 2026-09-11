"""One-time seed: GlobalAccountDefault keys for fixed asset disposal GL posting.

erp_db: single generic chart -> generic keys.
erp_db_v2: per-category accumulated-depreciation accounts -> category-specific keys
(category_slug = FixedAsset.category.lower(), spaces->'_', ' & '->'_dan_'),
falling back to a generic 'akumulasi_penyusutan' key if no per-category match at lookup time.

Run once per database (pass DATABASE_URL env var to target erp_db_v2).
"""
import os
from app import create_app
from models import db
from models.finance import GlobalAccountDefault, Account

app = create_app()

GENERIC_MAPPING = {
    'akumulasi_penyusutan': ['1-2100', '110203'],  # generic fallback: prefer a literal generic account, else Mesin & Peralatan
    'laba_pelepasan_aset': ['4-9000', '800005'],
    'rugi_pelepasan_aset': ['9-9000', '700011'],
}

CATEGORY_MAPPING = {
    'akumulasi_penyusutan_bangunan': ['110201'],
    'akumulasi_penyusutan_instalasi_listrik': ['110202'],
    'akumulasi_penyusutan_inventaris_kantor': ['110205'],
    'akumulasi_penyusutan_inventaris_pabrik': ['110204'],
    'akumulasi_penyusutan_kendaraan': ['110206'],
    'akumulasi_penyusutan_mesin_dan_peralatan': ['110203'],
}

with app.app_context():
    all_mappings = {**GENERIC_MAPPING, **CATEGORY_MAPPING}
    for key, codes in all_mappings.items():
        existing = GlobalAccountDefault.query.filter_by(transaction_key=key).first()
        if existing:
            print(f'{key}: already exists -> account_id {existing.account_id}')
            continue
        acc = None
        for code in codes:
            acc = Account.query.filter_by(account_code=code).first()
            if acc:
                break
        if not acc:
            print(f'{key}: none of {codes} found, skip')
            continue
        db.session.add(GlobalAccountDefault(
            transaction_key=key, account_id=acc.id,
            description=f'Auto-seeded for fixed asset disposal ({acc.account_name})'
        ))
        print(f'{key}: seeded -> {acc.account_code} {acc.account_name}')
    db.session.commit()
