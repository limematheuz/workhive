"""Lock the actual administrators of each company before identity erasure."""

from sqlalchemy import or_, exists
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.company_membership import CompanyMembership
from app.models.role import Role
from app.models.user import User
from app.core.datetime import as_utc


def active(member, now):
    return (
        member.status == "active", member.started_at <= now,
        or_(member.ended_at.is_(None), member.ended_at > now),
    )


def lock_administrations(db: Session, user: User, now):
    memberships = db.query(CompanyMembership).filter(CompanyMembership.user_id == user.id).all()
    company_ids = {
        row.company_id for row in memberships
        if row.access_class == "admin" and row.status == "active"
        and (row.started_at is None or as_utc(row.started_at) <= now)
        and (row.ended_at is None or as_utc(row.ended_at) > now)
    }
    if user.company_id is not None and user.role.name == "admin" and not any(row.company_id == user.company_id for row in memberships):
        company_ids.add(user.company_id)
    if not company_ids:
        return [], {}
    companies = db.query(Company).filter(Company.id.in_(company_ids)).order_by(Company.id).with_for_update().all()
    admins = db.query(CompanyMembership).join(User, User.id == CompanyMembership.user_id).filter(
        CompanyMembership.company_id.in_(company_ids), CompanyMembership.access_class == "admin",
        *active(CompanyMembership, now), User.is_active.is_(True),
        User.role.has(Role.name.in_({"admin","manager","viewer"})),
    ).order_by(CompanyMembership.company_id, CompanyMembership.id).with_for_update().all()
    history = exists().where(CompanyMembership.user_id == User.id, CompanyMembership.company_id == User.company_id)
    legacy = db.query(User).filter(
        User.company_id.in_(company_ids), User.is_active.is_(True),
        User.role.has(Role.name == "admin"), ~history,
    ).order_by(User.company_id, User.id).with_for_update().all()
    by_company = {company.id: set() for company in companies}
    for row in admins:
        by_company[row.company_id].add(row.user_id)
    for row in legacy:
        by_company[row.company_id].add(row.id)
    return companies, by_company
