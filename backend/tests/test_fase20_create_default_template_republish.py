"""
Fase 20 (fix_report_3.md, 2026-10-03): found live while fixing the Invoice
template density issue - _create_default_template() always INSERTed a new
DocumentTemplate row with a hardcoded template_code (e.g.
'INVOICE_DEFAULT'), which has a DB-level unique constraint. The very first
time this function ran for a given document_type it worked fine, but the
second time (e.g. after deactivating a stale default so the fallback
layout code could regenerate it with an updated canvas) it crashed with
IntegrityError/UniqueViolation. Fixed: if a DocumentTemplate with that
template_code already exists, publish a NEW TemplateVersion onto it and
reactivate it (is_default/is_active=True) instead of inserting a duplicate
row - existing Document rows that FK-reference an older TemplateVersion
are unaffected since those rows are never deleted.
"""
from utils.document_generator import _create_default_template


def test_create_default_template_is_idempotent_on_existing_template_code(db_session, test_user):
    from models.document_management import DocumentTemplate, TemplateVersion

    objects_v1 = [{'type': 'Textbox', 'elementType': 'label', 'text': 'v1'}]
    t1 = _create_default_template(test_user.id, 'Test Doc', 'TEST_DEFAULT_F20', 'test_doc', objects_v1)
    db_session.commit()

    # Simulate the real flow: an older default gets deactivated (not
    # deleted - other Document rows still FK-reference its version).
    t1.is_default = False
    db_session.commit()

    objects_v2 = [{'type': 'Textbox', 'elementType': 'label', 'text': 'v2'}]
    t2 = _create_default_template(test_user.id, 'Test Doc', 'TEST_DEFAULT_F20', 'test_doc', objects_v2)
    db_session.commit()

    # Same template family reused, not a second row with a colliding code.
    assert t2.id == t1.id
    assert t2.is_default is True
    assert t2.is_active is True

    versions = TemplateVersion.query.filter_by(document_template_id=t1.id).order_by(TemplateVersion.version_number).all()
    assert len(versions) == 2
    assert versions[0].version_number == 1
    assert versions[1].version_number == 2
    assert versions[1].canvas_data['objects'][0]['text'] == 'v2'

    assert DocumentTemplate.query.filter_by(template_code='TEST_DEFAULT_F20').count() == 1
