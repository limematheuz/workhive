import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.models.client import Client
from app.models.company import Company
from app.models.invoice import Invoice
from app.schemas.company import CompanyUpdate
from app.services.invoice_fiscal import party_snapshots


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("caixesbb", "CAIXESBB"),
        (" caixes bb xxx ", "CAIXESBBXXX"),
        ("DEUTDEFF500", "DEUTDEFF500"),
        ("   ", None),
        (None, None),
    ],
)
def test_company_swift_bic_normalizes_valid_values(value, expected):
    assert CompanyUpdate(swift_bic=value).swift_bic == expected


@pytest.mark.parametrize(
    "value",
    ["12345678", "CAIXE5BB", "CAIXESB", "CAIXESBBXX!", "CAIXESBBXXXX"],
)
def test_company_swift_bic_rejects_invalid_values(value):
    with pytest.raises(ValidationError):
        CompanyUpdate(swift_bic=value)


def test_invoice_snapshot_rejects_invalid_custom_swift_bic():
    company = Company(
        name="Issuer SL",
        tax_id="A12345678",
        address="Calle Uno 1",
        phone="600000000",
        email="issuer@example.com",
    )
    client = Client(
        name="Client SL",
        legal_number="B12345678",
        address="Calle Dos 2",
        company_id=1,
    )
    invoice = Invoice(custom_issuer_info="Issuer SL\nSWIFT/BIC: 12345678")

    with pytest.raises(HTTPException) as error:
        party_snapshots(company, client, invoice)

    assert error.value.status_code == 422
