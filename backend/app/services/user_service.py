from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from app.models.user import User
from app.models.external_access_grant import ExternalAccessGrant
from app.schemas.user import UserUpdate, UserStatsResponse
from app.repositories import user as user_repo
from app.repositories import work_session as work_session_repo
from app.repositories import task_item as task_item_repo
from app.repositories import role as role_repo
from app.core.security import get_password_hash, verify_password
from app.services import task_assignment_service
from app.services.entitlement_service import (
    require_accountant_portal_capacity,
    require_company_feature,
    require_internal_member_capacity,
)
from app.services import organization_bootstrap_service
from app.services.external_access_policy import EXTERNAL_PORTAL_ROLE_NAME
from app.services.user_scope import is_superadmin
import calendar


USER_DELETE_RELATED_DATA_ERROR = {
    "code": "USER_HAS_RELATED_DATA",
    "message": (
        "This user keeps operational history or controls an integration. "
        "Deactivate the user to preserve company records."
    ),
}


def _raise_user_delete_conflict() -> None:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=USER_DELETE_RELATED_DATA_ERROR,
    )


def get_users(
    db: Session, company_id: int, skip: int = 0, limit: int = 100
) -> list[User]:
    return user_repo.get_all_users(db, company_id, skip, limit)


def get_user(db: Session, user_id: int, current_user: User) -> User:
    existing_user = user_repo.get_user_by_id(db, user_id)
    if not existing_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    if (
        not is_superadmin(current_user)
        and existing_user.company_id != current_user.company_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to access this user",
        )
    return existing_user


def update_user(
    db: Session, user_id: int, user_data: UserUpdate, current_user: User
) -> User:
    db_user = get_user(db, user_id, current_user)
    is_own_profile = current_user.id == user_id

    if (
        not is_own_profile
        and current_user.role.name not in {"superadmin", "admin", "manager"}
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to manage another user",
        )

    if (
        not is_own_profile
        and db_user.role.name == EXTERNAL_PORTAL_ROLE_NAME
        and current_user.role.name not in {"superadmin", "admin"}
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to manage an external portal user",
        )

    if (
        user_data.is_active is not None
        and user_data.is_active != db_user.is_active
        and current_user.role.name not in {"superadmin", "admin", "manager"}
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to change user activation",
        )

    activating_user = (
        user_data.is_active is True
        and not db_user.is_active
        and db_user.company is not None
    )
    is_external_portal_user = bool(
        db_user.role and db_user.role.name == EXTERNAL_PORTAL_ROLE_NAME
    )
    if is_external_portal_user and user_data.is_active is not None:
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
        if user_data.is_active is False and db_user.is_active:
            portal_grant.status = "revoked"
            portal_grant.revoked_at = datetime.now(timezone.utc)
            portal_grant.revoked_by_user_id = current_user.id
            db.add(portal_grant)
        elif user_data.is_active is True and not db_user.is_active:
            expires_at = portal_grant.expires_at
            if expires_at is not None and expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if (
                expires_at is not None
                and expires_at <= datetime.now(timezone.utc)
            ):
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
    membership = None
    if activating_user and not is_external_portal_user:
        membership = organization_bootstrap_service.ensure_user_membership(db, db_user)
        if membership:
            require_internal_member_capacity(
                db,
                company_id=db_user.company_id,
                access_class=membership.access_class,
                exclude_membership_id=membership.id,
            )

    if user_data.password is not None:
        if not is_own_profile:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the profile owner can change their password",
            )
        if not user_data.old_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is required",
            )
        if len(user_data.password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must contain at least 8 characters",
            )
        if not verify_password(user_data.old_password, db_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )
        db_user.hashed_password = get_password_hash(user_data.password)

    if user_data.company_id is not None and user_data.company_id != db_user.company_id:
        if not is_superadmin(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only superadmins can change the company of a user",
            )
    if user_data.role_id is not None and user_data.role_id != db_user.role_id:
        if current_user.role.name not in ["superadmin", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to change user roles",
            )
        target_role = role_repo.get_role(db, user_data.role_id)
        if not target_role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target role not found",
            )
        if (
            (db_user.role and db_user.role.name == EXTERNAL_PORTAL_ROLE_NAME)
            != (target_role.name == EXTERNAL_PORTAL_ROLE_NAME)
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "External portal access cannot be converted into an internal "
                    "membership. Revoke it and issue the appropriate invitation."
                ),
            )
        if not is_superadmin(current_user):
            if target_role.name == "superadmin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only superadmins can assign the superadmin role",
                )
    updated_user = user_repo.update_user(db, db_user, user_data)
    if activating_user and membership:
        membership.status = "active"
        db.add(membership)
        db.commit()
        db.refresh(updated_user)
    return updated_user


