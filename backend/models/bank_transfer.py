from datetime import datetime

from . import db


class BankTransfer(db.Model):
    """Pindah dana antar akun kas/bank milik perusahaan sendiri (mis. Bank BCA -> Kas Purbalingga).

    Mengikuti pola Accurate Online "Kas & Bank > Transfer Bank": satu transaksi
    menghasilkan jurnal Dr akun tujuan / Cr akun asal, ditambah baris biaya
    transfer yang bisa dibebankan ke akun pengirim ATAU penerima. Sebelum ada
    menu ini, Finance mencatatnya sebagai jurnal umum manual.

    Kalau kedua akun beda mata uang, `amount` adalah nilai yang keluar dari akun
    asal (mata uang akun asal) dan `amount_received` nilai yang masuk ke akun
    tujuan (mata uang akun tujuan); selisih nilai rupiahnya masuk akun selisih
    kurs, sama seperti pelunasan faktur valas.
    """
    __tablename__ = 'bank_transfers'

    id = db.Column(db.Integer, primary_key=True)
    number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    transfer_date = db.Column(db.Date, nullable=False, index=True)

    from_account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=False, index=True)
    to_account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=False, index=True)
    amount = db.Column(db.Numeric(18, 2), nullable=False)
    amount_received = db.Column(db.Numeric(18, 2), nullable=True)   # diisi hanya kalau mata uang kedua akun beda

    fee_amount = db.Column(db.Numeric(18, 2), nullable=False, default=0)
    fee_account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    fee_charged_to = db.Column(db.String(10), nullable=False, default='from')   # from = saldo pengirim, to = saldo penerima

    exchange_rate = db.Column(db.Numeric(18, 6), nullable=True)      # kurs akun asal ke IDR
    exchange_rate_to = db.Column(db.Numeric(18, 6), nullable=True)   # kurs akun tujuan ke IDR

    reference_number = db.Column(db.String(100), nullable=True)      # no. bukti transfer / cek / BG
    notes = db.Column(db.Text, nullable=True)

    status = db.Column(db.String(20), nullable=False, default='posted', index=True)   # posted, cancelled
    journal_number = db.Column(db.String(50), nullable=True)

    # Transfer yang mengisi kas kecil: menautkan pengajuan pengisian kembali supaya
    # HR tidak perlu menandai "dana diterima" sendiri.
    petty_cash_fund_id = db.Column(db.Integer, db.ForeignKey('petty_cash_funds.id'), nullable=True)
    petty_cash_replenishment_id = db.Column(db.Integer, db.ForeignKey('petty_cash_replenishments.id'), nullable=True)

    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    cancelled_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    cancelled_at = db.Column(db.DateTime, nullable=True)
    cancel_reason = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    from_account = db.relationship('Account', foreign_keys=[from_account_id])
    to_account = db.relationship('Account', foreign_keys=[to_account_id])
    fee_account = db.relationship('Account', foreign_keys=[fee_account_id])
    creator = db.relationship('User', foreign_keys=[created_by])

    def _acc(self, acc):
        return {'id': acc.id, 'code': acc.account_code, 'name': acc.account_name,
                'currency': acc.currency or 'IDR'} if acc else None

    def to_dict(self):
        return {
            'id': self.id,
            'number': self.number,
            'transfer_date': self.transfer_date.isoformat() if self.transfer_date else None,
            'from_account': self._acc(self.from_account),
            'to_account': self._acc(self.to_account),
            'fee_account': self._acc(self.fee_account),
            'amount': float(self.amount or 0),
            'amount_received': float(self.amount_received) if self.amount_received is not None else None,
            'fee_amount': float(self.fee_amount or 0),
            'fee_charged_to': self.fee_charged_to,
            'exchange_rate': float(self.exchange_rate) if self.exchange_rate else None,
            'exchange_rate_to': float(self.exchange_rate_to) if self.exchange_rate_to else None,
            'reference_number': self.reference_number,
            'notes': self.notes,
            'status': self.status,
            'journal_number': self.journal_number,
            'petty_cash_fund_id': self.petty_cash_fund_id,
            'petty_cash_replenishment_id': self.petty_cash_replenishment_id,
            'created_by_name': self.creator.full_name if self.creator else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'cancel_reason': self.cancel_reason,
        }
