import base64
import json
import stat
from pathlib import Path

import pytest

from app.core.config import settings
from app.services import facturae_signing_credentials_service as credentials_service
from credentials import TEST_SECRET


class _SecretClient:
    def __init__(self, payload: object):
        self.payload = payload
        self.secret_ids: list[str] = []

    def get_secret_value(self, *, SecretId: str) -> dict[str, object]:
        self.secret_ids.append(SecretId)
        return {"SecretString": self.payload}


def test_facturae_signing_reads_a_json_secret_into_a_short_lived_private_file(
    monkeypatch,
):
    certificate = b"test-pkcs12-bytes"
    secret_id = "workhive/test/facturae-signer"
    client = _SecretClient(
        json.dumps(
            {
                "pkcs12_base64": base64.b64encode(certificate).decode("ascii"),
                "password": TEST_SECRET,
            }
        )
    )
    monkeypatch.setattr(settings, "FACTURAE_CERTIFICATE_SECRET_ID", secret_id)
    monkeypatch.setattr(settings, "FACTURAE_CERTIFICATE_PATH", None)
    monkeypatch.setattr(settings, "FACTURAE_CERTIFICATE_PASSWORD", None)
    monkeypatch.setattr(
        credentials_service,
        "_secrets_manager_client",
        lambda: client,
    )

    assert credentials_service.signing_certificate_is_configured() is True
    with credentials_service.facturae_signing_credentials() as (path, password):
        temporary = Path(path)
        assert password == TEST_SECRET
        assert temporary.read_bytes() == certificate
        assert stat.S_IMODE(temporary.stat().st_mode) == 0o600

    assert not temporary.exists()
    assert client.secret_ids == [secret_id]


def test_facturae_signing_rejects_an_invalid_secret_without_exposing_it(monkeypatch):
    client = _SecretClient(json.dumps({"pkcs12_base64": "not base64", "password": ""}))
    monkeypatch.setattr(
        settings,
        "FACTURAE_CERTIFICATE_SECRET_ID",
        "workhive/test/invalid",
    )
    monkeypatch.setattr(
        credentials_service,
        "_secrets_manager_client",
        lambda: client,
    )

    with pytest.raises(credentials_service.FacturaeSigningCredentialsError) as error:
        with credentials_service.facturae_signing_credentials():
            pass

    assert str(error.value) == "Facturae signing secret has an invalid format"


def test_facturae_signing_keeps_the_existing_filesystem_source_as_fallback(
    tmp_path, monkeypatch
):
    certificate = tmp_path / "facturae.p12"
    certificate.write_bytes(b"existing-test-certificate")
    monkeypatch.setattr(settings, "FACTURAE_CERTIFICATE_SECRET_ID", None)
    monkeypatch.setattr(settings, "FACTURAE_CERTIFICATE_PATH", str(certificate))
    monkeypatch.setattr(settings, "FACTURAE_CERTIFICATE_PASSWORD", TEST_SECRET)

    assert credentials_service.signing_certificate_is_configured() is True
    with credentials_service.facturae_signing_credentials() as (path, password):
        assert path == str(certificate)
        assert password == TEST_SECRET
