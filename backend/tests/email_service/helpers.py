from email.message import EmailMessage


def html_body(message: EmailMessage) -> str:
    return message.get_body(("html",)).get_content()


def plain_body(message: EmailMessage) -> str:
    return message.get_body(("plain",)).get_content()


def has_inline_logo(message: EmailMessage) -> bool:
    return any(
        part.get("Content-ID") in {"logo", "<logo>"}
        for part in message.walk()
    )


def capture_send(monkeypatch, *, embed_logo: bool = False):
    """Patch transport.send_email and return a dict that stores the message."""
    from app.services.email_service import layout, transport

    delivered: dict = {}

    def capture(message: EmailMessage) -> bool:
        if embed_logo:
            layout.add_logo_to_message(message)
        delivered["message"] = message
        return True

    monkeypatch.setattr(transport, "send_email", capture)
    monkeypatch.setattr(transport.settings, "SMTP_FROM_EMAIL", "noreply@example.com")
    return delivered
