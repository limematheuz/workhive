"""Persistence queries for plans, company subscriptions and quota counters."""

from datetime import datetime

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.company import Company
from app.models.company_membership import CompanyMembership, Department, Team
from app.models.subscription_entitlement import (
    CompanyEntitlementOverride,
    CompanySubscription,
    EntitlementChangeAudit,
    SubscriptionPlan,
)


def get_plan(db: Session, *, code: str, version: int = 1) -> SubscriptionPlan | None:
    return (
        db.query(SubscriptionPlan)
        .options(selectinload(SubscriptionPlan.entitlements))
        .filter(SubscriptionPlan.code == code, SubscriptionPlan.version == version)
        .first()
    )


def get_active_plan(db: Session, *, code: str) -> SubscriptionPlan | None:
    return (
        db.query(SubscriptionPlan)
        .options(selectinload(SubscriptionPlan.entitlements))
        .filter(SubscriptionPlan.code == code, SubscriptionPlan.is_active.is_(True))
        .order_by(SubscriptionPlan.version.desc(), SubscriptionPlan.id.desc())
        .first()
    )


def list_active_plans(db: Session) -> list[SubscriptionPlan]:
    return (
        db.query(SubscriptionPlan)
        .options(selectinload(SubscriptionPlan.entitlements))
        .filter(SubscriptionPlan.is_active.is_(True))
        .order_by(SubscriptionPlan.code.asc(), SubscriptionPlan.version.desc())
        .all()
    )


def get_next_plan_version(db: Session, *, code: str) -> int:
    latest = (
        db.query(func.max(SubscriptionPlan.version))
        .filter(SubscriptionPlan.code == code)
        .scalar()
    )
    return int(latest or 0) + 1


def deactivate_active_plan_versions(db: Session, *, code: str) -> None:
    (
        db.query(SubscriptionPlan)
        .filter(SubscriptionPlan.code == code, SubscriptionPlan.is_active.is_(True))
        .update({SubscriptionPlan.is_active: False}, synchronize_session=False)
    )


def get_latest_company_subscription(
    db: Session, *, company_id: int
) -> CompanySubscription | None:
    return (
        db.query(CompanySubscription)
        .options(
            joinedload(CompanySubscription.plan).selectinload(
                SubscriptionPlan.entitlements
            )
        )
        .filter(CompanySubscription.company_id == company_id)
        .order_by(
            CompanySubscription.ended_at.is_(None).desc(),
            CompanySubscription.started_at.desc(),
            CompanySubscription.id.desc(),
        )
        .first()
    )


def lock_company(db: Session, *, company_id: int) -> Company | None:
    """Serialize each quota decision with the protected write on PostgreSQL."""
    return db.query(Company).filter(Company.id == company_id).with_for_update().first()


def get_company(db: Session, *, company_id: int) -> Company | None:
    return db.query(Company).filter(Company.id == company_id).first()


def list_active_overrides(
    db: Session, *, company_id: int, now: datetime
) -> list[CompanyEntitlementOverride]:
    return (
        db.query(CompanyEntitlementOverride)
        .filter(
            CompanyEntitlementOverride.company_id == company_id,
            CompanyEntitlementOverride.starts_at <= now,
            or_(
                CompanyEntitlementOverride.ends_at.is_(None),
                CompanyEntitlementOverride.ends_at > now,
            ),
        )
        .order_by(
            CompanyEntitlementOverride.code.asc(),
            CompanyEntitlementOverride.starts_at.desc(),
            CompanyEntitlementOverride.id.desc(),
        )
        .all()
    )


def list_open_overrides(
    db: Session, *, company_id: int, code: str, now: datetime
) -> list[CompanyEntitlementOverride]:
    return (
        db.query(CompanyEntitlementOverride)
        .filter(
            CompanyEntitlementOverride.company_id == company_id,
            CompanyEntitlementOverride.code == code,
            CompanyEntitlementOverride.starts_at <= now,
            or_(
                CompanyEntitlementOverride.ends_at.is_(None),
                CompanyEntitlementOverride.ends_at > now,
            ),
        )
        .order_by(
            CompanyEntitlementOverride.starts_at.desc(),
            CompanyEntitlementOverride.id.desc(),
        )
        .all()
    )


def list_company_entitlement_audit(
    db: Session, *, company_id: int, limit: int = 50
) -> list[EntitlementChangeAudit]:
    return (
        db.query(EntitlementChangeAudit)
        .filter(EntitlementChangeAudit.company_id == company_id)
        .order_by(
            EntitlementChangeAudit.created_at.desc(),
            EntitlementChangeAudit.id.desc(),
        )
        .limit(limit)
        .all()
    )


def count_active_memberships(
    db: Session,
    *,
    company_id: int,
    access_class: str,
    exclude_membership_id: int | None = None,
) -> int:
    query = db.query(func.count(CompanyMembership.id)).filter(
        CompanyMembership.company_id == company_id,
        CompanyMembership.status == "active",
        CompanyMembership.access_class == access_class,
    )
    if exclude_membership_id is not None:
        query = query.filter(CompanyMembership.id != exclude_membership_id)
    return int(query.scalar() or 0)


def count_active_departments(db: Session, *, company_id: int) -> int:
    return int(
        db.query(func.count(Department.id))
        .filter(Department.company_id == company_id, Department.is_active.is_(True))
        .scalar()
        or 0
    )


def count_active_teams(db: Session, *, company_id: int) -> int:
    return int(
        db.query(func.count(Team.id))
        .filter(Team.company_id == company_id, Team.is_active.is_(True))
        .scalar()
        or 0
    )
