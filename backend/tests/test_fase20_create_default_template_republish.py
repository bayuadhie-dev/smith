"""
Default print templates (utils/default_templates.py).

History: Fase 20 (fix_report_3.md, 2026-10-03) found that re-creating a default
template with an existing template_code crashed on the unique constraint. The
same guarantees now live in ensure_default_template(): it must create a default
when missing, publish a NEW version onto the existing family when the
auto-generated layout is outdated (never a duplicate row), and never overwrite
a version someone saved from the Template Designer.
"""
from utils.default_templates import ensure_default_template, LAYOUT, AUTO_NOTE_PREFIX


def _versions(template):
    from models.document_management import TemplateVersion
    return TemplateVersion.query.filter_by(document_template_id=template.id).order_by(TemplateVersion.version_number).all()


def test_creates_default_with_current_layout(db_session, test_user):
    t = ensure_default_template(test_user.id, 'invoice')
    db_session.commit()
    assert t.template_code == 'INVOICE_DEFAULT' and t.is_default and t.is_active
    v = t.current_version
    assert v.status == 'published' and v.canvas_data['layout'] == LAYOUT
    assert any(o.get('elementType') == 'repeating_table' and o.get('flow') for o in v.canvas_data['objects'])
    assert ensure_default_template(test_user.id, 'invoice').id == t.id       # idempotent
    assert len(_versions(t)) == 1


def test_outdated_auto_layout_is_republished_on_the_same_family(db_session, test_user):
    from models.document_management import DocumentTemplate
    t = ensure_default_template(test_user.id, 'purchase_order')
    db_session.commit()
    old = t.current_version
    old.canvas_data = {**old.canvas_data, 'layout': 'old-layout'}
    old.change_note = f'{AUTO_NOTE_PREFIX} proof-of-concept layout'
    db_session.commit()

    t2 = ensure_default_template(test_user.id, 'purchase_order')
    db_session.commit()
    assert t2.id == t.id                                  # no colliding second row
    versions = _versions(t)
    assert [v.version_number for v in versions] == [1, 2]
    assert versions[0].status == 'archived' and versions[1].status == 'published'
    assert t2.current_version_id == versions[1].id
    assert DocumentTemplate.query.filter_by(template_code='PO_DEFAULT').count() == 1


def test_designer_saved_version_is_never_overwritten(db_session, test_user):
    t = ensure_default_template(test_user.id, 'kwitansi')
    db_session.commit()
    v = t.current_version
    v.canvas_data = {**v.canvas_data, 'layout': 'old-layout'}
    v.change_note = 'Ubah teks tanda tangan'            # saved by a person in the Designer
    db_session.commit()

    t2 = ensure_default_template(test_user.id, 'kwitansi')
    assert t2.current_version_id == v.id
    assert len(_versions(t)) == 1
