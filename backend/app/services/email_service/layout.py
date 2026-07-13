import logging
from email.message import EmailMessage
from html import escape
from pathlib import Path

logger = logging.getLogger(__name__)

_BRAND = {
    "bg": "#f3f4f6",
    "card": "#ffffff",
    "card_border": "#e5e7eb",
    "accent": "#2563eb",
    "accent_soft": "#eff6ff",
    "accent_border": "#bfdbfe",
    "text": "#111827",
    "muted": "#4b5563",
    "divider": "#e5e7eb",
    "footer_bg": "#f9fafb",
    "inset_bg": "#f3f4f6",
}

_LOGO_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent.parent
    / "frontend"
    / "public"
    / "logo"
    / "black-logo.png"
)


def get_logo_header() -> str:
    """Check if logo exists on disk, and render it inline, falling back to text."""
    if _LOGO_PATH.exists():
        return (
            '<img src="cid:logo" alt="WorkHive" '
            'style="width:260px;max-width:100%;height:auto;display:block;'
            'margin:0 auto;border:0;outline:none;text-decoration:none;" />'
        )
    return (
        f'<span style="font-size:30px;font-weight:900;color:{_BRAND["text"]};'
        'letter-spacing:-0.8px;">WorkHive</span>'
    )


def add_logo_to_message(message: EmailMessage) -> None:
    """Embed black-logo.png as an inline related part when referenced in HTML."""
    try:
        if not _LOGO_PATH.exists():
            return
        logo_data = _LOGO_PATH.read_bytes()
        for part in message.walk():
            if part.get_content_type() != "text/html":
                continue
            part.add_related(
                logo_data,
                maintype="image",
                subtype="png",
                cid="logo",
            )
            break
    except Exception as e:
        logger.warning(f"Could not embed inline logo: {e}")


def base_layout(content: str, *, preview_text: str = "", locale: str = "es") -> str:
    """Wrap *content* in the shared WorkHive email shell (light theme)."""
    b = _BRAND
    header_html = get_logo_header()
    html_lang = "en" if locale == "en" else "es"
    footer_text = (
        "Smart business management"
        if html_lang == "en"
        else "Gestión empresarial inteligente"
    )
    return f"""\
<!DOCTYPE html>
<html lang="{html_lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>WorkHive</title>
<style>
  body, table, td, p, a {{ -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }}
  table, td {{ border-collapse:collapse; }}
  img {{ border:0; outline:none; text-decoration:none; max-width:100%; height:auto; }}
  .email-text-break {{ overflow-wrap:anywhere; word-break:break-word; }}
  @media only screen and (max-width:600px) {{
    .email-outer {{ padding:20px 10px !important; }}
    .email-card {{ max-width:100% !important; border-radius:14px !important; }}
    .email-header {{ padding:24px 18px 20px !important; }}
    .email-body {{ padding:28px 18px !important; }}
    .email-footer {{ padding:18px !important; }}
    .email-logo img {{ width:210px !important; }}
    .email-h1 {{ font-size:24px !important; line-height:30px !important; }}
    .email-lead {{ font-size:14px !important; line-height:22px !important; margin-bottom:22px !important; }}
    .email-section-title {{ padding:12px 14px !important; font-size:11px !important; }}
    .email-detail-label,
    .email-detail-value {{
      display:block !important;
      width:auto !important;
      padding:12px 14px !important;
      box-sizing:border-box !important;
    }}
    .email-detail-label {{ padding-bottom:4px !important; border-bottom:0 !important; }}
    .email-detail-value {{ padding-top:0 !important; }}
    .email-message-cell {{ padding:18px 16px !important; }}
    .email-message-body {{ font-size:14px !important; line-height:22px !important; }}
    .email-file-cell {{ padding:14px !important; }}
    .email-file-name {{ font-size:14px !important; line-height:20px !important; }}
  }}
</style>
<!--[if mso]>
<style>table,td {{font-family:Arial,sans-serif;}}</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:{b['bg']};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
{f'<div style="display:none;max-height:0;overflow:hidden;">{escape(preview_text)}</div>' if preview_text else ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{b['bg']};">
<tr><td align="center" class="email-outer" style="padding:40px 16px;">

<!-- Card -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-card" style="max-width:680px;background-color:{b['card']};border:1px solid {b['card_border']};border-top:5px solid {b['accent']};border-radius:18px;overflow:hidden;box-shadow:0 10px 28px rgba(15,23,42,0.08);table-layout:fixed;">

<!-- Header -->
<tr>
<td class="email-header email-logo" style="padding:34px 44px 30px;text-align:center;border-bottom:1px solid {b['divider']};">
  {header_html}
</td>
</tr>

<!-- Body -->
<tr>
<td class="email-body" style="padding:42px 46px;">
{content}
</td>
</tr>

<!-- Footer -->
<tr>
<td class="email-footer" style="padding:22px 46px 26px;background-color:{b['footer_bg']};border-top:1px solid {b['divider']};text-align:center;">
  <p style="margin:0;font-size:12px;line-height:18px;color:{b['muted']};">
    &copy; 2026 WorkHive&nbsp;&nbsp;&middot;&nbsp;&nbsp;{footer_text}
  </p>
</td>
</tr>

</table>
<!-- /Card -->

</td></tr>
</table>
</body>
</html>"""


def button(url: str, label: str) -> str:
    b = _BRAND
    safe_url = escape(url, quote=True)
    safe_label = escape(label)
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">'
        f"<tr><td style=\"background-color:{b['accent']};border-radius:8px;\">"
        f'<a href="{safe_url}" target="_blank" '
        f"style=\"display:inline-block;padding:12px 32px;font-size:14px;font-weight:600;"
        f"color:#ffffff;text-decoration:none;border-radius:8px;\">{safe_label}</a>"
        f"</td></tr></table>"
    )
