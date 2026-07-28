import pandas as pd
from sqlalchemy import create_engine

print("🔄 Menghubungkan langsung ke database erp_db...")

# Buat koneksi langsung ke PostgreSQL local
engine = create_engine('postgresql://postgres@/erp_db')

# Sedot seluruh tabel shift_productions
df = pd.read_sql("SELECT * FROM shift_productions", con=engine)

# Simpan ke file CSV baru
output_filename = 'shift_productions_rich.csv'
df.to_csv(output_filename, index=False)

print(f"✅ Berhasil! {len(df)} baris data dengan {len(df.columns)} kolom tersimpan di '{output_filename}'")
