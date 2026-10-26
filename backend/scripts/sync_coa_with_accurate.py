"""Make the chart of accounts identical to the real Accurate chart (data/accurate_gl_live.json).

  cd backend && PYTHONPATH=. python scripts/sync_coa_with_accurate.py            # dry run
  cd backend && PYTHONPATH=. python scripts/sync_coa_with_accurate.py --apply

* accounts whose code and name already match are kept (name/type/flags refreshed);
* an account that holds transactions or settings but has a different name than Accurate's account with that
  code is MOVED to the Accurate account with the same name (all foreign keys + journal lines re-pointed),
  or to an explicit override below;
* unused wrong accounts are overwritten / deleted; missing Accurate accounts are created;
* hierarchy (parent), header and cash/bank flags are rebuilt from the codes and Accurate's account types.
Aborts (nothing written) if any used account cannot be placed, or if a per-account balance changes.
"""
import json
import os
import re
import sys

sys.path.insert(0, '.')

from sqlalchemy import text

from app import create_app
from models import db

TYPE_MAP = {
    'CASH_BANK': ('asset', 'debit'), 'ACCOUNT_RECEIVABLE': ('asset', 'debit'), 'OTHER_CURRENT_ASSET': ('asset', 'debit'),
    'FIXED_ASSET': ('asset', 'debit'), 'OTHER_ASSET': ('asset', 'debit'), 'INVENTORY': ('asset', 'debit'),
    'ACCUMULATED_DEPRECIATION': ('asset', 'credit'),
    'ACCOUNT_PAYABLE': ('liability', 'credit'), 'OTHER_CURRENT_LIABILITY': ('liability', 'credit'),
    'LONG_TERM_LIABILITY': ('liability', 'credit'), 'EQUITY': ('equity', 'credit'),
    'REVENUE': ('revenue', 'credit'), 'OTHER_INCOME': ('revenue', 'credit'),
    'COGS': ('expense', 'debit'), 'EXPENSE': ('expense', 'debit'), 'OTHER_EXPENSE': ('expense', 'debit'),
}

# DB code -> Accurate code, for used accounts that cannot be matched by name.
OVERRIDES = {
    '700005': '700009',   # generic "Bunga Kredit Bank" -> "Bunga Kredit lainnya"
    '710003': '510104',   # Biaya Penyusutan Mesin dan Peralatan -> Biaya Penyusutan Mesin (factory)
}
# Same account, only the wording differs: keep the row and adopt Accurate's name.
ADOPT = {'100001'}        # Kas Operasional -> Kas IDR

norm = lambda s: re.sub(r'[^a-z0-9]', '', (s or '').lower())


