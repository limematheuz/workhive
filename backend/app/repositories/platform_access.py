from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.platform_setup import PlatformSetup
from app.models.role import Role
from app.models.user import User


def setup_completed(db: Session) -> bool:
    return db.get(PlatformSetup, 1) is not None


def has_platform_superadmin(db: Session) -> bool:
    return db.scalar(
        select(User.id).join(Role).where(Role.name == "superadmin", User.company_id.is_(None)).limit(1)
    ) is not None


def claim_setup(db: Session) -> None:
    db.add(PlatformSetup(id=1))
    db.flush()
