from datetime import datetime, timezone
from io import BytesIO

from PIL import Image

from app.models.expense import Expense
from tests.test_client_permission_authorization import (
    _assign_company_profile,
    _headers,
    _user,
)
from tests.test_location_workspace import _admin, _company


PDF = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF"


def _expense(db, company, owner):
    expense = Expense(
        company_id=company.id,
        created_by_user_id=owner.id,
        expense_date=datetime.now(timezone.utc),
        category="other",
        description="Compra de prueba",
        base_amount=1,
        tax_amount=0,
        total_amount=1,
    )
    db.add(expense)
    db.commit()
    return expense


def test_receipt_is_private_to_finance_and_bound_to_its_expense(client, db):
    company = _company(db, "Expense receipt owner")
    owner = _admin(db, company)
    expense = _expense(db, company, owner)
    reader = _user(db, company, "expense-receipt-reader", role_id=3)
    worker = _user(db, company, "expense-receipt-worker", role_id=3)
    _assign_company_profile(
        db,
        company=company,
        admin=owner,
        user=reader,
        name="Lector financiero de justificantes",
        permission_codes={"finance.read"},
    )
    other_company = _company(db, "Expense receipt other")
    other_owner = _admin(db, other_company)
    path = f"/api/v1/expenses/{expense.id}/receipt"

    uploaded = client.post(
        path,
        headers=_headers(owner),
        files={"file": ("ticket.pdf", PDF, "application/pdf")},
    )
    assert uploaded.status_code == 201, uploaded.text
    receipt_ref = uploaded.json()["receipt_url"]
    assert receipt_ref and "expense-receipts" in receipt_ref
    assert client.get(path, headers=_headers(owner)).content == PDF
    reader_download = client.get(path, headers=_headers(reader))
    assert reader_download.status_code == 200
    assert reader_download.headers["content-type"] == "application/pdf"
    assert reader_download.headers["x-content-type-options"] == "nosniff"
    assert "attachment" in reader_download.headers["content-disposition"]
    assert "no-store" in reader_download.headers["cache-control"]

    assert client.post(
        path, headers=_headers(reader), files={"file": ("x.pdf", PDF, "application/pdf")}
    ).status_code == 403
    assert client.get(path, headers=_headers(worker)).status_code == 403
    assert client.get(path, headers=_headers(other_owner)).status_code == 404
    assert client.get(path).status_code == 401
    assert client.get(
        f"/api/v1/uploads/media/{receipt_ref.removeprefix('private-expense-receipt:')}",
        headers=_headers(worker),
    ).status_code == 404
    assert client.get(
        f"/api/v1/uploads/media/{receipt_ref.removeprefix('private-expense-receipt:')}",
        headers=_headers(owner),
    ).status_code == 404
    assert client.post(
        path, headers=_headers(owner), files={"file": ("again.pdf", PDF, "application/pdf")}
    ).status_code == 409


def test_receipt_rejects_mismatched_or_invalid_file_and_reserved_reference(client, db):
    company = _company(db, "Expense receipt invalid")
    owner = _admin(db, company)
    expense = _expense(db, company, owner)
    path = f"/api/v1/expenses/{expense.id}/receipt"

    assert client.post(
        path,
        headers=_headers(owner),
        files={"file": ("fake.pdf", b"not a PDF", "application/pdf")},
    ).status_code == 422
    assert client.post(
        path,
        headers=_headers(owner),
        files={"file": ("fake.png", PDF, "image/png")},
    ).status_code == 422
    assert client.post(
        path,
        headers=_headers(owner),
        files={"file": ("huge.pdf", PDF + b"x" * (10 * 1024 * 1024), "application/pdf")},
    ).status_code == 413
    assert client.get(path, headers=_headers(owner)).status_code == 404
    assert client.patch(
        f"/api/v1/expenses/{expense.id}",
        headers=_headers(owner),
        json={"receipt_url": "private-expense-receipt:company/1/expense-receipts/x.pdf"},
    ).status_code == 422
    assert client.post(
        "/api/v1/expenses/",
        headers=_headers(owner),
        json={
            "expense_date": datetime.now(timezone.utc).isoformat(),
            "category": "other",
            "description": "No debe vincular medios privados sin subirlos",
            "base_amount": 1,
            "tax_amount": 0,
            "receipt_url": "private-expense-receipt:company/1/expense-receipts/x.pdf",
        },
    ).status_code == 422
    assert client.get(path, headers=_headers(owner)).status_code == 404

    image = BytesIO()
    Image.new("RGB", (2, 2), "white").save(image, format="PNG")
    uploaded_image = client.post(
        path,
        headers=_headers(owner),
        files={"file": ("ticket.png", image.getvalue(), "image/png")},
    )
    assert uploaded_image.status_code == 201, uploaded_image.text
    downloaded_image = client.get(path, headers=_headers(owner))
    assert downloaded_image.status_code == 200
    assert downloaded_image.content == image.getvalue()
    assert downloaded_image.headers["content-type"] == "image/png"
