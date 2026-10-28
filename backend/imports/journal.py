"""Impor Jurnal Umum dan Saldo Awal Akun lewat Pusat Impor. Memakai create_manual_journal_core (fungsi yang sama dengan form Jurnal Umum)."""
from models import db
from models.finance import Account, AccountingEntry
from utils.import_center import Col, ImportKind, parse_amount, parse_date, register, text


def _reg(cls):
    register(cls())
    return cls



def _amount(v):
    return 0.0 if v in (None, '') else parse_amount(v, allow_negative=False)


def _lines(rows):
    lines, codes = [], set()
    for n, r in rows:
        code = text(r.get('kode_akun'))
        if not code:
            raise ValueError(f'Baris {n}: Kode Akun kosong')
        acc = Account.query.filter_by(account_code=code).first()
        if not acc:
            raise ValueError(f'Baris {n}: akun {code} tidak ditemukan')
        if acc.is_header:
            raise ValueError(f'Baris {n}: akun {code} adalah akun induk, tidak boleh dijurnal')
        if not acc.is_active:
            raise ValueError(f'Baris {n}: akun {code} tidak aktif')
        try:
            debit, credit = _amount(r.get('debit')), _amount(r.get('kredit'))
        except ValueError as e:
            raise ValueError(f'Baris {n}: {e}')
        if debit and credit:
            raise ValueError(f'Baris {n}: isi salah satu, Debit atau Kredit')
        if not debit and not credit:
            raise ValueError(f'Baris {n}: Debit dan Kredit sama-sama kosong/0')
        lines.append({'account_id': acc.id, 'debit': debit, 'credit': credit, 'description': text(r.get('ket_baris'), 255)})
        codes.add(code)
    d, c = sum(l['debit'] for l in lines), sum(l['credit'] for l in lines)
    if round(d, 2) != round(c, 2):
        raise ValueError(f'Jurnal tidak seimbang: debit {d:,.2f}, kredit {c:,.2f}')
    if len(lines) < 2:
        raise ValueError('Jurnal butuh minimal 2 baris')
    return lines, d


def _same_date(rows):
    dates = {parse_date(r.get('tanggal')) for _, r in rows}
    if len(dates) > 1:
        raise ValueError('Tanggal dalam satu jurnal harus sama')
    return dates.pop()


def _post(data, user_id):
    from routes.finance import create_manual_journal_core
    if data['reference'] and AccountingEntry.query.filter_by(reference_type='manual_journal', reference_number=data['reference']).first():
        raise ValueError(f'Nomor jurnal {data["reference"]} sudah pernah dipakai')
    number, _ = create_manual_journal_core(data['date'], data['description'], data['reference'], data['lines'], user_id)
    return {'number': number}


@_reg
class ManualJournalImport(ImportKind):
    key = 'manual_journal'
    label = 'Jurnal Umum'
    description = 'Jurnal manual (debit/kredit antar akun). Baris dengan No. Jurnal sama digabung jadi satu jurnal.'
    view_permission = 'finance.view'
    create_permission = 'journal.create'
    group_field = 'no_jurnal'
    summary_columns = [('date', 'Tanggal', 'text'), ('lines', 'Baris', 'text'), ('total', 'Total Debit', 'money')]
    columns = [Col('no_jurnal', 'No. Jurnal', aliases=['no jurnal', 'nomor jurnal', 'referensi']),
               Col('tanggal', 'Tanggal', required=True), Col('kode_akun', 'Kode Akun', required=True, aliases=['akun', 'kode akun perkiraan']),
               Col('debit', 'Debit'), Col('kredit', 'Kredit', aliases=['credit']),
               Col('ket_baris', 'Keterangan Baris', aliases=['keterangan baris']), Col('ket_jurnal', 'Keterangan Jurnal', aliases=['keterangan jurnal', 'keterangan'])]
    guide = ['Setiap jurnal harus seimbang (total Debit = total Kredit) dan minimal 2 baris.',
             'Satu baris diisi salah satu: Debit atau Kredit. Akun induk tidak boleh dijurnal. Periode yang sudah ditutup ditolak.',
             'No. Jurnal dipakai sebagai nomor referensi dan tidak boleh sama dengan jurnal yang sudah ada.']
    sample_rows = [['JU-001', '2026-10-01', '600101', 1500000, '', 'Biaya admin', 'Biaya admin bank Oktober'],
                   ['JU-001', '2026-10-01', '100101', '', 1500000, '', '']]

    def build(self, key, rows):
        ref = None if key.startswith('__row') else key
        date = _same_date(rows)
        lines, total = _lines(rows)
        desc = text(rows[0][1].get('ket_jurnal'), 255) or f'Jurnal impor {ref or ""}'.strip()
        return ({'date': date, 'description': desc, 'reference': ref, 'lines': lines},
                {'date': date.isoformat(), 'lines': len(lines), 'total': round(total, 2)})

    def save(self, data, user_id):
        return _post(data, user_id)


@_reg
class OpeningBalanceImport(ImportKind):
    key = 'opening_balance'
    label = 'Saldo Awal Akun'
    description = 'Saldo awal akun perkiraan (termasuk akumulasi penyusutan awal). Satu tanggal menjadi satu jurnal saldo awal.'
    view_permission = 'finance.view'
    create_permission = 'journal.create'
    group_field = 'tanggal'
    summary_columns = [('date', 'Tanggal', 'text'), ('lines', 'Akun', 'text'), ('total', 'Total Debit', 'money')]
    columns = [Col('tanggal', 'Tanggal Saldo Awal', required=True, aliases=['tanggal']), Col('kode_akun', 'Kode Akun', required=True, aliases=['akun']),
               Col('debit', 'Debit'), Col('kredit', 'Kredit', aliases=['credit']), Col('ket_baris', 'Keterangan', aliases=['keterangan baris'])]
    guide = ['Semua baris dengan tanggal yang sama menjadi satu jurnal "Saldo awal" dan harus seimbang (Debit = Kredit).',
             'Aset dan beban di sisi Debit; kewajiban, modal, pendapatan, dan akumulasi penyusutan di sisi Kredit.',
             'Tulis tanggal dengan format yang sama di semua baris. Impor ulang untuk tanggal yang sama ditolak.']
    sample_rows = [['2026-01-01', '100101', 50000000, '', 'Saldo kas bank'],
                   ['2026-01-01', '300101', '', 50000000, 'Modal disetor']]

    def build(self, key, rows):
        date = _same_date(rows)
        lines, total = _lines(rows)
        return ({'date': date, 'description': f'Saldo awal {date.isoformat()}', 'reference': f'SALDO-AWAL-{date.isoformat()}', 'lines': lines},
                {'date': date.isoformat(), 'lines': len(lines), 'total': round(total, 2)})

    def save(self, data, user_id):
        return _post(data, user_id)
