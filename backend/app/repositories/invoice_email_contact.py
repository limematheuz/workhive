from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.invoice_email_contact import InvoiceEmailContact


def get_contact_by_email(
    db: Session,
    company_id: int,
    email: str,
) -> InvoiceEmailContact | None:
    return (
        db.query(InvoiceEmailContact)
        .filter(
            InvoiceEmailContact.company_id == company_id,
            InvoiceEmailContact.email == email,
        )
        .first()
    )


def get_contact_by_id(
    db: Session,
    company_id: int,
    contact_id: int,
) -> InvoiceEmailContact | None:
    return (
        db.query(InvoiceEmailContact)
        .filter(
            InvoiceEmailContact.id == contact_id,
            InvoiceEmailContact.company_id == company_id,
        )
        .first()
    )


def list_contacts(
    db: Session,
    company_id: int,
    *,
    query: str | None = None,
    limit: int = 50,
) -> list[InvoiceEmailContact]:
    contacts = db.query(InvoiceEmailContact).filter(
        InvoiceEmailContact.company_id == company_id
    )
    term = (query or "").strip()
    if term:
        pattern = f"%{term}%"
        contacts = contacts.filter(
            or_(
                InvoiceEmailContact.email.ilike(pattern),
                InvoiceEmailContact.name.ilike(pattern),
            )
        )
    return (
        contacts.order_by(
            InvoiceEmailContact.use_count.desc(),
            InvoiceEmailContact.last_used_at.desc(),
            InvoiceEmailContact.email.asc(),
        )
        .limit(max(1, min(limit, 100)))
        .all()
    )


def list_client_emails(db: Session, company_id: int) -> set[str]:
    return {
        str(email).strip().lower()
        for (email,) in db.query(Client.email)
        .filter(
            Client.company_id == company_id,
            Client.email.isnot(None),
        )
        .all()
        if email
    }


def create_contact(
    db: Session,
    *,
    company_id: int,
    email: str,
    name: str | None = None,
    use_count: int = 0,
) -> InvoiceEmailContact:
    contact = InvoiceEmailContact(
        company_id=company_id,
        email=email,
        name=name,
        use_count=use_count,
    )
    db.add(contact)
    return contact
