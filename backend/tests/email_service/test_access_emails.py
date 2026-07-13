from datetime import datetime, timezone

from tests.email_service.helpers import capture_send, html_body, plain_body

from app.services.email_service import access_emails


def test_trial_verification_email_escapes_fields(monkeypatch):
    delivered = capture_send(monkeypatch)

    assert access_emails.send_trial_verification_email(
        recipient_email="user@example.com",
        recipient_name="<User>",
        company_name="<Company>",
        verification_url='https://example.com/verify?x="1"',
    )

    message = delivered["message"]
    html = html_body(message)
    assert message["Subject"] == "Verifica tu solicitud de acceso a WorkHive"
    assert "Acceso" in message["From"]
    assert "<User>" not in html
    assert "&lt;User&gt;" in html
    assert "&lt;Company&gt;" in html
    assert "&quot;1&quot;" in html


def test_trial_approved_email_trial_mode_includes_end_date(monkeypatch):
    delivered = capture_send(monkeypatch)
    ends_at = datetime(2026, 9, 1, tzinfo=timezone.utc)

    assert access_emails.send_trial_approved_email(
        recipient_email="user@example.com",
        recipient_name="User",
        company_name="Acme",
        setup_url="https://example.com/setup",
        access_mode="trial",
        trial_ends_at=ends_at,
    )

    plain = plain_body(delivered["message"])
    assert "2026-09-01" in plain
    assert "Crear contraseña" in html_body(delivered["message"]) or "setup" in plain


def test_trial_approved_email_pro_mode_without_trial_date(monkeypatch):
    delivered = capture_send(monkeypatch)

    assert access_emails.send_trial_approved_email(
        recipient_email="user@example.com",
        recipient_name="User",
        company_name="Acme",
        setup_url="https://example.com/setup",
        access_mode="pro",
        trial_ends_at=None,
    )

    plain = plain_body(delivered["message"])
    assert "Tu acceso Pro ya está activo." in plain


def test_worker_invitation_email_includes_code_and_expiry(monkeypatch):
    delivered = capture_send(monkeypatch)
    expires_at = datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc)

    assert access_emails.send_worker_invitation_email(
        recipient_email="worker@example.com",
        recipient_name="<Worker>",
        company_name="<Acme>",
        invitation_url='https://example.com/invite?x=<y>',
        verification_code="AB12CD",
        expires_at=expires_at,
    )

    message = delivered["message"]
    html = html_body(message)
    plain = plain_body(message)
    assert "Invitación para unirte a <Acme>" in message["Subject"]
    assert "AB12CD" in plain
    assert "&lt;Worker&gt;" in html
    assert "&lt;Acme&gt;" in html
    assert "&lt;y&gt;" in html
    assert "No compartas" in plain


def test_worker_invitation_email_without_name(monkeypatch):
    delivered = capture_send(monkeypatch)

    assert access_emails.send_worker_invitation_email(
        recipient_email="worker@example.com",
        recipient_name="",
        company_name="Acme",
        invitation_url="https://example.com/invite",
        verification_code="ZZ99",
        expires_at=datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc),
    )

    plain = plain_body(delivered["message"])
    assert plain.startswith("Hola,")
