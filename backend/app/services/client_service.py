from sqlalchemy.orm import Session
from app.models.client import Client
from app.schemas.client import ClientCreate, ClientUpdate
from app.repositories import client as client_repo
from fastapi import HTTPException, status


def get_clients(
    db: Session,
    company_id: int | None,
    skip: int = 0,
    limit: int = 100,
    is_active: bool | None = True,
) -> list[Client]:
    return client_repo.get_all_clients(db, company_id, skip, limit, is_active)


def get_client(db: Session, company_id: int | None, client_id: int) -> Client:
    client = client_repo.get_client_by_id(db, client_id, company_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    return client


def create_client(db: Session, client_data: ClientCreate) -> Client:
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
    db_client = client_repo.get_client_by_id(db, client_id, company_id)
    if not db_client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Client not found"
        )
    return client_repo.delete_client(db, db_client)
