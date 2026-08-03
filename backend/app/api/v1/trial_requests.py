from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveUser, get_db
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit
from app.models.user import User
from app.schemas.trial_request import (
    TrialRequestAccepted,
    TrialRequestApprove,
    TrialRequestCreate,
    TrialRequestReject,
    TrialRequestResponse,
    TrialRequestVerify,
    TrialRequestVerifyResponse,
)
from app.services import audit_service, trial_request_service


router = APIRouter()


@router.post(
    "/",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=TrialRequestAccepted,
)
def submit_trial_request(
    payload: TrialRequestCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> TrialRequestAccepted:
    enforce_rate_limit(
        request,
        "trial-request",
        settings.CONTACT_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=payload.email,
    )
    trial_request_service.create_trial_request(db, payload)
    return TrialRequestAccepted(status="accepted")


@router.post(
    "/verify",
    response_model=TrialRequestVerifyResponse,
)
def verify_trial_request(
    payload: TrialRequestVerify,
    request: Request,
    db: Session = Depends(get_db),
) -> TrialRequestVerifyResponse:
    enforce_rate_limit(
        request,
        "trial-verification",
        settings.TRIAL_VERIFICATION_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=payload.token,
    )
    trial_request = trial_request_service.verify_trial_request_email(db, payload.token)
    return TrialRequestVerifyResponse(status=trial_request.status)


@router.get("/", response_model=list[TrialRequestResponse])
def list_trial_requests(
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
) -> list:
    return trial_request_service.list_trial_requests(db, current_user)


@router.post("/{request_id}/approve", response_model=TrialRequestResponse)
def approve_trial_request(
    request_id: int,
    payload: TrialRequestApprove,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    trial_request = trial_request_service.approve_trial_request(
        db,
        request_id,
        payload,
        current_user,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=trial_request.created_company_id,
        action="trial_request.approved",
        entity_type="trial_request",
        entity_id=trial_request.id,
        request=request,
        details={"approval_mode": trial_request.approval_mode},
    )
    return trial_request


@router.post("/{request_id}/reject", response_model=TrialRequestResponse)
def reject_trial_request(
    request_id: int,
    payload: TrialRequestReject,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    trial_request = trial_request_service.reject_trial_request(
        db,
        request_id,
        payload,
        current_user,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=None,
        action="trial_request.rejected",
        entity_type="trial_request",
        entity_id=trial_request.id,
        request=request,
        details={"note": payload.note},
    )
    return trial_request
