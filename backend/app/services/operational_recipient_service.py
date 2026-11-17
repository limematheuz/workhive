"""Operational candidate eligibility shared by assignment and delivery workflows."""

from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.operational_recipients import (
    eligible_user_ids,
    select_ids,
    select_users,
)
from app.services.organization_legacy_authorization_service import (
    legacy_roles_for_capabilities,
)


def eligible_ids_query(
    company_id: int,
    *,
    location_id: int | None = None,
    capabilities: tuple[str, ...] = ("work.read",),
):
    query = eligible_user_ids(
        company_id=company_id,
        location_id=location_id,
        capabilities=capabilities,
        legacy_roles=legacy_roles_for_capabilities(capabilities),
    )
    if capabilities != ("work.read",):
        query = query.where(User.id.in_(eligible_ids_query(company_id, location_id=location_id)))
    return query


def eligible_ids(
    db: Session, company_id: int, ids: set[int], *, location_id: int | None = None
) -> set[int]:
    return select_ids(db, eligible_ids_query(company_id, location_id=location_id), ids)


def eligible_users(
    db: Session,
    company_id: int,
    *,
    location_id: int | None = None,
    capabilities: tuple[str, ...] = ("work.read",),
) -> list[User]:
    query = eligible_ids_query(
        company_id, location_id=location_id, capabilities=capabilities
    )
    return select_users(db, query)
