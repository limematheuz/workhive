"""Company-admin management for revocable public API credentials."""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveAdmin, get_db
from app.models.user import User
from app.schemas.api_access_key import (
    ApiAccessKeyCreate,
    ApiAccessKeyCreated,
    ApiAccessKeyResponse,
)
from app.services import api_access_key_service, audit_service


router = APIRouter()


@router.get("/", response_model=list[ApiAccessKeyResponse])
def read_api_access_keys(
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return api_access_key_service.list_keys(db, current_user=current_user)


@router.post(
    "/",
    response_model=ApiAccessKeyCreated,
    status_code=status.HTTP_201_CREATED,
)
def create_api_access_key(
    payload: ApiAccessKeyCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    created = api_access_key_service.create_key(
        db,
        current_user=current_user,
        payload=payload,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="api_access_key.created",
        entity_type="api_access_key",
        entity_id=created.key.id,
        request=request,
        details={"api_key_prefix": created.key.key_prefix, "scopes": created.key.scopes},
    )
    return {**ApiAccessKeyResponse.model_validate(created.key).model_dump(), "api_key": created.secret}


@router.post("/{key_id}/revoke", response_model=ApiAccessKeyResponse)
def revoke_api_access_key(
    key_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    key = api_access_key_service.revoke_key(
        db,
        current_user=current_user,
        key_id=key_id,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="api_access_key.revoked",
        entity_type="api_access_key",
        entity_id=key.id,
        request=request,
        details={"api_key_prefix": key.key_prefix},
    )
    return key
