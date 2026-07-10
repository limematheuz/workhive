from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.models.invoice_email_contact import InvoiceEmailContact
from app.repositories import invoice_email_contact as contact_repo
from app.schemas.invoice_email_contact import InvoiceEmailContactCreate


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def list_contacts(
    db: Session,
    company_id: int,
    *,
    query: str | None = None,
    limit: int = 50,
) -> list[InvoiceEmailContact]:
    return contact_repo.list_contacts(
        db,
        company_id,
        query=query,
        limit=limit,
    )


def save_contact(
    db: Session,
    company_id: int,
    data: InvoiceEmailContactCreate,
) -> InvoiceEmailContact:
    email = _normalize_email(str(data.email))
    contact = contact_repo.get_contact_by_email(db, company_id, email)
    if contact:
        if data.name and not contact.name:
            contact.name = data.name.strip()
        db.add(contact)
        db.commit()
        db.refresh(contact)
        return contact

    contact = contact_repo.create_contact(
        db,
        company_id=company_id,
        email=email,
        name=data.name.strip() if data.name else None,
    )
    db.commit()
    db.refresh(contact)
    return contact


def remember_invoice_recipients(
    db: Session,
    company_id: int,
    emails: list[str],
    invoice: Invoice,
) -> None:
    normalized_emails = [_normalize_email(email) for email in emails if email.strip()]
    if not normalized_emails:
        return

    existing_client_emails = contact_repo.list_client_emails(db, company_id)
    recipient_name = None
    if invoice.recipient_snapshot and invoice.recipient_snapshot.get("name"):
        recipient_name = str(invoice.recipient_snapshot["name"]).strip()
    elif invoice.client and invoice.client.name:
        recipient_name = invoice.client.name.strip()

    for email in dict.fromkeys(normalized_emails):
        if email in existing_client_emails:
            continue
        contact = contact_repo.get_contact_by_email(db, company_id, email)
        if contact:
            contact.use_count += 1
            if recipient_name and not contact.name:
                contact.name = recipient_name
        else:
            contact = contact_repo.create_contact(
                db,
                company_id=company_id,
                email=email,
                name=recipient_name,
                use_count=1,
            )
        contact.last_used_at = db.query(func.now()).scalar()
        db.add(contact)
    db.commit()
