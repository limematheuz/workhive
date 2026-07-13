from tests.email_service.helpers import capture_send, html_body

from app.core.config import settings
from app.services.email_service import contact_emails


def test_contact_email_escapes_untrusted_html(monkeypatch):
    delivered = capture_send(monkeypatch, embed_logo=True)
    monkeypatch.setattr(settings, "CONTACT_RECIPIENT_EMAIL", "owner@example.com")

    assert contact_emails.send_contact_email(
        sender_name="<Admin>",
        sender_email="sender@example.com",
        subject="<script>alert(1)</script>",
        body="Hola\n<img src=x onerror=alert(1)>",
    )

    message = delivered["message"]
    html = html_body(message)
    assert message["To"] == "owner@example.com"
    assert message["Reply-To"] == "sender@example.com"
    assert "[WorkHive Contact]" in message["Subject"]
    assert "<script>" not in html
    assert "<img src=x" not in html
    assert "&lt;Admin&gt;" in html
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in html
    assert "Hola<br>&lt;img src=x onerror=alert(1)&gt;" in html


def test_contact_email_returns_false_without_recipient(monkeypatch):
    capture_send(monkeypatch)
    monkeypatch.setattr(settings, "CONTACT_RECIPIENT_EMAIL", None)
    assert contact_emails.send_contact_email(
        sender_name="Admin",
        sender_email="sender@example.com",
        subject="Hello",
        body="Body",
    ) is False
