from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.client_contact import ClientContact
from app.repositories import client as client_repo
from app.repositories import client_contact as client_contact_repo
from app.schemas.client import (
    ClientContactCreate,
    ClientContactResponse,
    ClientContactUpdate,
)
from app.services.entitlement_service import require_company_feature


def _require_clients_feature(db: Session, company_id: int | None) -> None:
    if company_id is not None:
        require_company_feature(db, company_id=company_id, code="features.clients")


def _client_or_404(db: Session, company_id: int | None, client_id: int):
    _require_clients_feature(db, company_id)
    client = client_repo.get_client_by_id(db, client_id, company_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client


def _response(contact: ClientContact) -> ClientContactResponse:
    return ClientContactResponse.model_validate(contact)


def list_client_contacts(
    db: Session, company_id: int | None, client_id: int
) -> list[ClientContactResponse]:
    _client_or_404(db, company_id, client_id)
    return [
        _response(contact)
        for contact in client_contact_repo.list_for_client(db, client_id)
    ]


def create_client_contact(
    db: Session,
    company_id: int | None,
    client_id: int,
    payload: ClientContactCreate,
) -> ClientContactResponse:
    _client_or_404(db, company_id, client_id)
    if payload.is_primary and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="An inactive contact cannot be the primary contact",
        )
    if payload.is_primary:
        client_contact_repo.clear_primary_for_client(db, client_id)
    contact = ClientContact(
        client_id=client_id,
        full_name=payload.full_name,
        email=str(payload.email) if payload.email else None,
        phone=payload.phone,
        job_title=payload.job_title,
        is_primary=payload.is_primary,
        is_active=payload.is_active,
    )
    db.add(contact)
    db.flush()
    client_contact_repo.replace_roles(db, contact, payload.roles)
    db.commit()
    persisted = client_contact_repo.get_for_client(db, client_id, contact.id)
    if not persisted:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return _response(persisted)


def update_client_contact(
    db: Session,
    company_id: int | None,
    client_id: int,
    contact_id: int,
    payload: ClientContactUpdate,
) -> ClientContactResponse:
    _client_or_404(db, company_id, client_id)
    contact = client_contact_repo.get_for_client(db, client_id, contact_id)
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client contact not found")

    updates = payload.model_dump(exclude_unset=True)
    requested_primary = updates.get("is_primary", contact.is_primary)
    requested_active = updates.get("is_active", contact.is_active)
    if requested_primary and not requested_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="An inactive contact cannot be the primary contact",
        )
    if requested_primary:
        client_contact_repo.clear_primary_for_client(
            db, client_id, except_contact_id=contact.id
        )
    if updates.get("is_active") is False:
        updates["is_primary"] = False

    roles = updates.pop("roles", None)
    for field, value in updates.items():
        setattr(contact, field, str(value) if field == "email" and value else value)
    if roles is not None:
        client_contact_repo.replace_roles(db, contact, roles)
    db.add(contact)
    db.commit()
    persisted = client_contact_repo.get_for_client(db, client_id, contact.id)
    if not persisted:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return _response(persisted)


def deactivate_client_contact(
    db: Session,
    company_id: int | None,
    client_id: int,
    contact_id: int,
) -> ClientContactResponse:
    _client_or_404(db, company_id, client_id)
    contact = client_contact_repo.get_for_client(db, client_id, contact_id)
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client contact not found")
    contact.is_active = False
    contact.is_primary = False
    db.add(contact)
    db.commit()
    persisted = client_contact_repo.get_for_client(db, client_id, contact.id)
    if not persisted:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return _response(persisted)
