"""
Company Profile as a dynamic field source for Print Template Designer.

Hard rule already established elsewhere in SMITH (see GET /api/company/public,
consumed by pages/Landing/SystemOverview.tsx): company name/branding is NEVER
hardcoded in a template - always fetched live from Settings > Company Profile.
get_company_context() is the single place every document generator calls to
inject document_data['company'], so editing the logo/address once in Settings
updates every template that references company.* fields, without redesigning
any of them.

Note (2026-08-23 investigation): CompanyProfile.logo_path exists as a column
but nothing in the codebase currently reads OR writes it - there is no logo
upload UI/endpoint anywhere yet. company.logo_url below resolves correctly
whenever logo_path eventually gets set, but until a logo-upload feature is
built, it will always render blank. That gap is out of scope for Print
Template Designer Fase 1 (a Settings/CompanyProfile feature, not a template
rendering one) - flagging it, not silently building around it.
"""
import base64
import mimetypes
import os


def _resolve_logo_url(logo_path):
    if not logo_path:
        return ''
    if logo_path.startswith('data:'):
        return logo_path  # already a data URI (one of the 2 valid forms per company_config/company.py)
    from flask import current_app
    full_path = logo_path if os.path.isabs(logo_path) else os.path.join(current_app.root_path, logo_path)
    if not os.path.isfile(full_path):
        return ''
    mime, _ = mimetypes.guess_type(full_path)
    with open(full_path, 'rb') as f:
        encoded = base64.b64encode(f.read()).decode('ascii')
    return f'data:{mime or "image/png"};base64,{encoded}'


def get_company_context():
    """Returns the dict to merge into every document_data as document_data['company']."""
    from models.settings import CompanyProfile

    profile = CompanyProfile.query.first()
    if not profile:
        return {
            'name': '', 'legal_name': '', 'address': '', 'city': '', 'country': '',
            'phone': '', 'email': '', 'website': '', 'tax_id': '', 'logo_url': '',
        }

    return {
        'name': profile.company_name or '',
        'legal_name': profile.legal_name or '',
        'address': profile.address or '',
        'city': profile.city or '',
        'country': profile.country or '',
        'phone': profile.phone or '',
        'email': profile.email or '',
        'website': profile.website or '',
        'tax_id': profile.tax_id or '',
        'logo_url': _resolve_logo_url(profile.logo_path),
    }
