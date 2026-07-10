from pathlib import Path

from app.services import email_service


def _html_body(message):
    return message.get_body(("html",)).get_content()


def _has_inline_logo(message):
    return any(
        part.get("Content-ID") in {"logo", "<logo>"}
        for part in message.walk()
    )


def test_contact_email_escapes_untrusted_html(monkeypatch):
    delivered = {}

    def capture(message):
        email_service._add_logo_to_message(message)
        delivered["message"] = message
        return True

    monkeypatch.setattr(email_service.settings, "CONTACT_RECIPIENT_EMAIL", "owner@example.com")
    monkeypatch.setattr(email_service.settings, "SMTP_FROM_EMAIL", "noreply@example.com")
    monkeypatch.setattr(email_service, "_send_email", capture)

    assert email_service.send_contact_email(
        sender_name="<Admin>",
        sender_email="sender@example.com",
        subject="<script>alert(1)</script>",
        body="Hola\n<img src=x onerror=alert(1)>",
    )

    assert _has_inline_logo(delivered["message"])
    html = _html_body(delivered["message"])
    assert "<script>" not in html
    assert "<img src=x" not in html
    assert "&lt;Admin&gt;" in html
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in html
    assert "Hola<br>&lt;img src=x onerror=alert(1)&gt;" in html


def test_password_reset_email_escapes_name_and_url(monkeypatch):
    delivered = {}

    def capture(message):
        email_service._add_logo_to_message(message)
        delivered["message"] = message
        return True

    monkeypatch.setattr(email_service.settings, "SMTP_FROM_EMAIL", "noreply@example.com")
    monkeypatch.setattr(email_service, "_send_email", capture)

    assert email_service.send_password_reset_email(
        recipient_email="user@example.com",
        recipient_name="<User>",
        reset_url='https://example.com/reset?token="bad"&x=<tag>',
    )

    assert _has_inline_logo(delivered["message"])
    html = _html_body(delivered["message"])
    assert "<User>" not in html
    assert "&lt;User&gt;" in html
    assert "&quot;bad&quot;" in html
    assert "&lt;tag&gt;" in html


def test_invoice_email_escapes_untrusted_fields(monkeypatch, tmp_path: Path):
    delivered = {}
    pdf_path = tmp_path / "invoice.pdf"
    pdf_path.write_bytes(b"%PDF-1.4\n")

    def capture(message):
        delivered["message"] = message
        return True

    monkeypatch.setattr(email_service.settings, "SMTP_FROM_EMAIL", "noreply@example.com")
    monkeypatch.setattr(email_service, "_send_email", capture)

    assert email_service.send_invoice_email(
        recipient_email="client@example.com",
        recipient_name="<Client>",
        issuer_name="<Issuer>",
        invoice_number='INV-"1"',
        pdf_path=pdf_path,
        custom_message="<b>Pay now</b>",
    )

    html = _html_body(delivered["message"])
    assert "@media only screen and (max-width:600px)" in html
    assert "email-text-break" in html
    assert "<Client>" not in html
    assert "<Issuer>" not in html
    assert "<b>Pay now</b>" not in html
    assert "&lt;Client&gt;" in html
    assert "&lt;Issuer&gt;" in html
    assert "&lt;b&gt;Pay now&lt;/b&gt;" in html


def test_invoice_email_attaches_definitive_pdf(tmp_path, monkeypatch):
    pdf_path = tmp_path / "INV-2026-0001.pdf"
    pdf_path.write_bytes(b"%PDF-test")
    delivered = {}

    def capture_message(message):
        email_service._add_logo_to_message(message)
        delivered["message"] = message
        return True

    monkeypatch.setattr(email_service.settings, "SMTP_FROM_EMAIL", "noreply@example.com")
    monkeypatch.setattr(email_service, "_send_email", capture_message)
    sent = email_service.send_invoice_email(
        recipient_email="billing@example.com",
        recipient_name="Example Client",
        issuer_name="Example Issuer",
        invoice_number="INV-2026-0001",
        pdf_path=pdf_path,
    )

    assert sent is True
    message = delivered["message"]
    assert _has_inline_logo(message)
    assert message["To"] == "billing@example.com"
    assert message["Subject"] == "Factura INV-2026-0001 - Example Issuer"
    attachments = list(message.iter_attachments())
    assert len(attachments) == 1
    assert attachments[0].get_filename() == "INV-2026-0001.pdf"
    assert attachments[0].get_payload(decode=True) == b"%PDF-test"


def test_invoice_email_supports_custom_subject_and_sender_copy(tmp_path, monkeypatch):
    pdf_path = tmp_path / "invoice.pdf"
    pdf_path.write_bytes(b"%PDF-test")
    delivered = {}

    def capture_message(message):
        delivered["message"] = message
        return True

    monkeypatch.setattr(email_service.settings, "SMTP_FROM_EMAIL", "noreply@example.com")
    monkeypatch.setattr(email_service, "_send_email", capture_message)

    assert email_service.send_invoice_email(
        recipient_email=["external@example.com", "other@example.com"],
        recipient_name="External",
        issuer_name="Issuer",
        invoice_number="INV-2026-0002",
        pdf_path=pdf_path,
        subject="Custom invoice subject",
        custom_message="Custom message",
        copy_emails=["copy@example.com"],
        sender_copy_email="admin@example.com",
    )

    message = delivered["message"]
    assert message["To"] == "external@example.com, other@example.com"
    assert message["Cc"] == "copy@example.com, admin@example.com"
    assert message["Subject"] == "Custom invoice subject"
    assert "Custom message" in message.get_body(("plain",)).get_content()
