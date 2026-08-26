from email.message import EmailMessage
from pathlib import Path

from app.services.email_service import layout
from app.services.email_service.access_emails import (
    send_trial_approved_email,
    send_trial_expiring_email,
    send_trial_expiring_superadmin_email,
    send_trial_verification_email,
)
from app.services.email_service.company_collaboration_emails import (
    send_company_collaboration_decision_email,
    send_company_collaboration_invitation_email,
)
from app.services.email_service.auth_emails import (
    send_email_change_verification_email,
    send_email_changed_notice,
    send_password_reset_email,
)
from app.services.email_service.billing_emails import send_invoice_email
from app.services.email_service.contact_emails import send_contact_email
from app.services.email_service.privacy_emails import (
    send_erasure_request_received_email,
    send_erasure_request_resolved_email,
)
from app.services.email_service.worker_invitation_emails import send_worker_invitation_email


def test_button_escapes_url_and_label():
    html = layout.button('https://x.test/?q="a"<b>', "<Click>")
    assert "<Click>" not in html
    assert "&lt;Click&gt;" in html
    assert "&quot;a&quot;" in html
    assert "&lt;b&gt;" in html
    assert layout._BRAND["accent"] in html


def test_base_layout_includes_preview_and_locale():
    html = layout.base_layout("<p>Body</p>", preview_text="Preview <x>", locale="en")
    assert 'lang="en"' in html
    assert "Smart business management" in html
    assert "Contact support" in html
    assert "Preview &lt;x&gt;" in html
    assert "<p>Body</p>" in html


def test_base_layout_defaults_to_spanish_footer():
    html = layout.base_layout("<p>Body</p>")
    assert 'lang="es"' in html
    assert "Gestión empresarial inteligente" in html
    assert "Contactar con soporte" in html
    assert 'href="http://localhost:3000/contact"' in html


def test_support_helpers_use_configured_frontend_and_escape_content(monkeypatch):
    monkeypatch.setattr(layout.settings, "FRONTEND_URL", 'https://app.example/"bad')

    html = layout.support_link("Ayuda <urgente>")
    plain = layout.plain_body(["Mensaje"])

    assert 'href="https://app.example/&quot;bad/contact"' in html
    assert "Ayuda &lt;urgente&gt;" in html
    assert 'rel="noopener noreferrer"' in html
    assert plain == 'Mensaje\n\nSoporte: https://app.example/"bad/contact'


def test_plain_body_localizes_support_label():
    assert "\nSupport: http://localhost:3000/contact" in layout.plain_body(
        ["Message"], locale="en"
    )


def test_base_layout_uses_light_brand_shell_with_visible_card():
    html = layout.base_layout("<p>Body</p>")
    brand = layout._BRAND

    assert brand["accent"] == "#2563eb"
    assert brand["card"] == "#ffffff"
    assert brand["bg"] == "#dbe7fb"
    assert brand["bg"] in html
    assert f"background-color:{brand['card']}" in html
    assert 'name="color-scheme" content="light"' in html
    # Footer sits outside the white card.
    card_close = html.rfind("<!-- /Card -->")
    footer_pos = html.find("&copy; 2026 WorkHive")
    assert card_close != -1
    assert footer_pos > card_close
    assert "email-footer-outer" in html
    assert "border-top:5px solid" not in html


def test_shared_content_helpers_use_brand_tokens():
    assert layout._BRAND["accent"] in layout.fallback_link("https://example.com/a")
    assert "15 minutos" in layout.warning_box("15 minutos")
    assert layout._BRAND["accent_soft"] in layout.accent_box("<p>Hi</p>")
    assert "Verifica" in layout.heading("Verifica")


def test_add_logo_to_message_is_safe_without_html_part(tmp_path, monkeypatch):
    monkeypatch.setattr(layout, "_LOGO_PATH", tmp_path / "missing.png")
    message = EmailMessage()
    message.set_content("plain only")
    layout.add_logo_to_message(message)
    assert not any(
        part.get("Content-ID") in {"logo", "<logo>"} for part in message.walk()
    )


def test_add_logo_embeds_when_file_exists(tmp_path, monkeypatch):
    logo = tmp_path / "black-logo.png"
    logo.write_bytes(b"png-bytes")
    monkeypatch.setattr(layout, "_LOGO_PATH", logo)

    message = EmailMessage()
    message.set_content("plain")
    message.add_alternative("<html><body>Hi</body></html>", subtype="html")
    layout.add_logo_to_message(message)

    assert any(part.get("Content-ID") in {"logo", "<logo>"} for part in message.walk())


def test_get_logo_header_falls_back_to_text(tmp_path, monkeypatch):
    monkeypatch.setattr(layout, "_LOGO_PATH", tmp_path / "missing.png")
    assert "WorkHive" in layout.get_logo_header()
    assert "cid:logo" not in layout.get_logo_header()


def test_get_logo_header_uses_cid_when_logo_exists(tmp_path, monkeypatch):
    logo = tmp_path / "black-logo.png"
    logo.write_bytes(b"png")
    monkeypatch.setattr(layout, "_LOGO_PATH", logo)
    assert "cid:logo" in layout.get_logo_header()


def test_all_transactional_email_builders_use_shared_base_layout():
    email_modules = (
        Path(__file__).resolve().parents[2] / "app" / "services" / "email_service"
    )
    builders = [
        send_password_reset_email,
        send_email_change_verification_email,
        send_email_changed_notice,
        send_trial_verification_email,
        send_trial_approved_email,
        send_trial_expiring_email,
        send_trial_expiring_superadmin_email,
        send_worker_invitation_email,
        send_company_collaboration_invitation_email,
        send_company_collaboration_decision_email,
        send_contact_email,
        send_invoice_email,
        send_erasure_request_received_email,
        send_erasure_request_resolved_email,
    ]
    sources = {
        path.name: path.read_text(encoding="utf-8")
        for path in email_modules.glob("*_emails.py")
    }
    assert sources, "expected transactional email modules"

    for source in sources.values():
        assert "base_layout(" in source
        assert "plain_body(" in source
        assert "from app.services.email_service.layout import" in source

    # Keep the public builder list intentional so new emails stay on the shared shell.
    assert len(builders) == 14
