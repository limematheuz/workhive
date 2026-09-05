"""Lifecycle for a host-paid property-manager portal invitation.

This intentionally does not reuse company-to-company invitations.  The invitee
does not purchase WorkHive, never receives a host membership, and enters only
through the property-manager portal grant created with the collaboration.
"""

import secrets
import smtplib
from datetime import timedelta

from fastapi import HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.company import Company
from app.models.company_collaboration import CompanyCollaboration
from app.models.partner_portal_grant import PartnerPortalGrant
from app.models.sponsored_partner_invitation import SponsoredPartnerInvitation
from app.models.user import User
from app.repositories import company as company_repo
from app.repositories import role as role_repo
from app.repositories import sponsored_partner_invitation as invitation_repo
from app.repositories import user as user_repo
from app.schemas.sponsored_partner_invitation import (
    SponsoredPartnerInvitationAccept,
    SponsoredPartnerInvitationCreate,
)
from app.services import email_service, privacy_service
from app.services.company_collaboration_invitation_tokens import (
    hash_invitation_secret,
    new_verification_code,
)
from app.services.entitlement_service import require_partner_portal_capacity
from app.services.partner_portal_policy import PARTNER_PORTAL_ROLE_NAME
from app.services.sponsored_partner_invitation_policy import (
    ACCEPTED_STATUS,
    EXPIRED_STATUS,
    PENDING_STATUS,
    REVOKED_STATUS,
    is_expired,
    normalize_email,
    require_host_portal_entitlement,
    require_pending_invitation,
    utcnow,
)


def create_invitation(
    db: Session,
    *,
    payload: SponsoredPartnerInvitationCreate,
    inviter: User,
) -> SponsoredPartnerInvitation:
    """Send an invitation without reserving a portal seat prematurely."""

    if not settings.smtp_is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Invitation email delivery is not configured",
        )
    if inviter.company_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    host_company = company_repo.get_company_by_id(db, inviter.company_id)
    if host_company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    require_host_portal_entitlement(db, host_company)

    email = normalize_email(str(payload.email))
    if email == normalize_email(inviter.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot invite your own account",
        )
    if user_repo.get_user_by_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This email already has a WorkHive account. Use the standard "
                "company collaboration for an existing paid company."
            ),
        )

    pending = invitation_repo.find_pending_by_host_email(
        db,
        host_company_id=host_company.id,
        email=email,
    )
    if pending:
        if is_expired(pending):
            pending.status = EXPIRED_STATUS
            db.flush()
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "This property manager already has a pending sponsored "
                    "portal invitation. Revoke it before sending another one."
                ),
            )

    other_pending = invitation_repo.find_pending_by_email(db, email=email)
    if other_pending and other_pending.id != (pending.id if pending else None):
        if is_expired(other_pending):
            other_pending.status = EXPIRED_STATUS
            db.flush()
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "This email already has a pending sponsored portal invitation "
                    "from another company."
                ),
            )

    token = secrets.token_urlsafe(32)
    verification_code = new_verification_code(db)
    expires_at = utcnow() + timedelta(hours=settings.WORKER_INVITATION_EXPIRE_HOURS)
    invitation = SponsoredPartnerInvitation(
        host_company_id=host_company.id,
        invited_by_user_id=inviter.id,
        email=email,
        company_name=payload.company_name.strip(),
        token_hash=hash_invitation_secret(token),
        verification_code_hash=hash_invitation_secret(verification_code),
        status=PENDING_STATUS,
        expires_at=expires_at,
    )
    db.add(invitation)
    invitation_url = (
        f"{settings.FRONTEND_URL.rstrip('/')}/accept-sponsored-partner-invitation#token={token}"
    )
    try:
        sent = email_service.send_sponsored_partner_invitation_email(
            recipient_email=email,
            inviter_company_name=host_company.name,
            company_name=invitation.company_name,
            invitation_url=invitation_url,
            verification_code=verification_code,
            expires_at=expires_at,
        )
    except (OSError, TimeoutError, ConnectionError, smtplib.SMTPException):
        sent = False
    if not sent:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Invitation email delivery is temporarily unavailable",
        )
    db.commit()
    db.refresh(invitation)
    return invitation


