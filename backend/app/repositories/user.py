from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash


def get_all_users(
    db: Session, company_id: int, skip: int = 0, limit: int = 100
) -> list[User]:
    return (
        db.query(User)
        .filter(User.company_id == company_id)
        .filter(User.is_active.is_(True))
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_company_members(db: Session, company_id: int) -> list[User]:
    return (
        db.query(User)
        .filter(User.company_id == company_id)
        .join(User.role)
        .order_by(User.is_active.desc(), User.full_name.asc(), User.id.asc())
        .all()
    )


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


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
