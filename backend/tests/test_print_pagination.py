from weasyprint import HTML


def _pages(html):
    return len(HTML(string=html).render().pages)


def _render(db_session, test_user, typ, n):
    from utils.default_templates import ensure_default_template
    from utils.template_render_engine import render_template_version_to_html
    tv = ensure_default_template(test_user.id, typ).current_version
    tab = next(o for o in tv.canvas_data['objects'] if o.get('elementType') == 'repeating_table')
    rows = [{c['fieldPath']: ('Barang %d' % i if c['fieldPath'] in ('item_name', 'product_name', 'uraian') else 10 + i)
             for c in tab['columns'] if c.get('fieldPath')} for i in range(n)]
    return render_template_version_to_html(tv, {tab['dataSource']: rows, 'company': {'name': 'PT Uji'}})


def test_normal_documents_fit_one_page_and_long_ones_continue(db_session, test_user):
    for typ in ('invoice', 'purchase_order', 'surat_jalan', 'spk_batch'):
        assert _pages(_render(db_session, test_user, typ, 8)) == 1, typ
        assert _pages(_render(db_session, test_user, typ, 70)) >= 2, typ


def test_small_kwitansi_grows_to_a4_instead_of_splitting(db_session, test_user):
    html3 = _render(db_session, test_user, 'kwitansi', 3)
    html8 = _render(db_session, test_user, 'kwitansi', 8)
    assert '148' in html3.split('@page')[1][:80] and _pages(html3) == 1
    assert '297' in html8.split('@page')[1][:80] and _pages(html8) == 1
