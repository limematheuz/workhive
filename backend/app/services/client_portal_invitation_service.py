"""Invitation lifecycle for a customer document portal.

This is separate from worker/accountant invitations because the invited identity
never becomes a company member and may collect several customer workspaces.
"""

import secrets
import smtplib
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.client_portal_grant import ClientPortalGrant
from app.models.client_portal_invitation import ClientPortalInvitation
from app.models.user import User
from app.repositories import client as client_repo
from app.repositories import client_portal as client_portal_repo
from app.repositories import client_portal_invitation as invitation_repo
from app.repositories import role as role_repo
from app.repositories import user as user_repo
from app.schemas.client_portal import ClientPortalInvitationAccept, ClientPortalInvitationCreate
from app.services import email_service, privacy_service
from app.services.client_portal_policy import CLIENT_PORTAL_ROLE_NAME
from app.services.company_collaboration_invitation_tokens import hash_invitation_secret
from app.services.subscription_policy import require_company_access


PENDING_STATUS = "pending"
ACCEPTED_STATUS = "accepted"
REVOKED_STATUS = "revoked"
EXPIRED_STATUS = "expired"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _new_verification_code(db: Session) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        code = "".join(secrets.choice(alphabet) for _ in range(10))
        if not db.query(ClientPortalInvitation.id).filter(
            ClientPortalInvitation.verification_code_hash == hash_invitation_secret(code)
        ).first():
            return code


def _expire_if_needed(invitation: ClientPortalInvitation) -> bool:
    expires_at = invitation.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at <= utcnow()


def _require_pending(db: Session, *, token: str) -> ClientPortalInvitation:
    invitation = invitation_repo.find_by_token_hash(db, token_hash=hash_invitation_secret(token))
    if invitation is None or invitation.status != PENDING_STATUS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This client portal invitation is no longer available")
    if _expire_if_needed(invitation):
        invitation.status = EXPIRED_STATUS
        db.commit()
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="This client portal invitation has expired")
    return invitation


def _require_managed_active_client(db: Session, *, company_id: int, client_id: int):
    client = client_repo.get_client_by_id(db, client_id, company_id)
    if client is None or not client.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client


def _validate_existing_user_for_portal(user: User | None) -> User | None:
    if user is None:
        return None
    if (
        not user.is_active
        or user.company_id is not None
        or not user.role
        or user.role.name != CLIENT_PORTAL_ROLE_NAME
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email belongs to an account that cannot receive client portal access",
        )
    return user


