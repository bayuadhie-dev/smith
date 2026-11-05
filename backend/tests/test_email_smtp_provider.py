def test_smtp_provider_sends_with_login(monkeypatch):
    import smtplib
    from utils.email_service import EmailService
    for k, v in {'EMAIL_PROVIDER': 'smtp', 'SMTP_HOST': 'smtp.zoho.com', 'SMTP_PORT': '465', 'SMTP_USER': 'admin@fsnindonesia.com',
                 'SMTP_PASSWORD': 'x', 'SMTP_FROM': 'admin@fsnindonesia.com'}.items():
        monkeypatch.setenv(k, v)
    cap = {}

    class Fake:
        def __init__(s, host, port, timeout=None): cap['hp'] = (host, port)
        def __enter__(s): return s
        def __exit__(s, *a): pass
        def login(s, u, p): cap['login'] = u
        def sendmail(s, f, t, m): cap['from'] = f; cap['msg'] = m
    monkeypatch.setattr(smtplib, 'SMTP_SSL', Fake)
    e = EmailService()
    assert e.is_configured() and e.from_email == 'admin@fsnindonesia.com'
    r = e.send_custom_notification(to='a@b.c', subject='Tes', title='Tes', message='Halo')
    assert r.get('success') and r['provider'] == 'smtp'
    assert cap['hp'] == ('smtp.zoho.com', 465) and cap['login'] == 'admin@fsnindonesia.com' and cap['from'] == 'admin@fsnindonesia.com'
