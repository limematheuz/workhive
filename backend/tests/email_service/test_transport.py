from email.message import EmailMessage

from app.services.email_service import transport


def test_from_address_includes_concept(monkeypatch):
    monkeypatch.setattr(transport.settings, "SMTP_FROM_EMAIL", "noreply@example.com")
    assert "WorkHive - Seguridad" in transport.from_address("Seguridad")
    assert "noreply@example.com" in transport.from_address("Seguridad")


def test_from_address_without_concept(monkeypatch):
    monkeypatch.setattr(transport.settings, "SMTP_FROM_EMAIL", "noreply@example.com")
    value = transport.from_address()
    assert value.startswith("WorkHive")
    assert " - " not in value.split("<")[0]


def test_send_email_returns_false_when_smtp_not_configured(monkeypatch):
    monkeypatch.setattr(transport.settings, "EMAIL_ENABLED", False)
    message = EmailMessage()
    message["To"] = "a@example.com"
    message["From"] = "b@example.com"
    message["Subject"] = "x"
    message.set_content("hi")
    assert transport.send_email(message) is False


def test_send_email_uses_smtp_and_embeds_logo(monkeypatch):
    calls = {}

    class FakeSMTP:
        def __init__(self, host, port, timeout=15):
            calls["init"] = (host, port, timeout)

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def starttls(self):
            calls["starttls"] = True

        def login(self, username, password):
            calls["login"] = (username, password)

        def send_message(self, message):
            calls["message"] = message

    monkeypatch.setattr(transport.settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(transport.settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(transport.settings, "SMTP_PORT", 587)
    monkeypatch.setattr(transport.settings, "SMTP_FROM_EMAIL", "noreply@example.com")
    monkeypatch.setattr(transport.settings, "SMTP_USE_SSL", False)
    monkeypatch.setattr(transport.settings, "SMTP_USE_TLS", True)
    monkeypatch.setattr(transport.settings, "SMTP_USERNAME", "user")
    monkeypatch.setattr(transport.settings, "SMTP_PASSWORD", "pass")
    monkeypatch.setattr(transport.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(
        transport,
        "add_logo_to_message",
        lambda message: calls.setdefault("logo", True),
    )

    message = EmailMessage()
    message["To"] = "a@example.com"
    message["From"] = "b@example.com"
    message["Subject"] = "Hello"
    message.set_content("hi")

    assert transport.send_email(message) is True
    assert calls["init"] == ("smtp.example.com", 587, 15)
    assert calls["starttls"] is True
    assert calls["login"] == ("user", "pass")
    assert calls["logo"] is True
    assert calls["message"] is message
