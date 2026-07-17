from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload, with_loader_criteria
from app.models.calendar_governance import CompanyCalendarSettings
from app.models.expense import Expense
from app.models.google_calendar_connection import GoogleCalendarConnection
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
    db: Session, company_id: int, skip: int = 0, limit: int = 100
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
    return (
        db.query(User)
        .options(*user_response_load_options())
        .filter(User.company_id == company_id)
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


def create_user(db: Session, user_data: UserCreate) -> User:
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
    db.commit()
    db.refresh(db_user)
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


def delete_user(db: Session, db_user: User) -> None:
    db.delete(db_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
