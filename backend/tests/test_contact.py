def test_contact_form_can_be_disabled(client, monkeypatch):
    monkeypatch.setattr("app.core.config.settings.CONTACT_FORM_ENABLED", False)

    response = client.post(
        "/api/v1/contact/",
        json={
            "name": "Alex Example",
            "email": "alex@example.com",
            "subject": "Support request",
            "message": "This message is long enough to pass validation.",
        },
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Contact form is not configured"


def test_contact_form_delivers_message(client, monkeypatch):
    delivered = {}

    def capture_contact_email(sender_name, sender_email, subject, body):
        delivered.update(
            {
                "sender_name": sender_name,
                "sender_email": sender_email,
                "subject": subject,
                "body": body,
            }
        )
        return True

    monkeypatch.setattr(
        "app.services.email_service.send_contact_email",
        capture_contact_email,
    )
    response = client.post(
        "/api/v1/contact/",
        json={
            "name": "Ana García",
            "email": "ana@example.com",
            "subject": "Información de planes",
            "message": "Quiero conocer los límites y condiciones del plan.",
        },
    )

    assert response.status_code == 202, response.text
    assert response.json() == {"status": "accepted"}
    assert delivered["sender_email"] == "ana@example.com"
    assert delivered["subject"] == "Información de planes"


def test_contact_form_reports_delivery_outage(client, monkeypatch):
    monkeypatch.setattr(
        "app.services.email_service.send_contact_email",
        lambda **kwargs: False,
    )
    response = client.post(
        "/api/v1/contact/",
        json={
            "name": "Alex Example",
            "email": "alex@example.com",
            "subject": "Support request",
            "message": "This message is long enough to pass validation.",
        },
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Contact delivery is temporarily unavailable"


def test_contact_form_rejects_invalid_payload(client):
    response = client.post(
        "/api/v1/contact/",
        json={
            "name": "A",
            "email": "not-an-email",
            "subject": "Hi",
            "message": "short",
        },
    )

    assert response.status_code == 422
