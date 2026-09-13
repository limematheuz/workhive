"""Persistence queries for public API credentials."""

from datetime import datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.models.api_access_key import ApiAccessKey


def list_for_company(db: Session, *, company_id: int) -> list[ApiAccessKey]:
    return (
        db.query(ApiAccessKey)
        .filter(ApiAccessKey.company_id == company_id)
        .order_by(ApiAccessKey.created_at.desc(), ApiAccessKey.id.desc())
        .all()
    )


def get_for_company(
    db: Session,
    *,
    company_id: int,
    key_id: int,
    for_update: bool = False,
) -> ApiAccessKey | None:
    query = db.query(ApiAccessKey).filter(
        ApiAccessKey.id == key_id,
        ApiAccessKey.company_id == company_id,
    )
    if for_update and db.bind and db.bind.dialect.name == "postgresql":
        query = query.with_for_update()
    return query.one_or_none()


def get_active_by_hash(
    db: Session,
    *,
    key_hash: str,
    now: datetime,
) -> ApiAccessKey | None:
    return (
        db.query(ApiAccessKey)
        .options(selectinload(ApiAccessKey.company))
        .filter(
            ApiAccessKey.key_hash == key_hash,
            ApiAccessKey.status == "active",
            or_(ApiAccessKey.expires_at.is_(None), ApiAccessKey.expires_at > now),
        )
        .one_or_none()
    )
