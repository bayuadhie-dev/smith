#!/usr/bin/env python3
"""Menarik fakta SOP langsung dari kode, bukan dari ingatan.

Dipakai menyusun SOP Penginputan Data (permintaan Presiden Direktur 2026-11-26).
Yang dikumpulkan per modul:

- entitas (tabel) utamanya,
- kolom yang WAJIB diisi (nullable=False, bukan kolom audit/bawaan sistem),
- daftar status yang dikenal sistem (dari komentar di kolom status),
- izin yang dibutuhkan tiap tindakan (@require_permission di route),
- awalan nomor dokumen (generate_number / generate_number_v2).

Alasan ditarik dari kode: SOP yang ditulis dari ingatan cepat melenceng dari
perilaku sistem, dan yang dirugikan orang gudang jam 2 pagi yang mengikuti
kertasnya. Kalau nanti alurnya berubah, jalankan ulang skrip ini - selisihnya
langsung kelihatan.

Pakai: python3 scripts/sop/kumpulkan_fakta.py > scripts/sop/fakta.json
"""
import ast
import json
import pathlib
import re
import sys

AKAR = pathlib.Path(__file__).resolve().parents[2]
MODEL_DIR = AKAR / 'backend' / 'models'
ROUTE_DIR = AKAR / 'backend' / 'routes'

# Kolom yang ada di hampir semua tabel dan bukan isian orang.
KOLOM_SISTEM = {
    'id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at',
    'is_active', 'is_deleted', 'tenant_id',
}


def _teks(node):
    """Nilai literal sederhana (str/angka/bool) kalau bisa dibaca."""
    try:
        return ast.literal_eval(node)
    except (ValueError, SyntaxError):
        return None


def kolom_wajib(berkas: pathlib.Path):
    """Tabel -> daftar kolom wajib isi, status yang dikenal, dan kolom nomor dokumen."""
    hasil = {}
    try:
        pohon = ast.parse(berkas.read_text())
    except SyntaxError:
        return hasil
    baris_teks = berkas.read_text().splitlines()

    for kelas in [n for n in ast.walk(pohon) if isinstance(n, ast.ClassDef)]:
        tabel, wajib, status, nomor = None, [], [], []
        for isi in kelas.body:
            if not isinstance(isi, ast.Assign) or not isi.targets:
                continue
            target = isi.targets[0]
            nama = getattr(target, 'id', None)
            if nama == '__tablename__':
                tabel = _teks(isi.value)
                continue
            if not nama or not isinstance(isi.value, ast.Call):
                continue
            panggil = ast.unparse(isi.value.func) if hasattr(ast, 'unparse') else ''
            if not panggil.endswith('Column'):
                continue
            argumen = {k.arg: k.value for k in isi.value.keywords}
            punya_bawaan = any(a in argumen for a in ('default', 'server_default'))
            tidak_boleh_kosong = _teks(argumen.get('nullable')) is False if 'nullable' in argumen else False
            if tidak_boleh_kosong and not punya_bawaan and nama not in KOLOM_SISTEM:
                wajib.append(nama)
            if nama == 'status' or nama.endswith('_status'):
                # Daftar statusnya ditulis sebagai komentar di baris yang sama.
                baris = baris_teks[isi.lineno - 1] if isi.lineno <= len(baris_teks) else ''
                komentar = baris.split('#', 1)[1].strip() if '#' in baris else ''
                if komentar:
                    status.append({'kolom': nama, 'nilai': komentar})
            if nama.endswith('_number') or nama == 'number':
                nomor.append(nama)
        if tabel:
            hasil[tabel] = {'kelas': kelas.name, 'wajib': wajib, 'status': status, 'nomor': nomor,
                            'berkas': berkas.name}
    return hasil


POLA_ROUTE = re.compile(
    r"@\w+\.route\(\s*'([^']*)'(?:\s*,\s*methods\s*=\s*\[([^\]]*)\])?[^)]*\)"
    r"(?P<hiasan>(?:\s*@[^\n]*\n)*)\s*def\s+(?P<nama_fungsi>\w+)", re.S)
POLA_IZIN = re.compile(r"require_permission\(([^)]*)\)")
# generate_number('PO', ...) -> awalannya argumen pertama.
# generate_number_v2('purchase_order', 'PO', ...) -> argumen pertama kunci urutan,
# awalannya yang kedua. Dulu keduanya disamakan, jadi "purchase_order" ikut
# tercatat sebagai awalan nomor dokumen - salah, dan menyesatkan di SOP.
POLA_NOMOR = re.compile(r"generate_number\(\s*'([^']+)'")
POLA_NOMOR_V2 = re.compile(r"generate_number_v2\(\s*'[^']+'\s*,\s*'([^']+)'")


def jalur_dan_izin(berkas: pathlib.Path):
    teks = berkas.read_text()
    jalur = []
    for m in POLA_ROUTE.finditer(teks):
        metode = [x.strip().strip("'\"") for x in (m.group(2) or 'GET').split(',') if x.strip()]
        izin = []
        hiasan = m.group('hiasan') or ''
        for p in POLA_IZIN.finditer(hiasan):
            izin += [x.strip().strip("'\"") for x in p.group(1).split(',') if x.strip()]
        jalur.append({'jalur': m.group(1), 'metode': metode, 'fungsi': m.group('nama_fungsi'), 'izin': izin})
    awalan = sorted(set(POLA_NOMOR.findall(teks)) | set(POLA_NOMOR_V2.findall(teks)))
    return jalur, awalan


def kumpulkan(modul):
    fakta = {'nama': modul['nama'], 'ringkas': modul['ringkas'], 'entitas': {}, 'jalur': [],
             'awalan_nomor': [], 'berkas_hilang': []}
    for f in re.split(r',\s*', modul['model']):
        f = f.strip('` ').split(' ')[0]
        if not f.endswith('.py'):
            continue
        p = MODEL_DIR / f
        if p.exists():
            fakta['entitas'].update(kolom_wajib(p))
        else:
            fakta['berkas_hilang'].append(f'models/{f}')
    for f in re.split(r',\s*', modul['route']):
        f = f.strip('` ').split(' ')[0]
        if not f.endswith('.py'):
            continue
        p = ROUTE_DIR / f
        if p.exists():
            jalur, awalan = jalur_dan_izin(p)
            fakta['jalur'] += jalur
            fakta['awalan_nomor'] += awalan
        else:
            fakta['berkas_hilang'].append(f'routes/{f}')
    fakta['awalan_nomor'] = sorted(set(fakta['awalan_nomor']))
    return fakta


def main():
    peta = json.loads((pathlib.Path(__file__).parent / 'modul_peta.json').read_text())
    keluar = []
    for modul in peta:
        f = kumpulkan(modul)
        # Modul yang seluruh berkasnya sudah tidak ada berarti sudah dihapus dari
        # sistem (mis. modul RD lama) - tidak perlu dibuatkan SOP.
        if not f['entitas'] and not f['jalur']:
            print(f"lewati (kode sudah tidak ada): {modul['nama']}", file=sys.stderr)
            continue
        keluar.append(f)
    json.dump(keluar, sys.stdout, ensure_ascii=False, indent=1)
    print(f'\nmodul dengan kode hidup: {len(keluar)} dari {len(peta)}', file=sys.stderr)


if __name__ == '__main__':
    main()
