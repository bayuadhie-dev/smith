"""kas kecil jadi pembukuan: akun beban per kategori, mode persetujuan kertas, sambungan ke transfer

Revision ID: d6f8b0c2e4a7
Revises: c5e7a9b1d3f4
"""
from alembic import op
import sqlalchemy as sa

revision = 'd6f8b0c2e4a7'
down_revision = 'c5e7a9b1d3f4'
branch_labels = None
depends_on = None

# Kategori kas kecil yang belum punya akun beban di COA Fengsheng.
# Dibuat di bawah induk 6201 "Beban Utiliti, Adm, Sewa & Lainnya"; kalau induk
# itu tidak ada (COA perusahaan lain), pembuatan akun dilewati dan pemetaannya
# diisi manual lewat tab Pengaturan.
NEW_ACCOUNTS = [
    ('620133', 'Biaya Konsumsi', 'Makan, minum, dan jamuan ringan'),
    ('620134', 'Biaya Kebersihan & Perawatan', 'Alat kebersihan dan perawatan ringan'),
    ('620135', 'Biaya Kesehatan & P3K', 'Obat dan perlengkapan P3K'),
    ('620136', 'Biaya Kebutuhan Karyawan', 'Keperluan harian karyawan'),
]


def _cols(table):
    return [c['name'] for c in sa.inspect(op.get_bind()).get_columns(table)]


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)

    have = _cols('petty_cash_funds')
    if 'expense_account_id' not in have:
        op.add_column('petty_cash_funds', sa.Column('expense_account_id', sa.Integer(), sa.ForeignKey('accounts.id'), nullable=True))
    if 'approval_mode' not in have:
        op.add_column('petty_cash_funds', sa.Column('approval_mode', sa.String(10), nullable=False, server_default='paper'))
    if 'opening_balance' not in have:
        op.add_column('petty_cash_funds', sa.Column('opening_balance', sa.Numeric(18, 2), nullable=False, server_default='0'))

    have = _cols('petty_cash_transactions')
    if 'over_limit' not in have:
        op.add_column('petty_cash_transactions', sa.Column('over_limit', sa.Boolean(), nullable=False, server_default=sa.false()))
    if 'journal_number' not in have:
        op.add_column('petty_cash_transactions', sa.Column('journal_number', sa.String(50), nullable=True))
    if 'expense_account_id' not in have:
        op.add_column('petty_cash_transactions', sa.Column('expense_account_id', sa.Integer(), sa.ForeignKey('accounts.id'), nullable=True))

    have = _cols('bank_transfers')
    if 'petty_cash_fund_id' not in have:
        op.add_column('bank_transfers', sa.Column('petty_cash_fund_id', sa.Integer(), sa.ForeignKey('petty_cash_funds.id'), nullable=True))
    if 'petty_cash_replenishment_id' not in have:
        op.add_column('bank_transfers', sa.Column('petty_cash_replenishment_id', sa.Integer(), sa.ForeignKey('petty_cash_replenishments.id'), nullable=True))

    if 'petty_cash_category_accounts' not in insp.get_table_names():
        op.create_table(
            'petty_cash_category_accounts',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('fund_id', sa.Integer(), sa.ForeignKey('petty_cash_funds.id', ondelete='CASCADE'), nullable=False),
            sa.Column('category', sa.String(100), nullable=False),
            sa.Column('account_id', sa.Integer(), sa.ForeignKey('accounts.id'), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint('fund_id', 'category', name='uq_petty_cash_category_account'),
        )

    # Akun beban baru untuk kategori yang belum punya padanan (hanya kalau induk 6201 ada)
    parent = bind.execute(sa.text("select id from accounts where account_code = '6201'")).scalar()
    if parent:
        for code, name, note in NEW_ACCOUNTS:
            if bind.execute(sa.text("select 1 from accounts where account_code = :c"), {'c': code}).first():
                continue
            bind.execute(sa.text("""
                insert into accounts (account_code, account_name, account_type, parent_id, level, normal_balance,
                                      is_active, is_header, is_cash_bank, currency, description, created_at, updated_at)
                values (:c, :n, 'expense', :p, 2, 'debit', true, false, false, 'IDR', :d, now(), now())
            """), {'c': code, 'n': name, 'p': parent, 'd': note})


    # Pemetaan awal kategori -> akun beban (bisa diubah di tab Pengaturan).
    # Hanya untuk dana yang belum punya pemetaan sama sekali.
    peta = {
        'Konsumsi': '620133',
        'ATK dan fotokopi': '620107',
        'Transport dan ongkos kirim kecil': '620117',
        'Perawatan dan kebersihan': '620134',
        'Kebutuhan karyawan': '620136',
        'Kesehatan dan P3K': '620135',
        'Administrasi (materai, legalisir)': '620105',
        'Lainnya': '620118',
    }
    akun = {code: bind.execute(sa.text("select id from accounts where account_code = :c"), {'c': code}).scalar()
            for code in set(peta.values())}
    for (fund_id,) in bind.execute(sa.text("select id from petty_cash_funds")).fetchall():
        if bind.execute(sa.text("select 1 from petty_cash_category_accounts where fund_id = :f"), {'f': fund_id}).first():
            continue
        for kategori, code in peta.items():
            if akun.get(code):
                bind.execute(sa.text("""
                    insert into petty_cash_category_accounts (fund_id, category, account_id, created_at, updated_at)
                    values (:f, :k, :a, now(), now())
                """), {'f': fund_id, 'k': kategori, 'a': akun[code]})
        if akun.get('620118'):
            bind.execute(sa.text("update petty_cash_funds set expense_account_id = coalesce(expense_account_id, :a) where id = :f"),
                         {'a': akun['620118'], 'f': fund_id})


def downgrade():
    op.drop_table('petty_cash_category_accounts')
    for t, c in (('bank_transfers', 'petty_cash_replenishment_id'), ('bank_transfers', 'petty_cash_fund_id'),
                 ('petty_cash_transactions', 'expense_account_id'), ('petty_cash_transactions', 'journal_number'),
                 ('petty_cash_transactions', 'over_limit'), ('petty_cash_funds', 'opening_balance'),
                 ('petty_cash_funds', 'approval_mode'), ('petty_cash_funds', 'expense_account_id')):
        op.drop_column(t, c)
