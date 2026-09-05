from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload, with_loader_criteria
from app.models.calendar_governance import CompanyCalendarSettings
from app.models.company_membership import (
    CompanyMembership,
    DepartmentMembership,
    TeamMembership,
)
from app.models.expense import Expense
from app.models.google_calendar_connection import GoogleCalendarConnection
from app.models.permission_profile import (
    MembershipPermissionProfileAssignment,
    MembershipPermissionProfileScope,
)
from app.models.reservation import Reservation
from app.models.role import Role
from app.models.task_item import TaskItem
from app.models.trial_request import TrialRequest
from app.models.user import User
from app.models.work_session import WorkSession
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash


def user_response_load_options():
    return (
        selectinload(User.role),
        selectinload(User.company),
        selectinload(User.work_sessions).selectinload(WorkSession.location),
        with_loader_criteria(WorkSession, WorkSession.end_time.is_(None)),
    )


def get_all_users(
    db: Session, company_id: int | None, skip: int = 0, limit: int = 100
) -> list[User]:
    return (
        db.query(User)
        .options(*user_response_load_options())
        .filter(User.company_id == company_id)
        .filter(User.is_active.is_(True))
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_company_members(db: Session, company_id: int) -> list[User]:
    # Permanently removed legacy users retain an invalid placeholder address so
    # their historical foreign keys stay intact. They are not people who can be
    # managed from the company panel, and Pydantic correctly rejects that
    # placeholder as an email address in the member response.
    return (
        db.query(User)
        .options(*user_response_load_options())
        .filter(User.company_id == company_id)
        .filter(~User.email.endswith("@invalid.workhive.local"))
        .join(User.role)
        .filter(Role.name != "superadmin")
        .order_by(User.is_active.desc(), User.full_name.asc(), User.id.asc())
        .all()
    )


def get_user_by_email(db: Session, email: str) -> User | None:
    return (
        db.query(User)
        .options(*user_response_load_options())
        .filter(func.lower(User.email) == email.strip().lower())
        .first()
    )


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return (
        db.query(User)
        .options(*user_response_load_options())
        .filter(User.id == user_id)
        .first()
    )


def get_latest_company_membership(db: Session, user_id: int) -> CompanyMembership | None:
    """Return the latest company relationship for an identity without a workspace."""

    return (
        db.query(CompanyMembership)
        .filter(CompanyMembership.user_id == user_id)
        .order_by(
            CompanyMembership.ended_at.desc(),
            CompanyMembership.updated_at.desc(),
            CompanyMembership.id.desc(),
        )
        .first()
    )


def create_user(db: Session, user_data: UserCreate) -> User:
    db_user = stage_user(db, user_data)
    db.commit()
    db.refresh(db_user)
    return db_user


def stage_user(db: Session, user_data: UserCreate) -> User:
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        is_active=user_data.is_active,
        role_id=user_data.role_id,
        company_id=user_data.company_id,
    )
    db.add(db_user)
    db.flush()
    return db_user


def update_user(db: Session, db_user: User, user_data: UserUpdate) -> User:
    update_data = user_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(db_user, key):
            setattr(db_user, key, value)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def revoke_company_sessions(db: Session, *, company_id: int) -> None:
    """Invalidate active sessions after a platform-level access change."""
    (
        db.query(User)
        .filter(User.company_id == company_id)
        .update(
            {User.session_version: User.session_version + 1},
            synchronize_session=False,
        )
    )


def has_protected_user_data(db: Session, user_id: int) -> bool:
    """Return whether deleting a user would remove or orphan business history."""
    protected_references = (
        (TaskItem, TaskItem.user_id),
        (TaskItem, TaskItem.accepted_by_user_id),
        (WorkSession, WorkSession.user_id),
        (Expense, Expense.created_by_user_id),
        (Reservation, Reservation.created_by_user_id),
        (Reservation, Reservation.updated_by_user_id),
        (TrialRequest, TrialRequest.approved_by_user_id),
        (TrialRequest, TrialRequest.created_user_id),
        (GoogleCalendarConnection, GoogleCalendarConnection.connected_by_user_id),
        (CompanyCalendarSettings, CompanyCalendarSettings.owner_user_id),
    )
    return any(
        db.query(model).filter(column == user_id).first() is not None
        for model, column in protected_references
    )


def delete_user_access_configuration(db: Session, user_id: int) -> None:
    """Remove access-only records that cannot outlive a deleted person.

    Memberships, their team/department links, and permission-profile scopes are
    derived organization configuration. They do not represent business history
    and must not make a newly invited person impossible to remove.
    """
    membership_ids = [
        membership_id
        for (membership_id,) in db.query(CompanyMembership.id)
        .filter(CompanyMembership.user_id == user_id)
        .all()
    ]
    if not membership_ids:
        return

    profile_assignment_ids = [
        assignment_id
        for (assignment_id,) in db.query(MembershipPermissionProfileAssignment.id)
        .filter(
            MembershipPermissionProfileAssignment.company_membership_id.in_(
                membership_ids
            )
        )
        .all()
    ]
    if profile_assignment_ids:
        db.query(MembershipPermissionProfileScope).filter(
            MembershipPermissionProfileScope.profile_assignment_id.in_(
                profile_assignment_ids
            )
        ).delete(synchronize_session=False)
        db.query(MembershipPermissionProfileAssignment).filter(
            MembershipPermissionProfileAssignment.id.in_(profile_assignment_ids)
        ).delete(synchronize_session=False)

    db.query(DepartmentMembership).filter(
        DepartmentMembership.company_membership_id.in_(membership_ids)
    ).delete(synchronize_session=False)
    db.query(TeamMembership).filter(
        TeamMembership.company_membership_id.in_(membership_ids)
    ).delete(synchronize_session=False)
    db.query(CompanyMembership).filter(CompanyMembership.id.in_(membership_ids)).delete(
        synchronize_session=False
    )


def delete_user(db: Session, db_user: User) -> None:
    db.delete(db_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
