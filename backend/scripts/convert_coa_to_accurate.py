"""Convert the legacy chart of accounts ('1-1100' style) to the Accurate chart, in place.

  cd backend && PYTHONPATH=. python scripts/convert_coa_to_accurate.py            # dry run
  cd backend && PYTHONPATH=. python scripts/convert_coa_to_accurate.py --apply

1. Upserts every account in data/accurate_coa.csv (hierarchy derived from the code prefix).
2. Re-points every foreign key that references a legacy account (journal lines, payments, products,
   settings, pending-journal JSON ...) to its Accurate equivalent (LEGACY_MAP), refreshes the
   denormalised code/name on accounting_entries, then deletes the legacy rows.
3. Fills the tax/company settings that the Accurate chart needs.
Idempotent; checks that total debit - credit and per-account balances are unchanged.
"""
import csv
import os
import re
import sys

sys.path.insert(0, '.')

from sqlalchemy import text

from app import create_app
from models import db

LEGACY_MAP = {
    '1-1000': '100001', '1-1010': '100101', '1-1020': '100001', '1-1100': '100201', '1-1110': '100204',
    '1-1200': '100501', '1-1300': '100502', '1-1400': '100504', '1-1500': '100503', '1-1600': '100601',
    '1-1700': '100611', '1-2000': '110104', '1-2100': '110203',
    '2-1000': '200001', '2-1050': '200702', '2-1100': '200004', '2-1110': '200606', '2-1120': '210003',
    '2-1130': '200602', '2-1140': '200602', '2-1150': '200004', '2-1200': '210008', '2-1210': '210001',
    '2-1300': '200202', '2-2000': '200302',
    '3-1000': '300003', '3-2000': '300004', '3-3000': '310005', '3-4000': '300001',
    '4-1000': '400002', '4-1100': '400102', '4-1200': '400201', '4-9000': '800005',
    '5-1000': '500002', '5-1100': '500310', '5-1200': '500101', '5-1210': '500106', '5-1220': '500115',
    '5-1300': '500305',
    '6-1000': '500310', '6-2000': '500307', '6-3000': '500305', '6-3100': '500305', '6-3200': '500304',
    '6-3300': '620118', '6-4000': '500301', '6-5000': '620111', '6-6000': '710003', '6-7000': '5300',
    '7-1000': '620001', '7-1010': '620004', '8-1000': '610012', '8-2000': '620118',
    '9-1000': '700005', '9-2000': '700010', '9-8000': '700008', '9-9000': '700011',
    '100106': '100102',
}


