from fastapi import Depends, APIRouter, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, ActiveUser, ActiveAdmin
from app.services import client_service
from app.services.user_scope import is_platform_superadmin, scoped_company_id
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=list[ClientResponse])
def read_clients(
    is_active: bool | None = True,
    include_inactive: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    company_id = scoped_company_id(current_user)
    return client_service.get_clients(
        db, company_id, skip, limit, None if include_inactive else is_active
    )


@router.get("/{client_id}", response_model=ClientResponse)
def read_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    company_id = scoped_company_id(current_user)
    return client_service.get_client(db, company_id, client_id)


@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    client_data: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    if not is_platform_superadmin(current_user):
        client_data.company_id = current_user.company_id
    return client_service.create_client(db, client_data)


@router.patch("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: int,
    client_update: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    company_id = scoped_company_id(current_user)
    return client_service.update_client(
        db, company_id, client_id, client_update
    )


@router.delete("/{client_id}", response_model=ClientResponse)
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    company_id = scoped_company_id(current_user)
    return client_service.delete_client(db, company_id, client_id)
