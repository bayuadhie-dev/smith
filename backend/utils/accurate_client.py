"""
Accurate Online API Client & Integration Engine
Menangani autentikasi OAuth2, API calls ke Accurate Online, Dry-Run simulation engine, dan approval WMS stock sync.
"""
import json
from datetime import datetime
import requests
from models import db
from models.accurate import AccurateConfig, AccurateItemMapping, AccurateSyncLog
from models.product import Material, Product
from utils.accurate_item_matcher import find_smith_match
from models.product_excel_schema import ProductNew
from models.wms_advanced import InventoryTransaction, MaterialConsumption
from models.production import BillOfMaterials, BOMItem


class AccurateClient:
    def __init__(self, config=None):
        self.config = config or AccurateConfig.query.first()
        if not self.config:
            self.config = AccurateConfig(
                is_dry_run=True,
                api_url='https://public.accurate.id'
            )
            db.session.add(self.config)
            db.session.commit()

    def get_headers(self):
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f"Bearer {self.config.access_token}" if self.config.access_token else '',
            'X-Session-ID': self.config.db_id or ''
        }
        return headers

    def is_connected(self):
        print(f"[IS_CONNECTED DEBUG] config={self.config} access_token={getattr(self.config, 'access_token', None)} client_id={getattr(self.config, 'client_id', None)}")
        return bool(self.config and (self.config.access_token or self.config.client_id))

    # ================= MOCK / SIMULATION DATA GENERATOR =================
    def get_mock_accurate_items(self):
        """Mock data barang Accurate untuk pengujian dry-run awal."""
        return [
            {
                'item_no': 'ACC-POLY-30W',
                'name': 'Polyester Nonwoven Roll 30gsm White (Accurate)',
                'unit': 'Roll',
                'item_type': 'ITEM',
                'unit_price': 450000.0,
                'stock': 120
            },
            {
                'item_no': 'ACC-RES-PP01',
                'name': 'Polypropylene Resin Grade A (Accurate)',
                'unit': 'Bag',
                'item_type': 'ITEM',
                'unit_price': 1250000.0,
                'stock': 45
            },
            {
                'item_no': 'ACC-BOX-24P',
                'name': 'Karton Box 24 Pcs Master Outer (Accurate)',
                'unit': 'Dus',
                'item_type': 'ITEM',
                'unit_price': 8500.0,
                'stock': 500
            },
            {
                'item_no': 'BOM-ACC-NW30',
                'name': 'BOM Formula Nonwoven 30GSM Grade A',
                'unit': 'Roll',
                'item_type': 'BOM',
                'components': [
                    {'item_no': 'ACC-RES-PP01', 'name': 'Polypropylene Resin Grade A', 'quantity': 0.85, 'unit': 'Bag'},
                    {'item_no': 'ACC-BOX-24P', 'name': 'Karton Box 24 Pcs Master Outer', 'quantity': 0.05, 'unit': 'Dus'}
                ]
            }
        ]

    def get_mock_item_transfers(self):
        """Mock data perpindahan barang Accurate untuk simulasi."""
        return [
            {
                'tx_no': 'IT/2026/07/001',
                'tx_date': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
                'type': 'item_transfer',
                'from_warehouse': 'Gudang Utama (Accurate)',
                'to_warehouse': 'Gudang Produksi (Accurate)',
                'items': [
                    {'item_no': 'ACC-POLY-30W', 'name': 'Polyester Nonwoven Roll 30gsm White (Accurate)', 'qty': 15, 'unit': 'Roll'},
                    {'item_no': 'ACC-RES-PP01', 'name': 'Polypropylene Resin Grade A (Accurate)', 'qty': 5, 'unit': 'Bag'}
                ]
            },
            {
                'tx_no': 'GR/2026/07/089',
                'tx_date': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
                'type': 'receive_item',
                'from_warehouse': 'Supplier (Penerimaan)',
                'to_warehouse': 'Gudang Bahan Baku (Accurate)',
                'items': [
                    {'item_no': 'ACC-RES-PP01', 'name': 'Polypropylene Resin Grade A (Accurate)', 'qty': 20, 'unit': 'Bag'},
                    {'item_no': 'ACC-BOX-24P', 'name': 'Karton Box 24 Pcs Master Outer (Accurate)', 'qty': 200, 'unit': 'Dus'}
                ]
            }
        ]

    # ================= REAL API METHODS =================
    def fetch_items_from_accurate(self):
        if not self.is_connected():
            return self.get_mock_accurate_items()

        try:
            items = []
            page = 1
            page_size = 100
            while True:
                url = (f"{self.config.api_url}/accurate/api/item/list.do"
                       f"?fields=id,no,name,unitName,itemType,unitPrice,quantity,stkQuantity"
                       f"&sp.page={page}&sp.pageSize={page_size}")
                resp = requests.get(url, headers=self.get_headers(), timeout=15)
                print(f"[ACCURATE ITEMS DEBUG] page={page} url={url} status={resp.status_code} body={resp.text[:400]}")
                if resp.status_code != 200:
                    break
                res_data = resp.json()
                if not res_data.get('s') or not res_data.get('d'):
                    break
                for row in res_data['d']:
                    items.append({
                        'item_no': row.get('no'),
                        'name': row.get('name'),
                        'unit': row.get('unitName', 'Pcs'),
                        'item_type': row.get('itemType', 'ITEM'),
                        'unit_price': row.get('unitPrice', 0),
                        'stock': row.get('quantity', row.get('stkQuantity', 0))
                    })
                sp = res_data.get('sp', {})
                page_count = sp.get('pageCount', 1)
                if page >= page_count:
                    break
                page += 1
            if items:
                return items
        except Exception as e:
            print(f"⚠️ Accurate API fetch error (using fallback mock): {e}")

        return self.get_mock_accurate_items()

    def fetch_items_with_category_from_accurate(self):
        """
        Sama seperti fetch_items_from_accurate() tapi juga mengambil
        itemCategory (nama kategori Accurate) -- dipakai khusus untuk
        item-master sync classifier, terpisah dari fetch_items_from_accurate()
        yang sudah dipakai endpoint /accurate-items existing supaya tidak
        mengubah behavior yang sudah live.
        """
        if not self.is_connected():
            return []
        items = []
        page = 1
        page_size = 100
        while True:
            url = (f"{self.config.api_url}/accurate/api/item/list.do"
                   f"?fields=id,no,name,unitName,itemType,unitPrice,quantity,stkQuantity,itemCategory"
                   f"&sp.page={page}&sp.pageSize={page_size}")
            resp = requests.get(url, headers=self.get_headers(), timeout=15)
            if resp.status_code != 200:
                break
            res_data = resp.json()
            if not res_data.get('s') or not res_data.get('d'):
                break
            for row in res_data['d']:
                item_category = row.get('itemCategory') or {}
                items.append({
                    'accurate_id': row.get('id'),
                    'item_no': row.get('no'),
                    'name': row.get('name'),
                    'unit': row.get('unitName', 'Pcs'),
                    'item_type': row.get('itemType', 'ITEM'),
                    'unit_price': row.get('unitPrice', 0),
                    'stock': row.get('quantity', row.get('stkQuantity', 0)),
                    'accurate_category': item_category.get('name'),
                })
            sp = res_data.get('sp', {})
            page_count = sp.get('pageCount', 1)
            if page >= page_count:
                break
            page += 1
        return items

    def fetch_transfers_from_accurate(self):
        if not self.is_connected():
            return self.get_mock_item_transfers()

        try:
            transfers = []
            page = 1
            page_size = 100
            while True:
                url = (f"{self.config.api_url}/accurate/api/item-transfer/list.do"
                       f"?fields=id,number,transDate,toWarehouse"
                       f"&sp.page={page}&sp.pageSize={page_size}")
                resp = requests.get(url, headers=self.get_headers(), timeout=15)
                if resp.status_code != 200:
                    break
                res_data = resp.json()
                if not res_data.get('s') or not res_data.get('d'):
                    break
                for row in res_data['d']:
                    transfers.append({
                        'tx_no': row.get('number'),
                        'tx_date': row.get('transDate'),
                        'type': 'item_transfer',
                        'from_warehouse': 'Gudang Asal',
                        'to_warehouse': row.get('toWarehouse', {}).get('name', 'Gudang Tujuan'),
                        'items': []  # Will be populated by detail call
                    })
                sp = res_data.get('sp', {})
                page_count = sp.get('pageCount', 1)
                if page >= page_count:
                    break
                page += 1
            if transfers:
                return transfers
        except Exception as e:
            print(f"⚠️ Accurate API fetch transfers error (using fallback mock): {e}")

        return self.get_mock_item_transfers()

    # ================= DRY-RUN SIMULATION ENGINE =================
    def run_simulation(self, user_id=None):
        """
        Menjalankan simulasi Dry-Run penarikan data dari Accurate:
        1. Narik data transaksi & item dari Accurate.
        2. Mencari pemetaan (mapping) di accurate_item_mappings.
        3. Menghitung perubahan stok SMITH ERP (diff).
        4. Menghitung dampak ketersediaan stok pada MRP.
        5. Menyimpan hasil ke AccurateSyncLog dengan status='SIMULATION'.
        TIDAK Melakukan db.session.commit() pada stok/material asli.
        """
        transfers = self.fetch_transfers_from_accurate()
        sim_results = []

        mappings = {m.accurate_item_no: m for m in AccurateItemMapping.query.all()}
        materials = {mat.id: mat for mat in Material.query.all()}
        products = {p.id: p for p in ProductNew.query.all()}

        for tx in transfers:
            tx_no = tx.get('tx_no')
            mapped_items = []
            stock_diffs = []
            mrp_impacts = []
            has_unmapped = False

            for item in tx.get('items', []):
                acc_no = item.get('item_no')
                acc_qty = item.get('qty', 0)
                mapping = mappings.get(acc_no)

                if mapping:
                    ratio = float(mapping.uom_conversion_ratio or 1.0)
                    converted_qty = round(acc_qty * ratio, 2)
                    smith_item_name = "Belum Diset"
                    current_stock = 0.0

                    if mapping.smith_item_type == 'material' and mapping.smith_material_id:
                        mat = materials.get(mapping.smith_material_id)
                        if mat:
                            smith_item_name = mat.name
                            current_stock = float(mat.stock_quantity or 0)
                    elif mapping.smith_item_type == 'product' and mapping.smith_product_id:
                        prod = products.get(mapping.smith_product_id)
                        if prod:
                            smith_item_name = prod.name
                            current_stock = float(prod.stock_quantity or 0)

                    new_simulated_stock = current_stock + converted_qty

                    mapped_items.append({
                        'accurate_item_no': acc_no,
                        'accurate_item_name': item.get('name'),
                        'accurate_qty': acc_qty,
                        'accurate_unit': item.get('unit'),
                        'is_mapped': True,
                        'smith_item_type': mapping.smith_item_type,
                        'smith_item_id': mapping.smith_material_id or mapping.smith_product_id,
                        'smith_item_name': smith_item_name,
                        'converted_qty': converted_qty,
                        'conversion_ratio': ratio,
                    })

                    stock_diffs.append({
                        'smith_item_name': smith_item_name,
                        'current_stock': current_stock,
                        'change_qty': converted_qty,
                        'simulated_new_stock': new_simulated_stock,
                    })

                    mrp_impacts.append({
                        'smith_item_name': smith_item_name,
                        'shortage_status': 'CUKUP' if new_simulated_stock > 10 else 'SHORTAGE',
                        'new_available_qty': new_simulated_stock,
                    })
                else:
                    has_unmapped = True
                    mapped_items.append({
                        'accurate_item_no': acc_no,
                        'accurate_item_name': item.get('name'),
                        'accurate_qty': acc_qty,
                        'accurate_unit': item.get('unit'),
                        'is_mapped': False,
                        'smith_item_name': '⚠️ BELUM DIPETAKAN (UNMAPPED)',
                        'converted_qty': 0,
                    })

            # Buat log simulasi di DB
            status = 'PENDING_APPROVAL' if not self.config.is_dry_run else 'SIMULATION'
            if has_unmapped:
                status = 'SIMULATION'  # Tahan di simulasi jika ada barang belum ter-map

            sync_log = AccurateSyncLog(
                transaction_type=tx.get('type', 'item_transfer'),
                accurate_tx_no=tx_no,
                accurate_tx_date=datetime.utcnow(),
                status=status,
                is_dry_run=self.config.is_dry_run,
                raw_payload=json.dumps(tx),
                mapping_summary=json.dumps(mapped_items),
                stock_diff_summary=json.dumps(stock_diffs),
                mrp_impact_summary=json.dumps(mrp_impacts),
                created_by=user_id,
            )
            db.session.add(sync_log)
            sim_results.append(sync_log)

        db.session.commit()
        return [log.to_dict() for log in sim_results]

    # ================= APPROVAL & EXECUTION (APPLY TO WMS) =================
    def apply_sync_log(self, sync_log_id: int, user_id: int):
        """
        Mengeksekusi persetujuan (Approve) sync log dari Accurate ke WMS SMITH ERP:
        1. Mengubah status sync_log ke 'APPROVED'.
        2. Memperbarui stok material / product di WMS.
        3. Mencatat transaksi di InventoryTransaction (WMS log).
        """
        log = AccurateSyncLog.query.get(sync_log_id)
        if not log:
            raise ValueError("Sync log tidak ditemukan")

        if log.status == 'APPROVED':
            return log.to_dict()

        # Cabang khusus item-master sync (item_new) -- terpisah dari logic
        # mapping-based di bawah yang menangani item_transfer/receive_item/dst.
        if log.transaction_type == 'item_new':
            from models.warehouse import Inventory
            target_table = log.proposed_target_table
            proposed_changes = json.loads(log.proposed_changes) if log.proposed_changes else {}
            stock = float(proposed_changes.get('stock', 0) or 0)
            unit_price = float(proposed_changes.get('unit_price', 0) or 0)
            unit = proposed_changes.get('unit', 'Pcs')
            default_location_id = 1 if target_table == 'materials' else 3

            if target_table == 'materials':
                new_row = Material(
                    code=f'ACC-{log.accurate_item_id}',
                    name=log.accurate_item_name,
                    material_type=log.proposed_material_type,
                    category=log.proposed_category,
                    primary_uom=unit,
                    cost_per_unit=unit_price,
                )
                db.session.add(new_row)
                db.session.flush()
                inv = Inventory(
                    material_id=new_row.id,
                    location_id=default_location_id,
                    quantity_on_hand=stock,
                    quantity_available=stock,
                )
                db.session.add(inv)
                log.matched_smith_id = new_row.id
                log.matched_smith_table = 'materials'
                txn = InventoryTransaction(
                    transaction_number=f'ACC-NEW-{log.id}',
                    transaction_type='goods_receipt',
                    material_id=new_row.id,
                    quantity=stock,
                    uom=unit,
                    direction='in',
                    reference_type='manual',
                    reference_number=log.accurate_tx_no or f'ACC-{log.id}',
                )
                db.session.add(txn)
            elif target_table == 'products':
                new_row = ProductNew(
                    code=f'ACC-{log.accurate_item_id}',
                    name=log.accurate_item_name,
                    material_type=log.proposed_material_type,
                    primary_uom=unit,
                    price=unit_price,
                    cost=unit_price,
                )
                db.session.add(new_row)
                db.session.flush()
                inv = Inventory(
                    product_id=new_row.id,
                    location_id=default_location_id,
                    quantity_on_hand=stock,
                    quantity_available=stock,
                )
                db.session.add(inv)
                log.matched_smith_id = new_row.id
                log.matched_smith_table = 'products'
                txn = InventoryTransaction(
                    transaction_number=f'ACC-NEW-{log.id}',
                    transaction_type='goods_receipt',
                    product_id=new_row.id,
                    quantity=stock,
                    uom=unit,
                    direction='in',
                    reference_type='manual',
                    reference_number=log.accurate_tx_no or f'ACC-{log.id}',
                )
                db.session.add(txn)
            else:
                raise ValueError(f'proposed_target_table tidak valid: {target_table}')

            log.status = 'APPROVED'
            log.approved_by = user_id
            log.approved_at = datetime.utcnow()
            db.session.commit()
            return log.to_dict()

        # Cabang khusus item-master sync (item_stock_change) -- item sudah
        # ada match di SMITH (matched_smith_id/matched_smith_table sudah
        # terisi saat scan), tinggal update stok Inventory-nya.
        if log.transaction_type == 'item_stock_change':
            from models.warehouse import Inventory
            smith_table = log.matched_smith_table
            smith_id = log.matched_smith_id
            proposed_changes = json.loads(log.proposed_changes) if log.proposed_changes else {}
            new_stock = float(proposed_changes.get('accurate_stock', 0) or 0)

            if smith_table == 'materials':
                inv_rows = Inventory.query.filter_by(material_id=smith_id).all()
            elif smith_table == 'products':
                inv_rows = Inventory.query.filter_by(product_id=smith_id).all()
            else:
                raise ValueError(f'matched_smith_table tidak valid: {smith_table}')

            if len(inv_rows) > 1:
                raise ValueError(
                    f'Item ini punya {len(inv_rows)} baris Inventory (multi-lokasi) '
                    f'-- tidak auto-apply, perlu review manual untuk menentukan '
                    f'lokasi mana yang diupdate.'
                )

            if len(inv_rows) == 0:
                # Belum ada baris Inventory sama sekali -- normal untuk item lama
                # yang belum pernah di-stock-in di WMS (93% products, 42%
                # materials tidak punya baris Inventory). Buat baru, bukan error.
                default_location_id = 1 if smith_table == 'materials' else 3
                old_stock = 0.0
                inv = Inventory(
                    material_id=smith_id if smith_table == 'materials' else None,
                    product_id=smith_id if smith_table == 'products' else None,
                    location_id=default_location_id,
                    quantity_on_hand=new_stock,
                    quantity_available=new_stock,
                )
                db.session.add(inv)
            else:
                inv = inv_rows[0]
                old_stock = float(inv.quantity_on_hand or 0)
                inv.quantity_on_hand = new_stock
                inv.quantity_available = new_stock

            txn = InventoryTransaction(
                transaction_number=f'ACC-STK-{log.id}',
                transaction_type='adjustment',
                material_id=smith_id if smith_table == 'materials' else None,
                product_id=smith_id if smith_table == 'products' else None,
                quantity=abs(new_stock - old_stock),
                uom=None,
                direction='in' if new_stock > old_stock else 'out',
                reference_type='manual',
                reference_number=log.accurate_tx_no or f'ACC-{log.id}',
            )
            db.session.add(txn)

            log.status = 'APPROVED'
            log.approved_by = user_id
            log.approved_at = datetime.utcnow()
            db.session.commit()
            return log.to_dict()

        # Cabang khusus item-master sync (item_price_change) -- OFF BY
        # DEFAULT dari sisi scan (tidak ada endpoint/cron aktif yang mengisi
        # antrean ini), tapi apply-nya tetap perlu siap kalau seseorang
        # approve entry yang sudah ada di queue.
        if log.transaction_type == 'item_price_change':
            smith_table = log.matched_smith_table
            smith_id = log.matched_smith_id
            proposed_changes = json.loads(log.proposed_changes) if log.proposed_changes else {}
            new_price = float(proposed_changes.get('accurate_price', 0) or 0)

            if smith_table == 'materials':
                row = Material.query.get(smith_id)
                if not row:
                    raise ValueError(f'Material id={smith_id} tidak ditemukan')
                row.cost_per_unit = new_price
            elif smith_table == 'products':
                row = Product.query.get(smith_id)
                if not row:
                    raise ValueError(f'Product id={smith_id} tidak ditemukan')
                row.price = new_price
            else:
                raise ValueError(f'matched_smith_table tidak valid: {smith_table}')

            log.status = 'APPROVED'
            log.approved_by = user_id
            log.approved_at = datetime.utcnow()
            db.session.commit()
            return log.to_dict()

        # Cabang khusus item-master sync (item_deleted) -- SOFT DELETE saja
        # (is_active=False), bukan hard-delete. materials/products punya 98
        # tabel dependent (BOM, work orders, purchase orders, dst) -- hard
        # delete terlalu berisiko untuk dijalankan otomatis lewat approve.
        if log.transaction_type == 'item_deleted':
            smith_table = log.matched_smith_table
            smith_id = log.matched_smith_id

            if smith_table == 'materials':
                row = Material.query.get(smith_id)
            elif smith_table == 'products':
                row = Product.query.get(smith_id)
            else:
                raise ValueError(f'matched_smith_table tidak valid: {smith_table}')

            if not row:
                raise ValueError(f'{smith_table} id={smith_id} tidak ditemukan')

            row.is_active = False

            log.status = 'APPROVED'
            log.approved_by = user_id
            log.approved_at = datetime.utcnow()
            db.session.commit()
            return log.to_dict()

        # Cabang khusus BOM sync -- bom_new: buat BillOfMaterials header +
        # BOMItem baru. Blokir approve kalau ada baris ingredient yang
        # belum ter-mapping ke Internal ERP (is_mapped=False).
        if log.transaction_type == 'bom_new':
            from models.production import BillOfMaterials, BOMItem
            proposed_changes = json.loads(log.proposed_changes) if log.proposed_changes else {}
            lines = proposed_changes.get('lines', [])

            unmapped = [l for l in lines if not l.get('is_mapped')]
            if unmapped:
                names = ', '.join(l['item_name'] for l in unmapped)
                raise ValueError(
                    f'Tidak bisa approve: {len(unmapped)} ingredient belum ter-mapping '
                    f'ke Internal ERP ({names}). Sync item terlebih dahulu (Internal ERP).'
                )

            bom = BillOfMaterials(
                bom_number=log.accurate_tx_no or f'ACC-BOM-{log.id}',
                product_id=log.matched_smith_id,
                version='1.0',
                is_active=True,
                batch_size=proposed_changes.get('batch_size', 1),
                batch_uom=proposed_changes.get('batch_uom', 'Pcs'),
                pack_per_carton=1,
                created_by=user_id,
            )
            db.session.add(bom)
            db.session.flush()

            for idx, line in enumerate(lines, start=1):
                item_kwargs = dict(
                    bom_id=bom.id,
                    line_number=idx,
                    quantity=line['quantity'],
                    uom=line['unit'],
                )
                if line['matched_smith_table'] == 'materials':
                    item_kwargs['material_id'] = line['matched_smith_id']
                else:
                    item_kwargs['product_id'] = line['matched_smith_id']
                db.session.add(BOMItem(**item_kwargs))

            log.matched_smith_table = 'bill_of_materials'
            log.matched_smith_id = bom.id
            log.status = 'APPROVED'
            log.approved_by = user_id
            log.approved_at = datetime.utcnow()
            db.session.commit()
            return log.to_dict()

        # bom_line_changed -- apply added/removed/changed lines ke BOMItem
        # existing. matched_smith_id di sini adalah BillOfMaterials.id
        # (bukan product_id, beda dari bom_new).
        if log.transaction_type == 'bom_line_changed':
            from models.production import BillOfMaterials, BOMItem
            bom = BillOfMaterials.query.get(log.matched_smith_id)
            if not bom:
                raise ValueError(f'BillOfMaterials id={log.matched_smith_id} tidak ditemukan')

            proposed_changes = json.loads(log.proposed_changes) if log.proposed_changes else {}
            added = proposed_changes.get('added_lines', [])
            removed = proposed_changes.get('removed_lines', [])
            changed = proposed_changes.get('changed_lines', [])

            unmapped_added = []
            existing_items = BOMItem.query.filter_by(bom_id=bom.id).all()
            existing_by_name = {}
            for it in existing_items:
                ref_name = it.material.name if it.material else (it.product.name if it.product else None)
                if ref_name:
                    existing_by_name[ref_name.strip().upper()] = it

            for line in removed:
                name_norm = (line['name'] or '').strip().upper()
                item = existing_by_name.get(name_norm)
                if item:
                    db.session.delete(item)

            for line in changed:
                name_norm = (line['name'] or '').strip().upper()
                item = existing_by_name.get(name_norm)
                if item:
                    item.quantity = line['new_quantity']

            max_line_number = max([it.line_number for it in existing_items], default=0)
            for line in added:
                match = find_smith_match(line['name'])
                if match is None:
                    unmapped_added.append(line['name'])
                    continue
                max_line_number += 1
                item_kwargs = dict(
                    bom_id=bom.id,
                    line_number=max_line_number,
                    quantity=line['quantity'],
                    uom=line['unit'],
                )
                if match['table'] == 'materials':
                    item_kwargs['material_id'] = match['id']
                else:
                    item_kwargs['product_id'] = match['id']
                db.session.add(BOMItem(**item_kwargs))

            if unmapped_added:
                raise ValueError(
                    f'Tidak bisa approve: ingredient baru belum ter-mapping ke Internal ERP '
                    f'({", ".join(unmapped_added)}). Sync item terlebih dahulu (Internal ERP).'
                )

            log.status = 'APPROVED'
            log.approved_by = user_id
            log.approved_at = datetime.utcnow()
            db.session.commit()
            return log.to_dict()

        # bom_deleted -- soft delete BillOfMaterials (is_active=False)
        if log.transaction_type == 'bom_deleted':
            from models.production import BillOfMaterials
            bom = BillOfMaterials.query.get(log.matched_smith_id)
            if not bom:
                raise ValueError(f'BillOfMaterials id={log.matched_smith_id} tidak ditemukan')
            bom.is_active = False

            log.status = 'APPROVED'
            log.approved_by = user_id
            log.approved_at = datetime.utcnow()
            db.session.commit()
            return log.to_dict()

        diffs = json.loads(log.stock_diff_summary) if log.stock_diff_summary else []
        mappings = json.loads(log.mapping_summary) if log.mapping_summary else []

        for item in mappings:
            if not item.get('is_mapped'):
                continue

            smith_type = item.get('smith_item_type')
            smith_id = item.get('smith_item_id')
            qty = float(item.get('converted_qty', 0))

            if smith_type == 'material' and smith_id:
                mat = Material.query.get(smith_id)
                if mat:
                    mat.stock_quantity = float(mat.stock_quantity or 0) + qty
                    # Catat log transaksi WMS
                    txn = InventoryTransaction(
                        transaction_type='ACCURATE_RECEIVE',
                        reference_no=log.accurate_tx_no or f'ACC-{log.id}',
                        material_id=mat.id,
                        quantity=qty,
                        notes=f'Synced from Accurate API ({log.transaction_type})',
                        created_by=user_id
                    )
                    db.session.add(txn)

            elif smith_type == 'product' and smith_id:
                prod = ProductNew.query.get(smith_id)
                if prod:
                    prod.stock_quantity = float(prod.stock_quantity or 0) + qty
                    txn = InventoryTransaction(
                        transaction_type='ACCURATE_RECEIVE',
                        reference_no=log.accurate_tx_no or f'ACC-{log.id}',
                        product_id=prod.id,
                        quantity=qty,
                        notes=f'Synced from Accurate API ({log.transaction_type})',
                        created_by=user_id
                    )
                    db.session.add(txn)

        log.status = 'APPROVED'
        log.approved_by = user_id
        log.approved_at = datetime.utcnow()
        db.session.commit()

        return log.to_dict()

    def _fetch_list_generic(self, endpoint, fields, mapper, mock_data=None):
        """Generic list fetcher untuk modul Accurate manapun (sales, purchasing, finance, accounting).
        endpoint: path API, misal 'sales-invoice/list.do'
        fields: string field yang diminta, misal 'id,number,customerName,totalAmount'
        mapper: fungsi(row) -> dict, transformasi row Accurate ke shape SMITH
        mock_data: list fallback kalau belum connected/error
        Otomatis paginate semua halaman (sp.page & sp.pageSize).
        """
        if not self.is_connected():
            return mock_data or []
        try:
            all_results = []
            page = 1
            page_size = 100
            while True:
                url = (f"{self.config.api_url}/accurate/api/{endpoint}"
                       f"?fields={fields}&sp.page={page}&sp.pageSize={page_size}")
                resp = requests.get(url, headers=self.get_headers(), timeout=15)
                if resp.status_code != 200:
                    break
                res_data = resp.json()
                if not res_data.get('s') or not res_data.get('d'):
                    break
                all_results.extend([mapper(row) for row in res_data['d']])
                sp = res_data.get('sp', {})
                page_count = sp.get('pageCount', 1)
                if page >= page_count:
                    break
                page += 1
            return all_results if all_results else (mock_data or [])
        except Exception as e:
            print(f"⚠️ Accurate API fetch error ({endpoint}): {e}")
        return mock_data or []

    # ================= SALES =================
    def fetch_sales_invoices(self):
        return self._fetch_list_generic(
            'sales-invoice/list.do',
            'id,number,transDate,customer,totalAmount,statusName',
            lambda r: {
                'number': r.get('number'),
                'date': r.get('transDate'),
                'customer_name': (r.get('customer') or {}).get('name'),
                'total': r.get('totalAmount', 0),
                'status': r.get('statusName'),
            }
        )

    def fetch_sales_orders(self):
        return self._fetch_list_generic(
            'sales-order/list.do',
            'id,number,transDate,customer,totalAmount,statusName',
            lambda r: {
                'number': r.get('number'),
                'date': r.get('transDate'),
                'customer_name': (r.get('customer') or {}).get('name'),
                'total': r.get('totalAmount', 0),
                'status': r.get('statusName'),
            }
        )

    def fetch_customers(self):
        return self._fetch_list_generic(
            'customer/list.do',
            'id,name,customerNo,email,mobilePhone',
            lambda r: {
                'customer_no': r.get('customerNo'),
                'name': r.get('name'),
                'email': r.get('email'),
                'phone': r.get('mobilePhone'),
            }
        )

    # ================= PURCHASING =================
    def fetch_purchase_invoices(self):
        return self._fetch_list_generic(
            'purchase-invoice/list.do',
            'id,number,transDate,vendor,totalAmount,statusName',
            lambda r: {
                'number': r.get('number'),
                'date': r.get('transDate'),
                'vendor_name': (r.get('vendor') or {}).get('name'),
                'total': r.get('totalAmount', 0),
                'status': r.get('statusName'),
            }
        )

    def fetch_purchase_orders(self):
        return self._fetch_list_generic(
            'purchase-order/list.do',
            'id,number,transDate,vendor,totalAmount,statusName',
            lambda r: {
                'number': r.get('number'),
                'date': r.get('transDate'),
                'vendor_name': (r.get('vendor') or {}).get('name'),
                'total': r.get('totalAmount', 0),
                'status': r.get('statusName'),
            }
        )

    def fetch_vendors(self):
        return self._fetch_list_generic(
            'vendor/list.do',
            'id,name,vendorNo,email,mobilePhone',
            lambda r: {
                'vendor_no': r.get('vendorNo'),
                'name': r.get('name'),
                'email': r.get('email'),
                'phone': r.get('mobilePhone'),
            }
        )

    # ================= FINANCE =================
    def fetch_bank_transfers(self):
        return self._fetch_list_generic(
            'bank-transfer/list.do',
            'id,number,transDate,fromBank,toBank,amount',
            lambda r: {
                'number': r.get('number'),
                'date': r.get('transDate'),
                'from_bank': (r.get('fromBank') or {}).get('name'),
                'to_bank': (r.get('toBank') or {}).get('name'),
                'amount': r.get('amount', 0),
            }
        )

    def fetch_expenses(self):
        return self._fetch_list_generic(
            'expense/list.do',
            'id,number,transDate,description,totalAmount',
            lambda r: {
                'number': r.get('number'),
                'date': r.get('transDate'),
                'description': r.get('description'),
                'total': r.get('totalAmount', 0),
            }
        )

    # ================= ACCOUNTING =================
    def fetch_gl_accounts(self):
        return self._fetch_list_generic(
            'glaccount/list.do',
            'id,no,name,accountType',
            lambda r: {
                'account_no': r.get('no'),
                'name': r.get('name'),
                'account_type': r.get('accountType'),
            }
        )

    def fetch_journal_vouchers(self):
        return self._fetch_list_generic(
            'journal-voucher/list.do',
            'id,number,transDate,description',
            lambda r: {
                'number': r.get('number'),
                'date': r.get('transDate'),
                'description': r.get('description'),
            }
        )

    # ================= MANUFACTURING / BOM =================
    def fetch_bills_of_material(self):
        return self._fetch_list_generic(
            'bill-of-material/list.do',
            'id,number,name,item',
            lambda r: {
                'number': r.get('number'),
                'name': r.get('name'),
                'product_name': (r.get('item') or {}).get('name') if isinstance(r.get('item'), dict) else (r.get('item') or '-'),
            }
        )


    # ================= DETAIL FETCHERS =================
    def _fetch_detail_generic(self, endpoint, id_param, id_value):
        """Generic detail fetcher. endpoint contoh 'item/detail.do', id_param contoh 'no' atau 'number'."""
        if not self.is_connected():
            return None
        try:
            url = f"{self.config.api_url}/accurate/api/{endpoint}?{id_param}={id_value}"
            resp = requests.get(url, headers=self.get_headers(), timeout=15)
            if resp.status_code == 200:
                res_data = resp.json()
                if res_data.get('s'):
                    return res_data.get('d')
            return None
        except Exception as e:
            print(f"⚠️ Accurate API detail fetch error ({endpoint}): {e}")
            return None

    def fetch_item_detail(self, no):
        return self._fetch_detail_generic('item/detail.do', 'no', no)

    def fetch_vendor_detail(self, no):
        return self._fetch_detail_generic('vendor/detail.do', 'no', no)

    def fetch_customer_detail(self, no):
        return self._fetch_detail_generic('customer/detail.do', 'no', no)

    def fetch_gl_account_detail(self, no):
        return self._fetch_detail_generic('glaccount/detail.do', 'no', no)

    def fetch_sales_invoice_detail(self, number):
        return self._fetch_detail_generic('sales-invoice/detail.do', 'number', number)

    def fetch_sales_order_detail(self, number):
        return self._fetch_detail_generic('sales-order/detail.do', 'number', number)

    def fetch_purchase_invoice_detail(self, number):
        return self._fetch_detail_generic('purchase-invoice/detail.do', 'number', number)

    def fetch_purchase_order_detail(self, number):
        return self._fetch_detail_generic('purchase-order/detail.do', 'number', number)

    def fetch_bank_transfer_detail(self, number):
        return self._fetch_detail_generic('bank-transfer/detail.do', 'number', number)

    def fetch_journal_voucher_detail(self, number):
        return self._fetch_detail_generic('journal-voucher/detail.do', 'number', number)

    def fetch_bill_of_material_detail(self, number):
        return self._fetch_detail_generic('bill-of-material/detail.do', 'number', number)
