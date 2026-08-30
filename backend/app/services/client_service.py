from sqlalchemy.orm import Session
from app.models.client import Client
from app.schemas.client import ClientCreate, ClientEmailRequest, ClientUpdate
from app.repositories import client as client_repo
from fastapi import HTTPException, status
from app.services import email_service, invoice_email_contact_service
from app.services.entitlement_service import require_company_feature


def _require_clients_feature(db: Session, company_id: int | None) -> None:
    if company_id is not None:
        require_company_feature(db, company_id=company_id, code="features.clients")


def get_clients(
    db: Session,
    company_id: int | None,
    skip: int = 0,
    limit: int = 100,
    is_active: bool | None = True,
) -> list[Client]:
    _require_clients_feature(db, company_id)
    return client_repo.get_all_clients(db, company_id, skip, limit, is_active)


def get_client(db: Session, company_id: int | None, client_id: int) -> Client:
    _require_clients_feature(db, company_id)
    client = client_repo.get_client_by_id(db, client_id, company_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    return client


def create_client(db: Session, client_data: ClientCreate) -> Client:
    _require_clients_feature(db, client_data.company_id)
    if client_data.legal_number:
        existing_client = client_repo.get_client_by_legal_number(
            db, client_data.company_id, client_data.legal_number
        )
        if existing_client:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Legal Number already exists"
            )
    return client_repo.create_client(db, client_data)


def update_client(
    db: Session, company_id: int | None, client_id: int, client_update: ClientUpdate
) -> Client:
    _require_clients_feature(db, company_id)
    db_client = client_repo.get_client_by_id(db, client_id, company_id)
    if not db_client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Client not found"
        )

    if client_update.legal_number:
        existing = client_repo.get_client_by_legal_number(
            db, company_id, legal_number=client_update.legal_number
        )
        if existing and existing.id != client_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Legal Number already exists in another client",
            )

    return client_repo.update_client(db, db_client, client_update)


def delete_client(db: Session, company_id: int | None, client_id: int) -> Client:
    _require_clients_feature(db, company_id)
    db_client = client_repo.get_client_by_id(db, client_id, company_id)
    if not db_client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Client not found"
        )
    return client_repo.delete_client(db, db_client)


def email_client(
    db: Session,
    company_id: int | None,
    client_id: int,
    data: ClientEmailRequest,
    *,
    sender_email: str | None = None,
) -> tuple[Client, str]:
    _require_clients_feature(db, company_id)
    client = get_client(db, company_id, client_id)
    recipient_emails = list(dict.fromkeys(str(email).strip() for email in data.recipient_emails if str(email).strip()))
    if data.save_recipient_to_client_id not in (None, client.id):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="The email can only be saved to this client")
    if data.save_recipient_to_client_id is not None and len(recipient_emails) != 1:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Select exactly one recipient before saving it to a client")

    try:
        sent = email_service.send_client_email(
            recipient_emails=recipient_emails,
            recipient_name=client.name,
            subject=data.subject,
            custom_message=data.message,
            reply_to_email=sender_email,
            copy_emails=[str(email) for email in data.copy_emails],
            sender_copy_email=sender_email if data.send_copy else None,
        )
    except Exception:
        sent = False
    if not sent:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Email delivery is not configured or unavailable")

    if data.save_recipient_to_client_id is not None:
        invoice_email_contact_service.save_email_to_client(db, company_id, client.id, recipient_emails)
    elif data.save_recipients:
        invoice_email_contact_service.remember_document_recipients(db, company_id, recipient_emails)
    return client, recipient_emails[0]
