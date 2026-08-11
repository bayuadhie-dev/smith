"""
Keyword-based classifier untuk memetakan item Accurate ke struktur SMITH ERP.

Menentukan (target_table, material_type, category) dari nama item Accurate
+ nama kategori Accurate, berdasarkan pola keyword yang ditemukan dari
analisis data real (lihat catatan project untuk detail sample data).
"""

# Kategori Accurate yang bukan item fisik — di-skip dari sync sama sekali
SKIPPED_ACCURATE_CATEGORIES = {'LAIN-LAIN', 'UMUM'}

# Fallback material_type kasar per kategori Accurate, dipakai kalau
# keyword matching pada nama item tidak menemukan kecocokan spesifik
ACCURATE_CATEGORY_FALLBACK = {
    'BAHAN BAKU': 'raw_materials',
    'BAHAN PEMBANTU': 'packaging_materials',
    'BAHAN KIMIA': 'chemical_materials',
    'BARANG DALAM PENYELESAIAN': 'wip',
    'PREMIX': 'wip',
    'WASTE': 'wip',
}

# Urutan PENTING: paling spesifik/berisiko-salah-tangkap duluan.
# Setiap entry: (keyword_list, category, material_type)
KEYWORD_RULES = [
    (['CHEMICAL', 'KIMIA'], 'chemical', 'chemical_materials'),
    (['PARFUM'], 'parfum', 'chemical_materials'),
    (['WASTE'], 'waste', 'wip'),
    (['PREMIX'], 'premix', 'wip'),
    (['JUMBO ROLL'], 'jumbo_roll', 'raw_materials'),
    (['MAIN ROLL'], 'main_roll', 'raw_materials'),
    (['SPUNBOND'], 'spunbond', 'raw_materials'),
    (['MELTBLOWN'], 'meltblown', 'raw_materials'),
    (['NONWOVEN', 'KAIN'], 'kain', 'raw_materials'),
    (['CARTON BOX', 'CARTON', 'KARTON'], 'carton_box', 'packaging_materials'),
    (['INNER BOX'], 'inner_box', 'packaging_materials'),
    (['JERIGEN'], 'jerigen', 'packaging_materials'),
    (['BOTOL'], 'botol', 'packaging_materials'),
    (['FLIPTOP'], 'fliptop', 'packaging_materials'),
    (['PLASTIK'], 'plastik', 'packaging_materials'),
    (['STC'], 'stc', 'packaging_materials'),
    (['PACKAGING'], 'packaging', 'packaging_materials'),
]


def classify_accurate_item(item_name: str, accurate_category: str):
    """
    Klasifikasikan satu item Accurate ke struktur SMITH.

    Args:
        item_name: nama item dari Accurate (mis. 'CHEMICAL TEA TREE OIL')
        accurate_category: nama kategori Accurate (mis. 'BAHAN BAKU')

    Returns:
        dict dengan keys: target_table, material_type, category, skip
        - skip=True berarti item ini TIDAK boleh disync (bukan barang fisik)
        - category=None untuk target_table='products' (finished goods
          tidak punya field category yang setara di SMITH)
    """
    cat_upper = (accurate_category or '').strip().upper()
    name_upper = (item_name or '').strip().upper()

    # 1. Skip item non-fisik (akun biaya/expense yang dicatat sbg "item")
    if cat_upper in SKIPPED_ACCURATE_CATEGORIES:
        return {
            'target_table': None,
            'material_type': None,
            'category': None,
            'skip': True,
            'skip_reason': f'Accurate category "{accurate_category}" bukan item fisik',
        }

    # 2. Barang jadi -> products table, tidak ada category field
    if cat_upper == 'BARANG JADI':
        return {
            'target_table': 'products',
            'material_type': 'finished_goods',
            'category': None,
            'skip': False,
            'skip_reason': None,
        }

    # 3. Semua sisanya -> materials table, cari category via keyword pada nama
    for keywords, category, material_type in KEYWORD_RULES:
        if any(kw in name_upper for kw in keywords):
            return {
                'target_table': 'materials',
                'material_type': material_type,
                'category': category,
                'skip': False,
                'skip_reason': None,
            }

    # 4. Tidak ada keyword match -> fallback ke material_type dari kategori
    #    Accurate, category='other_raw' sebagai penampung utk direview manual
    fallback_type = ACCURATE_CATEGORY_FALLBACK.get(cat_upper, 'raw_materials')
    return {
        'target_table': 'materials',
        'material_type': fallback_type,
        'category': 'other_raw',
        'skip': False,
        'skip_reason': None,
    }
