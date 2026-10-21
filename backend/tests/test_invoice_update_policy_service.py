from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.schemas.invoice_item import InvoiceItemCreate
from app.services import invoice_update_policy_service


def test_linked_task_can_only_appear_once_in_an_invoice():
    items = [
        InvoiceItemCreate(description="Trabajo A", unit_price=10, task_item_id=8),
        InvoiceItemCreate(description="Trabajo B", unit_price=20, task_item_id=8),
    ]

    with pytest.raises(HTTPException) as error:
        invoice_update_policy_service.task_ids_from_invoice_items(items)

    assert error.value.status_code == 400
    assert "more than once" in error.value.detail


def test_draft_cannot_change_directly_to_a_payment_state():
    with pytest.raises(HTTPException) as error:
        invoice_update_policy_service.validate_draft_status_update("paid")

    assert error.value.status_code == 400
    assert "draft" in error.value.detail.lower()


def test_definitive_invoice_rejects_detail_changes():
    invoice = SimpleNamespace(status="issued", paid_at=None)

    with pytest.raises(HTTPException) as error:
        invoice_update_policy_service.apply_issued_status_transition(
            invoice,
            {"notes": "Cambio"},
            replacement_items=None,
            requested_status=None,
        )

    assert error.value.status_code == 403
    assert "immutable" in error.value.detail


def test_definitive_invoice_rejects_payment_method_changes():
    invoice = SimpleNamespace(status="issued", paid_at=None)

    with pytest.raises(HTTPException) as error:
        invoice_update_policy_service.apply_issued_status_transition(
            invoice,
            {"payment_method": "cash"},
            replacement_items=None,
            requested_status=None,
        )

    assert error.value.status_code == 403


def test_issued_invoice_cannot_be_marked_paid_without_a_customer_payment():
    invoice = SimpleNamespace(status="issued", paid_at=None)

    with pytest.raises(HTTPException) as error:
        invoice_update_policy_service.apply_issued_status_transition(
            invoice,
            {"status": "paid"},
            replacement_items=None,
            requested_status="paid",
        )

    assert error.value.status_code == 400
    assert "customer payment" in error.value.detail.lower()
    assert invoice.paid_at is None


def test_paid_invoice_cannot_transition_again():
    invoice = SimpleNamespace(status="paid", paid_at=object())

    with pytest.raises(HTTPException) as error:
        invoice_update_policy_service.apply_issued_status_transition(
            invoice,
            {"status": "overdue"},
            replacement_items=None,
            requested_status="overdue",
        )

    assert error.value.status_code == 400


def test_rectification_cannot_be_marked_overdue():
    invoice = SimpleNamespace(status="issued", is_rectification=True, paid_at=None)

    with pytest.raises(HTTPException) as error:
        invoice_update_policy_service.apply_issued_status_transition(
            invoice,
            {"status": "overdue"},
            replacement_items=None,
            requested_status="overdue",
        )

    assert error.value.status_code == 400
    assert invoice.status == "issued"


def test_normal_issued_invoice_can_be_marked_overdue():
    invoice = SimpleNamespace(status="issued", is_rectification=False, paid_at=None)

    invoice_update_policy_service.apply_issued_status_transition(
        invoice,
        {"status": "overdue"},
        replacement_items=None,
        requested_status="overdue",
    )

    assert invoice.status == "issued"
