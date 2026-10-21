"""Handling Unit (HU) - pelacakan per-pallet/kemasan fisik untuk shipping.

Dibuat 2026-10-19 untuk menutup gap "Handling Unit" dari audit SAP-equivalence
(ShippingItem.package_numbers yang sudah ada di schema tapi tidak pernah
dipakai sama sekali). Satu HU = 1 pallet/kemasan fisik dengan barcode sendiri,
qty aktualnya sendiri (BUKAN "1 pallet" sebagai satuan baku) - pallet yang
cuma terisi 2/3 kapasitas standar tetap valid, ditampilkan sebagai
fill_percent turunan (quantity vs Product.standard_pallet_qty), bukan field
yang diisi manual.

Dibuat saat packing (sebelum/saat surat jalan final), bukan saat shipping
order dibuat, karena split fisik ke pallet baru diketahui saat barang
disusun. Scan barcode HU dipakai untuk LOOKUP (cek produk/qty/status), bukan
gate wajib di tiap titik - sesuai keputusan user (2026-10-19), supaya tidak
memperlambat proses loading.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.auth_decorators import require_permission
from models import db, ShippingItem, ShippingOrder, HandlingUnit
from utils.helpers import generate_number_v2

handling_unit_bp = Blueprint('handling_unit', __name__)


@handling_unit_bp.route('/shipping-items/<int:item_id>/handling-units', methods=['GET'])
@jwt_required()
@require_permission('shipping.view')
def list_handling_units(item_id):
    item = db.session.get(ShippingItem, item_id)
    if not item:
        return jsonify({'error': 'Shipping item tidak ditemukan'}), 404

    hus = HandlingUnit.query.filter_by(shipping_item_id=item_id).order_by(HandlingUnit.id).all()
    packed_qty = sum(float(h.quantity) for h in hus)
    return jsonify({
        'shipping_item_id': item_id,
        'item_quantity': float(item.quantity),
        'packed_quantity': packed_qty,
        'remaining_quantity': float(item.quantity) - packed_qty,
        'handling_units': [h.to_dict() for h in hus]
    }), 200


@handling_unit_bp.route('/shipping-items/<int:item_id>/handling-units', methods=['POST'])
@jwt_required()
@require_permission('shipping.edit')
def create_handling_unit(item_id):
    """Buat 1 HU baru untuk shipping item ini. Body: {quantity, notes?}.

    Tidak memaksa sum(HU.quantity) == item.quantity persis saat dibuat satu-
    satu (staff bisa nambah bertahap saat packing jalan) - hanya menolak
    kalau total sudah/akan melebihi quantity item itu sendiri.
    """
    user_id = get_jwt_identity()
    item = db.session.get(ShippingItem, item_id)
    if not item:
        return jsonify({'error': 'Shipping item tidak ditemukan'}), 404

    data = request.get_json() or {}
    try:
        quantity = float(data.get('quantity'))
    except (TypeError, ValueError):
        return jsonify({'error': 'quantity wajib diisi dan berupa angka'}), 400
    if quantity <= 0:
        return jsonify({'error': 'quantity harus lebih besar dari 0'}), 400

    already_packed = sum(
        float(h.quantity) for h in HandlingUnit.query.filter_by(shipping_item_id=item_id).all()
    )
    if already_packed + quantity > float(item.quantity) + 0.001:
        return jsonify({
            'error': f'Total HU ({already_packed + quantity:g}) akan melebihi quantity shipping item '
                     f'({float(item.quantity):g}). Sisa yang belum dipacking: {float(item.quantity) - already_packed:g}'
        }), 400

    hu_number = generate_number_v2('handling_unit', 'HU', model=HandlingUnit, field_name='hu_number')
    hu = HandlingUnit(
        hu_number=hu_number,
        shipping_item_id=item_id,
        quantity=quantity,
        notes=data.get('notes'),
        created_by=user_id,
    )
    db.session.add(hu)
    db.session.commit()

    return jsonify({'success': True, 'handling_unit': hu.to_dict()}), 201


@handling_unit_bp.route('/handling-units/<int:hu_id>', methods=['DELETE'])
@jwt_required()
@require_permission('shipping.edit')
def delete_handling_unit(hu_id):
    hu = db.session.get(HandlingUnit, hu_id)
    if not hu:
        return jsonify({'error': 'Handling unit tidak ditemukan'}), 404
    db.session.delete(hu)
    db.session.commit()
    return jsonify({'success': True}), 200


@handling_unit_bp.route('/handling-units/scan/<string:hu_number>', methods=['GET'])
@jwt_required()
@require_permission('shipping.view')
def scan_handling_unit(hu_number):
    """Lookup HU by barcode/nomor - untuk cek isi, qty, status pengiriman.

    Bukan gate - endpoint ini cuma baca, dipakai operator scan HP/scanner
    untuk verifikasi pallet mana isinya apa, bukan untuk konfirmasi
    loading/shipping (itu tetap 1 klik di level shipping order seperti
    biasa, tidak berubah dari sebelumnya).
    """
    hu = HandlingUnit.query.filter_by(hu_number=hu_number).first()
    if not hu:
        return jsonify({'error': f'Handling unit "{hu_number}" tidak ditemukan'}), 404

    item = hu.shipping_item
    order = item.shipping_order if item else None

    result = hu.to_dict()
    if order:
        result['shipping_order'] = {
            'id': order.id,
            'shipping_number': order.shipping_number,
            'status': order.status,
            'customer_name': order.customer.company_name if order.customer else None,
            'shipping_date': order.shipping_date.isoformat() if order.shipping_date else None,
            'vehicle_number': order.vehicle_number,
        }
    return jsonify(result), 200
