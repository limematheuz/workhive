from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.deps import AuthenticatedAdmin, AuthenticatedUser, get_db
from app.models.user import User
from app.schemas.privacy import (
    PrivacyConsentResponse,
    PrivacyRequestCreate,
    PrivacyRequestResolve,
    PrivacyRequestResponse,
)
from app.services import audit_service, privacy_service


router = APIRouter()


@router.get("/export")
def export_personal_data(
    db: Session = Depends(get_db),
    current_user: User = AuthenticatedUser,
):
    payload = privacy_service.export_user_data(db, current_user)
    return JSONResponse(
        content=payload,
        headers={
            "Content-Disposition": (
                f'attachment; filename="workhive-user-{current_user.id}-export.json"'
            )
        },
    )


@router.get("/consents", response_model=list[PrivacyConsentResponse])
def read_consents(
    db: Session = Depends(get_db),
    current_user: User = AuthenticatedUser,
):
    return privacy_service.list_consents(db, current_user)


@router.post(
    "/requests",
    response_model=PrivacyRequestResponse,
    status_code=201,
)
def create_privacy_request(
    data: PrivacyRequestCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = AuthenticatedUser,
):
    created = privacy_service.create_request(db, current_user, data)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="privacy.request_created",
        entity_type="data_subject_request",
        entity_id=created.id,
        request=request,
        details={"request_type": created.request_type},
    )
    return created


@router.get("/requests/me", response_model=list[PrivacyRequestResponse])
def read_my_privacy_requests(
    db: Session = Depends(get_db),
    current_user: User = AuthenticatedUser,
):
    return privacy_service.list_user_requests(db, current_user)


@router.get("/requests", response_model=list[PrivacyRequestResponse])
def read_company_privacy_requests(
    db: Session = Depends(get_db),
    current_user: User = AuthenticatedAdmin,
):
    return privacy_service.list_company_requests(db, current_user)


@router.post(
    "/requests/{request_id}/resolve",
    response_model=PrivacyRequestResponse,
)
def resolve_privacy_request(
    request_id: int,
    data: PrivacyRequestResolve,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = AuthenticatedAdmin,
):
    resolved = privacy_service.resolve_request(
        db,
        request_id=request_id,
        resolver=current_user,
        data=data,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=resolved.company_id,
        action="privacy.request_resolved",
        entity_type="data_subject_request",
        entity_id=resolved.id,
        request=request,
        details={
            "request_type": resolved.request_type,
            "status": resolved.status,
        },
    )
    return resolved