def main(apply):
    app = create_app()
    with app.app_context():
        q = lambda sql, **k: db.session.execute(text(sql), k)
        path = os.path.join(os.path.dirname(__file__), '..', 'data', 'accurate_coa.csv')
        with open(path, newline='') as f:
            coa = list(csv.DictReader(f))
        coa_codes = {r['account_code'] for r in coa}
        missing_targets = sorted({v for v in LEGACY_MAP.values() if v not in coa_codes})
        assert not missing_targets, f'targets not in CSV: {missing_targets}'

        before_total = q("select coalesce(sum(debit_amount-credit_amount),0) from accounting_entries where status='posted'").scalar()
        before_by_target = {}
        for code, bal in q("select account_code, sum(debit_amount-credit_amount) from accounting_entries group by 1").fetchall():
            tgt = LEGACY_MAP.get(code, code)
            before_by_target[tgt] = before_by_target.get(tgt, 0) + float(bal or 0)

        # 1. upsert Accurate accounts
        created = updated = 0
        for r in coa:
            row = q("select id from accounts where account_code=:c", c=r['account_code']).fetchone()
            vals = dict(c=r['account_code'], n=r['account_name'], t=r['account_type'], nb=r['normal_balance'],
                        h=r['is_header'] == 't', cb=r['is_cash_bank'] == 't', lvl=0 if len(r['account_code']) == 4 else 1)
            if row:
                q("update accounts set account_name=:n, account_type=:t, normal_balance=:nb, is_header=:h, is_cash_bank=:cb, level=:lvl, is_active=true where id=:i",
                  **vals, i=row[0])
                updated += 1
            else:
                q("insert into accounts (account_code, account_name, account_type, normal_balance, is_header, is_cash_bank, level, is_active, created_at, updated_at) "
                  "values (:c,:n,:t,:nb,:h,:cb,:lvl,true,now(),now())", **vals)
                created += 1
        db.session.flush()
        for r in coa:  # hierarchy by code prefix
            if len(r['account_code']) > 4:
                q("update accounts set parent_id=(select id from accounts p where p.account_code=:p) where account_code=:c",
                  p=r['account_code'][:4], c=r['account_code'])
        print(f'[1] akun Accurate: {created} dibuat, {updated} diperbarui')

        # 2. re-point legacy accounts
        fks = q("""select distinct tc.table_name, kcu.column_name from information_schema.table_constraints tc
                   join information_schema.key_column_usage kcu on tc.constraint_name=kcu.constraint_name
                   join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name
                   where tc.constraint_type='FOREIGN KEY' and ccu.table_name='accounts' and not (tc.table_name='accounts')""").fetchall()
        id_map = {}
        for old_code, new_code in LEGACY_MAP.items():
            old = q("select id from accounts where account_code=:c", c=old_code).fetchone()
            new = q("select id from accounts where account_code=:c", c=new_code).fetchone()
            if old and new and old[0] != new[0]:
                id_map[old[0]] = (new[0], old_code, new_code)
        moved = 0
        for old_id, (new_id, oc, nc) in id_map.items():
            for table, col in fks:
                n = q(f'update "{table}" set "{col}"=:n where "{col}"=:o', n=new_id, o=old_id).rowcount
                moved += n
            q("update accounts set parent_id=:n where parent_id=:o", n=new_id, o=old_id)
        # pending journal JSON lines hold account ids
        import json
        for pid, lines in q("select id, lines from pending_journal_entries").fetchall():
            data = lines if isinstance(lines, list) else json.loads(lines or '[]')
            changed = False
            for line in data:
                aid = line.get('account_id')
                if aid in id_map:
                    line['account_id'] = id_map[aid][0]
                    changed = True
            if changed:
                q("update pending_journal_entries set lines=cast(:l as json) where id=:i", l=json.dumps(data), i=pid)
        q("update accounting_entries e set account_code=a.account_code, account_name=a.account_name from accounts a where a.id=e.account_id")
        print(f'[2] {len(id_map)} akun lama dipindahkan, {moved} referensi diperbarui')
        for old_id, (new_id, oc, nc) in sorted(id_map.items(), key=lambda x: x[1][1]):
            print(f'     {oc} -> {nc}')
        for old_id in id_map:
            q("delete from accounts where id=:i", i=old_id)

        # 3. settings
        def set_if_null(table, col, code):
            tid = q("select id from accounts where account_code=:c", c=code).scalar()
            q(f'update "{table}" set "{col}"=:i where "{col}" is null', i=tid)
        for table, col, code in [('tax_account_settings', 'akun_ppn_masukan_id', '100611'),
                                 ('tax_account_settings', 'akun_pph22_id', '100607'),
                                 ('tax_account_settings', 'akun_pph23_id', '100608'),
                                 ('sales_account_settings', 'akun_uang_muka_pelanggan_id', '200801')]:
            set_if_null(table, col, code)

        # 4. verification
        after_total = q("select coalesce(sum(debit_amount-credit_amount),0) from accounting_entries where status='posted'").scalar()
        assert abs(float(before_total) - float(after_total)) < 0.01, 'total debit-credit changed'
        mismatches = []
        for code, bal in q("select account_code, sum(debit_amount-credit_amount) from accounting_entries group by 1").fetchall():
            if abs(before_by_target.get(code, 0) - float(bal or 0)) > 0.01:
                mismatches.append((code, before_by_target.get(code, 0), float(bal or 0)))
        assert not mismatches, f'saldo per akun berubah: {mismatches[:5]}'
        legacy_left = q("select count(*) from accounts where account_code ~ '^[0-9]-[0-9]{4}$'").scalar()
        print(f'[3] verifikasi OK: saldo per akun sama, sisa akun lama: {legacy_left}')
        if apply:
            db.session.commit()
            print('SELESAI: perubahan diterapkan.')
        else:
            db.session.rollback()
            print('SIMULASI: tidak ada yang disimpan. Jalankan dengan --apply.')


if __name__ == '__main__':
    main('--apply' in sys.argv)
