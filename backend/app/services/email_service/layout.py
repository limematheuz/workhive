import logging
from collections.abc import Iterable
from email.message import EmailMessage
from html import escape
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

# Shared light-mode brand shell for every transactional email.
_BRAND = {
    # Outer canvas — soft brand blue so the white card clearly separates.
    "bg": "#dbe7fb",
    "bg_accent": "#c7d9f8",
    "card": "#ffffff",
    "card_border": "#bfd0ea",
    "accent": "#2563eb",
    "accent_hover": "#1d4ed8",
    "accent_soft": "#eff6ff",
    "accent_border": "#bfdbfe",
    "text": "#111827",
    "muted": "#526070",
    "divider": "#e5e7eb",
    "inset_bg": "#f4f7fb",
    "warning_bg": "#fffbeb",
    "warning_border": "#fef3c7",
    "warning_text": "#b45309",
    "warning_strong": "#92400e",
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
            'style="width:220px;max-width:100%;height:auto;display:block;'
            'margin:0 auto;border:0;outline:none;text-decoration:none;" />'
        )
    return (
        f'<span style="font-size:28px;font-weight:800;color:{_BRAND["text"]};'
        'letter-spacing:-0.6px;">WorkHive</span>'
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
    support_label = "Contact support" if html_lang == "en" else "Contactar con soporte"
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
    .email-outer {{ padding:24px 12px !important; }}
    .email-card {{ max-width:100% !important; border-radius:16px !important; }}
    .email-header {{ padding:28px 20px 22px !important; }}
    .email-body {{ padding:28px 20px 32px !important; }}
    .email-footer-outer {{ padding:18px 12px 8px !important; }}
    .email-logo img {{ width:180px !important; }}
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
<body style="margin:0;padding:0;background-color:{b["bg"]};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
{f'<div style="display:none;max-height:0;overflow:hidden;">{escape(preview_text)}</div>' if preview_text else ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{b["bg"]};background-image:linear-gradient(180deg,{b["bg"]} 0%,{b["bg_accent"]} 100%);">
<tr><td align="center" class="email-outer" style="padding:40px 16px 28px;">

<!-- Card -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-card" style="max-width:560px;background-color:{b["card"]};border:1px solid {b["card_border"]};border-radius:18px;overflow:hidden;box-shadow:0 18px 48px rgba(37,99,235,0.14),0 4px 14px rgba(15,23,42,0.06);table-layout:fixed;">

<!-- Header -->
<tr>
<td class="email-header email-logo" style="padding:36px 40px 28px;text-align:center;border-bottom:1px solid {b["divider"]};background-color:{b["card"]};">
  {header_html}
</td>
</tr>

<!-- Body -->
<tr>
<td class="email-body" style="padding:36px 40px 40px;background-color:{b["card"]};">
{content}
</td>
</tr>

</table>
<!-- /Card -->

<!-- Footer lives outside the card (light canvas) -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr>
<td class="email-footer-outer" style="padding:22px 16px 8px;text-align:center;">
  <p style="margin:0;font-size:12px;line-height:18px;color:{b["muted"]};">
    &copy; 2026 WorkHive&nbsp;&nbsp;&middot;&nbsp;&nbsp;{footer_text}
  </p>
  <p style="margin:6px 0 0;font-size:12px;line-height:18px;color:{b["muted"]};">
    {support_link(support_label)}
  </p>
</td>
</tr>
</table>

</td></tr>
</table>
</body>
</html>"""


def get_support_url() -> str:
    """Return the public support page for the current frontend environment."""
    return f"{settings.FRONTEND_URL.rstrip('/')}/contact"


def support_link(label: str = "Contacta con soporte") -> str:
    """Render a safe inline link to WorkHive support."""
    safe_url = escape(get_support_url(), quote=True)
    safe_label = escape(label)
    return (
        f'<a href="{safe_url}" target="_blank" rel="noopener noreferrer" '
        f'style="color:{_BRAND["accent"]};text-decoration:underline;'
        f'font-weight:600;">{safe_label}</a>'
    )


def plain_body(lines: Iterable[str], *, locale: str = "es") -> str:
    """Compose a plain-text email body with the shared support footer."""
    support_label = "Support" if locale == "en" else "Soporte"
    return "\n".join([*lines, "", f"{support_label}: {get_support_url()}"])


def button(url: str, label: str) -> str:
    b = _BRAND
    safe_url = escape(url, quote=True)
    safe_label = escape(label)
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 24px;">'
        f'<tr><td style="background-color:{b["accent"]};border-radius:10px;'
        f'box-shadow:0 8px 20px rgba(37,99,235,0.28);">'
        f'<a href="{safe_url}" target="_blank" '
        f'style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:700;'
        f"color:#ffffff;text-decoration:none;border-radius:10px;"
        f'background-color:{b["accent"]};">{safe_label}</a>'
        f"</td></tr></table>"
    )


def heading(text: str) -> str:
    """Shared centered H1 used by transactional emails."""
    b = _BRAND
    return (
        f'<h1 class="email-h1" style="margin:0 0 14px;font-size:26px;line-height:32px;'
        f'font-weight:800;color:{b["text"]};text-align:center;">{escape(text)}</h1>'
    )


def lead(html: str) -> str:
    """Shared centered lead paragraph (HTML already escaped by caller where needed)."""
    b = _BRAND
    return (
        f'<p class="email-lead" style="margin:0 0 8px;font-size:15px;color:{b["muted"]};'
        f'text-align:center;line-height:24px;">{html}</p>'
    )


def muted_note(html: str) -> str:
    b = _BRAND
    return (
        f'<p style="margin:0;font-size:12px;color:{b["muted"]};text-align:center;'
        f'line-height:18px;">{html}</p>'
    )


def fallback_link(url: str) -> str:
    b = _BRAND
    safe_url = escape(url, quote=True)
    return (
        f'<p style="margin:18px 0 0;font-size:11px;color:{b["muted"]};'
        f'word-break:break-all;text-align:center;line-height:16px;">'
        f'<a href="{safe_url}" style="color:{b["accent"]};text-decoration:none;">{safe_url}</a>'
        f"</p>"
    )


def warning_box(html: str) -> str:
    b = _BRAND
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="margin:24px 0 16px;"><tr>'
        f'<td style="background-color:{b["warning_bg"]};border:1px solid {b["warning_border"]};'
        f'border-radius:10px;padding:12px 16px;text-align:center;">'
        f'<p style="margin:0;font-size:12px;color:{b["warning_text"]};line-height:18px;'
        f'font-weight:500;">{html}</p>'
        "</td></tr></table>"
    )


def accent_box(html: str) -> str:
    b = _BRAND
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="margin:20px 0;"><tr>'
        f'<td style="background-color:{b["accent_soft"]};border:1px solid {b["accent_border"]};'
        f'border-radius:10px;padding:16px 18px;text-align:center;">'
        f"{html}"
        "</td></tr></table>"
    )
