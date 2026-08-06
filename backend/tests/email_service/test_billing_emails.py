from pathlib import Path

from tests.email_service.helpers import capture_send, has_inline_logo, html_body, plain_body

from app.services.email_service import billing_emails


def test_invoice_email_escapes_untrusted_fields(monkeypatch, tmp_path: Path):
    delivered = capture_send(monkeypatch)
    pdf_path = tmp_path / "invoice.pdf"
    pdf_path.write_bytes(b"%PDF-1.4\n")

    assert billing_emails.send_invoice_email(
        recipient_email="client@example.com",
        recipient_name="<Client>",
        issuer_name="<Issuer>",
        invoice_number='INV-"1"',
        pdf_path=pdf_path,
        custom_message="<b>Pay now</b>",
    )

    html = html_body(delivered["message"])
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
    delivered = capture_send(monkeypatch, embed_logo=True)

    assert billing_emails.send_invoice_email(
        recipient_email="billing@example.com",
        recipient_name="Example Client",
        issuer_name="Example Issuer",
        invoice_number="INV-2026-0001",
        pdf_path=pdf_path,
    )

    message = delivered["message"]
    assert has_inline_logo(message)
    assert message["To"] == "billing@example.com"
    assert message["Subject"] == "Factura INV-2026-0001 - Example Issuer"
    assert "Facturación" in message["From"]
    attachments = list(message.iter_attachments())
    assert len(attachments) == 1
    assert attachments[0].get_filename() == "INV-2026-0001.pdf"
    assert attachments[0].get_payload(decode=True) == b"%PDF-test"


def test_invoice_email_supports_custom_subject_and_sender_copy(tmp_path, monkeypatch):
    pdf_path = tmp_path / "invoice.pdf"
    pdf_path.write_bytes(b"%PDF-test")
    delivered = capture_send(monkeypatch)

    assert billing_emails.send_invoice_email(
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
    assert "Custom message" in plain_body(message)


def test_invoice_email_never_repeats_primary_recipients_in_cc(tmp_path, monkeypatch):
    pdf_path = tmp_path / "invoice.pdf"
    pdf_path.write_bytes(b"%PDF-test")
    delivered = capture_send(monkeypatch)

    assert billing_emails.send_invoice_email(
        recipient_email=["client@example.com", "other@example.com"],
        recipient_name="Client",
        issuer_name="Issuer",
        invoice_number="INV-2026-0003",
        pdf_path=pdf_path,
        copy_emails=["CLIENT@example.com", "copy@example.com", "copy@example.com"],
        sender_copy_email="other@example.com",
    )

    message = delivered["message"]
    assert message["To"] == "client@example.com, other@example.com"
    assert message["Cc"] == "copy@example.com"


def test_invoice_email_english_locale(tmp_path, monkeypatch):
    pdf_path = tmp_path / "invoice.pdf"
    pdf_path.write_bytes(b"%PDF-test")
    delivered = capture_send(monkeypatch)

    assert billing_emails.send_invoice_email(
        recipient_email="client@example.com",
        recipient_name="Client",
        issuer_name="Issuer",
        invoice_number="INV-9",
        pdf_path=pdf_path,
        document_label="Invoice",
        locale="en",
    )

    message = delivered["message"]
    html = html_body(message)
    assert "lang=\"en\"" in html
    assert "Billing details" in html
    assert "Billing" in message["From"]


def test_invoice_email_returns_false_without_recipients(tmp_path, monkeypatch):
    capture_send(monkeypatch)
    pdf_path = tmp_path / "invoice.pdf"
    pdf_path.write_bytes(b"%PDF-test")

    assert billing_emails.send_invoice_email(
        recipient_email=[],
        recipient_name="Client",
        issuer_name="Issuer",
        invoice_number="INV-0",
        pdf_path=pdf_path,
    ) is False
