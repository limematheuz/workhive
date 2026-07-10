from datetime import datetime, timedelta, timezone

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

from app.core.config import settings
from credentials import TEST_NEW, TEST_OLD, TEST_SECRET, login_form, with_credential, with_new_credential, CREDENTIAL_FIELD



def _admin_headers(client):
    email = "fiscal-admin@workhive.example.com"
    password = TEST_SECRET
    registration = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            CREDENTIAL_FIELD: password,
            "full_name": "Fiscal Admin",
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )
    assert registration.status_code == 201, registration.text
    login = client.post(
        "/api/v1/auth/login",
        data=login_form(email, password),
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    company = client.post(
        "/api/v1/companies/",
        headers=headers,
        json={
            "name": "Fiscal Company SL",
            "tax_id": "B12345678",
            "address": "Calle Fiscal 1",
            "phone": "600000000",
            "email": email,
        },
    )
    assert company.status_code == 201, company.text
    return headers


def _pkcs12_bytes(password: str) -> bytes:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name(
        [x509.NameAttribute(NameOID.COMMON_NAME, "WorkHive Fiscal Test")]
    )
    now = datetime.now(timezone.utc)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + timedelta(days=365))
        .sign(private_key, hashes.SHA256())
    )
    return pkcs12.serialize_key_and_certificates(
        name=b"workhive-test",
        key=private_key,
        cert=certificate,
        cas=None,
        encryption_algorithm=serialization.BestAvailableEncryption(
            password.encode("utf-8")
        ),
    )


def test_company_fiscal_settings_upload_certificate_and_report_readiness(
    client,
    monkeypatch,
):
    monkeypatch.setattr(settings, "VERIFACTU_ENABLED", True)
    monkeypatch.setattr(settings, "VERIFACTU_SOFTWARE_PRODUCER_NAME", "WorkHive SL")
    monkeypatch.setattr(settings, "VERIFACTU_SOFTWARE_PRODUCER_TAX_ID", "B12345678")
    headers = _admin_headers(client)

    updated = client.patch(
        "/api/v1/fiscal-settings/",
        headers=headers,
        json={"enabled": True, "environment": "test"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["submission_available"] is False
    assert "company certificate" in updated.json()["missing_fields"]

    password = "cert-secret"
    uploaded = client.post(
        "/api/v1/fiscal-settings/certificate",
        headers=headers,
        data={CREDENTIAL_FIELD: password},
        files={"file": ("certificate.p12", _pkcs12_bytes(password))},
    )
    assert uploaded.status_code == 201, uploaded.text
    payload = uploaded.json()
    assert payload["certificate_configured"] is True
    assert payload["producer_configured"] is True
    assert payload["submission_available"] is True
    assert payload["environment"] == "test"
