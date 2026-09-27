from datetime import datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

from app.core.config import settings
from app.models.client import Client
from app.models.company import Company
from app.models.company_fiscal_settings import CompanyFiscalSettings
from app.models.invoice import Invoice
from app.services import company_fiscal_settings_service
from app.services.legacy_document_storage_migration_service import (
    migrate_legacy_documents,
)
from app.services.storage_service import get_object_storage
from credentials import TEST_SECRET


def _company(db) -> Company:
    company = Company(
        name="Legacy document company",
        tax_id="LEGACY-DOCUMENT-1",
        address="Calle Legacy 1",
        phone="600000111",
        email="legacy-documents@example.test",
    )
    db.add(company)
    db.flush()
    return company


def _invoice(db, company: Company, number: str) -> Invoice:
    client = Client(
        company_id=company.id,
        name=f"Client {number}",
        legal_number=f"CLIENT-{number}",
        address="Calle Cliente 1",
        city="Girona",
        postal_code="17001",
        country="España",
        email=f"client-{number}@example.test",
    )
    db.add(client)
    db.flush()
    invoice = Invoice(
        company_id=company.id,
        client_id=client.id,
        invoice_number=number,
        issue_date=datetime.now(timezone.utc),
        status="issued",
    )
    db.add(invoice)
    db.flush()
    return invoice


def _certificate(password: str) -> bytes:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name(
        [x509.NameAttribute(NameOID.COMMON_NAME, "WorkHive legacy migration")]
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
        name=b"workhive-legacy",
        key=private_key,
        cert=certificate,
        cas=None,
        encryption_algorithm=serialization.BestAvailableEncryption(
            password.encode("utf-8")
        ),
    )


def test_migration_copies_legacy_documents_then_removes_only_database_paths(db):
    company = _company(db)
    pdf_invoice = _invoice(db, company, "INV-LEGACY-PDF")
    facturae_invoice = _invoice(db, company, "INV-LEGACY-XML")
    pdf_source = Path(settings.INVOICE_PDF_STORAGE_PATH) / "legacy.pdf"
    facturae_source = Path(settings.ELECTRONIC_INVOICE_STORAGE_PATH) / "legacy.xml"
    certificate_source = Path(settings.FISCAL_CERTIFICATE_STORAGE_PATH) / "legacy.p12"
    pdf_source.parent.mkdir(parents=True)
    facturae_source.parent.mkdir(parents=True)
    certificate_source.parent.mkdir(parents=True)
    pdf_bytes = b"%PDF-1.7\nlegacy invoice"
    facturae_bytes = b'<?xml version="1.0"?><Facturae />'
    certificate_phrase = TEST_SECRET
    certificate_bytes = _certificate(certificate_phrase)
    pdf_source.write_bytes(pdf_bytes)
    facturae_source.write_bytes(facturae_bytes)
    certificate_source.write_bytes(certificate_bytes)
    pdf_invoice.pdf_path = str(pdf_source)
    facturae_invoice.facturae_path = str(facturae_source)
    fiscal_settings = CompanyFiscalSettings(
        company_id=company.id,
        certificate_path=str(certificate_source),
        certificate_password_encrypted=company_fiscal_settings_service._encrypt(
            certificate_phrase
        ),
    )
    db.add(fiscal_settings)
    db.commit()

    dry_run = migrate_legacy_documents(db, apply=False, company_ids={company.id})

    assert dry_run.as_dict() == {
        "examined": 3,
        "ready": 3,
        "migrated": 0,
        "skipped": 0,
        "failures": [],
    }
    assert pdf_invoice.pdf_path == str(pdf_source)
    assert facturae_invoice.facturae_path == str(facturae_source)
    assert fiscal_settings.certificate_path == str(certificate_source)

    applied = migrate_legacy_documents(db, apply=True, company_ids={company.id})

    assert applied.as_dict() == {
        "examined": 3,
        "ready": 0,
        "migrated": 3,
        "skipped": 0,
        "failures": [],
    }
    db.refresh(pdf_invoice)
    db.refresh(facturae_invoice)
    db.refresh(fiscal_settings)
    assert pdf_invoice.pdf_path is None
    assert facturae_invoice.facturae_path is None
    assert fiscal_settings.certificate_path is None
    assert pdf_invoice.pdf_size_bytes == len(pdf_bytes)
    assert facturae_invoice.facturae_size_bytes == len(facturae_bytes)
    assert fiscal_settings.certificate_size_bytes == len(certificate_bytes)
    assert pdf_invoice.pdf_sha256 == sha256(pdf_bytes).hexdigest()
    assert facturae_invoice.facturae_sha256 == sha256(facturae_bytes).hexdigest()
    assert fiscal_settings.certificate_sha256 == sha256(certificate_bytes).hexdigest()
    assert pdf_invoice.pdf_content_type == "application/pdf"
    assert facturae_invoice.facturae_content_type == "application/xml"
    assert fiscal_settings.certificate_content_type == "application/x-pkcs12"
    storage = get_object_storage()
    assert storage.get(pdf_invoice.pdf_storage_key).contents == pdf_bytes
    assert storage.get(facturae_invoice.facturae_storage_key).contents == facturae_bytes
    assert storage.get(fiscal_settings.certificate_storage_key).contents == certificate_bytes
    assert pdf_source.read_bytes() == pdf_bytes
    assert facturae_source.read_bytes() == facturae_bytes
    assert certificate_source.read_bytes() == certificate_bytes


def test_migration_leaves_a_mismatched_legacy_file_for_manual_review(db):
    company = _company(db)
    invoice = _invoice(db, company, "INV-LEGACY-HASH")
    source = Path(settings.INVOICE_PDF_STORAGE_PATH) / "mismatched.pdf"
    source.parent.mkdir(parents=True)
    source.write_bytes(b"%PDF-1.7\nchanged document")
    invoice.pdf_path = str(source)
    invoice.pdf_sha256 = "0" * 64
    db.add(invoice)
    db.commit()

    report = migrate_legacy_documents(db, apply=True, company_ids={company.id})

    assert report.examined == 1
    assert report.migrated == 0
    assert report.failures == [f"invoice:{invoice.id}:pdf: legacy source hash does not match"]
    db.refresh(invoice)
    assert invoice.pdf_path == str(source)
    assert invoice.pdf_storage_key is None