def accept_invitation(
    db: Session,
    *,
    payload: SponsoredPartnerInvitationAccept,
    request: Request,
) -> SponsoredPartnerInvitation:
    """Atomically create the limited partner company, collaboration and grant."""

    invitation = require_pending_invitation(db, token=payload.token)
    if invitation.verification_code_hash != hash_invitation_secret(payload.verification_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The invitation verification code is invalid",
        )
    if user_repo.get_user_by_email(db, invitation.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email already has a WorkHive account",
        )
    if company_repo.get_company_by_tax_id(db, payload.tax_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A company with this tax ID already exists",
        )

    host_company = company_repo.get_company_by_id(db, invitation.host_company_id)
    if host_company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The sponsoring company no longer exists",
        )
    require_host_portal_entitlement(db, host_company)
    # This locks the host entitlement row on PostgreSQL before the grant is
    # written, so concurrent acceptances cannot overrun the paid portal quota.
    require_partner_portal_capacity(db, company_id=host_company.id)

    partner_portal_role = role_repo.get_role_by_name(db, PARTNER_PORTAL_ROLE_NAME)
    if partner_portal_role is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Partner portal role is not configured",
        )

    partner_company = Company(
        name=payload.company_name.strip(),
        tax_id=payload.tax_id.strip(),
        address=payload.address.strip(),
        postal_code=payload.postal_code,
        city=payload.city,
        province=payload.province,
        phone=payload.phone.strip(),
        email=invitation.email,
        is_active=True,
        onboarding_completed=True,
        operating_model="property_manager",
        subscription_plan="none",
        subscription_status="inactive",
    )
    partner_user = User(
        email=invitation.email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name.strip(),
        is_active=True,
        email_verified_at=utcnow(),
        role_id=partner_portal_role.id,
    )
    db.add_all([partner_company, partner_user])
    db.flush()
    partner_user.company_id = partner_company.id

    collaboration = CompanyCollaboration(
        initiator_company_id=host_company.id,
        partner_company_id=partner_company.id,
        status="accepted",
        role_type="property_manager",
    )
    db.add(collaboration)
    db.flush()
    grant = PartnerPortalGrant(
        host_company_id=host_company.id,
        partner_company_id=partner_company.id,
        collaboration_id=collaboration.id,
        user_id=partner_user.id,
        status="active",
        granted_by_user_id=invitation.invited_by_user_id,
    )
    invitation.status = ACCEPTED_STATUS
    invitation.accepted_at = utcnow()
    invitation.accepted_company_id = partner_company.id
    invitation.accepted_user_id = partner_user.id
    db.add_all([partner_user, grant, invitation])
    try:
        db.commit()
    except IntegrityError as error:
        # A concurrent acceptance may have claimed the email or tax ID after
        # the preflight checks.  Do not leak a database constraint or leave a
        # partially accepted invitation behind.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This company or account was created by another acceptance",
        ) from error
    db.refresh(invitation)

    privacy_service.record_registration_acknowledgements(
        db,
        user=partner_user,
        request=request,
        policy_version=settings.PRIVACY_POLICY_VERSION,
        marketing_consent=payload.marketing_consent,
    )
    return invitation


def list_sent_invitations(
    db: Session,
    *,
    inviter: User,
) -> list[SponsoredPartnerInvitation]:
    if inviter.company_id is None:
        return []
    host_company = company_repo.get_company_by_id(db, inviter.company_id)
    if host_company is None:
        return []
    require_host_portal_entitlement(db, host_company)
    return invitation_repo.list_sent(db, host_company_id=host_company.id)


def revoke_invitation(
    db: Session,
    *,
    invitation_id: int,
    inviter: User,
) -> SponsoredPartnerInvitation:
    if inviter.company_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    invitation = invitation_repo.find_sent_by_id(
        db,
        host_company_id=inviter.company_id,
        invitation_id=invitation_id,
    )
    if invitation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    if invitation.status != PENDING_STATUS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending invitations can be revoked",
        )
    invitation.status = REVOKED_STATUS
    db.commit()
    db.refresh(invitation)
    return invitation
