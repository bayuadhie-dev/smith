"""
Company Configuration

Source of truth is the CompanyProfile row edited on the Settings page
(Settings > Company Profile, backend/models/settings.py). get_company_info()
reads that row live so a rename on the Settings page doesn't require any
code change here.

The constants below are used ONLY as a fallback for the rare paths that run
before/without a DB connection (e.g. DB-not-ready error handlers, first-boot
seeding before any CompanyProfile row exists).
"""

# Fallback values (used only when no CompanyProfile row exists / DB unreachable)
COMPANY_NAME = "PT. FALMACO NONWOVEN INDUSTRI, Tbk"
COMPANY_ADDRESS_LINE1 = "Jl. Raya Bangak-Simo KM 2 Tanjunganom Trayu"
COMPANY_ADDRESS_LINE2 = "Banyudono, Kab Boyolali, Jawa Tengah"
COMPANY_ADDRESS_LINE3 = "Indonesia"
COMPANY_PHONE = "+62-21-1234567"
COMPANY_EMAIL = "info@gratiamakmur.com"
COMPANY_WEBSITE = "www.gratiamakmur.com"

# Logo - can be a file path or base64 encoded image
# For file path: "static/images/logo.png"
# For base64: "data:image/png;base64,iVBORw0KGgo..."
COMPANY_LOGO = ""  # Leave empty for no logo, or put path to logo file

# Get full address as single string (fallback only, see get_company_info())
def get_full_address():
    return f"{COMPANY_ADDRESS_LINE1}\n{COMPANY_ADDRESS_LINE2}\n{COMPANY_ADDRESS_LINE3}"

# Get company info as dictionary - reads CompanyProfile (Settings page) live,
# falls back to the constants above only if no profile row exists yet.
def get_company_info():
    try:
        from models.settings import CompanyProfile
        profile = CompanyProfile.query.first()
        if profile and profile.company_name:
            return {
                'name': profile.company_name,
                'address_line1': profile.address or COMPANY_ADDRESS_LINE1,
                'address_line2': '',
                'address_line3': '',
                'full_address': profile.address or get_full_address(),
                'phone': profile.phone or COMPANY_PHONE,
                'email': profile.email or COMPANY_EMAIL,
                'website': profile.website or COMPANY_WEBSITE,
                'logo': profile.logo_path or COMPANY_LOGO
            }
    except Exception:
        pass

    return {
        'name': COMPANY_NAME,
        'address_line1': COMPANY_ADDRESS_LINE1,
        'address_line2': COMPANY_ADDRESS_LINE2,
        'address_line3': COMPANY_ADDRESS_LINE3,
        'full_address': get_full_address(),
        'phone': COMPANY_PHONE,
        'email': COMPANY_EMAIL,
        'website': COMPANY_WEBSITE,
        'logo': COMPANY_LOGO
    }
