"""Access-capacity and lifecycle guards applied when updating a user account."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company_membership import CompanyMembership
from app.models.external_access_grant import ExternalAccessGrant
from app.models.user import User
from app.schemas.user import UserUpdate
from app.services.entitlement_service import (
    require_accountant_portal_capacity,
    require_company_feature,
    require_internal_member_capacity,
)
from app.services.organization_member_service import active_admin_count


def sync_external_portal_grant_activation(
    db: Session,
    *,
    db_user: User,
    is_active: bool,
    actor_user_id: int,
) -> None:
    portal_grant = (
        db.query(ExternalAccessGrant)
        .filter(
            ExternalAccessGrant.company_id == db_user.company_id,
            ExternalAccessGrant.user_id == db_user.id,
            ExternalAccessGrant.access_type == "accountant",
        )
        .first()
    )
    if portal_grant is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The external portal grant is missing",
        )
    if is_active is False and db_user.is_active:
        portal_grant.status = "revoked"
        portal_grant.revoked_at = datetime.now(timezone.utc)
        portal_grant.revoked_by_user_id = actor_user_id
        db.add(portal_grant)
        return
    if is_active is True and not db_user.is_active:
        expires_at = portal_grant.expires_at
        if expires_at is not None and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at is not None and expires_at <= datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The external portal grant has expired and must be issued again",
            )
        require_company_feature(
            db,
            company_id=db_user.company_id,
            code="features.accountant_portal",
        )
        require_accountant_portal_capacity(
            db,
            company_id=db_user.company_id,
        )
        portal_grant.status = "active"
        portal_grant.revoked_at = None
        portal_grant.revoked_by_user_id = None
        db.add(portal_grant)


def enforce_internal_membership_update(
    db: Session,
    *,
    db_user: User,
    membership: CompanyMembership,
    user_data: UserUpdate,
    next_access_class: str | None,
) -> None:
    suspending_member = user_data.is_active is False and db_user.is_active
    demoting_admin = bool(
        membership.access_class == "admin"
        and next_access_class is not None
        and next_access_class != "admin"
    )
    if (
        membership.access_class == "admin"
        and membership.status == "active"
        and (suspending_member or demoting_admin)
        and active_admin_count(db, db_user.company_id) == 1
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A company must keep at least one active administrator",
        )
    next_membership_active = (
        user_data.is_active
        if user_data.is_active is not None
        else (db_user.is_active and membership.status == "active")
    )
    effective_next_class = next_access_class or membership.access_class
    if next_membership_active and (
        not db_user.is_active
        or membership.status != "active"
        or effective_next_class != membership.access_class
    ):
        require_internal_member_capacity(
            db,
            company_id=db_user.company_id,
            access_class=effective_next_class,
            exclude_membership_id=membership.id,
        )
