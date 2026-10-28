"""Impor Penerimaan/Pembayaran (kas/bank mandiri dan pelunasan faktur) ke Pusat Impor.
Logika validasi dan simpan tetap dari routes/finance_payment_import.py + create_payment_core (sama dengan form)."""
from routes.finance_payment_import import ALIASES, COLUMNS, build_transactions
from utils.import_center import Col, ImportKind, register

_REQUIRED = {'tanggal', 'kas_bank', 'nilai', 'akun_lawan', 'no_faktur'}
_EXAMPLE = {
    'kas': [['2026-10-28', '', '100101', '700009', 1500000, 'PT Contoh', 'Contoh biaya admin bank', 'TRF-001'],
            ['2026-10-28', 'BUKTI-02', '100101', '600101', 2000000, 'CV Contoh', 'Contoh dibagi dua akun', ''],
            ['2026-10-28', 'BUKTI-02', '100101', '600102', -250000, '', 'Potongan (nilai negatif)', '']],
    'invoice': [['2026-10-28', '', '100101', 'INV-202610-00001', 500000, 'Pelunasan sebagian', 'TRF-001'],
                ['2026-10-28', 'BUKTI-02', '100101', 'INV-202610-00002', 300000, 'Dua faktur satu bukti', ''],
                ['2026-10-28', 'BUKTI-02', '100101', 'INV-202610-00003', 200000, '', '']],
}


def _make(ptype, source):
    word = 'Penerimaan' if ptype == 'receipt' else 'Pembayaran'
    what = 'Kas/Bank' if source == 'kas' else 'Faktur'

    class PaymentKind(ImportKind):
        key = f'{ptype}_{source}'
        label = f'{word} {what}'
        group = 'Kas & Bank'
        description = ('Transaksi kas/bank mandiri dengan akun lawan.' if source == 'kas'
                       else ('Pelunasan faktur penjualan.' if ptype == 'receipt' else 'Pelunasan faktur pembelian.'))
        view_permission = 'finance.view'
        create_permission = 'finance.create'
        group_field = 'no_bukti'
        columns = [Col(f, l, required=f in _REQUIRED, aliases=ALIASES[f]) for f, l in COLUMNS[source]]
        summary_columns = [('date', 'Tanggal', 'text'), ('bank', 'Kas/Bank', 'text'), ('total', 'Nilai', 'money')]
        sample_rows = _EXAMPLE[source]
        guide = ['Nilai boleh negatif (pengurang/pembalikan), tidak boleh 0; baris bernilai 0 dilewati.',
                 'Kas/Bank: kode akun kas/bank (contoh 100101).'] + (
            ['Akun Lawan: kode akun perkiraan (bukan akun induk, bukan akun piutang/hutang kontrol).'] if source == 'kas'
            else ['No. Faktur: nomor faktur yang dilunasi. Semua faktur dalam satu No. Bukti harus milik pelanggan/pemasok yang sama.'])

        def build(self, key, rows):
            tx = build_transactions(rows, ptype, source)[0]
            if tx['errors']:
                raise ValueError('; '.join(e.split(': ', 1)[-1] for e in tx['errors']))
            return tx['data'], tx['summary']

        def save(self, data, user_id):
            from routes.finance import create_payment_core
            resp, status = create_payment_core(data, user_id, commit=False)
            body = resp.get_json() or {}
            if status != 201:
                raise ValueError(body.get('error') or 'Gagal menyimpan')
            return {'number': body.get('payment_number')}

    return PaymentKind()


for _t in ('receipt', 'payment'):
    for _s in ('kas', 'invoice'):
        register(_make(_t, _s))
