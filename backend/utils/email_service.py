"""
Email Service with Gmail SMTP / Resend
======================================
Provides email notification functionality with HTML templates.

Setup Gmail:
1. Enable 2FA on your Google account
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Add to .env:
   EMAIL_PROVIDER=gmail
   GMAIL_ADDRESS=your-email@gmail.com
   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

Setup Resend (alternative):
1. Get API key from https://resend.com/api-keys
2. Add to .env:
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_xxxxxxxxxx
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List, Dict, Any
from datetime import datetime


class EmailService:
    """Email service supporting Gmail SMTP and Resend API"""
    
    def __init__(self):
        self.provider = os.getenv('EMAIL_PROVIDER', 'gmail').lower()
        self._env_company_name = os.getenv('COMPANY_NAME', 'ERP System')
        self.app_url = os.getenv('APP_URL', 'http://localhost:3000')
        
        # Gmail config
        self.gmail_address = os.getenv('GMAIL_ADDRESS')
        self.gmail_password = os.getenv('GMAIL_APP_PASSWORD')
        
        # Resend config
        self.resend_api_key = os.getenv('RESEND_API_KEY')
        self.resend_from = os.getenv('EMAIL_FROM', 'onboarding@resend.dev')
        
        if self.provider == 'resend' and self.resend_api_key:
            import resend
            resend.api_key = self.resend_api_key
    
    def _company(self) -> Dict[str, Any]:
        """Data dari Profil Perusahaan (Pengaturan); kolom kosong tidak diisi dengan data perusahaan lain."""
        try:
            from models.settings import CompanyProfile
            p = CompanyProfile.query.first()
            if p and p.company_name:
                addr = p.address or ', '.join(x for x in [p.city, p.state] if x)
                return {'name': p.company_name, 'full_address': addr, 'phone': p.phone or '',
                        'email': p.email or '', 'website': p.website or '', 'logo': p.logo_path or ''}
        except Exception:
            pass
        return {'name': self._env_company_name, 'full_address': '', 'phone': '', 'email': '', 'website': '', 'logo': ''}

    @property
    def company_name(self) -> str:
        return self._company().get('name') or self._env_company_name

    @property
    def from_email(self) -> str:
        if self.provider == 'gmail':
            return self.gmail_address or ''
        return self.resend_from
    
    def is_configured(self) -> bool:
        """Check if email service is properly configured"""
        if self.provider == 'gmail':
            return bool(self.gmail_address and self.gmail_password)
        elif self.provider == 'resend':
            return bool(self.resend_api_key)
        return False
    
    def get_provider_info(self) -> Dict[str, Any]:
        """Get current provider configuration info"""
        return {
            'provider': self.provider,
            'configured': self.is_configured(),
            'from_email': self.from_email
        }
    
    def send_email(
        self,
        to: str | List[str],
        subject: str,
        html: str,
        text: Optional[str] = None,
        reply_to: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Send an email using configured provider
        
        Args:
            to: Recipient email(s)
            subject: Email subject
            html: HTML content
            text: Plain text content (optional)
            reply_to: Reply-to email (optional)
            cc: CC recipients (optional)
            bcc: BCC recipients (optional)
            
        Returns:
            Response dict with success/error
        """
        if not self.is_configured():
            return {'error': f'Email service not configured. Set {self.provider.upper()} credentials in .env'}
        
        if self.provider == 'gmail':
            return self._send_gmail(to, subject, html, text, cc, bcc)
        elif self.provider == 'resend':
            return self._send_resend(to, subject, html, text, reply_to, cc, bcc)
        else:
            return {'error': f'Unknown email provider: {self.provider}'}
    
    def _send_gmail(
        self,
        to: str | List[str],
        subject: str,
        html: str,
        text: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Send email via Gmail SMTP"""
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f'{self.company_name} <{self.gmail_address}>'
            
            # Handle recipients
            recipients = [to] if isinstance(to, str) else to
            msg['To'] = ', '.join(recipients)
            
            all_recipients = list(recipients)
            
            if cc:
                msg['Cc'] = ', '.join(cc)
                all_recipients.extend(cc)
            
            if bcc:
                all_recipients.extend(bcc)
            
            # Attach text and HTML
            if text:
                msg.attach(MIMEText(text, 'plain'))
            msg.attach(MIMEText(html, 'html'))
            
            # Send via Gmail SMTP
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
                server.login(self.gmail_address, self.gmail_password)
                server.sendmail(self.gmail_address, all_recipients, msg.as_string())
            
            return {'success': True, 'provider': 'gmail'}
            
        except smtplib.SMTPAuthenticationError:
            return {'error': 'Gmail authentication failed. Check your App Password.'}
        except Exception as e:
            return {'error': str(e)}
    
    def _send_resend(
        self,
        to: str | List[str],
        subject: str,
        html: str,
        text: Optional[str] = None,
        reply_to: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Send email via Resend API"""
        try:
            import resend
            
            params = {
                'from': f'{self.company_name} <{self.resend_from}>',
                'to': [to] if isinstance(to, str) else to,
                'subject': subject,
                'html': html
            }
            
            if text:
                params['text'] = text
            if reply_to:
                params['reply_to'] = reply_to
            if cc:
                params['cc'] = cc
            if bcc:
                params['bcc'] = bcc
            
            response = resend.Emails.send(params)
            return {'success': True, 'id': response.get('id'), 'provider': 'resend'}
            
        except Exception as e:
            return {'error': str(e)}
    
    # ==================== EMAIL TEMPLATES ====================
    
    def _base_template(self, content: str, title: str = '') -> str:
        """Template email dasar: nama, logo (bila URL), alamat dan kontak diambil dari Profil Perusahaan."""
        c = self._company()
        name = c.get('name') or self._env_company_name
        logo = (c.get('logo') or '').strip()
        logo_html = f'<img src="{logo}" alt="" style="max-height:48px;margin-bottom:8px;"><br>' if logo.startswith(('http://', 'https://')) else ''
        address = (c.get('full_address') or '').replace('\n', ', ')
        contact = ' | '.join(x for x in [c.get('phone'), c.get('email'), c.get('website')] if x)
        footer_info = ''.join(f'<p style="margin:2px 0;">{x}</p>' for x in [address, contact] if x)
        return f"""<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<style>
body {{ font-family: Arial, 'Helvetica Neue', sans-serif; line-height: 1.55; color: #1f2937; margin: 0; padding: 0; background: #f3f5f6; }}
.container {{ max-width: 600px; margin: 0 auto; padding: 16px; }}
.card {{ background: #ffffff; border: 1px solid #d9e0e3; border-radius: 4px; padding: 0; margin: 12px 0; }}
.header {{ padding: 18px 24px; background: #1f4e5a; color: #ffffff; border-radius: 4px 4px 0 0; }}
.header h1 {{ margin: 0; font-size: 18px; font-weight: 700; color: #ffffff; }}
.content {{ padding: 22px 24px; font-size: 14px; }}
.content h2 {{ margin: 0 0 12px; font-size: 17px; color: #1f4e5a; }}
.button {{ display: inline-block; background: #1f4e5a; color: #ffffff !important; padding: 10px 22px; text-decoration: none; border-radius: 4px; font-weight: 600; margin: 8px 0; }}
.button-success {{ background: #1f4e5a; }}
.button-warning {{ background: #8a5a00; }}
.button-danger {{ background: #a12b2b; }}
.info-box {{ background: #e8eff1; border-left: 3px solid #1f4e5a; padding: 12px 14px; margin: 14px 0; }}
.warning-box {{ background: #fdf3dc; border-left: 3px solid #b7791f; padding: 12px 14px; margin: 14px 0; }}
.success-box {{ background: #e3f1e8; border-left: 3px solid #2f7a4d; padding: 12px 14px; margin: 14px 0; }}
.footer {{ padding: 14px 24px; border-top: 1px solid #e5e9eb; color: #6b7780; font-size: 12px; text-align: center; }}
.data-table {{ width: 100%; border-collapse: collapse; margin: 12px 0; }}
.data-table th, .data-table td {{ padding: 8px 10px; text-align: left; border-bottom: 1px solid #e5e9eb; }}
.data-table th {{ background: #f3f6f7; font-weight: 600; }}
.badge {{ display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 12px; font-weight: 600; background: #e8eff1; color: #1f4e5a; }}
</style>
</head>
<body>
<div class="container"><div class="card">
<div class="header">{logo_html}<h1>{name}</h1></div>
<div class="content">{content}</div>
<div class="footer">
{footer_info}
<p style="margin:8px 0 0;">Email ini dikirim otomatis oleh sistem, mohon tidak membalas langsung.</p>
</div>
</div></div>
</body>
</html>"""

    # ==================== NOTIFICATION METHODS ====================

    def send_welcome_email(self, to: str, username: str, full_name: str) -> Dict[str, Any]:
        content = f"""
<h2>Selamat datang, {full_name}</h2>
<p>Akun Anda sudah dibuat.</p>
<div class="info-box">
    <strong>Data akun</strong><br>
    Username: <code>{username}</code><br>
    Email: <code>{to}</code>
</div>
<p>Silakan masuk ke sistem melalui tombol berikut:</p>
<p style="text-align: center;"><a href="{self.app_url}/login" class="button">Masuk ke sistem</a></p>
<p>Jika ada pertanyaan, hubungi administrator sistem.</p>
"""
        return self.send_email(to=to, subject=f'Selamat datang di {self.company_name}', html=self._base_template(content, 'Selamat datang'))

    def send_password_reset(self, to: str, reset_token: str, full_name: str) -> Dict[str, Any]:
        reset_url = f"{self.app_url}/reset-password?token={reset_token}"
        content = f"""
<h2>Permintaan reset password</h2>
<p>Halo {full_name},</p>
<p>Kami menerima permintaan untuk mengatur ulang password Anda. Klik tombol berikut untuk membuat password baru:</p>
<p style="text-align: center;"><a href="{reset_url}" class="button">Reset password</a></p>
<div class="warning-box">
    <strong>Perhatian:</strong> tautan ini berlaku 1 jam. Jika Anda tidak meminta reset, abaikan email ini.
</div>
<p>Jika tombol tidak berfungsi, salin tautan ini ke browser:</p>
<p style="word-break: break-all; color: #6b7780; font-size: 12px;">{reset_url}</p>
"""
        return self.send_email(to=to, subject=f'Reset password - {self.company_name}', html=self._base_template(content, 'Reset password'))

    def send_password_changed(self, to: str, full_name: str) -> Dict[str, Any]:
        content = f"""
<h2>Password berhasil diubah</h2>
<p>Halo {full_name},</p>
<div class="success-box">Password Anda sudah diubah.</div>
<p>Jika bukan Anda yang melakukannya, segera hubungi administrator.</p>
<p style="text-align: center;"><a href="{self.app_url}/login" class="button">Masuk ke sistem</a></p>
"""
        return self.send_email(to=to, subject=f'Password diubah - {self.company_name}', html=self._base_template(content, 'Password diubah'))

    def send_low_stock_alert(self, to: str | List[str], items: List[Dict[str, Any]]) -> Dict[str, Any]:
        items_html = ''
        for item in items:
            items_html += f"""
<tr>
    <td>{item.get('name', '-')}</td>
    <td>{item.get('sku', '-')}</td>
    <td style="color: #a12b2b; font-weight: bold;">{item.get('current_stock', 0)}</td>
    <td>{item.get('min_stock', 0)}</td>
</tr>
"""
        content = f"""
<h2>Peringatan stok menipis</h2>
<p>Barang berikut stoknya sudah di bawah batas minimum:</p>
<table class="data-table">
    <thead><tr><th>Barang</th><th>Kode</th><th>Stok saat ini</th><th>Stok minimum</th></tr></thead>
    <tbody>{items_html}</tbody>
</table>
<p style="text-align: center;"><a href="{self.app_url}/app/warehouse" class="button button-warning">Lihat persediaan</a></p>
"""
        return self.send_email(to=to, subject=f'Stok menipis - {self.company_name}', html=self._base_template(content, 'Stok menipis'))

    def send_order_confirmation(self, to: str, order_number: str, customer_name: str,
                                items: List[Dict[str, Any]], total: float) -> Dict[str, Any]:
        items_html = ''
        for item in items:
            items_html += f"""
<tr>
    <td>{item.get('name', '-')}</td>
    <td style="text-align: center;">{item.get('quantity', 0)}</td>
    <td style="text-align: right;">Rp {item.get('price', 0):,.0f}</td>
    <td style="text-align: right;">Rp {item.get('subtotal', 0):,.0f}</td>
</tr>
"""
        content = f"""
<h2>Konfirmasi pesanan</h2>
<p>Yth. {customer_name},</p>
<p>Terima kasih atas pesanan Anda. Berikut rinciannya:</p>
<div class="info-box">
    <strong>No. pesanan:</strong> {order_number}<br>
    <strong>Tanggal:</strong> {datetime.now().strftime('%d/%m/%Y %H:%M')}
</div>
<table class="data-table">
    <thead><tr><th>Barang</th><th style="text-align: center;">Jumlah</th><th style="text-align: right;">Harga</th><th style="text-align: right;">Subtotal</th></tr></thead>
    <tbody>
        {items_html}
        <tr style="font-weight: bold; background: #f3f6f7;">
            <td colspan="3" style="text-align: right;">Total</td>
            <td style="text-align: right;">Rp {total:,.0f}</td>
        </tr>
    </tbody>
</table>
<p style="text-align: center;"><a href="{self.app_url}/app/sales/orders/{order_number}" class="button">Lihat pesanan</a></p>
"""
        return self.send_email(to=to, subject=f'Konfirmasi pesanan {order_number} - {self.company_name}', html=self._base_template(content, 'Konfirmasi pesanan'))

    def send_production_complete(self, to: str | List[str], work_order: str, product_name: str,
                                 quantity: int, completed_by: str) -> Dict[str, Any]:
        content = f"""
<h2>Produksi selesai</h2>
<div class="success-box">SPK <strong>{work_order}</strong> sudah selesai.</div>
<table class="data-table">
    <tr><th>Produk</th><td>{product_name}</td></tr>
    <tr><th>Jumlah</th><td>{quantity:,}</td></tr>
    <tr><th>Diselesaikan oleh</th><td>{completed_by}</td></tr>
    <tr><th>Waktu selesai</th><td>{datetime.now().strftime('%d/%m/%Y %H:%M')}</td></tr>
</table>
<p style="text-align: center;"><a href="{self.app_url}/app/production/work-orders/{work_order}" class="button">Lihat detail</a></p>
"""
        return self.send_email(to=to, subject=f'Produksi selesai: {work_order} - {self.company_name}', html=self._base_template(content, 'Produksi selesai'))

    def send_approval_request(self, to: str, approver_name: str, request_type: str, request_number: str,
                              requester: str, description: str, amount: Optional[float] = None) -> Dict[str, Any]:
        amount_html = f'<tr><th>Nilai</th><td>Rp {amount:,.0f}</td></tr>' if amount else ''
        content = f"""
<h2>Perlu persetujuan</h2>
<p>Halo {approver_name},</p>
<p>Ada {request_type} baru yang menunggu persetujuan Anda:</p>
<table class="data-table">
    <tr><th>No. dokumen</th><td><strong>{request_number}</strong></td></tr>
    <tr><th>Jenis</th><td><span class="badge">{request_type}</span></td></tr>
    <tr><th>Diajukan oleh</th><td>{requester}</td></tr>
    <tr><th>Keterangan</th><td>{description}</td></tr>
    {amount_html}
</table>
<p style="text-align: center;"><a href="{self.app_url}/app/approvals" class="button">Tinjau dan setujui</a></p>
"""
        return self.send_email(to=to, subject=f'Perlu persetujuan: {request_type} {request_number} - {self.company_name}', html=self._base_template(content, 'Perlu persetujuan'))

    def send_custom_notification(self, to: str | List[str], subject: str, title: str, message: str,
                                 button_text: Optional[str] = None, button_url: Optional[str] = None,
                                 box_type: str = 'info') -> Dict[str, Any]:
        box_class = f'{box_type}-box'
        button_html = ''
        if button_text and button_url:
            button_html = f'<p style="text-align: center;"><a href="{button_url}" class="button">{button_text}</a></p>'
        content = f"""
<h2>{title}</h2>
<div class="{box_class}">{message}</div>
{button_html}
"""
        return self.send_email(to=to, subject=subject, html=self._base_template(content, title))


# Singleton instance
_email_service: Optional[EmailService] = None

def get_email_service() -> EmailService:
    """Get or create email service instance"""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
