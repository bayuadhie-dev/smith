#!/usr/bin/env python3
"""Convert system_assessment.updated.md to a styled PDF for company presentation."""

import markdown
from weasyprint import HTML

# Read markdown
with open('system_assessment.updated.md', 'r', encoding='utf-8') as f:
    md_content = f.read()

# Convert to HTML
html_body = markdown.markdown(md_content, extensions=[
    'tables', 'fenced_code', 'codehilite', 'toc', 'nl2br'
])

# Professional styling for company report
styled_html = f"""
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<title>SMITH ERP — System Assessment Report</title>
<style>
  @page {{
    size: A4;
    margin: 2cm 2.5cm;
    @top-right {{ content: "CONFIDENTIAL"; font-size: 8pt; color: #999; }}
    @bottom-center {{ content: "Halaman " counter(page) " dari " counter(pages); font-size: 8pt; color: #666; }}
  }}
  body {{
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 10pt;
    line-height: 1.6;
    color: #333;
    max-width: 100%;
  }}
  h1 {{
    color: #1a365d;
    font-size: 22pt;
    border-bottom: 3px solid #2b6cb0;
    padding-bottom: 8px;
    margin-top: 30px;
    page-break-before: auto;
  }}
  h2 {{
    color: #2b6cb0;
    font-size: 16pt;
    border-bottom: 2px solid #bee3f8;
    padding-bottom: 5px;
    margin-top: 25px;
    page-break-before: auto;
  }}
  h3 {{
    color: #2c5282;
    font-size: 12pt;
    margin-top: 18px;
  }}
  h4 {{
    color: #4a5568;
    font-size: 10.5pt;
  }}
  table {{
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
    font-size: 9pt;
    page-break-inside: avoid;
  }}
  th {{
    background-color: #2b6cb0;
    color: white;
    padding: 8px 10px;
    text-align: left;
    font-weight: 600;
  }}
  td {{
    padding: 6px 10px;
    border: 1px solid #e2e8f0;
  }}
  tr:nth-child(even) {{
    background-color: #f7fafc;
  }}
  tr:hover {{
    background-color: #edf2f7;
  }}
  code {{
    background-color: #edf2f7;
    padding: 2px 5px;
    border-radius: 3px;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 8.5pt;
    color: #c53030;
  }}
  pre {{
    background-color: #1a202c;
    color: #e2e8f0;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 8pt;
    line-height: 1.4;
    overflow-x: auto;
    page-break-inside: avoid;
  }}
  pre code {{
    background-color: transparent;
    color: #e2e8f0;
    padding: 0;
  }}
  blockquote {{
    border-left: 4px solid #3182ce;
    margin: 12px 0;
    padding: 8px 16px;
    background-color: #ebf8ff;
    color: #2c5282;
    font-style: italic;
    page-break-inside: avoid;
  }}
  .header-block {{
    background: linear-gradient(135deg, #1a365d, #2b6cb0);
    color: white;
    padding: 30px 25px;
    margin: -2cm -2.5cm 25px -2.5cm;
    text-align: center;
  }}
  .header-block h1 {{
    color: white;
    border: none;
    font-size: 26pt;
    margin: 0 0 8px 0;
    padding: 0;
  }}
  .header-block .subtitle {{
    font-size: 14pt;
    opacity: 0.9;
    margin: 5px 0;
  }}
  .header-block .meta {{
    font-size: 10pt;
    opacity: 0.8;
    margin-top: 15px;
  }}
  .summary-box {{
    background: #fff5f5;
    border: 2px solid #fc8181;
    border-radius: 8px;
    padding: 15px 20px;
    margin: 15px 0;
    page-break-inside: avoid;
  }}
  ul, ol {{
    margin: 8px 0;
    padding-left: 22px;
  }}
  li {{
    margin: 3px 0;
  }}
  hr {{
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 20px 0;
  }}
  strong {{
    color: #1a202c;
  }}
</style>
</head>
<body>
<div class="header-block">
  <h1>SMITH ERP</h1>
  <div class="subtitle">System Assessment Report — Technical Audit</div>
  <div class="subtitle">Consolidated Bug & Integration Gap Analysis</div>
  <div class="meta">
    Tanggal: 20 April 2026 &nbsp;|&nbsp; 
    Cakupan: 98 Route Files, 48 Models, 337 Frontend Pages &nbsp;|&nbsp;
    Total Codebase: ~298.500 LOC
  </div>
  <div class="meta" style="margin-top:10px; font-size:9pt;">
    DOKUMEN RAHASIA — Hanya untuk keperluan internal perusahaan
  </div>
</div>
{html_body}
</body>
</html>
"""

# Generate PDF
HTML(string=styled_html).write_pdf('system_assessment.updated.pdf')
print("✅ PDF generated: system_assessment.updated.pdf")
