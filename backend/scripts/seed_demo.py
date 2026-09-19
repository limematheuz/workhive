"""Create a disposable local Enterprise demo database inside this repository."""

from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy.engine import make_url

from app.core.config import settings
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.schemas.user import validate_user_password
from scripts.demo_fixture import seed_demo_enterprise

DEMO_STORAGE_ROOT = Path(__file__).resolve().parents[1] / "storage" / "demo"


def require_demo_database() -> Path:
    """Allow destructive seeding only for the repository-owned demo database."""
    configured_url = os.environ.get("DEMO_DATABASE_URL", "")
    if settings.is_production:
        raise RuntimeError("Demo seeding is disabled in production")
    if settings.DATABASE_URL != configured_url:
        raise RuntimeError("DATABASE_URL must exactly match DEMO_DATABASE_URL")
    try:
        database_url = make_url(configured_url)
    except Exception as error:
        raise RuntimeError("DEMO_DATABASE_URL must be a SQLite database URL") from error
    if database_url.drivername != "sqlite" or not database_url.database:
        raise RuntimeError("DEMO_DATABASE_URL must be a SQLite database URL")
    database_path = Path(database_url.database)
    if not database_path.is_absolute() or not database_path.name.endswith(".demo.db"):
        raise RuntimeError(
            "DEMO_DATABASE_URL must name an absolute .demo.db SQLite file"
        )
    try:
        database_path.resolve().relative_to(DEMO_STORAGE_ROOT.resolve())
    except ValueError as error:
        raise RuntimeError(
            "DEMO_DATABASE_URL must stay inside backend/storage/demo"
        ) from error
    return database_path.resolve()


def require_demo_password() -> str:
    """Require a runtime-only credential; demo credentials never belong in Git."""
    password = os.environ.get("DEMO_PASSWORD", "")
    if not password:
        raise RuntimeError("DEMO_PASSWORD is required for local demo users")
    try:
        return validate_user_password(password)
    except ValueError as error:
        raise RuntimeError(
            "DEMO_PASSWORD does not meet the local password policy"
        ) from error


def seed() -> None:
    database_path = require_demo_database()
    password = require_demo_password()
    database_path.parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        company = seed_demo_enterprise(db, password=password)
    print(
        f"Seeded {company.name} in {database_path.name}. "
        "All contacts and locations are fictional."
    )


if __name__ == "__main__":
    seed()
