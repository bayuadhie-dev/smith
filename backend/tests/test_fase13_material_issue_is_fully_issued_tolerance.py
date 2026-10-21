"""
Fase 13 (fix_report_3.md, 2026-10-02): MaterialIssueItem.is_fully_issued
used strict `issued_quantity >= required_quantity`. issue_materials()
accumulates issued_quantity via Python float arithmetic (possibly across
several FIFO batches), which can land a hair below the exact Decimal
required_quantity from pure floating-point rounding even when the full
quantity was issued in substance - found via a real production run where
issued_quantity == required_quantity in the API response, yet
MaterialIssueItem.status stayed 'partial' forever because this property
said otherwise. Fixed with a small (0.01) tolerance.
"""
from models.material_issue import MaterialIssueItem


def test_is_fully_issued_true_for_tiny_float_rounding_short():
    item = MaterialIssueItem(
        material_issue_id=1, line_number=1, material_id=1, description='x',
        required_quantity=1628716.38, issued_quantity=1628716.3799999998,
        uom='KG', status='pending',
    )
    assert item.is_fully_issued is True


def test_is_fully_issued_true_for_exact_match():
    item = MaterialIssueItem(
        material_issue_id=1, line_number=1, material_id=1, description='x',
        required_quantity=10, issued_quantity=10,
        uom='KG', status='pending',
    )
    assert item.is_fully_issued is True


def test_is_fully_issued_false_for_real_shortfall():
    item = MaterialIssueItem(
        material_issue_id=1, line_number=1, material_id=1, description='x',
        required_quantity=10, issued_quantity=7,
        uom='KG', status='pending',
    )
    assert item.is_fully_issued is False
    assert item.is_partially_issued is True


def test_is_partially_issued_false_when_fully_issued():
    item = MaterialIssueItem(
        material_issue_id=1, line_number=1, material_id=1, description='x',
        required_quantity=10, issued_quantity=9.999,
        uom='KG', status='pending',
    )
    assert item.is_fully_issued is True
    assert item.is_partially_issued is False
