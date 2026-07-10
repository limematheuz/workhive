from datetime import datetime, timezone
from decimal import Decimal

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID
from lxml import etree
from signxml.xades import XAdESVerifier

from app.integrations.aeat.client import parse_aeat_response
from app.integrations.aeat.hash import (
    CancellationHashInput,
    InvoiceHashInput,
    calculate_cancellation_hash,
    calculate_invoice_hash,
)
from app.integrations.aeat.xml import NS_INFO, NS_LR, validate_submission_xml
from app.integrations.facturae.xml import (
    NS_FACTURAE,
    build_facturae_xml,
    validate_facturae_xml,
)
from app.integrations.facturae.signature import sign_facturae_xml
from app.schemas.invoice import InvoiceDraftCreate, RectificationCreate
from app.schemas.invoice_item import InvoiceItemCreate
from app.services import invoice_service
from tests.test_invoice_fiscal_flow import _billing_client
from tests.test_reservations import _company


def _issued_invoice(db):
    company = _company(db, "Fiscal Issuer SL", "A12345678")
    company.postal_code = "28001"
    company.city = "Madrid"
    company.province = "Madrid"
    company.bank_account = "ES9121000418450200051332"
    db.add(company)
    client = _billing_client(db, company, legal_number="B12345678")
    client.province = "Girona"
    db.add(client)
    db.commit()
    draft = invoice_service.create_invoice_draft(
        db,
        company.id,
        InvoiceDraftCreate(
            client_id=client.id,
            issue_date=datetime(2026, 6, 15, tzinfo=timezone.utc),
            due_date=datetime(2026, 7, 15, tzinfo=timezone.utc),
            items=[
                InvoiceItemCreate(
                    description="Servicio de mantenimiento",
                    quantity=2,
                    unit_price=50,
                    tax_rate=0.21,
                )
            ],
        ),
    )
    return invoice_service.issue_invoice(db, company.id, draft.id)


def test_official_aeat_hash_examples_match_published_vectors():
    first = calculate_invoice_hash(
        InvoiceHashInput(
            issuer_tax_id="89890001K",
            invoice_number="12345678/G33",
            issue_date="01-01-2024",
            invoice_type="F1",
            tax_amount="12.35",
            total_amount="123.45",
            previous_hash=None,
            generated_at="2024-01-01T19:20:30+01:00",
        )
    )
    assert first == (
        "3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60"
    )
    second = calculate_invoice_hash(
        InvoiceHashInput(
            issuer_tax_id="89890001K",
            invoice_number="12345679/G34",
            issue_date="01-01-2024",
            invoice_type="F1",
            tax_amount="12.35",
            total_amount="123.45",
            previous_hash=first,
            generated_at="2024-01-01T19:20:35+01:00",
        )
    )
    assert second == (
        "F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97"
    )
    cancellation = calculate_cancellation_hash(
        CancellationHashInput(
            issuer_tax_id="89890001K",
            invoice_number="12345679/G34",
            issue_date="01-01-2024",
            previous_hash=second,
            generated_at="2024-01-01T19:20:40+01:00",
        )
    )
    assert cancellation == (
        "177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388F90C68"
    )


def test_issued_invoice_contains_schema_valid_aeat_xml_and_qr(db):
    invoice = _issued_invoice(db)
    record = invoice.fiscal_records[0]
    validate_submission_xml(record.request_xml)
    root = etree.fromstring(record.request_xml.encode("utf-8"))
    assert root.tag == f"{{{NS_LR}}}RegFactuSistemaFacturacion"
    assert root.xpath(
        "string(//sum1:Huella)",
        namespaces={"sum1": NS_INFO},
    ) == record.record_hash
    assert invoice.qr_url.startswith("https://prewww2.aeat.es/")
    assert "nif=A12345678" in invoice.qr_url


def test_facturae_322_is_schema_valid(db):
    invoice = _issued_invoice(db)
    xml = build_facturae_xml(invoice)
    validate_facturae_xml(xml)
    root = etree.fromstring(xml)
    assert root.tag == f"{{{NS_FACTURAE}}}Facturae"
    assert root.xpath(
        "string(//*[local-name()='SchemaVersion'])",
    ) == "3.2.2"
    assert root.xpath(
        "string(//*[local-name()='InvoiceTotal'])",
    ) == "121.00"


def test_facturae_xades_signature_is_cryptographically_valid(db, tmp_path):
    invoice = _issued_invoice(db)
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name(
        [x509.NameAttribute(NameOID.COMMON_NAME, "WorkHive Facturae Test")]
    )
    now = datetime.now(timezone.utc)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now.replace(year=now.year + 1))
        .sign(private_key, hashes.SHA256())
    )
    password = b"test-password"
    certificate_path = tmp_path / "facturae-test.p12"
    certificate_path.write_bytes(
        pkcs12.serialize_key_and_certificates(
            name=b"workhive-test",
            key=private_key,
            cert=certificate,
            cas=None,
            encryption_algorithm=serialization.BestAvailableEncryption(password),
        )
    )

    signed = sign_facturae_xml(
        build_facturae_xml(invoice),
        certificate_path=str(certificate_path),
        certificate_password=password.decode(),
    )

    validate_facturae_xml(signed)
    results = XAdESVerifier().verify(
        signed,
        x509_cert=certificate.public_bytes(serialization.Encoding.PEM),
    )
    assert len(results) == 3


def test_facturae_rectification_uses_selected_official_reason(db):
    original = _issued_invoice(db)
    rectification = invoice_service.create_rectification_invoice(
        db,
        original.company_id,
        original.id,
        RectificationCreate(
            reason="Discount agreed after issue",
            reason_code="83",
            issue_date=datetime(2026, 6, 16, tzinfo=timezone.utc),
        ),
    )

    xml = build_facturae_xml(rectification)
    root = etree.fromstring(xml)
    assert root.xpath("string(//*[local-name()='ReasonCode'])") == "83"
    assert root.xpath(
        "string(//*[local-name()='ReasonDescription'])"
    ) == "Base imponible modificada por descuentos y bonificaciones"


def test_aeat_response_parser_preserves_csv_and_errors():
    response = """
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <Respuesta>
          <CSV>CSV123</CSV>
          <EstadoEnvio>ParcialmenteCorrecto</EstadoEnvio>
          <RespuestaLinea>
            <EstadoRegistro>AceptadoConErrores</EstadoRegistro>
            <CodigoErrorRegistro>2000</CodigoErrorRegistro>
            <DescripcionErrorRegistro>Advertencia fiscal</DescripcionErrorRegistro>
          </RespuestaLinea>
        </Respuesta>
      </soap:Body>
    </soap:Envelope>
    """
    result = parse_aeat_response(response)
    assert result.status == "accepted_with_errors"
    assert result.csv == "CSV123"
    assert result.error_code == "2000"
