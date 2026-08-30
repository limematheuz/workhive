"""Activate company-collaboration invitations without enabling public signup."""

from datetime import timedelta

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.company import Company
from app.models.company_collaboration_invitation import CompanyCollaborationInvitation
from app.models.user import User
from app.repositories import company as company_repo
from app.repositories import role as role_repo
from app.repositories import user as user_repo
from app.schemas.collaboration import (
    CompanyCollaborationInvitationActivate,
    CompanyCollaborationInvitationActivateExistingAccount,
    CompanyCollaborationInvitationActivationStatus,
)
from app.services import company_entitlement_service, privacy_service
from app.services.company_collaboration_invitation_access import (
    find_pending_invitation_by_token,
    require_valid_verification_code,
    utcnow,
)
from app.services.company_collaboration_invitation_decision import accept_for_company


def activation_status(
    db: Session,
    token: str,
) -> CompanyCollaborationInvitationActivationStatus:
    invitation = find_pending_invitation_by_token(db, token)
    mode = (
        "sign_in"
        if user_repo.get_user_by_email(db, invitation.email)
        else "create_account"
    )
    return CompanyCollaborationInvitationActivationStatus(mode=mode)


def activate_new_account(
    db: Session,
    payload: CompanyCollaborationInvitationActivate,
    request: Request,
):
    invitation = find_pending_invitation_by_token(db, payload.token)
    require_valid_verification_code(invitation, payload.verification_code)
    if user_repo.get_user_by_email(db, invitation.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email already has a WorkHive account. Sign in to continue.",
        )
    return _create_company_and_accept(
        db,
        invitation=invitation,
        full_name=payload.full_name,
        company_name=payload.company_name,
        tax_id=payload.tax_id,
        address=payload.address,
        phone=payload.phone,
        password=payload.password,
        request=request,
        marketing_consent=payload.marketing_consent,
    )


def activate_existing_account(
    db: Session,
    payload: CompanyCollaborationInvitationActivateExistingAccount,
    current_user: User,
):
    invitation = find_pending_invitation_by_token(db, payload.token)
    if current_user.email.strip().lower() != invitation.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sign in with the email that received this invitation",
        )
    if current_user.company_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This account already belongs to a company. Use that company's administrator account.",
        )
    if current_user.role and current_user.role.name not in {"admin", "viewer"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This account has an internal role. Use an administrator email for "
                "the invited company instead."
            ),
        )
    require_valid_verification_code(invitation, payload.verification_code)
    return _create_company_and_accept(
        db,
        invitation=invitation,
        full_name=current_user.full_name or invitation.email,
        company_name=payload.company_name,
        tax_id=payload.tax_id,
        address=payload.address,
        phone=payload.phone,
        existing_user=current_user,
    )


def decline_without_account(
    db: Session,
    *,
    token: str,
    verification_code: str,
) -> CompanyCollaborationInvitation:
    """Let a recipient decline before it has a WorkHive account."""

    invitation = find_pending_invitation_by_token(db, token)
    require_valid_verification_code(invitation, verification_code)
    invitation.status = "declined"
    invitation.accepted_at = utcnow()
    db.commit()
    db.refresh(invitation)
    from app.services.company_collaboration_invitation_notifications import (
        notify_decision,
        send_decision_emails,
    )

    inviter_company = invitation.inviter_company
    if invitation.invited_by:
        notify_decision(
            db,
            invitation=invitation,
            users=[invitation.invited_by],
            counterpart_company_name=invitation.email,
            decision="declined",
        )
    send_decision_emails(invitation, inviter_company, None, "declined")
    return invitation


def _create_company_and_accept(
    db: Session,
    *,
    invitation: CompanyCollaborationInvitation,
    full_name: str,
    company_name: str,
    tax_id: str,
    address: str,
    phone: str,
    existing_user: User | None = None,
    password: str | None = None,
    request: Request | None = None,
    marketing_consent: bool = False,
):
    if company_repo.get_company_by_tax_id(db, tax_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Tax ID already exists"
        )
    admin_role = role_repo.get_role_by_name(db, "admin")
    if not admin_role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Role 'admin' not configured in database",
        )

    now = utcnow()
    company = Company(
        name=company_name.strip(),
        tax_id=tax_id.strip(),
        address=address.strip(),
        phone=phone.strip(),
        email=invitation.email,
        is_active=True,
        onboarding_completed=False,
        operating_model=(
            "property_manager"
            if invitation.role_type == "property_manager"
            else "service_provider"
        ),
        # Collaboration activation starts the same canonical Top trial as the
        # other company-creation paths.
        subscription_plan="top",
        subscription_status="trialing",
        trial_started_at=now,
        trial_ends_at=now + timedelta(days=14),
    )
    try:
        db.add(company)
        db.flush()
        if existing_user is None:
            if password is None or request is None:
                raise RuntimeError(
                    "Password and request are required for a new invitation account"
                )
            accepting_user = User(
                email=invitation.email,
                full_name=full_name.strip(),
                hashed_password=get_password_hash(password),
                is_active=True,
                email_verified_at=now,
                role_id=admin_role.id,
                company_id=company.id,
            )
            db.add(accepting_user)
            db.flush()
            privacy_service.record_registration_acknowledgements(
                db,
                user=accepting_user,
                request=request,
                policy_version=settings.PRIVACY_POLICY_VERSION,
                marketing_consent=marketing_consent,
                commit=False,
            )
        else:
            accepting_user = existing_user
            accepting_user.role_id = admin_role.id
            accepting_user.company_id = company.id
            accepting_user.email_verified_at = accepting_user.email_verified_at or now
            db.flush()
        company_entitlement_service.synchronize_company_subscription(
            db,
            company,
            reason="collaboration.company_created",
            actor_user_id=accepting_user.id,
            now=now,
        )
        return accept_for_company(
            db,
            invitation=invitation,
            accepting_company=company,
            accepting_user=accepting_user,
        )
    except Exception:
        db.rollback()
        raise
