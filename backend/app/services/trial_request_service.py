import hashlib
import secrets
import smtplib
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_password_reset_token, get_password_hash
from app.models.company import Company
from app.models.trial_request import TrialRequest
from app.models.user import User
from app.repositories import company as company_repo
from app.repositories import role as role_repo
from app.repositories import user as user_repo
from app.schemas.trial_request import (
    TrialRequestApprove,
    TrialRequestCreate,
    TrialRequestReject,
)
from app.services import email_service
from app.services.user_scope import require_superadmin


TERMINAL_REQUEST_STATUSES = {"approved", "rejected", "expired"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _generate_partner_code(db: Session, company_name: str) -> str:
    clean_name = "".join(char for char in company_name if char.isalnum()).upper()[:4] or "COMP"
    code = f"WH-{clean_name}-{uuid.uuid4().hex[:6].upper()}"
    while db.query(Company).filter(Company.partner_code == code).first():
        code = f"WH-{clean_name}-{uuid.uuid4().hex[:6].upper()}"
    return code


def list_trial_requests(db: Session) -> list[TrialRequest]:
    return (
        db.query(TrialRequest)
        .order_by(TrialRequest.created_at.desc(), TrialRequest.id.desc())
        .all()
    )


def create_trial_request(
    db: Session,
    payload: TrialRequestCreate,
) -> TrialRequest:
    if payload.website:
        return TrialRequest(
            full_name=payload.full_name,
            email=payload.email,
            company_name=payload.company_name,
            phone=payload.phone,
            message=payload.message,
            requested_trial_days=payload.requested_trial_days,
            status="accepted",
            verification_token_hash=_hash_token(secrets.token_urlsafe(32)),
            verification_token_expires_at=_utcnow() + timedelta(minutes=1),
        )

    if user_repo.get_user_by_email(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email already has a WorkHive account",
        )

    token = secrets.token_urlsafe(32)
    token_hash = _hash_token(token)
    expires_at = _utcnow() + timedelta(hours=24)
    verification_url = (
        f"{settings.FRONTEND_URL.rstrip('/')}/contact?trial_verification={token}"
    )

    request = TrialRequest(
        full_name=payload.full_name,
        email=payload.email,
        company_name=payload.company_name,
        phone=payload.phone,
        message=payload.message,
        requested_trial_days=payload.requested_trial_days,
        status="pending_email_verification",
        verification_token_hash=token_hash,
        verification_token_expires_at=expires_at,
    )
    db.add(request)
    db.flush()

    try:
        sent = email_service.send_trial_verification_email(
            recipient_email=payload.email,
            recipient_name=payload.full_name,
            company_name=payload.company_name,
            verification_url=verification_url,
        )
    except (OSError, TimeoutError, ConnectionError, smtplib.SMTPException):
        sent = False

    if not sent:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Trial request email delivery is temporarily unavailable",
        )

    db.commit()
    db.refresh(request)
    return request


def verify_trial_request_email(db: Session, token: str) -> TrialRequest:
    request = (
        db.query(TrialRequest)
        .filter(TrialRequest.verification_token_hash == _hash_token(token))
        .first()
    )
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trial verification link is invalid",
        )

    if request.status in TERMINAL_REQUEST_STATUSES:
        return request

    expires_at = request.verification_token_expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= _utcnow():
        request.status = "expired"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Trial verification link has expired",
        )

    request.status = "email_verified"
    request.email_verified_at = request.email_verified_at or _utcnow()
    db.commit()
    db.refresh(request)
    return request


def approve_trial_request(
    db: Session,
    request_id: int,
    approval: TrialRequestApprove,
    approver: User,
) -> TrialRequest:
    require_superadmin(approver)

    request = db.get(TrialRequest, request_id)
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trial request not found")
    if request.status != "email_verified":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only verified trial requests can be approved",
        )
    if company_repo.get_company_by_tax_id(db, approval.tax_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tax ID already exists")
    if user_repo.get_user_by_email(db, request.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Owner email already registered",
        )

    admin_role = role_repo.get_role_by_name(db, "admin")
    if not admin_role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Role 'admin' not configured in database",
        )

    now = _utcnow()
    is_trial = approval.access_mode == "trial"
    trial_days = approval.trial_days if is_trial else None
    company = Company(
        name=request.company_name,
        tax_id=approval.tax_id,
        address=approval.address,
        phone=approval.phone,
        email=approval.company_email or request.email,
        partner_code=_generate_partner_code(db, request.company_name),
        is_active=True,
        onboarding_completed=False,
        subscription_plan="trial" if is_trial else approval.access_mode,
        subscription_status="trialing" if is_trial else "active",
        trial_started_at=now if is_trial else None,
        trial_ends_at=now + timedelta(days=trial_days) if is_trial and trial_days else None,
    )
    db.add(company)
    db.flush()

    owner = User(
        email=request.email,
        hashed_password=get_password_hash(secrets.token_urlsafe(32)),
        full_name=approval.owner_full_name or request.full_name,
        is_active=True,
        email_verified_at=request.email_verified_at or now,
        role_id=admin_role.id,
        company_id=company.id,
    )
    db.add(owner)
    db.flush()

    reset_token = create_password_reset_token(owner.email)
    reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={reset_token}"
    try:
        sent = email_service.send_trial_approved_email(
            recipient_email=owner.email,
            recipient_name=owner.full_name or request.full_name,
            company_name=company.name,
            setup_url=reset_url,
            access_mode=approval.access_mode,
            trial_ends_at=company.trial_ends_at,
        )
    except (OSError, TimeoutError, ConnectionError, smtplib.SMTPException):
        sent = False
    if not sent:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Approval email delivery is temporarily unavailable",
        )

    request.status = "approved"
    request.approved_at = now
    request.approved_by_user_id = approver.id
    request.approved_trial_days = trial_days
    request.approval_mode = approval.access_mode
    request.decision_note = approval.note
    request.created_company_id = company.id
    request.created_user_id = owner.id
    db.commit()
    db.refresh(request)
    return request


def reject_trial_request(
    db: Session,
    request_id: int,
    rejection: TrialRequestReject,
    rejector: User,
) -> TrialRequest:
    require_superadmin(rejector)

    request = db.get(TrialRequest, request_id)
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trial request not found")
    if request.status == "approved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Approved trial requests cannot be rejected",
        )
    request.status = "rejected"
    request.rejected_at = _utcnow()
    request.approved_by_user_id = rejector.id
    request.decision_note = rejection.note
    db.commit()
    db.refresh(request)
    return request
