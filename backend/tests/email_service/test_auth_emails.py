from tests.email_service.helpers import capture_send, html_body, plain_body

from app.services.email_service import auth_emails


def test_password_reset_email_escapes_name_and_url(monkeypatch):
    delivered = capture_send(monkeypatch, embed_logo=True)

    assert auth_emails.send_password_reset_email(
        recipient_email="user@example.com",
        recipient_name="<User>",
        reset_url='https://example.com/reset?token="bad"&x=<tag>',
    )

    message = delivered["message"]
    html = html_body(message)
    assert message["Subject"] == "Restablece tu contraseña de WorkHive"
    assert message["To"] == "user@example.com"
    assert "Seguridad" in message["From"]
    assert "<User>" not in html
    assert "&lt;User&gt;" in html
    assert "&quot;bad&quot;" in html
    assert "&lt;tag&gt;" in html
    assert "15 minutos" in html


def test_email_change_verification_escapes_name_and_url(monkeypatch):
    delivered = capture_send(monkeypatch, embed_logo=True)

    assert auth_emails.send_email_change_verification_email(
        recipient_email="new@example.com",
        recipient_name="<User>",
        confirmation_url='https://example.com/confirm?token="bad"&x=<tag>',
    )

    message = delivered["message"]
    html = html_body(message)
    assert message["To"] == "new@example.com"
    assert "&lt;User&gt;" in html
    assert "&quot;bad&quot;" in html
    assert "&lt;tag&gt;" in html
    assert "15 minutos" in html


def test_email_changed_notice_escapes_dynamic_values(monkeypatch):
    delivered = capture_send(monkeypatch)

    assert auth_emails.send_email_changed_notice(
        recipient_email="old@example.com",
        recipient_name="<User>",
        new_email="new+<tag>@example.com",
    )

    message = delivered["message"]
    html = html_body(message)
    assert "&lt;User&gt;" in html
    assert "new+&lt;tag&gt;@example.com" in html
    assert "sesiones anteriores" in html
    assert 'href="http://localhost:3000/contact"' in html
    assert "contacta con soporte</a>." in html
    assert "Soporte: http://localhost:3000/contact" in plain_body(message)
