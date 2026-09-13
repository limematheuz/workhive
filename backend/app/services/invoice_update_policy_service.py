"""State-transition rules for existing invoices.

This module intentionally has no persistence or side effects.  The invoice
service owns transactions, repository calls and task-link updates; keeping the
rules here makes the allowed invoice lifecycle explicit and independently
testable.
"""

from fastapi import HTTPException, status

from app.models.invoice import Invoice
from app.schemas.invoice_item import InvoiceItemCreate


def task_ids_from_invoice_items(items: list[InvoiceItemCreate]) -> list[int]:
    """Return linked task ids, rejecting duplicate billing of one task."""
    task_ids = [item.task_item_id for item in items if item.task_item_id is not None]
    if len(task_ids) != len(set(task_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A task item cannot appear more than once in the same invoice",
        )
    return task_ids


def validate_draft_status_update(requested_status: str | None) -> None:
    """Drafts may stay drafts or be cancelled; issuance has its own command."""
    if requested_status not in {None, "draft", "cancelled"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A draft can only be issued or cancelled",
        )


def apply_issued_status_transition(
    invoice: Invoice,
    changes: dict,
    replacement_items: list[InvoiceItemCreate] | None,
    requested_status: str | None,
) -> None:
    """Apply the only manual lifecycle change for a definitive invoice.

    Collection is deliberately absent here.  It is derived exclusively from
    immutable customer-payment allocations, so a direct invoice update cannot
    create an unaudited paid balance.
    """
    detail_changes = {key for key in changes if key != "status"}
    if replacement_items is not None:
        detail_changes.add("items")
    if detail_changes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Issued invoice details are immutable",
        )

    allowed = {
        "issued": {"overdue"},
        "overdue": set(),
        "partially_paid": set(),
        "paid": set(),
        "rectified": set(),
        "cancelled": set(),
    }
    if requested_status in {"paid", "partially_paid"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Register a customer payment instead of changing the collection status",
        )
    if requested_status not in allowed.get(invoice.status, set()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid invoice status transition",
        )
