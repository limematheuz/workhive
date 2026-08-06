from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.invoice_email_contact import InvoiceEmailContact
from app.repositories import client as client_repo
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


def delete_contact(db: Session, company_id: int, contact_id: int) -> None:
    contact = contact_repo.get_contact_by_id(db, company_id, contact_id)
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved email contact not found",
        )
    db.delete(contact)
    db.commit()


def save_email_to_client(
    db: Session,
    company_id: int,
    client_id: int,
    recipient_emails: list[str],
) -> None:
    if len(recipient_emails) != 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Select exactly one recipient before saving it to a client",
        )
    client = client_repo.get_client_by_id(db, client_id, company_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )

    email = _normalize_email(recipient_emails[0])
    client.email = email
    saved_contact = contact_repo.get_contact_by_email(db, company_id, email)
    if saved_contact:
        db.delete(saved_contact)
    db.add(client)
    db.commit()


def remember_document_recipients(
    db: Session,
    company_id: int,
    emails: list[str],
) -> None:
    normalized_emails = [
        _normalize_email(email) for email in emails if email.strip()
    ]
    if not normalized_emails:
        return

    existing_client_emails = contact_repo.list_client_emails(db, company_id)
    for email in dict.fromkeys(normalized_emails):
        if email in existing_client_emails:
            continue
        contact = contact_repo.get_contact_by_email(db, company_id, email)
        if contact:
            contact.use_count += 1
        else:
            contact = contact_repo.create_contact(
                db,
                company_id=company_id,
                email=email,
                use_count=1,
            )
        contact.last_used_at = db.query(func.now()).scalar()
        db.add(contact)
    db.commit()
