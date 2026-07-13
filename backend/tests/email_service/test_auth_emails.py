from tests.email_service.helpers import capture_send, html_body

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
