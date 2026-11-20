"""Bahan trial R&D keluar lewat Permintaan Barang, bukan sekadar angka di layar.

Sebelumnya eksperimen mencatat material_id + quantity tanpa pernah menyentuh
stok gudang: tidak ada yang tahu barang diambil, dan saldo gudang tetap utuh
walaupun bahannya sudah dipakai.
"""
from datetime import date


def _formula(db_session, test_material, test_user, qty=5):
    from models.rnd import RNDProject, RNDFormula, RNDFormulaItem

    proyek = RNDProject(project_number='RND-UJI-1', name='Tisu Basah Baru',
                        project_type='new_product', created_by=test_user.id)
    db_session.add(proyek)
    db_session.commit()
    f = RNDFormula(project_id=proyek.id, version='V1', created_by=test_user.id)
    db_session.add(f)
    db_session.commit()
    db_session.add(RNDFormulaItem(formula_id=f.id, line_number=1, material_id=test_material.id,
                                  material_code=test_material.code, material_name=test_material.name,
                                  quantity=qty, uom='KG'))
    db_session.commit()
    return f


def test_permintaan_bahan_trial_dibuat_dari_formula(client, auth_headers, db_session, test_material, test_user):
    f = _formula(db_session, test_material, test_user, qty=5)

    r = client.post(f'/api/rnd/formulas/{f.id}/material-request', headers=auth_headers,
                    json={'factor': 2})
    assert r.status_code == 201, r.get_json()
    info = r.get_json()['material_issue']
    assert info['items'] == 1 and info['status'] == 'pending'

    from models.material_issue import MaterialIssue, MaterialIssueItem
    mi = MaterialIssue.query.filter_by(issue_number=info['issue_number']).first()
    assert mi.rnd_formula_id == f.id and mi.issue_type == 'rnd' and mi.department == 'R&D'
    item = MaterialIssueItem.query.filter_by(material_issue_id=mi.id).first()
    assert float(item.required_quantity) == 10, 'faktor 2 menggandakan kebutuhan formula'


def test_satu_eksperimen_hanya_boleh_satu_permintaan(client, auth_headers, db_session, test_material, test_user):
    from models.rnd import RNDExperiment

    f = _formula(db_session, test_material, test_user)
    exp = RNDExperiment(formula_id=f.id, experiment_number='EXP-1', trial_date=date.today())
    db_session.add(exp)
    db_session.commit()

    r1 = client.post(f'/api/rnd/formulas/{f.id}/material-request', headers=auth_headers,
                     json={'experiment_id': exp.id})
    assert r1.status_code == 201, r1.get_json()
    r2 = client.post(f'/api/rnd/formulas/{f.id}/material-request', headers=auth_headers,
                     json={'experiment_id': exp.id})
    assert r2.status_code == 400 and 'sudah punya permintaan' in r2.get_json()['error']


def test_formula_tanpa_material_ditolak(client, auth_headers, db_session, test_user):
    from models.rnd import RNDProject, RNDFormula

    proyek = RNDProject(project_number='RND-UJI-2', name='Formula kosong',
                        project_type='new_product', created_by=test_user.id)
    db_session.add(proyek)
    db_session.commit()
    f = RNDFormula(project_id=proyek.id, version='V1', created_by=test_user.id)
    db_session.add(f)
    db_session.commit()

    r = client.post(f'/api/rnd/formulas/{f.id}/material-request', headers=auth_headers, json={})
    assert r.status_code == 400 and 'belum punya bahan' in r.get_json()['error']
