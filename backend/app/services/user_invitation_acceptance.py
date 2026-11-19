"""Accept an invitation without taking over an existing WorkHive identity."""

import secrets
from dataclasses import dataclass
from datetime import timezone

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.company_membership import CompanyMembership
from app.models.external_access_grant import ExternalAccessGrant
from app.models.user import User
from app.repositories import organization as organization_repo
from app.repositories import role as role_repo
from app.repositories import user as user_repo
from app.repositories import user_invitation as invitation_repo
from app.schemas.user_invitation import UserInvitationAccept
from app.services import privacy_service
from app.services.entitlement_service import (
    require_accountant_portal_capacity, require_company_feature, require_internal_member_capacity,
)
from app.services.external_access_policy import EXTERNAL_PORTAL_ROLE_NAME
from app.services.organization_bootstrap_service import legacy_role_name_access_class
from app.services.organization_membership_lifecycle import sync_administrator_profile
from app.services.subscription_policy import require_company_access
from app.services.user_invitation_secrets import hash_secret, utcnow
from app.services.user_scope import is_superadmin


@dataclass(frozen=True)
class AcceptedInvitation:
    user: User
    company_id: int


def _verified_invitation(db: Session, payload: UserInvitationAccept):
    invitation = invitation_repo.by_token_hash(db, hash_secret(payload.token))
    if not invitation or invitation.status != "pending":
        raise HTTPException(status_code=400, detail="This invitation is invalid or has already been used")
    expiry = invitation.expires_at
    if (expiry if expiry.tzinfo else expiry.replace(tzinfo=timezone.utc)) <= utcnow():
        invitation.status = "expired"
        db.commit()
        raise HTTPException(status_code=410, detail="This invitation has expired. Ask your administrator to send a new one.")
    if not secrets.compare_digest(invitation.code_hash, hash_secret(payload.code)):
        invitation.failed_attempts += 1
        if invitation.failed_attempts >= settings.WORKER_INVITATION_MAX_ATTEMPTS:
            invitation.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="The verification code is invalid")
    return invitation


def _consenting_identity(db, invitation, payload, authenticated_identity, *, external):
    user = user_repo.get_user_by_email(db, invitation.email)
    if user is not None:
        if authenticated_identity is None:
            raise HTTPException(status_code=401, detail="Inicia sesión con la cuenta invitada para aceptar el acceso a esta empresa.")
        if authenticated_identity.id != user.id:
            raise HTTPException(status_code=403, detail="La invitación pertenece a otra cuenta. Inicia sesión con el correo invitado.")
        internal = legacy_role_name_access_class(user.role.name if user.role else None) is not None
        compatible = bool(user.role and user.role.name == EXTERNAL_PORTAL_ROLE_NAME) if external else internal
        if (not user.is_active or is_superadmin(user) or not compatible
                or invitation.rejoin_user_id not in (None, user.id)):
            raise HTTPException(status_code=409, detail="This account cannot join the invited company")
        return user, False
    if invitation.rejoin_user_id is not None:
        raise HTTPException(status_code=409, detail="The invited identity is no longer available")
    if payload.password is None:
        raise HTTPException(status_code=422, detail="Crea una contraseña para activar tu nueva cuenta.")
    user = User(
        email=invitation.email, hashed_password=get_password_hash(payload.password),
        full_name=invitation.full_name, is_active=True, email_verified_at=utcnow(),
        role_id=invitation.role_id, company_id=invitation.company_id,
    )
    db.add(user)
    db.flush()
    return user, True


def _join_internal(db, invitation, user, access_class):
    membership = organization_repo.get_user_membership(
        db, company_id=invitation.company_id, user_id=user.id
    )
    if membership and membership.status == "active":
        raise HTTPException(status_code=409, detail="This person already has access to this company")
    require_internal_member_capacity(
        db, company_id=invitation.company_id, access_class=access_class,
        exclude_membership_id=membership.id if membership else None,
    )
    if membership is None:
        membership = CompanyMembership(
            user_id=user.id, company_id=invitation.company_id,
            access_class=access_class, status="active", permissions_configured=False,
        )
        db.add(membership)
    else:
        membership.access_class = access_class
        membership.status = "active"
        membership.ended_at = None
        # An archived relationship never regains an initial implicit policy.
        membership.permissions_configured = True
    db.flush()
    sync_administrator_profile(db, membership, actor_id=invitation.invited_by_user_id)


def _join_accountant(db, invitation, user):
    require_company_feature(db, company_id=invitation.company_id, code="features.accountant_portal")
    grant = invitation_repo.accountant_grant(db, company_id=invitation.company_id, user_id=user.id)
    if grant and grant.status == "active":
        raise HTTPException(status_code=409, detail="This person already has access to this company")
    require_accountant_portal_capacity(db, company_id=invitation.company_id)
    if grant is None:
        grant = ExternalAccessGrant(
            company_id=invitation.company_id, user_id=user.id, access_type="accountant"
        )
        db.add(grant)
    grant.status = "active"
    grant.expires_at = None
    grant.revoked_at = None
    grant.revoked_by_user_id = None
    grant.granted_by_user_id = invitation.invited_by_user_id


def accept_invitation(
    db: Session, payload: UserInvitationAccept, request: Request,
    authenticated_identity: User | None = None,
) -> AcceptedInvitation:
    invitation = _verified_invitation(db, payload)
    if invitation.company is None:
        raise HTTPException(status_code=409, detail="The invited company is no longer available")
    require_company_access(invitation.company)
    role = role_repo.get_role(db, invitation.role_id)
    external = bool(role and role.name == EXTERNAL_PORTAL_ROLE_NAME)
    access_class = legacy_role_name_access_class(role.name if role else None)
    if access_class is None and not external:
        raise HTTPException(status_code=409, detail="The invitation role cannot be assigned to an internal seat")
    try:
        user, created = _consenting_identity(db, invitation, payload, authenticated_identity, external=external)
        if external:
            _join_accountant(db, invitation, user)
        else:
            _join_internal(db, invitation, user, access_class)
        invitation.status = "accepted"
        invitation.accepted_at = utcnow()
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(user)
    if created:
        privacy_service.record_registration_acknowledgements(
            db, user=user, request=request, policy_version=settings.PRIVACY_POLICY_VERSION,
            marketing_consent=payload.marketing_consent,
        )
    return AcceptedInvitation(user=user, company_id=invitation.company_id)