def create_invitation(
    db: Session,
    *,
    company_id: int,
    client_id: int,
    payload: ClientPortalInvitationCreate,
    inviter: User,
) -> ClientPortalInvitation:
    if not settings.smtp_is_configured:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Invitation email delivery is not configured")
    if inviter.company_id != company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    if inviter.company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    require_company_access(inviter.company)
    client = _require_managed_active_client(db, company_id=company_id, client_id=client_id)
    email = normalize_email(str(payload.email))
    if email == normalize_email(inviter.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot invite your own account")

    existing_user = _validate_existing_user_for_portal(user_repo.get_user_by_email(db, email))
    existing_grant = existing_user and client_portal_repo.get_grant_for_client_user(
        db,
        company_id=company_id,
        client_id=client_id,
        user_id=existing_user.id,
    )
    if existing_grant and existing_grant.status == "active":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This person already has access to this client workspace")

    pending = invitation_repo.find_pending_for_client_email(
        db,
        company_id=company_id,
        client_id=client_id,
        email=email,
    )
    if pending:
        if _expire_if_needed(pending):
            pending.status = EXPIRED_STATUS
            db.flush()
        else:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This person already has a pending invitation for this client workspace")

    token = secrets.token_urlsafe(32)
    verification_code = _new_verification_code(db)
    invitation = ClientPortalInvitation(
        company_id=company_id,
        client_id=client_id,
        invited_by_user_id=inviter.id,
        email=email,
        token_hash=hash_invitation_secret(token),
        verification_code_hash=hash_invitation_secret(verification_code),
        status=PENDING_STATUS,
        expires_at=utcnow() + timedelta(hours=settings.WORKER_INVITATION_EXPIRE_HOURS),
    )
    db.add(invitation)
    invitation_url = f"{settings.FRONTEND_URL.rstrip('/')}/accept-client-portal-invitation#token={token}"
    try:
        sent = email_service.send_client_portal_invitation_email(
            recipient_email=email,
            inviter_company_name=inviter.company.name,
            client_name=client.name,
            invitation_url=invitation_url,
            verification_code=verification_code,
            expires_at=invitation.expires_at,
        )
    except (OSError, TimeoutError, ConnectionError, smtplib.SMTPException):
        sent = False
    if not sent:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Invitation email delivery is temporarily unavailable")
    db.commit()
    db.refresh(invitation)
    return invitation


def accept_invitation(
    db: Session,
    *,
    payload: ClientPortalInvitationAccept,
    request: Request,
) -> ClientPortalInvitation:
    invitation = _require_pending(db, token=payload.token)
    if invitation.verification_code_hash != hash_invitation_secret(payload.verification_code.upper()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The invitation verification code is invalid")
    client = _require_managed_active_client(
        db,
        company_id=invitation.company_id,
        client_id=invitation.client_id,
    )
    company = client.company
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    require_company_access(company)

    existing_user = _validate_existing_user_for_portal(user_repo.get_user_by_email(db, invitation.email))
    if existing_user is None:
        if payload.password is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="A password is required to create the client portal account")
        role = role_repo.get_role_by_name(db, CLIENT_PORTAL_ROLE_NAME)
        if role is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Client portal role is not configured")
        portal_user = User(
            email=invitation.email,
            hashed_password=get_password_hash(payload.password),
            full_name=payload.full_name.strip(),
            is_active=True,
            email_verified_at=utcnow(),
            role_id=role.id,
            company_id=None,
        )
        db.add(portal_user)
        db.flush()
        is_new_user = True
    else:
        portal_user = existing_user
        is_new_user = False

    grant = client_portal_repo.get_grant_for_client_user(
        db,
        company_id=invitation.company_id,
        client_id=invitation.client_id,
        user_id=portal_user.id,
    )
    if grant is None:
        grant = ClientPortalGrant(
            company_id=invitation.company_id,
            client_id=invitation.client_id,
            user_id=portal_user.id,
            status="active",
            granted_by_user_id=invitation.invited_by_user_id,
        )
        db.add(grant)
    elif grant.status != "active":
        grant.status = "active"
        grant.revoked_at = None
        grant.revoked_by_user_id = None
        grant.expires_at = None

    invitation.status = ACCEPTED_STATUS
    invitation.accepted_at = utcnow()
    invitation.accepted_user_id = portal_user.id
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This portal access was accepted by another request") from error
    db.refresh(invitation)
    if is_new_user:
        privacy_service.record_registration_acknowledgements(
            db,
            user=portal_user,
            request=request,
            policy_version=settings.PRIVACY_POLICY_VERSION,
            marketing_consent=payload.marketing_consent,
        )
    return invitation


def list_invitations(db: Session, *, company_id: int, client_id: int) -> list[ClientPortalInvitation]:
    _require_managed_active_client(db, company_id=company_id, client_id=client_id)
    return invitation_repo.list_for_client(db, company_id=company_id, client_id=client_id)


def revoke_invitation(
    db: Session,
    *,
    company_id: int,
    client_id: int,
    invitation_id: int,
) -> ClientPortalInvitation:
    invitation = invitation_repo.find_for_client(
        db,
        company_id=company_id,
        client_id=client_id,
        invitation_id=invitation_id,
    )
    if invitation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    if invitation.status != PENDING_STATUS:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only pending invitations can be revoked")
    invitation.status = REVOKED_STATUS
    db.commit()
    db.refresh(invitation)
    return invitation


def list_grants(db: Session, *, company_id: int, client_id: int) -> list[ClientPortalGrant]:
    _require_managed_active_client(db, company_id=company_id, client_id=client_id)
    return client_portal_repo.list_grants_for_client(
        db,
        company_id=company_id,
        client_id=client_id,
    )


def revoke_grant(
    db: Session,
    *,
    company_id: int,
    client_id: int,
    grant_id: int,
    revoked_by_user_id: int,
) -> ClientPortalGrant:
    grant = client_portal_repo.get_grant_for_client(
        db,
        company_id=company_id,
        client_id=client_id,
        grant_id=grant_id,
    )
    if grant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portal access not found")
    if grant.status != "active":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This portal access is already revoked")
    grant.status = "revoked"
    grant.revoked_at = utcnow()
    grant.revoked_by_user_id = revoked_by_user_id
    db.commit()
    db.refresh(grant)
    return grant
