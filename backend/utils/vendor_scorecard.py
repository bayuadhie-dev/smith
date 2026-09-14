"""Vendor Scorecard (SAP MM concept), added 2026-09-14 during the MM gap-closing
work (see project_sap_alignment_survey memory - Supplier.rating was found to be a
purely manual, unused-elsewhere A/B/C field). Computes a real score from actual
transaction data instead: on-time delivery (GRN.receipt_date vs PO.expected_date/
required_date), quality reject rate (GRNItem.quantity_accepted/quantity_rejected,
which already exist per line - no need for QualityInspection/QualityTest, both
confirmed dead/outgoing-only elsewhere this session), and price variance (invoiced
unit price vs PO unit price, the same comparison the 3-way match already makes).

Purchasing has zero real transactions in this ERP so far (still Accurate's
territory - see project_accurate_vs_custom_erp_scope memory), so this returns
`None`/has_data=False for suppliers with nothing to compute from yet. That's
correct, not a bug - the function is a readiness build for when real POs/GRNs/
invoices start flowing through here.
"""
from models import db
from models.purchasing import PurchaseOrder, PurchaseOrderItem, GoodsReceivedNote, GRNItem
from models.finance import Invoice, InvoiceItem


def compute_vendor_scorecard(supplier_id):
    grns = (
        GoodsReceivedNote.query
        .join(PurchaseOrder, GoodsReceivedNote.po_id == PurchaseOrder.id)
        .filter(PurchaseOrder.supplier_id == supplier_id)
        .all()
    )

    on_time_count = 0
    on_time_total = 0
    qty_received_total = 0.0
    qty_rejected_total = 0.0

    for grn in grns:
        po = grn.purchase_order
        target_date = po.expected_date or po.required_date
        if target_date and grn.receipt_date:
            on_time_total += 1
            if grn.receipt_date.date() <= target_date:
                on_time_count += 1
        for item in grn.items:
            qty_received_total += float(item.quantity_received or 0)
            qty_rejected_total += float(item.quantity_rejected or 0)

    invoice_lines = (
        db.session.query(InvoiceItem, PurchaseOrderItem)
        .join(PurchaseOrderItem, InvoiceItem.po_item_id == PurchaseOrderItem.id)
        .join(Invoice, InvoiceItem.invoice_id == Invoice.id)
        .join(PurchaseOrder, PurchaseOrderItem.po_id == PurchaseOrder.id)
        .filter(PurchaseOrder.supplier_id == supplier_id, Invoice.invoice_type == 'purchase')
        .all()
    )

    variance_weighted_sum = 0.0
    variance_qty_total = 0.0
    for inv_item, po_item in invoice_lines:
        po_price = float(po_item.unit_price or 0)
        if po_price <= 0:
            continue
        qty = float(inv_item.quantity or 0)
        variance_pct = abs(float(inv_item.unit_price or 0) - po_price) / po_price * 100
        variance_weighted_sum += variance_pct * qty
        variance_qty_total += qty

    has_data = on_time_total > 0 or qty_received_total > 0 or variance_qty_total > 0
    if not has_data:
        return {
            'supplier_id': supplier_id,
            'has_data': False,
            'message': 'Belum ada transaksi PO/GRN/Invoice untuk supplier ini.',
        }

    on_time_rate = (on_time_count / on_time_total * 100) if on_time_total else None
    reject_rate = (qty_rejected_total / qty_received_total * 100) if qty_received_total else None
    price_variance_pct = (variance_weighted_sum / variance_qty_total) if variance_qty_total else None

    # Composite score: missing components are excluded (re-weighted among what exists),
    # not defaulted to 0/100 - a supplier with no invoices yet shouldn't be penalized
    # for a price-variance component that simply has no data.
    components = []
    if on_time_rate is not None:
        components.append(('on_time', on_time_rate, 0.4))
    if reject_rate is not None:
        components.append(('quality', 100 - min(reject_rate, 100), 0.3))
    if price_variance_pct is not None:
        components.append(('price', 100 - min(price_variance_pct, 100), 0.3))

    total_weight = sum(w for _, _, w in components) or 1
    overall_score = sum(v * w for _, v, w in components) / total_weight

    return {
        'supplier_id': supplier_id,
        'has_data': True,
        'on_time_delivery_rate': round(on_time_rate, 1) if on_time_rate is not None else None,
        'on_time_sample_size': on_time_total,
        'quality_reject_rate': round(reject_rate, 1) if reject_rate is not None else None,
        'quantity_received_total': round(qty_received_total, 2),
        'price_variance_percent': round(price_variance_pct, 1) if price_variance_pct is not None else None,
        'overall_score': round(overall_score, 1),
    }