def get_user_stats(
    db: Session, user_id: int, current_user: User, time_range: str | None = None
) -> UserStatsResponse:
    db_user = user_repo.get_user_by_id(db, user_id)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    is_own_profile = current_user.id == user_id
    is_super_admin = is_superadmin(current_user)
    is_admin_or_manager = (
        current_user.role.name in ["admin", "manager"]
        and db_user.company_id == current_user.company_id
    )

    if not (is_own_profile or is_super_admin or is_admin_or_manager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to view this user's stats",
        )

    if is_super_admin and db_user.company_id is None:
        return UserStatsResponse(
            total_hours_worked=0,
            total_tasks=0,
            tasks_completed=0,
            tasks_pending=0,
            active_session_id=None,
            locations_worked_count=0,
        )

    start_date = None
    if time_range and time_range != "all":
        now = datetime.now(timezone.utc)
        if time_range == "day":
            start_date = now - timedelta(days=1)
        elif time_range == "week":
            start_date = now - timedelta(days=7)
        elif time_range == "month":
            year = now.year
            month = now.month - 1
            if month == 0:
                month = 12
                year -= 1
            max_days_prev_month = calendar.monthrange(year, month)[1]
            day = min(now.day, max_days_prev_month)
            start_date = now.replace(year=year, month=month, day=day)
        elif time_range == "year":
            year = now.year - 1
            day = now.day
            if now.month == 2 and now.day == 29:
                if not calendar.isleap(year):
                    day = 28
            start_date = now.replace(year=year, day=day)

    active_session = work_session_repo.get_active_session_by_user(db, user_id)
    active_session_id = active_session.id if active_session else None

    closed_sessions = work_session_repo.get_closed_sessions_by_user(
        db, user_id, start_date
    )
    total_seconds = sum(
        (s.end_time - s.start_time).total_seconds() for s in closed_sessions
    )
    total_hours_worked = round(total_seconds / 3600.0, 2)

    total_tasks = task_item_repo.count_tasks_by_user(
        db,
        user_id,
        start_date,
        statuses=task_assignment_service.OPERATIONAL_VIEWER_STATUSES,
    )
    tasks_completed = task_item_repo.count_tasks_by_user_and_status(
        db, user_id, "completed", start_date
    )
    tasks_pending = task_item_repo.count_tasks_by_user_and_status(
        db, user_id, "pending", start_date
    )

    session_locations = work_session_repo.get_distinct_location_ids_by_user(
        db, user_id, start_date
    )
    task_locations = task_item_repo.get_distinct_location_ids_by_user(
        db, user_id, start_date
    )
    locations_worked_count = len(set(session_locations) | set(task_locations))

    return UserStatsResponse(
        total_hours_worked=total_hours_worked,
        total_tasks=total_tasks,
        tasks_completed=tasks_completed,
        tasks_pending=tasks_pending,
        active_session_id=active_session_id,
        locations_worked_count=locations_worked_count,
    )


def delete_user_permanently(db: Session, user_id: int, current_user: User) -> None:
    db_user = get_user(db, user_id, current_user)
    if db_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot permanently delete your own user",
        )
    if not is_superadmin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform administrators can permanently delete users",
        )

    if user_repo.has_protected_user_data(db, db_user.id):
        _raise_user_delete_conflict()

    try:
        user_repo.delete_user_access_configuration(db, db_user.id)
        user_repo.delete_user(db, db_user)
    except IntegrityError:
        _raise_user_delete_conflict()