def main(apply):
    app = create_app()
    with app.app_context():
        q = lambda sql, **k: db.session.execute(text(sql), k)
        path = os.path.join(os.path.dirname(__file__), '..', 'data', 'accurate_gl_live.json')
        A = {r['account_no']: r for r in json.load(open(path))}
        by_name = {}
        for code, r in A.items():
            by_name.setdefault(norm(r['name']), []).append(code)

        fks = q("""select distinct tc.table_name, kcu.column_name from information_schema.table_constraints tc
                   join information_schema.key_column_usage kcu on tc.constraint_name=kcu.constraint_name
                   join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name
                   where tc.constraint_type='FOREIGN KEY' and ccu.table_name='accounts' and tc.table_name <> 'accounts'""").fetchall()

        def usage(acc_id):
            n = 0
            for table, col in fks:
                n += q(f'select count(*) from "{table}" where "{col}"=:i', i=acc_id).scalar()
            return n

        rows = q("select id, account_code, account_name from accounts").fetchall()
        before_by_code = {}
        for code, bal in q("select account_code, sum(debit_amount-credit_amount) from accounting_entries group by 1").fetchall():
            before_by_code[code] = float(bal or 0)
        before_total = float(q("select coalesce(sum(debit_amount-credit_amount),0) from accounting_entries").scalar())

        plan_move, plan_delete, plan_keep, unresolved = {}, [], [], []
        for acc_id, code, name in rows:
            real = A.get(code)
            if real and norm(real['name']) == norm(name):
                plan_keep.append(acc_id)
                continue
            used = usage(acc_id)
            target = None
            if code in ADOPT and real:
                plan_keep.append(acc_id)
                continue
            if code in OVERRIDES:
                target = OVERRIDES[code]
            else:
                cands = [c for c in by_name.get(norm(name), []) if c != code]
                if len(cands) == 1:
                    target = cands[0]
            if target:
                plan_move[acc_id] = (code, name, target)
            elif used == 0:
                if real:
                    plan_keep.append(acc_id)      # unused: overwritten in place with Accurate's version
                else:
                    plan_delete.append((acc_id, code, name))
            else:
                unresolved.append((code, name, used))

        print(f'[plan] cocok: {len(plan_keep)} | dipindah: {len(plan_move)} | dihapus (tak terpakai, tak ada di Accurate): {len(plan_delete)} | belum bisa ditempatkan: {len(unresolved)}')
        for acc_id, (code, name, target) in sorted(plan_move.items(), key=lambda x: x[1][0]):
            print(f'   pindah {code} "{name}" -> {target} "{A[target]["name"]}"  (pemakaian: {usage(acc_id)})')
        for _, code, name in plan_delete:
            print(f'   hapus  {code} "{name}"')
        if unresolved:
            for u in unresolved:
                print('   !! BELUM BISA DITEMPATKAN:', u)
            raise SystemExit('Berhenti: ada akun terpakai yang belum punya tujuan. Tambahkan ke OVERRIDES.')

        # phase 0: free the codes of accounts that will move / be deleted
        for acc_id in list(plan_move) + [d[0] for d in plan_delete]:
            q("update accounts set account_code=:c where id=:i", c=f'MV-{acc_id}', i=acc_id)
        db.session.flush()

        # phase 1: upsert every Accurate account
        children = {}
        for code in A:
            for other in A:
                if other != code and other.startswith(code) and len(other) > len(code):
                    children[code] = True
                    break
        created = updated = 0
        for code, r in A.items():
            typ, normal = TYPE_MAP.get(r['account_type'], ('asset', 'debit'))
            header = len(code) == 4 or code in children
            cash = r['account_type'] == 'CASH_BANK' and not header
            row = q("select id, account_type, normal_balance from accounts where account_code=:c", c=code).fetchone()
            if row:
                q("update accounts set account_name=:n, account_type=:t, is_header=:h, is_cash_bank=:cb, is_active=true where id=:i",
                  n=r['name'], t=typ, h=header, cb=cash, i=row[0])
                updated += 1
            else:
                q("insert into accounts (account_code, account_name, account_type, normal_balance, is_header, is_cash_bank, level, is_active, created_at, updated_at) "
                  "values (:c,:n,:t,:nb,:h,:cb,1,true,now(),now())", c=code, n=r['name'], t=typ, nb=normal, h=header, cb=cash)
                created += 1
        db.session.flush()

        # phase 2: re-point the moved accounts, then drop them
        id_of = {c: i for i, c in q("select id, account_code from accounts").fetchall()}
        moved_refs = 0
        for acc_id, (code, name, target) in plan_move.items():
            new_id = id_of[target]
            for table, col in fks:
                moved_refs += q(f'update "{table}" set "{col}"=:n where "{col}"=:o', n=new_id, o=acc_id).rowcount
            for pid, lines in q("select id, lines from pending_journal_entries").fetchall():
                data = lines if isinstance(lines, list) else json.loads(lines or '[]')
                changed = False
                for line in data:
                    if line.get('account_id') == acc_id:
                        line['account_id'] = new_id
                        changed = True
                if changed:
                    q("update pending_journal_entries set lines=cast(:l as json) where id=:i", l=json.dumps(data), i=pid)
        q("update accounting_entries e set account_code=a.account_code, account_name=a.account_name from accounts a where a.id=e.account_id")
        q("update accounts set parent_id=null where parent_id in (select id from accounts where account_code like 'MV-%')")
        for acc_id in list(plan_move) + [d[0] for d in plan_delete]:
            q("delete from accounts where id=:i", i=acc_id)

        # phase 3: hierarchy
        header_codes = sorted((c for c in A if len(c) == 4 or c in children), key=len)
        for code in A:
            parent = None
            for hc in sorted((h for h in header_codes if code.startswith(h) and len(h) < len(code)), key=len, reverse=True):
                parent = hc
                break
            q("update accounts set parent_id=(select id from accounts p where p.account_code=:p), level=:lvl where account_code=:c",
              p=parent, lvl=2 if parent else 1, c=code)
        print(f'[sync] dibuat {created}, diperbarui {updated}, referensi dipindah {moved_refs}')

        # verification
        after_total = float(q("select coalesce(sum(debit_amount-credit_amount),0) from accounting_entries").scalar())
        assert abs(before_total - after_total) < 0.01, 'total berubah'
        expected = {}
        code_by_id = {i: c for i, c in rows and [(r[0], r[1]) for r in rows]}
        for old_code, bal in before_by_code.items():
            moved_to = next((t for (c, n, t) in plan_move.values() if c == old_code), old_code)
            expected[moved_to] = expected.get(moved_to, 0) + bal
        bad = []
        for code, bal in q("select account_code, sum(debit_amount-credit_amount) from accounting_entries group by 1").fetchall():
            if abs(expected.get(code, 0) - float(bal or 0)) > 0.01:
                bad.append((code, expected.get(code, 0), float(bal or 0)))
        assert not bad, f'saldo per akun berubah: {bad[:5]}'
        missing_ids = q("select count(*) from accounting_entries where account_id is null").scalar()
        print(f'[verifikasi] OK: saldo per akun sama, entri tanpa akun: {missing_ids}, total akun: {q("select count(*) from accounts").scalar()}')
        if apply:
            db.session.commit()
            print('SELESAI: diterapkan.')
        else:
            db.session.rollback()
            print('SIMULASI: tidak ada yang disimpan. Jalankan dengan --apply.')


if __name__ == '__main__':
    main('--apply' in sys.argv)
