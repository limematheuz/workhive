import ssl
import tempfile
from contextlib import contextmanager
from pathlib import Path

import certifi
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.serialization import pkcs12


def load_pkcs12_credentials(path: str, password: str):
    private_key, certificate, additional_certificates = (
        pkcs12.load_key_and_certificates(
            Path(path).expanduser().read_bytes(),
            password.encode("utf-8"),
        )
    )
    if private_key is None or certificate is None:
        raise ValueError("The PKCS#12 file has no private key or certificate")
    return private_key, certificate, list(additional_certificates or [])


@contextmanager
def pkcs12_ssl_context(path: str, password: str):
    private_key, certificate, additional_certificates = load_pkcs12_credentials(
        path,
        password,
    )

    key_pem = private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    certificate_pem = certificate.public_bytes(serialization.Encoding.PEM)
    for extra in additional_certificates or []:
        certificate_pem += extra.public_bytes(serialization.Encoding.PEM)

    with tempfile.TemporaryDirectory(prefix="workhive-aeat-") as directory:
        key_path = Path(directory) / "client-key.pem"
        certificate_pem_path = Path(directory) / "client-cert.pem"
        key_path.write_bytes(key_pem)
        certificate_pem_path.write_bytes(certificate_pem)
        key_path.chmod(0o600)
        certificate_pem_path.chmod(0o600)

        context = ssl.create_default_context(cafile=certifi.where())
        context.load_cert_chain(
            certfile=str(certificate_pem_path),
            keyfile=str(key_path),
        )
        yield context
