from datetime import datetime, timezone

from tests.email_service.helpers import capture_send, html_body, plain_body

from app.services.email_service import privacy_emails


def test_erasure_acknowledgement_is_not_a_premature_deletion_decision(monkeypatch):
    delivered = capture_send(monkeypatch)

    assert privacy_emails.send_erasure_request_received_email(
        recipient_email="person@example.com",
        recipient_name="<Person>",
        response_due_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
    )

    message = delivered["message"]
    plain = plain_body(message)
    html = html_body(message)
    assert "Privacidad" in message["From"]
    assert "no una decisión" in plain
    assert "2026-08-01" in plain
    assert "<Person>" not in html
    assert "&lt;Person&gt;" in html


def test_erasure_acknowledgement_without_name(monkeypatch):
    delivered = capture_send(monkeypatch)

    assert privacy_emails.send_erasure_request_received_email(
        recipient_email="person@example.com",
        recipient_name="",
        response_due_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
    )

    assert plain_body(delivered["message"]).startswith("Hola,")


def test_erasure_resolution_escapes_the_admin_message_when_rejected(monkeypatch):
    delivered = capture_send(monkeypatch)

    assert privacy_emails.send_erasure_request_resolved_email(
        recipient_email="person@example.com",
        recipient_name="Person",
        approved=False,
        resolution_notes="<script>alert(1)</script>",
    )

    message = delivered["message"]
    html = html_body(message)
    plain = plain_body(message)
    assert "Hemos resuelto tu solicitud de supresión" in message["Subject"]
    assert "<script>" not in html
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in html
    assert "No hemos podido atender" in plain


def test_erasure_resolution_approved_copy(monkeypatch):
    delivered = capture_send(monkeypatch)

    assert privacy_emails.send_erasure_request_resolved_email(
        recipient_email="person@example.com",
        recipient_name="Person",
        approved=True,
        resolution_notes="Done",
    )

    message = delivered["message"]
    assert "ha sido atendida" in message["Subject"]
    assert "ya no tiene acceso" in plain_body(message)
