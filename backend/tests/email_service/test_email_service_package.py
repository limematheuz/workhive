"""Public package API compatibility tests."""

from datetime import datetime, timezone
from pathlib import Path

from tests.email_service.helpers import capture_send, has_inline_logo, html_body, plain_body

from app.core.config import settings
from app.services import email_service


def test_package_reexports_public_senders():
    assert callable(email_service.send_password_reset_email)
    assert callable(email_service.send_contact_email)
    assert callable(email_service.send_trial_verification_email)
    assert callable(email_service.send_trial_approved_email)
    assert callable(email_service.send_worker_invitation_email)
    assert callable(email_service.send_erasure_request_received_email)
    assert callable(email_service.send_erasure_request_resolved_email)
    assert callable(email_service.send_invoice_email)


def test_package_keeps_private_aliases():
    assert email_service._send_email is email_service.send_email
    assert email_service._add_logo_to_message is email_service.add_logo_to_message
    assert email_service._from_address is email_service.from_address


def test_contact_email_via_package_api(monkeypatch):
    delivered = capture_send(monkeypatch, embed_logo=True)
    monkeypatch.setattr(settings, "CONTACT_RECIPIENT_EMAIL", "owner@example.com")

    assert email_service.send_contact_email(
        sender_name="<Admin>",
        sender_email="sender@example.com",
        subject="<script>alert(1)</script>",
        body="Hola\n<img src=x onerror=alert(1)>",
    )

    assert has_inline_logo(delivered["message"])
    html = html_body(delivered["message"])
    assert "&lt;Admin&gt;" in html
    assert "<script>" not in html


def test_password_reset_via_package_api(monkeypatch):
    delivered = capture_send(monkeypatch, embed_logo=True)

    assert email_service.send_password_reset_email(
        recipient_email="user@example.com",
        recipient_name="<User>",
        reset_url='https://example.com/reset?token="bad"',
    )

    html = html_body(delivered["message"])
    assert "&lt;User&gt;" in html
    assert "&quot;bad&quot;" in html


def test_invoice_via_package_api(tmp_path: Path, monkeypatch):
    delivered = capture_send(monkeypatch)
    pdf_path = tmp_path / "invoice.pdf"
    pdf_path.write_bytes(b"%PDF-1.4\n")

    assert email_service.send_invoice_email(
        recipient_email="client@example.com",
        recipient_name="Client",
        issuer_name="Issuer",
        invoice_number="INV-1",
        pdf_path=pdf_path,
    )

    assert delivered["message"]["Subject"] == "Factura INV-1 - Issuer"


def test_erasure_via_package_api(monkeypatch):
    delivered = capture_send(monkeypatch)

    assert email_service.send_erasure_request_received_email(
        recipient_email="person@example.com",
        recipient_name="Person",
        response_due_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
    )
    assert "no una decisión" in plain_body(delivered["message"])
