"""Scoped authorization policy for the operational task-assignee directory."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories import organization as organization_repo
from app.repositories import user as user_repo
from app.repositories import user_assignable as user_assignable_repo
from app.services.organization_authorization_service import (
    has_capability,
    permitted_location_ids,
)
from app.services.user_scope import is_platform_superadmin, require_company_context
from app.services.operational_recipient_service import eligible_ids_query

OPERATIONAL_SCOPE_CAPABILITIES = (
    "work.read",
    "work.manage",
    "time.manage",
    "time.read",
    "locations.read",
    "locations.manage",
)


def _resolve_scoped_candidate_user_ids(
    db: Session,
    *,
    company_id: int,
    current_user: User,
    target_location_ids: set[int],
    extra_department_ids: set[int],
    extra_team_ids: set[int],
) -> set[int]:
    if not target_location_ids and not extra_department_ids and not extra_team_ids:
        return set()
    return {current_user.id} | user_assignable_repo.get_scoped_candidate_user_ids(
        db,
        company_id=company_id,
        operational_scope_capabilities=OPERATIONAL_SCOPE_CAPABILITIES,
        target_location_ids=target_location_ids,
        extra_department_ids=extra_department_ids,
        extra_team_ids=extra_team_ids,
    )


def resolve_assignable_directory_scope(
    db: Session,
    current_user: User,
    location_id: int | None = None,
) -> tuple[int, set[int] | None]:
    """Return ``(company_id, allowed_user_ids)`` where ``None`` means company-wide."""

    if is_platform_superadmin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform administrators must not use a customer company context",
        )
    company_id = require_company_context(current_user)

    if location_id is not None and not organization_repo.is_valid_scope_target(
        db,
        company_id=company_id,
        scope_type="location",
        scope_id=location_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    if has_capability(db, current_user, "access.members.read") or has_capability(
        db, current_user, "work.manage"
    ):
        return company_id, None

    if location_id is not None:
        if not has_capability(
            db,
            current_user,
            "work.manage",
            scope_type="location",
            scope_id=location_id,
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        return company_id, _resolve_scoped_candidate_user_ids(
            db,
            company_id=company_id,
            current_user=current_user,
            target_location_ids={location_id},
            extra_department_ids=set(),
            extra_team_ids=set(),
        )

    permitted_locations = permitted_location_ids(db, current_user, "work.manage")
    if permitted_locations is None:
        return company_id, None

    membership = organization_repo.get_user_membership(
        db, company_id=company_id, user_id=current_user.id
    )
    dept_ids = (
        set(
            organization_repo.list_permission_scope_ids(
                db,
                company_id=company_id,
                membership_id=membership.id,
                permission_code="work.manage",
                scope_type="department",
            )
        )
        if membership
        else set()
    )
    team_ids = (
        set(
            organization_repo.list_permission_scope_ids(
                db,
                company_id=company_id,
                membership_id=membership.id,
                permission_code="work.manage",
                scope_type="team",
            )
        )
        if membership
        else set()
    )
    return company_id, _resolve_scoped_candidate_user_ids(
        db,
        company_id=company_id,
        current_user=current_user,
        target_location_ids=permitted_locations,
        extra_department_ids=dept_ids,
        extra_team_ids=team_ids,
    )


def list_assignable_users(
    db: Session,
    current_user: User,
    skip: int = 0,
    limit: int = 200,
    location_id: int | None = None,
) -> list[User]:
    company_id, allowed_ids = resolve_assignable_directory_scope(
        db, current_user, location_id=location_id
    )
    return user_repo.get_assignable_users(
        db, company_id, skip, limit, allowed_user_ids=allowed_ids,
        eligible_user_ids=eligible_ids_query(company_id, location_id=location_id),
    )
