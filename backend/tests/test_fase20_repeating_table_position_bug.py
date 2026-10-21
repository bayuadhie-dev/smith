"""
Fase 20 (fix_report_3.md, 2026-10-03): found by directly screenshotting a
generated Invoice document's raw HTML (not just the preview modal) - the
line-items table rendered at the TOP of the page, overlapping the company
header and "INVOICE" title, instead of at its designed y-position (90mm
down). Root cause: _render_repeating_table() wrapped the table in
`position:relative; margin-top:{top}mm` while every other element type
uses `position:absolute; top:{top}mm` - classic CSS margin-collapse (this
div was the first in-flow box in its container with nothing separating it
from the container's own edge, so the top margin collapsed away instead of
offsetting the table). Fixed by switching the wrapper to position:absolute
like everything else - verified this does NOT break WeasyPrint's <thead>
repeat-per-page behavior, which is driven by the <table>'s own layout, not
its positioned ancestor.
"""
from utils.template_render_engine import _render_repeating_table


def test_repeating_table_wrapper_uses_absolute_positioning_not_margin_collapse():
    obj = {
        'left': 10, 'top': 90, 'width': 190, 'height': 100,
        'dataSource': 'line_items', 'showHeader': True,
        'columns': [{'fieldPath': 'item_name', 'label': 'Item', 'width': 80, 'textAlign': 'left'}],
    }
    data = {'line_items': [{'item_name': 'Produk Uji'}]}

    html = _render_repeating_table(obj, data)

    assert 'position:absolute' in html
    assert 'top:90' in html
    assert 'left:10' in html
    # The old buggy pattern must not reappear - margin-top on a
    # position:relative wrapper is exactly what collapsed away.
    assert 'margin-top' not in html
    assert 'position:relative' not in html
